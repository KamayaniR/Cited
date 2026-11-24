import { Briefcase, Banknote, Rocket, UserPlus, Cpu, Globe2, AlertTriangle } from "lucide-react";
import type { Signal } from "@/lib/types";
import { Tip } from "./Tip";

export const SIGNAL_META: Record<Signal["type"], { icon: typeof Briefcase; label: string; cls: string }> = {
  hiring: { icon: Briefcase, label: "Hiring", cls: "bg-rep/10 text-rep" },
  funding: { icon: Banknote, label: "Funding", cls: "bg-tier-a/10 text-tier-a" },
  launch: { icon: Rocket, label: "Launch", cls: "bg-agent/10 text-agent" },
  leadership_change: { icon: UserPlus, label: "New leader", cls: "bg-accent/10 text-accent" },
  tech_adoption: { icon: Cpu, label: "Tech change", cls: "bg-tier-b/10 text-tier-b" },
  expansion: { icon: Globe2, label: "Expansion", cls: "bg-accent/10 text-accent" },
  negative: { icon: AlertTriangle, label: "Negative", cls: "bg-danger/10 text-danger" },
};

/** One signal as an icon chip; the summary and its source are in the tooltip and the link. */
export function SignalChip({ s, showLabel }: { s: Signal; showLabel?: boolean }) {
  const m = SIGNAL_META[s.type] ?? SIGNAL_META.launch;
  let host = "";
  try { host = new URL(s.sourceUrl).hostname; } catch { /* ignore */ }
  return (
    <Tip content={`${m.label}: ${s.summary}\nSource: ${host}`}>
      <a href={s.sourceUrl} target="_blank" rel="noreferrer" aria-label={`${m.label}: ${s.summary}`} className={`inline-flex items-center gap-1 rounded-[5px] px-1.5 py-1 text-[11px] font-medium ${m.cls} hover:ring-1 hover:ring-current`}>
        <m.icon size={12} />{showLabel && <span className="max-w-[180px] truncate">{s.summary}</span>}
      </a>
    </Tip>
  );
}
