# City Travel Microguide – Project Goal

## Vision

Create a **zero-cost, AI-powered city microguide generator** that produces:

- A **day-by-day itinerary** personalized to the traveler.
- An **interactive map** with 50+ curated markers per city.
- A concise, **actionable travel guide** that is easy to scan on mobile.
- A **delightful Streamlit experience** that runs entirely on the free tier.

The app should feel like having a **local expert travel planner** who knows:
your interests, your pace, and your budget — and can turn that into a clear,
realistic plan for any city in the world.

---

## Core Objectives

1. **Personalized Itineraries**
   - Input: city, number of days, budget, transportation, interests, and advanced options.
   - Output: structured, daily plans that make geographic and thematic sense.
   - Respect constraints such as:
     - Pace (not too rushed, not too slow).
     - Budget (budget / moderate / luxury).
     - Transportation (walking / metro / car / mixed).

2. **Rich Place Discovery**
   - Use **OpenTripMap** and **Google Places** to discover:
     - Landmarks, museums, viewpoints, cultural venues.
     - Food spots, cafes, night-life, markets, and local gems.
   - Normalize and deduplicate results across APIs.
   - Annotate each place with:
     - Category, interest tags, price level, rough duration, and neighborhood.

3. **Interactive Mapping**
   - Generate a **Folium-based interactive map** embedded in Streamlit.
   - Display **50+ curated markers** per city whenever possible.
   - Support:
     - Category-based styling (e.g., colors for food/art/history).
     - Logical default zoom and bounds.
     - Tooltips/popups for quick context.

4. **Readable Travel Guide**
   - Transform structured itineraries into a **human-friendly travel guide**.
   - Provide:
     - Day summaries.
     - Brief descriptions per stop.
     - Travel tips, etiquette, and local insights.
   - Optimize for:
     - Mobile reading.
     - Quick skimming and bookmarking.

5. **Robust Multi-Agent Orchestration**
   - Use **LangGraph** to orchestrate 5 specialized agents:
     1. City Context Analyst
     2. Places Researcher
     3. Itinerary Designer
     4. Map Designer
     5. Travel Guide Writer
   - Ensure the pipeline can:
     - Handle partial failures gracefully.
     - Reuse context across agents.
     - Remain extendable for new cities, interests, or tools.

6. **Zero-Cost Operation**
   - Run entirely on **Streamlit Community Cloud (free tier)**.
   - Use **Groq’s free tier** for all LLM calls.
   - Design all integrations to:
     - Minimize API calls.
     - Cache reusable results where possible.
     - Fail gracefully when optional APIs are unavailable.

---

## Success Metrics

The project is successful when:

1. **Functional Criteria**
   - Users can open the Streamlit app and:
     - Enter their trip details.
     - Generate a multi-day itinerary for any major city.
     - See an embedded interactive map.
     - Read a concise travel guide.
   - All core functionality works on free-tier infrastructure.

2. **User Experience**
   - UI is **clean, professional, and responsive**.
   - Input validation is clear and non-frustrating.
   - Loading states and error messages are **communicative and calm**.
   - Even when APIs fail, users still receive a partial but coherent result.

3. **Technical Quality**
   - Code is:
     - Well-structured (clear modules, separation of concerns).
     - Type-hinted and documented.
     - Ready for continuous extension (new agents, tools, and prompts).
   - The LangGraph supervisor and agents are easy to reason about and debug.

4. **Showcase Value**
   - The project serves as a **public portfolio piece** showing:
     - Practical use of multi-agent orchestration with LangGraph.
     - Integration of external travel/places APIs.
     - A polished Streamlit front-end.
     - Sensible engineering practices (logging, config, validation, error handling).

---

## Non-Goals (for Version 1)

To keep scope realistic for the initial release:

- No real-time booking of flights, hotels, or activities.
- No user authentication or account system.
- No persistence of itineraries beyond the current session.
- No offline capabilities or PDF export (these are potential later features).

The focus for the foundational phase is a **robust skeleton** that is:

- Easy to extend with new agents, tools, and prompts.
- Stable enough for public demo and live use.
- Pleasant to interact with even when underlying AI calls are still evolving.