"use client";
import { useState } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { ActorTag, Avatar, Badge, Button, Card, PageTitle, ScoreRing } from "@/components/ui";
import { Tip } from "@/components/Tip";
import { KanbanSquare, CircleDot, Send, MessageCircleReply, CalendarCheck, Flag, Trophy, XCircle, Bot, User, GripVertical, History, X, Mail, Linkedin, ArrowRightLeft } from "lucide-react";

const STAGE_ICON: Record<Stage, { icon: typeof Send; bar: string }> = {
  matched: { icon: CircleDot, bar: "bg-tier-c" },
  contacted: { icon: Send, bar: "bg-rep" },
  replied: { icon: MessageCircleReply, bar: "bg-agent" },
  meeting_booked: { icon: CalendarCheck, bar: "bg-tier-a" },
  closed_lost: { icon: Flag, bar: "bg-ink" },
};
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

  const title = <PageTitle icon={KanbanSquare} title="Pipeline" tip="Drag a card to move it. Approved sends move leads automatically and are tagged agent; your moves are tagged rep in the audit log. Click a card for its history." />;
  if (!ws?.leads.length) return (<div>{title}<EmptyState what="leads" /></div>);

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
      {title}
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
              className={`min-h-[360px] min-w-0 overflow-hidden rounded-[10px] transition ${over === stage ? "bg-accent/10 ring-1 ring-accent/40" : "bg-line/30"}`}
            >
              <div className={`h-1 ${STAGE_ICON[stage].bar}`} />
              <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-2 text-[12px] font-semibold">
                {(() => { const I = STAGE_ICON[stage].icon; return <I size={13} className="text-muted" />; })()}
                <span className="truncate">{STAGE_LABELS[stage]}</span><span className="ml-auto rounded-full bg-white px-1.5 font-mono text-[10px] text-muted">{leads.length}</span>
              </div>
              <div className="space-y-2 px-2 pb-2">
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
  const closed = lead.stage === "closed_lost" && lead.outcome;
  return (
    <div draggable onDragStart={onDragStart} data-lead={lead.id} className={`group cursor-grab active:cursor-grabbing ${dragging ? "opacity-40" : ""}`}>
      <Card className="p-2.5 text-[13px]">
        <div className="flex items-start gap-2">
          <ScoreRing tier={c.tier} score={c.score} size={28} muted={c.excluded} />
          <button onClick={onOpen} className="min-w-0 flex-1 text-left">
            <Tip content={`${c.name}\nClick for history`} className="block"><div className="truncate font-medium hover:underline">{c.name}</div></Tip>
            {p && <div className="truncate text-[11px] text-muted">{p.name}</div>}
          </button>
          <GripVertical size={14} className="mt-1 shrink-0 text-line group-hover:text-muted" />
        </div>
        <div className="mt-2 flex items-center gap-1">
          <Tip content={lead.owner === "agent" ? "Last move by an agent" : "Last move by a rep"}><span aria-label={lead.owner} className={`grid h-5 w-5 place-items-center rounded-full ${lead.owner === "agent" ? "bg-agent/10 text-agent" : "bg-rep/10 text-rep"}`}>{lead.owner === "agent" ? <Bot size={11} /> : <User size={11} />}</span></Tip>
          <Badge title="A/B variant">{lead.variant}</Badge>
          {c.excluded && <Badge tone="red" title={c.excludeReason ?? ""}>filtered</Badge>}
          {closed && <Badge tone={lead.outcome === "won" ? "green" : "red"} icon={lead.outcome === "won" ? Trophy : XCircle} title={lead.closeReason ?? undefined}>{lead.outcome}</Badge>}
          <Tip content="Move to…" className="relative ml-auto inline-grid h-5 w-5 place-items-center rounded-[4px] text-muted hover:bg-line/60 hover:text-ink">
            <ArrowRightLeft size={12} />
            <select aria-label={`Move ${c.name}`} value={lead.stage} onChange={(e) => onMove(e.target.value as Stage)}
              className="absolute inset-0 cursor-pointer opacity-0">
              {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
          </Tip>
        </div>
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
        <h2 className="flex items-center gap-2 font-serif text-[20px]"><Flag size={18} className="text-muted" />Close {c?.name}</h2>
        <div className="mt-4 flex gap-2">
          {(["won", "lost"] as const).map((o) => (
            <button key={o} onClick={() => setOutcome(o)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-[8px] border px-3 py-3 text-[13px] font-medium capitalize ${outcome === o ? (o === "won" ? "border-tier-a bg-tier-a/10 text-tier-a" : "border-danger bg-danger/10 text-danger") : "border-line bg-white"}`}>{o === "won" ? <Trophy size={16} /> : <XCircle size={16} />}{o}</button>
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
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent"><History size={13} />History</div>
            <h2 className="font-serif text-[22px]">{c?.name}</h2>
            {p && <div className="mt-1 flex items-center gap-2 text-[13px] text-muted"><Avatar name={p.name} size={22} />{p.name} · {p.title}</div>}
          </div>
          <Button variant="ghost" onClick={onClose} aria-label="Close"><X size={16} /></Button>
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
                <div className="mb-1 flex gap-1.5"><Badge icon={m.channel === "email" ? Mail : Linkedin}>#{m.step}</Badge><Badge tone="blue">{m.deliveredTo}</Badge></div>
                {m.subject && <div className="font-medium">{m.subject}</div>}
                <div className="line-clamp-3 whitespace-pre-wrap text-muted">{m.body}</div>
              </Card>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
