"use client";
import { useState } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Badge, Button, Card } from "@/components/ui";
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
      {msg && <span className="max-w-[320px] text-[12px] text-muted">{msg}</span>}
      <Button variant="secondary" onClick={run} disabled={busy}>{busy ? "Checking…" : "Check Band for decisions"}</Button>
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
      <p className="text-[12px] text-muted">
        {bandLive ? "These cards are also posted in the Band room. A reply there such as \"approve b_1 except msg_x (too long)\" runs the same decision." : "Band is offline, so these decisions are made here. With Band connected, the same cards go to the room and replies there run the same code."}
      </p>
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

  return (
    <Card className="border-l-4 border-l-accent p-4" >
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <Badge tone="violet">@security</Badge><span className="font-medium">Outreach approval · batch {String(a.payload.batch)}</span>
        <span className="text-muted">{leads} lead{leads === 1 ? "" : "s"} · {msgs.length} messages · {signals} cited signals · links: 0 uncited domains · claim check {supported}/{msgs.length} fully supported · cost {emails} credit{emails === 1 ? "" : "s"}</span>
      </div>
      <div className="mt-3 space-y-1.5">
        {open.map((m) => (
          <label key={m.id} className="flex flex-wrap items-center gap-2 text-[12px]">
            <input type="checkbox" checked={m.id in rejects} onChange={(e) => setRejects((r) => { const n = { ...r }; if (e.target.checked) n[m.id] = ""; else delete n[m.id]; return n; })} />
            <span>Reject</span><span className="font-mono">{m.id}</span><Badge>{m.channel} · step {m.step}</Badge>
            <span className="max-w-[360px] truncate text-muted">{m.subject ?? m.body}</span>
            {m.id in rejects && <input aria-label={`Reason for ${m.id}`} value={rejects[m.id]} onChange={(e) => setRejects((r) => ({ ...r, [m.id]: e.target.value }))} placeholder="Reason (goes back to @builder)" className="min-w-[220px] flex-1 rounded-[4px] border border-line px-2 py-0.5" />}
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button onClick={() => decide("approve")} disabled={busy || !open.length}>{busy ? "Working…" : Object.keys(rejects).length ? `Approve ${open.length - Object.keys(rejects).length}, reject ${Object.keys(rejects).length}` : `Approve all ${open.length}`}</Button>
        <Button variant="secondary" onClick={() => decide("reject")} disabled={busy || !open.length}>Reject batch</Button>
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
    <Card className="border-l-4 border-l-tier-b p-4">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <Badge tone="violet">@{a.requestedBy}</Badge><span className="font-medium">Schema change · {String(a.payload.adds)}</span>
        <span className="text-muted">{String(a.payload.reason)}</span>
      </div>
      <pre className="mt-2 whitespace-pre-wrap rounded-[6px] bg-ink p-2 font-mono text-[11px] text-white">{String(a.payload.cypher)}</pre>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" aria-label="Schema decision note" className="min-w-[240px] rounded-[6px] border border-line px-2 py-1 text-[13px]" />
        <Button variant="secondary" onClick={() => decide("approve")} disabled={busy}>Approve migration</Button>
        <Button variant="danger" onClick={() => decide("reject")} disabled={busy}>Reject</Button>
        {err && <span className="text-[12px] text-danger">{err}</span>}
      </div>
    </Card>
  );
}
