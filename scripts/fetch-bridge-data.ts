/**
 * Fetches the National Bridge Inventory (NBI) data for Indiana and writes a
 * trimmed JSON file for the tile-overlay example.
 *
 * Run manually (this script is not part of the build):
 *   node --experimental-strip-types scripts/fetch-bridge-data.ts
 *
 * Source note: the current/live NBI is published by FHWA/BTS through the
 * National Transportation Atlas Database on ArcGIS Hub (DOI 10.21949/1522152),
 * not as a Socrata dataset on data.transportation.gov — that domain only has
 * historical snapshot years (e.g. 1992-2010) under the old NBI publication
 * process, nothing current. FHWA still publishes current per-state data
 * directly as delimited ASCII, which is what this script reads. 2025 is the
 * last year FHWA published in this legacy delimited format (it's being
 * superseded by the Specifications for the National Bridge Inventory, SNBI),
 * but 2025 is also the most recent full year available as of this writing.
 */

import { writeFileSync } from 'node:fs';

const NBI_YEAR = 2025;
const STATE_CODE = '18'; // Indiana
const SOURCE_URL = `https://www.fhwa.dot.gov/bridge/nbi/${NBI_YEAR}/delimited/IN25.txt`;
const OUTPUT_PATH = new URL('../src/examples/tile-overlay/data/indiana-bridges.json', import.meta.url);

// The delimited NBI files quote text fields with single quotes, and those
// quoted fields can themselves contain commas, so a plain String#split(',')
// would misalign columns. This parses one line respecting that quoting.
function parseDelimitedLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === "'") {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  fields.push(current.trim());
  return fields;
}

// NBI Items 16/17 encode latitude as DDMMSSss (8 digits) and longitude as
// DDDMMSSss (9 digits: degrees, minutes, seconds, hundredths of a second).
// Longitude in the continental US is always west, so it's negated.
function nbiLatitudeToDecimal(raw: string): number {
  const padded = raw.padStart(8, '0');
  const degrees = Number(padded.slice(0, 2));
  const minutes = Number(padded.slice(2, 4));
  const seconds = Number(padded.slice(4, 6)) + Number(padded.slice(6, 8)) / 100;
  return degrees + minutes / 60 + seconds / 3600;
}

function nbiLongitudeToDecimal(raw: string): number {
  const padded = raw.padStart(9, '0');
  const degrees = Number(padded.slice(0, 3));
  const minutes = Number(padded.slice(3, 5));
  const seconds = Number(padded.slice(5, 7)) + Number(padded.slice(7, 9)) / 100;
  return -(degrees + minutes / 60 + seconds / 3600);
}

function isAllZeroOrEmpty(raw: string): boolean {
  return raw.length === 0 || /^0+$/.test(raw);
}

function round5(value: number): number {
  return Math.round(value * 1e5) / 1e5;
}

// NBI Item 90 (date of inspection) is coded MMYY; the delimited export drops
// the leading zero on single-digit months, so "723" means "0723" -> 2023-07.
function parseInspectionDate(raw: string): string | null {
  if (raw.length === 0) return null;
  const padded = raw.padStart(4, '0');
  const month = Number(padded.slice(0, 2));
  const year = 2000 + Number(padded.slice(2, 4));
  if (month < 1 || month > 12) return null;
  return `${year}-${String(month).padStart(2, '0')}`;
}

function parseNumericOrNull(raw: string): number | null {
  return /^[0-9]+$/.test(raw) ? Number(raw) : null;
}

export type Bridge = {
  lat: number;
  lng: number;
  /** NBI Item 8: unique structure identifier within the state. */
  structureNumber: string;
  /** NBI Item 7: the road/route the bridge carries, e.g. "SR 1". */
  facilityCarried: string | null;
  /** NBI Item 6A: what's being crossed, e.g. "BR BLACK RIVER". */
  featureCrossed: string | null;
  /** FHWA-computed overall condition: Good, Fair, or Poor. */
  condition: 'G' | 'F' | 'P';
  /** Lowest of the deck/superstructure/substructure/culvert ratings, 0-9. */
  lowestRating: number;
  yearBuilt: number;
  /** "YYYY-MM", or null if the inspection date is missing. */
  lastInspected: string | null;
  /** Average daily traffic, or null if not reported. */
  dailyTraffic: number | null;
};

const REQUIRED_COLUMNS = [
  'STATE_CODE_001',
  'STRUCTURE_NUMBER_008',
  'FACILITY_CARRIED_007',
  'FEATURES_DESC_006A',
  'LAT_016',
  'LONG_017',
  'YEAR_BUILT_027',
  'ADT_029',
  'DATE_OF_INSPECT_090',
  'BRIDGE_CONDITION',
  'LOWEST_RATING',
];

function textOrNull(raw: string): string | null {
  return raw.length === 0 ? null : raw;
}

async function main() {
  console.log(`Fetching ${SOURCE_URL}`);
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch NBI data: HTTP ${response.status}`);
  }
  const text = await response.text();
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length < 2) {
    throw new Error('NBI response had no data rows.');
  }

  const header = parseDelimitedLine(lines[0]);
  const columnIndex: Record<string, number> = {};
  for (const name of REQUIRED_COLUMNS) {
    const index = header.indexOf(name);
    if (index === -1) {
      throw new Error(
        `Expected NBI column "${name}" was not found in the response header. ` +
          'The field layout may have changed; verify against the Coding Guide before proceeding.',
      );
    }
    columnIndex[name] = index;
  }

  let droppedMissingCoordinates = 0;
  let skippedWrongState = 0;
  let skippedUnratedCondition = 0;
  // Written as tuples, not {key: value} objects: with 10 fields x 19,542
  // records, repeating the key names in every record roughly doubles the
  // file size for no benefit, since the shape never varies. The column
  // order here must match BRIDGE_TUPLE_FIELDS in bridgeData.ts.
  const bridges: Bridge[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseDelimitedLine(lines[i]);

    const stateCode = fields[columnIndex.STATE_CODE_001];
    if (stateCode !== STATE_CODE) {
      skippedWrongState++;
      continue;
    }

    const rawLat = fields[columnIndex.LAT_016];
    const rawLng = fields[columnIndex.LONG_017];
    if (isAllZeroOrEmpty(rawLat) || isAllZeroOrEmpty(rawLng)) {
      droppedMissingCoordinates++;
      continue;
    }

    const condition = fields[columnIndex.BRIDGE_CONDITION];
    if (condition !== 'G' && condition !== 'F' && condition !== 'P') {
      // Unrated/unknown structures don't fit the three condition buckets the
      // overlay renders; skip rather than mis-render them.
      skippedUnratedCondition++;
      continue;
    }

    bridges.push({
      lat: round5(nbiLatitudeToDecimal(rawLat)),
      lng: round5(nbiLongitudeToDecimal(rawLng)),
      structureNumber: fields[columnIndex.STRUCTURE_NUMBER_008],
      facilityCarried: textOrNull(fields[columnIndex.FACILITY_CARRIED_007]),
      featureCrossed: textOrNull(fields[columnIndex.FEATURES_DESC_006A]),
      condition,
      lowestRating: Number(fields[columnIndex.LOWEST_RATING]),
      yearBuilt: Number(fields[columnIndex.YEAR_BUILT_027]),
      lastInspected: parseInspectionDate(fields[columnIndex.DATE_OF_INSPECT_090]),
      dailyTraffic: parseNumericOrNull(fields[columnIndex.ADT_029]),
    });
  }

  const tuples = bridges.map((bridge) => [
    bridge.lat,
    bridge.lng,
    bridge.structureNumber,
    bridge.facilityCarried,
    bridge.featureCrossed,
    bridge.condition,
    bridge.lowestRating,
    bridge.yearBuilt,
    bridge.lastInspected,
    bridge.dailyTraffic,
  ]);
  const json = JSON.stringify(tuples);
  writeFileSync(OUTPUT_PATH, json);

  const sizeMb = Buffer.byteLength(json) / (1024 * 1024);
  console.log(`Rows read: ${lines.length - 1}`);
  console.log(`Skipped (wrong state code): ${skippedWrongState}`);
  console.log(`Skipped (unrated condition): ${skippedUnratedCondition}`);
  console.log(`Dropped (missing/zero coordinates): ${droppedMissingCoordinates}`);
  console.log(`Bridges written: ${bridges.length}`);
  console.log(`Output: ${OUTPUT_PATH.pathname} (${sizeMb.toFixed(2)} MB)`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
