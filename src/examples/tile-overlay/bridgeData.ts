import bridgeData from './data/indiana-bridges.json';

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

// indiana-bridges.json stores each bridge as a tuple in this order, not as
// {key: value} objects — repeating 10 key names across 19,542 records would
// roughly double the file size for a shape that never varies. Keep this in
// sync with the tuple assembled in scripts/fetch-bridge-data.ts.
type BridgeTuple = [
  number, // lat
  number, // lng
  string, // structureNumber
  string | null, // facilityCarried
  string | null, // featureCrossed
  'G' | 'F' | 'P', // condition
  number, // lowestRating
  number, // yearBuilt
  string | null, // lastInspected
  number | null, // dailyTraffic
];

function tupleToBridge([
  lat,
  lng,
  structureNumber,
  facilityCarried,
  featureCrossed,
  condition,
  lowestRating,
  yearBuilt,
  lastInspected,
  dailyTraffic,
]: BridgeTuple): Bridge {
  return { lat, lng, structureNumber, facilityCarried, featureCrossed, condition, lowestRating, yearBuilt, lastInspected, dailyTraffic };
}

// Produced by scripts/fetch-bridge-data.ts from FHWA's National Bridge
// Inventory; see that script and the README for provenance.
export function loadBridges(): Bridge[] {
  return (bridgeData as BridgeTuple[]).map(tupleToBridge);
}
