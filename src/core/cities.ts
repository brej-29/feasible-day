export interface City {
  slug: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  /** IANA zone, used only to label local times in the UI */
  tz: string;
  /** ISO 3166-1 alpha-2, for public-holiday rules in opening_hours */
  cc: string;
}

export const CITIES: City[] = [
  { slug: "paris", name: "Paris", country: "France", lat: 48.8584, lon: 2.3470, tz: "Europe/Paris", cc: "fr" },
  { slug: "london", name: "London", country: "United Kingdom", lat: 51.5100, lon: -0.1250, tz: "Europe/London", cc: "gb" },
  { slug: "rome", name: "Rome", country: "Italy", lat: 41.8986, lon: 12.4768, tz: "Europe/Rome", cc: "it" },
  { slug: "barcelona", name: "Barcelona", country: "Spain", lat: 41.3874, lon: 2.1700, tz: "Europe/Madrid", cc: "es" },
  { slug: "berlin", name: "Berlin", country: "Germany", lat: 52.5200, lon: 13.4050, tz: "Europe/Berlin", cc: "de" },
  { slug: "amsterdam", name: "Amsterdam", country: "Netherlands", lat: 52.3702, lon: 4.8952, tz: "Europe/Amsterdam", cc: "nl" },
  { slug: "lisbon", name: "Lisbon", country: "Portugal", lat: 38.7110, lon: -9.1390, tz: "Europe/Lisbon", cc: "pt" },
  { slug: "vienna", name: "Vienna", country: "Austria", lat: 48.2082, lon: 16.3738, tz: "Europe/Vienna", cc: "at" },
  { slug: "prague", name: "Prague", country: "Czechia", lat: 50.0870, lon: 14.4210, tz: "Europe/Prague", cc: "cz" },
  { slug: "new-york", name: "New York", country: "United States", lat: 40.7580, lon: -73.9855, tz: "America/New_York", cc: "us" },
  { slug: "tokyo", name: "Tokyo", country: "Japan", lat: 35.6762, lon: 139.7500, tz: "Asia/Tokyo", cc: "jp" },
  { slug: "mumbai", name: "Mumbai", country: "India", lat: 18.9400, lon: 72.8350, tz: "Asia/Kolkata", cc: "in" },
];
