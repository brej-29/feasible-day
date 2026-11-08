import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Search Console re-checks this file; deleting or editing it silently un-verifies the site.
describe("search engine verification", () => {
  it("keeps the Google verification file byte-for-byte", () => {
    const f = "google30a370909dd29834.html";
    expect(readFileSync(`public/${f}`, "utf8").trim()).toBe(`google-site-verification: ${f}`);
  });

  it("keeps the Google verification meta tag in the page head", () => {
    expect(readFileSync("index.html", "utf8")).toContain('name="google-site-verification" content="pq2cb3FUYdrTFsuAxEFw_oArHkQPh1CA3lESZkgoN-g"');
  });
});
