# The problem: plausible day plans that cannot be walked

Ask a language model for a day in a city and you get fluent text: eight stops, tidy times, warm adjectives.
Whether you can actually *do* that day is a different question, and one the model has no way to check.

Three things go wrong in practice:

| Failure | What it looks like on the ground |
| --- | --- |
| **Ungrounded stop** | The venue is invented, renamed, closed for good, or outside the city. |
| **Closed at the scheduled time** | A museum scheduled on its closing day, a cafe at 02:00. |
| **Unwalkable route** | A 10:00 stop in the north, a 10:30 stop in the south, a zig-zag all day; transfers that do not fit in the gap between stops. |

## Evidence that this is real (and how strong it is)

| Source | Finding | Strength |
| --- | --- | --- |
| [TravelPlanner, Xie et al., ICML 2024](https://arxiv.org/abs/2402.01622) | 1,225 planning intents; "even GPT-4 only achieves a success rate of 0.6%" when all constraints must hold. The 0.6% is the harder tool-use setting; easier sole-planning settings score higher, with most plans still violating at least one constraint. | Peer-reviewed benchmark, but about multi-day, budgeted plans with transport and lodging, not walkable day plans. |
| [SEO Travel test, reported by Travolution](https://travolution.com/news/marketing/survey-finds-chatgpt-itineraries-to-be-riddled-with-inaccuracies) | 100 two-day itineraries for 10 cities from ChatGPT-3.5: 90% had at least one error; 52% placed visits outside opening hours; 1 in 4 included a closed venue; some invented venues; 1 in 4 had illogical routing. | Marketing-agency test, not peer reviewed, old model. Motivation, not proof. |
| This repo, `results/` | Re-measured on current open models against a fixed rulebook, see the README. | Reproducible from the repo. |

No published figure exists for how many OpenStreetMap venues carry opening hours (searched, none found), so this project measures it (`results/hours-coverage.json`).

## What this project claims

1. **Measurable**: day-plan feasibility can be defined as a checkable property (grounded, open when visited, walkable between stops, inside the day).
2. **Fixable without a model in the loop**: planning from real, hours-tagged map data with an explicit scheduler yields feasible days, and the check is cheap enough to run in the browser.
3. **Honest about uncertainty**: OpenStreetMap hours are incomplete. Stops with unknown hours are labelled *unverified*, never silently trusted.

## What it deliberately does not claim

- It does not rank venues by quality (OSM has no ratings). Importance is a proxy: Wikidata presence and category.
- It does not know about temporary closures, ticket sell-outs, or public holidays absent from OSM tags.
- It is not an LLM replacement for taste, narrative, or trip-level budgeting. It is the feasibility layer an LLM planner is missing.
