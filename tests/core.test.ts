import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CITIES } from "../src/core/cities";
import { haversineKm, shortestPathKm, pathKm } from "../src/core/geo";
import { dayHours, earliestStart, statusFor } from "../src/core/hours";
import { jaroWinkler, matchPoi, normalize } from "../src/core/names";
import { planDay } from "../src/core/planner";
import type { Poi, Snapshot } from "../src/core/types";
import { verifyDay } from "../src/core/verify";

const MON = { y: 2026, m: 11, d: 16 };
const SUN = { y: 2026, m: 11, d: 22 };

const poi = (id: string, name: string, lat: number, lon: number, o: Partial<Poi> = {}): Poi => ({
  id, name, lat, lon, cat: "culture", kind: "museum", wd: 1, ...o,
});

const tiny = (pois: Poi[]): Snapshot => ({
  city: CITIES[0], fetchedAt: "", radiusM: 0, attribution: "", pois,
});

describe("geo", () => {
  it("measures Paris to London", () => {
    expect(haversineKm({ lat: 48.8566, lon: 2.3522 }, { lat: 51.5074, lon: -0.1278 })).toBeCloseTo(343.6, 0);
  });
  it("finds the shortest path exactly for small sets", () => {
    const pts = [0, 3, 1, 2].map((x) => ({ lat: 48.85, lon: 2.3 + x * 0.01 }));
    expect(shortestPathKm(pts)).toBeLessThan(pathKm(pts));
  });
});

describe("names", () => {
  it("normalises accents and punctuation", () => {
    expect(normalize("Musée d'Orsay")).toBe("musee d orsay");
  });
  it("matches close spellings and rejects invented venues", () => {
    const pois = [poi("a", "Musée d'Orsay", 0, 0), poi("b", "Louvre", 0, 0, { nameEn: "Louvre Museum" })];
    expect(matchPoi("Musee dOrsay", pois)?.poi.id).toBe("a");
    expect(matchPoi("Louvre Museum", pois)?.poi.id).toBe("b");
    expect(matchPoi("Le Jardin Secret des Anges", pois)).toBeNull();
    expect(jaroWinkler("abc", "xyz")).toBe(0);
  });
});

describe("hours", () => {
  const p = poi("h", "X", 48.86, 2.33, { hours: "Tu-Su 10:00-18:00" });
  it("is closed on Monday, open on Sunday", () => {
    const mon = dayHours(p, MON, "paris");
    const sun = dayHours(p, SUN, "paris");
    expect(statusFor(mon, 11 * 60, 12 * 60)).toBe("closed");
    expect(statusFor(sun, 11 * 60, 12 * 60)).toBe("open");
    expect(statusFor(sun, 17 * 60 + 30, 18 * 60 + 30)).toBe("closed");
  });
  it("treats missing or unparseable hours as unknown, never open", () => {
    expect(dayHours(poi("n", "N", 0, 0), MON, "paris").status).toBe("unknown");
    expect(dayHours(poi("b", "B", 0, 0, { hours: "whenever the owner feels like it" }), MON, "paris").status).toBe("unknown");
  });
  it("waits for opening but not past the latest start", () => {
    const sun = dayHours(p, SUN, "paris");
    expect(earliestStart(sun, 9 * 60, 60, 12 * 60)).toBe(10 * 60);
    expect(earliestStart(sun, 9 * 60, 60, 9 * 60 + 30)).toBeNull();
  });
});

describe("verifier", () => {
  const snap = tiny([
    poi("1", "Alpha Museum", 48.860, 2.330, { hours: "Tu-Su 10:00-18:00" }),
    poi("2", "Beta Gallery", 48.861, 2.331, { hours: "Mo-Su 09:00-20:00" }),
    poi("3", "Gamma Palace", 48.862, 2.332, { cat: "history", kind: "castle" }),
    poi("4", "Delta Park", 48.863, 2.333, { cat: "nature", kind: "park" }),
  ]);
  const ok = [
    { name: "Beta Gallery", startMin: 600, endMin: 660 },
    { name: "Gamma Palace", startMin: 680, endMin: 740 },
    { name: "Delta Park", startMin: 760, endMin: 800 },
    { name: "Alpha Museum", startMin: 830, endMin: 900 },
  ];
  it("accepts a feasible Sunday", () => {
    const r = verifyDay(snap, SUN, "mixed", ok);
    expect(r.feasible).toBe(true);
    expect(r.unknownHours).toBe(2);
  });
  it("flags a venue closed on Monday", () => {
    const r = verifyDay(snap, MON, "mixed", ok);
    expect(r.closedAtVisit).toBe(1);
    expect(r.feasible).toBe(false);
  });
  it("flags an invented venue and teleporting", () => {
    const bad = [{ name: "Epsilon Hidden Garden", startMin: 540, endMin: 600 }, ...ok.slice(0, 3)];
    expect(verifyDay(snap, SUN, "mixed", bad).grounded).toBe(3);
    expect(verifyDay(snap, SUN, "mixed", bad).feasible).toBe(false);
    const tight = ok.map((s, i) => ({ ...s, startMin: 600 + i * 61, endMin: 660 + i * 61 }));
    expect(verifyDay(snap, SUN, "mixed", tight).badTransfers).toBeGreaterThanOrEqual(0);
  });
  it("catches a transfer that does not fit", () => {
    const far = tiny([poi("a", "Near One", 48.85, 2.30), poi("b", "Far Two", 48.95, 2.45)]);
    const r = verifyDay(far, SUN, "culture", [
      { name: "Near One", startMin: 600, endMin: 660 },
      { name: "Far Two", startMin: 665, endMin: 700 },
    ]);
    expect(r.badTransfers).toBe(1);
  });
});

describe("planner on a real snapshot", () => {
  const snap = JSON.parse(readFileSync("data/snapshots/paris.json", "utf8")) as Snapshot;
  for (const [label, date] of [["Monday", MON], ["Sunday", SUN]] as const) {
    it(`plans a feasible ${label} for each profile`, () => {
      for (const profile of ["culture", "nature", "food", "mixed"] as const) {
        const plan = planDay(snap, profile, date);
        expect(plan.stops.length).toBeGreaterThanOrEqual(4);
        const r = verifyDay(snap, date, profile, plan.stops.map((s) => ({
          name: s.poi.name, id: s.poi.id, startMin: s.startMin, endMin: s.endMin,
        })));
        expect(r.feasible, `${profile} ${label}: ${JSON.stringify(r.transfers.filter((t) => !t.ok))}`).toBe(true);
        expect(r.detourRatio ?? 1).toBeLessThan(1.6);
      }
    });
  }
  it("does not repeat a venue across days", () => {
    const a = planDay(snap, "culture", MON);
    const b = planDay(snap, "culture", SUN, { exclude: new Set(a.stops.map((s) => s.poi.id)) });
    const both = [...a.stops, ...b.stops].map((s) => s.poi.id);
    expect(new Set(both).size).toBe(both.length);
  });
});

describe("llm output parsing", () => {
  it("strips fences, filler and transit lines", async () => {
    const { parseStops } = await import("../eval/llm");
    const out = parseStops('```json\n{"stops":[{"name":"Lunch at Chez Paul","start":"12:00","end":"13:00"},{"name":"Walking to Louvre","start":"13:00","end":"13:15"},{"name":"Louvre","start":"13:15","end":"15:00"}]}\n```');
    expect(out?.map((s) => s.name)).toEqual(["Chez Paul", "Louvre"]);
    expect(parseStops("sorry, I cannot")).toBeNull();
  });
});
