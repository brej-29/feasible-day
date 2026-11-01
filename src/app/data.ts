import type { Evidence } from "../core/evidence";
import type { DayDate, Snapshot } from "../core/types";

const modules = import.meta.glob("../../data/snapshots/*.json", { import: "default" }) as Record<string, () => Promise<Snapshot>>;

export const CITY_SLUGS = Object.keys(modules).map((p) => p.split("/").pop()!.replace(".json", ""));

export function loadSnapshot(slug: string): Promise<Snapshot> {
  const key = Object.keys(modules).find((k) => k.endsWith(`/${slug}.json`));
  if (!key) return Promise.reject(new Error(`No snapshot for ${slug}`));
  return modules[key]();
}

export async function loadEvidence(): Promise<Evidence> {
  const res = await fetch(`${import.meta.env.BASE_URL}evidence.json`);
  if (!res.ok) throw new Error(`evidence.json: HTTP ${res.status}`);
  return res.json();
}

export const pad = (n: number) => String(n).padStart(2, "0");
export const fmtTime = (min: number) => `${pad(Math.floor(min / 60) % 24)}:${pad(Math.round(min % 60))}`;

export function parseDate(s: string): DayDate {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}

export function addDays(s: string, n: number): string {
  const { y, m, d } = parseDate(s);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function labelDate(s: string): string {
  const { y, m, d } = parseDate(s);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

export function tomorrow(): string {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}
