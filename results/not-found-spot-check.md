# Spot-check of LLM stops that could not be matched

Method: a seeded random sample of 45 distinct names from `results/not-found-names.json` (system `llm-70b`, LCG seed 12345), read by hand by the repo author on 2026-11-01.
One reader, no second rater, no live lookup of every name: treat the split as indicative, not measured.

| Reading | Count of 45 | Examples |
| --- | --- | --- |
| Real, named place that the matcher and geocoder missed | about 27 | Casa Milà - La Pedrera, Tokyo Tower viewpoint, Babulnath Temple, KaDeWe, St. Stephen's Cathedral (Stephansdom), Sushi Saito |
| Generic description or activity, not a venue | about 16 | "a traditional English pub", "and stroll along La Rambla", "canal ring walk", "Seine River Walk" |
| Could not tell | about 2 | Shibuya Ichiban Tei, Cafe Santiago |
| Confirmed invented | 0 found | none identified in this sample |

Reading: the "not found" share (about a third of LLM stops) is mostly a limit of the matcher and snapshot, plus the model writing activities instead of venues.
It is **not** a hallucination rate and the README does not report it as one. The robust LLM failures are the schedule rules (closed when visited, transfers that do not fit),
which are measured on stops that were placed. The headline table therefore also reports feasibility with unmatched stops ignored.
