import { useCallback, useEffect, useMemo, useState } from "react";
import { CITIES } from "../core/cities";
import type { Evidence } from "../core/evidence";
import { planTrip } from "../core/planner";
import type { Profile, Snapshot } from "../core/types";
import { addDays, CITY_SLUGS, labelDate, loadEvidence, loadSnapshot, parseDate, tomorrow } from "./data";
import { EvidenceView } from "./EvidenceView";
import { Diamond } from "./Icons";
import { MapView, type Pin } from "./MapView";
import { MethodView } from "./MethodView";
import { DaySummary, reportFor, Rulebook, Timeline } from "./PlanView";

type View = "plan" | "map" | "evidence" | "method";
const PROFILES: Profile[] = ["culture", "nature", "food", "mixed"];
const TABS: [View, string][] = [["plan", "Plan"], ["map", "Map"], ["evidence", "Evidence"], ["method", "Method"]];

function fromHash() {
  const [slug, profile, date, days] = location.hash.replace(/^#\/?/, "").split("/");
  return {
    slug: CITY_SLUGS.includes(slug) ? slug : "paris",
    profile: (PROFILES.includes(profile as Profile) ? profile : "culture") as Profile,
    date: /^\d{4}-\d{2}-\d{2}$/.test(date ?? "") ? date : tomorrow(),
    days: Math.min(3, Math.max(1, Number(days) || 1)),
  };
}

export function App() {
  const init = useMemo(fromHash, []);
  const [slug, setSlug] = useState(init.slug);
  const [profile, setProfile] = useState<Profile>(init.profile);
  const [date, setDate] = useState(init.date);
  const [days, setDays] = useState(init.days);
  const [view, setView] = useState<View>("plan");
  const [dayIx, setDayIx] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ev, setEv] = useState<Evidence | null>(null);
  const [evErr, setEvErr] = useState<string | null>(null);

  useEffect(() => {
    const onHash = () => {
      const h = fromHash();
      setSlug(h.slug); setProfile(h.profile); setDate(h.date); setDays(h.days);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    history.replaceState(null, "", `#/${slug}/${profile}/${date}/${days}`);
  }, [slug, profile, date, days]);

  useEffect(() => {
    let live = true;
    setSnap(null);
    setErr(null);
    loadSnapshot(slug).then((s) => live && setSnap(s)).catch((e: Error) => live && setErr(e.message));
    return () => { live = false; };
  }, [slug]);

  useEffect(() => {
    if (view === "evidence" && !ev && !evErr) loadEvidence().then(setEv).catch((e: Error) => setEvErr(e.message));
  }, [view, ev, evErr]);

  const dates = useMemo(() => Array.from({ length: days }, (_, i) => addDays(date, i)), [date, days]);
  const plans = useMemo(() => (snap ? planTrip(snap, profile, dates.map(parseDate)) : []), [snap, profile, dates]);
  const plan = plans[Math.min(dayIx, plans.length - 1)];
  const report = useMemo(() => (snap && plan ? reportFor(snap, plan) : null), [snap, plan]);

  useEffect(() => { setActive(null); }, [slug, profile, date, dayIx]);
  useEffect(() => { if (dayIx >= days) setDayIx(0); }, [days, dayIx]);

  const pins: Pin[] = useMemo(
    () => (plan?.stops ?? []).map((s) => ({ lat: s.poi.lat, lon: s.poi.lon, label: s.poi.name, state: s.hours })),
    [plan],
  );
  const select = useCallback((i: number) => setActive(i), []);
  const city = CITIES.find((c) => c.slug === slug);
  const sparse = snap && plan && plan.stops.length < 4;

  return (
    <div className="app" data-view={view}>
      <header className="top">
        <a className="brand" href="#/" onClick={() => setView("plan")}>
          <Diamond size={26} />
          <span>Feasible Day</span>
        </a>
        <nav aria-label="Sections" className="tabs" role="tablist">
          {TABS.map(([v, l]) => (
            <button key={v} role="tab" aria-selected={view === v} data-tab={v} onClick={() => setView(v)} type="button">{l}</button>
          ))}
        </nav>
      </header>

      <section className="controls" aria-label="Plan settings">
        <label>City
          <select value={slug} onChange={(e) => setSlug(e.target.value)}>
            {CITIES.filter((c) => CITY_SLUGS.includes(c.slug)).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </label>
        <fieldset>
          <legend>Interests</legend>
          <div className="seg" role="radiogroup">
            {PROFILES.map((p) => (
              <label key={p} className={p === profile ? "on" : ""}>
                <input type="radio" name="profile" checked={p === profile} onChange={() => setProfile(p)} />{p}
              </label>
            ))}
          </div>
        </fieldset>
        <label>Date
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <fieldset>
          <legend>Days</legend>
          <div className="seg" role="radiogroup">
            {[1, 2, 3].map((n) => (
              <label key={n} className={n === days ? "on" : ""}>
                <input type="radio" name="days" checked={n === days} onChange={() => setDays(n)} />{n}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <main className="stage">
        {(view === "plan" || view === "map") && (
          <>
            <div className="pane plan-pane">
              {days > 1 && (
                <div className="daytabs" role="tablist" aria-label="Day">
                  {dates.map((d, i) => (
                    <button key={d} role="tab" aria-selected={i === dayIx} onClick={() => setDayIx(i)} type="button">
                      <b>Day {i + 1}</b> {labelDate(d)}
                    </button>
                  ))}
                </div>
              )}
              {err && <p className="state state-err" role="alert">Could not load the {city?.name} map data: {err}. Check your connection and reload.</p>}
              {!snap && !err && (
                <div className="skeleton" aria-busy="true" aria-label="Loading city data">
                  {Array.from({ length: 5 }, (_, i) => <span key={i} style={{ ["--i" as string]: i }} />)}
                </div>
              )}
              {snap && plan && report && (
                <>
                  <h1 className="h-day">
                    {city?.name}, {labelDate(dates[Math.min(dayIx, dates.length - 1)])}
                  </h1>
                  {sparse ? (
                    <p className="state">
                      Only {plan.stops.length} place{plan.stops.length === 1 ? "" : "s"} could be scheduled here that day. The map data for {city?.name} is thin or most venues are closed.
                      Try another date or interest.
                    </p>
                  ) : (
                    <>
                      <DaySummary plan={plan} report={report} />
                      <Timeline plan={plan} active={active} onSelect={(i) => { select(i); }} />
                    </>
                  )}
                  <Rulebook report={report} />
                </>
              )}
            </div>
            <div className="pane map-pane">
              <MapView pins={pins} active={active} onSelect={select} label={`Map of the ${city?.name} walking route`} />
            </div>
          </>
        )}
        {view === "evidence" && (
          <div className="pane wide">
            {evErr && <p className="state state-err" role="alert">Could not load the evaluation results: {evErr}</p>}
            {!ev && !evErr && <p className="state" aria-busy="true">Loading results…</p>}
            {ev && <EvidenceView ev={ev} />}
          </div>
        )}
        {view === "method" && <div className="pane wide"><MethodView /></div>}
      </main>

      <footer className="foot">
        Map data © OpenStreetMap contributors (ODbL), tiles © OpenFreeMap. Hours come from OSM tags and may be wrong or missing.
      </footer>
    </div>
  );
}
