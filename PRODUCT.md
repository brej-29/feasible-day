# Product

<!-- impeccable:product-schema 1 -->

<!-- Inferred from the repository and the owner's brief, not from an interview. Labelled [inferred]. -->

## Platform

web

## Stack

Static React + Vite + TypeScript, Leaflet map, deployed as a static site (free hosting). [inferred: owner delegated stack choice]

## Users

[inferred] Hiring managers and engineers evaluating the project in minutes; and travellers planning a walkable day in a city who want to know the plan will work.

## Product Purpose

Generate a one-day or multi-day walking plan for a city from real OpenStreetMap places, schedule it against opening hours and walking time, and show exactly which checks it passed. Success: a visitor sees a day that is verifiably doable, and sees measured evidence that LLM-only day plans usually are not.

## Positioning

Every stop is a real mapped place, every time slot is checked against that place's opening hours for the chosen weekday, and every transfer fits the walking time. Stops whose hours are not in OpenStreetMap are labelled unverified rather than trusted. The evaluation numbers are in the product, not just the README.

## Operating Context

Runs entirely in the browser from pre-built OSM snapshots for 12 cities (no backend, no API key). Evidence panel reads results produced by `npm run eval`.

## Capabilities and Constraints

- Cities: 12 prebuilt snapshots (Paris, London, Rome, Barcelona, Berlin, Amsterdam, Lisbon, Vienna, Prague, New York, Tokyo, Mumbai).
- Profiles: culture, nature, food, mixed. Days: weekday matters (opening hours).
- OSM has no ratings; importance is a proxy. Hours coverage is partial.
- Data © OpenStreetMap contributors (ODbL): attribution must be visible.
- No LLM in the live app. LLM outputs appear only as stored baseline plans from the evaluation.

## Brand Commitments

Name: Feasible Day. Voice: plain, specific, numbers over adjectives. No invented metrics.

## Evidence on Hand

`results/summary.json`, `results/runs.json`, `results/hours-coverage.json`, `data/llm/*` (stored model outputs). Absent: user testimonials, usage data. Do not fabricate.

## Product Principles

1. Show the check, not the claim: every stop carries its verification state.
2. Unknown is a state, never silently "open".
3. The evidence lives in the product.
4. Fast and offline-capable: no spinners for data that is already local.

## Accessibility & Inclusion

Keyboard operable, visible focus, colour never the only signal, reduced-motion respected, readable on a phone.
