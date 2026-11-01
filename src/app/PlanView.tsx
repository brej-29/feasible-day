import { useMemo } from "react";
import { verifyDay, type Report } from "../core/verify";
import type { DayPlan, Snapshot, Stop } from "../core/types";
import { fmtTime } from "./data";
import { Check, Cross, Question } from "./Icons";

const DAY_START = 9 * 60;
const DAY_END = 21 * 60;

export function reportFor(snap: Snapshot, plan: DayPlan): Report {
  return verifyDay(snap, plan.date, plan.profile, plan.stops.map((s) => ({
    name: s.poi.name, id: s.poi.id, startMin: s.startMin, endMin: s.endMin,
  })));
}

/** The day laid out on a 09:00-21:00 ruler: solid = hours checked, hatched = hours unverified. */
export function DayRuler({ stops }: { stops: Pick<Stop, "startMin" | "endMin" | "hours">[] }) {
  const pct = (m: number) => `${((m - DAY_START) / (DAY_END - DAY_START)) * 100}%`;
  return (
    <div className="ruler" aria-hidden="true">
      {stops.map((s, i) => (
        <span
          key={i}
          className={`ruler-bar ${s.hours === "unknown" ? "hatch" : s.hours === "closed" ? "bad" : "ok"}`}
          style={{ left: pct(s.startMin), width: `calc(${pct(s.endMin)} - ${pct(s.startMin)})` }}
        />
      ))}
      <div className="ruler-ticks">
        {[9, 12, 15, 18, 21].map((h) => (
          <span key={h} style={{ left: pct(h * 60) }}>{h}</span>
        ))}
      </div>
    </div>
  );
}

function HoursChip({ stop }: { stop: Stop }) {
  if (stop.hours === "open")
    return <span className="chip chip-ok"><Check />Open at visit</span>;
  if (stop.hours === "closed")
    return <span className="chip chip-bad"><Cross />Closed then</span>;
  return <span className="chip chip-unk hatch"><Question />Hours unverified</span>;
}

export function Timeline({
  plan, active, onSelect,
}: { plan: DayPlan; active: number | null; onSelect: (i: number) => void }) {
  return (
    <ol className="timeline">
      {plan.stops.map((s, i) => (
        <li key={s.poi.id} className={i === active ? "is-active" : ""} style={{ ["--i" as string]: i }}>
          {i > 0 && (
            <div className="arm" role="note" aria-label={`Walk ${s.walkMinFromPrev} minutes, ${s.walkKmFromPrev.toFixed(1)} kilometres`}>
              <span className="arm-name">{s.poi.nameEn ?? s.poi.name}</span>
              <span className="arm-min">{s.walkMinFromPrev} min</span>
              <span className="arm-km">{s.walkKmFromPrev.toFixed(1)} km</span>
            </div>
          )}
          <button type="button" className="stop" onClick={() => onSelect(i)} aria-current={i === active}>
            <span className="stop-time">
              <b>{fmtTime(s.startMin)}</b>
              <small>to {fmtTime(s.endMin)}</small>
            </span>
            <span className="stop-body">
              <span className="stop-name">{s.poi.name}</span>
              <span className="stop-meta">
                {s.meal ? (s.meal === "lunch" ? "Lunch" : "Dinner") + " · " : ""}
                {s.poi.kind.replace(/_/g, " ")}
                {s.poi.cuisine ? ` · ${s.poi.cuisine.split(";")[0].replace(/_/g, " ")}` : ""}
              </span>
              <HoursChip stop={s} />
              {s.poi.hours && s.hours !== "unknown" && <span className="osm-hours">OSM: {s.poi.hours}</span>}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

export function Rulebook({ report }: { report: Report }) {
  const rows = useMemo(
    () => [
      { ok: report.n >= 4, text: `At least 4 stops`, detail: `${report.n} stops` },
      { ok: report.grounded === report.n, text: "Every stop is a mapped place", detail: `${report.grounded} of ${report.n} found in OpenStreetMap` },
      {
        ok: report.closedAtVisit === 0,
        text: "Open when visited",
        detail: `${report.knownHours - report.closedAtVisit} confirmed, ${report.unknownHours} unverified, ${report.closedAtVisit} closed`,
      },
      { ok: report.badTransfers === 0, text: "Every transfer fits the walking time", detail: `${report.transfers.length - report.badTransfers} of ${report.transfers.length} transfers fit` },
      { ok: report.outsideDay === 0, text: "Inside 09:00 to 21:00", detail: report.outsideDay ? `${report.outsideDay} stop(s) outside` : "all inside" },
      { ok: report.duplicates === 0, text: "No venue twice", detail: report.duplicates ? `${report.duplicates} repeated` : "none repeated" },
    ],
    [report],
  );
  return (
    <section className="rulebook" aria-labelledby="rb-h">
      <h2 id="rb-h">Rulebook <span className={report.feasible ? "verdict ok" : "verdict bad"}>{report.feasible ? "Feasible day" : "Not feasible"}</span></h2>
      <ul>
        {rows.map((r) => (
          <li key={r.text} className={r.ok ? "pass" : "fail"}>
            <span className="rb-mark">{r.ok ? <Check /> : <Cross />}<span className="sr">{r.ok ? "Pass" : "Fail"}</span></span>
            <span className="rb-text">{r.text}</span>
            <span className="rb-detail">{r.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DaySummary({ plan, report }: { plan: DayPlan; report: Report }) {
  const last = plan.stops.at(-1);
  return (
    <div className="summary">
      <dl>
        <div><dt>Stops</dt><dd>{plan.stops.length}</dd></div>
        <div><dt>Walking</dt><dd>{plan.walkKm.toFixed(1)} km</dd></div>
        <div><dt>Hours checked</dt><dd>{report.knownHours}/{report.n}</dd></div>
        <div><dt>Ends</dt><dd>{last ? fmtTime(last.endMin) : "-"}</dd></div>
      </dl>
      <DayRuler stops={plan.stops} />
    </div>
  );
}
