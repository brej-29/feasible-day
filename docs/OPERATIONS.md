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

## Run it on GitHub (self-hosted runner on your PC)

GitHub's servers cannot reach an OmniRoute on `localhost`, and OpenRouter is not an option here. So the workflow runs on a **self-hosted runner**: a small program on your PC that takes jobs from GitHub. The job then calls `http://localhost:20128` itself.

| Situation | What happens |
|---|---|
| PC on, runner started, OmniRoute running on the 1st | The job runs and opens a pull request. |
| PC off or runner stopped | The job waits in the queue (GitHub drops it after 24 hours). Start the runner and OmniRoute, open the run in the Actions tab, press "Re-run all jobs". |
| Runner on but OmniRoute stopped | The notices step fails at once with "start OmniRoute, then run again" (the requests digest still runs). Start OmniRoute and re-run. |
| Want a run without your PC | Actions, Monthly update, Run workflow, runner `ubuntu-latest`: requests digest only, no LLM. |

One-time setup (these need you, not the repo):

1. **Register the runner.** Repository Settings, Actions, Runners, New self-hosted runner, Windows. Follow the download and `config.cmd` steps it shows, then run `run.cmd` when you want jobs to start (or install it as a service). Git for Windows must be installed (the workflow uses `bash`).
2. **Secret.** `gh secret set LLM_API_KEY` (paste the key when asked) or Settings, Secrets and variables, Actions, New repository secret.
3. **Variables.** `LLM_ENDPOINT`, `LLM_MODEL`, `LLM_MODEL_FALL_1`, `LLM_MODEL_FALL_2`, `LLM_PRICE_IN_PER_M`, `LLM_PRICE_OUT_PER_M`, `MONTHLY_BUDGET_USD` are repository variables (not secret), already set from `.env`.
4. **Pull requests.** Settings, Actions, General, Workflow permissions: tick "Allow GitHub Actions to create and approve pull requests".
5. **Protect the runner (important, the repo is public).** Settings, Actions, General, Fork pull request workflows: choose "Require approval for all external contributors". Never approve a pull request from a stranger that edits anything under `.github/workflows`. `monthly.yml` itself only runs on the schedule or a manual start, never on pull requests, but a hostile pull request could try to point another workflow at your runner; that approval setting is what stops it.

Pull requests opened by the workflow do not trigger the CI workflow (a GitHub rule for the built-in token); the changes are data files only. Merging to `main` redeploys the Space when `HF_TOKEN` is set.

## Adding a requested city

1. Read `docs/REQUESTS.md` (demand, geocoded point, number of sights, a ready line for `src/core/cities.ts`).
2. Skip places with fewer than about 8 sights within 3.5 km: a day plan needs a walkable core.
3. Add the line, set the real `tz`, run `npx tsx eval/build-snapshots.ts <slug>`, then `npm run eval` and open the city in the app.
4. Close the issue with a link to the pull request.
