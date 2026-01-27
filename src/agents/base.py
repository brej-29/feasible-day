from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Mapping

from src.utils.config import AppConfig
from src.utils.logger import get_logger


class BaseAgent(ABC):
    """
    Base class for all agents in the City Travel Microguide system.

    Agents follow a simple contract:
    - They receive the shared state (a mapping-like object).
    - They may read from and write to the state.
    - They must return the updated state.

    Concrete agents will be implemented in Prompt 2. This class focuses on:
    - Providing access to configuration and logging.
    - Defining the common `run` interface.
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
    def run(self, state: Mapping[str, Any]) -> Mapping[str, Any]:
        """
        Execute the agent logic on the provided state.

        Concrete agents must implement this method.

        Parameters
        ----------
        state:
            The shared application state at the time this agent is invoked.

        Returns
        -------
        Mapping[str, Any]
            The updated state after the agent has completed its work.
        """
        raise NotImplementedError("Subclasses must implement `run`.")