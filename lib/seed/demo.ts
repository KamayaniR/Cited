import type { Workspace, Company, Person, Lead, Message, Signal, Citation, Source, Stage, Actor } from "@/lib/types";
import { emptyWorkspace } from "@/lib/db/store";
import { combineScore, tierFor } from "@/lib/pipeline/scoring";
import { DEMO_COMPANIES, DEMO_COMPETITORS, DEMO_ICP, DEMO_PRODUCT, mockPersonContact } from "./fixtures";

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
    data: DEMO_ICP,
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
    const hqSource: Source | null = dc.hunterHq ? "hunter" : dc.apolloHq ? "apollo" : null;
    const company: Company = {
      id, name: dc.name, domain: dc.domain, domainSource: "tavily", industry: dc.industry, naics: dc.naics,
      headcount: dc.headcount, region: dc.region, hq, hqSource,
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
      const hunterOk = m.hunterEmail && p.hunterStatus !== "invalid";
      const email = hunterOk ? m.hunterEmail : m.apolloEmail;
      const linkedin = m.hunterLinkedin ?? m.apolloLinkedin;
      const emailSource: Source | null = email ? (hunterOk ? "hunter" : "apollo") : null;
      const linkedinSource: Source | null = linkedin ? (m.hunterLinkedin ? "hunter" : "apollo") : null;
      const person: Person = {
        id: `per_${dc.key}_${i}`, companyId: id, name: `${p.first} ${p.last}`, title: p.title, seniority: p.seniority,
        email, emailStatus: hunterOk ? p.hunterStatus : email ? "valid" : "unknown", emailSource, mx: Boolean(email),
        linkedinUrl: linkedin, linkedinSource, personaMatch: p.seniority === "c_level" || p.seniority === "vp" ? 0.9 : 0.8,
      };
      ws.people.push(person);
    });
  }

  ws.competitors = DEMO_COMPETITORS.map((c, i) => ({ id: `cmp_${i}`, ...c, sourceUrl: `https://${c.domain}/` }));
  for (const c of ws.competitors) ws.citations.push({ id: `cit_${c.id}`, entityType: "competitor", entityId: c.id, url: c.sourceUrl, title: `${c.name}: ${c.positioning}`, snippet: `${c.positioning}. Pricing: ${c.pricing}.`, fetchedAt: at(120) });

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
    subject, body, signalIds: step === 1 ? ["sig_northwind_0"] : [], status: "pending_approval", review: { reviewer: "pass", security: "pass" },
    editedByRep: false, sentAt: null, deliveredTo: null,
  });
  ws.messages.push(
    draft("msg_nw_e1", "email", 1, 0, "Northwind's finance data hiring",
      "Hi Priya,\n\nSaw Northwind is hiring three finance data engineers and a senior accountant for the close. Teams at that stage often find the close stretching past a week as entities grow.\n\nLedgerlight reconciles bank feeds and drafts journal entries inside NetSuite, and customers close in about 3 days.\n\nWorth a 20 minute look next week?\n\nMaya"),
    draft("msg_nw_l1", "linkedin", 2, 2, null,
      "Hi Priya, we both spent time around Stratus Data's finance systems. Noticed Northwind is scaling the close team after the Series C. Happy to share what we learned automating reconciliations there."),
    draft("msg_nw_e2", "email", 3, 5, "Re: Northwind's finance data hiring",
      "Hi Priya, one more thought: with the UK expansion from the Series C, a second entity usually adds two or three days to each close. Ledgerlight handles multi-entity consolidation out of the box. Open to a short call?"),
  );

  // History for the other leads, so the Kanban and analytics have something real to show.
  // Sent touches went to the demo inbox (email) or were sent by hand by the rep (LinkedIn).
  const DAY = 60 * 24;
  const story: Record<string, { steps: [Stage, Actor, string, number][]; touch: "email" | "linkedin"; outcome?: "won" | "lost"; reason?: string }> = {
    brightpath: { touch: "email", steps: [["contacted", "agent", "First touch sent (email)", 3 * DAY]] },
    halcyon: { touch: "email", steps: [["contacted", "agent", "First touch sent (email)", 6 * DAY], ["replied", "agent", "Inbound reply: asked for pricing", 4 * DAY], ["meeting_booked", "rep", "Demo booked for Thursday", 2 * DAY]] },
    corvid: { touch: "email", steps: [["contacted", "agent", "First touch sent (email)", 7 * DAY], ["replied", "agent", "Inbound reply: not a priority this quarter", 5 * DAY], ["closed_lost", "rep", "Building reconciliation in house", 3 * DAY]], outcome: "lost", reason: "Building reconciliation in house" },
    tessellate: { touch: "linkedin", steps: [["contacted", "rep", "First touch sent (linkedin)", 4 * DAY], ["replied", "rep", "Replied on LinkedIn", 1 * DAY]] },
    quillon: { touch: "email", steps: [["contacted", "agent", "First touch sent (email)", 9 * DAY], ["replied", "agent", "Inbound reply: interested", 7 * DAY], ["meeting_booked", "rep", "Intro call booked", 5 * DAY], ["closed_lost", "rep", "Signed a 3 month pilot", 1 * DAY]], outcome: "won", reason: "Signed a 3 month pilot" },
  };
  for (const [key, st] of Object.entries(story)) {
    const lead = ws.leads.find((l) => l.companyId === `co_${key}`);
    if (!lead) continue;
    const c = ws.companies.find((x) => x.id === lead.companyId)!;
    const person = ws.people.find((p) => p.id === lead.personId)!;
    const sig = ws.signals.find((s) => s.companyId === c.id)!;
    let from: Stage = lead.stage;
    for (const [to, actor, note, ago] of st.steps) {
      ws.leadEvents.push({ id: `lev_${lead.id}_${to}`, leadId: lead.id, fromStage: from, toStage: to, actor, note, at: at(ago) });
      if (actor === "rep") ws.auditLog.push({ id: `aud_${lead.id}_${to}`, actor: "rep", agent: "ui", action: "stage_changed", target: lead.id, detail: `${c.name}: ${from} → ${to}${to === "closed_lost" ? ` (${st.outcome}: ${note})` : ""}`, at: at(ago) });
      from = to; lead.stage = to; lead.owner = actor;
    }
    lead.outcome = st.outcome ?? null;
    lead.closeReason = st.reason ?? null;
    const first = st.steps[0][3];
    const matchedEv = ws.leadEvents.find((e) => e.id === `lev_${lead.id}`);
    if (matchedEv) matchedEv.at = at(first + 120);
    const first_name = person.name.split(" ")[0];
    ws.messages.push({
      id: `msg_${key}_1`, leadId: lead.id, personId: person.id, channel: st.touch, step: 1, dayOffset: 0, variant: lead.variant,
      valueProp: lead.variant === "A" ? "Close in 3 days, not 10" : "Fewer close errors",
      subject: st.touch === "email" ? `${c.name} and the month end close` : null,
      body: st.touch === "email"
        ? `Hi ${first_name},\n\nSaw that ${c.name} ${sig.summary.charAt(0).toLowerCase()}${sig.summary.slice(1)}. Teams at that point often feel the close stretch.\n\nLedgerlight reconciles bank feeds inside NetSuite. Worth a short look?\n\nMaya`
        : `Hi ${first_name}, noticed ${c.name} ${sig.summary.charAt(0).toLowerCase()}${sig.summary.slice(1)}. Happy to share how other finance teams shortened the close.`,
      signalIds: [sig.id], status: "sent", review: { reviewer: "pass", security: "pass" }, editedByRep: false,
      sentAt: at(first), deliveredTo: st.touch === "email" ? "demo" : "manual:linkedin",
    });
    ws.auditLog.push({ id: `aud_${key}_sent`, actor: st.steps[0][1], agent: st.touch === "email" ? "builder" : "ui", action: st.touch === "email" ? "email_sent" : "linkedin_marked_sent", target: `msg_${key}_1`, detail: st.touch === "email" ? "Sent to demo inbox" : "Rep sent on LinkedIn by hand", at: at(first) });
    ws.usageEvents.push({ id: `use_send_${key}`, eventName: "outreach_sent", quantity: 1, credits: 1, leadId: lead.id, flexpriceSynced: false, at: at(first) });
  }

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
  ws.leads.forEach((l, i) => {
    const matchedAt = ws.leadEvents.find((e) => e.id === `lev_${l.id}`)?.at ?? at(41);
    ws.usageEvents.push({ id: `use_${i}`, eventName: "lead_enriched", quantity: 1, credits: 2, leadId: l.id, flexpriceSynced: false, at: matchedAt });
  });
  ws.usageEvents.sort((a, b) => a.at.localeCompare(b.at));
  ws.org.creditsBalance -= ws.usageEvents.reduce((s, u) => s + u.credits, 0);

  return ws;
}
