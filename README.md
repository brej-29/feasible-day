# City Travel Microguide (Streamlit + LangGraph)

An AI-powered **city travel microguide generator** that turns your preferences
(city, days, interests, budget) into:

- A **day-by-day itinerary**
- An **interactive Folium map** with curated markers
- A **Markdown travel guide** with tips and recommendations

Built with **Streamlit**, **LangGraph**, and **Groq**, and designed to run
for free on **Streamlit Community Cloud**.

---

## Features

- **Multi-agent planning pipeline**
  - Input processing and validation
  - Places discovery via OpenTripMap and Google Places
  - Itinerary planning with structured days and time slots
  - Travel guide formatting and narrative generation

- **Interactive map**
  - Folium-based map embedded in Streamlit
  - Colour-coded markers for attractions, restaurants, shopping, etc.
  - Popups with name, type, rating, and address

- **Robust error handling**
  - Graceful fallbacks when APIs are unavailable or rate-limited
  - Informative “planner notes” surfaced in the UI
  - Structured logging to file (local) and console

- **Zero-cost stack**
  - Groq LLM free tier
  - OpenTripMap & Nominatim (OpenStreetMap)
  - Optional Google Places API (free tier)
  - Streamlit Community Cloud hosting

---

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/brej-29/city-travel-microguide-streamlit.git
cd city-travel-microguide-streamlit
```

### 2. Create a virtual environment

```bash
python3 -m venv venv
source venv/bin/activate      # Mac / Linux
# OR
venv\Scripts\activate         # Windows PowerShell / cmd
```

### 3. Install dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Configure environment variables

Copy the example `.env` and edit it:

```bash
cp .env.example .env
```

Set at least:

```env
GROQ_API_KEY="your-real-groq-api-key"
```

Optionally add:

```env
GOOGLE_PLACES_API_KEY="your-google-places-api-key"
OPENTRIPMAP_API_KEY="your-opentripmap-api-key"
APP_ENV="development"
GROQ_DEFAULT_MODEL="llama3-8b-8192"
APP_DEBUG="false"
```

### 5. Run the app

```bash
streamlit run app.py
```

Open the URL shown in the terminal (usually http://localhost:8501).

---

## Deployment (Streamlit Community Cloud)

The app is designed to deploy easily to **Streamlit Community Cloud**:

1. Push this repository to GitHub.
2. Go to https://share.streamlit.io and create an account.
3. Click **New app**, select:
   - Repo: `brej-29/city-travel-microguide-streamlit`
   - Branch: `main`
   - Main file: `app.py`
4. Add secrets in Streamlit (Settings → Secrets):

   ```toml
   GROQ_API_KEY = "your-groq-api-key-here"
   GOOGLE_PLACES_API_KEY = "your-google-places-api-key-here"  # Optional
   OPENTRIPMAP_API_KEY = "your-opentripmap-api-key-here"      # Optional
   APP_ENV = "production"
   GROQ_DEFAULT_MODEL = "llama3-8b-8192"
   APP_DEBUG = "false"
   ```

5. Deploy and wait for the build to complete.
6. Test the live URL.

For a detailed, step-by-step guide, see:

- [`context/DEPLOYMENT_GUIDE.md`](context/DEPLOYMENT_GUIDE.md)

---

## Documentation

All project documentation lives in the `context/` directory:

- [`context/PROJECT_GOAL.md`](context/PROJECT_GOAL.md)  
  High-level goals, success metrics, and portfolio value.

- [`context/ARCHITECTURE.md`](context/ARCHITECTURE.md)  
  System design, agent workflow, data models, and error handling.

- [`context/IMPLEMENTATION_LOG.md`](context/IMPLEMENTATION_LOG.md)  
  Chronological record of what was built in each prompt.

- [`context/LOCAL_SETUP.md`](context/LOCAL_SETUP.md)  
  Detailed local installation and troubleshooting guide.

- [`context/DEPLOYMENT_GUIDE.md`](context/DEPLOYMENT_GUIDE.md)  
  Deployment steps for Streamlit Community Cloud.

---

## Tech Stack

- **Frontend**
  - Streamlit (UI)
  - Folium + `streamlit-folium` (interactive map)

- **Agents & Orchestration**
  - LangGraph (multi-agent workflow)
  - Groq LLM (OpenAI-compatible API)

- **Data & APIs**
  - OpenTripMap (places/POIs)
  - Google Places API (restaurants, details) – optional
  - Nominatim (OpenStreetMap) for geocoding

- **Backend Utilities**
  - Pydantic (data models)
  - `python-dotenv` (config)
  - Custom logging and error-handling utilities

---

## Contributing & Extensibility

The codebase is structured for extension:

- Add new agents in `src/agents/` and wire them into the LangGraph supervisor.
- Add new API tools in `src/tools/`.
- Adjust prompts in `src/utils/prompts.py`.
- Tweak UI behaviour in `app.py`.

If you fork this project:

- Keep secrets out of version control.
- Update `context/IMPLEMENTATION_LOG.md` with your changes.
- Re-run `python -m compileall .` to check for syntax errors before deploying.

---

## License

This project is licensed under the terms of the repository’s `LICENSE` file.