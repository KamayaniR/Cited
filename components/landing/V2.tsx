import { Check, X, ShieldAlert, Send, Link2, Sparkles, User, Database, Users, PenLine, Hand } from "lucide-react";
import { ClaimCard, MiniGraph } from "./ClaimCard";

/* ---------- Hero backdrop: a violet knowledge graph in a warm sky, over soft dithered hills ---------- */
const NODES: [number, number, boolean?][] = [
  [600, 330], [840, 220], [1100, 155], [870, 318], [1055, 245], [1230, 300, true], [715, 430, true], [815, 455, true],
  [900, 520], [650, 580], [720, 650], [605, 700], [900, 680], [1085, 690], [1180, 520], [990, 400],
];
const LINKS = [[0, 1], [1, 2], [1, 3], [2, 4], [3, 4], [4, 5], [0, 3], [3, 7], [6, 7], [7, 8], [6, 9], [9, 10], [9, 11], [8, 15], [15, 4], [15, 14], [14, 13], [8, 12], [12, 13], [5, 14], [0, 9]];

export function HeroBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_62%_18%,#FDE3CF_0%,transparent_55%),radial-gradient(ellipse_at_95%_60%,#D9C8F5_0%,transparent_55%),linear-gradient(180deg,#FBF4EA_0%,#F7EEF6_70%,#FBF7F0_100%)]" />
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" /></filter>
          <pattern id="dither" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="3" height="3" fill="#ffffff" opacity=".18" /></pattern>
          <linearGradient id="hill1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#B9A6E6" /><stop offset="1" stopColor="#E9E1F3" /></linearGradient>
          <linearGradient id="hill2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8FB49A" /><stop offset="1" stopColor="#DCE7D5" /></linearGradient>
          <linearGradient id="hill3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#A9C79F" /><stop offset="1" stopColor="#FBF7F0" /></linearGradient>
        </defs>
        <g className="c-drift">
          {LINKS.map(([a, b], i) => <line key={i} x1={NODES[a][0]} y1={NODES[a][1]} x2={NODES[b][0]} y2={NODES[b][1]} stroke="#7B5BE6" strokeOpacity=".55" strokeWidth="2.2" strokeDasharray="2 6" strokeLinecap="round" className="c-flow" />)}
          {NODES.map(([x, y, g], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r="16" fill={g ? "#7CC59A" : "#8B6CF0"} opacity=".45" filter="url(#glow)" />
              <circle cx={x} cy={y} r="8" fill="none" stroke={g ? "#5FB386" : "#8B6CF0"} strokeWidth="4" />
              <circle cx={x} cy={y} r="3" fill="#fff" />
            </g>
          ))}
        </g>
        <path d="M0 690 C 220 600 420 640 640 650 S 1100 560 1440 600 V 900 H 0 Z" fill="url(#hill1)" opacity=".75" />
        <path d="M0 690 C 220 600 420 640 640 650 S 1100 560 1440 600 V 900 H 0 Z" fill="url(#dither)" />
        <path d="M0 760 C 260 700 520 740 760 735 S 1180 680 1440 700 V 900 H 0 Z" fill="url(#hill2)" opacity=".8" />
        <path d="M0 760 C 260 700 520 740 760 735 S 1180 680 1440 700 V 900 H 0 Z" fill="url(#dither)" />
        <path d="M0 830 C 300 790 640 815 900 805 S 1260 780 1440 790 V 900 H 0 Z" fill="url(#hill3)" />
      </svg>
      <div className="absolute inset-y-0 left-0 w-[62%] bg-gradient-to-r from-[#FBF7F0]/90 via-[#FBF7F0]/60 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#FBF7F0]" />
    </div>
  );
}

const FEED = [
  { who: "Reviewer", text: "Stopped an unsourced “Series D” claim", tag: "AGENT TASK", tone: "red", icon: ShieldAlert, dx: -32 },
  { who: "Waiting on you", text: "Email to Jason Leet, CFO at Zylo", tag: "NEEDS YOUR OK", tone: "violet", icon: Send, dx: 0 },
  { who: "Builder", text: "Linked 3 sources for Zylo", tag: "AGENT TASK", tone: "green", icon: Link2, dx: -16 },
  { who: "Planner", text: "ICP v1 ready in 22 seconds", tag: "AGENT TASK", tone: "green", icon: Sparkles, dx: 16 },
];
const TONE: Record<string, string> = { red: "bg-danger/10 text-danger", violet: "bg-accent/10 text-accent", green: "bg-tier-a/10 text-tier-a" };

/** Glass notifications that pop in and out on a shared 9 s loop, 700 ms apart. */
export function HeroFeed() {
  return (
    <div className="relative flex flex-col items-end gap-3">
      {FEED.map((f, i) => (
        <div key={f.who} className="c-glass c-pop w-[340px] rounded-[16px] px-4 py-3 shadow-[0_20px_50px_-24px_rgba(60,30,120,0.35)]" style={{ transform: `translateX(${f.dx}px)`, marginRight: -f.dx, animationDelay: `${i * 0.7}s` }}>
          <div className="flex items-start gap-3">
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${TONE[f.tone]}`}><f.icon size={15} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><span className="text-[14px] font-semibold">{f.who}</span><span className={`ml-auto rounded-[4px] px-1.5 font-mono text-[9.5px] tracking-[0.1em] ${f.tone === "violet" ? "bg-accent text-white" : "text-muted"}`}>{f.tag}</span></div>
              <div className="text-[13px] text-ink/70">{f.text}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- The product, framed: what a judge sees in the first scroll ---------- */
const CHIPS = [
  { text: "Series C · crunchbase.com", ok: true, pos: "-left-10 top-24" },
  { text: "New CFO · linkedin.com", ok: true, pos: "-top-5 right-24" },
  { text: "NetSuite move · careers page", ok: true, pos: "-left-6 bottom-20" },
  { text: "Series D · no source", ok: false, pos: "-right-8 bottom-32" },
];
const TILES = [["100%", "leads cited"], ["<10 ms", "claim checks"], ["0", "sends without approval"], ["4", "agents, one gate"]];

export function AppWindow() {
  return (
    <div className="relative">
      <div className="overflow-hidden rounded-[20px] border border-line bg-[#FBF7F0] c-shadow">
        <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-[12px]">
          <span className="flex gap-1.5">{[0, 1, 2].map((i) => <span key={i} className="h-2.5 w-2.5 rounded-full bg-line" />)}</span>
          <span className="ml-3 grid h-5 w-5 place-items-center rounded-[5px] bg-accent text-[10px] font-bold text-white">C</span><span className="font-serif text-[14px]">Cited</span>
          <span className="flex items-center gap-1 rounded-full bg-tier-a/10 px-2 py-0.5 text-[10.5px] text-tier-a"><span className="relative h-1.5 w-1.5 rounded-full bg-tier-a"><span className="c-ring absolute inset-0 rounded-full bg-tier-a" /></span>10 live</span>
          <span className="ml-auto rounded-full bg-accent px-2.5 py-0.5 text-[11px] text-white">Run the loop</span>
        </div>
        <div className="grid grid-cols-[1fr_200px]">
          <div className="space-y-3 p-4">
            <div className="grid grid-cols-4 gap-3">
              {TILES.map(([v, l]) => <div key={l} className="rounded-[14px] border border-line bg-white p-3"><div className="font-serif text-[26px] leading-none">{v}</div><div className="mt-1.5 text-[11px] text-muted">{l}</div></div>)}
            </div>
            <div className="grid grid-cols-[0.8fr_1.2fr] gap-3">
              <div className="rounded-[14px] border border-line bg-white p-2"><MiniGraph className="h-full w-full" /></div>
              <ClaimCard className="!shadow-none" />
            </div>
          </div>
          <AgentRail />
        </div>
      </div>
      {CHIPS.map((c, i) => (
        <span key={c.text} className={`c-float absolute ${c.pos} hidden items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-[13px] shadow-lg md:flex ${c.ok ? "border-line" : "border-danger/40"}`} style={{ animationDelay: `${i * 0.7}s` }}>
          <span className={`grid h-5 w-5 place-items-center rounded-full text-white ${c.ok ? "bg-tier-a" : "bg-danger"}`}>{c.ok ? <Check size={11} strokeWidth={3} /> : <X size={11} strokeWidth={3} />}</span>{c.text}
        </span>
      ))}
    </div>
  );
}

const RAIL_FEED = ["ICP drafted · 22s", "10 companies cited", "0 uncited dropped", "47 sources indexed", "11 signals matched", "Draft checked · 9 ms"];
export function AgentRail() {
  return (
    <div className="border-l border-line p-3">
      <div className="flex justify-between">
        {["P", "B", "R", "S"].map((a, i) => <span key={a} className="flex flex-col items-center gap-1 text-[9.5px] text-muted"><span className="c-agent grid h-8 w-8 place-items-center rounded-full border border-accent/20 bg-accent/10 font-serif text-[13px] text-accent" style={{ animationDelay: `${i * 2}s` }}>{a}</span>{["Planner", "Builder", "Reviewer", "Security"][i]}</span>)}
      </div>
      <div className="relative mt-3 h-[200px] overflow-hidden [mask-image:linear-gradient(transparent,black_15%,black_85%,transparent)]">
        <ul className="c-ticker space-y-2">
          {[...RAIL_FEED, ...RAIL_FEED].map((t, i) => <li key={i} className="flex items-center gap-2 rounded-[10px] border border-line bg-white px-2.5 py-1.5 text-[11px]"><span className={`h-1.5 w-1.5 rounded-full ${i % 3 === 1 ? "bg-tier-b" : i % 3 === 2 ? "bg-tier-a" : "bg-accent"}`} />{t}</li>)}
        </ul>
      </div>
    </div>
  );
}

/* ---------- The old way leaks proof ---------- */
const TOOLS = [{ icon: Database, label: "Lead list" }, { icon: Users, label: "Enrichment" }, { icon: Send, label: "Sequencer" }, { icon: PenLine, label: "AI writer" }];
export function OldWay() {
  const ys = [40, 112, 184, 256];
  return (
    <div className="grid items-center gap-6 md:grid-cols-[280px_1fr_300px]">
      <div className="space-y-4">
        {TOOLS.map((t, i) => (
          <div key={t.label} className="flex items-center gap-3 rounded-[14px] border border-line bg-white/80 px-3 py-3" style={{ marginLeft: [0, 16, -6, 24][i] }}>
            <span className="grid h-8 w-8 place-items-center rounded-[8px] bg-[#F3ECE0]"><t.icon size={15} className="text-ink/70" /></span>
            <span className="text-[14px]">{t.label}</span>
            <span className="c-live ml-auto h-2 w-2 rounded-full bg-tier-b" style={{ animationDelay: `${i * 0.3}s` }} />
          </div>
        ))}
      </div>
      <svg viewBox="0 0 420 300" className="hidden w-full md:block" aria-hidden>
        {ys.map((y, i) => <path key={i} d={`M0 ${y} C 140 ${y + [90, -60, 70, -120][i]} 220 ${150 + [-70, 60, -40, 50][i]} 420 150`} fill="none" stroke="#6A35E0" strokeOpacity=".45" strokeWidth="1.6" strokeDasharray="6 6" className="c-flow" />)}
        {[[180, 92], [235, 128], [150, 190], [270, 205]].map(([x, y], i) => (
          <g key={i} className="c-pop" style={{ animationDelay: `${i * 0.9}s`, transformOrigin: `${x}px ${y}px` }}>
            <circle cx={x} cy={y} r="11" fill="#fff" stroke="#D93A3A" strokeOpacity=".5" />
            <path d={`M${x - 4} ${y - 4} L${x + 4} ${y + 4} M${x + 4} ${y - 4} L${x - 4} ${y + 4}`} stroke="#D93A3A" strokeWidth="1.8" strokeLinecap="round" />
          </g>
        ))}
      </svg>
      <div className="rounded-[20px] border border-accent/20 bg-white p-7 text-center c-shadow">
        <div className="relative mx-auto grid h-16 w-16 place-items-center">
          <span className="c-ring absolute inset-0 rounded-[16px] bg-accent/30" />
          <span className="absolute -inset-3 animate-[spin_24s_linear_infinite] rounded-full border border-dashed border-accent/30 motion-reduce:animate-none" />
          <span className="relative grid h-16 w-16 place-items-center rounded-[16px] bg-accent font-serif text-[28px] text-white">C</span>
        </div>
        <p className="mt-5 font-serif text-[22px] leading-snug">One engine.<br />Every line linked.</p>
        <div className="mt-3 flex justify-center gap-1.5">{[0, 1, 2, 3].map((i) => <span key={i} className="c-pop inline-flex items-center gap-0.5 rounded-full bg-tier-a/10 px-2 py-0.5 text-tier-a" style={{ animationDelay: `${i * 0.4}s` }}><Link2 size={10} /><Check size={10} /></span>)}</div>
      </div>
    </div>
  );
}

/* ---------- Find → Prove → Send boards ---------- */
type Kind = "agent" | "user" | "blocked" | "approval";
interface Task { text: string; kind: Kind }
const KIND: Record<Kind, { tag: string; icon: typeof Check; tile: string; card: string }> = {
  agent: { tag: "AGENT", icon: Check, tile: "bg-tier-a/10 text-tier-a", card: "border-line" },
  user: { tag: "YOU", icon: User, tile: "bg-[#F3ECE0] text-ink/60", card: "border-line" },
  blocked: { tag: "BLOCKED", icon: X, tile: "bg-danger/10 text-danger", card: "border-danger/30" },
  approval: { tag: "NEEDS YOUR OK", icon: Hand, tile: "bg-accent/10 text-accent", card: "border-accent shadow-[0_0_0_4px_rgba(106,53,224,0.15)] c-agent" },
};

export function Board({ stage, tasks }: { stage: string; tasks: Task[] }) {
  return (
    <div className="relative overflow-hidden rounded-[24px] border border-line bg-[radial-gradient(ellipse_at_20%_0%,rgba(106,53,224,0.12),transparent_60%),radial-gradient(ellipse_at_100%_100%,rgba(31,138,91,0.10),transparent_55%)] p-5">
      <div aria-hidden className="absolute inset-0 [background-image:radial-gradient(rgba(106,53,224,0.18)_1px,transparent_1px)] [background-size:6px_6px] [mask-image:linear-gradient(black,transparent_70%)]" />
      <div className="relative mb-3 flex items-center gap-2 font-mono text-[11px] tracking-[0.1em] text-muted"><span className="c-live h-2 w-2 rounded-full bg-tier-a" />{stage}</div>
      <div className="relative space-y-3">
        {tasks.map((t, i) => {
          const k = KIND[t.kind];
          return (
            <div key={t.text} className={`c-rise flex items-center gap-3 rounded-[14px] border bg-white px-4 py-3 ${k.card}`} style={{ marginLeft: [0, 24, 12, 36][i], animationDelay: `${i * 120}ms` }}>
              <span className={`grid h-7 w-7 place-items-center rounded-[8px] ${k.tile}`}><k.icon size={14} /></span>
              <span className={`relative text-[14px] ${t.kind === "blocked" ? "text-danger line-through decoration-danger/70" : ""}`}>{t.text}</span>
              <span className={`ml-auto rounded-[4px] px-1.5 font-mono text-[9.5px] tracking-[0.1em] ${t.kind === "approval" ? "bg-accent text-white" : t.kind === "blocked" ? "bg-danger/10 text-danger" : "text-muted"}`}>{k.tag}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const CHAPTERS: { n: string; label: string; title: string; body: string; stage: string; tasks: Task[] }[] = [
  { n: "1.0", label: "FIND", title: "Spot the companies that need you now.", body: "Describe your product in two lines. Agents draft your ICP and surface real companies, each with a cited reason to reach out.", stage: "SIGNAL",
    tasks: [{ text: "Describe the product", kind: "user" }, { text: "Draft the ICP", kind: "agent" }, { text: "Discover companies", kind: "agent" }, { text: "Find the buyer", kind: "agent" }] },
  { n: "2.0", label: "PROVE", title: "Every sentence earns its place.", body: "Drafts are checked line by line against stored evidence. A claim without a source is struck out before you ever see it.", stage: "EVIDENCE",
    tasks: [{ text: "Write the outreach", kind: "agent" }, { text: "Check 4 claims", kind: "agent" }, { text: "“Series D”: no source", kind: "blocked" }, { text: "Attach every source", kind: "agent" }] },
  { n: "3.0", label: "SEND", title: "Nothing leaves without your yes.", body: "You approve, Cited sends, and the pipeline moves on its own as replies come in.", stage: "PIPELINE",
    tasks: [{ text: "Read the draft", kind: "user" }, { text: "Approve the send", kind: "approval" }, { text: "Track the reply", kind: "agent" }, { text: "Book the meeting", kind: "user" }] },
];

