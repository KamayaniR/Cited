"use client";
import { useState } from "react";
import type { Workspace, Expansion } from "@/lib/types";
import { Badge, Button, Card, ConfidenceBar } from "./ui";
import { api } from "./api";

export function IcpPanel({ ws, refresh }: { ws: Workspace; refresh: () => Promise<void> }) {
  const icp = ws.icp!;
  const [busy, setBusy] = useState(false);
  const approve = async () => { setBusy(true); try { await api("/api/icp", { method: "PATCH", body: { approve: true } }); await refresh(); } finally { setBusy(false); } };

  const rows: { label: string; detail?: string; c: number }[] = [
    ...icp.data.industries.map((i) => ({ label: i.name, detail: `NAICS ${i.naics}`, c: i.confidence })),
    { label: `${icp.data.companySize.value.minEmployees.toLocaleString()}–${icp.data.companySize.value.maxEmployees.toLocaleString()} employees`, c: icp.data.companySize.confidence },
    { label: icp.data.regions.value.join(", "), detail: "Regions", c: icp.data.regions.confidence },
    ...icp.data.personas.map((p) => ({ label: p.title, detail: `Persona · ${p.seniority.replace("_", "-")}`, c: p.confidence })),
    ...icp.data.triggers.map((t) => ({ label: t.signal, detail: "Trigger", c: t.confidence })),
  ];

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-muted">ICP v{icp.version}</div>
          {icp.approvedAt ? <Badge tone="green">Approved</Badge> : <Button onClick={approve} disabled={busy}>Approve ICP</Button>}
        </div>
        <table className="mt-2 w-full text-[13px]">
          <tbody className="divide-y divide-line">
            {rows.map((r, i) => (
              <tr key={i}><td className="py-1.5 pr-3">{r.label}{r.detail && <div className="font-mono text-[11px] text-muted">{r.detail}</div>}</td><td className="w-36"><ConfidenceBar value={r.c} /></td></tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 text-[12px] text-muted">Negative filters: {icp.data.negativeSignals.join("; ")}</div>
      </Card>
      <div>
        <h2 className="mb-2 font-serif text-lg">Expansion segments</h2>
        {ws.expansions.length === 0 && <p className="text-[13px] text-muted">No expansion segments proposed.</p>}
        <div className="space-y-2">{ws.expansions.map((e) => <ExpansionCard key={e.id} e={e} refresh={refresh} />)}</div>
      </div>
    </div>
  );
}

function ExpansionCard({ e, refresh }: { e: Expansion; refresh: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(e.segment);
  const decide = async (status: "accepted" | "adjusted" | "dismissed") => {
    await api(`/api/icp/expansions/${e.id}`, { method: "POST", body: status === "adjusted" ? { status, adjusted: text } : { status } });
    setEditing(false);
    await refresh();
  };
  const tone = e.status === "accepted" || e.status === "adjusted" ? "green" : e.status === "dismissed" ? "red" : "neutral";
  return (
    <Card className={`p-4 text-[13px] ${e.status === "dismissed" ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        {editing
          ? <input className="flex-1 rounded-[6px] border border-line px-2 py-1 text-[13px] focus:border-accent focus:outline-none" value={text} onChange={(ev) => setText(ev.target.value)} />
          : <div className="font-medium">{e.segment}</div>}
        <Badge tone={tone}>{e.status}</Badge>
      </div>
      <p className="mt-1 text-muted">{e.rationale}</p>
      <div className="mt-2 space-x-2 text-[12px]">
        {e.evidence.map((ev, i) => <a key={ev.url} href={ev.url} title={ev.title} className="text-accent hover:underline" target="_blank" rel="noreferrer">[{i + 1}] {new URL(ev.url).hostname}</a>)}
        {e.evidence.length === 0 && <span className="text-muted">No evidence found by search</span>}
      </div>
      <div className="mt-3 flex gap-2">
        {editing ? (
          <><Button onClick={() => decide("adjusted")}>Save adjusted</Button><Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button></>
        ) : (
          <><Button variant="secondary" onClick={() => decide("accepted")}>Accept</Button><Button variant="secondary" onClick={() => setEditing(true)}>Adjust</Button><Button variant="ghost" onClick={() => decide("dismissed")}>Dismiss</Button></>
        )}
      </div>
    </Card>
  );
}
