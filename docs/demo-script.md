# Demo video script (target 2:50)

Record in mock mode with the seeded demo so every take is identical: start the app with no keys (or `SENDING_ENABLED=false`), open http://localhost:3000/overview, click **Load demo data**. Keep the Agent Thinking panel open throughout. Screen size 1440×900.

Before recording: open `docs/slides/viability.png` full screen for the first beat.

| Time | Screen and clicks | Voiceover |
|---|---|---|
| 0:00–0:15 | Title card, then the startup viability slide (`docs/slides/viability.png`). | "Founders without a sales team stitch together four tools and still send generic email. Cited turns a product description into booked meetings, with a source for every claim and a human approving every message." |
| 0:15–0:40 | **Intake & ICP.** Show the product chat, then the ICP table: NAICS codes, size, personas, triggers, each with a confidence bar. Point at the accepted expansion "Multi-entity healthcare groups" and its evidence link. | "I describe the product. Cited infers the ICP with NAICS codes, size, personas and triggers, each with a confidence score. It also suggests an adjacent segment with evidence, which I accept." |
| 0:40–1:05 | **Discovery.** Hover a source link on Northwind. Scroll to Marlow Freight, filtered: "Negative signal: hiring freeze". Click **Run refresh now**: "Halcyon Health Partners B→A". | "Discovery finds companies, and every lead and signal links to the page search returned. This one is filtered out because of a hiring freeze. Signals refresh every six hours; a new funding round just moved Halcyon to Tier A." |
| 1:05–1:20 | **Graph → Warm paths.** Path cards: Maya Chen → Stratus Data → Priya Natarajan → Northwind (buyer). Cypher visible on the right. Optionally click **Competitor displacement**: Corvid on FloQast, renewal window. | "In the knowledge graph, a multi-hop query finds a warm path: our co-founder and Northwind's VP Finance both worked at Stratus Data. Another query finds a FloQast customer whose contract renews next quarter." |
| 1:20–1:40 | **Discovery** grid: Email and LinkedIn columns with Hunter and Apollo source badges. Then **Billing**: usage by event, credits in the top bar. (With live keys, click **Enrich** and watch credits drop.) | "Enrichment verifies email and MX with Hunter, and fills LinkedIn and HQ from Apollo when Hunter misses. Every field shows its source. Each call is metered by Flexprice." |
| 1:40–2:00 | **Approval queue.** On touch 3, click Edit, add "Congrats on closing your Series D." and save: the claim check marks it unsupported with the best match and milliseconds. Then type "did they change ERP?" in Ask the evidence → cited answer. | "Every sentence is checked against the evidence stored in Moss. I just added a funding round we have no source for, so it's flagged, in milliseconds, and it can't be approved. I can also ask the evidence anything, and the answer comes back with its source." |
| 2:00–2:20 | **Approval queue, batch card.** Agent Thinking panel shows @planner → @builder → @reviewer → @security → @human. Undo the edit (or reject touch 3 with reason "too long for a CFO"), click **Approve 2, reject 1**. Point at @security → @builder FIX in the panel. Then reject the schema change card ("Not for the hackathon"): @planner REPLAN appears. With Band connected, show the same in the Band room. | "Four agents planned, built, reviewed and security-checked these drafts. Nothing sends until I decide. I reject one that's too long, and it goes back to the builder; the rest are approved. LinkedIn messages are drafted only: I send those by hand and mark them sent. When the builder asks to change the graph schema, that waits for me too." |
| 2:20–2:40 | **Pipeline.** Northwind is now in Contacted, tagged agent. Drag Brightpath to Meeting Booked: tagged rep. Drag Halcyon to Closed/Lost → choose Won, reason. **Analytics**: A/B variant tab, then Tier. | "Approved leads move to Contacted, tagged as agent actions. When I book a meeting, my move is tagged rep. Analytics show conversion by industry, tier and A/B variant." |
| 2:40–2:50 | **Billing** → "Demo: set balance to 0". **Graph** → click a query: "Need 0.5 credits, balance 0". End card with the repo URL. | "When credits run out, paid calls stop. Cited: cited leads, checked claims, human-approved outreach, one loop." |

Recording notes

- After recording, click **Load demo data** to reset.
- Re-record 0:40–1:40 with live keys if they're stable (live discovery takes about a minute: cut the wait).
- Show the audit log for two seconds after the batch approval: "rep approved, agent sent".

## Moss prize post on X (draft)

> We built Cited at the hackathon: an AI go-to-market engine where every outreach sentence is checked against real evidence before a human approves it. @moss powers the evidence layer: grounded drafting, a per-sentence claim check in milliseconds, and "ask the evidence" search in the approval queue. 30-sec demo below. Repo: <link>

Attach a 20 to 30 second clip of the 1:40–2:00 segment. Confirm Moss's X handle before posting.
