from __future__ import annotations

from typing import Any, List, MutableMapping

import requests

from src.agents.base_agent import BaseAgent
from src.agents.models import Day, InputPreferences, ItineraryPlan, TimeSlot
from src.utils.prompts import ITINERARY_PLANNER_PROMPT


class ItineraryPlannerAgent(BaseAgent):
    """
    Agent responsible for turning preferences into a structured daily itinerary.

    Responsibilities
    ----------------
    - Build a simple, realistic schedule for each day (morning/afternoon/evening).
    - Ensure a balanced pace across days.
    - Optionally use Groq to generate high-level notes summarizing the trip.

    Outputs added to state
    ----------------------
    itinerary_plan:
        Dict representation of :class:`ItineraryPlan`.
    itinerary:
        A simplified list of dictionaries suitable for direct display in the UI.
    errors:
        Appended with any non-fatal issues.
    """

    def __init__(self, config) -> None:
        super().__init__(
            name="itinerary_planner",
            description="Create a day-by-day itinerary skeleton.",
            config=config,
        )

    def _build_local_plan(self, preferences: InputPreferences) -> ItineraryPlan:
        """
        Build a deterministic baseline itinerary using simple heuristics.

        This keeps the pipeline robust and testable even if the Groq call
        fails, while still leaving room for LLM-based refinement.
        """
        interests_str = ", ".join(preferences.interests) or "mixed interests"
        days: List[Day] = []
        for index in range(preferences.days):
            label = f"Day {index + 1}"
            morning = TimeSlot(
                time="09:00–12:00",
                activity=f"Morning exploration in {preferences.city} (focus on {interests_str}).",
                notes="Start in a central, walkable neighborhood to get oriented.",
            )
            afternoon = TimeSlot(
                time="13:00–17:00",
                activity=f"Deep dive into museums, cultural sites, or key attractions.",
                notes="Group nearby places to minimise travel time.",
            )
            evening = TimeSlot(
                time="18:30–21:30",
                activity="Dinner and evening stroll based on your preferred neighborhoods.",
                notes=(
                    "Aim for restaurants that match your budget and interests; "
                    "consider booking popular spots in advance."
                ),
            )
            days.append(Day(date=label, morning=morning, afternoon=afternoon, evening=evening))
        return ItineraryPlan(city=preferences.city, days=days, notes="")

    def _call_groq_for_notes(self, preferences: InputPreferences, plan: ItineraryPlan) -> str:
        """
        Ask Groq to summarise and slightly refine the itinerary in natural language.

        Failures are logged and result in an empty string so that the rest of
        the pipeline can proceed unaffected.
        """
        try:
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {self.config.groq_api_key}",
                "Content-Type": "application/json",
            }
            messages = [
                {"role": "system", "content": ITINERARY_PLANNER_PROMPT},
                {
                    "role": "user",
                    "content": (
                        "Here are the user preferences and a draft itinerary as JSON. "
                        "Write a short paragraph explaining the pacing and structure "
                        "of the trip in friendly language.\n\n"
                        f"Preferences:\n{preferences.model_dump_json(indent=2)}\n\n"
                        f"Itinerary:\n{plan.model_dump_json(indent=2)}"
                    ),
                },
            ]
            payload = {
                "model": self.config.groq_default_model,
                "messages": messages,
                "temperature": 0.4,
                "max_tokens": 256,
            }
            response = requests.post(url, headers=headers, json=payload, timeout=45)
            if response.status_code != 200:
                self.logger.warning(
                    "Groq itinerary notes call failed with status %s: %s",
                    response.status_code,
                    response.text,
                )
                return ""
            data = response.json()
            return (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
            )
        except Exception as exc:  # noqa: BLE001
            self.logger.warning("Groq itinerary notes call failed: %s", exc)
            return ""

    def run(self, state: MutableMapping[str, Any]) -> MutableMapping[str, Any]:
        errors = self._ensure_errors_list(state)

        raw_prefs = state.get("preferences")
        if not isinstance(raw_prefs, dict):
            msg = "Itinerary planner requires normalized preferences in state['preferences']."
            self.logger.error(msg)
            errors.append(msg)
            state["errors"] = errors
            return state

        try:
            preferences = InputPreferences.model_validate(raw_prefs)
        except Exception as exc:  # noqa: BLE001
            msg = "Itinerary planner could not parse preferences."
            self.logger.error("%s Details: %s", msg, exc)
            errors.append(msg)
            state["errors"] = errors
            return state

        plan = self._build_local_plan(preferences)
        notes = self._call_groq_for_notes(preferences, plan)
        if notes:
            plan.notes = notes

        # Store structured itinerary in the state.
        state["itinerary_plan"] = plan.model_dump()

        # Also create a simplified itinerary representation for direct UI display.
        simplified: list[dict[str, Any]] = []
        for index, day in enumerate(plan.days, start=1):
            summary_parts = [
                f"Morning: {day.morning.activity}",
                f"Afternoon: {day.afternoon.activity}",
                f"Evening: {day.evening.activity}",
            ]
            simplified.append(
                {
                    "day": index,
                    "title": day.date,
                    "summary": " | ".join(summary_parts),
                }
            )
        state["itinerary"] = simplified
        state["errors"] = errors
        return state