# Monthly update and city requests

| Part | What it does | Cost |
|---|---|---|
| `ops/notices.ts` | For each city, fetches recent headlines from GDELT (free, keyless) and asks an LLM to pick the ones that matter to a walking visitor. Writes `public/notices.json`, shown in the Plan tab as "In the news". | Measured: 18 calls cost $0.0079 (about $0.0004 each), so a full 27-city run is about $0.012. The $1.50 cap is roughly 100 times that. See `data/ledger.json` |
| `ops/requests.ts` | Reads open GitHub issues labelled `city-request`, geocodes each place with Nominatim, counts sights within 3.5 km with Overpass, writes `docs/REQUESTS.md`. | Free, no LLM |
| `ops/monthly.ts` | Runs both and exits non-zero if one failed. Each step is independent. | |
| `.github/workflows/monthly.yml` | Runs on the 1st of each month (or by hand), then opens a pull request with the changed files. A human reviews and merges. | Free tier |

## Known weak point: the news feed

GDELT throttles hard. From the development machine, a run at 10 seconds between requests with long back-offs still checked only a few of the 27 cities; most requests got a rate-limit message or a dropped connection. The job copes rather than fixes this: failed cities keep last month's notices (dropped after 45 days), each city records its own check date, and the stalest cities go first on the next run, so repeated runs cover everyone. GitHub's runner IPs may behave differently, but that is untested. If it stays poor, run the workflow by hand a few times (`workflow_dispatch`) or swap the source in `headlines()`; a keyed news API would need a new account, which this project avoids.

## Guardrails

* **Budget.** `ops/llm.ts` keeps `data/ledger.json` (spend per month, from the token counts the API returns). Before every call it checks the worst case for that call and stops at 80% of `MONTHLY_BUDGET_USD`. Fallback models are billed at the primary prices, so the ledger is an upper bound.
* **Notices cannot invent sources.** The model answers with a headline number; the URL and date are copied from that article by code. Text is length-limited, kinds are a fixed list, links must be http(s), and the app rescreens everything with the same function before showing it. Headlines are treated as untrusted data in the prompt.
* **Notices never change a plan.** They are a banner with the source link, labelled "not verified". The planner only uses OpenStreetMap hours.
* **Requests are untrusted.** Issue text is stripped of markup and used only as a geocoding query. It is never sent to the LLM. Nothing is added to the app automatically.
* **Map snapshots are not refreshed.** The evaluation numbers are pinned to the committed snapshots. Refreshing them is a separate, deliberate step (`npx tsx eval/build-snapshots.ts <slug> --force`, then `npm run eval`).

## Run it locally

```bash
npm run ops:smoke          # one tiny LLM call: proves endpoint, key, model, prices and the ledger
npm run monthly            # both steps; `npm run monthly -- notices` or `-- requests` for one
```

`.env` (gitignored): `LLM_ENDPOINT`, `LLM_API_KEY`, `LLM_MODEL`, optional `LLM_MODEL_FALL_1`, `LLM_MODEL_FALL_2`, `LLM_PRICE_IN_PER_M`, `LLM_PRICE_OUT_PER_M`, `MONTHLY_BUDGET_USD` (default 1.5). Without LLM variables the notices step is skipped. The requests step needs `GITHUB_TOKEN` while the repository is private (`GITHUB_TOKEN=$(gh auth token) npm run monthly -- requests`).

## Run it on GitHub

GitHub's servers cannot reach an OmniRoute on `localhost`. Set these repository secrets (Settings, Secrets and variables, Actions) and point the endpoint at OpenRouter directly; the client strips the `openrouter/` prefix from model names when the endpoint host is `openrouter.ai`:

| Secret | Value |
|---|---|
| `LLM_ENDPOINT` | `https://openrouter.ai/api/v1/chat/completions` |
| `LLM_API_KEY` | an OpenRouter key, ideally one with a spending limit set in the OpenRouter dashboard |
| `LLM_MODEL`, `LLM_MODEL_FALL_1`, `LLM_MODEL_FALL_2`, `LLM_PRICE_IN_PER_M`, `LLM_PRICE_OUT_PER_M`, `MONTHLY_BUDGET_USD` | as in `.env` |

Also enable Settings, Actions, General, "Allow GitHub Actions to create and approve pull requests". Pull requests opened by the workflow do not trigger the CI workflow (a GitHub rule for the built-in token); the changes are data files only. Merging to `main` redeploys the Space when `HF_TOKEN` is set.

## Adding a requested city

1. Read `docs/REQUESTS.md` (demand, geocoded point, number of sights, a ready line for `src/core/cities.ts`).
2. Skip places with fewer than about 8 sights within 3.5 km: a day plan needs a walkable core.
3. Add the line, set the real `tz`, run `npx tsx eval/build-snapshots.ts <slug>`, then `npm run eval` and open the city in the app.
4. Close the issue with a link to the pull request.
