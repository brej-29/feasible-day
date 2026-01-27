# System Architecture

## Overview

The City Travel Microguide application is a **Streamlit front-end** backed by a
**LangGraph-based multi-agent orchestration layer**. It integrates with
external APIs (Groq, OpenTripMap, Google Places, OpenStreetMap/Nominatim) to
generate a personalized city guide consisting of:

- A day-by-day itinerary.
- A set of curated places with metadata.
- An interactive Folium map.
- A narrative travel guide.

This document describes the **high-level architecture**, **agent roles**, **data
models**, and **error-handling strategies** from user input to final outputs.

---

## High-Level Components

- **Streamlit UI (`app.py`)**
  - Presents form inputs in the sidebar.
  - Displays itinerary, map, and travel guide.
  - Handles input validation and user-facing error messages.
  - Orchestrates calls into the LangGraph supervisor.

- **LangGraph Supervisor (`src/agents/supervisor.py`)**
  - Owns the shared `AgentState` typed dictionary.
  - Defines the graph of four concrete agents plus the supervising workflow.
  - Compiles and runs the graph to produce a final state.

- **Agents (`src/agents/`)**
  - `BaseAgent` class (in `base_agent.py`) defines the contract for all agents.
  - Four specialised agents:
    1. `InputProcessorAgent` (`input_processor.py`)
    2. `PlacesFinderAgent` (`places_finder.py`)
    3. `ItineraryPlannerAgent` (`itinerary_planner.py`)
    4. `ContentFormatterAgent` (`content_formatter.py`)

- **Models (`src/agents/models.py`)**
  - Pydantic models used across agents:
    - `InputPreferences`
    - `TimeSlot`, `Day`, `ItineraryPlan`
    - `Place`, `PlacesList`

- **Tools (`src/tools/`)**
  - `geo_utils.py`
    - Geocoding via Nominatim (`geocode_city`) with hardcoded fallbacks.
    - City bounding box calculation (`get_city_bounds`).
  - `places_api.py`
    - OpenTripMap search for attractions and shopping.
    - Google Places search for restaurants.
    - Hardcoded fallback places for major cities.
  - `map_generator.py`
    - Folium map generation with colour-coded markers from `PlacesList`.

- **Utilities (`src/utils/`)**
  - `config.py`: Environment-driven configuration and Pydantic validation.
  - `logger.py`: Centralised logging configuration (console + file).
  - `validators.py`: Input validation and normalization for UI fields.
  - `prompts.py`: System prompts for each agent and orchestration task.

- **Constants (`src/constants/`)**
  - `categories.py`: Shared interest and place categories.

- **Context Docs (`context/`)**
  - `PROJECT_GOAL.md`, `ARCHITECTURE.md`, `IMPLEMENTATION_LOG.md`, `LOCAL_SETUP.md`, `DEPLOYMENT_GUIDE.md`.

---

## Agent Flow Diagram (ASCII)

```text
+-----------------------------+
|    Streamlit UI (app.py)   |
|  - Collects user inputs    |
|  - Shows results           |
+-------------+--------------+
              |
              v
      +-------+--------+
      | LangGraph      |
      | Supervisor     |
      | (AgentState)   |
      +-------+--------+
              |
              v
   +----------+-----------+
   | InputProcessorAgent  |
   | - Normalise inputs   |
   | - Geocode city       |
   +----------+-----------+
              |
              v
   +----------+-----------+
   | PlacesFinderAgent    |
   | - Decide tools via   |
   |   Groq function call |
   | - OpenTripMap,      |
   |   Google Places,    |
   |   fallbacks         |
   +----------+-----------+
              |
              v
   +----------+-----------+
   | ItineraryPlannerAgent|
   | - Build daily plan   |
   | - Groq for notes     |
   +----------+-----------+
              |
              v
   +----------+-----------+
   | ContentFormatterAgent|
   | - Groq Markdown guide|
   | - Template fallback  |
   +----------+-----------+
              |
              v
      +-------+--------+
      | Final AgentState|
      +-------+--------+
              |
  +-----------+---------------------------+
  | Streamlit UI renders:                |
  | - Itinerary (state['itinerary'])     |
  | - Map (create_map(...))             |
  | - Guide (state['travel_guide'])     |
  +--------------------------------------+
```

---

## Agent Responsibilities

The design uses four concrete agents plus the LangGraph supervisor as the
coordinating “fifth agent”.

### 1. InputProcessorAgent (`input_processor.py`)

- **Input**
  - Raw fields from `AgentState`:
    - `city`, `days`, `transportation`, `interests`, `budget`, `advanced_preferences`.
- **Responsibilities**
  - Construct and validate an `InputPreferences` model.
  - Geocode the city via `geocode_city` (Nominatim + hardcoded fallbacks).
  - Optionally call Groq with `INPUT_PROCESSOR_PROMPT` for a sanity-check of inputs (advisory only).
- **Output**
  - `state["preferences"]` — serialised `InputPreferences`.
  - `state["city_info"]` — geocoding result.
  - Appends advisory messages to `state["errors"]` when appropriate.

### 2. PlacesFinderAgent (`places_finder.py`)

- **Input**
  - Normalised `preferences` and `city_info`.
- **Responsibilities**
  - Use Groq tool/function-calling (`PLACES_DECIDER_PROMPT`) to decide which logical tools to execute:
    - `search_attractions` → OpenTripMap (via `search_attractions_opentripmap`).
    - `search_restaurants` → Google Places (via `search_restaurants_google_places`).
    - `search_shopping` → OpenTripMap (via `search_shopping_areas`).
  - Perform the corresponding API calls using `src/tools/places_api.py`.
  - Apply `fallback_places_for_city` when APIs are unavailable or return no data.
  - Aim for a rich set of places (target: 30+ combined).
- **Output**
  - `state["places_list"]` — serialised `PlacesList`.
  - `state["places"]` — flattened list of all places for convenience.
  - Non-fatal issues (e.g., fallback usage) appended to `state["errors"]`.

### 3. ItineraryPlannerAgent (`itinerary_planner.py`)

- **Input**
  - Normalised `preferences`.
- **Responsibilities**
  - Build a deterministic baseline itinerary (`ItineraryPlan`):
    - One `Day` per trip day.
    - Each day with `TimeSlot`s for morning, afternoon, and evening.
  - Optionally use Groq (text-only call, `ITINERARY_PLANNER_PROMPT`) to generate high-level itinerary notes describing pacing and structure.
- **Output**
  - `state["itinerary_plan"]` — serialised `ItineraryPlan`.
  - `state["itinerary"]` — simplified list of days (title + summary) for display in Streamlit.

### 4. ContentFormatterAgent (`content_formatter.py`)

- **Input**
  - `preferences`, `itinerary_plan`, `places_list`, and optional `city_info`.
- **Responsibilities**
  - Call Groq with `CONTENT_FORMATTER_PROMPT` to generate a Markdown travel guide.
  - If the call fails, fall back to a template-based Markdown generator.
  - Keep the guide concise, structured, and mobile-friendly.
- **Output**
  - `state["travel_guide"]` — Markdown travel guide string.
  - Adds explanatory error when the fallback template is used.

---

## Data Models (Pydantic)

Located in `src/agents/models.py`:

- `InputPreferences`
  - `city: str`
  - `days: int`
  - `transportation: str`
  - `interests: list[str]`
  - `budget: str`

- `TimeSlot`
  - `time: str`
  - `activity: str`
  - `place: Optional[str]`
  - `notes: Optional[str]`

- `Day`
  - `date: str`
  - `morning: TimeSlot`
  - `afternoon: TimeSlot`
  - `evening: TimeSlot`

- `ItineraryPlan`
  - `city: str`
  - `days: list[Day]`
  - `notes: str`

- `Place`
  - `name: str`
  - `type: str` (attraction, restaurant, shopping, hotel, other)
  - `description: str`
  - `rating: float`
  - `latitude: float`
  - `longitude: float`
  - `address: str`
  - `category: str`

- `PlacesList`
  - `attractions: list[Place]`
  - `restaurants: list[Place]`
  - `shopping: list[Place]`
  - `other: list[Place]`
  - `flattened()` helper to return all places in one list.

---

## AgentState (LangGraph State)

`AgentState` (in `src/agents/supervisor.py`) is a `TypedDict` capturing the
shared state across the pipeline.

Key fields:

- **Raw inputs (from UI)**
  - `city: str`
  - `days: int`
  - `transportation: str`
  - `interests: list[str]`
  - `budget: str`
  - `advanced_preferences: dict[str, Any]`

- **Derived structured data**
  - `preferences: dict[str, Any]` — serialised `InputPreferences`.
  - `city_info: dict[str, Any]` — result of `geocode_city`.
  - `places_list: dict[str, Any]` — serialised `PlacesList`.
  - `places: list[dict[str, Any]]` — flattened list of all places.
  - `itinerary_plan: dict[str, Any]` — serialised `ItineraryPlan`.
  - `itinerary: list[dict[str, Any]]` — simplified day summaries for UI.

- **Final outputs**
  - `travel_guide: str` — Markdown travel guide.
  - `map_data: dict[str, Any]` — reserved for future map metadata.

- **Diagnostics**
  - `errors: list[str]` — non-fatal issues encountered during processing.

---

## Tools & API Integration

### Geocoding (`src/tools/geo_utils.py`)

- `geocode_city(city: str) -> dict | None`
  - Uses OpenStreetMap Nominatim `/search` endpoint.
  - Returns latitude, longitude, display name, and bounding box.
  - Respects 1 request/second (sleep) and uses a friendly User-Agent.
  - Falls back to a set of hardcoded city coordinates when necessary.
- `get_city_bounds(city_info: dict) -> dict`
  - Converts bounding box into `{north, south, east, west}`.

### Places APIs (`src/tools/places_api.py`)

- `search_attractions_opentripmap(config, city, lat, lon, limit=40) -> list[Place]`
  - OpenTripMap `/places/radius` for attractions and landmarks.
- `search_shopping_areas(config, city, city_info, limit=20) -> list[Place]`
  - OpenTripMap `/places/bbox` for shopping-related locations.
- `search_restaurants_google_places(config, city, lat, lon, limit=30) -> list[Place]`
  - Google Places `/nearbysearch` for restaurants (if API key configured).
- `fallback_places_for_city(city) -> list[Place]`
  - Small curated list of landmarks for major cities when remote APIs fail.

### Map Generation (`src/tools/map_generator.py`)

- `create_map(places_data: dict, city_info: dict | None) -> folium.Map`
  - Parses a `PlacesList` dict and produces a Folium map.
  - Determines the map centre from `city_info` or average place coordinates.
  - Uses colour-coded circle markers:
    - Attraction: `#0066cc` (blue)
    - Restaurant: `#cc0000` (red)
    - Shopping: `#00cc00` (green)
    - Hotel: `#ffcc00` (yellow)
    - Other: grey
  - Popups show name, type, rating, and address.

The Streamlit app embeds this map using `streamlit-folium`.

---

## Error Handling Strategy & Graceful Degradation

Error handling occurs at multiple levels:

1. **Input Validation (UI layer)**
   - `src/utils/validators.py` ensures:
     - City is non-empty and well-formed.
     - Days are between 1 and 30.
     - Transportation, budget, and interests are supported values.
   - Invalid inputs are reported via `st.error()` and prevent pipeline runs.

2. **Configuration Validation (`config.py`)**
   - `AppConfig` validates:
     - `GROQ_API_KEY` is present and non-empty.
     - `APP_ENV`, `GROQ_DEFAULT_MODEL`, `APP_DEBUG` are sane.
   - `try_load_config()` returns a user-friendly error message if configuration
     is invalid, which the UI displays.

3. **Agents and Tools**
   - Every agent uses `_ensure_errors_list(state)` and catches its own
     exceptions where appropriate.
   - External API errors (Groq, Google Places, OpenTripMap, Nominatim) are:
     - Logged with details.
     - Converted into partial results or fallbacks.
   - The pipeline continues whenever possible, producing best-effort output.

4. **Logging**
   - All unexpected issues are logged via `get_logger()`:
     - To file: `logs/app.log` (locally).
     - To stdout/stderr: visible in Streamlit Cloud logs.

The user sees helpful messages in the UI’s “Planner notes” section instead
of hard failures.

---

## Performance Considerations

- **API calls**
  - Groq calls are kept short with conservative `max_tokens`.
  - Places APIs (OpenTripMap & Google Places) are used in a limited, targeted way.
  - Geocoding uses caching and rate-limiting to respect Nominatim guidelines.

- **Caching (future work)**
  - The current implementation does not use Streamlit caching decorators.
  - For higher load, you can cache:
    - `geocode_city` results.
    - Places API queries for popular cities.

- **Session state**
  - Minimal use of `st.session_state` to store:
    - Last preferences.
    - Last pipeline state.
  - Keeps memory usage reasonable.

- **Scalability**
  - Designed primarily as a portfolio/demo app.
  - For heavier traffic, consider:
    - Adding more aggressive caching.
    - Offloading long-running API calls.
    - Splitting into microservices if necessary.

---

## Deployment Architecture

- **Runtime**: Streamlit Community Cloud (Python environment).
- **Frontend**: Streamlit app served from `app.py`.
- **Backend**: In-process Python code (no separate microservices).
- **External Services**:
  - Groq API for all LLM calls (input processor, itinerary notes, content formatter, places decider).
  - OpenTripMap and Google Places for place data.
  - OpenStreetMap/Nominatim for geocoding.
- **Configuration**:
  - `.env` in local development.
  - Streamlit secrets or environment variables in production.

This architecture keeps infrastructure overhead minimal while still
demonstrating a powerful, multi-agent AI application with external API
integration and rich map-based output.