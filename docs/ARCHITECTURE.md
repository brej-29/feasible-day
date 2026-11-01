# Architecture

```
OpenStreetMap ──Overpass──▶ eval/build-snapshots.ts ──▶ data/snapshots/<city>.json   (committed, ODbL)
                                                              │
              ┌───────────────────────────────────────────────┼───────────────────────────────┐
              ▼                                               ▼                               ▼
   src/core (pure TypeScript, no DOM)                  eval/run.ts                      src/app (React)
   geo · hours · names · catalog                        scenarios x systems              plans in the browser,
   planner.ts  (builds a day)                           verify.ts for every plan         same core, no server
   verify.ts   (the rulebook)                           ──▶ results/*.json
                                                        ──▶ public/evidence.json ──▶ Evidence tab
```

## One rulebook, three consumers

`src/core/verify.ts` is the only place feasibility is defined. The planner's output, the stored LLM plans and the legacy baseline all pass through it.
The UI shows the same report in the Rulebook panel. The rules are fixed in `docs/PREREGISTRATION.md`.

## Planner (`src/core/planner.ts`)

1. Candidate places for the profile, minus venues known to be shut all day (opening_hours.js, evaluated for the chosen date as wall-clock time in the city).
2. Anchor: the highest-density cluster of important places; pool = places within 2.2 km of the anchor.
3. Meals: lunch fixed in a window (plus dinner for the food profile), so the rest of the day is built around them.
4. Insertion: for every candidate and every position, simulate the whole day (walking, waiting for opening up to 30 min, visit length, 21:00 limit). Keep the insertion with the best importance per extra walking minute. Stop when nothing fits or 8 stops.
5. Unknown opening hours are allowed but down-weighted, and always shown as unverified.

Why not an LLM here: the failure being fixed is exactly what a model cannot check from memory. A scheduler that simulates the day can.

## Evaluation (`eval/`)

| File | Role |
| --- | --- |
| `scenarios.ts` | 12 cities x 4 profiles x 2 days = 96 scenarios |
| `llm.ts` | LLM baseline client. Model ids come from env (`LLM_70B`, `LLM_8B`) because free catalogs change. Outputs are cached in `data/llm/`, so the numbers reproduce without a token |
| `legacy.ts` | the original app's logic, re-implemented as a baseline |
| `stats.ts` | Wilson intervals, scenario-cluster bootstrap, paired differences, seeded |
| `run.ts` | runs everything, writes `results/` and `public/evidence.json` |

## Config and free-tier behaviour

- No keys in the shipped app. It is a static site: city data is bundled, the basemap is OpenFreeMap (no key), nothing calls an LLM.
- Map style is `VITE_MAP_STYLE`, so a basemap swap is a config change.
- If the basemap is unreachable the plan, timeline and rulebook still work; only the map pane is blank.
