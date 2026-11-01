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
  /** State or province, shown as a group in the picker */
  region?: string;
  /** Added after the pre-registered 12 cities: evaluated separately, never used to tune the planner */
  ext?: true;
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
  { slug: "mumbai", name: "Mumbai", country: "India", lat: 18.9400, lon: 72.8350, tz: "Asia/Kolkata", cc: "in", region: "Maharashtra" },
  { slug: "chennai", name: "Chennai", country: "India", region: "Tamil Nadu", lat: 13.0500, lon: 80.2700, tz: "Asia/Kolkata", cc: "in", ext: true },
  { slug: "madurai", name: "Madurai", country: "India", region: "Tamil Nadu", lat: 9.9195, lon: 78.1193, tz: "Asia/Kolkata", cc: "in", ext: true },
  { slug: "ernakulam", name: "Ernakulam (Kochi)", country: "India", region: "Kerala", lat: 9.9816, lon: 76.2760, tz: "Asia/Kolkata", cc: "in", ext: true },
  { slug: "fort-kochi", name: "Fort Kochi", country: "India", region: "Kerala", lat: 9.9658, lon: 76.2425, tz: "Asia/Kolkata", cc: "in", ext: true },
  { slug: "thiruvananthapuram", name: "Thiruvananthapuram", country: "India", region: "Kerala", lat: 8.4855, lon: 76.9492, tz: "Asia/Kolkata", cc: "in", ext: true },
  { slug: "bengaluru", name: "Bengaluru", country: "India", region: "Karnataka", lat: 12.9760, lon: 77.5950, tz: "Asia/Kolkata", cc: "in", ext: true },
  { slug: "hyderabad", name: "Hyderabad", country: "India", region: "Telangana", lat: 17.3616, lon: 78.4747, tz: "Asia/Kolkata", cc: "in", ext: true },
  { slug: "pune", name: "Pune", country: "India", region: "Maharashtra", lat: 18.5195, lon: 73.8553, tz: "Asia/Kolkata", cc: "in", ext: true },
  { slug: "kyoto", name: "Kyoto", country: "Japan", lat: 35.0036, lon: 135.7681, tz: "Asia/Tokyo", cc: "jp", ext: true },
  { slug: "osaka", name: "Osaka", country: "Japan", lat: 34.6687, lon: 135.5013, tz: "Asia/Tokyo", cc: "jp", ext: true },
  { slug: "seoul", name: "Seoul", country: "South Korea", lat: 37.5700, lon: 126.9800, tz: "Asia/Seoul", cc: "kr", ext: true },
  { slug: "busan", name: "Busan", country: "South Korea", lat: 35.1000, lon: 129.0300, tz: "Asia/Seoul", cc: "kr", ext: true },
  { slug: "beijing", name: "Beijing", country: "China", lat: 39.9163, lon: 116.3972, tz: "Asia/Shanghai", cc: "cn", ext: true },
  { slug: "shanghai", name: "Shanghai", country: "China", lat: 31.2330, lon: 121.4850, tz: "Asia/Shanghai", cc: "cn", ext: true },
  { slug: "xian", name: "Xi'an", country: "China", lat: 34.2583, lon: 108.9420, tz: "Asia/Shanghai", cc: "cn", ext: true },
];
