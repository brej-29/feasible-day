from __future__ import annotations

from typing import Any, Optional

import streamlit as st
from streamlit_folium import st_folium

from src.agents.supervisor import AgentState, run_supervisor
from src.tools.map_generator import create_map
from src.constants.categories import (
    BUDGET_LEVELS,
    INTEREST_LABELS,
    TRANSPORTATION_MODES,
)
from src.utils.config import ConfigLoadResult, try_load_config
from src.utils.logger import get_logger
from src.utils.validators import (
    InputValidationError,
    UserPreferences,
    validate_user_preferences,
)


logger = get_logger("app")


def _initialize_session_state() -> None:
    """
    Initialize common keys in Streamlit's session state.

    This ensures that the application can safely reference these keys
    throughout a user's session without repetitive existence checks.
    """
    defaults: dict[str, Any] = {
        "last_preferences": None,
        "last_state": None,
    }
    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value


def _render_sidebar(config_result: ConfigLoadResult) -> tuple[Optional[UserPreferences], bool]:
    """
    Render the sidebar input form and return validated user preferences.

    Parameters
    ----------
    config_result:
        Result of attempting to load application configuration. If an error
        occurred, a warning is displayed in the sidebar.

    Returns
    -------
    tuple[Optional[UserPreferences], bool]
        - The validated preferences if submission was successful, otherwise ``None``.
        - A boolean indicating whether the form was submitted.
    """
    with st.sidebar:
        st.title("City Travel Microguide")

        if config_result.error:
            st.warning(
                "Configuration issue detected. The planner may not be able to "
                "use AI services until environment variables are correctly set."
            )

        st.markdown("### Trip setup")

        with st.form("trip_form", clear_on_submit=False):
            city = st.text_input(
                "City",
                value=st.session_state.get("city", ""),
                placeholder="e.g., Tokyo, Paris, Mexico City",
                key="city",
            )

            days = st.slider(
                "Number of days",
                min_value=1,
                max_value=30,
                value=int(st.session_state.get("days", 3) or 3),
                key="days",
            )

            transportation = st.selectbox(
                "Preferred transportation",
                options=TRANSPORTATION_MODES,
                index=TRANSPORTATION_MODES.index(
                    st.session_state.get("transportation", "mixed")
                    if st.session_state.get("transportation", "mixed") in TRANSPORTATION_MODES
                    else TRANSPORTATION_MODES[-1]
                ),
                format_func=lambda x: x.capitalize(),
                key="transportation",
            )

            interests = st.multiselect(
                "Interests",
                options=INTEREST_LABELS,
                default=st.session_state.get("interests", ["food", "culture"]),
                format_func=lambda x: x.capitalize(),
                key="interests",
                help="Choose what you care most about on this trip.",
            )

            budget = st.selectbox(
                "Budget level",
                options=BUDGET_LEVELS,
                index=BUDGET_LEVELS.index(
                    st.session_state.get("budget", "moderate")
                    if st.session_state.get("budget", "moderate") in BUDGET_LEVELS
                    else BUDGET_LEVELS[1]
                ),
                format_func=lambda x: x.capitalize(),
                key="budget",
            )

            show_advanced = st.checkbox(
                "Show advanced options",
                value=st.session_state.get("show_advanced", False),
                key="show_advanced",
            )

            advanced_notes: Optional[str] = None
            if show_advanced:
                advanced_notes = st.text_area(
                    "Advanced preferences (optional)",
                    value=st.session_state.get("advanced_notes", ""),
                    placeholder=(
                        "Share any constraints or preferences, e.g.:\n"
                        "- Early riser / night owl\n"
                        "- Must-see neighborhoods or landmarks\n"
                        "- Mobility considerations\n"
                    ),
                    key="advanced_notes",
                )

            submitted = st.form_submit_button("Generate microguide")

        if not submitted:
            return None, False

        try:
            preferences = validate_user_preferences(
                city=city,
                days=days,
                transportation=transportation,
                interests=interests,
                budget=budget,
                advanced_notes=advanced_notes,
            )
        except InputValidationError as exc:
            st.error(str(exc))
            return None, True

        return preferences, True


def _create_placeholder_itinerary(preferences: UserPreferences) -> list[dict[str, Any]]:
    """
    Create a simple, deterministic placeholder itinerary.

    This is used until full agent logic is implemented. It gives users a sense
    of structure without performing any real planning.
    """
    summary_interests = ", ".join(preferences.interests)
    base_day_plan = (
        f"Explore {preferences.city} with a focus on {summary_interests} "
        f"at a {preferences.budget} budget, primarily using {preferences.transportation}."
    )

    return [
        {
            "day": index + 1,
            "title": f"Day {index + 1} in {preferences.city}",
            "summary": base_day_plan,
        }
        for index in range(preferences.days)
    ]


def _create_placeholder_guide(preferences: UserPreferences) -> str:
    """
    Create a concise narrative guide summarizing the planned trip.
    """
    interests = ", ".join(preferences.interests)
    guide_lines = [
        f"You are planning a {preferences.days}-day trip to **{preferences.city}**.",
        "",
        f"- **Primary interests:** {interests}",
        f"- **Budget:** {preferences.budget.capitalize()}",
        f"- **Preferred transportation:** {preferences.transportation.capitalize()}",
    ]
    if preferences.advanced_notes:
        guide_lines.append("")
        guide_lines.append("Additional notes provided:")
        guide_lines.append(preferences.advanced_notes.strip())

    guide_lines.append("")
    guide_lines.append(
        "The detailed, AI-generated itinerary and travel tips will be enabled "
        "once the multi-agent planner is fully wired in."
    )

    return "\n".join(guide_lines)





def _render_results(
    preferences: UserPreferences,
    state: Optional[AgentState],
) -> None:
    """
    Render itinerary, map, and travel guide in the main area of the app.

    Parameters
    ----------
    preferences:
        Validated user preferences.
    state:
        Final agent state returned by the LangGraph supervisor.
    """
    itinerary: list[dict[str, Any]]
    travel_guide: str
    map_object = None

    if state and state.get("itinerary"):
        itinerary = state["itinerary"]
    else:
        itinerary = _create_placeholder_itinerary(preferences)

    if state and state.get("travel_guide"):
        travel_guide = state["travel_guide"]
    else:
        travel_guide = _create_placeholder_guide(preferences)

    # Attempt to build a rich Folium map using the discovered places.
    if state and state.get("places_list"):
        try:
            city_info = state.get("city_info") if isinstance(state.get("city_info"), dict) else None
            map_object = create_map(state["places_list"], city_info)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Map generation failed: %s", exc)
            map_object = None

    st.markdown("## Your city microguide")

    # Itinerary section
    st.markdown("### Itinerary overview")
    for day in itinerary:
        day_title = day.get("title") or f"Day {day.get('day', '?')}"
        summary = day.get("summary", "")
        st.markdown(f"**{day_title}**")
        if summary:
            st.write(summary)
        st.markdown("---")

    # Layout: map and guide side by side on wide screens.
    col_map, col_guide = st.columns((1.1, 1.0))

    with col_map:
        st.markdown("### Interactive map")
        if map_object is not None:
            st_folium(map_object, width=700, height=500)
        else:
            st.info(
                "Map data is not available yet. This may happen if external "
                "places APIs are temporarily unavailable."
            )

    with col_guide:
        st.markdown("### Travel guide")
        st.markdown(travel_guide)

    # Display any informational messages or errors collected in state.
    if state and state.get("errors"):
        st.markdown("### Planner notes")
        for message in state["errors"]:
            st.info(message)


def main() -> None:
    """
    Entry point for the Streamlit app.

    Responsible for:
    - Loading configuration.
    - Rendering the input sidebar.
    - Validating inputs.
    - Calling the LangGraph supervisor (skeleton in Prompt 1).
    - Displaying results and handling errors gracefully.
    """
    st.set_page_config(
        page_title="City Travel Microguide",
        page_icon="🗺️",
        layout="wide",
        initial_sidebar_state="expanded",
    )

    _initialize_session_state()

    config_result = try_load_config()
    preferences, submitted = _render_sidebar(config_result)

    st.markdown(
        """
        # City Travel Microguide

        Plan a tailored, multi-day city trip with an AI-powered microguide.
        Fill in your trip details in the sidebar and generate a structured
        itinerary, interactive map, and concise travel guide.
        """
    )

    if not submitted:
        st.info(
            "Start by entering a city, number of days, and your preferences "
            "in the sidebar, then click **Generate microguide**."
        )
        return

    if preferences is None:
        # Validation error already shown in the sidebar.
        st.warning("Please correct the highlighted issues in the sidebar and try again.")
        return

    st.session_state["last_preferences"] = preferences

    if config_result.config is None:
        st.error(
            "Configuration is incomplete, so the AI planner cannot run yet. "
            "You can still preview the structure of the itinerary, map, and guide."
        )
        _render_results(preferences, state=None)
        return

    config = config_result.config

    with st.spinner("Generating your city microguide..."):
        try:
            initial_state: AgentState = AgentState(
                city=preferences.city,
                days=preferences.days,
                transportation=preferences.transportation,
                interests=preferences.interests,
                budget=preferences.budget,
                advanced_preferences={"notes": preferences.advanced_notes} if preferences.advanced_notes else {},
                preferences={},
                city_info={},
                places_list={},
                places=[],
                itinerary_plan={},
                itinerary=[],
                travel_guide="",
                map_data={},
                errors=[],
            )
            state = run_supervisor(initial_state, config)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Unexpected error while running supervisor: %s", exc)
            st.error(
                "An unexpected error occurred while generating your microguide. "
                "Please try again in a moment."
            )
            _render_results(preferences, state=None)
            return

    st.session_state["last_state"] = state
    _render_results(preferences, state)


if __name__ == "__main__":
    main()