"use client";
import { useState } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { ActorTag, Badge, Button, Card, PageTitle, TierBadge } from "@/components/ui";
import { EmptyState } from "@/components/EmptyState";
import { api } from "@/components/api";
import { STAGES, STAGE_LABELS, type Lead, type Stage, type Workspace } from "@/lib/types";

type Pending = { lead: Lead; to: Stage };

export default function PipelinePage() {
  const { ws, refresh } = useWorkspace();
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  const [closing, setClosing] = useState<Pending | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!ws?.leads.length) return (<div><PageTitle kicker="Pipeline" title="Leads by stage" /><EmptyState what="leads" /></div>);

  async function move(lead: Lead, to: Stage, outcome?: "won" | "lost", note?: string) {
    setBusy(true); setError(null);
    try {
      await api(`/api/leads/${lead.id}/stage`, { method: "PATCH", body: { stage: to, outcome, note } });
      await refresh();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  function request(lead: Lead, to: Stage) {
    if (to === lead.stage) return;
    if (to === "closed_lost") setClosing({ lead, to });
    else void move(lead, to);
  }

  const open = openId ? ws.leads.find((l) => l.id === openId) ?? null : null;

  return (
    <div>
      <PageTitle kicker="Pipeline" title="Leads by stage">
        <div className="text-[12px] text-muted">Drag a card to move it. Moves are tagged <ActorTag actor="rep" /> in the audit log.</div>
      </PageTitle>
      {error && <div className="mb-3 rounded-[6px] bg-danger/10 px-3 py-2 text-[13px] text-danger">{error}</div>}
      <div className="grid grid-cols-[repeat(5,minmax(140px,1fr))] gap-3 overflow-x-auto pb-2" aria-busy={busy}>
        {STAGES.map((stage) => {
          const leads = ws.leads.filter((l) => l.stage === stage);
          return (
            <section
              key={stage}
              data-stage={stage}
              aria-label={STAGE_LABELS[stage]}
              onDragOver={(e) => { e.preventDefault(); setOver(stage); }}
              onDragLeave={() => setOver((s) => (s === stage ? null : s))}
              onDrop={(e) => {
                e.preventDefault(); setOver(null);
                const lead = ws.leads.find((l) => l.id === (e.dataTransfer.getData("text/plain") || dragId));
                setDragId(null);
                if (lead) request(lead, stage);
              }}
              className={`min-h-[320px] min-w-0 rounded-[8px] p-2 transition ${over === stage ? "bg-accent/10 ring-1 ring-accent/40" : "bg-line/30"}`}
            >
              <div className="mb-2 flex items-center justify-between px-1 text-[12px] font-semibold uppercase tracking-wider text-muted">
                <span>{STAGE_LABELS[stage]}</span><span className="font-mono">{leads.length}</span>
              </div>
              <div className="space-y-2">
                {leads.map((l) => <LeadCard key={l.id} ws={ws} lead={l} dragging={dragId === l.id}
                  onDragStart={(e) => { e.dataTransfer.setData("text/plain", l.id); e.dataTransfer.effectAllowed = "move"; setDragId(l.id); }}
                  onOpen={() => setOpenId(l.id)} onMove={(to) => request(l, to)} />)}
              </div>
            </section>
          );
        })}
      </div>
      {closing && <CloseModal ws={ws} pending={closing} onCancel={() => setClosing(null)}
        onConfirm={async (outcome, note) => { const p = closing; setClosing(null); await move(p.lead, p.to, outcome, note); }} />}
      {open && <HistoryDrawer ws={ws} lead={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function LeadCard({ ws, lead, dragging, onDragStart, onOpen, onMove }: {
  ws: Workspace; lead: Lead; dragging: boolean; onDragStart: (e: React.DragEvent) => void; onOpen: () => void; onMove: (to: Stage) => void;
}) {
  const c = ws.companies.find((x) => x.id === lead.companyId)!;
  const p = ws.people.find((x) => x.id === lead.personId);
  return (
    <div draggable onDragStart={onDragStart} data-lead={lead.id} className={`cursor-grab active:cursor-grabbing ${dragging ? "opacity-40" : ""}`}>
      <Card className="p-3 text-[13px]">
        <button onClick={onOpen} className="block w-full text-left">
          <div className="truncate font-medium hover:underline" title={c.name}>{c.name}</div>
          <div className="line-clamp-2 text-[12px] text-muted">{p?.name}{p?.title ? `, ${p.title}` : ""}</div>
        </button>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <TierBadge tier={c.tier} score={c.score} />
          <ActorTag actor={lead.owner} />
          <Badge title="A/B variant">{lead.variant}</Badge>
          {c.excluded && <Badge tone="red" title={c.excludeReason ?? ""}>filtered</Badge>}
          {lead.stage === "closed_lost" && lead.outcome && <Badge tone={lead.outcome === "won" ? "green" : "red"}>{lead.outcome}</Badge>}
        </div>
        {lead.closeReason && <div className="mt-1.5 text-[11px] text-muted">{lead.closeReason}</div>}
        <label className="mt-2 flex items-center gap-1 text-[11px] text-muted">
          <span className="sr-only">Move {c.name} to</span>
          <select aria-label={`Move ${c.name}`} value={lead.stage} onChange={(e) => onMove(e.target.value as Stage)}
            className="w-full rounded-[4px] border border-line bg-white px-1 py-0.5 text-[11px]">
            {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
          </select>
        </label>
      </Card>
    </div>
  );
}

function CloseModal({ ws, pending, onCancel, onConfirm }: { ws: Workspace; pending: Pending; onCancel: () => void; onConfirm: (o: "won" | "lost", note: string) => void }) {
  const [outcome, setOutcome] = useState<"won" | "lost" | null>(null);
  const [note, setNote] = useState("");
  const c = ws.companies.find((x) => x.id === pending.lead.companyId);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4" role="dialog" aria-modal="true" aria-label="Close lead">
      <Card className="w-full max-w-md p-5">
        <h2 className="font-serif text-[20px]">Close {c?.name}</h2>
        <p className="mt-1 text-[13px] text-muted">Was this deal won or lost? The outcome feeds the win rate in Analytics.</p>
        <div className="mt-4 flex gap-2">
          {(["won", "lost"] as const).map((o) => (
            <button key={o} onClick={() => setOutcome(o)}
              className={`flex-1 rounded-[6px] border px-3 py-2 text-[13px] font-medium capitalize ${outcome === o ? (o === "won" ? "border-tier-a bg-tier-a/10 text-tier-a" : "border-danger bg-danger/10 text-danger") : "border-line bg-white"}`}>{o}</button>
          ))}
        </div>
        <label className="mt-4 block text-[12px] font-medium">Reason
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} placeholder="e.g. Signed a pilot, or chose a competitor"
            className="mt-1 w-full rounded-[6px] border border-line px-2 py-1.5 text-[13px] font-normal" />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button disabled={!outcome} onClick={() => outcome && onConfirm(outcome, note)}>Close as {outcome ?? "…"}</Button>
        </div>
      </Card>
    </div>
  );
}

function HistoryDrawer({ ws, lead, onClose }: { ws: Workspace; lead: Lead; onClose: () => void }) {
  const c = ws.companies.find((x) => x.id === lead.companyId);
  const p = ws.people.find((x) => x.id === lead.personId);
  const events = ws.leadEvents.filter((e) => e.leadId === lead.id).sort((a, b) => a.at.localeCompare(b.at));
  const sent = ws.messages.filter((m) => m.leadId === lead.id && m.status === "sent");
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/20" onClick={onClose}>
      <aside className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()} aria-label="Lead history">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-accent">Lead history</div>
            <h2 className="font-serif text-[22px]">{c?.name}</h2>
            <div className="text-[13px] text-muted">{p?.name}, {p?.title}</div>
          </div>
          <Button variant="ghost" onClick={onClose} aria-label="Close">✕</Button>
        </div>
        <ol className="mt-5 space-y-3 border-l border-line pl-4">
          {events.map((e) => (
            <li key={e.id} className="text-[13px]">
              <div className="flex items-center gap-2">
                <span className="font-medium">{e.fromStage ? `${STAGE_LABELS[e.fromStage]} → ` : ""}{STAGE_LABELS[e.toStage]}</span>
                <ActorTag actor={e.actor} />
              </div>
              <div className="text-muted">{e.note}</div>
              <div className="font-mono text-[11px] text-muted">{new Date(e.at).toLocaleString()}</div>
            </li>
          ))}
        </ol>
        {sent.length > 0 && (
          <div className="mt-6">
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted">Sent touches</div>
            {sent.map((m) => (
              <Card key={m.id} className="mb-2 p-3 text-[12px]">
                <div className="mb-1 flex gap-1.5"><Badge>{m.channel}</Badge><Badge>step {m.step}</Badge><Badge tone="blue">{m.deliveredTo}</Badge></div>
                {m.subject && <div className="font-medium">{m.subject}</div>}
                <div className="whitespace-pre-wrap text-muted">{m.body}</div>
              </Card>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
