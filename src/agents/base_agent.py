from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Mapping, MutableMapping

from src.utils.config import AppConfig
from src.utils.logger import get_logger


class BaseAgent(ABC):
    """
    Base class for all agents in the City Travel Microguide system.

    Agents operate over a shared mutable state (a dictionary-like object)
    managed by LangGraph. Each agent:

    - Receives the current state.
    - May read from and write to that state.
    - Returns the updated state.

    Concrete agents must implement :meth:`run`.
    """

    def __init__(self, name: str, description: str, config: AppConfig) -> None:
        """
        Initialize a new agent.

        Parameters
        ----------
        name:
            Short identifier for the agent, used in logs and debugging.
        description:
            Human-readable description of the agent's responsibility.
        config:
            Application configuration object.
        """
        self.name = name
        self.description = description
        self.config = config
        self.logger = get_logger(f"agent.{self.name}")

    @abstractmethod
    def run(self, state: MutableMapping[str, Any]) -> MutableMapping[str, Any]:
        """
        Execute the agent logic on the provided state.

        Parameters
        ----------
        state:
            Shared, mutable state at the time this agent is invoked.

        Returns
        -------
        MutableMapping[str, Any]
            The updated state after the agent has completed its work.
        """
        raise NotImplementedError("Subclasses must implement `run`.")

    def _ensure_errors_list(self, state: MutableMapping[str, Any]) -> list[str]:
        """
        Ensure that the ``errors`` key exists in the state and return it.

        Agents should use this helper to record non-fatal issues so that the
        UI can surface them to the user while the pipeline continues.
        """
        errors = state.get("errors")
        if not isinstance(errors, list):
            errors = []
            state["errors"] = errors
        return errors