import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtStop } from "../src/core/verify";
import { PROFILE_TEXT, type Scenario } from "./scenarios";

/** Model ids are config: free-tier catalogs change. Override with LLM_70B / LLM_8B. */
export const MODELS: Record<string, string> = {
  "llm-70b": process.env.LLM_70B ?? "meta-llama/Llama-3.3-70B-Instruct",
  "llm-8b": process.env.LLM_8B ?? "meta-llama/Llama-3.1-8B-Instruct",
};
const ENDPOINT = process.env.LLM_ENDPOINT ?? "https://router.huggingface.co/v1/chat/completions";
export const TEMPERATURE = 0.7;

export function prompt(s: Scenario): string {
  return [
    `Plan one day in ${s.city} for a visitor on ${s.day.label}.`,
    `Interests: ${PROFILE_TEXT[s.profile]}. They walk everywhere. The day runs from 09:00 to 21:00 at the earliest and latest.`,
    "Include lunch. Every venue must be open at the times you schedule it, and the time between the end of one stop",
    "and the start of the next must be enough to walk there.",
    'Reply with JSON only, no prose: {"stops":[{"name":"venue name","start":"HH:MM","end":"HH:MM"}]}',
  ].join(" ");
}

function token(): string {
  if (process.env.HF_TOKEN) return process.env.HF_TOKEN;
  const f = join(homedir(), ".cache", "huggingface", "token");
  if (existsSync(f)) return readFileSync(f, "utf8").trim();
  throw new Error("No Hugging Face token: set HF_TOKEN or run `hf auth login`");
}

const LEAD = /^(?:(?:breakfast|brunch|lunch|dinner|coffee|drinks?|snack)(?: break)?(?: at| in)?|visit|explore|tour of|stroll (?:through|in|around|along)|walk (?:through|along|around)|arrive at|head to|go to)\s+/i;
const TRANSIT = /^(?:walk(?:ing)?|travel(?:l?ing)?|transit|metro|taxi|bus|commute)\b.*\b(?:to|from)\b/i;
/** Strip filler so "Lunch at Le Comptoir" is matched as "Le Comptoir"; pure transit lines are not stops. */
export const cleanName = (n: string) => n.replace(LEAD, "").trim();

const toMin = (t: string) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};

export function parseStops(text: string): ExtStop[] | null {
  const body = text.replace(/```(?:json)?/g, "").trim();
  const a = body.indexOf("{");
  const b = body.lastIndexOf("}");
  if (a < 0 || b < a) return null;
  try {
    const j = JSON.parse(body.slice(a, b + 1)) as { stops?: { name?: string; start?: string; end?: string }[] };
    const stops = (j.stops ?? [])
      .filter((s) => !TRANSIT.test(String(s.name ?? "")))
      .map((s) => ({ name: String(s.name ?? ""), startMin: toMin(String(s.start)), endMin: toMin(String(s.end)) }))
      .map((s) => ({ ...s, name: cleanName(s.name) }))
      .filter((s) => s.name && !TRANSIT.test(s.name) && Number.isFinite(s.startMin) && Number.isFinite(s.endMin));
    return stops.length ? stops : null;
  } catch {
    return null;
  }
}

export interface LlmRun {
  system: string;
  model: string;
  scenario: string;
  rep: number;
  raw: string;
  stops: ExtStop[] | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Cached on disk: re-running the evaluation without a token reproduces the numbers from stored outputs. */
export async function llmRun(system: string, s: Scenario, rep: number, allowCall: boolean): Promise<LlmRun | null> {
  const dir = join("data", "llm", system);
  const file = join(dir, `${s.id}-r${rep}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")) as LlmRun;
  if (!allowCall) return null;
  mkdirSync(dir, { recursive: true });
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODELS[system], temperature: TEMPERATURE, max_tokens: 1200,
        messages: [{ role: "user", content: prompt(s) }],
      }),
      signal: AbortSignal.timeout(120_000),
    }).catch(() => null);
    if (res?.ok) {
      const j = (await res.json()) as { choices: { message: { content: string } }[] };
      const raw = j.choices[0].message.content;
      const run: LlmRun = { system, model: MODELS[system], scenario: s.id, rep, raw, stops: parseStops(raw) };
      writeFileSync(file, JSON.stringify(run));
      return run;
    }
    if (res && (res.status === 402 || res.status === 401)) throw new Error(`LLM quota or auth problem: HTTP ${res.status}`);
    await sleep(3000 * (attempt + 1));
  }
  console.warn("giving up on", system, s.id, rep);
  return null;
}
