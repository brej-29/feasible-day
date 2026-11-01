/**
 * Evaluation harness. Reproduces results/ from data/snapshots and data/llm (stored model outputs).
 *   npm run eval                      offline, uses stored LLM outputs
 *   npm run eval -- --llm --reps 3    also calls the LLMs for any missing outputs (needs HF_TOKEN)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { CITIES } from "../src/core/cities";
import { dayHours } from "../src/core/hours";
import { planDay } from "../src/core/planner";
import type { EvPlan, Evidence, Routed } from "../src/core/evidence";
import { verifyDay, type ExtStop, type Report } from "../src/core/verify";
import { matchPoi } from "../src/core/names";
import { confirmPlace, save } from "./geocode";
import { legacyPlan } from "./legacy";
import { llmRun, MODELS } from "./llm";
import { loadSnapshot, scenarios, type Scenario } from "./scenarios";
import { bootstrapCI, mean, pairedDiffCI, wilson } from "./stats";

const args = process.argv.slice(2);
const CALL = args.includes("--llm");
const REPS = Number(args[args.indexOf("--reps") + 1]) || 3;

interface Row {
  scenario: string;
  city: string;
  profile: string;
  day: string;
  system: string;
  rep: number;
  parsed: boolean;
  n: number;
  r: Pick<Report, "grounded" | "groundedExternal" | "closedAtVisit" | "knownHours" | "unknownHours" | "badTransfers" | "outsideDay" | "duplicates" |
    "feasible" | "scheduleFeasible" | "detourRatio" | "walkKm" | "profileMatch">;
}

const SYSTEMS = ["legacy", "llm-70b", "llm-8b", "planner", "planner-no-hours", "planner-no-routing"] as const;

function score(s: Scenario, system: string, rep: number, stops: ExtStop[] | null): Row {
  const snap = loadSnapshot(s.slug);
  const rep_ = verifyDay(snap, s.day.date, s.profile, stops ?? []);
  return {
    scenario: s.id, city: s.city, profile: s.profile, day: s.day.key, system, rep, parsed: stops !== null, n: rep_.n,
    r: {
      grounded: rep_.grounded, groundedExternal: rep_.groundedExternal, closedAtVisit: rep_.closedAtVisit, knownHours: rep_.knownHours, unknownHours: rep_.unknownHours,
      badTransfers: rep_.badTransfers, outsideDay: rep_.outsideDay, duplicates: rep_.duplicates, feasible: rep_.feasible,
      scheduleFeasible: rep_.scheduleFeasible, detourRatio: rep_.detourRatio, walkKm: rep_.walkKm, profileMatch: rep_.profileMatch,
    },
  };
}

/** Names missing from the snapshot get one existence check against the geocoder (cached). */
async function withCoords(slug: string, stops: ExtStop[] | null): Promise<ExtStop[] | null> {
  if (!stops) return stops;
  const snap = loadSnapshot(slug);
  const out: ExtStop[] = [];
  for (const st of stops) {
    if (matchPoi(st.name, snap.pois)) { out.push(st); continue; }
    const hit = await confirmPlace(st.name, slug, CALL);
    out.push(hit ? { ...st, lat: hit.lat, lon: hit.lon } : st);
  }
  return out;
}

const asExt = (plan: ReturnType<typeof planDay>): ExtStop[] =>
  plan.stops.map((x) => ({ name: x.poi.name, id: x.poi.id, startMin: x.startMin, endMin: x.endMin }));

function evPlan(s: Scenario, stops: ExtStop[] | null): EvPlan {
  const r = verifyDay(loadSnapshot(s.slug), s.day.date, s.profile, stops ?? []);
  return {
    feasible: r.feasible, parsed: stops !== null, transfers: r.transfers.map((t) => ({ ...t, gapMin: Math.round(t.gapMin), needMin: Math.round(t.needMin) })),
    stops: (stops ?? []).map((x, i) => ({
      name: x.name, startMin: x.startMin, endMin: x.endMin, lat: r.stops[i].poi?.lat, lon: r.stops[i].poi?.lon,
      hours: r.stops[i].hours, grounded: !!r.stops[i].poi, external: r.stops[i].external, insideDay: r.stops[i].insideDay,
    })),
  };
}

/** Cities added after pre-registration: no LLM baselines (cost), same planner and verifier, reported apart from the headline. */
function extensionSummary() {
  const sc = scenarios(true).filter((s) => existsSync(`data/snapshots/${s.slug}.json`));
  if (!sc.length) return null;
  const rows: Row[] = sc.flatMap((s) => {
    const snap = loadSnapshot(s.slug);
    return [
      score(s, "legacy", 0, legacyPlan(snap, s.profile)),
      score(s, "planner", 0, asExt(planDay(snap, s.profile, s.day.date))),
      score(s, "planner-no-hours", 0, asExt(planDay(snap, s.profile, s.day.date, { ignoreHours: true }))),
      score(s, "planner-no-routing", 0, asExt(planDay(snap, s.profile, s.day.date, { noRouting: true }))),
    ];
  });
  const agg = (rs: Row[]) => {
    const k = rs.filter((r) => r.r.feasible).length;
    const grounded = rs.reduce((a, r) => a + r.r.grounded, 0);
    const known = rs.reduce((a, r) => a + r.r.knownHours, 0);
    return {
      runs: rs.length, feasible: k, rate: k / rs.length, wilson95: wilson(k, rs.length),
      meanStops: mean(rs.map((r) => r.n)),
      unverifiedShare: grounded ? (grounded - known) / grounded : null,
      closedStopsPerPlan: mean(rs.map((r) => r.r.closedAtVisit)),
      fewerThan4: mean(rs.map((r) => (r.n < 4 ? 1 : 0))),
    };
  };
  const systems = Object.fromEntries(["legacy", "planner", "planner-no-hours", "planner-no-routing"].map((x) => [x, agg(rows.filter((r) => r.system === x))]));
  const cities = [...new Set(sc.map((s) => s.slug))].map((slug) => {
    const cs = rows.filter((r) => r.system === "planner" && sc.find((s) => s.id === r.scenario)!.slug === slug);
    return { slug, city: sc.find((s) => s.slug === slug)!.city, ...agg(cs) };
  });
  const f = "results/osrm-check-extension.json";
  const o = existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as { plans: number; plansWhereEveryTransferFitsRoutedTime: number; transfers: number; transfersFitting: number; perCity: Record<string, Routed> }) : null;
  const routed = o ? { plans: o.plans, plansOk: o.plansWhereEveryTransferFitsRoutedTime, transfers: o.transfers, transfersOk: o.transfersFitting, perCity: o.perCity } : undefined;
  return { days: sc.length, routed, systems, cities };
}

async function main() {
  const all = scenarios().filter((s) => existsSync(`data/snapshots/${s.slug}.json`));
  const missing = CITIES.filter((c) => !existsSync(`data/snapshots/${c.slug}.json`)).map((c) => c.slug);
  if (missing.length) console.warn("no snapshot for:", missing.join(", "));
  const rows: Row[] = [];
  const showcase: Evidence["showcase"] = {};
  const notFound: { system: string; city: string; name: string }[] = [];

  if (CALL) {
    const jobs = all.flatMap((s) => ["llm-70b", "llm-8b"].flatMap((sys) => Array.from({ length: REPS }, (_, rep) => () => llmRun(sys, s, rep, true))));
    let next = 0;
    await Promise.all(Array.from({ length: 4 }, async () => { while (next < jobs.length) await jobs[next++](); }));
  }

  for (const s of all) {
    const snap = loadSnapshot(s.slug);
    rows.push(score(s, "legacy", 0, legacyPlan(snap, s.profile)));
    rows.push(score(s, "planner", 0, asExt(planDay(snap, s.profile, s.day.date))));
    rows.push(score(s, "planner-no-hours", 0, asExt(planDay(snap, s.profile, s.day.date, { ignoreHours: true }))));
    rows.push(score(s, "planner-no-routing", 0, asExt(planDay(snap, s.profile, s.day.date, { noRouting: true }))));
    for (const sys of ["llm-70b", "llm-8b"]) {
      for (let rep = 0; rep < REPS; rep++) {
        const run = await llmRun(sys, s, rep, CALL);
        if (run) {
          const stops = await withCoords(s.slug, run.stops);
          rows.push(score(s, sys, rep, stops));
          const rep_ = verifyDay(loadSnapshot(s.slug), s.day.date, s.profile, stops ?? []);
          rep_.stops.forEach((x) => { if (!x.poi) notFound.push({ system: sys, city: s.city, name: x.name }); });
          if (rep === 0) (showcase[s.id] ??= {})[sys] = evPlan(s, stops);
        }
      }
    }
  }

  save();

  const extension = extensionSummary();

  // ---- summary -------------------------------------------------------------------------
  const ids = [...new Set(all.map((s) => s.id))];
  const summary: Record<string, unknown> = {};
  for (const sys of SYSTEMS) {
    const rs = rows.filter((r) => r.system === sys);
    if (!rs.length) continue;
    const bySc = ids.map((id) => rs.filter((r) => r.scenario === id));
    const k = rs.filter((r) => r.r.feasible).length;
    const feasPer = bySc.map((g) => g.map((r) => (r.r.feasible ? 1 : 0)));
    const stops = rs.reduce((a, r) => a + r.n, 0);
    const grounded = rs.reduce((a, r) => a + r.r.grounded, 0);
    const external = rs.reduce((a, r) => a + r.r.groundedExternal, 0);
    const known = rs.reduce((a, r) => a + r.r.knownHours, 0);
    const closed = rs.reduce((a, r) => a + r.r.closedAtVisit, 0);
    const per = (f: (r: Row) => number) => bySc.map((g) => g.map(f));
    const withDetour = (r: Row) => r.r.detourRatio !== null;
    summary[sys] = {
      runs: rs.length,
      scenarios: ids.length,
      feasibleDay: { k, n: rs.length, rate: k / rs.length, wilson95: wilson(k, rs.length), clusterBootstrap95: bootstrapCI(feasPer) },
      scheduleFeasibleGivenGrounding: mean(rs.map((r) => (r.r.scheduleFeasible ? 1 : 0))),
      scheduleFeasibleGivenGroundingWilson95: wilson(rs.filter((r) => r.r.scheduleFeasible).length, rs.length),
      failureShare: {
        notParsed: mean(rs.map((r) => (r.parsed ? 0 : 1))),
        fewerThan4Stops: mean(rs.map((r) => (r.n < 4 ? 1 : 0))),
        anyUngroundedStop: mean(rs.map((r) => (r.r.grounded < r.n ? 1 : 0))),
        anyClosedAtVisit: mean(rs.map((r) => (r.r.closedAtVisit > 0 ? 1 : 0))),
        anyUnwalkableTransfer: mean(rs.map((r) => (r.r.badTransfers > 0 ? 1 : 0))),
        anyOutsideDay: mean(rs.map((r) => (r.r.outsideDay > 0 ? 1 : 0))),
        anyDuplicate: mean(rs.map((r) => (r.r.duplicates > 0 ? 1 : 0))),
      },
      stopLevel: {
        stops, groundedRate: stops ? grounded / stops : null,
        inSnapshotRate: stops ? (grounded - external) / stops : null,
        confirmedByGeocoderRate: stops ? external / stops : null,
        notFoundRate: stops ? (stops - grounded) / stops : null,
        stopsWithKnownHours: known,
        closedAtVisitRate: known ? closed / known : null,
        unverifiedShare: grounded ? (grounded - known) / grounded : null,
      },
      meanStops: mean(rs.map((r) => r.n)),
      meanStopsCI: bootstrapCI(per((r) => r.n)),
      profileMatch: mean(rs.map((r) => r.r.profileMatch)),
      profileMatchCI: bootstrapCI(per((r) => r.r.profileMatch)),
      detourRatio: mean(rs.filter(withDetour).map((r) => r.r.detourRatio!)),
      detourRatioCI: bootstrapCI(bySc.map((g) => g.filter(withDetour).map((r) => r.r.detourRatio!))),
      meanWalkKm: mean(rs.map((r) => r.r.walkKm)),
    };
  }

  const pick = (sys: string, f: (r: Row) => number) =>
    ids.map((id) => mean(rows.filter((r) => r.system === sys && r.scenario === id).map(f)));
  const ablations = {
    hoursAwareness_closedStopsPerPlan: pairedDiffCI(pick("planner-no-hours", (r) => r.r.closedAtVisit), pick("planner", (r) => r.r.closedAtVisit)),
    routing_detourRatio: pairedDiffCI(
      pick("planner-no-routing", (r) => r.r.detourRatio ?? NaN).map((x) => (Number.isNaN(x) ? 1 : x)),
      pick("planner", (r) => r.r.detourRatio ?? NaN).map((x) => (Number.isNaN(x) ? 1 : x)),
    ),
  };

  // ---- OSM opening-hours coverage in the snapshots -----------------------------------------
  const coverage = CITIES.filter((c) => existsSync(`data/snapshots/${c.slug}.json`)).map((c) => {
    const snap = loadSnapshot(c.slug);
    const byCat: Record<string, { pois: number; withHours: number; knownOnTestDays: number; holidayClausesDropped: number }> = {};
    for (const p of snap.pois) {
      if (p.cat === "food") continue; // food POIs were selected for having hours; coverage would be meaningless
      const e = (byCat[p.cat] ??= { pois: 0, withHours: 0, knownOnTestDays: 0, holidayClausesDropped: 0 });
      e.pois++;
      if (p.hours) e.withHours++;
      const dh = dayHours(p, scenarios()[0].day.date, c.slug);
      if (dh.status === "known") e.knownOnTestDays++;
      if (dh.approx) e.holidayClausesDropped++;
    }
    return { city: c.name, nonFood: byCat };
  });

  const hyp = (() => {
    const lenient = (s: string) => (summary[s] as { scheduleFeasibleGivenGroundingWilson95: number[] } | undefined)?.scheduleFeasibleGivenGroundingWilson95[1];
    const g = (s: string) => summary[s] as { feasibleDay: { wilson95: number[]; rate: number }; meanStops: number; profileMatch: number; detourRatio: number } | undefined;
    const p = g("planner"), a = g("llm-70b"), b = g("llm-8b");
    return {
      H1_llmMostlyInfeasible: a && b ? a.feasibleDay.wilson95[1] < 0.5 && b.feasibleDay.wilson95[1] < 0.5 : null,
      H1b_llmMostlyInfeasibleEvenIgnoringUnmatchedStops: lenient("llm-70b") !== undefined && lenient("llm-8b") !== undefined ? lenient("llm-70b")! < 0.5 && lenient("llm-8b")! < 0.5 : null,
      H2_plannerFeasible: p ? p.feasibleDay.rate >= 0.95 && p.feasibleDay.wilson95[0] >= 0.9 : null,
      H3_notByDoingLess: p ? p.meanStops >= 6 && p.profileMatch >= 0.8 && p.detourRatio <= 1.15 : null,
      H4_ablations: {
        hoursCIExcludesZero: ablations.hoursAwareness_closedStopsPerPlan.ci[0] > 0,
        routingCIExcludesZero: ablations.routing_detourRatio.ci[0] > 0,
      },
    };
  })();

  mkdirSync("results", { recursive: true });
  const models = Object.fromEntries(Object.entries(MODELS));
  writeFileSync("results/summary.json", JSON.stringify({ generatedFrom: "npm run eval", reps: REPS, models, summary, ablations, hypotheses: hyp }, null, 2));
  writeFileSync("results/runs.json", JSON.stringify(rows));
  const uniq = new Map<string, { system: string; city: string; name: string; count: number }>();
  for (const n of notFound) {
    const k = `${n.city}|${n.name.toLowerCase()}`;
    uniq.set(k, { ...n, count: (uniq.get(k)?.count ?? 0) + 1 });
  }
  writeFileSync("results/not-found-names.json", JSON.stringify([...uniq.values()].sort((a, b) => b.count - a.count), null, 1));
  mkdirSync("public", { recursive: true });
  const evidence: Evidence = {
    reps: REPS, models, summary: summary as Evidence["summary"], ablations,
    hypotheses: hyp as Record<string, unknown>, coverage, extension,
    scenarios: all.map((x) => ({ id: x.id, slug: x.slug, city: x.city, profile: x.profile, day: x.day.key })), showcase,
  };
  writeFileSync("public/evidence.json", JSON.stringify(evidence));
  writeFileSync("results/hours-coverage.json", JSON.stringify(coverage, null, 2));
  writeFileSync("results/extension.json", JSON.stringify(extension, null, 2));
  console.log(JSON.stringify({ hyp, ablations }, null, 2));
  for (const [sys, v] of Object.entries(summary)) {
    const x = v as { runs: number; feasibleDay: { rate: number; wilson95: number[] }; meanStops: number; profileMatch: number; detourRatio: number };
    console.log(sys.padEnd(20), `runs=${x.runs}`, `feasible=${(x.feasibleDay.rate * 100).toFixed(1)}% [${(x.feasibleDay.wilson95[0] * 100).toFixed(0)}-${(x.feasibleDay.wilson95[1] * 100).toFixed(0)}]`,
      `stops=${x.meanStops.toFixed(1)}`, `match=${(x.profileMatch * 100).toFixed(0)}%`, `detour=${x.detourRatio.toFixed(2)}`);
  }
}

main();
