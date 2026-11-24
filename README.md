# Cited

Cited takes a founder from "here's my product" to qualified meetings booked: it infers an ICP, discovers companies with a source URL for every claim, enriches contacts, drafts outreach, and sends nothing until a human approves it.

> Work in progress. Built in stages P0 to P8 (see "Build status").

## Quick start (mock mode, zero keys)

```bash
npm install
cp .env.example .env.local   # leave it empty for mock mode
npm run dev
```

Open http://localhost:3000 and click **Load demo data**.

Every vendor sits behind an adapter in `lib/providers/` with a mock fallback, so the whole app runs with no API keys. Add a vendor's keys to `.env.local` to switch just that vendor to live mode; the top bar shows which vendors are live.

## Live mode

| Variable | Vendor | Where to get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | LLM (Claude) | console.anthropic.com |
| `TAVILY_API_KEY` | Search | tavily.com |
| `HUNTER_API_KEY` | Enrichment (primary) | hunter.io → API |
| `APOLLO_API_KEY` | Enrichment (fallback) | apollo.io → Settings → API |
| `SENDGRID_API_KEY`, `SENDGRID_FROM` | Email | sendgrid.com (verified sender) |
| `DEMO_RECIPIENT`, `SENDING_ENABLED` | Safety | Your demo inbox; sending is off unless `true` |
| `FLEXPRICE_API_KEY` | Billing | flexprice.io |
| `BAND_API_KEY`, `BAND_ROOM_ID` | Multi-agent | Band |
| `NEO4J_URI`, `NEO4J_PASSWORD` | Graph | Neo4j Aura Free |
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Database | supabase.com |
| `CRON_SECRET` | Scheduled refresh | Any random string |

Database: `supabase db push` applies `supabase/migrations/`. The Neo4j schema in `lib/graph/schema.cypher` runs on startup.

## Safety

- Nothing is sent unless a rep approved it.
- Outside production every email goes to `DEMO_RECIPIENT`; `SENDING_ENABLED=false` is a kill switch.
- LinkedIn messages are drafted only. The rep sends them by hand and clicks "Mark sent".
- No scraping behind logins. Every lead and signal must cite a URL that search returned.

## Scripts

`npm run dev` · `npm run build` · `npm test` · `npm run typecheck` · `npm run lint`

## Project structure

```
app/                 pages + API routes (api/state, api/demo/seed, api/health, api/cron/refresh)
components/          UI
lib/
  providers/         llm, tavily, hunter, apollo, sendgrid, flexprice, band (each with mock fallback)
  pipeline/          scoring (P0); icp, discovery, enrich, outreach, refresh (P1+)
  agents/            planner, builder, reviewer, security (P6)
  graph/             neo4j.ts, schema.cypher; queries (P4)
  seed/              demo fixtures (fictional .example companies)
  db/                workspace store (memory in mock mode)
supabase/migrations/
docs/
vercel.json          cron schedule
```

## Build status

| Stage | Scope | Status |
|---|---|---|
| P0 | Skeleton, schema, adapters with mocks, demo seed, app shell | Done |
| P1 | Intake → ICP → discovery with citations → competitors → scoring | Done |
| P2 | Enrichment, sequences, HITL queue, demo-inbox send, manual LinkedIn | Next |
| P3 | Kanban, attribution, audit, analytics | |
| P4 | Neo4j graph, 3 multi-hop queries, scheduled refresh | |
| P5 | Flexprice metering and credit gate | |
| P6 | Band agents and approval cards | |
| P7 | Pitch slide, docs, demo video | |
| P8 | Snyk, E2E, monitoring | |

## License

MIT
