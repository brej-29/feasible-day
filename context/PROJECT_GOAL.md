# Project Goal – City Travel Microguide Generator

## What This Project Does

The **City Travel Microguide Generator** is a zero-cost, AI-powered travel
planner that:

- Takes **user input**:
  - City
  - Number of days
  - Transportation preference
  - Interests (food, art, shopping, outdoors, history, culture)
  - Budget level (budget, moderate, luxury)
- Generates a **detailed travel itinerary**:
  - Day-by-day plan with morning/afternoon/evening activities.
- Creates an **interactive map**:
  - Folium map embedded in Streamlit.
  - Target: **50+ curated markers** per city whenever possible.
- Provides **restaurant recommendations**:
  - Uses Google Places (when available) and fallbacks.
- Lists **attractions by interest**:
  - Landmarks, museums, cultural venues, shopping areas, etc.
- Includes **logistics and tips**:
  - Transportation, pacing, local customs (at a high level).

The app is designed to feel like a **local expert travel planner** that turns
your preferences into a realistic, easy-to-follow microguide for any city.

---

## Technical Approach

- **Multi-agent system**:
  - 5 roles (4 concrete agents + supervisor) coordinated with **LangGraph**.
  - Agents:
    1. Input Processor – normalizes and validates user input.
    2. Places Finder – discovers attractions, restaurants, and shopping areas.
    3. Itinerary Planner – schedules days and time slots.
    4. Content Formatter – writes the travel guide.
    5. Supervisor – orchestrates the workflow via LangGraph.

- **LLM integration**:
  - **Groq API** (free tier) used for:
    - Input sanity-checking.
    - Itinerary pacing notes.
    - Markdown travel guide generation.
    - Tool selection for places discovery.

- **Places APIs**:
  - **OpenTripMap**:
    - Attractions and shopping areas.
  - **Google Places API**:
    - Restaurants and detailed place info (optional).
  - **Nominatim (OpenStreetMap)**:
    - Geocoding: city name → latitude/longitude.

- **Frontend and mapping**:
  - **Streamlit** for the UI (sidebar inputs + main results).
  - **Folium** + `streamlit-folium` for interactive maps.
  - Colour-coded markers for different place types.

- **Architecture highlights**:
  - Clear separation between:
    - UI (`app.py`)
    - Agents (`src/agents/`)
    - Tools (`src/tools/`)
    - Utils (`src/utils/`)
  - Typed models (Pydantic) for preferences, itinerary, and places.
  - Structured logging and config management.

- **Cost model**:
  - Streamlit Community Cloud: **free**.
  - Groq free tier.
  - OpenTripMap and Nominatim: free.
  - Google Places: free tier sufficient for demos.
  - Overall goal: **100% free stack** for normal portfolio/demo usage.

---

## Success Metrics

The project is considered successful when:

- **Functionality**
  - ✓ User can input city, days, transportation, interests, and budget.
  - ✓ System generates a full itinerary in **under 30 seconds** for typical cities.
  - ✓ Interactive map renders with **50+ markers** for major cities where APIs allow.
  - ✓ Travel guide includes a clear **day-by-day breakdown**.
  - ✓ Works for a wide range of cities (not just hardcoded ones).

- **User Experience**
  - ✓ UI is clean, responsive, and mobile-friendly.
  - ✓ Input validation is clear and prevents obvious mistakes.
  - ✓ Loading indicators are present and informative.
  - ✓ Errors and rate-limit issues are surfaced as friendly messages, not crashes.

- **Robustness & Error Handling**
  - ✓ Optional APIs (Google Places, OpenTripMap) can fail without breaking the app.
  - ✓ Fallback data is used where possible.
  - ✓ All major steps log errors and warnings appropriately.

- **Technical Quality**
  - ✓ Code is modular, type-hinted, and documented.
  - ✓ Multi-agent architecture is easy to extend (new tools, new agents).
  - ✓ No secrets are committed to the repository.
  - ✓ Ready for hosting on Streamlit Cloud.

- **Portfolio Value**
  - ✓ Demonstrates practical multi-agent AI orchestration (LangGraph).
  - ✓ Shows integration with real external APIs (Groq, OpenTripMap, Google Places).
  - ✓ Includes full deployment and setup docs.
  - ✓ Is simple for recruiters/teammates to run and test.

---

## Non-Goals (for Version 1)

To keep the scope focused and deployable:

- No real-time booking (flights, hotels, restaurants).
- No user authentication, profiles, or saved itineraries.
- No persistent storage beyond the current session.
- No PDF export or offline mode (can be added later).
- No complex trip constraints (multi-city routing, flights, etc.).

---

## Portfolio Showcase Checklist

This project is intended to be a strong portfolio piece, demonstrating:

- ✓ **Multi-agent AI system** using LangGraph.
- ✓ **Groq API integration** with function calling.
- ✓ **External API usage**:
  - OpenTripMap, Google Places, Nominatim.
- ✓ **Rich UI and visualization**:
  - Streamlit interface, Folium maps, interactive elements.
- ✓ **Robust engineering**:
  - Config management, logging, error handling, fallbacks.
- ✓ **Cloud deployment**:
  - Streamlit Community Cloud guide and zero-cost operation.
- ✓ **Complete documentation**:
  - Local setup, deployment, architecture, and implementation log.