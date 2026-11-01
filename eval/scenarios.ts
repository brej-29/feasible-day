import { readFileSync } from "node:fs";
import { CITIES } from "../src/core/cities";
import type { DayDate, Profile, Snapshot } from "../src/core/types";

export const PROFILES: Profile[] = ["culture", "nature", "food", "mixed"];
export const DAYS: { key: "mon" | "sun"; date: DayDate; label: string }[] = [
  { key: "mon", date: { y: 2026, m: 11, d: 16 }, label: "Monday 2026-11-16" },
  { key: "sun", date: { y: 2026, m: 11, d: 22 }, label: "Sunday 2026-11-22" },
];

export interface Scenario {
  id: string;
  slug: string;
  city: string;
  profile: Profile;
  day: (typeof DAYS)[number];
}

export const scenarios = (): Scenario[] =>
  CITIES.flatMap((c) =>
    PROFILES.flatMap((profile) =>
      DAYS.map((day) => ({ id: `${c.slug}-${profile}-${day.key}`, slug: c.slug, city: c.name, profile, day })),
    ),
  );

const cache = new Map<string, Snapshot>();
export function loadSnapshot(slug: string): Snapshot {
  if (!cache.has(slug)) cache.set(slug, JSON.parse(readFileSync(`data/snapshots/${slug}.json`, "utf8")));
  return cache.get(slug)!;
}

export const PROFILE_TEXT: Record<Profile, string> = {
  culture: "museums, history and architecture",
  nature: "parks, gardens and viewpoints",
  food: "local food and cafes, with a few sights in between",
  mixed: "a mix of culture, nature and food",
};
