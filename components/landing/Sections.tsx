"use client";
import { Check, Loader2, Compass, Hammer, Eye, Shield, User, MessageSquareText, Target, Search, Mail, KanbanSquare } from "lucide-react";
import { useScrollProgress, useReducedMotion } from "./motion";

const clamp = (x: number) => Math.min(1, Math.max(0, x));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Messy inputs drift in as tangled curves, pass through Cited, and leave as one clean cited line. Follows the scroll. */
export function Untangle() {
  const [ref, p] = useScrollProgress<HTMLDivElement>();
  const reduced = useReducedMotion();
  const k = reduced ? 1 : clamp((p - 0.2) / 0.35);
  const inputs = [
    { label: "web pages", y: 34, wob: [70, -60] },
    { label: "job posts", y: 86, wob: [-50, 80] },
    { label: "news", y: 138, wob: [60, -90] },
    { label: "LinkedIn", y: 190, wob: [-80, 40] },
  ];
  const cx = 500, cy = 112;
  return (
    <div ref={ref} className="relative mx-auto w-full max-w-[1000px]">
      <svg viewBox="0 0 1000 224" className="w-full" role="img" aria-label="Messy inputs become one cited line">
        {inputs.map((s, i) => {
          const c1x = lerp(220 + s.wob[0], 260, k), c1y = lerp(s.y + s.wob[1], s.y, k);
          const c2x = lerp(330 - s.wob[1], 400, k), c2y = lerp(cy - s.wob[0], cy, k);
          return (
            <g key={s.label}>
              <path d={`M110 ${s.y} C${c1x} ${c1y} ${c2x} ${c2y} ${cx - 22} ${cy}`} fill="none" stroke={["#9B6BC4", "#E8963A", "#4F8FC0", "#D9708A"][i]} strokeOpacity={lerp(0.45, 0.8, k)} strokeWidth={1.6} />
              <text x="100" y={s.y + 4} textAnchor="end" className="fill-[#2A211B]/60 font-mono text-[12px]">{s.label}</text>
            </g>
          );
        })}
        <circle cx={cx} cy={cy} r={22} fill="#7C3AED" />
        <text x={cx} y={cy + 5} textAnchor="middle" className="fill-white text-[14px] font-bold">C</text>
        <path d={`M${cx + 22} ${cy} H${lerp(cx + 22, 960, k)}`} stroke="#2F7A4A" strokeWidth={2.5} strokeLinecap="round" />
      </svg>
      <div className={`absolute top-[34%] right-0 flex items-center gap-1.5 rounded-full border border-[#2F7A4A]/25 bg-white px-3 py-1.5 font-mono text-[12px] text-[#2F7A4A] shadow-sm transition-all duration-500 ${k > 0.85 ? "opacity-100" : "translate-x-3 opacity-0"}`}>
        Company · hiring 3 finance engineers · cited <Check size={13} />
      </div>
    </div>
  );
}

const STEPS = [
  { icon: MessageSquareText, title: "Describe", body: "Tell Cited what you sell, in a short chat.", agent: "planner" },
  { icon: Target, title: "Target", body: "It infers your ICP, with a confidence score on every field. You approve it.", agent: "planner → you" },
  { icon: Search, title: "Discover", body: "Companies, buying signals and buyers, each tied to the page it came from.", agent: "builder" },
  { icon: Mail, title: "Draft and check", body: "A three-touch sequence. Every sentence is checked against the evidence.", agent: "reviewer" },
  { icon: KanbanSquare, title: "Approve and track", body: "You approve, Cited sends, and the pipeline updates itself.", agent: "you" },
];

/** Pinned while you scroll: steps 01–05 on the left, a run canvas on the right that ticks along. */
export function HowItWorks() {
  const [ref, p] = useScrollProgress<HTMLDivElement>();
  const reduced = useReducedMotion();
  const k = reduced ? 1 : clamp((p - 0.18) / 0.55);
  const active = Math.min(STEPS.length, Math.floor(k * (STEPS.length + 0.999)));
  return (
    <div ref={ref} className="relative h-[230vh] motion-reduce:h-auto">
      <div className="sticky top-0 flex min-h-screen items-center motion-reduce:static">
        <div className="mx-auto grid w-full max-w-[1180px] gap-10 px-5 py-16 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <div className="text-[12px] font-semibold tracking-wider text-accent uppercase">How it works</div>
            <h2 className="mt-2 text-[40px] leading-[1.05] font-semibold tracking-[-0.03em]">From a product description to a <em className="font-serif font-normal text-accent">booked</em> meeting.</h2>
            <ol className="relative mt-8 space-y-5 pl-8">
              <span className="absolute top-2 bottom-2 left-[11px] w-px bg-[#2A211B]/10" />
              <span className="absolute top-2 left-[11px] w-px bg-accent transition-all duration-300" style={{ height: `calc(${(Math.min(active, STEPS.length - 1) / (STEPS.length - 1)) * 100}% - 16px)` }} />
              {STEPS.map((s, i) => (
                <li key={s.title} className={`relative transition-opacity duration-300 ${i <= active ? "opacity-100" : "opacity-40"}`}>
                  <span className={`absolute -left-8 grid h-6 w-6 place-items-center rounded-full font-mono text-[10px] transition-colors ${i < active ? "bg-accent text-white" : i === active ? "bg-white text-accent ring-2 ring-accent" : "bg-white text-[#2A211B]/50 ring-1 ring-[#2A211B]/15"}`}>{i < active ? <Check size={12} /> : `0${i + 1}`}</span>
                  <div className="text-[16px] font-semibold">{s.title}</div>
                  <p className="mt-0.5 text-[14px] leading-relaxed text-[#2A211B]/60">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
          <div className="relative rounded-[18px] border border-[#78502824] bg-white/70 p-6 shadow-[0_20px_60px_rgba(150,90,40,0.10)] [background-image:radial-gradient(rgba(120,80,40,0.14)_1px,transparent_1px)] [background-size:16px_16px]">
            <div className="space-y-4">
              {STEPS.map((s, i) => {
                const st = i < active ? "done" : i === active ? "running" : "waiting";
                return (
                  <div key={s.title} className={`relative flex items-center gap-3 rounded-[12px] border-[1.5px] bg-white px-4 py-3 transition-all duration-500 ${i % 2 ? "ml-[14%]" : "mr-[14%]"} ${st === "done" ? "border-[#4A7FD1]" : st === "running" ? "border-accent shadow-[0_0_0_5px_rgba(124,58,237,0.12)]" : "border-[#78502824] opacity-70"}`}>
                    <span className="absolute -top-2.5 left-3 rounded-[5px] bg-[#2A211B] px-1.5 text-[10px] leading-4 text-[#FAF6EF]">{s.agent}</span>
                    {st !== "waiting" && <span className={`absolute -top-2.5 right-3 flex items-center gap-1 rounded-[5px] border px-1.5 text-[10.5px] leading-4 font-medium ${st === "done" ? "border-[#2F7A4A]/30 bg-[#E3F1E6] text-[#2F7A4A]" : "border-accent/30 bg-accent/10 text-accent"}`}>{st === "done" ? <Check size={10} /> : <Loader2 size={10} className="animate-spin" />}{st === "done" ? "Completed" : "Running"}</span>}
                    <span className="grid h-8 w-8 place-items-center rounded-[8px] bg-[#F3EEE8]"><s.icon size={16} /></span>
                    <span className="text-[15px] font-semibold">{s.title}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const ROLES = [
  { icon: Compass, label: "Planner" }, { icon: Hammer, label: "Builder" }, { icon: Eye, label: "Reviewer" }, { icon: Shield, label: "Security" }, { icon: User, label: "You" },
];

/** Four agents pass the work along; only you hold the button that sends. */
export function AgentsStrip() {
  return (
    <div className="relative mx-auto flex max-w-[860px] items-center justify-between">
      <span className="absolute top-1/2 right-6 left-6 h-px -translate-y-1/2 bg-[#2A211B]/12" />
      <span className="landing-token absolute top-1/2 left-6 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_14px_rgba(124,58,237,0.7)]" />
      {ROLES.map((r, i) => (
        <span key={r.label} className={`relative z-10 flex flex-col items-center gap-1.5 text-[12px] font-medium ${i === ROLES.length - 1 ? "text-accent" : "text-[#2A211B]/70"}`}>
          <span className={`grid h-12 w-12 place-items-center rounded-full border bg-white ${i === ROLES.length - 1 ? "border-accent shadow-[0_0_0_6px_rgba(124,58,237,0.12)]" : "border-[#78502826]"}`}><r.icon size={19} /></span>
          {r.label}
        </span>
      ))}
    </div>
  );
}
