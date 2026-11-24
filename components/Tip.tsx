"use client";
import { useId, useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";

/**
 * Hover/focus tooltip. Fixed-positioned so it escapes scrolling tables and cards.
 * Keeps explanations off the page until someone asks for them.
 */
export function Tip({ content, children, className = "", side = "top" }: { content: ReactNode; children: ReactNode; className?: string; side?: "top" | "bottom" }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  if (content === null || content === undefined || content === "") return <>{children}</>;
  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ x: Math.min(Math.max(r.left + r.width / 2, 140), window.innerWidth - 140), y: side === "top" ? r.top : r.bottom });
  };
  return (
    <span ref={ref} className={className || "inline-flex"} onMouseEnter={show} onMouseLeave={() => setPos(null)} onFocus={show} onBlur={() => setPos(null)} aria-describedby={pos ? id : undefined}>
      {children}
      {pos && (
        <span
          id={id}
          role="tooltip"
          style={{ left: pos.x, top: pos.y }}
          className={`pointer-events-none fixed z-50 max-w-[280px] -translate-x-1/2 rounded-[6px] bg-ink px-2.5 py-1.5 text-left text-[12px] leading-snug font-normal whitespace-pre-line text-white shadow-lg ${side === "top" ? "-translate-y-[calc(100%+6px)]" : "translate-y-[6px]"}`}
        >
          {content}
        </span>
      )}
    </span>
  );
}

/** A small (i) that explains something on hover. */
export function InfoTip({ content }: { content: ReactNode }) {
  return (
    <Tip content={content}>
      <span tabIndex={0} className="inline-flex cursor-help text-muted hover:text-ink" aria-label="More info"><Info size={13} /></span>
    </Tip>
  );
}
