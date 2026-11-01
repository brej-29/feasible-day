/**
 * Existence check for venue names that are not in a city snapshot. The snapshots hold notable places within
 * 3.5 km, so a real venue can be absent. A Nominatim hit near the city, with a similar name, counts as "exists".
 * Results are cached in data/geocode-cache.json (committed) so the evaluation reproduces offline.
 * Nominatim policy: identify the app, at most 1 request per second. Data © OpenStreetMap contributors, ODbL.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { CITIES } from "../src/core/cities";
import { haversineKm } from "../src/core/geo";
import { jaroWinkler, normalize } from "../src/core/names";

const FILE = "data/geocode-cache.json";
const UA = "feasible-day-research/0.1 (https://github.com/brej-29/feasible-day)";
const MAX_KM = 12;
const MIN_SIM = 0.8;

export interface Hit { lat: number; lon: number; display: string }
type Cache = Record<string, Hit | null>;

const cache: Cache = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : {};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let last = 0;

export const save = () => writeFileSync(FILE, JSON.stringify(cache, null, 0));

function similar(query: string, display: string): boolean {
  const q = normalize(query);
  const first = normalize(display.split(",")[0]);
  if (jaroWinkler(q, first) >= MIN_SIM) return true;
  const qt = q.split(" ").filter((t) => t.length > 2);
  const dt = new Set(normalize(display).split(" "));
  return qt.length > 0 && qt.every((t) => dt.has(t));
}

export async function confirmPlace(name: string, slug: string, allowCall: boolean): Promise<Hit | null> {
  const key = `${slug}|${normalize(name)}`;
  if (key in cache) return cache[key];
  if (!allowCall) return null;
  const c = CITIES.find((x) => x.slug === slug)!;
  const wait = 1100 - (Date.now() - last);
  if (wait > 0) await sleep(wait);
  last = Date.now();
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=3&q=${encodeURIComponent(`${name}, ${c.name}`)}`;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) });
      if (!r.ok) { await sleep(5000); continue; }
      const rows = (await r.json()) as { lat: string; lon: string; display_name: string }[];
      const hit = rows.map((x) => ({ lat: +x.lat, lon: +x.lon, display: x.display_name }))
        .find((x) => haversineKm(c, x) <= MAX_KM && similar(name, x.display));
      cache[key] = hit ?? null;
      return cache[key];
    } catch { await sleep(5000); }
  }
  return null; // network failure: not cached, so a rerun retries
}
