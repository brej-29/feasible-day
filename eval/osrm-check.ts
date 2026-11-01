/**
 * Independent re-check of planner plans: every transfer is re-timed with routed walking durations (OSRM foot,
 * routing.openstreetmap.de) instead of the planner's own distance model. Run: npm run osrm-check.
 * Writes results/osrm-check.json. Cached in eval/cache, 1 request per second.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { planDay } from "../src/core/planner";
import { SLACK_MIN } from "../src/core/verify";
import { loadSnapshot, scenarios } from "./scenarios";

const UA = "feasible-day-research/0.1 (https://github.com/brej-29/feasible-day)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function routedMin(a: { lat: number; lon: number }, b: { lat: number; lon: number }): Promise<number | null> {
  mkdirSync("eval/cache", { recursive: true });
  const key = `eval/cache/${[a.lat, a.lon, b.lat, b.lon].map((x) => x.toFixed(5)).join("_")}.json`;
  if (existsSync(key)) { const s = JSON.parse(readFileSync(key, "utf8")).s; return s == null ? null : s / 60; }
  const url = `https://routing.openstreetmap.de/routed-foot/route/v1/foot/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30_000) });
      if (r.ok) {
        const s = ((await r.json()) as { routes?: { duration: number }[] }).routes?.[0]?.duration ?? null;
        writeFileSync(key, JSON.stringify({ s }));
        await sleep(1000);
        return s == null ? null : s / 60;
      }
    } catch { /* retry */ }
    await sleep(3000);
  }
  return null;
}

const perCity: Record<string, { plans: number; plansOk: number; transfers: number; transfersOk: number }> = {};
let plans = 0, plansOk = 0, transfers = 0, transfersOk = 0, skipped = 0;
const worst: { scenario: string; short: number }[] = [];
const EXT = process.argv.includes("--ext"); // the cities added after pre-registration
for (const s of scenarios(EXT)) {
  const plan = planDay(loadSnapshot(s.slug), s.profile, s.day.date);
  const pc = (perCity[s.city] ??= { plans: 0, plansOk: 0, transfers: 0, transfersOk: 0 });
  let ok = true;
  for (let i = 1; i < plan.stops.length; i++) {
    const gap = plan.stops[i].startMin - plan.stops[i - 1].endMin;
    const need = await routedMin(plan.stops[i - 1].poi, plan.stops[i].poi);
    if (need === null) { skipped++; continue; }
    transfers++; pc.transfers++;
    if (gap + SLACK_MIN >= need) { transfersOk++; pc.transfersOk++; }
    else { ok = false; worst.push({ scenario: s.id, short: need - gap }); }
  }
  plans++; pc.plans++;
  if (ok) { plansOk++; pc.plansOk++; }
}
worst.sort((a, b) => b.short - a.short);
const out = {
  engine: "OSRM foot profile, routing.openstreetmap.de", plans, plansWhereEveryTransferFitsRoutedTime: plansOk,
  share: plansOk / plans, transfers, transfersFitting: transfersOk, transferShare: transfersOk / transfers,
  transfersSkippedNoRoute: skipped, perCity, slackMin: SLACK_MIN, worstShortfallsMin: worst.slice(0, 8),
};
mkdirSync("results", { recursive: true });
writeFileSync(EXT ? "results/osrm-check-extension.json" : "results/osrm-check.json", JSON.stringify(out, null, 2));
console.log(out);
