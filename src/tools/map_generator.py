from __future__ import annotations

from typing import Any, Dict, Optional

import folium

from src.agents.models import PlacesList
from src.utils.logger import get_logger

_LOGGER = get_logger("tools.map")


_COLOR_BY_TYPE = {
    "attraction": "#0066cc",  # blue
    "restaurant": "#cc0000",  # red
    "shopping": "#00cc00",  # green
    "hotel": "#ffcc00",  # yellow
    "other": "#666666",
}


def _determine_center(places: PlacesList, city_info: Optional[Dict[str, Any]]) -> tuple[float, float]:
    if city_info:
        return float(city_info.get("latitude", 20.0)), float(city_info.get("longitude", 0.0))

    all_places = places.flattened()
    if not all_places:
        return 20.0, 0.0

    lat = sum(p.latitude for p in all_places) / len(all_places)
    lon = sum(p.longitude for p in all_places) / len(all_places)
    return lat, lon


def create_map(places_data: Dict[str, Any], city_info: Optional[Dict[str, Any]] = None) -> folium.Map:
    """
    Create an interactive Folium map populated with markers for all places.

    Parameters
    ----------
    places_data:
        Dictionary representation of :class:`PlacesList`.
    city_info:
        Optional dictionary containing city-level information, including
        latitude and longitude as returned by :func:`geocode_city`.

    Returns
    -------
    folium.Map
        A Folium map instance ready to be embedded via ``streamlit-folium``.
    """
    try:
        places = PlacesList.model_validate(places_data)
    except Exception as exc:  # noqa: BLE001
        _LOGGER.error("Failed to parse PlacesList for map generation: %s", exc)
        places = PlacesList()

    center_lat, center_lon = _determine_center(places, city_info)
    fmap = folium.Map(location=[center_lat, center_lon], zoom_start=12)

    for place in places.flattened():
        color = _COLOR_BY_TYPE.get(place.type, _COLOR_BY_TYPE["other"])
        popup_lines = [
            f"<b>{place.name}</b>",
            f"Type: {place.type.capitalize()}",
        ]
        if place.rating:
            popup_lines.append(f"Rating: {place.rating:.1f}")
        if place.address:
            popup_lines.append(place.address)
        html_popup = "<br>".join(popup_lines)

        folium.CircleMarker(
            location=[place.latitude, place.longitude],
            radius=6,
            color=color,
            fill=True,
            fill_color=color,
            fill_opacity=0.8,
            popup=folium.Popup(html_popup, max_width=300),
        ).add_to(fmap)

    return fmap