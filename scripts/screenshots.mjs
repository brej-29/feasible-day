// Captures README screenshots with the locally installed Edge. Needs `npm run dev` or `npm run preview` running.
import { chromium } from "playwright-core";

const base = process.argv[2] ?? "http://localhost:5173/";
const browser = await chromium.launch({ channel: "msedge" });
const shot = async (file, hash, size, after) => {
  const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
  await page.goto(base + hash);
  await page.waitForTimeout(500);
  if (after) await after(page);
  await page.waitForTimeout(4500);
  await page.screenshot({ path: file });
  await page.close();
};
await shot("docs/img/plan.png", "#/paris/culture/2026-11-16/1", { width: 1360, height: 820 });
await shot("docs/img/evidence.png", "#/paris/culture/2026-11-16/1", { width: 1360, height: 1500 }, async (p) => {
  await p.getByRole("tab", { name: "Evidence" }).click();
});
await shot("docs/img/mobile.png", "#/rome/mixed/2026-11-22/1", { width: 390, height: 844 });
await browser.close();
