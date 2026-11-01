import type { Cat, Poi, Profile } from "./types";

/** Minutes a typical visit takes. Fixed assumptions, listed in the README; not tuned on evaluation results. */
const DURATION: Record<string, number> = {
  museum: 90, gallery: 45, attraction: 40, viewpoint: 25, zoo: 120, castle: 60, monument: 20,
  memorial: 15, archaeological_site: 60, ruins: 30, fort: 45, city_gate: 15, place_of_worship: 25,
  park: 50, garden: 40, restaurant: 70, cafe: 35,
};
export const durationOf = (p: Poi) => DURATION[p.kind] ?? 40;

const BASE: Record<string, number> = {
  museum: 3, gallery: 0.8, attraction: 2.5, viewpoint: 2, zoo: 2.5, castle: 2.5, monument: 2,
  memorial: 1.2, archaeological_site: 2.2, ruins: 1.5, fort: 1.8, city_gate: 1.5,
  place_of_worship: 1.0, park: 1.8, garden: 1.8, restaurant: 1, cafe: 0.8,
};

/** Importance proxy. OSM has no ratings: Wikidata presence stands in for notability. Hand-set, not fitted. */
export function importance(p: Poi): number {
  const base = BASE[p.kind] ?? 1;
  const wd = p.cat === "food" ? 0 : p.wd * 1.5;
  return base + wd;
}

/** Category weights per profile; 0 excludes. Food is always allowed for meals. */
export const WEIGHTS: Record<Profile, Record<Cat, number>> = {
  culture: { culture: 1, history: 0.9, landmark: 0.7, nature: 0.15, food: 0.9 },
  nature: { nature: 1, landmark: 0.5, history: 0.25, culture: 0.2, food: 0.9 },
  food: { food: 3, landmark: 0.6, culture: 0.15, history: 0.15, nature: 0.2 },
  mixed: { culture: 0.8, history: 0.7, landmark: 0.8, nature: 0.7, food: 0.9 },
};

/** Categories that count as "on profile" for the profile-match metric (food counts everywhere: people eat). */
export const ALLOWED: Record<Profile, Set<Cat>> = {
  culture: new Set<Cat>(["culture", "history", "landmark", "food"]),
  nature: new Set<Cat>(["nature", "landmark", "food"]),
  food: new Set<Cat>(["food", "landmark"]),
  mixed: new Set<Cat>(["culture", "history", "landmark", "nature", "food"]),
};

export const MAX_FOOD: Record<Profile, number> = { culture: 2, nature: 2, food: 5, mixed: 3 };

export const LUNCH: [number, number] = [11 * 60 + 45, 14 * 60];
export const DINNER: [number, number] = [18 * 60 + 15, 19 * 60 + 45];

/** At most this many of a kind per day. */
export const KIND_CAP: Record<string, number> = {
  place_of_worship: 2, monument: 2, memorial: 1, city_gate: 1, gallery: 2, ruins: 1, fort: 1,
};
