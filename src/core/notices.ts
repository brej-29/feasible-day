/** Weekly advisories per city. Written by ops/notices.ts, read by the app. Text is data: always rendered as text. */
export const NOTICE_KINDS = ["closure", "strike", "festival", "weather", "safety", "transport", "other"] as const;
export type NoticeKind = (typeof NOTICE_KINDS)[number];

export interface Notice {
  kind: NoticeKind;
  text: string;
  /** the article this came from; every notice must have one */
  url: string;
  source: string;
  /** date the article was seen, YYYY-MM-DD */
  date: string;
}

export interface NoticeFile {
  generatedAt: string;
  cities: Record<string, Notice[]>;
  /** per city: the day it was last successfully checked (a throttled news feed leaves some cities stale) */
  checked?: Record<string, string>;
}

/** Returns a safe notice, or null. Shared by the job (before writing) and the app (before showing). */
export function cleanNotice(n: unknown): Notice | null {
  if (!n || typeof n !== "object") return null;
  const o = n as Record<string, unknown>;
  const kind = NOTICE_KINDS.find((k) => k === o.kind);
  const text = typeof o.text === "string" ? o.text.replace(/\s+/g, " ").trim().slice(0, 220) : "";
  const url = typeof o.url === "string" ? o.url : "";
  const date = typeof o.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.date) ? o.date : "";
  let source = "";
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    source = u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  return kind && text && date ? { kind, text, url, source, date } : null;
}

export const REQUEST_REPO = "brej-29/feasible-day";
