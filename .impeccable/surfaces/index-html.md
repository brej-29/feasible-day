---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: []
---

# Surface: Feasible Day app (index)

Mode: Operate (a planning tool). Visitor: hiring manager or traveller, wants a verifiable walking day in seconds and the evidence behind it.
Open decisions: dark theme (not built; light only). Stack: static React + Vite + Leaflet.

## Direction contract

THESIS: A day plan is a walk, so it is drawn as the thing walkers already trust: trail signposts. Every transfer is a signpost arm with a destination and walking minutes; the refused arrangement is the chat-bubble itinerary and the grey SaaS dashboard.

OWN-WORLD: Swiss Wanderweg signage. Signpost yellow plates (#FFD21F) with ink-black (#14181C) lettering on a cool off-white ground; Barlow / Barlow Condensed set like road-sign type with tabular numerals; state colours only where they mean something: verified green, closed red, unverified shown as diagonal hatch (borrowed from a darkroom exposure record, where hatch density marks load and crossing hatches mark conflict). Diamond waymark as the brand mark and the stop marker. Hairline-ruled, dense, aligned.

STORY: The visitor picks a city, a profile and a weekday, and within a second sees a timed plan whose every stop says whether its hours were checked. They believe it works because the rulebook panel shows six passing checks computed live, and the Evidence tab shows measured LLM-only failure next to it. They leave knowing the numbers and where they are weak.

FIRST VIEWPORT: Top bar with diamond mark, name, and three tabs (Plan, Evidence, Method). Under it a controls row: City select, Profile segmented control, Day segmented control, Days stepper. Left column (about 440px): day summary strip (stops, walk km, verified count) then the timeline of stop rows separated by yellow signpost arms ("Sainte-Chapelle  7 min"). Right: Leaflet map, numbered diamond markers, dashed route. Rulebook checks sit under the summary. Primary action: changing a control re-plans instantly.

FORM: Code-led Operate shell; signature move = the signpost-arm transfer between stops, plus hatched time bars for unverified hours. Position 5 of my list. seed: ad6ac138eb15a1ab

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
