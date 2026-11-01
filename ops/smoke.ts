import { budget, complete } from "./llm";

/** npm run ops:smoke : one tiny call to prove endpoint, key, model, pricing and the ledger work. */
const r = await complete("Reply with JSON only.", 'Return {"ok":true}');
const b = budget();
console.log(`model=${r.model} cost=$${r.usd.toFixed(6)} reply=${r.text.slice(0, 80)}`);
console.log(`spent=$${b.spent.toFixed(6)} cap=$${b.cap}`);
