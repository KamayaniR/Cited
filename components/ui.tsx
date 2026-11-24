import type { ReactNode } from "react";
import type { Tier, Actor } from "@/lib/types";

type Tone = "neutral" | "green" | "amber" | "red" | "blue" | "violet";
const TONES: Record<Tone, string> = {
  neutral: "bg-line/60 text-ink",
  green: "bg-tier-a/10 text-tier-a",
  amber: "bg-tier-b/10 text-tier-b",
  red: "bg-danger/10 text-danger",
  blue: "bg-rep/10 text-rep",
  violet: "bg-agent/10 text-agent",
};

export function Badge({ tone = "neutral", children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return <span title={title} className={`inline-flex items-center rounded-[4px] px-1.5 py-0.5 text-[11px] font-medium ${TONES[tone]}`}>{children}</span>;
}

export function TierBadge({ tier, score }: { tier: Tier; score: number }) {
  const tone = tier === "A" ? "green" : tier === "B" ? "amber" : "neutral";
  return <Badge tone={tone}>{tier} · {score}</Badge>;
}

export function ActorTag({ actor }: { actor: Actor }) {
  return <Badge tone={actor === "agent" ? "violet" : "blue"}>{actor}</Badge>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[8px] border border-line bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04)] ${className}`}>{children}</div>;
}

export function PageTitle({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-accent">{kicker}</div>
        <h1 className="font-serif text-[28px] leading-tight">{title}</h1>
      </div>
      {children}
    </div>
  );
}

export function Button({ variant = "primary", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const v = {
    primary: "bg-ink text-white hover:bg-ink/85",
    secondary: "border border-line bg-white hover:bg-paper",
    ghost: "hover:bg-line/50",
    danger: "bg-danger text-white hover:bg-danger/85",
  }[variant];
  return <button {...props} className={`rounded-[6px] px-3 py-1.5 text-[13px] font-medium transition disabled:opacity-50 ${v} ${className}`} />;
}

export function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 0.75 ? "bg-tier-a" : value >= 0.55 ? "bg-tier-b" : "bg-danger";
  return (
    <div className="flex items-center gap-2" title={value.toFixed(2)}>
      <div className="h-1.5 w-20 rounded-full bg-line"><div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.round(value * 100)}%` }} /></div>
      <span className="font-mono text-[11px] text-muted">{value.toFixed(2)}</span>
    </div>
  );
}

const SOURCE_LABEL: Record<string, string> = { hunter: "Hunter", apollo: "Apollo", tavily: "Tavily", website: "Website", mock: "Mock" };
export function SourceBadge({ source, title }: { source: string | null; title?: string }) {
  if (!source) return null;
  const tone = source === "hunter" ? "green" : source === "apollo" ? "violet" : "neutral";
  return <Badge tone={tone} title={title ?? `Source: ${SOURCE_LABEL[source] ?? source}`}>{SOURCE_LABEL[source] ?? source}</Badge>;
}
