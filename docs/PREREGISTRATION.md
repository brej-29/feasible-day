# Pre-registration: metrics and thresholds (fixed before the planner was written)

Status: committed before any planner or baseline code. Snapshot data had been fetched for one city
(Paris) to check the pipeline; no outcome of any system had been seen.
Any later change to this file is listed under "Amendments" at the bottom, with the reason.

## Scenarios

`12 cities x 4 interest profiles x 2 visit days = 96 scenarios`, each a single day, 09:00 start, walking only.

- Cities: Paris, London, Rome, Barcelona, Berlin, Amsterdam, Lisbon, Vienna, Prague, New York, Tokyo, Mumbai (Mumbai is a deliberate low-data stress case).
- Profiles: `culture`, `nature`, `food`, `mixed`.
- Days: Monday 2026-11-16 and Sunday 2026-11-22 (typical museum closing day vs. Sunday rules).

## Systems compared

| Id | System |
| --- | --- |
| `legacy` | Re-implementation of the original app's logic: places in popularity order, fixed 2 h slots, no routing, no hours. |
| `llm-70b` | Llama-3.3-70B-Instruct (Hugging Face Inference Providers), asked for a timed plan as JSON. |
| `llm-8b` | Llama-3.1-8B-Instruct, same prompt. |
| `planner` | The grounded planner built in this repo (no LLM). |
| ablations | `planner` without opening-hours awareness; `planner` without route ordering. |

## Definitions (the rulebook, implemented once in `src/core/verify.ts`)

- Walking time between stops = great-circle distance x 1.3 detour factor / 4.8 km/h. (Calibrated against a routing engine; see results.)
- **Grounded stop**: its name fuzzy-matches an OSM feature in the city snapshot (normalised Jaro-Winkler >= 0.92 on `name`, `name:en`, or `alt_name`, or equal token sets).
- **Known hours**: the feature has an `opening_hours` tag that parses with opening_hours.js. A stop is **closed at visit** if known hours say it is not open for the whole stated window.
- **Feasible day** (headline metric): all of
  1. at least 4 stops;
  2. every stop grounded;
  3. no stop closed at visit;
  4. for consecutive stops, `start_next - end_prev >= walking time` (5 min slack allowed);
  5. all stops inside 09:00-21:00;
  6. no venue visited twice.
- **Schedule-feasible given grounding**: rules 3-6 evaluated on grounded stops only (separates "invented a place" from "bad schedule").
- **Detour ratio**: walked length of the stated order divided by the shortest order found for the same stop set (2-opt from nearest neighbour, exact for 8 stops or fewer). Lower is better, 1.0 is optimal.
- **Profile match**: share of stops whose category belongs to the requested profile.
- Intervals: Wilson 95% for proportions; scenario bootstrap (10,000 resamples) for differences and means. LLM systems run 3 times per scenario at temperature 0.7 if the free quota allows (otherwise 1 run, stated in results).

## Hypotheses and success thresholds

| Id | Statement | Success if |
| --- | --- | --- |
| H1 | The problem exists: LLM-only plans are mostly infeasible. | Upper 95% bound of the feasible-day rate is below 50% for both `llm-70b` and `llm-8b`. If not, the README says the problem is smaller than claimed. |
| H2 | The grounded planner produces feasible days. | `planner` feasible-day rate >= 95%, lower 95% bound >= 90%. |
| H3 | It does not win by doing less. | Planner mean stops per day >= 6, profile match >= 80%, mean detour ratio <= 1.15. |
| H4 | Components matter. | Removing hours awareness raises closed-at-visit rate; removing route ordering raises detour ratio; each with a bootstrap CI excluding 0. |

Known threats, discussed in results: the verifier and the planner share one hours and walking model (mitigated by a routing-engine calibration and by
reporting the share of unknown-hours stops); OSM hours are incomplete and sometimes wrong; name matching can label a real venue missing from the snapshot as
ungrounded (mitigated by a manual spot-check of unmatched names against live OSM search).

## Amendments

All amendments were made before the final 96-scenario evaluation run. Amendments 1 to 3 were prompted by a preliminary run on the first
6 cities (the harness's own output and a look at the plans), so they were not blind to early results; they are listed so a reader can judge that.

1. **Grounding has two tiers.** The first run showed most "not found" LLM stops were real venues missing from the 3.5 km snapshot
   (Arc de Triomphe, Cafe de Flore, Somerset House). Stops not in the snapshot are now checked once against Nominatim (similar name within 12 km of the city centre).
   Such a stop counts as *grounded* but with unknown hours, and is left out of the profile-match ratio. Stops with no hit remain *not found*.
   The README reports snapshot, geocoder-confirmed and not-found shares separately. Cache: `data/geocode-cache.json`.
2. **Walking-time factor is calibrated, not fixed at 1.3.** A 40-pair check against OSRM foot routing showed straight-line x 1.3 at 4.8 km/h underestimates routed time
   (median ours/routed 0.77). The factor is re-set from a seeded 300-pair calibration over all 12 cities before the final run (`results/walk-calibration.json`), and an
   independent re-verification of planner transfers with routed durations is reported (`results/osrm-check.json`).
3. **Holiday clauses.** opening_hours.js rejects tags mentioning public or school holidays when it has no calendar for the country and state, which would have
   discarded a large share of tags. Fallback: drop the holiday clauses and keep the weekday rules (flagged `approx`). The two test dates fall on no public holiday in the
   12 countries, to my knowledge (not verified for every region).
4. **Planner weights.** After inspecting Paris and London plans in the UI (not evaluation scores) the importance of statues and memorials was lowered and the insertion gain
   was changed to importance per extra walking minute (visit length removed). Prompt text for the LLM baseline lives in `eval/llm.ts`; it states the opening-hours and walking-time requirements so the baseline is not a strawman.
5. **Profile categories.** `ALLOWED` sets in `src/core/catalog.ts` define "on profile" (food counts for every profile).
6. **Added cities are a separate, later cohort (2026-11-01).** 15 places were added after the final 96-scenario run: Chennai, Madurai, Ernakulam (Kochi), Fort Kochi,
   Thiruvananthapuram, Bengaluru, Hyderabad, Pune, Kyoto, Osaka, Seoul, Busan, Beijing, Shanghai, Xi'an (15 x 4 profiles x 2 days = 120 days). They are marked `ext` in
   `src/core/cities.ts`, excluded from the 96-day headline, and reported on their own (`results/extension.json`, `results/osrm-check-extension.json`). The planner, weights,
   walking factor and verifier were not changed after seeing them. No LLM baselines were run for them (cost), so H1 is not re-tested there. No threshold is attached to this
   cohort; it is reported as an out-of-sample check of H2 and of how thin the opening-hours data is outside Europe.
