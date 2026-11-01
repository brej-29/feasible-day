import type { City } from "./cities";

export type Cat = "culture" | "history" | "nature" | "landmark" | "food";
export type Profile = "culture" | "nature" | "food" | "mixed";
export type HoursStatus = "open" | "closed" | "unknown";

export interface Poi {
  id: string;
  name: string;
  nameEn?: string;
  alt?: string;
  lat: number;
  lon: number;
  cat: Cat;
  /** raw OSM value of tourism / historic / amenity / leisure */
  kind: string;
  /** raw OSM opening_hours tag */
  hours?: string;
  /** 1 when the feature has a Wikidata link: our notability proxy */
  wd: 0 | 1;
  fee?: string;
  site?: string;
  cuisine?: string;
}

export interface Snapshot {
  city: City;
  fetchedAt: string;
  radiusM: number;
  attribution: string;
  pois: Poi[];
}

/** Calendar date of the visit, wall-clock in the city. m is 1-12. */
export interface DayDate {
  y: number;
  m: number;
  d: number;
}

export interface Stop {
  poi: Poi;
  /** minutes since midnight */
  startMin: number;
  endMin: number;
  walkMinFromPrev: number;
  walkKmFromPrev: number;
  hours: HoursStatus;
  meal?: "lunch" | "dinner";
}

export interface DayPlan {
  date: DayDate;
  profile: Profile;
  stops: Stop[];
  walkKm: number;
  unverified: number;
}

export interface PlanOptions {
  startMin?: number;
  endMin?: number;
  maxStops?: number;
  /** POI ids already used on earlier days */
  exclude?: Set<string>;
  /** ablations, used only by the evaluation */
  ignoreHours?: boolean;
  noRouting?: boolean;
}
