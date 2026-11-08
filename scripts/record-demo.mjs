// Records the README demo GIFs with the locally installed Edge and ffmpeg.
// Needs the built app served first:  npm run build && npx vite preview --port 4173
// Run: node scripts/record-demo.mjs [baseUrl]
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const base = process.argv[2] ?? "http://localhost:4173/";
const tmp = mkdtempSync(join(tmpdir(), "demo-"));
mkdirSync("docs/img", { recursive: true });
const browser = await chromium.launch({ channel: "msedge" });

async function record(name, size, trimSeconds, script) {
  const dir = join(tmp, name);
  const ctx = await browser.newContext({ viewport: size, recordVideo: { dir, size } });
  const page = await ctx.newPage();
  await script(page);
  await ctx.close(); // flushes the video
  const webm = join(dir, readdirSync(dir)[0]);
  const palette = "fps=6,scale=800:-1:flags=lanczos";
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-ss", String(trimSeconds), "-i", webm,
    "-vf", `${palette},split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
    "-loop", "0", `docs/img/${name}.gif`,
  ]);
  console.log("wrote", `docs/img/${name}.gif`);
}

const day = "2026-11-16";

await record("demo-plan", { width: 1280, height: 720 }, 7, async (p) => {
  await p.goto(`${base}#/paris/culture/${day}/1`);
  await p.waitForTimeout(8500); // vector map style and worker download
  for (const i of [0, 2, 4, 6]) {
    await p.locator(".stop").nth(i).click();
    await p.waitForTimeout(1300);
  }
  await p.getByText("food", { exact: true }).click();
  await p.waitForTimeout(2200);
  await p.getByText("mixed", { exact: true }).click();
  await p.waitForTimeout(1800);
  await p.locator("select").first().selectOption("kyoto");
  await p.waitForTimeout(3200);
  await p.locator("select").first().selectOption("hyderabad");
  await p.waitForTimeout(3800);
});

await record("demo-evidence", { width: 1280, height: 720 }, 1, async (p) => {
  await p.goto(`${base}#/paris/culture/${day}/1`);
  await p.waitForTimeout(1200);
  await p.getByRole("tab", { name: "Evidence" }).click();
  await p.waitForTimeout(1800);
  for (let i = 0; i < 6; i++) {
    await p.mouse.wheel(0, 520);
    await p.waitForTimeout(1100);
  }
  await p.getByRole("tab", { name: "Request a city" }).click();
  await p.waitForTimeout(1800);
});

await browser.close();
