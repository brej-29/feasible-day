from __future__ import annotations

from typing import Any, Dict, MutableMapping, Optional

import requests

from src.agents.base_agent import BaseAgent
from src.agents.models import InputPreferences, ItineraryPlan, PlacesList
from src.utils.prompts import CONTENT_FORMATTER_PROMPT


class ContentFormatterAgent(BaseAgent):
    """
    Agent responsible for turning itinerary and places into a readable guide.

    Responsibilities
    ----------------
    - Combine preferences, itinerary, and places into a Markdown travel guide.
    - Use Groq to write structured content when available.
    - Provide a sensible template-based fallback when LLM calls fail.

    Outputs added to state
    ----------------------
    travel_guide:
        Markdown string representing the full guide.
    """

    def __init__(self, config) -> None:
        super().__init__(
            name="content_formatter",
            description="Compile structured data into a human-friendly travel guide.",
            config=config,
        )

    def _call_groq_markdown(
        self,
        preferences: InputPreferences,
        itinerary: ItineraryPlan,
        places: PlacesList,
        city_info: Optional[Dict[str, Any]],
    ) -> Optional[str]:
        """
        Ask Groq to generate a Markdown travel guide.

        Returns
        -------
        str | None
            Generated Markdown, or ``None`` if the call failed.
        """
        try:
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {self.config.groq_api_key}",
                "Content-Type": "application/json",
            }
            content_payload = {
                "preferences": preferences.model_dump(),
                "itinerary": itinerary.model_dump(),
                "places": places.model_dump(),
                "city_info": city_info or {},
            }
            messages = [
                {"role": "system", "content": CONTENT_FORMATTER_PROMPT},
                {
                    "role": "user",
                    "content": (
                        "Generate a concise but rich Markdown travel guide for this trip. "
                        "Use headings and bullet points. Here is the structured data:\n\n"
                        f"{content_payload}"
                    ),
                },
            ]
            payload = {
                "model": self.config.groq_default_model,
                "messages": messages,
                "temperature": 0.6,
                "max_tokens": 1200,
            }
            response = requests.post(url, headers=headers, json=payload, timeout=60)
            if response.status_code != 200:
                self.logger.warning(
                    "Groq content formatter call failed with status %s: %s",
                    response.status_code,
                    response.text,
                )
                return None
            data = response.json()
            content = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
            )
            return content or None
        except Exception as exc:  # noqa: BLE001
            self.logger.warning("Groq content formatter call failed: %s", exc)
            return None

    def _fallback_markdown(
        self,
        preferences: InputPreferences,
        itinerary: ItineraryPlan,
        places: PlacesList,
    ) -> str:
        """
        Template-based Markdown guide used when the LLM is unavailable.
        """
        interests = ", ".join(preferences.interests) or "a mix of interests"
        lines: list[str] = []
        lines.append(f"# {preferences.city} — {preferences.days}-Day Microguide")
        lines.append("")
        lines.append("## Trip overview")
        lines.append("")
        lines.append(f"- **Primary interests:** {interests}")
        lines.append(f"- **Budget level:** {preferences.budget.capitalize()}")
        lines.append(f"- **Transportation:** {preferences.transportation.capitalize()}")
        lines.append("")
        lines.append("## Day-by-day itinerary")
        lines.append("")
        for day in itinerary.days:
            lines.append(f"### {day.date}")
            lines.append("")
            lines.append(f"- **Morning:** {day.morning.activity}")
            lines.append(f"- **Afternoon:** {day.afternoon.activity}")
            lines.append(f"- **Evening:** {day.evening.activity}")
            lines.append("")
        lines.append("## Highlighted places")
        lines.append("")
        if places.attractions:
            lines.append("### Top attractions")
            for p in places.attractions[:10]:
                lines.append(f"- **{p.name}** — {p.description or 'Attraction'}")
            lines.append("")
        if places.restaurants:
            lines.append("### Suggested restaurants")
            for p in places.restaurants[:10]:
                lines.append(f"- **{p.name}** — {p.address or 'Restaurant'}")
            lines.append("")
        if places.shopping:
            lines.append("### Shopping areas")
            for p in places.shopping[:10]:
                lines.append(f"- **{p.name}** — {p.address or 'Shopping area'}")
            lines.append("")
        lines.append(
            "This guide was generated automatically. In the next iteration, "
            "it will be refined further by specialised AI agents."
        )
        return "\n".join(lines)

    def run(self, state: MutableMapping[str, Any]) -> MutableMapping[str, Any]:
        errors = self._ensure_errors_list(state)

        raw_prefs = state.get("preferences")
        raw_itinerary = state.get("itinerary_plan")
        raw_places = state.get("places_list")

        if not isinstance(raw_prefs, dict) or not isinstance(raw_itinerary, dict) or not isinstance(
            raw_places, dict
        ):
            msg = (
                "Content formatter requires preferences, itinerary_plan, and "
                "places_list in the state."
            )
            self.logger.error(msg)
            errors.append(msg)
            state["errors"] = errors
            return state

        try:
            preferences = InputPreferences.model_validate(raw_prefs)
            itinerary = ItineraryPlan.model_validate(raw_itinerary)
            places = PlacesList.model_validate(raw_places)
        except Exception as exc:  # noqa: BLE001
            msg = "Content formatter could not parse structured data."
            self.logger.error("%s Details: %s", msg, exc)
            errors.append(msg)
            state["errors"] = errors
            return state

        city_info = state.get("city_info") if isinstance(state.get("city_info"), Dict) else None
        guide = self._call_groq_markdown(preferences, itinerary, places, city_info)
        if guide is None:
            guide = self._fallback_markdown(preferences, itinerary, places)
            errors.append(
                "The travel guide was generated using a simplified template due to "
                "temporary issues calling the AI writer."
            )

        state["travel_guide"] = guide
        state["errors"] = errors
        return state