"""
Agent package for the City Travel Microguide application.

This module exposes the LangGraph supervisor and base agent abstractions.
Concrete agents will be implemented in Prompt 2.
"""

from .supervisor import AgentState, run_supervisor  # noqa: F401
from .base import BaseAgent  # noqa: F401