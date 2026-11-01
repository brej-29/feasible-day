import { WEIGHTS, importance } from "../src/core/catalog";
import type { ExtStop } from "../src/core/verify";
import type { Profile, Snapshot } from "../src/core/types";

/**
 * Re-implementation of the original app's behaviour: places in popularity order across the whole
 * city, a fixed two-hour slot each, no routing, no opening hours, no travel time.
 * One restaurant is dropped into the third slot, as the old guide did for lunch.
 */
export function legacyPlan(snap: Snapshot, profile: Profile): ExtStop[] {
  const w = WEIGHTS[profile];
  const ranked = snap.pois
    .filter((p) => p.cat !== "food" && w[p.cat] >= 0.5)
    .sort((a, b) => importance(b) * w[b.cat] - importance(a) * w[a.cat] || a.id.localeCompare(b.id));
  const food = snap.pois.filter((p) => p.cat === "food").sort((a, b) => a.id.localeCompare(b.id))[0];
  const picks = ranked.slice(0, 5);
  if (food) picks.splice(2, 0, food);
  return picks.slice(0, 6).map((p, i) => ({
    name: p.name, id: p.id, startMin: 9 * 60 + i * 120, endMin: 9 * 60 + (i + 1) * 120,
  }));
}
