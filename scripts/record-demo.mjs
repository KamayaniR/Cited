// Records the Demo tab video: one full run of the loop on demo data.
// Start the app in demo mode first, on its own port so it never touches your live workspace:
//   npm run build && CITED_FORCE_MOCK=true SENDING_ENABLED=false npx next start -p 3200
//   BASE=http://localhost:3200 npm run record-demo
import { chromium } from "playwright";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3200";
const OUT = join(process.cwd(), "public", "demo");
const TMP = join(OUT, ".rec");
mkdirSync(TMP, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: TMP, size: { width: 1440, height: 900 } } });
const page = await ctx.newPage();
const t0 = Date.now();
const chapters = [];
const chapter = (label) => chapters.push({ t: Math.max(0, Math.round((Date.now() - t0) / 100) / 10), label });
const pause = (ms) => page.waitForTimeout(ms);

const state = await page.request.get(`${BASE}/api/state`).then((r) => r.json());
if (!state.modes?.demo) throw new Error("The app is not in demo mode. Start it with CITED_FORCE_MOCK=true.");
await page.request.delete(`${BASE}/api/demo/seed`);

chapter("Describe the product");
await page.goto(`${BASE}/intake`);
await pause(900);
await page.getByRole("button", { name: "Form", exact: true }).click();
const type = async (label, text) => { await page.getByLabel(label).click(); await page.getByLabel(label).pressSequentially(text, { delay: 12 }); };
await type("Product name", "Ledgerlight");
await type("What it does", "Ledgerlight automates the month-end close for mid-market finance teams: it reconciles bank feeds and drafts journal entries inside NetSuite.");
await page.getByRole("button", { name: "Advanced (optional)" }).click();
await type("Team background", "Co-founder Maya Chen was at Stratus Data");
await pause(500);
await page.getByRole("button", { name: "Infer ICP" }).click();

chapter("Approve the ICP");
await page.getByRole("button", { name: "Approve ICP" }).waitFor();
await pause(2200);
await page.getByRole("button", { name: "Approve ICP" }).click();
await pause(1500);

chapter("Run the loop");
await page.goto(`${BASE}/overview`);
await pause(800);
await page.getByRole("button", { name: "Run the loop" }).click();
await page.locator('[aria-label="Agent run"]').waitFor();
await pause(6000);

chapter("Cited companies");
await page.goto(`${BASE}/discovery`);
await pause(3500);

chapter("Claim check and approval");
await page.goto(`${BASE}/outreach`);
await pause(2500);
await page.locator('button:has-text("Approve & send"):not([disabled])').first().click();
await pause(2500);

chapter("Pipeline");
await page.goto(`${BASE}/pipeline`);
await pause(3000);

chapter("Knowledge graph");
await page.goto(`${BASE}/graph`);
await pause(2500);
await page.getByRole("tab", { name: /Warm paths/ }).click();
await pause(4000);

chapter("Credits and billing");
await page.goto(`${BASE}/billing`);
await pause(3000);

const video = page.video();
await ctx.close();
await browser.close();
renameSync(await video.path(), join(OUT, "cited-demo.webm"));
writeFileSync(join(OUT, "chapters.json"), JSON.stringify(chapters, null, 2) + "\n");
console.log(`Saved public/demo/cited-demo.webm with ${chapters.length} chapters (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
