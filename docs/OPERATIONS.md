# Weekly update and city requests

| Part | What it does | Cost |
|---|---|---|
| `ops/search.ts` | Web search through the OmniRoute `/v1/search` endpoint (providers `tavily-search`, then `serper-search`). | Provider free-tier quota: about 27 searches a run |
| `ops/notices.ts` | For each city, takes recent headlines (router search first, GDELT as fallback) and asks an LLM to pick the ones that matter to a walking visitor. Writes `public/notices.json`, shown in the Plan tab as "In the news". | Measured on an earlier router: 18 calls cost $0.0079, so a full 27-city run is about $0.012. The models are now the router's `free-*` combos, billed here at conservative prices so the ledger is an upper bound |
| `ops/requests.ts` | Reads open GitHub issues labelled `city-request`, geocodes each place with Nominatim, counts sights within 3.5 km with Overpass, writes `docs/REQUESTS.md`. | Free, no LLM |
| `ops/update.ts` | Runs both and exits non-zero if one failed. Each step is independent. | |
| `.github/workflows/weekly.yml` | Runs every Monday 03:00 UTC (or by hand) on a GitHub-hosted runner, then opens a pull request with the changed files. A human reviews and merges. | Free tier |

## Setup (repository settings, one time)

| What | Where | Value |
|---|---|---|
| Secret `LLM_API_KEY` | `gh secret set LLM_API_KEY`, or Settings, Secrets and variables, Actions | a router key made for this project only |
| Variables | Settings, Secrets and variables, Actions, Variables | `LLM_ENDPOINT` (router `/v1/chat/completions` URL), `LLM_MODEL` (`free-normal`), `LLM_MODEL_FALL_1` (`free-fast`), `LLM_MODEL_FALL_2` (`free-advanced`), `LLM_PRICE_IN_PER_M`, `LLM_PRICE_OUT_PER_M`, `MONTHLY_BUDGET_USD`; optional `SEARCH_PROVIDERS` (default `tavily-search,serper-search`) |
| Pull requests | Settings, Actions, General, Workflow permissions | tick "Allow GitHub Actions to create and approve pull requests" |

Without `LLM_API_KEY` the notices step is skipped and the requests digest still runs. Pull requests opened with the built-in token do not trigger the CI workflow (a GitHub rule); the changes are data files only. Merging to `main` redeploys the Space when the `HF_TOKEN` secret is set.

## Guardrails

* **Budget.** `ops/llm.ts` keeps `data/ledger.json` (spend per month, from the token counts the API returns). Before every call it checks the worst case for that call and stops at 80% of `MONTHLY_BUDGET_USD`. Fallback models are billed at the primary prices, so the ledger is an upper bound. The ledger only counts spend that has been merged, so merge the weekly pull requests.
* **Notices cannot invent sources.** The model answers with a headline number; the URL and date are copied from that article by code. Text is length-limited, kinds are a fixed list, links must be http(s), and the app rescreens everything with the same function before showing it. Headlines and snippets are treated as untrusted data in the prompt.
* **Notices never change a plan.** They are a banner with the source link, labelled "not verified". The planner only uses OpenStreetMap hours.
* **Requests are untrusted.** Issue text is reduced to place-name characters and used only as a geocoding query. It is never sent to the LLM. Nothing is added to the app automatically.
* **Map snapshots are not refreshed.** The evaluation numbers are pinned to the committed snapshots. Refreshing them is a separate, deliberate step (`npx tsx eval/build-snapshots.ts <slug> --force`, then `npm run eval`).
* **No self-hosted runner.** The router is public over HTTPS, so the job runs on GitHub's servers and nothing on a personal machine takes jobs from a public repository.

## Things not yet verified

* The router's `/v1/search` response shape was not seen when `ops/search.ts` was written. The parser accepts the common shapes (`results`, `organic`, `news`, `data`) and is unit tested on invented examples only. The first real run is the test.
* Search results often have no date. The day the result was seen is used, and the prompt tells the model to ignore events that ended before today.
* The router's `free-*` combos may be slower or less reliable than a paid model; the job falls back through three combos before failing.
* GDELT, the fallback, throttled the development machine hard. GitHub's IPs may differ.

## Run it locally

```bash
npm run ops:smoke          # one tiny LLM call: proves endpoint, key, model, prices and the ledger
npm run update             # both steps; `npm run update -- notices` or `-- requests` for one
```

`.env` (gitignored) takes the same names as the repository secret and variables above. The requests step needs no token for a public repository.

## Adding a requested city

1. Read `docs/REQUESTS.md` (demand, geocoded point, number of sights, a ready line for `src/core/cities.ts`).
2. Skip places with fewer than about 8 sights within 3.5 km: a day plan needs a walkable core.
3. Add the line, set the real `tz`, run `npx tsx eval/build-snapshots.ts <slug>`, then `npm run eval` and open the city in the app.
4. Close the issue with a link to the pull request.
