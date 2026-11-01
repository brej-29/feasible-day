import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

export interface Pin {
  lat: number;
  lon: number;
  label: string;
  state: "open" | "unknown" | "closed";
}

// OpenFreeMap: free vector tiles, no API key. Style URL is config so a swap does not touch code.
const STYLE = import.meta.env.VITE_MAP_STYLE ?? "https://tiles.openfreemap.org/styles/positron";

function pinEl(n: number, p: Pin, active: boolean, onClick: () => void): HTMLElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "pin-wrap";
  b.setAttribute("aria-label", `Stop ${n}: ${p.label}`);
  const pin = document.createElement("span");
  pin.className = `pin pin-${p.state}${active ? " pin-active" : ""}`;
  const num = document.createElement("span");
  num.textContent = String(n);
  pin.append(num);
  b.append(pin);
  b.addEventListener("click", onClick);
  return b;
}

const line = (pins: Pin[]) => ({
  type: "Feature" as const, properties: {},
  geometry: { type: "LineString" as const, coordinates: pins.map((p) => [p.lon, p.lat]) },
});

export function MapView({
  pins, active, onSelect, label,
}: { pins: Pin[]; active: number | null; onSelect: (i: number) => void; label: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const ready = useRef(false);
  const markers = useRef<maplibregl.Marker[]>([]);
  const fitted = useRef<Pin[] | null>(null);
  const latest = useRef({ pins, active, onSelect });
  latest.current = { pins, active, onSelect };

  const draw = () => {
    const m = map.current;
    if (!m || !ready.current) return;
    const { pins: ps, active: a, onSelect: sel } = latest.current;
    (m.getSource("route") as maplibregl.GeoJSONSource).setData(line(ps));
    markers.current.forEach((x) => x.remove());
    markers.current = ps.map((p, i) =>
      new maplibregl.Marker({ element: pinEl(i + 1, p, i === a, () => sel(i)) }).setLngLat([p.lon, p.lat]).addTo(m),
    );
    if (fitted.current !== ps && ps.length) {
      fitted.current = ps;
      const b = new maplibregl.LngLatBounds();
      ps.forEach((p) => b.extend([p.lon, p.lat]));
      m.fitBounds(b, { padding: 56, maxZoom: 16, duration: 600 });
    }
  };

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = new maplibregl.Map({ container: el.current, style: STYLE, center: [2.35, 48.85], zoom: 12, attributionControl: { compact: true } });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.on("load", () => {
      m.addSource("route", { type: "geojson", data: line([]) });
      m.addLayer({ id: "route", type: "line", source: "route", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#14181C", "line-width": 3, "line-dasharray": [0.4, 2.2] } });
      ready.current = true;
      draw();
    });
    map.current = m;
    return () => {
      ready.current = false;
      m.remove();
      map.current = null;
    };
  }, []);

  useEffect(draw, [pins, active, onSelect]);

  useEffect(() => {
    const ro = new ResizeObserver(() => map.current?.resize());
    if (el.current) ro.observe(el.current);
    return () => ro.disconnect();
  }, []);

  return <div ref={el} className="map" role="region" aria-label={label} />;
}
