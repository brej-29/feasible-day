# Deployment Guide – Streamlit Community Cloud

This guide explains how to deploy the **City Travel Microguide** app to
**Streamlit Community Cloud** and keep it running at zero cost.

---

## 1. Deployment Overview

**What we’re deploying**

- A Streamlit app (`app.py`) that:
  - Collects trip preferences.
  - Runs a multi-agent LangGraph pipeline.
  - Calls Groq, OpenTripMap, Google Places, and Nominatim.
  - Renders an interactive Folium map and Markdown travel guide.

**Where we’re deploying**

- **Streamlit Community Cloud** (https://streamlit.io/cloud)
  - Free tier suitable for demos and portfolio projects.

**Cost**

- Streamlit Community Cloud: **$0**
- Groq API: **Free tier** (e.g., 30 requests/minute; subject to provider changes)
- Google Places: **Free tier** (e.g., 150 requests/day; subject to provider changes)
- OpenTripMap: **Free** (generous limits)
- Total expected monthly cost: **$0.00** for normal demo usage.

**After deployment**

- You will have a public URL, e.g.:

  ```text
  https://<username>-city-travel-microguide-<hash>.streamlit.app
  ```

- Any push to the configured GitHub branch will trigger an automatic app
  redeploy/update.

---

## 2. Prerequisites

Before you deploy, ensure you have:

- A **GitHub account**.
- The code pushed to GitHub, e.g.:
  - Repository: `brej-29/city-travel-microguide-streamlit`
  - Branch: `main`
- Required API keys:
  - **GROQ_API_KEY** (required).
  - **GOOGLE_PLACES_API_KEY** (optional but recommended).
  - **OPENTRIPMAP_API_KEY** (optional).
- A verified **Streamlit Community Cloud** account.

---

## 3. Step-by-Step Deployment

### 3.1 Create a Streamlit Cloud account

1. Go to: https://share.streamlit.io
2. Sign in with your GitHub account.
3. Authorize Streamlit to access your GitHub repositories.

### 3.2 Create a new app

1. Click **"New app"** in the Streamlit Cloud dashboard.
2. Under **Repository**, select:  
   `brej-29/city-travel-microguide-streamlit`
3. Under **Branch**, select:  
   `main`
4. Under **Main file path**, enter:  
   `app.py`

### 3.3 Configure runtime and dependencies

1. Under **Advanced settings** (if available):
   - Runtime: choose **Python 3.10+**.
2. Confirm that:
   - `requirements.txt` is present in the repo (this app uses it).
   - Streamlit Cloud will install dependencies from `requirements.txt`
     automatically.

No additional configuration files are required for Python packages.

### 3.4 Add secrets (API keys)

Streamlit Cloud uses `secrets.toml` stored in its own UI, not in your repo.

1. In the app settings (or from the main Streamlit Cloud dashboard):
   - Go to **Settings → Secrets**.
2. Add entries such as:

   ```toml
   GROQ_API_KEY = "your-groq-api-key-here"
   GOOGLE_PLACES_API_KEY = "your-google-places-api-key-here"  # Optional
   OPENTRIPMAP_API_KEY = "your-opentripmap-api-key-here"      # Optional
   APP_ENV = "production"
   GROQ_DEFAULT_MODEL = "llama3-8b-8192"
   APP_DEBUG = "false"
   ```

3. Save the secrets.

> Never commit real keys to Git. Secrets set via Streamlit Cloud are stored
> securely and are not part of your repository.

### 3.5 Deploy

1. From the **New app** configuration page, click **Deploy**.
2. Streamlit Cloud will:
   - Clone the repository.
   - Create a Python environment.
   - Install dependencies from `requirements.txt`.
   - Launch `streamlit run app.py`.

Deployment typically takes 1–3 minutes.

### 3.6 Test the live app

Once the build finishes:

1. Open the app URL (shown in the dashboard).
2. Verify that:
   - The UI loads.
   - You can input a city and preferences.
   - The itinerary, map, and guide render without errors.
3. If something goes wrong, see the **Monitoring & Debugging** section below.

---

## 4. Managing Secrets

### Where to manage secrets

- In Streamlit Cloud:
  - Navigate to your app → **Settings → Secrets**.
- Secrets are exposed to the app as environment variables, just like `.env`
  locally.

### Adding or updating keys

- Add entries in TOML format:

  ```toml
  GROQ_API_KEY = "new-key"
  ```

- Click **Save**.
- The app will be redeployed automatically with the updated secrets.

### Security best practices

- Never commit `.env` or any real keys; `.gitignore` already excludes `.env`.
- Use separate keys for development and production where possible.
- Rotate keys periodically via the provider dashboards (Groq, Google Cloud, etc.).

---

## 5. Updating After Deployment

Once deployed:

- Any push to the configured GitHub branch (e.g. `main`) will trigger an
  automatic redeploy.
- You do **not** need to click “Deploy” again after code changes.

Workflow:

1. Make local changes.
2. Run and test locally (`streamlit run app.py`).
3. Commit changes:

   ```bash
   git add .
   git commit -m "Your change description"
   git push origin main
   ```

4. Wait for Streamlit Cloud to rebuild and redeploy.
5. Refresh your app URL to see the changes.

---

## 6. Monitoring & Debugging

### Viewing logs

- In Streamlit Cloud:
  - Go to your app → **Manage app** → **Logs**.
  - You can see:
    - Build logs (dependency installation).
    - Runtime logs (Python stdout/stderr, logging output).

### Common issues

- **Import errors**:
  - Ensure the missing library is listed in `requirements.txt`.
- **API key errors**:
  - Check that keys are correctly set in **Secrets**.
  - Confirm variable names match those in `.env.example` and `config.py`.
- **API quota/rate limits**:
  - Check provider dashboards (Groq, Google Cloud).
  - The app will fall back to simpler behaviour but logs warnings.

### Performance monitoring

- Streamlit Cloud is optimized for light to medium workloads.
- For heavier usage:
  - Optimize API calls (see **Scaling & Optimization**).
  - Consider adding caching (`st.cache_data`, `st.cache_resource`) for
    expensive operations if you extend the app.

---

## 7. Scaling & Optimization

Some strategies to keep the app responsive:

- **Caching**
  - Use Streamlit’s caching decorators for:
    - Expensive geocoding calls.
    - Places API queries for popular cities.
  - Be mindful of rate limits and cache invalidation.
- **Session management**
  - Limit how much data you store in `st.session_state`.
  - Avoid storing large binary objects directly.
- **Resource optimization**
  - Keep prompts concise.
  - Limit `max_tokens` on Groq calls to what you actually need.
- **Load testing**
  - You can simulate load by:
    - Running multiple browser sessions.
    - Asking friends/colleagues to try the app.
  - Monitor logs and response times; adjust as needed.

---

## 8. Cost Analysis

Assuming typical demo usage:

- **Groq API**: Free-tier usage (e.g. up to a certain rate per minute).
- **Google Places API**:
  - Free tier often includes ~150 requests/day (check current docs).
  - The app is conservative in the number of requests per query.
- **OpenTripMap API**:
  - Free tier with generous limits; usage here is moderate.
- **Nominatim (OpenStreetMap)**:
  - Free; calls are rate-limited to remain polite.
- **Streamlit Community Cloud**:
  - Free-tier hosting.

**Total expected monthly cost**: **$0.00** for personal/demo use.

---

## 9. Troubleshooting

### App won’t deploy / build fails

- Check the build logs:
  - Missing dependencies → add to `requirements.txt`.
  - Syntax errors → run `python -m compileall .` locally to catch them.
- Ensure `app.py` exists at the repo root and is selected as the main file.

### Deployment timeout

- Large dependency installs can take time.
- If the build times out repeatedly:
  - Ensure no huge, unnecessary dependencies are present.
  - Check network or service status in Streamlit’s status page.

### API keys not working

- Verify:
  - Secrets names match exactly (`GROQ_API_KEY`, `GOOGLE_PLACES_API_KEY`, etc.).
  - Keys are valid and not restricted in a way that blocks usage.
- In logs, look for:
  - 401/403 responses from APIs.
  - Custom error messages in `ConfigError` or agent logs.

### Rate limit errors

- Symptoms:
  - Planner notes indicating fallbacks were used.
  - Warnings in logs from API wrapper functions.
- Actions:
  - Reduce test frequency.
  - Spread out requests over time.
  - Rely on fallbacks; the app is designed to degrade gracefully.

### Map not rendering

- Check:
  - `places_list` exists in the final `AgentState`.
  - Any map-related warnings in the logs.
- If external APIs fail entirely:
  - The map may have fewer markers or may not be generated.
  - The UI will show an informational message rather than crashing.

---

## 10. Getting Help

For more information:

- **Streamlit**
  - Docs: https://docs.streamlit.io/
  - Community: https://discuss.streamlit.io/
- **LangGraph**
  - Docs: https://langchain-ai.github.io/langgraph/
- **Groq**
  - Docs/console: https://console.groq.com/
- **Google Places API**
  - Docs: https://developers.google.com/maps/documentation/places/web-service/overview
- **OpenTripMap API**
  - Docs: https://opentripmap.io/docs

If you encounter issues not covered here, consult the logs, check provider
dashboards, and consider opening an issue in your GitHub repository to track
and resolve the problem.