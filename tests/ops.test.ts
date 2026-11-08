import { describe, expect, it } from "vitest";
import { cleanNotice } from "../src/core/notices";
import { pick } from "../ops/notices";
import { field } from "../ops/requests";
import { toArticles } from "../ops/search";

const arts = [
  { url: "https://news.example.com/a", title: "Bus strike on Monday", date: "2026-10-30" },
  { url: "https://news.example.com/b", title: "Museum closed for repairs", date: "2026-10-29" },
];

describe("notices", () => {
  it("takes url and date from the article, never from the model", () => {
    const raw = '```json\n{"items":[{"i":1,"kind":"strike","text":"Buses may not run on Monday.","url":"https://evil.example"}]}\n```';
    const out = pick(raw, arts);
    expect(out).toHaveLength(1);
    expect(out[0].url).toBe("https://news.example.com/a");
    expect(out[0].source).toBe("news.example.com");
  });

  it("drops out-of-range numbers, duplicates, bad kinds and non-JSON", () => {
    const raw = '{"items":[{"i":9,"kind":"strike","text":"x"},{"i":2,"kind":"nope","text":"y"},{"i":2,"kind":"closure","text":"ok"},{"i":2,"kind":"closure","text":"dup"}]}';
    expect(pick(raw, arts).map((n) => n.text)).toEqual(["ok"]);
    expect(pick("I cannot help", arts)).toEqual([]);
  });

  it("rejects javascript: links and missing dates", () => {
    expect(cleanNotice({ kind: "other", text: "x", url: "javascript:alert(1)", date: "2026-10-01" })).toBeNull();
    expect(cleanNotice({ kind: "other", text: "x", url: "https://a.example/p", date: "soon" })).toBeNull();
  });
});

describe("city requests", () => {
  it("reads issue-form fields and strips markup", () => {
    const body = "### City or area\n\nCoimbatore <script>\n\n### Country\n\nIndia\n\n### Why, or what to see (optional)\n\n_No response_";
    expect(field(body, "City or area")).toBe("Coimbatore script");
    expect(field(body, "Country")).toBe("India");
    expect(field(body, "Missing")).toBe("");
  });

  it("keeps only place-name characters, so issue text cannot break out of markdown or code", () => {
    const body = '### City or area\n\nX", ext: true }); process.exit(1) //`| evil |\n\n### Country\n\n[a](http://x)';
    const city = field(body, "City or area");
    expect(city).not.toMatch(/["`|;\/<>[\]]/);
    expect(field(body, "Country")).not.toMatch(/[[\]/:]/);
  });
});

describe("router search parsing", () => {
  it("accepts the common result shapes and drops entries without a link or title", () => {
    const tavily = { results: [{ title: " Bus strike ", url: "https://a.example/x", content: "Buses stop Monday", published_date: "2026-11-05" }, { title: "no link" }] };
    const serper = { organic: [{ title: "Museum closed", link: "https://b.example/y", snippet: "Repairs" }] };
    expect(toArticles(tavily)).toEqual([{ url: "https://a.example/x", title: "Bus strike", date: "2026-11-05", snippet: "Buses stop Monday" }]);
    const s = toArticles(serper);
    expect(s).toHaveLength(1);
    expect(s[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(toArticles(null)).toEqual([]);
    expect(toArticles({ results: [{ title: "x", url: "javascript:alert(1)" }] })).toEqual([]);
  });
});
