from __future__ import annotations

from typing import Any, Dict, List, Optional, TypedDict

from langgraph.graph import END, StateGraph

from src.agents.content_formatter import ContentFormatterAgent
from src.agents.input_processor import InputProcessorAgent
from src.agents.itinerary_planner import ItineraryPlannerAgent
from src.agents.places_finder import PlacesFinderAgent
from src.utils.config import AppConfig
from src.utils.logger import get_logger


class AgentState(TypedDict, total=False):
    """
    Shared state passed between agents in the LangGraph workflow.

    Keys
    ----
    city:
        Name of the city for which the microguide is generated.
    days:
        Number of days in the trip.
    transportation:
        Preferred primary transportation mode.
    interests:
        List of high-level interests such as "food", "art", etc.
    budget:
        Budget level, such as "budget", "moderate", "luxury".
    advanced_preferences:
        Arbitrary advanced options collected from the UI.

    preferences:
        Normalised preferences derived from the fields above.
    city_info:
        Geocoded information about the city (latitude, longitude, bounding box).

    places_list:
        Structured list of places grouped by category.
    places:
        Flattened list of places for convenience.

    itinerary_plan:
        Detailed itinerary as produced by the itinerary planner.
    itinerary:
        Simplified list of day summaries for UI display.

    travel_guide:
        Narrative travel guide text.

    map_data:
        Optional structure for map rendering (the app currently generates
        the Folium map directly rather than storing it here).

    errors:
        A list of errors or warnings produced by agents.
    """

    city: str
    days: int
    transportation: str
    interests: List[str]
    budget: str
    advanced_preferences: Dict[str, Any]

    preferences: Dict[str, Any]
    city_info: Dict[str, Any]

    places_list: Dict[str, Any]
    places: List[Dict[str, Any]]

    itinerary_plan: Dict[str, Any]
    itinerary: List[Dict[str, Any]]

    travel_guide: str
    map_data: Dict[str, Any]
    errors: List[str]


def _build_graph(config: AppConfig) -> Any:
    """
    Build the LangGraph StateGraph for the microguide workflow.

    The graph orchestrates three concrete agents in sequence after a simple
    entry node:

    1. InputProcessorAgent
       - Normalizes user preferences and resolves the city via geocoding.
    2. PlacesFinderAgent
       - Discovers attractions, restaurants, and shopping areas.
    3. ItineraryPlannerAgent
       - Builds a structured day-by-day itinerary.
    4. ContentFormatterAgent
       - Produces the final travel guide in Markdown.

    Parameters
    ----------
    config:
        Application configuration.

    Returns
    -------
    Any
        A compiled LangGraph application that can be invoked with an AgentState.
    """
    logger = get_logger("graph.supervisor")
    graph: StateGraph = StateGraph(AgentState)

    input_agent = InputProcessorAgent(config)
    places_agent = PlacesFinderAgent(config)
    itinerary_agent = ItineraryPlannerAgent(config)
    formatter_agent = ContentFormatterAgent(config)

    def entry_node(state: AgentState) -> AgentState:
        """
        Initial node for the LangGraph workflow.

        Ensures that the ``errors`` list exists and logs the start of the
        orchestration pipeline.
        """
        updated_state: AgentState = dict(state)
        errors: List[str] = list(updated_state.get("errors", []))
        logger.info("Starting microguide generation pipeline.")
        updated_state["errors"] = errors
        return updated_state

    def input_node(state: AgentState) -> AgentState:
        return input_agent.run(state)  # type: ignore[return-value]

    def places_node(state: AgentState) -> AgentState:
        return places_agent.run(state)  # type: ignore[return-value]

    def itinerary_node(state: AgentState) -> AgentState:
        return itinerary_agent.run(state)  # type: ignore[return-value]

    def formatter_node(state: AgentState) -> AgentState:
        return formatter_agent.run(state)  # type: ignore[return-value]

    graph.add_node("entry", entry_node)
    graph.add_node("input_processor", input_node)
    graph.add_node("places_finder", places_node)
    graph.add_node("itinerary_planner", itinerary_node)
    graph.add_node("content_formatter", formatter_node)

    graph.set_entry_point("entry")
    graph.add_edge("entry", "input_processor")
    graph.add_edge("input_processor", "places_finder")
    graph.add_edge("places_finder", "itinerary_planner")
    graph.add_edge("itinerary_planner", "content_formatter")
    graph.add_edge("content_formatter", END)

    app = graph.compile()
    return app


def run_supervisor(initial_state: Optional[AgentState], config: AppConfig) -> AgentState:
    """
    Run the LangGraph supervisor pipeline.

    Parameters
    ----------
    initial_state:
        The starting state for the workflow. If ``None`` is provided, a minimal
        default state will be constructed.
    config:
        Application configuration.

    Returns
    -------
    AgentState
        The final state after the graph has been executed.
    """
    if initial_state is None:
        initial_state = AgentState(
            city="",
            days=0,
            transportation="",
            interests=[],
            budget="",
            advanced_preferences={},
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

    app = _build_graph(config)
    final_state: AgentState = app.invoke(initial_state)
    return final_state