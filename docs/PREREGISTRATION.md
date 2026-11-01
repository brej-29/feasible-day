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

(none yet)
