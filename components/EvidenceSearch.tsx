"use client";
import { useState } from "react";
import { Search, Zap, ExternalLink } from "lucide-react";
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
    <div className="mt-3 text-[12px]">
      <div className="flex items-center gap-2 rounded-[8px] border border-line bg-paper/60 px-2.5 py-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
        <Search size={14} className="text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()}
          placeholder={`Ask the evidence about ${companyName}…`} aria-label={`Ask the evidence about ${companyName}`}
          className="flex-1 bg-transparent outline-none" />
        <button onClick={run} className="rounded-[5px] px-2 py-0.5 font-medium text-accent hover:bg-accent/10">Search</button>
      </div>
      {error && <div className="mt-1 text-danger">{error}</div>}
      {res && (
        <div className="mt-2 space-y-1.5">
          <div className="inline-flex items-center gap-1 rounded-full bg-agent/10 px-2 py-0.5 font-mono text-[10px] text-agent"><Zap size={10} />Moss{res.engine === "moss" ? "" : " (mock)"} · {res.ms.toFixed(2)} ms · {res.hits.length} hits</div>
          {res.hits.length === 0 && <div className="text-muted">No evidence found.</div>}
          {res.hits.map((h) => (
            <div key={h.id} className="flex items-start gap-2 rounded-[6px] border border-line bg-white px-2 py-1.5">
              <span className="mt-1 h-1.5 w-10 shrink-0 rounded-full bg-line"><span className="block h-1.5 rounded-full bg-accent" style={{ width: `${Math.round(h.score * 100)}%` }} /></span>
              <span className="flex-1">{h.text}</span>
              {h.metadata.url && <a href={h.metadata.url} target="_blank" rel="noreferrer" title={h.metadata.url} className="inline-flex shrink-0 items-center gap-0.5 text-accent hover:underline"><ExternalLink size={11} />{new URL(h.metadata.url).hostname.replace(/^www\./, "")}</a>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
