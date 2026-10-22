import type { Bridge } from './bridgeData';

export type RenderMode = 'condition' | 'recency' | 'exposure';

// A lowest NBI rating of 4 or below is the federal "structurally deficient"
// threshold (23 CFR 490.411), so it anchors the condition color ramp.
const DEFICIENT_MAX_RATING = 4;
const BEST_RATING = 9;

// Federal standards require routine bridge inspections at least every 24
// months (23 CFR 650.311), so that interval anchors the recency ramp.
const INSPECTION_INTERVAL_DAYS = 730;

// Reference exposure score used to scale the ramp: a badly-deficient bridge
// (rating 0, deficiency 9) carrying a busy urban daily traffic count.
const EXPOSURE_REFERENCE_SCORE = 9 * 40_000;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(from: readonly [number, number, number], to: readonly [number, number, number], t: number): string {
  const clamped = clamp(t, 0, 1);
  const r = Math.round(lerp(from[0], to[0], clamped));
  const g = Math.round(lerp(from[1], to[1], clamped));
  const b = Math.round(lerp(from[2], to[2], clamped));
  return `rgb(${r}, ${g}, ${b})`;
}

/** Days between an inspection date ("YYYY-MM") and `now`, clamped at 0. */
export function daysSinceInspection(lastInspected: string | null, now: number): number | null {
  if (!lastInspected) return null;
  const [year, month] = lastInspected.split('-').map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  const inspectedAt = new Date(year, month - 1, 1).getTime();
  return Math.max(0, Math.round((now - inspectedAt) / MS_PER_DAY));
}

/** Deficiency (0 = perfect, 9 = worst) weighted by daily traffic. */
export function exposureScore(bridge: Bridge): number {
  const deficiency = BEST_RATING - clamp(bridge.lowestRating, 0, BEST_RATING);
  return deficiency * (bridge.dailyTraffic ?? 0);
}

/**
 * Aggregates the bridges in one grid cell down to the single number each
 * render mode colors by: the worst rating, the longest overdue inspection,
 * or the highest exposure score. Returns null for an empty cell.
 */
export function aggregateCellValue(bridges: Bridge[], mode: RenderMode, now: number): number | null {
  if (bridges.length === 0) return null;

  if (mode === 'condition') {
    return Math.min(...bridges.map((bridge) => bridge.lowestRating));
  }

  if (mode === 'recency') {
    const days = bridges
      .map((bridge) => daysSinceInspection(bridge.lastInspected, now))
      .filter((value): value is number => value !== null);
    return days.length === 0 ? null : Math.max(...days);
  }

  return Math.max(...bridges.map(exposureScore));
}

export function colorForValue(mode: RenderMode, value: number): string {
  if (mode === 'condition') return conditionColor(value);
  if (mode === 'recency') return recencyColor(value);
  return exposureColor(value);
}

function conditionColor(rating: number): string {
  const clamped = clamp(rating, 0, BEST_RATING);
  if (clamped <= DEFICIENT_MAX_RATING) {
    return lerpColor([155, 20, 32], [253, 174, 97], clamped / DEFICIENT_MAX_RATING);
  }
  const t = (clamped - DEFICIENT_MAX_RATING) / (BEST_RATING - DEFICIENT_MAX_RATING);
  return lerpColor([255, 255, 191], [26, 152, 80], t);
}

function recencyColor(days: number): string {
  const clamped = clamp(days, 0, INSPECTION_INTERVAL_DAYS * 2);
  if (clamped <= INSPECTION_INTERVAL_DAYS) {
    return lerpColor([26, 152, 80], [255, 255, 191], clamped / INSPECTION_INTERVAL_DAYS);
  }
  const t = (clamped - INSPECTION_INTERVAL_DAYS) / INSPECTION_INTERVAL_DAYS;
  return lerpColor([255, 255, 191], [155, 20, 32], t);
}

function exposureColor(score: number): string {
  const clamped = clamp(score, 0, EXPOSURE_REFERENCE_SCORE);
  return lerpColor([255, 255, 191], [155, 20, 32], clamped / EXPOSURE_REFERENCE_SCORE);
}

export type LegendStop = { color: string; label: string };

export function legendStops(mode: RenderMode): LegendStop[] {
  if (mode === 'condition') {
    return [
      { color: conditionColor(0), label: '0 · worst' },
      { color: conditionColor(DEFICIENT_MAX_RATING), label: `${DEFICIENT_MAX_RATING} · structurally deficient` },
      { color: conditionColor(6), label: '6 · fair' },
      { color: conditionColor(BEST_RATING), label: `${BEST_RATING} · best` },
    ];
  }

  if (mode === 'recency') {
    return [
      { color: recencyColor(0), label: 'Just inspected' },
      { color: recencyColor(INSPECTION_INTERVAL_DAYS), label: '2 years · due' },
      { color: recencyColor(INSPECTION_INTERVAL_DAYS * 1.5), label: '3 years · overdue' },
      { color: recencyColor(INSPECTION_INTERVAL_DAYS * 2), label: '4+ years · overdue' },
    ];
  }

  return [
    { color: exposureColor(0), label: 'Low' },
    { color: exposureColor(EXPOSURE_REFERENCE_SCORE * 0.33), label: 'Moderate' },
    { color: exposureColor(EXPOSURE_REFERENCE_SCORE * 0.66), label: 'High' },
    { color: exposureColor(EXPOSURE_REFERENCE_SCORE), label: 'Severe' },
  ];
}
