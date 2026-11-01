import opening_hours from "opening_hours";
import { CITIES } from "./cities";
import type { DayDate, HoursStatus, Poi } from "./types";

/** [startMin, endMin) open spans in minutes since midnight of the visit day (may exceed 1440). */
export type Span = [number, number];
export interface DayHours {
  status: "known" | "unknown";
  spans: Span[];
}

const UNKNOWN: DayHours = { status: "unknown", spans: [] };
const parsed = new Map<string, opening_hours | null>();
const perDay = new Map<string, DayHours>();

function parse(poi: Poi, cc: string | undefined): opening_hours | null {
  const key = `${cc}|${poi.lat.toFixed(4)},${poi.lon.toFixed(4)}|${poi.hours}`;
  if (parsed.has(key)) return parsed.get(key)!;
  let oh: opening_hours | null = null;
  try {
    oh = new opening_hours(poi.hours!, { lat: poi.lat, lon: poi.lon, address: { country_code: cc ?? "", state: "" } });
  } catch {
    oh = null;
  }
  parsed.set(key, oh);
  return oh;
}

/**
 * Open spans for one POI on one day. "unknown" when there is no tag, it does not parse,
 * or the rule contains a clause opening_hours.js cannot decide (comments such as "by appointment").
 * Dates are wall-clock in the city: built from local components, never converted across zones.
 */
export function dayHours(poi: Poi, date: DayDate, citySlug: string): DayHours {
  if (!poi.hours) return UNKNOWN;
  const k = `${poi.id}|${poi.hours}|${date.y}-${date.m}-${date.d}`;
  const hit = perDay.get(k);
  if (hit) return hit;
  const cc = CITIES.find((c) => c.slug === citySlug)?.cc;
  const oh = parse(poi, cc);
  let out: DayHours = UNKNOWN;
  if (oh) {
    const from = new Date(date.y, date.m - 1, date.d, 0, 0, 0);
    const to = new Date(date.y, date.m - 1, date.d + 2, 0, 0, 0);
    const spans: Span[] = [];
    let unknown = false;
    for (const [a, b, isUnknown] of oh.getOpenIntervals(from, to)) {
      if (isUnknown) unknown = true;
      // 2 days requested, keep what starts before the end of the visit day
      const s = (a.getTime() - from.getTime()) / 60000;
      const e = (b.getTime() - from.getTime()) / 60000;
      if (s < 1440) spans.push([s, e]);
    }
    out = unknown ? UNKNOWN : { status: "known", spans: mergeSpans(spans) };
  }
  perDay.set(k, out);
  return out;
}

function mergeSpans(spans: Span[]): Span[] {
  const s = [...spans].sort((a, b) => a[0] - b[0]);
  const out: Span[] = [];
  for (const x of s) {
    const last = out[out.length - 1];
    if (last && x[0] <= last[1]) last[1] = Math.max(last[1], x[1]);
    else out.push([x[0], x[1]]);
  }
  return out;
}

/** Is the whole [start, end] window inside one open span? */
export function statusFor(h: DayHours, startMin: number, endMin: number): HoursStatus {
  if (h.status === "unknown") return "unknown";
  return h.spans.some(([a, b]) => a <= startMin && endMin <= b) ? "open" : "closed";
}

/**
 * Earliest start >= from such that [start, start+dur] is inside an open span and start <= latestStart.
 * Unknown hours accept any start (flagged unverified by the caller).
 */
export function earliestStart(h: DayHours, from: number, dur: number, latestStart: number): number | null {
  if (h.status === "unknown") return from <= latestStart ? from : null;
  for (const [a, b] of h.spans) {
    const s = Math.max(from, a);
    if (s + dur <= b && s <= latestStart) return s;
  }
  return null;
}
