"use client";
import { useState } from "react";
import type { Message, Person, Signal } from "@/lib/types";
import { Badge, Button } from "./ui";
import { api } from "./api";

const STATUS_TONE = { draft: "neutral", needs_fix: "red", pending_approval: "amber", approved: "blue", rejected: "red", sent: "green" } as const;

export function MessageCard({ m, person, signals, refresh }: { m: Message; person: Person; signals: Signal[]; refresh: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(m.subject ?? "");
  const [body, setBody] = useState(m.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); setEditing(false); await refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const edited = editing ? { subject: m.channel === "email" ? subject : undefined, body } : undefined;
  const review = (decision: "approve" | "reject" | "edit", note?: string) =>
    act(() => api(`/api/outreach/${m.id}/review`, { method: "POST", body: { decision, edited, note } }));

  const copyAndOpen = async () => {
    try { await navigator.clipboard.writeText(m.body); setCopied(true); } catch { setCopied(false); }
    if (person.linkedinUrl) window.open(person.linkedinUrl, "_blank", "noopener");
  };

  const open = m.status === "pending_approval" || m.status === "needs_fix";
  const sig = signals.filter((s) => m.signalIds.includes(s.id));
  const inputCls = "w-full rounded-[6px] border border-line px-2 py-1 text-[12px] focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

  return (
    <div className={`flex flex-col rounded-[6px] border border-line bg-white p-3 text-[12px] ${m.status === "rejected" ? "opacity-60" : ""}`}>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Badge tone={m.channel === "email" ? "neutral" : "blue"}>{m.channel} · touch {m.step} · day {m.dayOffset}</Badge>
        <Badge tone={STATUS_TONE[m.status]}>{m.status.replace("_", " ")}</Badge>
        {m.channel === "linkedin" && <Badge tone="amber">LinkedIn: send manually</Badge>}
        {m.editedByRep && <Badge tone="blue">edited by rep</Badge>}
      </div>

      {editing ? (
        <div className="space-y-1.5">
          {m.channel === "email" && <input className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)} />}
          <textarea className={`${inputCls} min-h-[180px]`} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
      ) : (
        <>
          {m.subject && <div className="font-medium">{m.subject}</div>}
          <p className="mt-1 flex-1 whitespace-pre-line">{m.body}</p>
        </>
      )}

      {sig.map((s) => <a key={s.id} href={s.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 block text-accent hover:underline">Signal: {s.summary}</a>)}
      {m.review?.notes?.length ? <ul className="mt-2 space-y-0.5 text-danger">{m.review.notes.map((n) => <li key={n}>{n}</li>)}</ul> : null}
      {m.sentAt && <div className="mt-2 text-muted">Sent {new Date(m.sentAt).toLocaleString()} · {m.deliveredTo === "manual:linkedin" ? "by rep on LinkedIn" : "to demo inbox"}</div>}
      {error && <div className="mt-2 text-danger">{error}</div>}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {open && !editing && <>
          <Button onClick={() => review("approve")} disabled={busy || m.status === "needs_fix"} title={m.status === "needs_fix" ? "Fix the flagged issues first" : ""}>Approve{m.channel === "email" ? " & send" : ""}</Button>
          <Button variant="secondary" onClick={() => setEditing(true)} disabled={busy}>Edit</Button>
          <Button variant="ghost" onClick={() => { const note = window.prompt("Reason for rejecting (sent back to @builder)") ?? undefined; void review("reject", note); }} disabled={busy}>Reject</Button>
        </>}
        {editing && <>
          <Button onClick={() => review("approve")} disabled={busy}>Approve edited</Button>
          <Button variant="secondary" onClick={() => review("edit")} disabled={busy}>Save</Button>
          <Button variant="ghost" onClick={() => { setEditing(false); setBody(m.body); setSubject(m.subject ?? ""); }}>Cancel</Button>
        </>}
        {m.channel === "linkedin" && m.status === "approved" && <>
          <Button variant="secondary" onClick={copyAndOpen}>{copied ? "Copied ✓ Open profile" : "Copy and open profile"}</Button>
          <Button onClick={() => act(() => api(`/api/outreach/${m.id}/mark-sent`, { method: "POST" }))} disabled={busy}>Mark sent</Button>
        </>}
      </div>
    </div>
  );
}
