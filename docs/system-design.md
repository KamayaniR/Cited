# Cited system design

Filled in during P7. Outline: spec v2 Section 12 (overview, architecture, query logic, graph ontology, reasoning loops, bonus integrations, data model, security, limitations).

## Scoring (P0)

`score = round(0.6 × fit + 0.4 × intent)`, both 0–100. Tier A ≥ 75, Tier B ≥ 55, otherwise C. See `lib/pipeline/scoring.ts`.

Fit (0–100) = industry 45 (exact NAICS, scaled by the ICP field's confidence; 25 for same 3-digit sector) + size 30 (15 if within 0.5×–1.5× of the range) + region 25.
Intent (0–100) = per signal type, counted once: hiring 30, tech adoption 30, leadership change 25, funding 25, expansion 25, launch 15; +10 when the signal matches an ICP trigger; ×0.7 after 30 days, ×0.4 after 90.

## Discovery loop (P1)

1. Up to 6 Tavily queries: accepted expansion segments first, then each ICP industry × its two strongest triggers, with the first region.
2. Results deduped by URL.
3. The LLM extracts companies and signals with Zod schema `ProspectSchema`; every URL must be copied from a result.
4. Citation validator (`lib/pipeline/citations.ts`) normalises URLs and drops any company with no URL that search returned; signals with unreturned URLs are dropped too.
5. Negative filter: any `negative` signal, an ICP negative signal found in the signal text, or an excluded region. Filtered companies stay in the grid with the reason and never become leads.
6. Fit + Intent scoring, tier, save. A competitor map is built from a separate search, with the same citation rule.

## Enrichment (P2)

Per company, best score first, with a 2-credit check before each lead: Hunter Company (HQ) → Apollo Org if missing; Hunter Domain Search to pick the buyer (ICP persona match, then seniority); Hunter Email Finder + Verifier; Apollo People Match only for a missing or invalid email or a missing LinkedIn URL (Apollo emails are re-verified by Hunter). Each field stores the step that filled it (`hunter` or `apollo`). Invalid emails are never kept; a lead without an email gets no email touches.

## Outreach loop (P2)

1. @builder drafts 3 touches: email (day 0), LinkedIn note (day 2), email (day 5). Variant A angle = time saved, B = risk reduced (alternating per lead).
2. @reviewer (`lib/agents/reviewer.ts`): touch 1 cites a real signal id; ≤80 words for C-level, ≤120 otherwise, ≤60 for LinkedIn; one question; no dashes or buzzwords. Fixes go back to @builder, max 2 rounds, then escalate (`needs_fix`).
3. @security (`lib/agents/security.ts`): links only to cited domains; no email addresses or secrets in copy.
4. @human approves, edits or rejects. Approving an email sends it through SendGrid to `DEMO_RECIPIENT` (simulated unless `SENDING_ENABLED=true`), charges 1 credit, and moves the lead Matched → Contacted tagged *agent*. Approving a LinkedIn note only queues it; the rep copies it, sends by hand and clicks "Mark sent", which moves the lead tagged *rep*.
5. SendGrid Inbound Parse posts replies to `/api/webhooks/sendgrid?token=CRON_SECRET`; a reply moves the lead to Replied.

## Pipeline, attribution and analytics (P3)

- Five stages: Matched, Contacted, Replied, Meeting Booked, Closed/Lost. Agents move leads automatically (first send moves Matched to Contacted; an inbound reply moves to Replied). Reps drag cards on the Kanban, which calls `PATCH /api/leads/:id/stage`.
- Every move writes a `lead_events` row with `actor` (agent or rep) and a note, sets `lead.owner` to that actor, and writes an audit entry `stage_changed`. The lead history drawer reads `lead_events`.
- Closed/Lost requires `outcome` won or lost (400 otherwise) and takes an optional reason, stored as `lead.closeReason`. Moving a closed lead back out clears both.
- `GET /api/analytics?groupBy=industry|tier|variant` (`lib/pipeline/analytics.ts`). Reached stages come from history and are cumulative for open stages, so a lead dragged straight to Meeting Booked still counts as contacted and replied. Reply and meeting rates are over contacted leads; win rate is over closed leads.
- The audit log page filters by actor and action.

## Knowledge graph (P4)

Ontology (`lib/graph/model.ts`, schema in `lib/graph/schema.cypher`). Node ids equal record ids.

| Nodes | Edges |
|---|---|
| Company, Person, Product, Competitor, Signal, Team, School | works_at, competes_with, matched_to, contacted_via, replied_to, previously_employed_at, has_signal, uses, studied_at |

- **Team** comes from the intake's team background (`lib/pipeline/team.ts`: LLM extraction, heuristic parse in mock mode). **Person** career history (past employers, school) comes from Apollo employment history during enrichment, with its source recorded.
- Past employers that aren't prospects become `Company` nodes with id `org_<slug>`; spelling variants ("Stratus Data, Inc.") collapse to one node.
- `uses` is derived from signals that name a non-status-quo competitor; `renewal` is set when the signal mentions a renewal.
- **Engine.** With `NEO4J_*` set, the graph is mirrored to Neo4j after discovery, enrichment, refresh and seeding (delete this org's nodes, then batched `UNWIND … MERGE` per label and edge type), and queries run as Cypher scoped by `$org`. Without keys, or if Neo4j fails, the same query runs over the in-memory graph with the same row shape, and the response says which engine answered.

### The three queries (`lib/graph/queries.ts`, `GET /api/graph/query?q=`; 0.5 credits each)

1. **Warm path**: `(Team)-[previously_employed_at|studied_at]->(x)<-[same]-(Person)-[works_at]->(Company)`. Demo: Maya Chen → Stratus Data → Priya Natarajan (VP Finance, Northwind, the lead's buyer).
2. **Hiring → evaluation**: a company with a `hiring` signal and at least one evaluation trigger (tech adoption, funding, leadership change, expansion), with the lead's buyer. Demo: Northwind (finance data hiring + Series C).
3. **Competitor displacement**: `(Product)-[competes_with]->(Competitor)<-[uses]-(Company)`, joined to the signal that proves it, renewal windows first, with our advantage as the angle. Demo: Corvid Robotics on FloQast, renewing in Q1.

Excluded companies never appear in any query.

## Signal refresh (P4)

`lib/pipeline/refresh.ts`, called by `GET /api/cron/refresh` (Vercel Cron every 6 h, `CRON_SECRET`) and the "Run refresh now" button (`POST /api/signals/refresh`).

1. Queue: Tier A/B (or the given ids), oldest refresh first, max 50.
2. Per company: credit check (1 credit; out of credits → skipped and counted, never a 402 for cron) → fetch fresh signals (live: Tavily + LLM, only results on the company's site, naming its domain, or its full name; demo `.example` companies use fixtures) → add only new, cited signals → negative filter. A new negative signal marks the company filtered and withdraws its unsent drafts, with audit entries.
3. Moss re-index, semantic trigger matching, re-score and re-tier. Every tier change is audited (`tier_changed`). Demo: Halcyon gets a growth round and moves Tier B → A.
4. Graph mirror.

Demo seed scores now come from the same fit/intent formula, so a refresh only moves a score when the signals change.

## Billing and credit gate (P5)

| Metered event | Credits |
|---|---|
| lead_enriched | 2 |
| outreach_sent (approved send only; drafts are free) | 1 |
| graph_query | 0.5 |
| signal_refresh (per company) | 0.2 |

Plans: Free (100 credits once), Founder $99/month (1,500), Team $399/month (7,500); overage and top-ups at $0.08 per credit.

- **Gate.** `requireCredits` checks the local ledger (`org.creditsBalance`, one decimal) synchronously before every paid vendor call: enrichment, send, graph query. It throws `402 CREDIT_LIMIT`. Scheduled refresh skips and counts instead of failing. The ledger is the gate so a slow billing API can never let spend run past zero.
- **Meter.** `charge` writes a `usage_events` row and sends it to Flexprice `POST /events` with `external_customer_id` = org id and `event_id` = the row id, so retries are deduplicated. Rows that didn't land (`flexprice_synced = false`) are retried by the cron route and by "Sync now" on /billing.
- **Wallet.** On the first top-up or sync with a key, Cited finds or creates the Flexprice customer (`GET /customers/external/{id}`, else `POST /customers`) and a prepaid wallet loaded with the current balance (`POST /wallets`). Top-ups go to `POST /wallets/{id}/top-up` with `PURCHASED_CREDIT_DIRECT` and an idempotency key; /billing shows the wallet's real-time balance (`GET /wallets/{id}/balance/real-time`).
- `POST /api/billing/topup { amount }` (10 to 5,000 whole credits) → `{ balance }`; `GET /api/billing` → balance, plan, prices, usage by event, Flexprice state.

## Multi-agent orchestration with Band (P6)

Four roles (planner, builder, reviewer, security) hand work to each other with fixed-shape lines (`@builder TASK discover  icp=v1 ...`, `@reviewer READY drafts ...`, `@builder FIX ...`, `@security READY ...`, `@human APPROVAL ...`). Every handoff is an `agent_events` row, shown in the Agent Thinking panel.

**Band room (`lib/providers/band.ts`).** With `BAND_API_KEY` (an agent key) and `BAND_ROOM_ID`, every agent event is mirrored into the room as it is written:
- A handoff to another participant becomes a real message with a structured `mentions` entry (Band only delivers to mentioned participants). Room participants are matched to roles by name ("Cited Builder" → builder); the human is the room's user.
- Anything without another participant to address becomes a room event (`task` / `thought`).
- Approval requests also post a blocking `attention` event (`kind: review`).
- Optional `BAND_<ROLE>_KEY` lets each role speak as its own agent; otherwise all roles share one key and label themselves.

**Human decisions in the room.** A person replies to one of our agents, for example `approve b_1`, `approve b_1 except msg_x (too long for a CFO)`, `reject msg_x <reason>`, `edit msg_x subject: ...`, `reject apr_schema_1 <reason>`. Cited reads them with the Agent API queue (`messages/next` → `processing` → `processed`/`failed`), answers in the room, and ignores messages from agents (only a person can approve). Polling runs from the "Check Band for decisions" button, the 6-hourly cron, and `/api/webhooks/band` (Band's wake-up URL, verified with the Standard Webhooks signature or a bearer secret).

**One decision path (`lib/pipeline/decide.ts`).** The queue UI (`POST /api/outreach/:id/review`, `POST /api/approvals/:id`) and Band replies call the same functions, so they write the same `approvals`, `audit_log` and `agent_events` rows. Only `audit_log.agent` differs: `ui` or `band:<room>`.
- Outreach batch: reject the listed messages (each goes back to @builder with its reason as a `FIX`), approve the rest (Moss claim check, credit gate, demo-inbox send). The batch closes when nothing in it is waiting.
- Schema change: agents may only propose `CREATE CONSTRAINT|INDEX ... IF NOT EXISTS`. Approve runs it on Neo4j (or records it for the in-memory graph); reject makes @planner re-plan without it. The seed includes @builder asking for an `attended` edge.

Without Band keys the roles run in-process, write the same rows, and the top bar shows "Band: offline (local agents)".
