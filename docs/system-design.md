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
