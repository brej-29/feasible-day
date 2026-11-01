/**
 * Fetches a walkable-core POI snapshot per city from OpenStreetMap via Overpass.
 * Data © OpenStreetMap contributors, ODbL 1.0. Run: npm run data
 * Public Overpass servers are busy: queries are small, sequential, with backoff.
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { CITIES } from "./cities";

const RADIUS_M = 3500;
const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const UA = "feasible-day-research/0.1 (https://github.com/brej-29/feasible-day)";

type Cat = "culture" | "history" | "nature" | "landmark" | "food";
interface Group { cat: Cat; filter: string }

const GROUPS: Group[] = [
  { cat: "culture", filter: `["tourism"~"^(museum|gallery)$"]["name"]` },
  { cat: "landmark", filter: `["tourism"~"^(attraction|viewpoint|zoo)$"]["name"]` },
  { cat: "history", filter: `["historic"~"^(monument|castle|memorial|archaeological_site|ruins|fort|city_gate)$"]["name"]["wikidata"]` },
  { cat: "history", filter: `["amenity"="place_of_worship"]["name"]["wikidata"]` },
  { cat: "nature", filter: `["leisure"~"^(park|garden)$"]["name"]["wikidata"]` },
  { cat: "food", filter: `["amenity"~"^(restaurant|cafe)$"]["name"]["opening_hours"]` },
];

interface Raw { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags: Record<string, string> }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function overpass(query: string): Promise<Raw[]> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const url = MIRRORS[attempt % MIRRORS.length];
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
        body: "data=" + encodeURIComponent(query),
        signal: AbortSignal.timeout(90_000),
      });
      if (res.ok) return ((await res.json()) as { elements: Raw[] }).elements;
      console.warn(`  ${res.status} from ${new URL(url).host}, retrying`);
    } catch (e) {
      console.warn(`  ${(e as Error).name} from ${new URL(url).host}, retrying`);
    }
    await sleep(8000 * (attempt + 1));
  }
  throw new Error("Overpass unavailable after retries");
}

function kindOf(t: Record<string, string>): string {
  return t.tourism ?? t.historic ?? t.amenity ?? t.leisure ?? "poi";
}

async function main() {
  mkdirSync("data/snapshots", { recursive: true });
  const only = process.argv[2];
  for (const c of CITIES) {
    if (only && only !== c.slug) continue;
    const out = `data/snapshots/${c.slug}.json`;
    if (existsSync(out) && !process.argv.includes("--force")) { console.log("skip", c.slug); continue; }
    console.log("fetching", c.name);
    const pois = new Map<string, unknown>();
    for (const g of GROUPS) {
      const q = `[out:json][timeout:60];nwr(around:${RADIUS_M},${c.lat},${c.lon})${g.filter};out center tags;`;
      const els = await overpass(q);
      for (const e of els) {
        const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
        if (lat == null || lon == null) continue;
        const t = e.tags;
        const id = `${e.type[0]}${e.id}`;
        if (pois.has(id)) continue;
        pois.set(id, {
          id, name: t.name, nameEn: t["name:en"], alt: t.alt_name, lat, lon, cat: g.cat, kind: kindOf(t),
          hours: t.opening_hours, wd: t.wikidata ? 1 : 0, fee: t.fee, site: t.website ?? t["contact:website"],
          cuisine: t.cuisine,
        });
      }
      console.log(`  ${g.cat} ${g.filter.slice(0, 40)}: ${els.length}`);
      await sleep(3000);
    }
    let list = [...pois.values()] as { cat: Cat; lat: number; lon: number }[];
    // keep the snapshot small: food nearest to centre first, capped
    const d = (p: { lat: number; lon: number }) => (p.lat - c.lat) ** 2 + (p.lon - c.lon) ** 2;
    const food = list.filter((p) => p.cat === "food").sort((a, b) => d(a) - d(b)).slice(0, 350);
    list = [...list.filter((p) => p.cat !== "food"), ...food];
    writeFileSync(out, JSON.stringify({
      city: c, fetchedAt: new Date().toISOString(), radiusM: RADIUS_M,
      attribution: "© OpenStreetMap contributors, ODbL 1.0", pois: list,
    }));
    console.log("wrote", out, list.length);
  }
}
main();
