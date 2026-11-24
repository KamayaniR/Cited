import { test, expect, type Page } from "@playwright/test";

/**
 * Full pipeline in mock mode, driven through the UI:
 * intake → ICP approval → discovery with citations → enrichment → drafts → human approval → send to the
 * demo inbox → Kanban, then the claim check and the credit gate.
 */

interface State {
  workspace: {
    companies: { id: string; name: string; excluded?: boolean }[];
    citations: { entityId: string; url: string }[];
    leads: { id: string; companyId: string; stage: string }[];
    messages: { id: string; leadId: string; status: string; channel: string; deliveredTo: string | null }[];
    auditLog: { action: string; actor: string; detail: string; target: string }[];
    org: { creditsBalance: number };
  };
}
const state = async (page: Page) => (await (await page.request.get("/api/state")).json()) as State;

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

test.beforeEach(async ({ request }) => {
  const r = await request.delete("/api/demo/seed");
  expect(r.ok()).toBeTruthy();
});

test("intake to sent email to Kanban, with citations and a human approval", async ({ page }) => {
  const errors = watchErrors(page);

  // Intake (form mode) and ICP
  await page.goto("/intake");
  await page.getByRole("button", { name: "Form", exact: true }).click();
  await page.getByRole("button", { name: "Advanced (optional)" }).click();
  await page.getByLabel("Product name").fill("Ledgerlight");
  await page.getByLabel("What it does").fill("Ledgerlight automates the month-end close for mid-market finance teams: it reconciles bank feeds and drafts journal entries inside NetSuite and Sage Intacct.");
  await page.getByLabel("Customers").fill("Controllers and CFOs");
  await page.getByLabel("Regions (comma separated)").fill("United States, United Kingdom");
  await page.getByLabel("Team background").fill("Co-founder Maya Chen was at Stratus Data");
  await page.getByRole("button", { name: "Infer ICP" }).click();
  await page.getByRole("button", { name: "Approve ICP" }).click();
  await expect(page.getByText("Approved", { exact: true }).first()).toBeVisible();

  // Discovery: every company cites a URL
  await page.goto("/discovery");
  await page.getByRole("button", { name: "Run discovery" }).click();
  await expect(page.getByRole("button", { name: /^Enrich \d+ leads$/ })).toBeVisible({ timeout: 30_000 });
  let s = await state(page);
  expect(s.workspace.companies.length).toBeGreaterThan(0);
  for (const c of s.workspace.companies) {
    const urls = s.workspace.citations.filter((x) => x.entityId === c.id).map((x) => x.url);
    expect(urls.length, `${c.name} has a citation`).toBeGreaterThan(0);
    for (const u of urls) expect(u).toMatch(/^https?:\/\//);
  }
  await expect(page.locator('a[href^="http"]').first()).toBeVisible();

  // Enrichment charges credits
  const before = s.workspace.org.creditsBalance;
  await page.getByRole("button", { name: /^Enrich \d+ leads$/ }).click();
  await expect(page.getByText(/\d+ enriched · Hunter/)).toBeVisible({ timeout: 30_000 });
  s = await state(page);
  expect(s.workspace.org.creditsBalance).toBeLessThan(before);

  // Drafts wait for a human; nothing is sent yet
  await page.goto("/outreach");
  await page.getByRole("button", { name: /^Draft sequences for \d+ leads$/ }).click();
  await expect(page.getByRole("button", { name: "Approve & send" }).first()).toBeVisible({ timeout: 30_000 });
  s = await state(page);
  expect(s.workspace.messages.length).toBeGreaterThan(0);
  expect(s.workspace.messages.filter((m) => m.status === "sent")).toHaveLength(0);

  // Approve one email: it goes to the demo inbox (simulated) and the lead moves to Contacted
  const approve = page.locator('button:has-text("Approve & send"):not([disabled])').first();
  await approve.click();
  await expect.poll(async () => (await state(page)).workspace.messages.filter((m) => m.status === "sent").length).toBe(1);
  s = await state(page);
  const sent = s.workspace.messages.find((m) => m.status === "sent")!;
  expect(sent.channel).toBe("email");
  expect(sent.deliveredTo).toBe("demo");
  expect(s.workspace.auditLog.find((a) => a.action === "message_approved" && a.target === sent.id)?.actor).toBe("rep");
  expect(s.workspace.auditLog.find((a) => a.action === "email_sent" && a.target === sent.id)?.detail).toContain("rep approved, agent sent");
  const lead = s.workspace.leads.find((l) => l.id === sent.leadId)!;
  expect(lead.stage).toBe("contacted");
  const company = s.workspace.companies.find((c) => c.id === lead.companyId)!;

  await page.goto("/pipeline");
  await expect(page.locator('section[data-stage="contacted"]').getByText(company.name).first()).toBeVisible();

  expect(errors).toEqual([]);
});

test("claim check blocks an unsupported edit, and the credit gate returns 402", async ({ page }) => {
  const errors = watchErrors(page);
  await page.request.post("/api/demo/seed");

  // Add a claim with no evidence: approval is refused
  await page.goto("/outreach");
  const emailCard = page.locator("div").filter({ has: page.getByRole("button", { name: "Approve & send" }) }).filter({ has: page.getByRole("button", { name: "Edit" }) }).last();
  await emailCard.getByRole("button", { name: "Edit" }).click();
  const body = page.locator("textarea").first();
  await body.fill((await body.inputValue()) + "\n\nCongrats on closing your Series D last week.");
  await page.getByRole("button", { name: "Approve edited" }).click();
  await expect(page.getByText(/No evidence for/).first()).toBeVisible();
  const s = await state(page);
  expect(s.workspace.auditLog.some((a) => a.action === "email_sent" && a.detail.includes("Series D"))).toBeFalsy();

  // Out of credits: paid calls stop
  await page.goto("/billing");
  await page.getByRole("button", { name: "Demo: set balance to 0" }).click();
  await expect(page.getByText("Paid calls are blocked (HTTP 402) until you top up.")).toBeVisible();
  const r = await page.request.get("/api/graph/query?q=warm");
  expect(r.status()).toBe(402);
  expect((await r.json()).error.message).toBe("Need 0.5 credits, balance 0");

  // Health reports the 402 and no send without approval
  const health = await (await page.request.get("/api/health")).json();
  expect(health.monitoring.sendsWithoutApproval).toBe(0);
  expect(health.monitoring.http402LastWindow).toBeGreaterThanOrEqual(1);

  expect(errors).toEqual([]);
});

test("the run canvas shows only while an agent runs, and the loop stops at your approval", async ({ page }) => {
  const errors = watchErrors(page);
  await page.request.post("/api/intake", { data: { name: "Ledgerlight", description: "Ledgerlight automates the month-end close for mid-market finance teams.", customers: "Controllers and CFOs", regions: ["United States"], excludeRegions: [], teamBackground: "Co-founder Maya Chen was at Stratus Data" } });
  await page.request.patch("/api/icp", { data: { approve: true } });

  await page.goto("/overview");
  const canvas = page.getByRole("region", { name: "Agent run" });
  await expect(canvas).toHaveCount(0);

  await page.getByRole("button", { name: "Run the loop" }).click();
  await expect(canvas).toBeVisible();
  await expect(canvas.locator('[data-step="approval"]')).toHaveAttribute("data-status", "needs_you", { timeout: 30_000 });
  for (const step of ["discovery", "enrich", "draft", "claim", "security"]) await expect(canvas.locator(`[data-step="${step}"]`)).toHaveAttribute("data-status", "done");

  // Nothing was sent: the loop waits for a human.
  const s = await state(page);
  expect(s.workspace.messages.length).toBeGreaterThan(0);
  expect(s.workspace.messages.filter((m) => m.status === "sent")).toHaveLength(0);

  await canvas.getByRole("button", { name: "Close run view" }).click();
  await expect(canvas).toHaveCount(0);
  expect(errors).toEqual([]);
});
