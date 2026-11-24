"use client";
import { useState } from "react";
import { api } from "./api";

type Hit = { id: string; text: string; score: number; metadata: { url: string; title: string; entityType: string } };

/** Ask the evidence memory a question about one lead's company. Powered by Moss (in-process, ms latency). */
export function EvidenceSearch({ companyId, companyName }: { companyId: string; companyName: string }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ hits: Hit[]; ms: number; engine: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    if (q.trim().length < 2) return;
    setError(null);
    try { setRes(await api(`/api/evidence/search?companyId=${encodeURIComponent(companyId)}&q=${encodeURIComponent(q)}&topK=3`)); }
    catch (e) { setError((e as Error).message); }
  };
  return (
    <div className="mt-3 rounded-[6px] border border-line p-2 text-[12px]">
      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder={`Ask the evidence about ${companyName}, e.g. "did they change ERP?"`}
          className="flex-1 rounded-[6px] border border-line px-2 py-1 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30" />
        <button onClick={run} className="rounded-[6px] px-2 text-accent hover:bg-line/50">Search</button>
      </div>
      {error && <div className="mt-1 text-danger">{error}</div>}
      {res && (
        <div className="mt-2">
          <div className="mb-1 font-mono text-[10px] text-muted">{res.hits.length} results · Moss {res.engine === "moss" ? "" : "(mock) "}{res.ms.toFixed(2)} ms</div>
          {res.hits.length === 0 && <div className="text-muted">No evidence found.</div>}
          {res.hits.map((h) => (
            <div key={h.id} className="mb-1 flex gap-2">
              <span className="font-mono text-[10px] text-muted">{h.score.toFixed(2)}</span>
              <span className="flex-1">{h.text} {h.metadata.url && <a href={h.metadata.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">[{new URL(h.metadata.url).hostname}]</a>}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
