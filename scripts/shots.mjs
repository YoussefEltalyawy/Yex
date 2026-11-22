// Visual test harness: renders pages from the dev server (browser mock backend)
// in headless Edge and saves screenshots to .shots/. Also fails on console errors.
// Usage: node scripts/shots.mjs [routeFilter] [--dark-only|--light-only] [--w=1440 --h=900]
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const args = process.argv.slice(2);
const filter = args.find((a) => !a.startsWith("--"));
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.split("=")[1] ?? d;
const base = opt("url", "http://localhost:1420");
const width = Number(opt("w", 1440));
const height = Number(opt("h", 900));
const themes = args.includes("--dark-only") ? ["dark"] : args.includes("--light-only") ? ["light"] : ["light", "dark"];

const routes = [
  ["home", "home"],
  ["focus", "focus"],
  ["tasks", "tasks"],
  ["exams", "exams"],
  ["review", "review"],
  ["analytics", "analytics"],
  ["settings", "settings"],
  ["subject", "subject?id=@subject:Physics"],
  ["lesson-notes", "lesson?id=@lesson:Limits"],
  ["lesson-mistakes", "lesson?id=@lesson:Limits&tab=mistakes"],
  ["lesson-arabic", "lesson?id=@lesson:الحال"],
  ["tasks-detail", "tasks?task=@task:Review Kirchhoff's mistakes"],
  ["tasks-upcoming", "tasks?view=upcoming"],
  ["exams-detail", "exams?exam=@exam:Physics trial 3"],
  ["focus-dusk", "focus", async (p) => { await p.evaluate(() => localStorage.setItem("yex-focus-scene", "dusk")); await p.evaluate(() => (location.hash = "#/home")); await p.waitForTimeout(200); await p.evaluate(() => (location.hash = "#/focus")); await p.waitForTimeout(600); }],
  ["palette", "home", async (p) => { await p.keyboard.press("Control+k"); await p.keyboard.type("lim"); await p.waitForTimeout(400); }],
];

mkdirSync(".shots", { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const errors = [];
for (const theme of themes) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, colorScheme: theme });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(`[${theme}] ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`[${theme}] pageerror: ${e.message}`));
  await page.addInitScript((t) => localStorage.setItem("yex-theme", t), theme);
  await page.goto(`${base}/?reset#/home`, { timeout: 180000 });
  await page.waitForTimeout(800);
  // Resolve named targets (subject:Physics / lesson:Limits) against the seeded mock DB.
  const lookup = async (kind, name) =>
    page.evaluate(([k, n]) => JSON.parse(localStorage.getItem("yex-mock-v1")).rows[k].find((r) => (r.name ?? r.title) === n)?.id, [kind, name]);
  await page.waitForFunction(() => localStorage.getItem("yex-mock-v1"));
  for (const [file, target, action] of routes) {
    if (filter && !file.includes(filter)) continue;
    let hash = target;
    for (const m of target.matchAll(/@(\w+):([^&]+)/g)) hash = hash.replace(m[0], await lookup(m[1], m[2]));
    await page.evaluate((h) => (location.hash = `#/${h}`), hash);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);
    if (action) await action(page);
    await page.screenshot({ path: `.shots/${file}-${theme}.png` });
    if (action) await page.keyboard.press("Escape");
    console.log(`shot ${file}-${theme}`);
  }
  await ctx.close();
}
await browser.close();
if (errors.length) {
  console.log("\nCONSOLE ERRORS:\n" + [...new Set(errors)].join("\n"));
  process.exitCode = 1;
}
