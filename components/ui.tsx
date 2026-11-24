import type { ReactNode, ComponentType } from "react";
import type { Tier, Actor } from "@/lib/types";
import { Tip, InfoTip } from "./Tip";
import { Bot, User } from "lucide-react";

export type Tone = "neutral" | "green" | "amber" | "red" | "blue" | "violet" | "accent";
export const TONES: Record<Tone, string> = {
  neutral: "bg-line/60 text-ink",
  green: "bg-tier-a/10 text-tier-a",
  amber: "bg-tier-b/10 text-tier-b",
  red: "bg-danger/10 text-danger",
  blue: "bg-rep/10 text-rep",
  violet: "bg-agent/10 text-agent",
  accent: "bg-accent/10 text-accent",
};
const DOT: Record<Tone, string> = { neutral: "bg-tier-c", green: "bg-tier-a", amber: "bg-tier-b", red: "bg-danger", blue: "bg-rep", violet: "bg-agent", accent: "bg-accent" };
export type Icon = ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;

export function Badge({ tone = "neutral", children, title, icon: I }: { tone?: Tone; children?: ReactNode; title?: ReactNode; icon?: Icon }) {
  const el = <span className={`inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${TONES[tone]}`}>{I && <I size={11} strokeWidth={2.25} />}{children}</span>;
  return title ? <Tip content={title}>{el}</Tip> : el;
}

export function Dot({ tone = "neutral", title, pulse }: { tone?: Tone; title?: ReactNode; pulse?: boolean }) {
  const el = <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${DOT[tone]} ${pulse ? "animate-pulse" : ""}`} />;
  return title ? <Tip content={title}>{el}</Tip> : el;
}

export const tierTone = (t: Tier): Tone => (t === "A" ? "green" : t === "B" ? "amber" : "neutral");
const TIER_STROKE: Record<Tier, string> = { A: "#059669", B: "#D97706", C: "#9CA3AF" };

/** Score as a ring with the tier letter: one glance instead of "A · 84 · 97 / 65". */
export function ScoreRing({ tier, score, fit, intent, size = 34, muted }: { tier: Tier; score: number; fit?: number; intent?: number; size?: number; muted?: boolean }) {
  const r = size / 2 - 3, c = 2 * Math.PI * r;
  const tip = `Tier ${tier} · score ${score}${fit !== undefined ? `\nFit ${fit} · Intent ${intent}` : ""}\nscore = 0.6 × fit + 0.4 × intent`;
  return (
    <Tip content={tip}>
      <span className={`relative inline-grid shrink-0 place-items-center ${muted ? "opacity-40" : ""}`} style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5E5E5" strokeWidth={3} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TIER_STROKE[tier]} strokeWidth={3} strokeLinecap="round" strokeDasharray={`${(c * Math.min(score, 100)) / 100} ${c}`} />
        </svg>
        <span className="absolute text-[11px] leading-none font-semibold" style={{ color: TIER_STROKE[tier] }}>{tier}<span className="ml-px text-[9px] font-medium text-muted">{score}</span></span>
      </span>
    </Tip>
  );
}

export function TierBadge({ tier, score }: { tier: Tier; score: number }) {
  return <Badge tone={tierTone(tier)} title={`Tier ${tier}, score ${score}`}>{tier} · {score}</Badge>;
}

export function ActorTag({ actor }: { actor: Actor }) {
  return <Badge tone={actor === "agent" ? "violet" : "blue"} icon={actor === "agent" ? Bot : User} title={actor === "agent" ? "Done by an agent" : "Done by a rep"}>{actor}</Badge>;
}

const AVATAR_TONES = ["bg-accent/15 text-accent", "bg-agent/15 text-agent", "bg-rep/15 text-rep", "bg-tier-b/15 text-tier-b", "bg-tier-a/15 text-tier-a"];
export function Avatar({ name, size = 26, title }: { name: string; size?: number; title?: ReactNode }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  const tone = AVATAR_TONES[[...name].reduce((s, ch) => s + ch.charCodeAt(0), 0) % AVATAR_TONES.length];
  const el = <span className={`inline-grid shrink-0 place-items-center rounded-full text-[10px] font-semibold ${tone}`} style={{ width: size, height: size }}>{initials}</span>;
  return title ? <Tip content={title}>{el}</Tip> : el;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[10px] border border-line bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04)] ${className}`}>{children}</div>;
}

/** Page header: icon, short title, an (i) for the explanation, actions on the right. */
export function PageTitle({ icon: I, title, tip, children, kicker }: { icon?: Icon; title: string; tip?: ReactNode; children?: ReactNode; kicker?: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        {I && <span className="grid h-8 w-8 place-items-center rounded-[8px] bg-accent/10 text-accent"><I size={17} /></span>}
        <h1 className="font-serif text-[24px] leading-tight" aria-label={kicker ? `${kicker}: ${title}` : undefined}>{title}</h1>
        {tip && <InfoTip content={tip} />}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function SectionTitle({ icon: I, children, tip, right }: { icon?: Icon; children: ReactNode; tip?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted uppercase">
      {I && <I size={13} />}<span>{children}</span>{tip && <InfoTip content={tip} />}
      {right && <span className="ml-auto normal-case tracking-normal">{right}</span>}
    </div>
  );
}

export function Button({ variant = "primary", className = "", icon: I, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; icon?: Icon }) {
  const v = {
    primary: "bg-ink text-white hover:bg-ink/85",
    secondary: "border border-line bg-white hover:bg-paper",
    ghost: "hover:bg-line/50",
    danger: "bg-danger text-white hover:bg-danger/85",
  }[variant];
  return <button {...props} className={`inline-flex items-center justify-center gap-1.5 rounded-[6px] px-3 py-1.5 text-[13px] font-medium whitespace-nowrap transition disabled:opacity-50 ${v} ${className}`}>{I && <I size={14} />}{children}</button>;
}

/** Icon-only button with an accessible name and a tooltip. */
export function IconButton({ icon: I, label, tone = "neutral", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: Icon; label: string; tone?: "neutral" | "green" | "red" | "dark" }) {
  const t = { neutral: "border border-line bg-white text-ink hover:bg-paper", green: "bg-tier-a text-white hover:bg-tier-a/85", red: "border border-line bg-white text-danger hover:bg-danger/5", dark: "bg-ink text-white hover:bg-ink/85" }[tone];
  return (
    <Tip content={label}>
      <button {...props} aria-label={label} className={`grid h-7 w-7 place-items-center rounded-[6px] transition disabled:opacity-40 ${t} ${className}`}><I size={14} /></button>
    </Tip>
  );
}

/** Stat tile: icon, big number, short label; detail goes in the tooltip. */
export function Stat({ icon: I, label, value, tone = "accent", tip, sub }: { icon: Icon; label: string; value: ReactNode; tone?: Tone; tip?: ReactNode; sub?: ReactNode }) {
  const body = (
    <Card className="flex items-center gap-3 p-3.5">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[8px] ${TONES[tone]}`}><I size={18} /></span>
      <div className="min-w-0">
        <div className="text-[22px] leading-none font-semibold tabular-nums">{value}</div>
        <div className="mt-1 truncate text-[12px] text-muted">{label}{sub && <span className="ml-1">{sub}</span>}</div>
      </div>
    </Card>
  );
  return tip ? <Tip content={tip} className="block">{body}</Tip> : body;
}

export function ConfidenceBar({ value, width = 64 }: { value: number; width?: number }) {
  const color = value >= 0.75 ? "bg-tier-a" : value >= 0.55 ? "bg-tier-b" : "bg-danger";
  return (
    <Tip content={`Confidence ${value.toFixed(2)}`}>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 rounded-full bg-line" style={{ width }}><span className={`block h-1.5 rounded-full ${color}`} style={{ width: `${Math.round(value * 100)}%` }} /></span>
        <span className="font-mono text-[10px] text-muted">{Math.round(value * 100)}</span>
      </span>
    </Tip>
  );
}

/** Horizontal bar with a label and a value, for charts made of divs. */
export function BarRow({ label, value, max, tone = "accent", right, tip }: { label: ReactNode; value: number; max: number; tone?: Tone; right?: ReactNode; tip?: ReactNode }) {
  const pct = max > 0 ? Math.max(2, Math.round((100 * value) / max)) : 0;
  const row = (
    <div className="grid grid-cols-[minmax(90px,140px)_1fr_auto] items-center gap-2.5 text-[12px]">
      <span className="truncate">{label}</span>
      <span className="h-2.5 rounded-full bg-line/60"><span className={`block h-2.5 rounded-full ${DOT[tone]}`} style={{ width: `${value ? pct : 0}%` }} /></span>
      <span className="min-w-[36px] text-right font-mono text-[11px] text-muted">{right ?? value}</span>
    </div>
  );
  return tip ? <Tip content={tip} className="block">{row}</Tip> : row;
}

/** Donut chart from segments. */
export function Donut({ segments, size = 88, label }: { segments: { value: number; color: string; name: string }[]; size?: number; label?: ReactNode }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = size / 2 - 8, c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <Tip content={segments.map((s) => `${s.name}: ${s.value}`).join("\n")}>
      <span className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F0F0F0" strokeWidth={10} />
          {segments.map((s) => {
            const len = (c * s.value) / total;
            const el = <circle key={s.name} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={10} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} />;
            offset += len;
            return el;
          })}
        </svg>
        {label && <span className="absolute text-center text-[12px] leading-tight">{label}</span>}
      </span>
    </Tip>
  );
}

export const SOURCE_LABEL: Record<string, string> = { hunter: "Hunter", apollo: "Apollo", tavily: "Tavily", website: "Website", mock: "Mock" };
export function SourceBadge({ source, title }: { source: string | null; title?: string }) {
  if (!source) return null;
  const tone = source === "hunter" ? "green" : source === "apollo" ? "violet" : "neutral";
  return <Badge tone={tone} title={title ?? `Source: ${SOURCE_LABEL[source] ?? source}`}>{SOURCE_LABEL[source] ?? source}</Badge>;
}

/** Tabs as a segmented control. */
export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; icon?: Icon; count?: number }[] }) {
  return (
    <div className="inline-flex rounded-[8px] border border-line bg-white p-0.5">
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} className={`inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-[12px] font-medium transition ${value === o.value ? "bg-ink text-white" : "text-muted hover:text-ink"}`}>
          {o.icon && <o.icon size={13} />}{o.label}{o.count !== undefined && <span className={`rounded-full px-1.5 text-[10px] ${value === o.value ? "bg-white/20" : "bg-line/70"}`}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** A short status line that disappears into a chip. */
export function Toast({ children, tone = "accent" }: { children: ReactNode; tone?: Tone }) {
  return <div role="status" className={`mb-3 inline-flex max-w-full items-center gap-2 rounded-[6px] px-3 py-1.5 text-[12px] ${TONES[tone]}`}>{children}</div>;
}
