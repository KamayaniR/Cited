import type { Workspace, Company, Person, Lead, Message, Signal, Citation, Source } from "@/lib/types";
import { emptyWorkspace } from "@/lib/db/store";
import { combineScore, tierFor } from "@/lib/pipeline/scoring";
import { DEMO_COMPANIES, DEMO_COMPETITORS, DEMO_PRODUCT, mockPersonContact } from "./fixtures";

/**
 * Deterministic demo workspace (mock mode). Built so every invariant the real pipeline enforces
 * already holds: every company and signal has a citation, every enriched field has a source,
 * filtered companies never get a lead.
 */
export function buildDemoWorkspace(now = new Date()): Workspace {
  const ws = emptyWorkspace();
  const at = (minAgo: number) => new Date(now.getTime() - minAgo * 60_000).toISOString();

  ws.product = { id: "prod_ledgerlight", ...DEMO_PRODUCT };
  ws.icp = {
    id: "icp_1", version: 1, approvedAt: at(50),
    data: {
      industries: [
        { name: "Software publishers", naics: "513210", confidence: 0.86 },
        { name: "Freight transportation arrangement", naics: "488510", confidence: 0.71 },
        { name: "Offices of physicians (multi-entity groups)", naics: "621111", confidence: 0.58 },
      ],
      companySize: { value: { minEmployees: 200, maxEmployees: 2000 }, confidence: 0.82 },
      regions: { value: ["United States", "United Kingdom"], confidence: 0.9 },
      personas: [
        { title: "CFO", seniority: "c_level", confidence: 0.8 },
        { title: "VP Finance", seniority: "vp", confidence: 0.77 },
        { title: "Controller", seniority: "director", confidence: 0.84 },
      ],
      triggers: [
        { signal: "Hiring accountants or finance data engineers", confidence: 0.79 },
        { signal: "ERP migration to NetSuite or Sage Intacct", confidence: 0.74 },
        { signal: "New CFO in the last 6 months", confidence: 0.66 },
        { signal: "M&A adding legal entities", confidence: 0.61 },
      ],
      negativeSignals: ["Hiring freeze or layoffs", "Uses a direct competitor signed in the last 12 months", "HQ in the EU"],
    },
  };
  ws.expansions = [{
    id: "exp_1", segment: "Multi-entity healthcare groups (NAICS 621111) after acquisitions", status: "accepted",
    rationale: "Clinic roll-ups add legal entities quickly, which multiplies close work; same buyer persona (Controller).",
    evidence: [{ url: "https://halcyon-health.example/news/acquisition", title: "Halcyon Health Partners acquires two clinic groups" }],
  }];

  for (const dc of DEMO_COMPANIES) {
    const id = `co_${dc.key}`;
    const score = combineScore(dc.fit, dc.intent);
    const hq = dc.hunterHq ?? dc.apolloHq;
    const company: Company = {
      id, name: dc.name, domain: dc.domain, domainSource: "mock", industry: dc.industry, naics: dc.naics,
      headcount: dc.headcount, region: dc.region, hq, hqSource: hq ? "mock" : null,
      fitScore: dc.fit, intentScore: dc.intent, score, tier: tierFor(score),
      excluded: Boolean(dc.excludeReason), excludeReason: dc.excludeReason ?? null, signalsRefreshedAt: at(90),
    };
    ws.companies.push(company);

    dc.signals.forEach((s, i) => {
      const sig: Signal = { id: `sig_${dc.key}_${i}`, companyId: id, type: s.type, summary: s.summary, sourceUrl: `https://${dc.domain}${s.path}`, detectedAt: at(120 + i * 30) };
      ws.signals.push(sig);
      const cit = (entityType: Citation["entityType"], entityId: string): Citation => ({
        id: `cit_${entityId}_${i}`, entityType, entityId, url: sig.sourceUrl, title: `${dc.name}: ${s.summary}`, snippet: s.summary, fetchedAt: at(120),
      });
      ws.citations.push(cit("signal", sig.id));
      if (i === 0) ws.citations.push(cit("company", id));
    });

    dc.people.forEach((p, i) => {
      const m = mockPersonContact(dc.domain, p.first, p.last);
      const email = m.hunterEmail ?? m.apolloEmail;
      const linkedin = m.hunterLinkedin ?? m.apolloLinkedin;
      const src = (v: string | null): Source | null => (v ? "mock" : null);
      const person: Person = {
        id: `per_${dc.key}_${i}`, companyId: id, name: `${p.first} ${p.last}`, title: p.title, seniority: p.seniority,
        email, emailStatus: m.hunterEmail ? p.hunterStatus : email ? "valid" : "unknown", emailSource: src(email), mx: Boolean(email),
        linkedinUrl: linkedin, linkedinSource: src(linkedin), personaMatch: p.seniority === "c_level" || p.seniority === "vp" ? 0.9 : 0.8,
      };
      ws.people.push(person);
    });
  }

  ws.competitors = DEMO_COMPETITORS.map((c, i) => ({ id: `cmp_${i}`, ...c, sourceUrl: `https://${c.domain}/` }));

  // One lead per eligible company (first person), alternating A/B variants.
  ws.companies.filter((c) => !c.excluded).forEach((c, i) => {
    const person = ws.people.find((p) => p.companyId === c.id)!;
    const lead: Lead = { id: `lead_${c.id.slice(3)}`, companyId: c.id, personId: person.id, stage: "matched", outcome: null, owner: "agent", variant: i % 2 ? "B" : "A" };
    ws.leads.push(lead);
    ws.leadEvents.push({ id: `lev_${lead.id}`, leadId: lead.id, fromStage: null, toStage: "matched", actor: "agent", note: "Passed discovery, citation check, negative filter; enriched", at: at(40) });
  });

  // Touch-1 drafts for the Northwind lead, waiting for human approval.
  const nw = ws.leads.find((l) => l.companyId === "co_northwind")!;
  const draft = (id: string, channel: "email" | "linkedin", step: 1 | 2 | 3, dayOffset: number, subject: string | null, body: string): Message => ({
    id, leadId: nw.id, personId: nw.personId, channel, step, dayOffset, variant: nw.variant, valueProp: "Close in 3 days, not 10",
    subject, body, signalIds: ["sig_northwind_0"], status: "pending_approval", review: { reviewer: "pass", security: "pass" },
    editedByRep: false, sentAt: null, deliveredTo: null,
  });
  ws.messages.push(
    draft("msg_nw_e1", "email", 1, 0, "Northwind's finance data hiring",
      "Hi Priya,\n\nSaw Northwind is hiring three finance data engineers and a senior accountant for the close. Teams at that stage often find the close stretching past a week as entities grow.\n\nLedgerlight reconciles bank feeds and drafts journal entries inside NetSuite, and customers close in about 3 days.\n\nWorth a 20 minute look next week?\n\nMaya"),
    draft("msg_nw_l1", "linkedin", 1, 1, null,
      "Hi Priya, we both spent time around Stratus Data's finance systems. Noticed Northwind is scaling the close team after the Series C. Happy to share what we learned automating reconciliations there."),
    draft("msg_nw_e2", "email", 2, 4, "Re: Northwind's finance data hiring",
      "Hi Priya, one more thought: with the UK expansion from the Series C, a second entity usually adds two or three days to each close. Ledgerlight handles multi-entity consolidation out of the box. Open to a short call?"),
  );

  const ev = (from: Workspace["agentEvents"][number]["fromRole"], to: Workspace["agentEvents"][number]["toRole"], kind: string, text: string, minAgo: number, tokens = 0) =>
    ws.agentEvents.push({ id: `aev_${ws.agentEvents.length}`, fromRole: from, toRole: to, kind, text, tokens, costUsd: 0, at: at(minAgo) });
  ev("planner", "builder", "handoff", "@builder TASK icp  product=prod_ledgerlight", 60, 820);
  ev("planner", "human", "approval", "@human APPROVAL icp  icp=v1  fields=12  min_confidence=0.58", 55);
  ev("planner", "builder", "handoff", "@builder TASK discover  icp=v1  max_queries=6  budget_credits=0", 50, 300);
  ev("builder", "planner", "result", "Discovery: 7 companies, 7 cited, 1 filtered (hiring freeze)", 45, 2400);
  ev("planner", "builder", "handoff", "@builder TASK enrich  leads=6  budget_credits=12", 42, 150);
  ev("planner", "builder", "handoff", "@builder TASK draft  leads=1", 35, 150);
  ev("builder", "reviewer", "handoff", "@reviewer READY drafts  batch=b_1  leads=1  messages=3", 30, 1900);
  ev("reviewer", "security", "handoff", "@security READY batch=b_1  reviewer=pass", 28, 640);
  ev("security", "human", "approval", "@human APPROVAL outreach  batch=b_1  messages=3  links=0 domains (all cited)", 27, 410);

  ws.approvals.push({ id: "apr_b1", kind: "outreach", requestedBy: "security", payload: { batch: "b_1", messageIds: ["msg_nw_e1", "msg_nw_l1", "msg_nw_e2"] }, status: "pending", decidedBy: null, decidedVia: null, note: null, at: at(27) });

  ws.auditLog.unshift(
    { id: "aud_1", actor: "rep", agent: "ui", action: "icp_approved", target: "icp_1", detail: "ICP v1 approved", at: at(55) },
    { id: "aud_2", actor: "rep", agent: "ui", action: "expansion_accepted", target: "exp_1", detail: "Accepted: multi-entity healthcare groups", at: at(52) },
    { id: "aud_3", actor: "agent", agent: "builder", action: "company_filtered", target: "co_marlow", detail: "Negative signal: hiring freeze", at: at(45) },
  );
  ws.auditLog.sort((a, b) => b.at.localeCompare(a.at));

  // Enrichment of 6 leads at 2 credits each.
  ws.leads.forEach((l, i) => ws.usageEvents.push({ id: `use_${i}`, eventName: "lead_enriched", quantity: 1, credits: 2, leadId: l.id, flexpriceSynced: false, at: at(41) }));
  ws.org.creditsBalance -= ws.usageEvents.reduce((s, u) => s + u.credits, 0);

  return ws;
}
