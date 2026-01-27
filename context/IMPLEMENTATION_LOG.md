# Implementation Log

This document records the key implementation steps and architectural decisions
taken during the development of the City Travel Microguide application.

---

## Prompt 1 – Foundation and Structure

**Goal:** Build a complete, production-ready skeleton of the application that is
fully runnable and ready for agent and tool logic in later prompts.

### 1. Project Layout

Created the core project structure:

- `app.py` — Main Streamlit application and UI.
- `.streamlit/config.toml` — Streamlit theming and server configuration.
- `requirements.txt` — Dependency list (versions compatible with Streamlit Cloud).
- `.env.example` — Template for environment variables.
- `.gitignore` — Ignore settings for Python, Streamlit, and logs.

Source tree:

- `src/__init__.py`
- `src/agents/`
  - `__init__.py`
  - `base.py` — Initial base agent abstraction.
  - `supervisor.py` — LangGraph supervisor skeleton.
- `src/utils/`
  - `__init__.py`
  - `config.py` — Configuration loading and validation (Pydantic-based).
  - `logger.py` — Central logging utilities.
  - `validators.py` — Input validation for user preferences.
  - `prompts.py` — System prompts for the planned agents.
- `src/constants/`
  - `__init__.py`
  - `categories.py` — Shared categories and enumerations.
- `src/tools/`
  - `__init__.py` — Placeholder package for API tools.

Documentation:

- `context/PROJECT_GOAL.md`
- `context/ARCHITECTURE.md`
- `context/IMPLEMENTATION_LOG.md` (this file)

### 2. Configuration Management

Implemented `src/utils/config.py`:

- Uses `python-dotenv` to load `.env` for local development.
- Uses **Pydantic** (`AppConfig`) to validate:
  - `GROQ_API_KEY` (required).
  - `OPENTRIPMAP_API_KEY` (optional).
  - `GOOGLE_PLACES_API_KEY` (optional).
  - `APP_ENV`, `GROQ_DEFAULT_MODEL`, `APP_DEBUG`.
- Exposes:
  - `load_config()` — strict loading, raises `ConfigError` on failure.
  - `try_load_config()` — safe loading, returns a `ConfigLoadResult` with
    either a valid config or a friendly error message.

This provides clear, user-facing errors while keeping the rest of the codebase
simple and type-safe.

### 3. Logging

Implemented `src/utils/logger.py`:

- Central `get_logger(name: str)` function with:
  - Rotating file handler at `logs/app.log`.
  - Console stream handler.
- Respects `APP_DEBUG` to toggle between INFO and DEBUG levels.
- Ensures log directory is created automatically.
- Prevents duplicate handlers when called multiple times.

### 4. Input Validation

Implemented `src/utils/validators.py`:

- Defines:
  - `InputValidationError` for invalid user input.
  - `UserPreferences` dataclass capturing validated inputs.
  - Field-level validators:
    - `validate_city_name`
    - `validate_days`
    - `validate_transportation`
    - `validate_budget`
    - `validate_interests`
  - Aggregator:
    - `validate_user_preferences(...)` returning `UserPreferences`.

Validation rules ensure:

- City names are non-empty and reasonably formatted.
- Days are in the `[1, 30]` range.
- Transportation, budget, and interests must be among supported values.

### 5. Prompts and Categories

Implemented:

- `src/utils/prompts.py`:
  - Initial system prompts for planned agents (context analyst, places researcher,
    itinerary designer, map designer, travel guide writer).

- `src/constants/categories.py`:
  - `INTEREST_LABELS` — core interest labels exposed in the UI.
  - `PLACE_CATEGORIES_BY_INTEREST` — mapping to semantic place categories.
  - `TRANSPORTATION_MODES` and `BUDGET_LEVELS` — shared enumerations.

### 6. Agent Base Class and Supervisor Skeleton

Implemented:

- `src/agents/base.py`:
  - `BaseAgent` abstract class:
    - Holds `name`, `description`, `config`, and a module-specific logger.
    - Declares an abstract `run(state: Mapping[str, Any]) -> Mapping[str, Any]`.

- `src/agents/supervisor.py`:
  - `AgentState` `TypedDict` defining the shared graph state.
  - `_build_graph(config: AppConfig)`:
    - Uses `langgraph.graph.StateGraph`.
    - Defines a single `entry` node that:
      - Ensures an `errors` list exists.
      - Logs that the supervisor is still in foundation mode.
      - Appends a user-facing note into `state["errors"]`.
  - `run_supervisor(initial_state, config)`:
    - Builds the graph.
    - Ensures a minimal default state if `initial_state` is `None`.
    - Invokes the compiled graph and returns the final `AgentState`.

No real agent logic or external API calls were performed in Prompt 1.

### 7. Streamlit App Skeleton

Implemented `app.py`:

- Sets page config and theme to match `.streamlit/config.toml`.
- Uses `try_load_config()`:
  - Displays a clear warning in the sidebar if configuration is invalid,
    while keeping the UI usable.
- Sidebar form includes:
  - City (text input).
  - Days (slider 1–30).
  - Transportation (selectbox).
  - Interests (multiselect).
  - Budget (selectbox).
  - Advanced options (collapsible via checkbox, with optional notes).
- Validation:
  - Uses `validate_user_preferences(...)`.
  - Shows `st.error()` messages for validation failures.
- On successful submission:
  - Builds an `AgentState` from `UserPreferences`.
  - Calls `run_supervisor(...)` inside an `st.spinner`.
  - Displays:
    - A placeholder itinerary-style summary.
    - A basic Folium map embedded with `streamlit-folium`.
    - A simple travel guide text.
  - If `state["errors"]` contains messages, surfaces them to the user.

This ensured the app was fully runnable while waiting for real agents and tools.

### 8. Documentation

Created:

- `PROJECT_GOAL.md` — clarified objectives, success criteria, and non-goals.
- `ARCHITECTURE.md` — described major components, `AgentState`, agent roles,
  and data flow (including a Mermaid diagram).
- `IMPLEMENTATION_LOG.md` — this running implementation journal.

---

## Prompt 2 – Agents and Integration

**Goal:** Implement all agents, tools, and orchestration for a complete
end-to-end microguide generation workflow.

### 1. Agent Base Class and Models

- Added `src/agents/base_agent.py`:
  - New `BaseAgent` abstraction with:
    - `name`, `description`, `config`.
    - Logger derived from `get_logger("agent.<name>")`.
    - `run(state: MutableMapping[str, Any])` abstract method.
    - `_ensure_errors_list(state)` helper.

- Added `src/agents/models.py`:
  - `InputPreferences` (city, days, transportation, interests, budget).
  - `TimeSlot`, `Day`, `ItineraryPlan` for structured itineraries.
  - `Place`, `PlacesList` for places and grouped place collections.
  - These models are used across all agents and tools.

- Updated `src/agents/__init__.py`:
  - Exported `BaseAgent` from `base_agent.py` and concrete agents:
    - `InputProcessorAgent`
    - `PlacesFinderAgent`
    - `ItineraryPlannerAgent`
    - `ContentFormatterAgent`
  - Continued exporting `AgentState` and `run_supervisor`.

### 2. Concrete Agents

Implemented four agents:

1. `InputProcessorAgent` (`src/agents/input_processor.py`)

   - Reads `city`, `days`, `transportation`, `interests`, `budget` from state.
   - Constructs `InputPreferences` and stores it as `state["preferences"]`.
   - Uses `geocode_city` to resolve the city and stores result as `state["city_info"]`.
   - Calls Groq with `INPUT_PROCESSOR_PROMPT` to perform a light sanity check
     and logs any advisory notes.
   - Appends non-fatal issues to `state["errors"]`.

2. `PlacesFinderAgent` (`src/agents/places_finder.py`)

   - Reads `preferences` and `city_info` from state.
   - Uses Groq **function calling** with `PLACES_DECIDER_PROMPT` to decide
     which logical tools to call:
     - `search_attractions`
     - `search_restaurants`
     - `search_shopping`
   - Executes local tool functions in `src/tools/places_api.py`:
     - `search_attractions_opentripmap`
     - `search_restaurants_google_places`
     - `search_shopping_areas`
   - Uses `fallback_places_for_city` if external APIs are unavailable or
     return too little data.
   - Populates:
     - `state["places_list"]` — serialised `PlacesList`.
     - `state["places"]` — flattened list of place dicts.

3. `ItineraryPlannerAgent` (`src/agents/itinerary_planner.py`)

   - Reads `preferences` from state.
   - Builds a deterministic `ItineraryPlan`:
     - One `Day` per trip day.
     - Morning/afternoon/evening `TimeSlot`s with reasonable default timings.
   - Calls Groq with `ITINERARY_PLANNER_PROMPT` to generate a short,
     human-readable explanation of trip pacing and stores it in
     `ItineraryPlan.notes`.
   - Stores:
     - `state["itinerary_plan"]` — serialised `ItineraryPlan`.
     - `state["itinerary"]` — simplified list of day summaries for the UI.

4. `ContentFormatterAgent` (`src/agents/content_formatter.py`)

   - Reads `preferences`, `itinerary_plan`, `places_list`, and `city_info`.
   - Calls Groq with `CONTENT_FORMATTER_PROMPT` to generate a Markdown
     travel guide.
   - On LLM failure, falls back to a template-based Markdown generator:
     - Overview section.
     - Day-by-day section.
     - Highlighted places (attractions, restaurants, shopping).
   - Writes Markdown string to `state["travel_guide"]`.
   - Appends a note to `state["errors"]` when falling back to the template.

### 3. Tools and External API Integration

- `src/tools/geo_utils.py`:
  - `geocode_city(city)`:
    - Uses Nominatim to resolve city names to coordinates and bounding boxes.
    - Respects 1 request/second via `time.sleep(1)`.
    - Caches results in a simple in-memory dictionary.
    - Falls back to hardcoded coordinates for major cities (Paris, Tokyo,
      New York, London, Mexico City).
  - `get_city_bounds(city_info)`:
    - Extracts or approximates a `{north, south, east, west}` bounding box.

- `src/tools/places_api.py`:
  - `_safe_get(url, params)`:
    - Wrapper for HTTP GET with logging and JSON decoding.
  - `search_attractions_opentripmap(config, city, lat, lon, limit)`:
    - Uses OpenTripMap `places/radius` endpoint for attractions.
  - `search_shopping_areas(config, city, city_info, limit)`:
    - Uses OpenTripMap `places/bbox` endpoint for shopping-related locations.
  - `search_restaurants_google_places(config, city, lat, lon, limit)`:
    - Uses Google Places `nearbysearch` endpoint for restaurants when an API
      key is configured; otherwise returns an empty list.
  - `fallback_places_for_city(city)`:
    - Provides a small, hardcoded set of landmarks for major cities when
      external APIs fail.

- `src/tools/map_generator.py`:
  - `create_map(places_data, city_info)`:
    - Validates a `PlacesList` dict.
    - Determines map centre from `city_info` or place coordinates.
    - Generates a Folium map with colour-coded `CircleMarker`s:
      - Attraction: blue.
      - Restaurant: red.
      - Shopping: green.
      - Hotel: yellow.
      - Other: grey.
    - Popups show name, type, rating, and address.

### 4. Groq Integration and Prompts

Updated `src/utils/prompts.py`:

- Replaced initial generic prompts with agent-specific prompts:
  - `INPUT_PROCESSOR_PROMPT`
  - `ITINERARY_PLANNER_PROMPT`
  - `PLACES_DECIDER_PROMPT`
  - `CONTENT_FORMATTER_PROMPT`

All Groq calls use the OpenAI-compatible endpoint:

- `https://api.groq.com/openai/v1/chat/completions`

Agents:

- Pass `model=config.groq_default_model`.
- Include relevant prompt and structured context.
- Use conservative `max_tokens` and timeouts.
- Log failures and fall back to deterministic logic where appropriate.

### 5. LangGraph Supervisor and Orchestration

Updated `src/agents/supervisor.py`:

- Extended `AgentState` to include:
  - `preferences`, `city_info`
  - `places_list`, `places`
  - `itinerary_plan`, `itinerary`
  - `travel_guide`, `map_data`, `errors`
- In `_build_graph(config)`:
  - Instantiate:
    - `InputProcessorAgent`
    - `PlacesFinderAgent`
    - `ItineraryPlannerAgent`
    - `ContentFormatterAgent`
  - Define nodes:
    - `entry`
    - `input_processor`
    - `places_finder`
    - `itinerary_planner`
    - `content_formatter`
  - Define edges:
    - `entry -> input_processor`
    - `input_processor -> places_finder`
    - `places_finder -> itinerary_planner`
    - `itinerary_planner -> content_formatter`
    - `content_formatter -> END`
- `run_supervisor(initial_state, config)`:
  - Populates a richer default `AgentState` when `initial_state` is `None`.
  - Invokes the compiled LangGraph and returns the final state.

### 6. Streamlit App Integration

Updated `app.py`:

- Still performs UI-level validation using `validate_user_preferences`.
- After submission:
  - Constructs an initial `AgentState` containing raw fields and empty
    structured fields.
  - Calls `run_supervisor(initial_state, config)` inside an `st.spinner`.
- `\_render_results(...)`:
  - Uses `state["itinerary"]` and `state["travel_guide"]` when available.
  - Uses `create_map(state["places_list"], state.get("city_info"))` to build
    a rich Folium map.
  - Falls back to placeholder itinerary/guide and displays an info message
    if map generation fails or no places are available.
  - Displays accumulated messages from `state["errors"]` as “Planner notes”.

### 7. Documentation Updates

- `context/ARCHITECTURE.md`:
  - Updated to describe:
    - The four concrete agents and their responsibilities.
    - The models in `src/agents/models.py`.
    - The tools layer (`geo_utils`, `places_api`, `map_generator`).
    - The updated `AgentState` schema.
    - Revised Mermaid diagram for the new orchestration flow.

- `context/IMPLEMENTATION_LOG.md` (this file):
  - Extended with this **Prompt 2 – Agents and Integration** section to
    capture all new behaviour.

---

## Next Steps (Prompt 3 – Deployment & Polishing)

Planned work:

1. Prepare deployment for Streamlit Community Cloud:
   - Verify environment configuration and secrets management.
   - Confirm all dependencies are compatible with the hosted environment.
2. Add user-facing documentation:
   - README updates with screenshots, usage instructions, and architecture
     summaries.
3. Optionally fine-tune:
   - Prompt wording and model parameters.
   - Additional fallbacks for lesser-known cities.
   - More detailed category handling for places and map styling.

At this stage the application provides a complete end-to-end experience:
user inputs are turned into a structured itinerary, curated places,
interactive map, and readable travel guide, all orchestrated by LangGraph
and powered by Groq plus external place APIs.