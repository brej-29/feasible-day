import { useEffect, useMemo, useState } from "react";
import type { EvPlan, Evidence, SystemSummary } from "../core/evidence";
import { planDay } from "../core/planner";
import type { Profile } from "../core/types";
import { verifyDay } from "../core/verify";
import { fmtTime, loadSnapshot, parseDate } from "./data";
import { Check, Cross, Question } from "./Icons";

const NAMES: Record<string, string> = {
  legacy: "Original app logic",
  "llm-8b": "Llama 3.1 8B alone",
  "llm-70b": "Llama 3.3 70B alone",
  planner: "Feasible Day planner",
  "planner-no-hours": "Planner, hours ignored",
  "planner-no-routing": "Planner, no routing",
};
const ORDER = ["legacy", "llm-8b", "llm-70b", "planner"];
const pct = (x: number | null | undefined, d = 0) => (x == null || Number.isNaN(x) ? "n/a" : `${(x * 100).toFixed(d)}%`);

function RateChart({ summary }: { summary: Record<string, SystemSummary> }) {
  return (
    <figure className="ratechart">
      <figcaption>Share of test days that pass every rule, with 95% interval. Small print: the share if stops that could not be matched to a place are ignored</figcaption>
      <ul>
        {ORDER.filter((k) => summary[k]).map((k) => {
          const s = summary[k].feasibleDay;
          return (
            <li key={k} className={k === "planner" ? "is-ours" : ""}>
              <span className="rc-name">{NAMES[k]}<small>{pct(summary[k].scheduleFeasibleGivenGrounding)} ignoring unmatched stops</small></span>
              <span className="rc-track" role="img" aria-label={`${NAMES[k]}: ${pct(s.rate, 1)}, interval ${pct(s.wilson95[0])} to ${pct(s.wilson95[1])}`}>
                <span className="rc-bar" style={{ width: `${s.rate * 100}%` }} />
                <span className="rc-whisker" style={{ left: `${s.wilson95[0] * 100}%`, width: `${(s.wilson95[1] - s.wilson95[0]) * 100}%` }} />
              </span>
              <span className="rc-val">{pct(s.rate, 1)}<small>{s.k}/{s.n}</small></span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}

const FAIL_COLS: [string, string][] = [
  ["anyUngroundedStop", "Stop not found in OSM"],
  ["anyClosedAtVisit", "Closed when visited"],
  ["anyUnwalkableTransfer", "Transfer too short"],
  ["anyOutsideDay", "Outside 09:00-21:00"],
  ["fewerThan4Stops", "Fewer than 4 stops"],
];

function FailureTable({ summary }: { summary: Record<string, SystemSummary> }) {
  return (
    <div className="tablewrap">
      <table>
        <caption>Share of plans with at least one problem of each kind</caption>
        <thead>
          <tr><th scope="col">System</th>{FAIL_COLS.map(([, l]) => <th key={l} scope="col">{l}</th>)}</tr>
        </thead>
        <tbody>
          {ORDER.filter((k) => summary[k]).map((k) => (
            <tr key={k}>
              <th scope="row">{NAMES[k]}</th>
              {FAIL_COLS.map(([f]) => {
                const v = summary[k].failureShare[f] ?? 0;
                return (
                  <td key={f} style={{ ["--v" as string]: v }}>
                    <span className="cellbar" />
                    <span className="cellnum">{pct(v)}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComparePlan({ title, plan }: { title: string; plan: EvPlan | null }) {
  return (
    <section className="cmp" aria-label={title}>
      <h3>{title} {plan && <span className={plan.feasible ? "verdict ok" : "verdict bad"}>{plan.feasible ? "Feasible" : "Not feasible"}</span>}</h3>
      {!plan || !plan.parsed ? (
        <p className="muted">No stored output for this scenario.</p>
      ) : (
        <ol>
          {plan.stops.map((s, i) => {
            const tr = plan.transfers.find((t) => t.to === s.name && !t.ok);
            return (
              <li key={i}>
                <span className="cmp-time">{fmtTime(s.startMin)}</span>
                <span className="cmp-name">{s.name}</span>
                <span className="cmp-flags">
                  {!s.grounded && <span className="chip chip-bad hatch"><Cross />Not found in OSM</span>}
                  {s.grounded && s.hours === "closed" && <span className="chip chip-bad"><Cross />Closed then</span>}
                  {s.grounded && s.hours === "unknown" && <span className="chip chip-unk hatch"><Question />{s.external ? "Real place, hours unknown" : "Hours unverified"}</span>}
                  {s.grounded && s.hours === "open" && <span className="chip chip-ok"><Check />Open</span>}
                  {tr && <span className="chip chip-bad"><Cross />Walk needs {Math.round(tr.needMin)} min, gap {Math.round(tr.gapMin)}</span>}
                  {!s.insideDay && <span className="chip chip-bad"><Cross />Outside day</span>}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function Compare({ ev }: { ev: Evidence }) {
  const cities = useMemo(() => [...new Map(ev.scenarios.map((s) => [s.slug, s.city])).entries()], [ev]);
  const [slug, setSlug] = useState(cities[0]?.[0] ?? "paris");
  const [profile, setProfile] = useState<Profile>("culture");
  const [day, setDay] = useState<"mon" | "sun">("mon");
  const id = `${slug}-${profile}-${day}`;
  const [mine, setMine] = useState<EvPlan | null>(null);

  useEffect(() => {
    let live = true;
    const sc = ev.scenarios.find((s) => s.id === id);
    if (!sc) return;
    loadSnapshot(slug).then((snap) => {
      const date = parseDate(day === "mon" ? "2026-11-16" : "2026-11-22");
      const plan = planDay(snap, profile, date);
      const r = verifyDay(snap, date, profile, plan.stops.map((x) => ({ name: x.poi.name, id: x.poi.id, startMin: x.startMin, endMin: x.endMin })));
      if (live)
        setMine({
          feasible: r.feasible, parsed: true, transfers: r.transfers,
          stops: plan.stops.map((x, i) => ({ name: x.poi.name, startMin: x.startMin, endMin: x.endMin, hours: r.stops[i].hours, grounded: true, insideDay: r.stops[i].insideDay })),
        });
    });
    return () => { live = false; };
  }, [ev, id, slug, profile, day]);

  return (
    <section aria-labelledby="cmp-h" className="block">
      <h2 id="cmp-h">Same day, two planners</h2>
      <p className="lede">The model was asked for one walking day with the opening-hours and walking-time rules stated in the prompt. Both plans are checked by the same code.</p>
      <div className="controls inline">
        <label>City<select value={slug} onChange={(e) => setSlug(e.target.value)}>{cities.map(([s, n]) => <option key={s} value={s}>{n}</option>)}</select></label>
        <label>Profile<select value={profile} onChange={(e) => setProfile(e.target.value as Profile)}>{["culture", "nature", "food", "mixed"].map((p) => <option key={p}>{p}</option>)}</select></label>
        <label>Day<select value={day} onChange={(e) => setDay(e.target.value as "mon" | "sun")}><option value="mon">Monday 16 Nov 2026</option><option value="sun">Sunday 22 Nov 2026</option></select></label>
      </div>
      <div className="cmp-grid">
        <ComparePlan title="Llama 3.3 70B alone" plan={ev.showcase[id]?.["llm-70b"] ?? null} />
        <ComparePlan title="Feasible Day planner" plan={mine} />
      </div>
    </section>
  );
}

function Coverage({ rows }: { rows: Evidence["coverage"] }) {
  const data = rows.map((r) => {
    const all = Object.values(r.nonFood);
    const pois = all.reduce((a, c) => a + c.pois, 0);
    const withHours = all.reduce((a, c) => a + c.withHours, 0);
    return { city: r.city, pois, share: pois ? withHours / pois : 0 };
  }).sort((a, b) => b.share - a.share);
  return (
    <section className="block" aria-labelledby="cov-h">
      <h2 id="cov-h">How much of OpenStreetMap has opening hours</h2>
      <p className="lede">Sights, museums, parks and monuments in the snapshots (restaurants excluded, they were selected for having hours). No published figure existed, so this is measured here.</p>
      <ul className="covlist">
        {data.map((d) => (
          <li key={d.city}>
            <span>{d.city}</span>
            <span className="rc-track"><span className="rc-bar" style={{ width: `${d.share * 100}%` }} /></span>
            <span className="rc-val">{pct(d.share)}<small>of {d.pois}</small></span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function EvidenceView({ ev }: { ev: Evidence }) {
  const s = ev.summary;
  const hyp = ev.hypotheses as Record<string, unknown>;
  const mark = (v: unknown) => (v === true ? "Met" : v === false ? "Not met" : "Not run");
  return (
    <div className="evidence">
      <section className="block" aria-labelledby="ev-h">
        <h2 id="ev-h">Measured on {s.planner?.scenarios ?? 0} test days</h2>
        <p className="lede">12 cities, 4 interest profiles, a Monday and a Sunday. LLM systems ran {ev.reps} times per day at temperature 0.7. A day passes only if every rule in the Rulebook holds.</p>
        <RateChart summary={s} />
        <FailureTable summary={s} />
      </section>
      <Compare ev={ev} />
      <section className="block" aria-labelledby="ab-h">
        <h2 id="ab-h">What each part of the planner contributes</h2>
        <ul className="plain">
          <li>Ignoring opening hours adds <b>{ev.ablations.hoursAwareness_closedStopsPerPlan.diff.toFixed(2)}</b> closed stops per plan (95% interval {ev.ablations.hoursAwareness_closedStopsPerPlan.ci[0].toFixed(2)} to {ev.ablations.hoursAwareness_closedStopsPerPlan.ci[1].toFixed(2)}).</li>
          <li>Skipping route optimisation adds <b>{ev.ablations.routing_detourRatio.diff.toFixed(2)}</b> to the detour ratio (95% interval {ev.ablations.routing_detourRatio.ci[0].toFixed(2)} to {ev.ablations.routing_detourRatio.ci[1].toFixed(2)}). 1.00 would be the shortest possible walk through the same stops.</li>
        </ul>
      </section>
      <Coverage rows={ev.coverage} />
      <section className="block" aria-labelledby="hy-h">
        <h2 id="hy-h">Pre-registered thresholds</h2>
        <table>
          <thead><tr><th scope="col">Hypothesis</th><th scope="col">Result</th></tr></thead>
          <tbody>
            <tr><th scope="row">H1 LLM-only plans are mostly infeasible</th><td>{mark(hyp.H1_llmMostlyInfeasible)}</td></tr>
            <tr><th scope="row">H1 also holds when unmatched stops are ignored</th><td>{mark(hyp.H1b_llmMostlyInfeasibleEvenIgnoringUnmatchedStops)}</td></tr>
            <tr><th scope="row">H2 The planner produces feasible days (95% or more)</th><td>{mark(hyp.H2_plannerFeasible)}</td></tr>
            <tr><th scope="row">H3 It does not win by doing less</th><td>{mark(hyp.H3_notByDoingLess)}</td></tr>
          </tbody>
        </table>
        <p className="muted">Definitions and thresholds were committed before the planner was written: docs/PREREGISTRATION.md.</p>
      </section>
    </div>
  );
}
