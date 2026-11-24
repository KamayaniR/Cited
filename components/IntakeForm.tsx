"use client";
import { useState } from "react";
import { Button, Card, Segmented } from "./ui";
import { MessageCircle, FileText, Sparkles, Bot, Check, Loader2, SendHorizontal, Target } from "lucide-react";
import { api } from "./api";
import { DEMO_PRODUCT } from "@/lib/seed/fixtures";

type Form = { name: string; description: string; customers: string; pricing: string; constraints: string; teamBackground: string; regions: string; excludeRegions: string };
const EMPTY: Form = { name: "", description: "", customers: "", pricing: "", constraints: "", teamBackground: "", regions: "", excludeRegions: "" };

const QUESTIONS: { key: keyof Form; q: string }[] = [
  { key: "name", q: "What's the product called?" },
  { key: "description", q: "What does it do, and for whom? A few sentences is plenty." },
  { key: "customers", q: "Who buys it today, or who do you want to buy it?" },
  { key: "pricing", q: "Roughly how is it priced?" },
  { key: "regions", q: "Which regions do you sell in? (comma separated)" },
  { key: "excludeRegions", q: "Any regions to avoid? (comma separated, or 'none')" },
  { key: "teamBackground", q: "Where has your team worked or studied? This helps find warm paths." },
  { key: "constraints", q: "Any constraints, like compliance or deal size? (or 'none')" },
];

const FIELDS: { key: keyof Form; label: string; area?: boolean }[] = [
  { key: "name", label: "Product name" },
  { key: "description", label: "What it does", area: true },
  { key: "customers", label: "Customers" },
  { key: "pricing", label: "Pricing" },
  { key: "regions", label: "Regions (comma separated)" },
  { key: "excludeRegions", label: "Exclude regions" },
  { key: "teamBackground", label: "Team background", area: true },
  { key: "constraints", label: "Constraints" },
];

const inputCls = "w-full rounded-[6px] border border-line bg-white px-2.5 py-1.5 text-[13px] focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

export function IntakeForm({ onDone }: { onDone: () => Promise<void> }) {
  const [mode, setMode] = useState<"chat" | "form">("chat");
  const [form, setForm] = useState<Form>(EMPTY);
  const [step, setStep] = useState(0);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const split = (s: string) => s.split(",").map((x) => x.trim()).filter((x) => x && x.toLowerCase() !== "none");

  async function submit(f = form) {
    setBusy(true); setError(null);
    try {
      await api("/api/intake", { method: "POST", body: {
        ...f, constraints: f.constraints.toLowerCase() === "none" ? "" : f.constraints,
        regions: split(f.regions), excludeRegions: split(f.excludeRegions),
      } });
      await onDone();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  function answer() {
    if (!reply.trim()) return;
    const next = { ...form, [QUESTIONS[step].key]: reply.trim() };
    setForm(next); setReply("");
    if (step + 1 < QUESTIONS.length) setStep(step + 1);
    else { setStep(QUESTIONS.length); void submit(next); }
  }

  function useExample() {
    setForm({ ...DEMO_PRODUCT, regions: DEMO_PRODUCT.regions.join(", "), excludeRegions: DEMO_PRODUCT.excludeRegions.join(", ") });
    setMode("form");
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <Segmented value={mode} onChange={setMode} options={[{ value: "chat", label: "Chat", icon: MessageCircle }, { value: "form", label: "Form", icon: FileText }]} />
        <Button variant="ghost" icon={Sparkles} onClick={useExample} className="ml-auto text-accent">Use example</Button>
      </div>

      {mode === "chat" ? (
        <div>
          <div className="max-h-[420px] space-y-2 overflow-y-auto text-[13px]">
            {QUESTIONS.slice(0, Math.min(step + 1, QUESTIONS.length)).map((q, i) => (
              <div key={q.key} className="space-y-2">
                <div className="flex items-start gap-2"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/10 text-accent"><Bot size={13} /></span><div className="max-w-[85%] rounded-[10px] rounded-tl-[2px] bg-paper px-3 py-2">{q.q}</div></div>
                {i < step && <div className="ml-auto w-fit max-w-[85%] rounded-[10px] rounded-tr-[2px] bg-ink px-3 py-2 text-white">{form[q.key]}</div>}
              </div>
            ))}
          </div>
          {step < QUESTIONS.length ? (
            <div className="mt-3 flex gap-2">
              <input className={inputCls} value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === "Enter" && answer()} placeholder="Type your answer and press Enter" autoFocus />
              <Button onClick={answer} disabled={busy} icon={SendHorizontal}>Send</Button>
            </div>
          ) : (
            <div className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-muted">{busy ? <><Loader2 size={14} className="animate-spin" />Inferring your ICP…</> : error ? "" : <><Check size={14} className="text-tier-a" />Done</>}</div>
          )}
        </div>
      ) : (
        <form className="space-y-2.5" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          {FIELDS.map((f) => (
            <label key={f.key} className="block text-[12px] text-muted">{f.label}
              {f.area
                ? <textarea className={`${inputCls} mt-1 min-h-[72px] text-ink`} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                : <input className={`${inputCls} mt-1 text-ink`} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />}
            </label>
          ))}
          <Button type="submit" icon={busy ? Loader2 : Target} disabled={busy || !form.name || form.description.length < 10}>{busy ? "Inferring ICP…" : "Infer ICP"}</Button>
        </form>
      )}
      {error && <div className="mt-3 rounded-[6px] bg-danger/10 px-3 py-2 text-[12px] text-danger">{error}</div>}
    </Card>
  );
}
