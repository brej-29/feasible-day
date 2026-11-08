<p align="center">
  <img src="docs/img/hero.svg" alt="Feasible Day: an animated day timeline that builds itself, stop by stop, with walking times between them" width="100%">
</p>

<p align="center">
  <a href="https://brejbala-feasible-day.static.hf.space"><img alt="Live demo" src="https://img.shields.io/badge/live%20demo-open%20the%20app-ffd21f?labelColor=14181c&style=for-the-badge"></a>
  <a href="https://github.com/brej-29/feasible-day/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/brej-29/feasible-day/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/brej-29/feasible-day/actions/workflows/weekly.yml"><img alt="Weekly update" src="https://github.com/brej-29/feasible-day/actions/workflows/weekly.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="MIT licence" src="https://img.shields.io/github/license/brej-29/feasible-day"></a>
  <img alt="27 cities" src="https://img.shields.io/badge/cities-27-14181c">
  <img alt="Free to run" src="https://img.shields.io/badge/cost%20to%20run-%240-14783a">
</p>

**Day plans you can actually walk.** Pick a city, interests and a date. Every stop is a real OpenStreetMap place, every time slot is checked against that place's opening hours, every transfer is checked against walking time, and the app shows which checks passed.

| | |
|---|---|
| **Live app** | https://brejbala-feasible-day.static.hf.space (free static hosting, no cold start) |
| **Space page** | https://huggingface.co/spaces/BrejBala/feasible-day |
| **Case study** | this page: [problem](#the-problem) → [measurement](#what-i-measured-first) → [limits](#what-did-not-hold-up-and-the-limits) → [added cities](#added-cities-an-out-of-sample-check-and-where-it-is-weaker) |
| **Ask for a city** | the *Request a city* tab in the app, or [open an issue](https://github.com/brej-29/feasible-day/issues/new?template=city-request.yml) |
| **Docs** | [problem](docs/PROBLEM.md) · [pre-registration](docs/PREREGISTRATION.md) · [architecture](docs/ARCHITECTURE.md) · [operations](docs/OPERATIONS.md) · [design system](DESIGN.md) · [project handoff](docs/HANDOFF.md) |

<p align="center">
  <img src="docs/img/demo-plan.gif" alt="Screen recording: a Paris day plan, clicking stops highlights them on the map, switching interests, then Kyoto and Hyderabad" width="860">
</p>

## At a glance

| | |
|---|---|
| Question | Can a day plan be *proved* feasible, instead of just sounding feasible? |
| Test | 96 pre-registered test days (12 cities x 4 interest profiles x Monday and Sunday), then 120 more in 15 cities added later |
| LLM alone | 2 of 576 runs gave a fully feasible day (Llama 3.3 70B 2 of 288, Llama 3.1 8B 0 of 288) |
| Feasible Day | 96 of 96 days on its own rulebook; 94.8% of plans when every transfer is re-timed by an independent routing engine |
| Weak spot, reported | In the 15 added cities that routing check is only 59% (Hyderabad worst) |
| Stack | TypeScript, React 19, Vite, MapLibre GL, OpenStreetMap, OSRM, GitHub Actions. 27 cities, 21 tests, no server, no runtime API key |

## The problem

Ask a language model for a day in a city and you get fluent text with tidy times. Whether you can *do* that day is a different question, and one the model cannot check from memory:
the venue may be closed on that weekday, the walk may not fit in the gap, the place may not exist. Published evidence: [TravelPlanner (ICML 2024)](https://arxiv.org/abs/2402.01622) reports GPT-4 passing all constraints on 0.6% of tasks in its hardest setting, and an [agency test of ChatGPT-3.5](https://travolution.com/news/marketing/survey-finds-chatgpt-itineraries-to-be-riddled-with-inaccuracies) (not peer reviewed, old model) found 52% of itineraries sent people to venues outside opening hours. Details and caveats: [`docs/PROBLEM.md`](docs/PROBLEM.md).

This repo started as a generic "LLM travel guide" Streamlit app with no evidence it worked. It is rebuilt around that one measurable problem.

```mermaid
flowchart LR
  Q["Plan me a day in a city"] --> L["Language model, from memory"]
  Q --> F["Feasible Day"]
  L --> L1["Fluent text, tidy times"] --> L2{"Anyone checked the hours and the walks?"}
  L2 -- never --> L3["Closed venue, walk that does not fit, place that is not there"]
  F --> F1["Real places from OpenStreetMap"] --> F2["Simulate every insertion: hours on that date, walking time, 21:00 limit"] --> F3["One shared verifier"] --> F4["Plan plus a pass or fail line for every check"]
```

## What I measured first

A rulebook was fixed **before any planner code existed** ([`docs/PREREGISTRATION.md`](docs/PREREGISTRATION.md)): 96 test days (12 cities x 4 interest profiles x a Monday and a Sunday), a *feasible day* needs at least 4 stops, every stop a mapped place, none closed when visited, every transfer fitting the walking time, all inside 09:00 to 21:00, no venue twice. Thresholds were written down too. Amendments made later, and why, are listed at the bottom of that file.

| System | Days passing every rule | 95% interval | Passing if unmatched stops are ignored | Mean stops | Detour ratio (1.00 = shortest walk) |
| --- | --- | --- | --- | --- | --- |
| Original app logic (re-implemented) | 0 of 96 | 0 to 3.8% | 0% | 6.0 | 1.52 |
| Llama 3.1 8B alone, 3 runs per day | 0 of 288 | 0 to 1.3% | 17.7% (13.7 to 22.5) | 7.2 | 1.45 |
| Llama 3.3 70B alone, 3 runs per day | 2 of 288 | 0.2 to 2.5% | 31.6% (26.5 to 37.2) | 6.3 | 1.38 |
| **Feasible Day planner** | **96 of 96** | **96.2 to 100%** | 100% | 8.0 | 1.14 |

<p align="center">
  <img src="docs/img/demo-evidence.gif" alt="Screen recording of the Evidence tab: feasibility by system, failure table, same day from the model and from the planner, then the Request a city tab" width="860">
</p>

The LLM prompt states the opening-hours and walking-time requirements in plain words, so this is not a strawman ([`eval/llm.ts`](eval/llm.ts)). Models: `meta-llama/Llama-3.3-70B-Instruct` and `meta-llama/Llama-3.1-8B-Instruct` through Hugging Face Inference Providers, temperature 0.7. Stored outputs are in `data/llm/`, so every number reproduces without a token.

**Where the language models fail, among plans where stops could be placed:**

| | Plans with a closed stop | Plans with a transfer that does not fit | Stops closed when visited (of stops with known hours) |
| --- | --- | --- | --- |
| Llama 3.1 8B | 39% | 68% | 31% |
| Llama 3.3 70B | 38% | 45% | 27% |
| Original app logic | 71% | 100% | 48% |
| Planner | 0% | 0% | 0% |

**Ablations (planner without one part).** Ignoring opening hours: 15.6% of days stay feasible, with 1.84 more closed stops per plan (95% bootstrap interval 1.59 to 2.10). Skipping route ordering: detour ratio rises from 1.14 to 1.81 (+0.67, interval 0.60 to 0.74) with 10.3 km walked instead of 1.8 km.

Pre-registered thresholds: H1 (LLM-only mostly infeasible) met, also when unmatched stops are ignored. H2 (planner at least 95%, lower bound at least 90%) met on the shared rulebook, see the independent check below. H3 (not winning by doing less: at least 6 stops, 80% on profile, detour 1.15 or less) met. H4 (each part matters) met.

![Plan view: timeline with signpost-style walking transfers, map, rulebook](docs/img/plan.png)

## What did not hold up, and the limits

- **"Not found" is not "hallucinated".** About a third of the LLM stops could not be matched to OpenStreetMap, but a read of a seeded sample (one reader, no live lookups) of 45 ([`results/not-found-spot-check.md`](results/not-found-spot-check.md)) found about 27 real venues my matcher missed, about 16 generic activities ("a traditional English pub", "Seine River Walk") and none confirmed invented. So no hallucination rate is claimed. That is why the table has a second column. Early in the project the first version of this metric said 95% of LLM plans had an ungrounded stop; that was a snapshot-coverage artefact, and the metric was changed (amendment 1).
- **The planner passes its own rulebook by construction.** The independent check re-times every planner transfer with routed foot durations from OSRM ([`results/osrm-check.json`](results/osrm-check.json)): 664 of 672 transfers fit (98.8%) and **91 of 96 plans (94.8%) have every transfer fitting**, just under the 95% threshold. The misses are Paris plans where a river or barrier makes the real walk up to 11 minutes longer than estimated. The walking model itself is within 10% mean absolute error of routing on 300 random pairs (median ratio 0.95, 12% of pairs underestimated by more than 20%), after the detour factor was raised from 1.3 to 1.37 ([`results/walk-calibration.json`](results/walk-calibration.json)).
- **Opening-hours data is thin.** Only 14% to 34% of sights, museums, parks and monuments in the snapshots carry a parseable `opening_hours` tag (restaurants excluded: they were selected for having one). About 41% of planner stops are therefore shown as *hours unverified*. Per city: [`results/hours-coverage.json`](results/hours-coverage.json). Mumbai is a deliberate stress case with only 29 sights; the app says when it cannot build a day.
- **Holiday rules are approximate.** opening_hours.js rejects public-holiday and school-holiday clauses without a calendar for the country and state. Those clauses are dropped (`approx`), so a visit on an actual public holiday can be wrong. The two test dates were chosen to avoid holidays, not verified for every region.
- **Importance is a proxy.** OpenStreetMap has no ratings. Importance is a hand-set category score plus a Wikidata-link bonus, and restaurants are chosen by position and tagged hours, not by taste. Weights were adjusted after looking at Paris and London plans, not tuned on evaluation scores.
- **Single rater, two models, one prompt.** The LLM baseline is two open models and one prompt. Other models or prompting (for example tool calls to a maps API) may do better; that is not tested here.

## Added cities: an out-of-sample check, and where it is weaker

After the thresholds were fixed and the 96-day run was done, 15 places were added: Tamil Nadu (Chennai, Madurai), Kerala (Ernakulam, Fort Kochi, Thiruvananthapuram), Bengaluru, Hyderabad, Pune, Kyoto, Osaka, Seoul, Busan, Beijing, Shanghai and Xi'an (pre-registration amendment 6). They are scored separately (120 test days) and nothing in the planner was changed after seeing them. No LLM baselines were run there, so H1 is not re-tested.

| 120 days in the 15 added cities | Days passing every rule | 95% interval | Mean stops | Stops with unverified hours |
| --- | --- | --- | --- | --- |
| Original app logic | 0 of 120 | 0 to 3.1% | 5.9 | 64% |
| Planner, hours ignored | 49 of 120 | 32.5 to 49.8% | 8.0 | 59% |
| Planner, no routing | 106 of 120 | 81.4 to 92.9% | 7.8 | 50% |
| **Feasible Day planner** | **120 of 120** | **96.9 to 100%** | 8.0 | 59% |

That pass rate is against the planner's own rulebook. The independent routing check ([`results/osrm-check-extension.json`](results/osrm-check-extension.json)) is much weaker than in the first 12 cities: **71 of 120 plans (59%)** have every transfer fitting routed walking time (766 of 834 transfers, 92%), against 94.8% of plans before. It is not uniform: Kyoto, Osaka, Seoul, Bengaluru and Fort Kochi pass every transfer; Hyderabad passes 32 of 56 transfers, with some walks 47 minutes longer than estimated; Chennai, Ernakulam, Pune, Beijing and Xi'an each pass 50 or 48 of 56. Likely causes (not tested): rivers, rail lines and ring roads that a straight-line model cannot see, and sparse sight data forcing longer hops (Madurai has 10 sights in the snapshot, Hyderabad 15, Pune 21). Opening hours are thinner too: 2% to 29% of sights carry a parseable tag, 59% of planner stops are unverified, and Busan has 2%.

The walking factor (1.37) was calibrated on the original 12 cities and is deliberately left alone. A per-city calibration is the obvious next step, but it would need its own held-out check. The app labels these cities as added and says so on the plan page.

## How it works

```mermaid
flowchart TB
  OSM[("OpenStreetMap<br/>via Overpass")] -->|"eval/build-snapshots"| SNAP["data/snapshots<br/>27 cities, ODbL"]
  SNAP --> PLAN["planner.ts<br/>cluster, meals, insert by gain"]
  HRS["opening_hours.js"] --> PLAN
  PLAN --> VER["verify.ts<br/>the single definition of feasible"]
  VER --> APP["React app<br/>timeline, map, Rulebook"]
  VER --> EVAL["eval/run.ts<br/>96 + 120 test days, intervals, ablations"]
  LLM["Stored LLM plans<br/>data/llm"] --> EVAL
  PLAN --> CHK["eval/osrm-check.ts<br/>independent re-timing"]
  OSRM["OSRM foot routes"] --> CHK
  EVAL --> EVJ["public/evidence.json"] --> APP
  NEWS["notices.json<br/>weekly, unverified"] --> APP
```

1. A snapshot of notable places from OpenStreetMap (Overpass API) for 27 city centres (the 12 pre-registered ones plus 15 added later), committed in `data/snapshots/` (ODbL).
2. A planner anchors the day on the densest cluster of important places, fixes lunch (and dinner on food days) in meal windows, then inserts stops one at a time by importance per extra walking minute, simulating the whole day (opening hours for the date, walking time, 21:00 limit) for every insertion.
3. A verifier ([`src/core/verify.ts`](src/core/verify.ts)) is the single definition of feasibility, used by the planner tests, the evaluation, and the in-app Rulebook panel.
4. The app is static React: everything runs in the browser, there is no server and no key. Architecture notes: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Design system: [`DESIGN.md`](DESIGN.md).

```mermaid
flowchart TD
  A["Candidates: mapped places that fit the interest profile"] --> B["Anchor on the densest cluster, within 2.2 km"]
  B --> C["Fix lunch in 11:45 to 14:00 (dinner 18:15 to 19:45 on food days)"]
  C --> D["Try each remaining place"]
  D --> E{"Fits? Open on that date, walkable in the gap, before 21:00"}
  E -- no --> D
  E -- yes --> F["Gain = importance / (extra walking minutes + 8)"]
  F --> G["Insert the best, re-simulate the whole day"]
  G --> D
  G --> H["Nothing fits any more: order the route, label unknown hours, done"]
```

The interface is built around the thing a walker already trusts: trail signposts. Each transfer is a yellow signpost arm with the destination and walking minutes; hours that were checked are solid, hours that were not are hatched. The Evidence tab puts the numbers above in the product, with a side-by-side of the same day from the model and from the planner.

<p align="center"><img src="docs/img/mobile.png" alt="Phone layout of the plan view" height="420"></p>

## Weekly update and city requests

- **News notices.** Every Monday a job asks the OmniRoute router (Tavily, then Serper search; GDELT as a fallback) for recent headlines per city, and an LLM (an OpenAI-compatible endpoint, with fallback models and a hard monthly budget of $1.50, stopping at 80%) picks the few that matter to a walker: closures, strikes, festivals, severe weather. They appear as an "In the news" box with the source link, labelled *not verified*. They never change a plan. The URL and date are copied from the article by code, so the model cannot invent a source.
- **City requests.** The Request tab opens a prefilled GitHub issue (no backend, no stored personal data beyond the issue itself). The same job compiles open requests into [`docs/REQUESTS.md`](docs/REQUESTS.md): demand, geocoded point, number of sights within 3.5 km, and a ready line for `src/core/cities.ts`. Nothing is added automatically; a person reviews it.
- **A person stays in the loop.** The job opens a pull request; nothing reaches the live app until it is merged. Details, secrets and costs: [`docs/OPERATIONS.md`](docs/OPERATIONS.md).

```mermaid
sequenceDiagram
  participant GH as GitHub Actions (Monday 03:00 UTC)
  participant R as OmniRoute router (HTTPS)
  participant G as GDELT (fallback)
  participant Me as Reviewer
  GH->>R: search each city (Tavily, then Serper)
  R-->>GH: headlines and links
  GH-->>G: only if search fails
  GH->>R: LLM picks headline numbers worth showing
  Note over GH: code copies URL and date, ledger enforces the budget
  GH->>GH: read city-request issues, geocode, count sights
  GH->>Me: pull request (notices.json, REQUESTS.md, ledger.json)
  Me->>GH: review and merge, Space redeploys
```

## FAQ

**Can ChatGPT or another AI plan a realistic one day itinerary?** It can write a readable one, but in this repo's test of 96 days across 12 cities, Llama 3.3 70B and Llama 3.1 8B produced a fully feasible day (open venues, walkable gaps, real places) in 2 of 576 runs, even with the rules stated in the prompt. Two models and one prompt, so it is not a verdict on every AI.

**How does Feasible Day check opening hours?** It reads the `opening_hours` tag from OpenStreetMap and evaluates it for the date you pick. Places without a usable tag are shown as "hours unverified" and ranked lower; hours are never guessed.

**Which cities are covered?** 27: Paris, London, Rome, Barcelona, Berlin, Amsterdam, Lisbon, Vienna, Prague, New York, Tokyo, Mumbai, Chennai, Madurai, Ernakulam (Kochi), Fort Kochi, Thiruvananthapuram, Bengaluru, Hyderabad, Pune, Kyoto, Osaka, Seoul, Busan, Beijing, Shanghai and Xi'an. Ask for another in the app's Request a city tab.

**Is it free, and does it need an account or API key?** Free, no account, no key. It runs entirely in your browser.

**How accurate are the walking times?** Within about 10% of routed walking time on 300 random pairs in the first 12 cities, and 94.8% of plans pass an independent routing check there. In the 15 later cities only 59% do, so treat times there as estimates.

## Run it

```bash
npm ci
npm run dev            # app at http://localhost:5173
npm test               # 21 tests
npm run build
```

Reproduce the evaluation (offline, from stored model outputs and cached geocoder lookups):

```bash
npm run eval           # writes results/ and public/evidence.json
```

Re-collect data and run the other tools (needs network; the public Overpass server is slow and busy):

```bash
npm run data           # city snapshots
npm run eval -- --llm --reps 3     # LLM baselines, needs HF_TOKEN or `hf auth login`
npm run calibrate      # walking-time model vs OSRM
npm run osrm-check     # independent re-timing of planner transfers
npm run ops:smoke      # one tiny LLM call through the update job's client (needs .env)
npm run update         # notices + city-request digest (needs .env for notices)
node scripts/record-demo.mjs   # re-record the README GIFs (needs `npx vite preview` running)
```

Configuration: `LLM_70B`, `LLM_8B` (baseline model ids), `LLM_ENDPOINT`, `VITE_MAP_STYLE` (basemap style URL). Free catalogs change, so none of these are hard-coded into logic. The weekly job has its own variables, see [`docs/OPERATIONS.md`](docs/OPERATIONS.md).

## Live app and free-tier limits

- Hosted as a **static Hugging Face Space** (free). No server, so no cold start and no quota to run out; first load fetches one city snapshot (about 150 to 400 KB).
- On first load the map can take about 10 seconds to appear (vector style, fonts and worker download); the plan and Rulebook show immediately.
- Basemap: OpenFreeMap vector tiles (free, no key, third-party service with no uptime guarantee). If it is unreachable the timeline and Rulebook still work, only the map pane is blank.
- The app calls no LLM. LLM outputs appear only as stored baseline plans in the Evidence tab.
- Deploy: `npm run build` then `uvx --from huggingface_hub python scripts/deploy_hf.py BrejBala/feasible-day`. `.github/workflows/deploy.yml` does this on push to `main` when a write token is set as the repository secret `HF_TOKEN`.

## Data and licences

Map data © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright). Basemap © OpenFreeMap and OpenMapTiles. Snapshots and `data/geocode-cache.json` are derived from OpenStreetMap and carry the same licence. Code: MIT (see `LICENSE`).
