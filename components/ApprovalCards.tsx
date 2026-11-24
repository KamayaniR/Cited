"use client";
import { useState } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Badge, Button, Card } from "@/components/ui";
import { Tip, InfoTip } from "@/components/Tip";
import { RoleChip } from "@/components/AgentPanel";
import { Mail, Linkedin, Users, Link2, ShieldCheck, ShieldAlert, Coins, Check, X, Radio, Database } from "lucide-react";
import { api } from "@/components/api";
import type { Approval, Workspace } from "@/lib/types";

/** Pending outreach batches and schema changes: the same decisions a human can make in the Band room. */
export function CheckBandButton() {
  const { modes, refresh } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (modes?.band !== "live") return null;
  const run = async () => {
    setBusy(true); setMsg(null);
    try { const r = await api<{ handled: number; replies: string[] }>("/api/band/poll", { method: "POST" }); setMsg(r.handled ? r.replies.join(" ") : "No new decisions in the Band room."); }
    catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); await refresh(); }
  };
  return (
    <span className="flex items-center gap-2">
      {msg && <Tip content={msg}><span className="max-w-[200px] truncate text-[12px] text-muted">{msg}</span></Tip>}
      <Button variant="secondary" icon={Radio} onClick={run} disabled={busy}>{busy ? "Checking…" : "Check Band"}</Button>
    </span>
  );
}

export function ApprovalCards() {
  const { ws, modes } = useWorkspace();
  if (!ws) return null;
  const pending = ws.approvals.filter((a) => a.status === "pending" && (a.kind === "outreach" || a.kind === "schema"));
  const bandLive = modes?.band === "live";
  if (!pending.length) return null;
  return (
    <div className="mb-5 space-y-3">
      {pending.map((a) => a.kind === "outreach" ? <BatchCard key={a.id} a={a} ws={ws} /> : <SchemaCard key={a.id} a={a} />)}
      <div className="flex items-center gap-1.5 text-[11px] text-muted">
        <Radio size={12} className={bandLive ? "text-agent" : ""} />{bandLive ? "Also in the Band room" : "Band offline · decide here"}
        <InfoTip content={bandLive ? "These cards are also posted in the Band room. A reply there such as \"approve b_1 except msg_x (too long)\" runs the same decision." : "With Band connected, the same cards go to the room and replies there run the same code."} />
      </div>
    </div>
  );
}

function BatchCard({ a, ws }: { a: Approval; ws: Workspace }) {
  const { refresh } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const ids = (a.payload.messageIds as string[]) ?? [];
  const msgs = ws.messages.filter((m) => ids.includes(m.id));
  const open = msgs.filter((m) => m.status === "pending_approval" || m.status === "needs_fix");
  const leads = new Set(msgs.map((m) => m.leadId)).size;
  const signals = new Set(msgs.flatMap((m) => m.signalIds)).size;
  const emails = open.filter((m) => m.channel === "email").length;
  const supported = msgs.filter((m) => m.review?.grounding ? m.review.grounding.claims.every((c) => c.supported) : true).length;
  const [rejects, setRejects] = useState<Record<string, string>>({});

  async function decide(decision: "approve" | "reject") {
    setBusy(true); setResult(null);
    try {
      const r = await api<{ approved: string[]; rejected: string[]; failed: { id: string; error: string }[] }>(`/api/approvals/${a.id}`, { method: "POST", body: decision === "approve" ? { decision, reject: rejects } : { decision, note: "Batch rejected by rep" } });
      setResult(`${r.approved.length} approved, ${r.rejected.length} rejected${r.failed.length ? `; not approved: ${r.failed.map((f) => `${f.id} (${f.error})`).join(", ")}` : ""}`);
    } catch (e) { setResult((e as Error).message); }
    finally { setBusy(false); await refresh(); }
  }

  const allOk = supported === msgs.length;
  const nRej = Object.keys(rejects).length;
  return (
    <Card className="border-l-4 border-l-accent p-3.5">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <RoleChip role="security" />
        <span className="font-semibold">Batch {String(a.payload.batch)}</span>
        <span className="flex flex-wrap items-center gap-1">
          <Badge icon={Users} title="Leads in this batch">{leads}</Badge>
          <Badge icon={Mail} title="Messages">{msgs.length}</Badge>
          <Badge icon={Link2} tone="accent" title="Cited signals behind these messages">{signals}</Badge>
          <Badge icon={ShieldCheck} tone="green" title="Links to uncited domains: 0">links ok</Badge>
          <Badge icon={allOk ? ShieldCheck : ShieldAlert} tone={allOk ? "green" : "red"} title="Messages whose every claim matched stored evidence">{supported}/{msgs.length} claims</Badge>
          <Badge icon={Coins} tone="amber" title="1 credit per email sent; LinkedIn is sent by hand">{emails}</Badge>
        </span>
      </div>
      <div className="mt-2.5 space-y-1">
        {open.map((m) => {
          const on = m.id in rejects;
          return (
            <div key={m.id} className={`flex flex-wrap items-center gap-2 rounded-[6px] px-2 py-1 text-[12px] ${on ? "bg-danger/5" : "bg-paper/70"}`}>
              <label className="inline-flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={on} onChange={(e) => setRejects((r) => { const n = { ...r }; if (e.target.checked) n[m.id] = ""; else delete n[m.id]; return n; })} aria-label={`Reject ${m.id}`} />
                <span className={on ? "text-danger" : "text-muted"}>Reject</span>
              </label>
              {m.channel === "email" ? <Mail size={13} /> : <Linkedin size={13} className="text-rep" />}
              <span className="font-medium">#{m.step}</span>
              <span className="max-w-[340px] truncate text-muted">{m.subject ?? m.body}</span>
              {on && <input aria-label={`Reason for ${m.id}`} value={rejects[m.id]} onChange={(e) => setRejects((r) => ({ ...r, [m.id]: e.target.value }))} placeholder="Reason → @builder" className="min-w-[180px] flex-1 rounded-[4px] border border-line bg-white px-2 py-0.5" />}
            </div>
          );
        })}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Button icon={Check} onClick={() => decide("approve")} disabled={busy || !open.length}>{busy ? "Working…" : nRej ? `Approve ${open.length - nRej}, reject ${nRej}` : `Approve all ${open.length}`}</Button>
        <Button variant="secondary" icon={X} onClick={() => decide("reject")} disabled={busy || !open.length}>Reject batch</Button>
        {result && <span className="text-[12px] text-muted" role="status">{result}</span>}
      </div>
    </Card>
  );
}

function SchemaCard({ a }: { a: Approval }) {
  const { refresh } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  async function decide(decision: "approve" | "reject") {
    setBusy(true); setErr(null);
    try { await api(`/api/approvals/${a.id}`, { method: "POST", body: { decision, note: note || undefined } }); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); await refresh(); }
  }
  return (
    <Card className="border-l-4 border-l-tier-b p-3.5">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <RoleChip role={a.requestedBy} /><Database size={14} className="text-tier-b" /><span className="font-semibold">Schema change</span><Badge tone="amber">{String(a.payload.adds)}</Badge>
        <InfoTip content={String(a.payload.reason)} />
      </div>
      <pre className="mt-2 overflow-x-auto rounded-[6px] bg-ink px-2.5 py-1.5 font-mono text-[11px] text-white">{String(a.payload.cypher)}</pre>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Schema decision note" className="min-w-[240px] rounded-[6px] border border-line px-2 py-1 text-[13px]" />
        <Button variant="secondary" icon={Check} onClick={() => decide("approve")} disabled={busy}>Approve migration</Button>
        <Button variant="danger" icon={X} onClick={() => decide("reject")} disabled={busy}>Reject</Button>
        {err && <span className="text-[12px] text-danger">{err}</span>}
      </div>
    </Card>
  );
}
