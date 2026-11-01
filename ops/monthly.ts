import { budget, llmConfigured } from "./llm";
import { runNotices } from "./notices";
import { runRequests } from "./requests";

/**
 * npm run monthly [-- notices|requests]   (local: npx tsx --env-file=.env ops/monthly.ts)
 * Each step is independent: one failing or being skipped never blocks the other.
 * Map snapshots are deliberately NOT refreshed here: the evaluation numbers are pinned to the committed snapshots.
 */
const only = process.argv[2];
const steps: [string, () => Promise<string>][] = [
  ["notices", async () => (llmConfigured() ? runNotices() : "notices: skipped, LLM_ENDPOINT / LLM_API_KEY / LLM_MODEL not set")],
  ["requests", runRequests],
];

let failed = 0;
for (const [name, run] of steps) {
  if (only && only !== name) continue;
  try {
    console.log(await run());
  } catch (e) {
    failed++;
    console.error(`${name} failed: ${(e as Error).message}`);
  }
}
const b = budget();
console.log(`LLM spend this month: $${b.spent.toFixed(4)} of $${b.cap} cap`);
process.exitCode = failed ? 1 : 0;
