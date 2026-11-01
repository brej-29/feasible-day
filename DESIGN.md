# Design system: Feasible Day

Derived from the shipped app (`src/app/styles.css`), not from intentions. Mode: Operate (a planning tool). World: Swiss hiking signposts (Wanderweg), plus hatching borrowed from a darkroom exposure record.

## Colour

| Token | Value | Job |
| --- | --- | --- |
| `--plate` | `#ffd21f` | Signpost yellow: control bar, transfer arms, stop markers, "ours" bar |
| `--ink` | `#14181c` | Text, rules, header, selected states |
| `--ink-2` | `#4a5560` | Secondary text (contrast on white 7.6:1) |
| `--ground` / `--paper` | `#f3f5f6` / `#fff` | App ground, panels |
| `--ok` / `--ok-bg` | `#14783a` / `#e4f3ea` | Hours checked and open |
| `--bad` / `--bad-bg` | `#b3261e` / `#fbe7e5` | Closed, transfer too short, errors, interval whiskers |
| `--unk` | `#5a5030` on hatch | Hours unverified (never colour alone: always hatched and labelled) |

Light theme only. Scene: someone planning a day at a desk or on a phone in daylight. A dark theme is not built.

## Type

Barlow (body, 400 to 700) and Barlow Condensed (headings, signs, numerals, 600 and 700), self-hosted through Fontsource. Tabular numerals everywhere. Headings are condensed bold; signpost arms are condensed bold caps with 0.04em tracking.

## Signature elements

- **Signpost arm**: yellow plate with a five-point arrow clip, destination left, walking minutes and km right, between every pair of stops.
- **Hatch**: diagonal 135 degree hatching means "not verified". Used on the day ruler, map pins, chips and the compare view.
- **Day ruler**: 09:00 to 21:00 strip, one bar per stop, solid when hours were checked.
- **Waymark diamond**: brand mark, favicon and map pin shape.

## Components

Standard controls only: select, segmented radio group, date input, tabs, table, definition list. Segmented control: 2px ink border, selected = ink fill with yellow text. Rulebook: bordered list with pass or fail mark and a verdict tag.

## Motion

One authored moment: rows rise and arms slide in with a short stagger (exponential ease-out); ruler bars grow from the left; chart bars grow once. Everything is disabled under `prefers-reduced-motion`.

## Layout

Desktop: 470px plan column and fluid map, controls bar above, tabs in the header. Under 860px the map is its own tab; under 520px the controls collapse into a two-column grid. States designed: loading skeleton, empty or sparse city, data load error with recovery text, no-evidence fallback.
