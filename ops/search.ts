/**
 * Web search through the OmniRoute /v1/search endpoint (providers such as tavily-search and serper-search).
 * The response shape depends on the provider and has not been seen by this code yet, so it is read defensively:
 * any of the usual array names and field names is accepted. Search results are untrusted text.
 *   SEARCH_ENDPOINT   default: origin of LLM_ENDPOINT + /v1/search
 *   SEARCH_PROVIDERS  comma list tried in order, default "tavily-search,serper-search"
 */
export interface Article { url: string; title: string; date: string; snippet?: string }

const env = (k: string) => process.env[k]?.trim() ?? "";
const today = () => new Date().toISOString().slice(0, 10);

export const searchConfigured = () => Boolean(env("LLM_ENDPOINT") && env("LLM_API_KEY"));

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Search APIs often omit the publication date; the day the result was seen is the honest fallback. */
function day(v: unknown): string {
  const t = typeof v === "string" || typeof v === "number" ? Date.parse(String(v)) : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : today();
}

export function toArticles(json: unknown): Article[] {
  const o = (json ?? {}) as Raw;
  const data = (o.data ?? {}) as Raw;
  const list = [o.results, data.results, o.organic, o.news, o.items, o.data, json].find(Array.isArray) as Raw[] | undefined;
  const out: Article[] = [];
  for (const r of list ?? []) {
    if (!r || typeof r !== "object") continue;
    const url = str(r.url) || str(r.link);
    const title = str(r.title) || str(r.name);
    if (!/^https?:\/\//.test(url) || !title) continue;
    const snippet = (str(r.content) || str(r.snippet) || str(r.description)).replace(/\s+/g, " ").trim().slice(0, 200);
    out.push({ url, title: title.replace(/\s+/g, " ").trim().slice(0, 200), date: day(r.published_date ?? r.publishedDate ?? r.date ?? r.age), snippet: snippet || undefined });
  }
  return out;
}

export async function routerSearch(query: string, maxResults = 8): Promise<Article[]> {
  const endpoint = env("SEARCH_ENDPOINT") || `${new URL(env("LLM_ENDPOINT")).origin}/v1/search`;
  const providers = (env("SEARCH_PROVIDERS") || "tavily-search,serper-search").split(",").map((p) => p.trim()).filter(Boolean);
  let last = "";
  for (const provider of providers) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${env("LLM_API_KEY")}` },
        body: JSON.stringify({ provider, query, max_results: maxResults }),
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 120)}`);
      const arts = toArticles(await res.json());
      if (arts.length) return arts;
      last = `${provider}: no results`;
    } catch (e) {
      last = `${provider}: ${(e as Error).message}`;
    }
  }
  throw new Error(`router search failed; last: ${last}`);
}
