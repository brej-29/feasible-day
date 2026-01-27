from __future__ import annotations

from typing import Any, Dict, List, Optional, TypedDict

from langgraph.graph import END, StateGraph

from src.utils.config import AppConfig
from src.utils.logger import get_logger


class AgentState(TypedDict, total=False):
    """
    Shared state passed between agents in the LangGraph workflow.

    This format is intentionally broad enough to support all five agents
    that will be implemented in Prompt 2.

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
    places:
        List of places of interest discovered by research agents.
        The exact schema will be defined in Prompt 2.
    itinerary:
        Structured itinerary data, typically a list of day entries.
    travel_guide:
        Narrative travel guide text.
    map_data:
        Data structure to support map rendering (e.g. markers, bounds).
    errors:
        A list of errors or warnings produced by agents.
    """

    city: str
    days: int
    transportation: str
    interests: List[str]
    budget: str
    advanced_preferences: Dict[str, Any]

    places: List[Dict[str, Any]]
    itinerary: List[Dict[str, Any]]
    travel_guide: str
    map_data: Dict[str, Any]
    errors: List[str]


def _build_graph(config: AppConfig) -> Any:
    """
    Build the LangGraph StateGraph for the microguide workflow.

    At this foundation stage the graph is intentionally minimal and does not
    perform any LLM or external API calls. It simply passes the state through
    unchanged. In Prompt 2, this function will be extended to wire in the five
    specialist agents.

    Parameters
    ----------
    config:
        Application configuration. Currently unused but accepted to ensure
        forwards compatibility when agents are introduced.

    Returns
    -------
    Any
        A compiled LangGraph application that can be invoked with an AgentState.
    """
    logger = get_logger("graph.supervisor")
    graph: StateGraph = StateGraph(AgentState)

    def entry_node(state: AgentState) -> AgentState:
        """
        Initial node for the LangGraph workflow.

        For now, it simply ensures that the `errors` list exists and logs that
        the full agent pipeline has not yet been implemented.
        """
        updated_state: AgentState = dict(state)
        errors: List[str] = list(updated_state.get("errors", []))
        info_message = (
            "LangGraph supervisor pipeline is in foundation mode. "
            "No agents have been executed yet; this will be extended in Prompt 2."
        )
        logger.info(info_message)
        errors.append(
            "Detailed itinerary generation will be enabled once agents are "
            "implemented in the next development phase."
        )
        updated_state["errors"] = errors
        return updated_state

    graph.add_node("entry", entry_node)
    graph.set_entry_point("entry")
    graph.add_edge("entry", END)

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
        The final state after the (currently minimal) graph has been executed.
    """
    if initial_state is None:
        initial_state = AgentState(
            city="",
            days=0,
            transportation="",
            interests=[],
            budget="",
            advanced_preferences={},
            places=[],
            itinerary=[],
            travel_guide="",
            map_data={},
            errors=[],
        )

    app = _build_graph(config)
    final_state: AgentState = app.invoke(initial_state)
    return final_state