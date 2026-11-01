import { writeFileSync } from "node:fs";
import { CITIES } from "../src/core/cities";
import { REQUEST_REPO } from "../src/core/notices";

/**
 * Compiles open `city-request` GitHub issues into docs/REQUESTS.md for review. Issue text is untrusted: it is only
 * sanitised and used as a search string. It is never given to the LLM and nothing is added automatically.
 */
const UA = "feasible-day-research/0.1 (github.com/brej-29)";
/** Allowlist, not blocklist: place names only. Quotes, backticks, pipes, brackets and slashes cannot survive, so the text is inert in markdown and in the pasted TypeScript line. */
const clean = (s: string) => s.normalize("NFC").replace(/[^\p{L}\p{M}\p{N} .,'()-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Issue { number: number; body: string | null; user: { login: string } | null; reactions?: { "+1"?: number } }

export function field(body: string, label: string): string {
  const m = new RegExp(`###\\s*${label}\\s*\\n+([^\\n#][^\\n]*)`, "i").exec(body);
  return m ? clean(m[1]) : "";
}

export async function geocode(city: string, country: string) {
  const q = new URLSearchParams({ q: `${city}, ${country}`, format: "jsonv2", limit: "1", addressdetails: "1", "accept-language": "en" });
  const r = await fetch(`https://nominatim.openstreetmap.org/search?${q}`, { headers: { "user-agent": UA }, signal: AbortSignal.timeout(20_000) });
  const j = (await r.json()) as { lat: string; lon: string; display_name: string; address?: { country_code?: string } }[];
  return j[0] ? { lat: Number(j[0].lat), lon: Number(j[0].lon), cc: j[0].address?.country_code ?? "", display: j[0].display_name } : null;
}

/** Named sights within the planner's 3.5 km radius: a rough "is there a day here" check. */
export async function sights(lat: number, lon: number): Promise<number | null> {
  const q = `[out:json][timeout:40];nwr(around:3500,${lat},${lon})["name"]["tourism"~"^(museum|gallery|attraction|viewpoint)$"];out count;`;
  try {
    const r = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST", headers: { "user-agent": UA, "content-type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(q), signal: AbortSignal.timeout(60_000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { elements: { tags: { total: string } }[] };
    return Number(j.elements[0]?.tags.total ?? NaN);
  } catch {
    return null;
  }
}

export async function runRequests(): Promise<string> {
  const token = process.env.GITHUB_TOKEN;
  const res = await fetch(`https://api.github.com/repos/${REQUEST_REPO}/issues?labels=city-request&state=open&per_page=100`, {
    headers: { "user-agent": UA, accept: "application/vnd.github+json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(`GitHub issues: ${res.status} (private repo needs GITHUB_TOKEN)`);
  const issues = (await res.json()) as Issue[];

  const groups = new Map<string, { city: string; country: string; issues: number[]; people: Set<string>; thumbs: number }>();
  for (const i of issues) {
    const city = field(i.body ?? "", "City or area"), country = field(i.body ?? "", "Country");
    if (!city || !country) continue;
    const key = `${city.toLowerCase()}|${country.toLowerCase()}`;
    const g = groups.get(key) ?? { city, country, issues: [], people: new Set<string>(), thumbs: 0 };
    g.issues.push(i.number);
    g.people.add(i.user?.login ?? "?");
    g.thumbs += i.reactions?.["+1"] ?? 0;
    groups.set(key, g);
  }

  const rows: string[] = [];
  for (const g of [...groups.values()].sort((a, b) => b.people.size + b.thumbs - (a.people.size + a.thumbs))) {
    const have = CITIES.some((c) => c.name.toLowerCase() === g.city.toLowerCase());
    await sleep(1100); // Nominatim: one request per second
    const geo = have ? null : await geocode(g.city, g.country).catch(() => null);
    const n = geo ? await sights(geo.lat, geo.lon) : null;
    const where = geo ? `${geo.lat.toFixed(4)}, ${geo.lon.toFixed(4)} (${geo.cc || "?"})` : have ? "already available" : "not found";
    const slug = g.city.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "") || "TODO";
    const cc = /^[a-z]{2}$/.test(geo?.cc ?? "") ? geo!.cc : "TODO";
    const line = geo ? `\`{ slug: ${JSON.stringify(slug)}, name: ${JSON.stringify(g.city)}, country: ${JSON.stringify(g.country)}, lat: ${geo.lat.toFixed(4)}, lon: ${geo.lon.toFixed(4)}, tz: "TODO", cc: ${JSON.stringify(cc)}, ext: true }\`` : "";
    rows.push(`| ${g.city} | ${g.country} | ${g.people.size + g.thumbs} | ${g.issues.map((x) => "#" + x).join(" ")} | ${where} | ${n ?? "?"} | ${line} |`);
  }
  const md = [
    "# City requests",
    "",
    `Generated ${new Date().toISOString().slice(0, 10)} from open \`city-request\` issues. Review by hand, then add a line to \`src/core/cities.ts\`, set the real \`tz\`, run \`npx tsx eval/build-snapshots.ts <slug>\` and check the plan before merging.`,
    "Demand = distinct requesters plus thumbs-up. Sights = named museums, galleries, attractions and viewpoints within 3.5 km of the geocoded point (a day plan needs about 8 or more).",
    "",
    "| City | Country | Demand | Issues | Geocoded | Sights | Line to add |",
    "|---|---|---|---|---|---|---|",
    ...rows,
    "",
  ].join("\n");
  writeFileSync("docs/REQUESTS.md", md);
  return `requests: ${issues.length} open issues, ${groups.size} distinct places`;
}
