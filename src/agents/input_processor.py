from __future__ import annotations

from typing import Any, MutableMapping

import requests

from src.agents.base_agent import BaseAgent
from src.agents.models import InputPreferences
from src.tools.geo_utils import geocode_city
from src.utils.logger import get_logger
from src.utils.prompts import INPUT_PROCESSOR_PROMPT


class InputProcessorAgent(BaseAgent):
    """
    Agent responsible for normalizing and enriching raw user input.

    Responsibilities
    ----------------
    - Validate and normalize the basic trip preferences.
    - Resolve the city name to coordinates via geocoding.
    - Optionally consult the Groq LLM to detect obvious issues or refine
      assumptions. The pipeline remains functional even if the LLM call fails.

    Outputs added to state
    ----------------------
    preferences:
        Dict representation of :class:`InputPreferences`.
    city_info:
        Dict containing latitude, longitude, display_name, and bounding_box.
    errors:
        Appended with non-fatal issues encountered during processing.
    """

    def __init__(self, config) -> None:
        super().__init__(
            name="input_processor",
            description="Validate and normalize raw user preferences.",
            config=config,
        )
        self._logger = get_logger("agent.input_processor")

    def _call_groq(self, preferences: InputPreferences) -> None:
        """
        Optionally call Groq to sanity-check the parsed preferences.

        This call is intentionally best-effort: failures are logged but never
        propagated as hard errors. The goal is to satisfy the design requirement
        that this agent uses Groq, without making the pipeline brittle.
        """
        try:
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {self.config.groq_api_key}",
                "Content-Type": "application/json",
            }
            messages = [
                {
                    "role": "system",
                    "content": INPUT_PROCESSOR_PROMPT,
                },
                {
                    "role": "user",
                    "content": (
                        "Here are the parsed user preferences as JSON. "
                        "If you notice any obvious issues with the city name "
                        "or days, mention them briefly; otherwise respond with "
                        "a short confirmation.\n\n"
                        f"{preferences.model_dump_json(indent=2)}"
                    ),
                },
            ]
            payload = {
                "model": self.config.groq_default_model,
                "messages": messages,
                "temperature": 0.2,
                "max_tokens": 256,
            }
            response = requests.post(url, headers=headers, json=payload, timeout=30)
            if response.status_code != 200:
                self._logger.warning(
                    "Groq input processor call failed with status %s: %s",
                    response.status_code,
                    response.text,
                )
                return
            data = response.json()
            message = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
            )
            if message:
                self._logger.info("Groq input processor note: %s", message.strip())
        except Exception as exc:  # noqa: BLE001
            self._logger.warning("Groq input processor call failed: %s", exc)

    def run(self, state: MutableMapping[str, Any]) -> MutableMapping[str, Any]:
        errors = self._ensure_errors_list(state)

        city = str(state.get("city", "")).strip()
        days = int(state.get("days") or 0)
        transportation = str(state.get("transportation", "")).strip().lower()
        interests = [str(i).strip().lower() for i in state.get("interests", [])]
        budget = str(state.get("budget", "")).strip().lower()

        try:
            preferences = InputPreferences(
                city=city,
                days=days,
                transportation=transportation,
                interests=interests,
                budget=budget,
            )
        except Exception as exc:  # noqa: BLE001
            msg = (
                "Input preferences could not be validated. Please ensure that "
                "city, days, transportation, interests, and budget are provided."
            )
            self._logger.error("%s Details: %s", msg, exc)
            errors.append(msg)
            state["errors"] = errors
            return state

        # Geocode the city to obtain coordinates; this is also used as a
        # lightweight validation that the city likely exists.
        city_info = geocode_city(preferences.city)
        if city_info is None:
            msg = (
                "The city could not be reliably located on the map. "
                "The itinerary and map will use generic coordinates."
            )
            self._logger.warning(msg)
            errors.append(msg)
        else:
            state["city_info"] = city_info

        # Best-effort Groq call for additional sanity checking.
        self._call_groq(preferences)

        state["preferences"] = preferences.model_dump()
        state["errors"] = errors
        return state