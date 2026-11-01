/** Shape of public/evidence.json, written by eval/run.ts and read by the app. */
export interface EvStop {
  name: string;
  startMin: number;
  endMin: number;
  lat?: number;
  lon?: number;
  hours: "open" | "closed" | "unknown";
  grounded: boolean;
  /** exists per the geocoder but is not in the snapshot: hours unknown */
  external?: boolean;
  insideDay: boolean;
}
export interface EvTransfer {
  from: string;
  to: string;
  gapMin: number;
  needMin: number;
  ok: boolean;
}
export interface EvPlan {
  feasible: boolean;
  stops: EvStop[];
  transfers: EvTransfer[];
  parsed: boolean;
}
export interface Interval {
  rate: number;
  lo: number;
  hi: number;
}
export interface SystemSummary {
  runs: number;
  scenarios: number;
  feasibleDay: { k: number; n: number; rate: number; wilson95: [number, number]; clusterBootstrap95: [number, number] };
  scheduleFeasibleGivenGrounding: number;
  scheduleFeasibleGivenGroundingWilson95: [number, number];
  failureShare: Record<string, number>;
  stopLevel: {
    stops: number;
    groundedRate: number | null;
    inSnapshotRate: number | null;
    confirmedByGeocoderRate: number | null;
    notFoundRate: number | null;
    stopsWithKnownHours: number;
    closedAtVisitRate: number | null;
    unverifiedShare: number | null;
  };
  meanStops: number;
  profileMatch: number;
  detourRatio: number;
  detourRatioCI: [number, number];
  meanWalkKm: number;
}
export interface Diff {
  diff: number;
  ci: [number, number];
}
export interface Coverage {
  city: string;
  nonFood: Record<string, { pois: number; withHours: number; knownOnTestDays: number; holidayClausesDropped: number }>;
}
export interface ExtAgg {
  runs: number;
  feasible: number;
  rate: number;
  wilson95: [number, number];
  meanStops: number;
  unverifiedShare: number | null;
  closedStopsPerPlan: number;
  fewerThan4: number;
}
/** Cities added after pre-registration. No LLM baselines; never used to tune the planner. */
export interface Routed {
  plans: number;
  plansOk: number;
  transfers: number;
  transfersOk: number;
}
/** Cities added after pre-registration. No LLM baselines; never used to tune the planner. */
export interface Extension {
  days: number;
  /** independent OSRM re-timing of the planner's transfers (results/osrm-check-extension.json) */
  routed?: Routed & { perCity: Record<string, Routed> };
  systems: Record<string, ExtAgg>;
  cities: (ExtAgg & { slug: string; city: string })[];
}
export interface Evidence {
  reps: number;
  models: Record<string, string>;
  summary: Record<string, SystemSummary>;
  ablations: { hoursAwareness_closedStopsPerPlan: Diff; routing_detourRatio: Diff };
  hypotheses: Record<string, unknown>;
  coverage: Coverage[];
  extension?: Extension | null;
  scenarios: { id: string; slug: string; city: string; profile: string; day: "mon" | "sun" }[];
  showcase: Record<string, Record<string, EvPlan>>;
}
