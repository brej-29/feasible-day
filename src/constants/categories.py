"""
Domain-specific categories and simple enumerations for places and interests.

These categories are intentionally coarse-grained. They serve as a shared
vocabulary between:
- The Streamlit user interface
- Agents that curate places and build itineraries
- Map generation utilities

The exact mapping from user-facing interest labels to external API categories
(OpenTripMap, Google Places, etc.) will be implemented in Prompt 2.
"""

from __future__ import annotations

from typing import Dict, List


# High-level interests exposed in the Streamlit UI.
INTEREST_LABELS: List[str] = [
    "food",
    "art",
    "shopping",
    "outdoors",
    "history",
    "culture",
]

# Internal mapping from interest labels to semantic place categories.
# These values are deliberately descriptive rather than tied to any one API.
PLACE_CATEGORIES_BY_INTEREST: Dict[str, List[str]] = {
    "food": [
        "restaurants",
        "cafes",
        "street_food",
        "markets",
    ],
    "art": [
        "galleries",
        "museums_art",
        "street_art",
        "design_spaces",
    ],
    "shopping": [
        "shopping_streets",
        "malls",
        "boutiques",
        "markets",
    ],
    "outdoors": [
        "parks",
        "viewpoints",
        "waterfronts",
        "urban_trails",
    ],
    "history": [
        "historic_sites",
        "monuments",
        "museums_history",
        "old_town",
    ],
    "culture": [
        "theaters",
        "live_music",
        "cultural_centers",
        "festivals",
    ],
}

# Supported transportation modes.
TRANSPORTATION_MODES: List[str] = ["walking", "metro", "car", "mixed"]

# Supported budget levels.
BUDGET_LEVELS: List[str] = ["budget", "moderate", "luxury"]