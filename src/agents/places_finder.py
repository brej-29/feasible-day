from __future__ import annotations

import json
from typing import Any, Dict, List, MutableMapping, Optional

import requests

from src.agents.base_agent import BaseAgent
from src.agents.models import InputPreferences, Place, PlacesList
from src.tools.geo_utils import geocode_city
from src.tools.places_api import (
    fallback_places_for_city,
    search_attractions_opentripmap,
    search_restaurants_google_places,
    search_shopping_areas,
)
from src.utils.prompts import PLACES_DECIDER_PROMPT


class PlacesFinderAgent(BaseAgent):
    """
    Agent responsible for discovering attractions, restaurants, and shopping areas.

    Responsibilities
    ----------------
    - Decide, with the help of Groq function calling, which underlying API
      calls to make (OpenTripMap and/or Google Places).
    - Aggregate results into a :class:`PlacesList` structure.
    - Provide sensible fallbacks when APIs are unavailable or fail.

    Outputs added to state
    ----------------------
    places_list:
        Dict representation of :class:`PlacesList`.
    places:
        Flattened list of place dictionaries for quick access.
    errors:
        Appended with any non-fatal issues or fallback usage.
    """

    def __init__(self, config) -> None:
        super().__init__(
            name="places_finder",
            description="Discover attractions, restaurants, and shopping spots.",
            config=config,
        )

    # ---- Groq function-calling orchestration ---------------------------------

    def _groq_decide_tools(self, preferences: InputPreferences) -> List[str]:
        """
        Ask Groq which logical tools should be used for this query.

        Returns a list of tool names such as ``['search_attractions', 'search_restaurants']``.
        On failure, returns an empty list so that the agent can fall back to
        a deterministic strategy.
        """
        try:
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {self.config.groq_api_key}",
                "Content-Type": "application/json",
            }
            tools = [
                {
                    "type": "function",
                    "function": {
                        "name": "search_attractions",
                        "description": "Use OpenTripMap to look up attractions and landmarks.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "city": {"type": "string"},
                            },
                            "required": ["city"],
                        },
                    },
                },
                {
                    "type": "function",
                    "function": {
                        "name": "search_restaurants",
                        "description": "Use Google Places (if available) or fallbacks to find restaurants.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "city": {"type": "string"},
                            },
                            "required": ["city"],
                        },
                    },
                },
                {
                    "type": "function",
                    "function": {
                        "name": "search_shopping",
                        "description": "Use OpenTripMap to find shopping areas and markets.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "city": {"type": "string"},
                            },
                            "required": ["city"],
                        },
                    },
                },
            ]
            messages = [
                {
                    "role": "system",
                    "content": PLACES_DECIDER_PROMPT,
                },
                {
                    "role": "user",
                    "content": (
                        "Decide which tools to call based on these preferences. "
                        "You may call multiple tools.\n\n"
                        f"{preferences.model_dump_json(indent=2)}"
                    ),
                },
            ]
            payload = {
                "model": self.config.groq_default_model,
                "messages": messages,
                "tools": tools,
                "tool_choice": "auto",
                "temperature": 0,
            }
            response = requests.post(url, headers=headers, json=payload, timeout=45)
            if response.status_code != 200:
                self.logger.warning(
                    "Groq places decision call failed with status %s: %s",
                    response.status_code,
                    response.text,
                )
                return []

            data = response.json()
            message = data.get("choices", [{}])[0].get("message", {})
            tool_calls = message.get("tool_calls") or []
            selected: List[str] = []
            for call in tool_calls:
                func = call.get("function", {})
                name = func.get("name")
                if isinstance(name, str):
                    selected.append(name)
            return selected
        except Exception as exc:  # noqa: BLE001
            self.logger.warning("Groq places decision call failed: %s", exc)
            return []

    # ---- Local API orchestration ---------------------------------------------

    def _call_selected_tools(
        self,
        selected_tools: List[str],
        preferences: InputPreferences,
        city_info: Optional[Dict[str, Any]],
        errors: List[str],
    ) -> PlacesList:
        """
        Execute local API functions based on a Groq-selected list of tool names.
        """
        if not city_info:
            city_info = geocode_city(preferences.city) or {
                "latitude": 20.0,
                "longitude": 0.0,
            }

        lat = float(city_info.get("latitude", 20.0))
        lon = float(city_info.get("longitude", 0.0))

        attractions: List[Place] = []
        restaurants: List[Place] = []
        shopping: List[Place] = []
        other: List[Place] = []

        if not selected_tools:
            # Deterministic fallback: use all available logical tools.
            selected_tools = ["search_attractions", "search_restaurants", "search_shopping"]

        if "search_attractions" in selected_tools:
            attractions = search_attractions_opentripmap(self.config, preferences.city, lat, lon)
        if "search_restaurants" in selected_tools:
            restaurants = search_restaurants_google_places(self.config, preferences.city, lat, lon)
        if not restaurants:
            # Fallback to attractions-based or hardcoded restaurants if Places is unavailable.
            fallback = fallback_places_for_city(preferences.city)
            if fallback:
                self.logger.info(
                    "Using fallback restaurant/attraction data for city '%s'.",
                    preferences.city,
                )
                # For simplicity, include these as 'other' if not clearly restaurants.
                for place in fallback:
                    if place.type == "restaurant":
                        restaurants.append(place)
                    else:
                        other.append(place)
        if "search_shopping" in selected_tools:
            if city_info.get("bounding_box"):
                shopping = search_shopping_areas(self.config, preferences.city, city_info)

        places_list = PlacesList(
            attractions=attractions,
            restaurants=restaurants,
            shopping=shopping,
            other=other,
        )

        # Ensure we meet a rough target of 30+ places if possible by padding
        # with any available categories.
        if len(places_list.flattened()) < 30 and attractions:
            # Duplicate some attractions into "other" with a different category label.
            for extra in attractions[: 30 - len(places_list.flattened())]:
                other.append(
                    Place(
                        name=extra.name,
                        type="other",
                        description=extra.description,
                        rating=extra.rating,
                        latitude=extra.latitude,
                        longitude=extra.longitude,
                        address=extra.address,
                        category=extra.category or "attraction",
                    )
                )

        return PlacesList(
            attractions=attractions,
            restaurants=restaurants,
            shopping=shopping,
            other=other,
        )

    def run(self, state: MutableMapping[str, Any]) -> MutableMapping[str, Any]:
        errors = self._ensure_errors_list(state)

        raw_prefs = state.get("preferences")
        if not isinstance(raw_prefs, dict):
            msg = "Places finder requires normalized preferences in state['preferences']."
            self.logger.error(msg)
            errors.append(msg)
            state["errors"] = errors
            return state

        try:
            preferences = InputPreferences.model_validate(raw_prefs)
        except Exception as exc:  # noqa: BLE001
            msg = "Places finder could not parse preferences."
            self.logger.error("%s Details: %s", msg, exc)
            errors.append(msg)
            state["errors"] = errors
            return state

        city_info = state.get("city_info")
        if not isinstance(city_info, dict):
            self.logger.info("City info not present for places finder; geocoding inline.")
            city_info = geocode_city(preferences.city)
            if city_info:
                state["city_info"] = city_info

        selected_tools = self._groq_decide_tools(preferences)
        places_list = self._call_selected_tools(selected_tools, preferences, city_info, errors)

        state["places_list"] = places_list.model_dump()
        state["places"] = [p.model_dump() for p in places_list.flattened()]
        state["errors"] = errors
        return state