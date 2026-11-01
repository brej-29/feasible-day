const R_KM = 6371.0088;
/** Straight-line distance understates street distance. 1.37 = 1.3 divided by the median ours/routed ratio (0.947) over 300 seeded pairs against OSRM foot routing, see results/walk-calibration.json. */
export const DETOUR_FACTOR = 1.37;
export const WALK_KMH = 4.8;

type LL = { lat: number; lon: number };

export function haversineKm(a: LL, b: LL): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(h));
}

export const walkKm = (a: LL, b: LL) => haversineKm(a, b) * DETOUR_FACTOR;
export const walkMin = (a: LL, b: LL) => (walkKm(a, b) / WALK_KMH) * 60;

export function pathKm(pts: LL[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += walkKm(pts[i - 1], pts[i]);
  return s;
}

/** Shortest open path through pts (free start and end). Exact for <= 8 points, 2-opt otherwise. */
export function shortestPathKm(pts: LL[]): number {
  const n = pts.length;
  if (n < 3) return pathKm(pts);
  if (n <= 8) {
    let best = Infinity;
    const idx = pts.map((_, i) => i);
    const permute = (k: number) => {
      if (k === n) {
        best = Math.min(best, pathKm(idx.map((i) => pts[i])));
        return;
      }
      for (let i = k; i < n; i++) {
        [idx[k], idx[i]] = [idx[i], idx[k]];
        permute(k + 1);
        [idx[k], idx[i]] = [idx[i], idx[k]];
      }
    };
    permute(0);
    return best;
  }
  let order = pts.map((_, i) => i);
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const cand = [...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)];
        if (pathKm(cand.map((k) => pts[k])) < pathKm(order.map((k) => pts[k])) - 1e-9) {
          order = cand;
          improved = true;
        }
      }
    }
  }
  return pathKm(order.map((k) => pts[k]));
}
