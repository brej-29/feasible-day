from __future__ import annotations

import time
from typing import Any, Dict, Optional

import requests

from src.utils.logger import get_logger

_LOGGER = get_logger("tools.geo")


# Basic cache to avoid repeated geocoding calls during a single session.
_GEOCODE_CACHE: dict[str, Dict[str, Any]] = {}


_HARDCODED_CITIES: dict[str, Dict[str, Any]] = {
    "paris": {
        "latitude": 48.8566,
        "longitude": 2.3522,
        "display_name": "Paris, France",
        "bounding_box": {"north": 48.902, "south": 48.815, "east": 2.469, "west": 2.224},
    },
    "tokyo": {
        "latitude": 35.6762,
        "longitude": 139.6503,
        "display_name": "Tokyo, Japan",
        "bounding_box": {"north": 35.817, "south": 35.528, "east": 139.915, "west": 139.562},
    },
    "new york": {
        "latitude": 40.7128,
        "longitude": -74.006,
        "display_name": "New York City, USA",
        "bounding_box": {"north": 40.917, "south": 40.477, "east": -73.7, "west": -74.259},
    },
    "london": {
        "latitude": 51.5074,
        "longitude": -0.1278,
        "display_name": "London, United Kingdom",
        "bounding_box": {"north": 51.672, "south": 51.384, "east": 0.148, "west": -0.351},
    },
    "mexico city": {
        "latitude": 19.4326,
        "longitude": -99.1332,
        "display_name": "Mexico City, Mexico",
        "bounding_box": {"north": 19.592, "south": 19.243, "east": -98.95, "west": -99.30},
    },
}


def _from_hardcoded(city: str) -> Optional[Dict[str, Any]]:
    key = city.strip().lower()
    return _HARDCODED_CITIES.get(key)


def geocode_city(city: str) -> Optional[Dict[str, Any]]:
    """
    Resolve a city name to approximate coordinates using Nominatim.

    This function is deliberately conservative in its usage of the public
    Nominatim API (1 request/second recommendation) and falls back to
    a small list of hardcoded major cities when necessary.

    Parameters
    ----------
    city:
        The city name entered by the user.

    Returns
    -------
    dict | None
        Dictionary with keys ``latitude``, ``longitude``, ``display_name``,
        and ``bounding_box`` if resolution succeeded; otherwise ``None``.
    """
    normalized = city.strip()
    if not normalized:
        return None

    if normalized in _GEOCODE_CACHE:
        return _GEOCODE_CACHE[normalized]

    hardcoded = _from_hardcoded(normalized)
    if hardcoded is not None:
        _GEOCODE_CACHE[normalized] = hardcoded
        return hardcoded

    try:
        url = "https://nominatim.openstreetmap.org/search"
        params = {
            "q": normalized,
            "format": "json",
            "limit": 1,
        }
        headers = {
            "User-Agent": "city-travel-microguide/1.0 (https://github.com/brej-29)",
        }

        # Respect Nominatim's recommended minimum delay between requests.
        time.sleep(1.0)

        response = requests.get(url, params=params, headers=headers, timeout=30)
        if response.status_code != 200:
            _LOGGER.warning(
                "Geocoding request failed with status %s: %s",
                response.status_code,
                response.text,
            )
            return hardcoded

        data = response.json()
        if not data:
            _LOGGER.warning("Geocoding returned no results for city '%s'.", normalized)
            return hardcoded

        first = data[0]
        lat = float(first.get("lat"))
        lon = float(first.get("lon"))
        bbox = first.get("boundingbox", [])
        if len(bbox) == 4:
            south, north, west, east = bbox
            bounding_box = {
                "north": float(north),
                "south": float(south),
                "east": float(east),
                "west": float(west),
            }
        else:
            bounding_box = {
                "north": lat + 0.1,
                "south": lat - 0.1,
                "east": lon + 0.1,
                "west": lon - 0.1,
            }

        result = {
            "latitude": lat,
            "longitude": lon,
            "display_name": first.get("display_name", normalized),
            "bounding_box": bounding_box,
        }
        _GEOCODE_CACHE[normalized] = result
        return result
    except Exception as exc:  # noqa: BLE001
        _LOGGER.error("Geocoding failed for '%s': %s", normalized, exc)
        return hardcoded


def get_city_bounds(city_info: Dict[str, Any]) -> Dict[str, float]:
    """
    Extract a canonical bounding box from a ``city_info`` dictionary.

    Parameters
    ----------
    city_info:
        Dictionary as returned by :func:`geocode_city`.

    Returns
    -------
    dict[str, float]
        Dictionary with keys ``north``, ``south``, ``east``, and ``west``.
    """
    bbox = city_info.get("bounding_box") or {}
    north = float(bbox.get("north", city_info.get("latitude", 0.0) + 0.1))
    south = float(bbox.get("south", city_info.get("latitude", 0.0) - 0.1))
    east = float(bbox.get("east", city_info.get("longitude", 0.0) + 0.1))
    west = float(bbox.get("west", city_info.get("longitude", 0.0) - 0.1))
    return {"north": north, "south": south, "east": east, "west": west}