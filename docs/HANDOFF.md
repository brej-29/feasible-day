# Feasible Day: project handoff

Read this first when picking the project up in a new session, or when writing about it (portfolio, LinkedIn, resume). Numbers are from `results/` and `public/evidence.json` as of 2026-11-08. Re-run `npm run eval` to reproduce.

## 1. What it is, in one paragraph

A static web app that builds walkable one to three day plans from OpenStreetMap, checks every stop against opening hours and every transfer against walking time, and shows which checks passed. It exists because language models write day plans that look right and often are not (closed venues, walks that do not fit, places that do not exist). The repo was a generic Streamlit and LangGraph "travel guide" with no evidence it worked; it was rebuilt around that one measurable problem.

| | |
|---|---|
| Live | https://brejbala-feasible-day.static.hf.space |
| Repo | https://github.com/brej-29/feasible-day (public, MIT) |
| Space | https://huggingface.co/spaces/BrejBala/feasible-day |
| Stack | TypeScript, React 19, Vite, MapLibre GL, vitest, tsx, GitHub Actions, Hugging Face Spaces (static) |
| Data | OpenStreetMap (Overpass, Nominatim), OSRM foot routes, opening_hours.js, OpenFreeMap tiles |
| Scale | 27 cities, 21 tests, 8 PRs merged before this one, CI on every PR |

## 2. Timeline of the work

| Step | What happened |
|---|---|
| Backup | Tag `backup/pre-rebuild-2026-11-01` on the original app |
| PR 2 to 4 | Reframe, pre-registration (`docs/PREREGISTRATION.md`), planner, verifier, evaluation harness, app, README |
| PR 5 | Fix: bundle the MapLibre worker so the production map renders; favicon |
| PR 6 | `DESIGN.md`, live notes |
| PR 7 | 15 added cities (separate cohort), monthly notices, city-request tab, budgeted LLM client |
| PR 8 | Hardening of the self-hosted runner use (now superseded) |
| This branch `feat/weekly-update` | Weekly GitHub-hosted workflow on the cloud router, router search for news, README rewrite with GIFs and diagrams, this handoff |

## 3. Key results (quote these)

96 pre-registered test days (12 cities x 4 profiles x Monday and Sunday). Feasible = at least 4 stops, all mapped, none closed when visited, every transfer fits walking time, inside 09:00 to 21:00, no repeats.

| System | Days passing | 95% interval |
|---|---|---|
| Original app logic | 0 of 96 | 0 to 3.8% |
| Llama 3.1 8B alone (3 runs per day) | 0 of 288 | 0 to 1.3% |
| Llama 3.3 70B alone (3 runs per day) | 2 of 288 | 0.2 to 2.5% |
| Feasible Day planner | 96 of 96 | 96.2 to 100% |

| Other result | Value |
|---|---|
| Independent OSRM routing re-check, original 12 cities | 91 of 96 plans (94.8%); 664 of 672 transfers. Just under the 95% pre-registered threshold |
| Ablation: ignore opening hours | 15.6% of days stay feasible; +1.84 closed stops per plan |
| Ablation: no route ordering | detour ratio 1.81 instead of 1.14 |
| 15 added cities (120 days) | 120 of 120 on own rules, but only 71 of 120 plans (59%) pass the routing re-check; Hyderabad worst (32 of 56 transfers) |
| Opening hours coverage | 14% to 34% of sights tagged in the first 12 cities; about 41% of planner stops "hours unverified" (59% in added cities) |
| LLM cost of the notices job | $0.0079 for 18 calls on an earlier router (about $0.012 per full run, an estimate); cap $1.50 a month |

## 4. Problems faced and how they were handled

| Problem | What was done |
|---|---|
| Original app had no evidence it worked | Picked one failure that can be measured and rebuilt around it |
| Risk of tuning thresholds to the planner | Pre-registered metrics and thresholds before the planner existed; six dated amendments, three made after a preliminary six-city run and disclosed as such |
| "95% of LLM plans have an unreal place" was an artefact of thin map coverage | Added a geocoder tier, split the metric into three shares, and stopped claiming a hallucination rate. A hand check of 45 names found about 27 real venues the matcher missed and none confirmed invented |
| Walking model too optimistic | Calibrated on 300 seeded pairs against OSRM (factor 1.3 to 1.37). Still only 94.8% on the independent check |
| Opening hours missing or unparseable | Unknown stays unknown: shown hatched as "hours unverified", never guessed. Holiday clauses without a calendar are dropped and flagged approximate |
| Map blank in production | MapLibre worker URL was not bundled; fixed with an explicit worker import (PR 5). Basemap switched to keyless OpenFreeMap |
| Critical advisory in an old maplibre-gl | Upgraded to 6.16.0 |
| Overpass public servers slow or 502 | Sequential polite queries, retries, two worker processes, committed snapshots so nothing depends on it at runtime |
| Added cities scored worse on the routing check | Reported in README, Evidence tab and an in-app banner; planner not retuned (would need a held-out check) |
| News source (GDELT) throttled hard | Resumable job (stalest cities first, per-city check date), then moved to router search with GDELT as fallback |
| Self-hosted runner on a public repo flagged as high risk | Removed: the router is now public over HTTPS, so the job runs on GitHub-hosted runners |
| Untrusted text from issues and headlines | Issue text reduced to place-name characters and never sent to the LLM; the model returns a headline number and code copies URL and date; app rescreens notices |

## 5. Current state of this branch (`feat/weekly-update`)

| Done | Not done |
|---|---|
| `weekly.yml` (Mondays 03:00 UTC, GitHub-hosted, opens a PR), old `monthly.yml` removed | **Secret `LLM_API_KEY` not set**: the user must run `gh secret set LLM_API_KEY` with a key made for this project |
| Repo variables point at the cloud router: `free-normal`, fallbacks `free-fast`, `free-advanced` | `ops/search.ts` is **unverified against the real `/v1/search` response**; parser is tolerant and tested only on invented shapes. First real run is the test |
| `ops/search.ts` (Tavily then Serper), `ops/update.ts` (renamed), 21 tests passing locally | PR not opened, CI not run, not merged, Space not redeployed (the request page text changed) |
| README rewritten: animated hero SVG, two GIFs, four Mermaid diagrams, badges, link table | "Allow GitHub Actions to create and approve pull requests" setting still to be ticked by the user |
| `docs/OPERATIONS.md` rewritten for the weekly flow | Optional `HF_TOKEN` secret for auto-deploy; otherwise deploy with `scripts/deploy_hf.py` |

Next steps in order: set the secret, put the cloud key in `.env`, run `npm run ops:smoke` and `npm run update -- notices` once to check search and the ledger, open the PR, wait for CI, merge, redeploy the Space.

## 6. Router facts (OmniRoute, cloud)

Base URL and key are in the owner's own notes, not in this repo. Chat endpoint `POST /v1/chat/completions`, search `POST /v1/search` with `{provider, query, max_results}`, bearer key. Usable combos: `free-normal`, `free-fast`, `free-advanced`, `free-coding`, `free-vision`. Not usable (HTTP 400): `free-balanced`, `free-research`. Search providers: `tavily-search`, `serper-search`. Free combos may be slower or less reliable than paid models, and "passed" does not prove a provider stays free. Never commit keys.

## 7. Portfolio and LinkedIn material

### Claims

| Safe | Do not claim |
|---|---|
| 2 of 576 LLM runs produced a fully feasible day (two open models, one prompt) | That LLMs cannot plan trips, or any hallucination rate |
| Planner passes every day on its own rulebook | "100% accurate" or "always feasible" |
| 94.8% of plans pass an independent routing check | That the 59% added-city result is fixed or explained |
| Free to run, no server, no runtime API key | Users, traffic, revenue (none measured) |
| Pre-registered metrics with listed amendments | Peer review |

### Resume bullets (pick 3 to 5)

- Measured why LLM day plans fail: reproducible evaluation (96 pre-registered test days, Wilson and cluster-bootstrap intervals, ablations, stored model outputs) showing two open LLMs produced a fully feasible day in 2 of 576 runs.
- Wrote metric definitions and thresholds before any planner code, listed every later change as a dated amendment, and reported the result that missed its threshold (94.8% against 95% on an independent routing check).
- Rebuilt a Streamlit and LangGraph prototype as a static React 19 and TypeScript app on free hosting, with automated tests, CI and reviewed pull requests.
- Built an update pipeline with a hard $1.50 monthly LLM budget (token ledger, model fallbacks, health check) and untrusted-input handling: the model picks a headline number and code copies the URL and date.
- Extended 12 to 27 cities as an out-of-sample cohort, found the walking model transfers poorly in some (59% routed pass) and surfaced that in the product instead of hiding it.

### LinkedIn post drafts (plain voice, add one personal sentence about why you built it)

**Post 1: the measurement**
> I asked two open LLMs to plan a day in 12 cities, 96 days in all, with the opening-hours and walking-time rules written in the prompt. Across 576 runs, 2 gave a day you could actually do. So I built a planner on OpenStreetMap that checks both rules, and wrote down the pass criteria before writing its code. It passes every day on its own rules. Re-timing its walks with a separate routing engine, 94.8% of plans held up, just under the 95% I had set. Code and numbers are public and reproduce offline. https://brejbala-feasible-day.static.hf.space

**Post 2: the result that did not hold**
> I added 15 cities after my results were frozen: Chennai, Kyoto, Seoul, Beijing and others. The planner still passes its own rules everywhere. But when I re-timed its walks with a routing engine, only 59% of plans held up, and Hyderabad was the worst. The map shows a river between the stops. I left that number in the app instead of tuning it away, because tuning on the test set would make the result meaningless.

**Post 3: the pipeline**
> Small thing I like about my side project: a weekly job reads local news for 27 cities and shows warnings on the plan page. The model never writes a link. It returns a headline number and my code copies the URL and date, so it cannot cite something it was not given. Hard budget of $1.50 a month, a pull request every Monday, and nothing goes live until I merge it.

### Interview answers

| Question | Answer |
|---|---|
| Is the planner overfit to your rules? | By construction it passes its own rulebook, so I added an independent routing check. It gave 94.8%, so the claim is weaker than 100% |
| Why did added cities score 59%? | Probably rivers, rail lines and ring roads a straight-line model cannot see, plus sparse sight data. Not tested. I did not retune because that needs a held-out check |
| Is the LLM baseline a strawman? | The prompt states the rules plainly, but it is two open models and one prompt. Tool-using agents may do better; not tested |
| What next? | Per-city walking calibration with a held-out check, refreshed map snapshots with a re-run evaluation, and a verified news source |

### Before publishing anywhere

- Confirm the form of your name (the LICENSE says Brejesh Balakrishnan) and add your own profile links.
- Decide how to describe any AI assistance used while building; only write what is true. The repo carries no tool attribution by your instruction.
- Retake `docs/img/plan.png` and `evidence.png` if you want the news box and added cities visible (the GIFs already show them).

## 8. Where things are

| Path | What |
|---|---|
| `src/core/` | planner, verifier (`verify.ts`), hours, geo, catalog, cities, notices schema |
| `src/app/` | React UI: plan, map, evidence, method, request tab, notices |
| `eval/` | snapshot builder, evaluation harness, LLM baselines, calibration, OSRM check |
| `ops/` | `llm.ts` (budgeted client), `search.ts`, `notices.ts`, `requests.ts`, `update.ts` |
| `data/` | snapshots (OSM), stored LLM outputs, geocode cache, spend ledger |
| `results/`, `public/evidence.json` | evaluation outputs |
| `docs/` | PROBLEM, PREREGISTRATION, ARCHITECTURE, OPERATIONS, REQUESTS (generated), this file, `img/` |
| `scripts/` | Space deploy, screenshots, GIF recorder |
| `.github/workflows/` | `ci.yml`, `deploy.yml` (needs `HF_TOKEN`), `weekly.yml` |

Gotchas: a running dev server locks a native binary and breaks `npm ci` on Windows (stop it first). Public Overpass is slow; snapshots are committed for that reason. Pull requests opened by the built-in token do not trigger CI. The ledger only counts merged spend.
