"use client";
import { useState } from "react";
import { Factory, Users, Globe2, UserCircle2, Zap, Ban, Check, SlidersHorizontal, X, ExternalLink, Target, Sparkles } from "lucide-react";
import type { Workspace, Expansion } from "@/lib/types";
import { Badge, Button, Card, IconButton, SectionTitle, type Icon } from "./ui";
import { Tip } from "./Tip";
import { api } from "./api";

function conf(c: number) {
  return c >= 0.75 ? { cls: "border-tier-a/30 bg-tier-a/5", bar: "bg-tier-a" } : c >= 0.55 ? { cls: "border-tier-b/30 bg-tier-b/5", bar: "bg-tier-b" } : { cls: "border-danger/30 bg-danger/5", bar: "bg-danger" };
}

/** One ICP field as a chip, with its confidence as a tiny bar. Detail on hover. */
function Chip({ label, c, detail }: { label: string; c: number; detail?: string }) {
  const k = conf(c);
  return (
    <Tip content={`${detail ? `${detail}\n` : ""}Confidence ${c.toFixed(2)}`}>
      <span className={`inline-flex items-center gap-2 rounded-[7px] border px-2 py-1 text-[12px] ${k.cls}`}>
        <span className="max-w-[220px] truncate">{label}</span>
        <span className="h-1 w-6 rounded-full bg-line"><span className={`block h-1 rounded-full ${k.bar}`} style={{ width: `${Math.round(c * 100)}%` }} /></span>
      </span>
    </Tip>
  );
}

function Group({ icon: I, title, children }: { icon: Icon; title: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_1fr] items-start gap-2 border-t border-line py-2.5 first:border-0">
      <span className="flex items-center gap-1.5 pt-1 text-[11px] font-medium text-muted"><I size={13} />{title}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export function IcpPanel({ ws, refresh }: { ws: Workspace; refresh: () => Promise<void> }) {
  const icp = ws.icp!;
  const d = icp.data;
  const [busy, setBusy] = useState(false);
  const approve = async () => { setBusy(true); try { await api("/api/icp", { method: "PATCH", body: { approve: true } }); await refresh(); } finally { setBusy(false); } };

  return (
    <div className="space-y-4">
      <Card className="p-3.5">
        <div className="mb-1 flex items-center gap-2">
          <Target size={15} className="text-accent" />
          <span className="text-[13px] font-semibold">ICP</span><Badge>v{icp.version}</Badge>
          <span className="ml-auto">{icp.approvedAt ? <Badge tone="green" icon={Check}>Approved</Badge> : <Button icon={Check} onClick={approve} disabled={busy}>Approve ICP</Button>}</span>
        </div>
        <Group icon={Factory} title="Industry">{d.industries.map((i) => <Chip key={i.naics} label={i.name} c={i.confidence} detail={`NAICS ${i.naics}`} />)}</Group>
        <Group icon={Users} title="Size"><Chip label={`${d.companySize.value.minEmployees.toLocaleString()}–${d.companySize.value.maxEmployees.toLocaleString()}`} c={d.companySize.confidence} detail="Employees" /></Group>
        <Group icon={Globe2} title="Regions">{d.regions.value.map((r) => <Chip key={r} label={r} c={d.regions.confidence} />)}</Group>
        <Group icon={UserCircle2} title="Personas">{d.personas.map((p) => <Chip key={p.title} label={p.title} c={p.confidence} detail={p.seniority.replace("_", "-")} />)}</Group>
        <Group icon={Zap} title="Triggers">{d.triggers.map((t) => <Chip key={t.signal} label={t.signal} c={t.confidence} detail="Buying trigger" />)}</Group>
        <Group icon={Ban} title="Exclude">{d.negativeSignals.map((n) => <Badge key={n} tone="red">{n}</Badge>)}</Group>
      </Card>
      <div>
        <SectionTitle icon={Sparkles} tip="Adjacent segments the agent suggests, each with evidence from search. Accept to add them to discovery.">Expansion segments</SectionTitle>
        {ws.expansions.length === 0 && <p className="text-[12px] text-muted">None proposed</p>}
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
    <Card className={`p-3 text-[13px] ${e.status === "dismissed" ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-2">
        {editing
          ? <input className="flex-1 rounded-[6px] border border-line px-2 py-1 text-[13px] focus:border-accent focus:outline-none" aria-label="Segment" value={text} onChange={(ev) => setText(ev.target.value)} />
          : <Tip content={e.rationale} className="min-w-0 flex-1"><span className="truncate font-medium">{e.segment}</span></Tip>}
        <Badge tone={tone}>{e.status}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {e.evidence.map((ev) => <Tip key={ev.url} content={ev.title}><a href={ev.url} className="inline-flex items-center gap-1 rounded-[5px] bg-accent/10 px-1.5 py-0.5 text-[11px] text-accent hover:bg-accent hover:text-white" target="_blank" rel="noreferrer"><ExternalLink size={11} />{new URL(ev.url).hostname}</a></Tip>)}
        {e.evidence.length === 0 && <span className="text-[11px] text-muted">No evidence found</span>}
        <span className="ml-auto flex gap-1">
          {editing ? (
            <><Button onClick={() => decide("adjusted")}>Save</Button><Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button></>
          ) : (
            <><IconButton icon={Check} label="Accept" tone="green" onClick={() => decide("accepted")} /><IconButton icon={SlidersHorizontal} label="Adjust" onClick={() => setEditing(true)} /><IconButton icon={X} label="Dismiss" tone="red" onClick={() => decide("dismissed")} /></>
          )}
        </span>
      </div>
    </Card>
  );
}
