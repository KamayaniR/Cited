import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspace } from "@/lib/db/store";
import { searchEvidence } from "@/lib/providers/moss";
import { route } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

const Q = z.object({ q: z.string().min(2).max(300), companyId: z.string().optional(), topK: z.coerce.number().int().min(1).max(10).default(5) });

/** GET /api/evidence/search?q=&companyId=: Moss hybrid search over every cited page, scoped to a company. */
export const GET = route(async (req: Request) => {
  const p = Q.parse(Object.fromEntries(new URL(req.url).searchParams));
  const r = await searchEvidence(p.q, { companyId: p.companyId, includeSelf: false, topK: p.topK });
  const ws = getWorkspace();
  return NextResponse.json({
    ms: Number(r.ms.toFixed(2)), engine: r.engine, mode: r.mode,
    hits: r.hits.map((h) => ({ ...h, score: Number(h.score.toFixed(2)), company: ws.companies.find((c) => c.id === h.metadata.companyId)?.name ?? null })),
  });
});
