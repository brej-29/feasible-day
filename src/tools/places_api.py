from __future__ import annotations

from typing import Any, Dict, List, Optional

import requests

from src.agents.models import Place
from src.tools.geo_utils import get_city_bounds
from src.utils.config import AppConfig
from src.utils.logger import get_logger

_LOGGER = get_logger("tools.places")


def _safe_get(url: str, params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Perform a GET request and return decoded JSON on success.

    Any network or decoding errors are logged and result in ``None``.
    """
    try:
        response = requests.get(url, params=params, timeout=30)
        if response.status_code != 200:
            _LOGGER.warning(
                "GET %s failed with status %s: %s",
                url,
                response.status_code,
                response.text,
            )
            return None
        return response.json()
    except Exception as exc:  # noqa: BLE001
        _LOGGER.error("GET %s failed: %s", url, exc)
        return None


def search_attractions_opentripmap(
    config: AppConfig,
    city: str,
    latitude: float,
    longitude: float,
    *,
    limit: int = 40,
) -> List[Place]:
    """
    Search for attractions using the OpenTripMap API.

    The exact OpenTripMap API contract is subject to change; this function
    aims to be resilient to minor schema differences and falls back to an
    empty list on errors.

    Parameters
    ----------
    config:
        Application configuration (allows use of an API key if available).
    city:
        City name, used in logging only.
    latitude, longitude:
        Center point around which to search.
    limit:
        Maximum number of places to return.

    Returns
    -------
    list[Place]
        List of attractions discovered.
    """
    url = "https://api.opentripmap.com/0.1/en/places/radius"
    params: Dict[str, Any] = {
        "radius": 8000,
        "lon": longitude,
        "lat": latitude,
        "rate": 2,
        "format": "json",
        "limit": limit,
        "kinds": "interesting_places",
    }
    if config.opentripmap_api_key:
        params["apikey"] = config.opentripmap_api_key

    data = _safe_get(url, params)
    if data is None:
        return []

    places: List[Place] = []
    for item in data:
        name = item.get("name") or ""
        if not name:
            continue
        point = item.get("point") or {}
        lat = float(point.get("lat", latitude))
        lon = float(point.get("lon", longitude))
        kinds = item.get("kinds", "")
        place = Place(
            name=name,
            type="attraction",
            description="Attraction from OpenTripMap.",
            rating=0.0,
            latitude=lat,
            longitude=lon,
            address=city,
            category=kinds,
        )
        places.append(place)
    return places


def search_shopping_areas(
    config: AppConfig,
    city: str,
    city_info: Dict[str, Any],
    *,
    limit: int = 20,
) -> List[Place]:
    """
    Search for shopping-related areas using OpenTripMap.

    Parameters
    ----------
    config:
        Application configuration.
    city:
        City name.
    city_info:
        Geocoded city information, including bounding box.

    Returns
    -------
    list[Place]
        Shopping-related places such as markets, malls, or commercial streets.
    """
    bounds = get_city_bounds(city_info)
    url = "https://api.opentripmap.com/0.1/en/places/bbox"
    params: Dict[str, Any] = {
        "lon_min": bounds["west"],
        "lon_max": bounds["east"],
        "lat_min": bounds["south"],
        "lat_max": bounds["north"],
        "kinds": "shops,shopping_malls,markets",
        "limit": limit,
        "format": "json",
    }
    if config.opentripmap_api_key:
        params["apikey"] = config.opentripmap_api_key

    data = _safe_get(url, params)
    if data is None:
        return []

    places: List[Place] = []
    for item in data:
        name = item.get("name") or ""
        if not name:
            continue
        point = item.get("point") or {}
        lat = float(point.get("lat", city_info["latitude"]))
        lon = float(point.get("lon", city_info["longitude"]))
        place = Place(
            name=name,
            type="shopping",
            description="Shopping location from OpenTripMap.",
            rating=0.0,
            latitude=lat,
            longitude=lon,
            address=city,
            category=item.get("kinds", ""),
        )
        places.append(place)
    return places


def search_restaurants_google_places(
    config: AppConfig,
    city: str,
    latitude: float,
    longitude: float,
    *,
    limit: int = 30,
) -> List[Place]:
    """
    Search for restaurants using the Google Places API.

    If a Google Places API key is not configured, this function returns an
    empty list and allows the caller to fall back to other sources.

    Parameters
    ----------
    config:
        Application configuration (must include a Google Places key).
    city:
        City name (used in logging and as part of the query).
    latitude, longitude:
        Center point for the search.
    limit:
        Maximum number of restaurants to return.

    Returns
    -------
    list[Place]
        Restaurants discovered by the API or an empty list on failure.
    """
    api_key = config.google_places_api_key
    if not api_key:
        _LOGGER.info("Google Places API key not configured; skipping restaurant search.")
        return []

    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    params = {
        "location": f"{latitude},{longitude}",
        "radius": 5000,
        "type": "restaurant",
        "key": api_key,
    }
    data = _safe_get(url, params)
    if data is None:
        return []

    results = data.get("results", [])
    places: List[Place] = []
    for item in results[:limit]:
        name = item.get("name") or ""
        if not name:
            continue
        geometry = item.get("geometry", {}).get("location", {})
        lat = float(geometry.get("lat", latitude))
        lon = float(geometry.get("lng", longitude))
        rating = float(item.get("rating", 0.0) or 0.0)
        address = item.get("vicinity") or item.get("formatted_address") or city
        place = Place(
            name=name,
            type="restaurant",
            description="Restaurant from Google Places.",
            rating=rating,
            latitude=lat,
            longitude=lon,
            address=address,
            category="restaurant",
        )
        places.append(place)
    return places


def fallback_places_for_city(city: str) -> List[Place]:
    """
    Provide a small, hardcoded set of well-known places for major cities.

    This function is used when external APIs fail or rate limits are hit.
    The goal is not exhaustive coverage but rather a graceful degradation.
    """
    key = city.strip().lower()
    places: List[Place] = []

    if key == "paris":
        places.extend(
            [
                Place(
                    name="Eiffel Tower",
                    type="attraction",
                    description="Iconic iron tower with panoramic city views.",
                    rating=4.8,
                    latitude=48.8584,
                    longitude=2.2945,
                    address="Champ de Mars, 5 Avenue Anatole France, 75007 Paris, France",
                    category="landmark",
                ),
                Place(
                    name="Louvre Museum",
                    type="attraction",
                    description="World-famous art museum housing the Mona Lisa.",
                    rating=4.7,
                    latitude=48.8606,
                    longitude=2.3376,
                    address="Rue de Rivoli, 75001 Paris, France",
                    category="museum",
                ),
            ]
        )
    elif key == "tokyo":
        places.extend(
            [
                Place(
                    name="Shibuya Crossing",
                    type="attraction",
                    description="One of the busiest pedestrian crossings in the world.",
                    rating=4.6,
                    latitude=35.6595,
                    longitude=139.7005,
                    address="Shibuya City, Tokyo, Japan",
                    category="city_view",
                ),
                Place(
                    name="Senso-ji Temple",
                    type="attraction",
                    description="Historic Buddhist temple in Asakusa.",
                    rating=4.7,
                    latitude=35.7148,
                    longitude=139.7967,
                    address="2 Chome-3-1 Asakusa, Taito City, Tokyo, Japan",
                    category="temple",
                ),
            ]
        )

    # Additional hardcoded cities can be added here as needed.

    return places