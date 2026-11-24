"use client";
import { useState } from "react";
import { Mail, Linkedin, Check, X, Pencil, ShieldCheck, ShieldAlert, Copy, Send, ChevronDown, ChevronUp, Clock, UserPen } from "lucide-react";
import type { Message, Person, Signal } from "@/lib/types";
import { Badge, Button, IconButton, type Tone } from "./ui";
import { Tip } from "./Tip";
import { SignalChip } from "./signals";
import { api } from "./api";

const STATUS: Record<Message["status"], { tone: Tone; label: string }> = {
  draft: { tone: "neutral", label: "draft" }, needs_fix: { tone: "red", label: "needs fix" }, pending_approval: { tone: "amber", label: "to approve" },
  approved: { tone: "blue", label: "approved" }, rejected: { tone: "red", label: "rejected" }, sent: { tone: "green", label: "sent" },
};

export function MessageCard({ m, person, signals, refresh }: { m: Message; person: Person; signals: Signal[]; refresh: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [subject, setSubject] = useState(m.subject ?? "");
  const [body, setBody] = useState(m.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true); setError(null);
    try { await fn(); setEditing(false); } catch (e) { setError((e as Error).message); } finally { await refresh(); setBusy(false); }
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
  const g = m.review?.grounding;
  const bad = g?.claims.filter((c) => !c.supported) ?? [];
  const ChannelIcon = m.channel === "email" ? Mail : Linkedin;
  const inputCls = "w-full rounded-[6px] border border-line px-2 py-1 text-[12px] focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

  return (
    <div className={`flex flex-col rounded-[8px] border bg-white p-3 text-[12px] ${m.status === "rejected" ? "opacity-60" : ""} ${bad.length || m.status === "needs_fix" ? "border-danger/40" : "border-line"}`}>
      <div className="mb-2 flex items-center gap-1.5">
        <Tip content={m.channel === "linkedin" ? "LinkedIn: drafted only. You send it by hand and mark it sent." : "Email: sent to the demo inbox after you approve"}>
          <span className={`grid h-6 w-6 place-items-center rounded-[6px] ${m.channel === "email" ? "bg-ink/5 text-ink" : "bg-rep/10 text-rep"}`}><ChannelIcon size={13} /></span>
        </Tip>
        <span className="font-medium">Touch {m.step}</span>
        <span className="inline-flex items-center gap-0.5 text-muted"><Clock size={11} />day {m.dayOffset}</span>
        {m.editedByRep && <Tip content="Edited by rep"><UserPen size={13} className="text-rep" /></Tip>}
        <span className="ml-auto"><Badge tone={STATUS[m.status].tone}>{STATUS[m.status].label}</Badge></span>
      </div>

      {editing ? (
        <div className="space-y-1.5">
          {m.channel === "email" && <input className={inputCls} aria-label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />}
          <textarea className={`${inputCls} min-h-[180px]`} aria-label="Message body" value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
      ) : (
        <div className="flex-1">
          {m.subject && <div className="font-medium">{m.subject}</div>}
          <p className={`mt-1 whitespace-pre-line text-ink/80 ${expanded ? "" : "line-clamp-4"}`}>{m.body}</p>
          {m.body.length > 180 && <button onClick={() => setExpanded(!expanded)} className="mt-0.5 inline-flex items-center gap-0.5 text-[11px] text-muted hover:text-ink">{expanded ? <><ChevronUp size={12} />less</> : <><ChevronDown size={12} />more</>}</button>}
        </div>
      )}

      {(sig.length > 0 || g) && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {sig.map((s) => <SignalChip key={s.id} s={s} />)}
          {g && g.claims.length > 0 && (
            <Tip content={g.claims.map((c) => `${c.supported ? "✓" : "✗"} ${c.sentence}${c.supported ? `\n   ${c.title ?? (c.url ? new URL(c.url).hostname : "product description")} · ${c.score.toFixed(2)}` : `\n   no evidence · best match ${c.score.toFixed(2)}`}`).join("\n")}>
              <span className={`inline-flex items-center gap-1 rounded-[5px] px-1.5 py-1 text-[11px] font-medium ${bad.length ? "bg-danger/10 text-danger" : "bg-tier-a/10 text-tier-a"}`}>
                {bad.length ? <ShieldAlert size={12} /> : <ShieldCheck size={12} />}
                {g.claims.length - bad.length}/{g.claims.length} claims · {g.ms.toFixed(1)} ms
              </span>
            </Tip>
          )}
        </div>
      )}
      {bad.length > 0 && (
        <ul className="mt-2 space-y-1">
          {bad.map((c) => <li key={c.sentence} className="flex gap-1.5 rounded-[6px] bg-danger/5 px-2 py-1 text-danger"><X size={13} className="mt-px shrink-0" /><span><span className="line-through decoration-danger/40">{c.sentence}</span> <span className="font-mono text-[10px]">best {c.score.toFixed(2)}</span></span></li>)}
        </ul>
      )}
      {m.review?.notes?.length ? <ul className="mt-2 space-y-0.5 text-danger">{m.review.notes.map((n) => <li key={n} className="flex gap-1"><ShieldAlert size={12} className="mt-px shrink-0" />{n}</li>)}</ul> : null}
      {m.sentAt && <div className="mt-2 inline-flex items-center gap-1 text-tier-a"><Send size={12} />Sent {new Date(m.sentAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} · {m.deliveredTo === "manual:linkedin" ? "by hand" : "demo inbox"}</div>}
      {error && <div role="alert" className="mt-2 rounded-[6px] bg-danger/5 px-2 py-1 text-danger">{error}</div>}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {open && !editing && <>
          <Tip content={m.status === "needs_fix" ? "Fix the flagged issues first" : m.channel === "email" ? "Sends to the demo inbox · 1 credit" : "Approve, then send it by hand"}>
            <Button icon={Check} onClick={() => review("approve")} disabled={busy || m.status === "needs_fix"}>Approve{m.channel === "email" ? " & send" : ""}</Button>
          </Tip>
          <IconButton icon={Pencil} label="Edit" onClick={() => setEditing(true)} disabled={busy} />
          <IconButton icon={X} label="Reject" tone="red" onClick={() => { const note = window.prompt("Reason for rejecting (sent back to @builder)") ?? undefined; void review("reject", note); }} disabled={busy} />
        </>}
        {editing && <>
          <Button icon={Check} onClick={() => review("approve")} disabled={busy}>Approve edited</Button>
          <Button variant="secondary" onClick={() => review("edit")} disabled={busy}>Save</Button>
          <Button variant="ghost" onClick={() => { setEditing(false); setBody(m.body); setSubject(m.subject ?? ""); }}>Cancel</Button>
        </>}
        {m.channel === "linkedin" && m.status === "approved" && <>
          <Button variant="secondary" icon={copied ? Check : Copy} onClick={copyAndOpen}>{copied ? "Copied · open profile" : "Copy and open profile"}</Button>
          <Button icon={Send} onClick={() => act(() => api(`/api/outreach/${m.id}/mark-sent`, { method: "POST" }))} disabled={busy}>Mark sent</Button>
        </>}
      </div>
    </div>
  );
}
