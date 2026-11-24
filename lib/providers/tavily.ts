import "server-only";
import { vendorFetch } from "@/lib/monitor";
import { env, mockFor } from "@/lib/env";
import { ApiError } from "@/lib/api/errors";
import { MOCK_SEARCH_RESULTS } from "@/lib/seed/fixtures";

export interface SearchResult { url: string; title: string; content: string; score: number }

/** Web search. Every lead/signal citation must be a URL returned here (see lib/pipeline/citations.ts in P1). */
export async function search(query: string, opts: { maxResults?: number; includeDomains?: string[]; depth?: "basic" | "advanced" } = {}): Promise<{ results: SearchResult[]; mode: "live" | "mock" }> {
  if (mockFor("tavily")) {
    const words = [...new Set(query.toLowerCase().split(/\W+/).filter((w) => w.length > 3))];
    const scored = MOCK_SEARCH_RESULTS
      .map((r) => ({ r, n: words.filter((w) => (r.title + " " + r.content).toLowerCase().includes(w)).length }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n);
    // Like a real engine, show one result per site so one company's many pages don't crowd out the rest.
    const seenHost = new Set<string>();
    const hits = scored.map((x) => x.r).filter((r) => { const h = new URL(r.url).host; if (seenHost.has(h)) return false; seenHost.add(h); return true; });
    const scoped = opts.includeDomains ? MOCK_SEARCH_RESULTS.filter((r) => opts.includeDomains!.some((d) => r.url.includes(d))) : (hits.length ? hits : MOCK_SEARCH_RESULTS);
    return { results: scoped.slice(0, opts.maxResults ?? 8), mode: "mock" };
  }
  const res = await vendorFetch("tavily", "https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.tavilyKey}` },
    body: JSON.stringify({ query, max_results: opts.maxResults ?? 8, search_depth: opts.depth ?? "advanced", ...(opts.includeDomains ? { include_domains: opts.includeDomains } : {}) }),
  });
  if (!res.ok) throw new ApiError("VENDOR_ERROR", `Tavily failed: HTTP ${res.status}`, { vendor: "tavily" });
  const body = (await res.json()) as { results: SearchResult[] };
  return { results: body.results, mode: "live" };
}
