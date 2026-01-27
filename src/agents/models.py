from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class InputPreferences(BaseModel):
    """
    Normalized user preferences used throughout the agent pipeline.

    This model is similar to the UI-level ``UserPreferences`` dataclass
    but adds structure suitable for downstream agents and tools.
    """

    city: str = Field(..., description="Target city name.")
    days: int = Field(..., ge=1, le=30, description="Number of days in the trip.")
    transportation: str = Field(
        ...,
        description="Primary transportation mode (e.g. walking, metro, car, mixed).",
    )
    interests: List[str] = Field(
        default_factory=list,
        description="List of user interests such as food, art, history.",
    )
    budget: str = Field(
        ...,
        description="Budget level (budget, moderate, luxury).",
    )


class TimeSlot(BaseModel):
    """
    Represents a block of time in a day with a planned activity.
    """

    time: str = Field(..., description="Human-readable time range, e.g. 09:00–12:00.")
    activity: str = Field(..., description="Short description of the activity.")
    place: Optional[str] = Field(
        default=None,
        description="Optional name of the primary place associated with this slot.",
    )
    notes: Optional[str] = Field(
        default=None,
        description="Additional notes or tips for this time slot.",
    )


class Day(BaseModel):
    """
    A single day in the itinerary, broken into time slots.
    """

    date: str = Field(..., description="Label for the day, e.g. 'Day 1'.")
    morning: TimeSlot
    afternoon: TimeSlot
    evening: TimeSlot


class ItineraryPlan(BaseModel):
    """
    High-level itinerary covering all days of the trip.
    """

    city: str = Field(..., description="Target city for this itinerary.")
    days: List[Day] = Field(default_factory=list)
    notes: str = Field(
        default="",
        description="Free-form notes or rationale behind the itinerary structure.",
    )


class Place(BaseModel):
    """
    A single point of interest such as an attraction, restaurant, or shop.
    """

    name: str
    type: str = Field(
        ...,
        description="High-level type: attraction, restaurant, shopping, hotel, other.",
    )
    description: str = ""
    rating: float = 0.0
    latitude: float
    longitude: float
    address: str = ""
    category: str = Field(
        "",
        description=(
            "Semantic category such as museums_art, parks, street_food, "
            "shopping_streets, etc."
        ),
    )


class PlacesList(BaseModel):
    """
    Aggregated list of places grouped by category for easier consumption.

    The top-level lists are tuned to align with how the UI and content
    formatter present information to the user.
    """

    attractions: List[Place] = Field(default_factory=list)
    restaurants: List[Place] = Field(default_factory=list)
    shopping: List[Place] = Field(default_factory=list)
    other: List[Place] = Field(default_factory=list)

    def flattened(self) -> List[Place]:
        """
        Return all places as a single list, preserving their type/category.
        """
        return [
            *self.attractions,
            *self.restaurants,
            *self.shopping,
            *self.other,
        ]