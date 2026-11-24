import "server-only";
import { z } from "zod";
import { completeJson } from "@/lib/providers/llm";
import { IcpSchema, type ProductInput, type Icp, type Expansion } from "@/lib/types";
import { search } from "@/lib/providers/tavily";
import { DEMO_ICP } from "@/lib/seed/fixtures";
import { newId } from "@/lib/ids";

const ExpansionDraftSchema = z.object({
  segment: z.string(),
  rationale: z.string(),
  searchQuery: z.string().describe("A web search query that would find evidence for this segment"),
});
const IcpResultSchema = z.object({ icp: IcpSchema, expansions: z.array(ExpansionDraftSchema).max(3) });

const SYSTEM = `You are a B2B go-to-market strategist. From a product description, infer the ideal customer profile.
Rules:
- Use real 6-digit 2022 NAICS codes.
- Every field carries a confidence from 0.00 to 1.00. Be honest: guesses get under 0.55.
- Personas are job titles of buyers, with seniority one of c_level, vp, director, manager.
- Triggers are observable public signals (hiring, funding, ERP change, leadership change, M&A).
- negativeSignals are reasons to exclude a company (hiring freeze, layoffs, excluded regions, recent competitor purchase).
- Propose up to 3 adjacent expansion segments the founder did not mention, each with a web search query that would find evidence.`;

export async function inferIcp(product: ProductInput) {
  const prompt = `Product:\n${JSON.stringify(product, null, 2)}\n\nReturn {"icp": {...}, "expansions": [...]} matching this shape:
{"icp":{"industries":[{"name":"","naics":"","confidence":0.0}],"companySize":{"value":{"minEmployees":0,"maxEmployees":0},"confidence":0.0},"regions":{"value":[""],"confidence":0.0},"personas":[{"title":"","seniority":"","confidence":0.0}],"triggers":[{"signal":"","confidence":0.0}],"negativeSignals":[""]},"expansions":[{"segment":"","rationale":"","searchQuery":""}]}`;

  const res = await completeJson({
    task: "icp",
    system: SYSTEM,
    prompt,
    schema: IcpResultSchema,
    mock: () => ({
      icp: { ...DEMO_ICP, regions: { value: product.regions.length ? product.regions : DEMO_ICP.regions.value, confidence: product.regions.length ? 0.9 : 0.6 } },
      expansions: [{ segment: "Multi-entity healthcare groups (NAICS 621111) after acquisitions", rationale: "Clinic roll-ups add legal entities quickly, which multiplies close work; same buyer persona (Controller).", searchQuery: "healthcare group acquires clinic legal entities finance" }],
    }),
  });

  // Ground each expansion: keep only evidence URLs that search actually returned.
  const expansions: Expansion[] = [];
  for (const e of res.data.expansions) {
    const { results } = await search(e.searchQuery, { maxResults: 3 });
    expansions.push({
      id: newId("exp"), segment: e.segment, rationale: e.rationale, status: "proposed",
      evidence: results.slice(0, 2).map((r) => ({ url: r.url, title: r.title })),
    });
  }
  return { icp: res.data.icp as Icp, expansions, tokens: res.tokens, costUsd: res.costUsd, mode: res.mode };
}
