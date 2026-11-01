/**
 * Calibrates the walking-time model against a routing engine (OSRM foot profile on routing.openstreetmap.de).
 * Samples random POI pairs 0.2 to 1.8 km apart (seeded), the range of a walking transfer. Run: npm run calibrate. Writes results/walk-calibration.json.
 * Requests are cached in eval/cache (git-ignored) and spaced 1 s apart.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { DETOUR_FACTOR, haversineKm, walkMin } from "../src/core/geo";
import { loadSnapshot } from "./scenarios";
import { mulberry32 } from "./stats";
import { CITIES } from "../src/core/cities";

const PAIRS_PER_CITY = 25;
const UA = "feasible-day-research/0.1 (https://github.com/brej-29/feasible-day)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function osrmSeconds(a: { lat: number; lon: number }, b: { lat: number; lon: number }): Promise<number | null> {
  mkdirSync("eval/cache", { recursive: true });
  const key = `eval/cache/${[a.lat, a.lon, b.lat, b.lon].map((x) => x.toFixed(5)).join("_")}.json`;
  if (existsSync(key)) return JSON.parse(readFileSync(key, "utf8")).s;
  const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) });
      if (r.ok) {
        const j = (await r.json()) as { routes?: { duration: number }[] };
        const s = j.routes?.[0]?.duration ?? null;
        writeFileSync(key, JSON.stringify({ s }));
        await sleep(1000);
        return s;
      }
    } catch { /* retry */ }
    await sleep(3000);
  }
  return null;
}

const pairs: { city: string; ours: number; osrm: number; straightKm: number }[] = [];
// the 12 pre-registered cities only: the 300-pair calibration must not change when cities are added
for (const c of CITIES.filter((x) => !x.ext)) {
  try { readFileSync(`data/snapshots/${c.slug}.json`); } catch { continue; }
  const pois = loadSnapshot(c.slug).pois.filter((p) => p.cat !== "food");
  const rnd = mulberry32(2026);
  let got = 0;
  for (let tries = 0; tries < 4000 && got < PAIRS_PER_CITY; tries++) {
    const a = pois[Math.floor(rnd() * pois.length)], b = pois[Math.floor(rnd() * pois.length)];
    const km = haversineKm(a, b);
    if (km < 0.2 || km > 1.8) continue;
    const t = await osrmSeconds(a, b);
    if (t !== null && t > 0) { pairs.push({ city: c.name, ours: walkMin(a, b), osrm: t / 60, straightKm: km }); got++; }
  }
}

const ratio = pairs.map((p) => p.ours / p.osrm).sort((x, y) => x - y);
const q = (p: number) => ratio[Math.floor(p * (ratio.length - 1))];
const mape = pairs.reduce((a, p) => a + Math.abs(p.ours - p.osrm) / p.osrm, 0) / pairs.length;
const under20 = pairs.filter((p) => p.ours < 0.8 * p.osrm).length / pairs.length;
const out = {
  engine: "OSRM foot profile, routing.openstreetmap.de", pairs: pairs.length,
  ratioOursOverRouted: { p10: q(0.1), median: q(0.5), p90: q(0.9) }, meanAbsPctError: mape,
  shareWhereOursUnderestimatesBy20pct: under20,
  currentDetourFactor: DETOUR_FACTOR,
  detourFactorThatMakesMedianRatioOne: DETOUR_FACTOR / q(0.5),
};
mkdirSync("results", { recursive: true });
writeFileSync("results/walk-calibration.json", JSON.stringify(out, null, 2));
console.log(out);
