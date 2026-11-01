import type { Poi } from "./types";

const STOP = new Set(["the", "a", "an", "of", "de", "la", "le", "les", "el", "los", "las", "di", "der", "die", "das", "du", "des", "del", "da", "do"]);

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9Ѐ-ӿ぀-ヿ一-鿿]+/g, " ")
    .trim();
}

const tokens = (s: string) => normalize(s).split(" ").filter((t) => t && !STOP.has(t)).sort().join(" ");

export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const range = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const am = new Array(a.length).fill(false);
  const bm = new Array(b.length).fill(false);
  let m = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = Math.max(0, i - range); j < Math.min(b.length, i + range + 1); j++) {
      if (!bm[j] && a[i] === b[j]) {
        am[i] = bm[j] = true;
        m++;
        break;
      }
    }
  }
  if (!m) return 0;
  let t = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (am[i]) {
      while (!bm[k]) k++;
      if (a[i] !== b[k]) t++;
      k++;
    }
  }
  const jaro = (m / a.length + m / b.length + (m - t / 2) / m) / 3;
  let l = 0;
  while (l < 4 && a[l] === b[l]) l++;
  return jaro + l * 0.1 * (1 - jaro);
}

export const MATCH_THRESHOLD = 0.92;

/** Best snapshot feature for a free-text venue name, or null. Rule is fixed in docs/PREREGISTRATION.md. */
export function matchPoi(name: string, pois: Poi[]): { poi: Poi; score: number } | null {
  const n = normalize(name);
  const nt = tokens(name);
  if (!n) return null;
  let best: { poi: Poi; score: number } | null = null;
  for (const p of pois) {
    for (const cand of [p.name, p.nameEn, ...(p.alt?.split(";") ?? [])]) {
      if (!cand) continue;
      const score = tokens(cand) === nt ? 1 : jaroWinkler(n, normalize(cand));
      if (score >= MATCH_THRESHOLD && (!best || score > best.score)) best = { poi: p, score };
    }
  }
  return best;
}
