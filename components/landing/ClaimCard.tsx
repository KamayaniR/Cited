import { Check, X, Mail, ShieldCheck } from "lucide-react";

/**
 * The signature moment: a draft whose sentences tick green one by one, and one unsourced claim
 * that gets flagged and struck through. Pure CSS loops, so it is static under reduced motion.
 */
export interface ClaimLine { text: string; source: string; ok: boolean }

export const SAMPLE_LINES: ClaimLine[] = [
  { text: "Saw Zylo just hired a VP of Finance", source: "linkedin.com", ok: true },
  { text: "and kicked off a NetSuite migration.", source: "zylo.com/careers", ok: true },
  { text: "Congrats on the Series D.", source: "not found", ok: false },
  { text: "Ledgerlight closes the books in days.", source: "ledgerlight.ai", ok: true },
];

export function ClaimCard({ to = "To Jason Leet · CFO, Zylo", lines = SAMPLE_LINES, animate = true, className = "" }: { to?: string; lines?: ClaimLine[]; animate?: boolean; className?: string }) {
  return (
    <div className={`rounded-[18px] border border-line bg-white p-4 c-shadow ${className}`}>
      <div className="flex items-center gap-2 border-b border-line pb-3 text-[12.5px]">
        <span className="grid h-7 w-7 place-items-center rounded-[8px] bg-accent/10 text-accent"><Mail size={14} /></span>
        <span className="text-ink/80">{to}</span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-tier-a/10 px-2 py-0.5 text-[11px] font-medium text-tier-a"><ShieldCheck size={12} />Verified</span>
      </div>
      <ul className="mt-2 space-y-1">
        {lines.map((l, i) => (
          <li key={i} className={`relative flex items-center gap-2.5 rounded-[8px] px-1.5 py-1.5 text-[13px] ${!l.ok && animate ? "c-flag" : ""}`}>
            <span className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full text-white ${l.ok ? "bg-tier-a" : "bg-danger"} ${animate ? "c-check" : ""}`} style={animate ? { animationDelay: `${i * 0.5}s` } : undefined}>
              {l.ok ? <Check size={11} strokeWidth={3} /> : <X size={11} strokeWidth={3} />}
            </span>
            <span className={`relative flex-1 ${l.ok ? "" : "text-danger"}`}>
              {l.text}
              {!l.ok && <span aria-hidden className={`absolute top-1/2 right-0 left-0 h-px bg-danger ${animate ? "c-strike" : ""}`} />}
            </span>
            <span className={`shrink-0 rounded-[5px] border px-1.5 font-mono text-[10px] ${l.ok ? "border-line text-muted" : "border-danger/40 text-danger"}`}>{l.source}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex justify-end"><span className="inline-flex items-center gap-1.5 rounded-[8px] bg-ink px-3 py-1.5 text-[12px] font-medium text-white"><Check size={13} />Approve send</span></div>
    </div>
  );
}

/** A small hub-and-spoke knowledge graph: product in the middle, companies around it, a green cited path. */
export function MiniGraph({ className = "" }: { className?: string }) {
  const cx = 200, cy = 130;
  const cos = Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2 - Math.PI / 2; return { x: cx + 160 * Math.cos(a), y: cy + 100 * Math.sin(a) }; });
  const comps = Array.from({ length: 4 }, (_, i) => { const a = (i / 4) * Math.PI * 2 + 0.6; return { x: cx + 70 * Math.cos(a), y: cy + 46 * Math.sin(a) }; });
  return (
    <svg viewBox="0 0 400 260" className={`c-float ${className}`} role="img" aria-label="Knowledge graph: your product linked to companies, signals and competitors">
      {cos.map((c, i) => <path key={i} d={`M${cx} ${cy} L${c.x} ${c.y}`} pathLength={100} className="c-draw" style={{ animationDelay: `${i * 90}ms` }} stroke={i === 3 ? "#1F8A5B" : "#6A35E0"} strokeOpacity={i === 3 ? 0.9 : 0.35} strokeWidth={i === 3 ? 2 : 1.2} fill="none" />)}
      {comps.map((c, i) => <path key={i} d={`M${cx} ${cy} L${c.x} ${c.y}`} stroke="#D93A3A" strokeOpacity={0.45} strokeDasharray="3 4" fill="none" />)}
      {cos.map((c, i) => (
        <g key={i}>
          {i === 3 && <circle cx={c.x} cy={c.y} r={9} fill="#1F8A5B" opacity={0.3} className="c-ring" style={{ transformOrigin: `${c.x}px ${c.y}px` }} />}
          <circle cx={c.x} cy={c.y} r={6} fill={i === 3 ? "#1F8A5B" : "#6A35E0"} />
          <circle cx={c.x + 11} cy={c.y - 7} r={2.6} fill="#D97706" className="c-live" style={{ animationDelay: `${i * 170}ms` }} />
        </g>
      ))}
      {comps.map((c, i) => <circle key={i} cx={c.x} cy={c.y} r={4} fill="#D93A3A" />)}
      <circle cx={cx} cy={cy} r={14} fill="#6A35E0" opacity={0.25} className="c-ring" style={{ transformOrigin: `${cx}px ${cy}px` }} />
      <circle cx={cx} cy={cy} r={9} fill="#1E1A16" />
    </svg>
  );
}
