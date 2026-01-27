# Local Setup Guide

This document describes how to set up and run the **City Travel Microguide** app
on your local machine for development and testing.

---

## 1. Prerequisites

Before you start, make sure you have:

- **Python**: 3.10 or newer (recommended: 3.10.x for best compatibility)
- **Package manager**: `pip` (comes with Python) or `pipx`/`poetry` if you prefer
- **Git**: to clone the repository
- **Groq API key** (required)
  - Sign up at: https://console.groq.com/
  - Create an API token and keep it secret.
- **Google Places API key** (optional but recommended)
  - Create a project and API key in Google Cloud Console.
  - Enable the **Places API**.
- **OpenTripMap API key** (optional)
  - For higher reliability with the OpenTripMap endpoints.

You can run the app without Google Places or OpenTripMap keys; in that case,
the system will use fallbacks and may show fewer places.

---

## 2. Installation – Linux / macOS

### 2.1 Clone the repository

```bash
git clone https://github.com/brej-29/city-travel-microguide-streamlit.git
cd city-travel-microguide-streamlit
```

### 2.2 Create and activate a virtual environment

```bash
python3 -m venv venv
source venv/bin/activate
```

You should now see `(venv)` in your shell prompt.

### 2.3 Install dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 2.4 Configure environment variables

Copy the example `.env` file:

```bash
cp .env.example .env
```

Open `.env` in your editor and set at least:

```env
GROQ_API_KEY="your-real-groq-api-key"
```

Optionally configure:

```env
OPENTRIPMAP_API_KEY="your-opentripmap-api-key"
GOOGLE_PLACES_API_KEY="your-google-places-api-key"
APP_ENV="development"
GROQ_DEFAULT_MODEL="llama3-8b-8192"
APP_DEBUG="false"
```

> Never commit `.env` to Git. It is already ignored by `.gitignore`.

### 2.5 Run the app

From the project root:

```bash
streamlit run app.py
```

By default, Streamlit serves at http://localhost:8501. Your browser should open
automatically; if not, visit that URL manually.

### 2.6 Test locally

Once the UI loads:

1. Enter a city (e.g. `Paris`).
2. Choose number of days, interests, transportation, and budget.
3. Click **Generate microguide**.
4. Confirm that:
   - An itinerary appears.
   - A map appears with markers (if APIs and geocoding succeed).
   - A travel guide is rendered on the right.
   - Planner notes appear if fallbacks or minor issues occurred.

---

## 3. Installation – Windows (PowerShell)

The steps are similar, but with Windows-specific commands.

### 3.1 Clone the repository

In PowerShell:

```powershell
git clone https://github.com/brej-29/city-travel-microguide-streamlit.git
cd city-travel-microguide-streamlit
```

### 3.2 Create and activate a virtual environment

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

If execution policy prevents activation, run PowerShell as Administrator and:

```powershell
Set-ExecutionPolicy RemoteSigned
```

Then re-run the activation command.

### 3.3 Install dependencies

```powershell
pip install --upgrade pip
pip install -r requirements.txt
```

### 3.4 Configure environment variables

Copy the example `.env`:

```powershell
copy .env.example .env
```

Edit `.env` in your preferred editor and set the keys as described in the
Linux/macOS section.

### 3.5 Run the app

```powershell
streamlit run app.py
```

Open the local URL shown in the terminal (usually http://localhost:8501).

---

## 4. Optional Makefile

A simple `Makefile` is provided to streamline common tasks (Linux/macOS, WSL):

```bash
make install   # create venv (if not present) and install dependencies
make run       # run the Streamlit app
make test      # basic syntax check via compileall
make clean     # remove caches and temporary files
```

On Windows, you can either use WSL or simply run the equivalent commands
manually (see next section).

---

## 5. Manual Shell Commands (Summary)

### Clone and enter project

```bash
git clone https://github.com/brej-29/city-travel-microguide-streamlit.git
cd city-travel-microguide-streamlit
```

### Virtual environment

```bash
python3 -m venv venv           # or 'python -m venv venv' on Windows
source venv/bin/activate       # Mac/Linux
# OR
venv\Scripts\activate          # Windows PowerShell / cmd
```

### Install dependencies

```bash
pip install -r requirements.txt
```

### Set up environment

```bash
cp .env.example .env           # 'copy .env.example .env' on Windows
# Then edit .env with your API keys
```

### Run the app

```bash
streamlit run app.py
```

---

## 6. Troubleshooting

### Port already in use (8501)

If another app is using port 8501, either close that app or run Streamlit on
a different port:

```bash
streamlit run app.py --server.port 8502
```

### Missing API keys

If `GROQ_API_KEY` is missing or invalid:

- The app will show configuration errors.
- Set the key in `.env` (local) or in Streamlit Cloud secrets (deployment).

If `GOOGLE_PLACES_API_KEY` or `OPENTRIPMAP_API_KEY` are missing:

- The app still works.
- Places discovery may be more limited; fallbacks are used where possible.

### Module not found

If you see import errors:

- Ensure the virtual environment is activated.
- Re-run:

  ```bash
  pip install -r requirements.txt
  ```

- Confirm you are in the project root when running `streamlit run app.py`.

### Streamlit cache issues

If you change code and see stale behaviour:

- Restart the app (Ctrl+C then `streamlit run app.py`).
- Or clear Streamlit’s cache:

  ```bash
  streamlit cache clear
  ```

### API rate limits or network failures

- Groq:
  - Uses free tier; if limits are hit, some AI-generated content may fall back
    to simple templates while logging warnings.
- Google Places:
  - Free tier is limited; if exhausted, restaurants may rely on fallback data.
- OpenTripMap:
  - Generous free tier; occasional failures are handled gracefully.

All such issues will be logged in `logs/app.log` (if running locally) and
surfaced in the UI as planner notes rather than hard failures.

---

## 7. Testing Locally

There is no heavy test suite yet, but you can:

- Perform a **syntax check**:

  ```bash
  python -m compileall .
  ```

- Manually verify core flows:
  - Different cities (large & small).
  - Different interest mixes (food-heavy, culture-heavy, etc.).
  - With and without Google Places / OpenTripMap keys.
  - Short trips (1–2 days) and longer trips (7+ days).

Look at the terminal output and `logs/app.log` for any unexpected stack traces
or error messages.

---

## 8. Development Setup

To extend or modify the project:

- **Agents**
  - See `src/agents/`:
    - `input_processor.py`
    - `places_finder.py`
    - `itinerary_planner.py`
    - `content_formatter.py`
    - `supervisor.py` (LangGraph orchestration)
  - You can:
    - Adjust prompts in `src/utils/prompts.py`.
    - Modify or add agent logic.
    - Add new tools and wire them into the supervisor.

- **APIs**
  - See `src/tools/`:
    - `geo_utils.py`
    - `places_api.py`
    - `map_generator.py`
  - You can:
    - Add new API wrappers.
    - Improve fallback logic.
    - Enhance map styling.

- **UI**
  - Main entry point: `app.py`.
  - Update layout, theming, and user guidance here.

After making code changes, re-run:

```bash
python -m compileall .
streamlit run app.py
```

to verify that the app starts cleanly and behaves as expected.