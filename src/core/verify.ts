import { ALLOWED } from "./catalog";
import { dayHours, statusFor } from "./hours";
import { pathKm, shortestPathKm, walkMin } from "./geo";
import { matchPoi } from "./names";
import type { DayDate, HoursStatus, Poi, Profile, Snapshot } from "./types";

/** A plan from any source (LLM, legacy, planner) reduced to what the rulebook needs. */
export interface ExtStop {
  name: string;
  startMin: number;
  endMin: number;
  /** when the source already knows the OSM feature (our planner), else matched by name */
  id?: string;
  /** coordinates from an external geocoder for names not found in the snapshot (hours stay unknown) */
  lat?: number;
  lon?: number;
}

export interface StopReport {
  name: string;
  poi: Poi | null;
  /** grounded by the geocoder, not the snapshot: place exists but hours and category are unknown */
  external: boolean;
  hours: HoursStatus;
  insideDay: boolean;
}

export interface Transfer {
  from: string;
  to: string;
  gapMin: number;
  needMin: number;
  ok: boolean;
}

export interface Report {
  n: number;
  stops: StopReport[];
  transfers: Transfer[];
  grounded: number;
  groundedExternal: number;
  closedAtVisit: number;
  knownHours: number;
  unknownHours: number;
  badTransfers: number;
  outsideDay: number;
  duplicates: number;
  feasible: boolean;
  /** rules 3-6 on grounded stops only */
  scheduleFeasible: boolean;
  detourRatio: number | null;
  walkKm: number;
  profileMatch: number;
}

export const SLACK_MIN = 5;
export const MIN_STOPS = 4;

export function verifyDay(
  snap: Snapshot, date: DayDate, profile: Profile, stops: ExtStop[],
  opts: { dayStart?: number; dayEnd?: number } = {},
): Report {
  const dayStart = opts.dayStart ?? 9 * 60;
  const dayEnd = opts.dayEnd ?? 21 * 60;
  const byId = new Map(snap.pois.map((p) => [p.id, p]));
  const reps: StopReport[] = stops.map((s) => {
    const inSnap = (s.id && byId.get(s.id)) || matchPoi(s.name, snap.pois)?.poi || null;
    const external = !inSnap && s.lat !== undefined && s.lon !== undefined;
    const poi: Poi | null = inSnap ?? (external ? { id: `ext:${s.name}`, name: s.name, lat: s.lat!, lon: s.lon!, cat: "landmark", kind: "poi", wd: 0 } : null);
    const hours: HoursStatus = poi ? statusFor(dayHours(poi, date, snap.city.slug), s.startMin, s.endMin) : "unknown";
    return { name: s.name, poi, external, hours, insideDay: s.startMin >= dayStart && s.endMin <= dayEnd && s.endMin > s.startMin };
  });

  const g = stops.map((s, i) => ({ s, r: reps[i] })).filter((x) => x.r.poi);
  const transfers: Transfer[] = [];
  for (let i = 1; i < g.length; i++) {
    const need = walkMin(g[i - 1].r.poi!, g[i].r.poi!);
    const gap = g[i].s.startMin - g[i - 1].s.endMin;
    transfers.push({ from: g[i - 1].r.name, to: g[i].r.name, gapMin: gap, needMin: need, ok: gap + SLACK_MIN >= need });
  }

  const ids = g.map((x) => x.r.poi!.id);
  const duplicates = ids.length - new Set(ids).size;
  const grounded = g.length;
  const closed = reps.filter((r) => r.poi && r.hours === "closed").length;
  const known = reps.filter((r) => r.poi && r.hours !== "unknown").length;
  const outsideDay = reps.filter((r) => !r.insideDay).length;
  const badTransfers = transfers.filter((t) => !t.ok).length;

  const pts = g.map((x) => x.r.poi!);
  const walked = pathKm(pts);
  const shortest = pts.length >= 3 ? shortestPathKm(pts) : null;
  const allowed = ALLOWED[profile];
  // external stops have no category: they are left out of the profile-match ratio, not counted against the source
  const classified = reps.filter((r) => r.poi && !r.external);
  const onProfile = classified.filter((r) => allowed.has(r.poi!.cat)).length;

  const scheduleFeasible = closed === 0 && badTransfers === 0 && outsideDay === 0 && duplicates === 0;
  return {
    n: stops.length,
    stops: reps,
    transfers,
    grounded,
    groundedExternal: reps.filter((r) => r.external).length,
    closedAtVisit: closed,
    knownHours: known,
    unknownHours: grounded - known,
    badTransfers,
    outsideDay,
    duplicates,
    scheduleFeasible: scheduleFeasible && grounded >= 1,
    feasible: stops.length >= MIN_STOPS && grounded === stops.length && scheduleFeasible,
    detourRatio: shortest && shortest > 0 ? walked / shortest : null,
    walkKm: walked,
    profileMatch: classified.length ? onProfile / classified.length : 0,
  };
}
