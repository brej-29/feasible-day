from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Sequence


class InputValidationError(ValueError):
    """
    Raised when user-provided input fails validation.

    The Streamlit UI surfaces the message from this exception directly
    to the user via ``st.error``.
    """


@dataclass(frozen=True)
class UserPreferences:
    """
    Normalized and validated user preferences captured from the UI.

    Attributes
    ----------
    city:
        Target city name.
    days:
        Number of days in the trip.
    transportation:
        Preferred transportation mode.
    interests:
        List of selected high-level interests.
    budget:
        Budget level.
    advanced_notes:
        Free-form notes or advanced options, if any.
    """

    city: str
    days: int
    transportation: str
    interests: List[str]
    budget: str
    advanced_notes: str | None = None


_ALLOWED_TRANSPORTATION = {"walking", "metro", "car", "mixed"}
_ALLOWED_BUDGETS = {"budget", "moderate", "luxury"}
_ALLOWED_INTERESTS = {"food", "art", "shopping", "outdoors", "history", "culture"}

_CITY_PATTERN = re.compile(r"^[A-Za-zÀ-ÿ0-9 .,'-]{2,100}$")


def validate_city_name(city: str) -> str:
    """
    Validate and normalize the city name.

    Parameters
    ----------
    city:
        Raw city string from the UI.

    Returns
    -------
    str
        Trimmed and validated city name.

    Raises
    ------
    InputValidationError
        If the city name is empty or has an invalid format.
    """
    value = (city or "").strip()
    if not value:
        raise InputValidationError("Please enter a city name.")
    if not _CITY_PATTERN.match(value):
        raise InputValidationError(
            "City name should only contain letters, numbers, spaces, and basic punctuation."
        )
    return value


def validate_days(days: int) -> int:
    """
    Validate the number of days for the trip.

    Parameters
    ----------
    days:
        Number of days selected in the UI.

    Returns
    -------
    int
        The validated number of days.

    Raises
    ------
    InputValidationError
        If the value is outside the supported range.
    """
    if not 1 <= days <= 30:
        raise InputValidationError("Number of days must be between 1 and 30.")
    return days


def validate_transportation(transportation: str) -> str:
    """
    Validate the selected transportation option.

    Parameters
    ----------
    transportation:
        Transportation value from the UI.

    Returns
    -------
    str
        Normalized lowercase transportation string.

    Raises
    ------
    InputValidationError
        If the value is not one of the allowed options.
    """
    value = (transportation or "").strip().lower()
    if value not in _ALLOWED_TRANSPORTATION:
        raise InputValidationError("Please select a valid transportation option.")
    return value


def validate_budget(budget: str) -> str:
    """
    Validate the selected budget level.

    Parameters
    ----------
    budget:
        Budget value from the UI.

    Returns
    -------
    str
        Normalized lowercase budget string.

    Raises
    ------
    InputValidationError
        If the value is not one of the allowed options.
    """
    value = (budget or "").strip().lower()
    if value not in _ALLOWED_BUDGETS:
        raise InputValidationError("Please select a valid budget level.")
    return value


def validate_interests(interests: Sequence[str]) -> List[str]:
    """
    Validate the list of user interests.

    Parameters
    ----------
    interests:
        Iterable of interests selected in the UI.

    Returns
    -------
    list[str]
        Normalized list of interests.

    Raises
    ------
    InputValidationError
        If no interests are selected or an invalid value is present.
    """
    if not interests:
        raise InputValidationError("Please select at least one interest.")
    normalized = {str(i).strip().lower() for i in interests if str(i).strip()}
    if not normalized:
        raise InputValidationError("Please select at least one valid interest.")
    invalid = normalized - _ALLOWED_INTERESTS
    if invalid:
        raise InputValidationError(
            "One or more selected interests are not supported by this application."
        )
    return sorted(normalized)


def validate_user_preferences(
    city: str,
    days: int,
    transportation: str,
    interests: Sequence[str],
    budget: str,
    advanced_notes: str | None = None,
) -> UserPreferences:
    """
    Validate all user inputs collected from the Streamlit form.

    Parameters
    ----------
    city:
        Raw city string from the UI.
    days:
        Number of days selected.
    transportation:
        Transportation option.
    interests:
        Collection of selected interests.
    budget:
        Selected budget level.
    advanced_notes:
        Optional free-form notes.

    Returns
    -------
    UserPreferences
        A fully validated and normalized user preferences object.

    Raises
    ------
    InputValidationError
        If any field fails validation.
    """
    return UserPreferences(
        city=validate_city_name(city),
        days=validate_days(days),
        transportation=validate_transportation(transportation),
        interests=validate_interests(interests),
        budget=validate_budget(budget),
        advanced_notes=(advanced_notes or "").strip() or None,
    )