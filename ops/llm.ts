import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Budgeted LLM client for the weekly job. Any OpenAI-compatible endpoint works (the OmniRoute router, OpenRouter, ...).
 *   LLM_ENDPOINT, LLM_API_KEY, LLM_MODEL            required
 *   LLM_MODEL_FALL_1, LLM_MODEL_FALL_2              tried in order if the previous one fails
 *   LLM_PRICE_IN_PER_M, LLM_PRICE_OUT_PER_M         USD per 1M tokens of the primary model
 *   MONTHLY_BUDGET_USD                              hard cap; the job stops at SAFETY of it
 * Fallback models are billed at the primary prices, so the ledger is an upper bound.
 */
const LEDGER_FILE = "data/ledger.json";
const SAFETY = 0.8;
const MAX_OUT = 1500;

type Ledger = Record<string, { spentUsd: number; calls: number }>;

const env = (k: string) => process.env[k]?.trim() ?? "";
const month = () => new Date().toISOString().slice(0, 7);

function readLedger(): Ledger {
  return existsSync(LEDGER_FILE) ? (JSON.parse(readFileSync(LEDGER_FILE, "utf8")) as Ledger) : {};
}

export function budget() {
  const cap = Number(env("MONTHLY_BUDGET_USD") || "1.5");
  const spent = readLedger()[month()]?.spentUsd ?? 0;
  return { cap, spent, left: Math.max(0, cap * SAFETY - spent) };
}

function record(usd: number) {
  const l = readLedger();
  const m = month();
  const cur = l[m] ?? { spentUsd: 0, calls: 0 };
  l[m] = { spentUsd: Number((cur.spentUsd + usd).toFixed(6)), calls: cur.calls + 1 };
  mkdirSync(dirname(LEDGER_FILE), { recursive: true });
  writeFileSync(LEDGER_FILE, JSON.stringify(l, null, 2) + "\n");
}

export const llmConfigured = () => Boolean(env("LLM_ENDPOINT") && env("LLM_API_KEY") && env("LLM_MODEL"));

export interface Completion {
  text: string;
  model: string;
  usd: number;
}

export async function complete(system: string, user: string): Promise<Completion> {
  if (!llmConfigured()) throw new Error("LLM_ENDPOINT, LLM_API_KEY and LLM_MODEL must be set");
  const pIn = Number(env("LLM_PRICE_IN_PER_M"));
  const pOut = Number(env("LLM_PRICE_OUT_PER_M"));
  if (!(pIn > 0) || !(pOut > 0)) throw new Error("LLM_PRICE_IN_PER_M and LLM_PRICE_OUT_PER_M must be positive numbers");
  // Worst case for this call: all input tokens (chars/3, a safe overestimate) plus the output cap.
  const worst = ((system.length + user.length) / 3) * (pIn / 1e6) + MAX_OUT * (pOut / 1e6);
  const b = budget();
  if (worst > b.left) throw new BudgetError(`budget reached: spent $${b.spent.toFixed(4)} of $${b.cap} (stop at ${SAFETY * 100}%)`);

  // OmniRoute names OpenRouter models "openrouter/<id>"; OpenRouter itself wants just "<id>".
  const direct = new URL(env("LLM_ENDPOINT")).hostname.endsWith("openrouter.ai");
  const models = [env("LLM_MODEL"), env("LLM_MODEL_FALL_1"), env("LLM_MODEL_FALL_2")]
    .filter(Boolean)
    .map((m) => (direct ? m.replace(/^openrouter\//, "") : m));
  let lastErr = "";
  for (const model of models) {
    try {
      const res = await fetch(env("LLM_ENDPOINT"), {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${env("LLM_API_KEY")}` },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: MAX_OUT,
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
        }),
        signal: AbortSignal.timeout(90_000),
      });
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 160)}`);
      const j = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const text = j.choices?.[0]?.message?.content ?? "";
      if (!text) throw new Error("empty completion");
      const tIn = j.usage?.prompt_tokens ?? (system.length + user.length) / 3;
      const tOut = j.usage?.completion_tokens ?? MAX_OUT;
      const usd = (tIn * pIn + tOut * pOut) / 1e6;
      record(usd);
      return { text, model, usd };
    } catch (e) {
      lastErr = `${model}: ${(e as Error).message}`;
    }
  }
  throw new Error(`all models failed; last: ${lastErr}`);
}

export class BudgetError extends Error {}

/** Fail fast, with a message a person can act on, when the router is not running. Any HTTP answer counts as up. */
export async function ping(): Promise<void> {
  try {
    await fetch(new URL(env("LLM_ENDPOINT")).origin, { signal: AbortSignal.timeout(8000) });
  } catch {
    throw new Error(`LLM endpoint ${new URL(env("LLM_ENDPOINT")).origin} is unreachable: start OmniRoute, then run again`);
  }
}
