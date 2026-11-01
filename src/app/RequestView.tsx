import { useState } from "react";
import { CITIES } from "../core/cities";
import { REQUEST_REPO } from "../core/notices";

/** No backend: the request becomes a prefilled GitHub issue. The monthly job reads those issues. */
export function RequestView() {
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [why, setWhy] = useState("");
  const known = CITIES.find((c) => c.name.toLowerCase() === city.trim().toLowerCase());
  const ok = city.trim().length >= 2 && country.trim().length >= 2 && !known;
  const q = new URLSearchParams({ template: "city-request.yml", title: `City request: ${city.trim()}, ${country.trim()}`, city: city.trim(), country: country.trim(), why: why.trim() });
  const href = `https://github.com/${REQUEST_REPO}/issues/new?${q}`;
  return (
    <div className="evidence method">
      <section className="block">
        <h2>Request a city or a small country</h2>
        <p>Cities are added by hand once a month, after the data is checked. There are {CITIES.length} today. Your request is a public GitHub issue (a free GitHub account is needed), so nothing is stored anywhere else.</p>
        <form className="reqform" onSubmit={(e) => e.preventDefault()}>
          <label>City or area
            <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} placeholder="e.g. Coimbatore" autoComplete="off" />
          </label>
          <label>Country
            <input value={country} onChange={(e) => setCountry(e.target.value)} maxLength={80} placeholder="e.g. India" autoComplete="off" />
          </label>
          <label>Why, or what to see (optional)
            <textarea value={why} onChange={(e) => setWhy(e.target.value)} maxLength={300} rows={3} />
          </label>
          {known && <p className="state">{known.name} is already available. Pick it in the Plan tab.</p>}
          <p className="muted">For a whole small country, name its capital or main tourist town. A day plan needs a walkable core.</p>
          <a className={`btn${ok ? "" : " off"}`} href={ok ? href : undefined} aria-disabled={!ok} target="_blank" rel="noopener noreferrer">Open the request on GitHub</a>
        </form>
      </section>
    </div>
  );
}
