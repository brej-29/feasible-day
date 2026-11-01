import { DINNER, KIND_CAP, LUNCH, MAX_FOOD, WEIGHTS, durationOf, importance } from "./catalog";
import { normalize } from "./names";
import { haversineKm, walkKm, walkMin } from "./geo";
import { earliestStart, dayHours, statusFor, type DayHours } from "./hours";
import type { DayDate, DayPlan, PlanOptions, Poi, Profile, Snapshot, Stop } from "./types";

interface Cand {
  poi: Poi;
  dur: number;
  score: number;
  hours: DayHours;
  window?: [number, number];
  meal?: "lunch" | "dinner";
}

const MAX_WAIT = 30;
const RADIUS_KM = 2.2;
const UNKNOWN_HOURS_FACTOR = 0.85;

/** Walk the route in order; null if any stop cannot be scheduled inside its hours and the day. */
function simulate(route: Cand[], startMin: number, endMin: number, date: DayDate, slug: string): Stop[] | null {
  const stops: Stop[] = [];
  let t = startMin;
  let prev: Poi | null = null;
  for (const c of route) {
    const wm = prev ? walkMin(prev, c.poi) : 0;
    const arrive = t + wm;
    const from = c.window ? Math.max(arrive, c.window[0]) : arrive;
    const latest = c.window ? c.window[1] : arrive + MAX_WAIT;
    const s = earliestStart(c.hours, from, c.dur, latest);
    if (s === null || s + c.dur > endMin) return null;
    stops.push({
      poi: c.poi,
      startMin: Math.round(s),
      endMin: Math.round(s + c.dur),
      walkMinFromPrev: Math.round(wm),
      walkKmFromPrev: prev ? walkKm(prev, c.poi) : 0,
      hours: statusFor(dayHours(c.poi, date, slug), s, s + c.dur),
      meal: c.meal,
    });
    t = s + c.dur;
    prev = c.poi;
  }
  return stops;
}

/** Same-name twins (a bridge mapped in pieces) and per-kind caps keep a day from being ten churches. */
function blocked(route: Cand[], c: Cand): boolean {
  const n = normalize(c.poi.name);
  if (route.some((r) => normalize(r.poi.name) === n)) return true;
  const cap = KIND_CAP[c.poi.kind];
  return cap !== undefined && route.filter((r) => r.poi.kind === c.poi.kind).length >= cap;
}

const routeWalkMin = (r: Cand[]) => r.reduce((s, c, i) => (i ? s + walkMin(r[i - 1].poi, c.poi) : 0), 0);

function pickMeal(pool: Cand[], anchor: Poi, window: [number, number], meal: "lunch" | "dinner", taken: Set<string>): Cand | null {
  let best: Cand | null = null;
  let bestV = -Infinity;
  for (const c of pool) {
    if (c.poi.cat !== "food" || taken.has(c.poi.id)) continue;
    if (earliestStart(c.hours, window[0], c.dur, window[1]) === null) continue;
    const v = c.score * (c.poi.kind === "restaurant" ? 1 : 0.6) - haversineKm(anchor, c.poi) * 0.4;
    if (v > bestV) {
      bestV = v;
      best = { ...c, window, meal };
    }
  }
  return best;
}

export function planDay(snap: Snapshot, profile: Profile, date: DayDate, opts: PlanOptions = {}): DayPlan {
  const startMin = opts.startMin ?? 9 * 60;
  const endMin = opts.endMin ?? 21 * 60;
  const maxStops = opts.maxStops ?? 8;
  const slug = snap.city.slug;
  const w = WEIGHTS[profile];

  const cands: Cand[] = [];
  for (const poi of snap.pois) {
    if (opts.exclude?.has(poi.id) || w[poi.cat] <= 0) continue;
    const real = dayHours(poi, date, slug);
    const hours: DayHours = opts.ignoreHours ? { status: "unknown", spans: [] } : real;
    const dur = durationOf(poi);
    // drop venues known to be shut for the whole usable day
    if (hours.status === "known" && earliestStart(hours, startMin, dur, endMin - dur) === null) continue;
    cands.push({ poi, dur, hours, score: importance(poi) * w[poi.cat] * (hours.status === "known" ? 1 : UNKNOWN_HOURS_FACTOR) });
  }
  if (!cands.length) return { date, profile, stops: [], walkKm: 0, unverified: 0 };

  // Anchor the day on the densest cluster of important places so the route stays walkable.
  const ranked = [...cands].sort((a, b) => b.score - a.score);
  const seeds = ranked.filter((c) => profile === "food" || c.poi.cat !== "food").slice(0, 40);
  let anchor = seeds[0].poi;
  let bestD = -1;
  for (const s of seeds) {
    let d = 0;
    for (const c of cands) d += c.score * Math.exp(-haversineKm(s.poi, c.poi) / 1.2);
    if (d > bestD) {
      bestD = d;
      anchor = s.poi;
    }
  }
  const pool = ranked.filter((c) => haversineKm(anchor, c.poi) <= RADIUS_KM);

  const taken = new Set<string>();
  const lunch = pickMeal(pool, anchor, LUNCH, "lunch", taken);
  if (lunch) taken.add(lunch.poi.id);
  const dinner = profile === "food" ? pickMeal(pool, anchor, DINNER, "dinner", taken) : null;
  if (dinner) taken.add(dinner.poi.id);
  const fixed = [lunch, dinner].filter((x): x is Cand => !!x);

  let route: Cand[] = fixed;
  if (opts.noRouting) {
    route = buildInScoreOrder(pool, fixed, startMin, endMin, date, slug, maxStops, profile);
  } else {
    for (;;) {
      if (route.length >= maxStops) break;
      const foodCount = route.filter((r) => r.poi.cat === "food").length;
      let best: { trial: Cand[]; gain: number } | null = null;
      let tried = 0;
      for (const c of pool) {
        if (route.includes(c) || taken.has(c.poi.id)) continue;
        if (c.poi.cat === "food" && foodCount >= MAX_FOOD[profile]) continue;
        if (blocked(route, c)) continue;
        if (++tried > 70) break;
        const base = routeWalkMin(route);
        for (let pos = 0; pos <= route.length; pos++) {
          const trial = [...route.slice(0, pos), c, ...route.slice(pos)];
          if (!simulate(trial, startMin, endMin, date, slug)) continue;
          const extra = routeWalkMin(trial) - base;
          const gain = c.score / (extra + c.dur * 0.25 + 8);
          if (!best || gain > best.gain) best = { trial, gain };
        }
      }
      if (!best) break;
      route = best.trial;
    }
  }

  const stops = simulate(route, startMin, endMin, date, slug) ?? [];
  return {
    date,
    profile,
    stops,
    walkKm: stops.reduce((s, x) => s + x.walkKmFromPrev, 0),
    unverified: stops.filter((s) => s.hours === "unknown").length,
  };
}

/** Ablation: pick by score alone and visit in the order picked; lunch goes in when the clock gets there. */
function buildInScoreOrder(
  pool: Cand[], fixed: Cand[], startMin: number, endMin: number, date: DayDate, slug: string, maxStops: number, profile: Profile,
): Cand[] {
  const lunch = fixed.find((f) => f.meal === "lunch");
  const dinner = fixed.find((f) => f.meal === "dinner");
  const chosen: Cand[] = [];
  const endOf = (r: Cand[]) => simulate(r, startMin, endMin, date, slug)?.at(-1)?.endMin ?? 0;
  const tryPush = (c: Cand) => {
    const trial = [...chosen, c];
    if (simulate(trial, startMin, endMin, date, slug)) chosen.push(c);
  };
  let foods = 0;
  for (const c of pool) {
    if (chosen.length >= maxStops) break;
    if (lunch && !chosen.includes(lunch) && endOf(chosen) >= LUNCH[0] - 40) tryPush(lunch);
    if (dinner && !chosen.includes(dinner) && endOf(chosen) >= DINNER[0] - 60) tryPush(dinner);
    if (c === lunch || c === dinner || (c.poi.cat === "food" && foods >= MAX_FOOD[profile]) || blocked(chosen, c)) continue;
    const before = chosen.length;
    tryPush(c);
    if (chosen.length > before && c.poi.cat === "food") foods++;
  }
  if (lunch && !chosen.includes(lunch)) tryPush(lunch);
  return chosen;
}

/** Plan several consecutive days without reusing a venue. */
export function planTrip(snap: Snapshot, profile: Profile, dates: DayDate[], opts: PlanOptions = {}): DayPlan[] {
  const used = new Set(opts.exclude ?? []);
  return dates.map((date) => {
    const plan = planDay(snap, profile, date, { ...opts, exclude: used });
    plan.stops.forEach((s) => used.add(s.poi.id));
    return plan;
  });
}
