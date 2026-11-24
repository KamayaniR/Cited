"use client";
import { useWorkspace } from "./WorkspaceProvider";
import { Badge } from "./ui";

export function TopBar() {
  const { ws, modes } = useWorkspace();
  const live = modes ? Object.entries(modes.vendors).filter(([, m]) => m === "live").map(([v]) => v) : [];
  const tokens = ws?.agentEvents.reduce((s, e) => s + e.tokens, 0) ?? 0;
  const cost = ws?.agentEvents.reduce((s, e) => s + e.costUsd, 0) ?? 0;

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-[1440px] items-center gap-4 px-6">
        <div className="font-serif text-xl font-semibold">Cited</div>
        <div className="flex flex-1 flex-wrap items-center gap-2 text-[12px] text-muted">
          <Badge tone={live.length ? "green" : "neutral"} title={modes ? Object.entries(modes.vendors).map(([v, m]) => `${v}: ${m}`).join("\n") : ""}>
            {live.length === 0 ? "Mock mode" : `Live: ${live.join(", ")}`}
          </Badge>
          {modes && <Badge tone={modes.band === "live" ? "violet" : "neutral"}>{modes.band === "live" ? "Band: live" : "Band: offline (local agents)"}</Badge>}
          {modes && <Badge>Graph: {modes.graph}</Badge>}
        </div>
        <div className="flex items-center gap-4 text-[12px]">
          <span className="text-muted">Tokens <span className="font-mono text-ink">{tokens.toLocaleString()}</span></span>
          <span className="text-muted">LLM <span className="font-mono text-ink">${cost.toFixed(2)}</span></span>
          <span className="text-muted">Credits <span className={`font-mono ${ws && ws.org.creditsBalance <= 0 ? "text-danger" : "text-ink"}`}>{ws?.org.creditsBalance ?? "–"}</span></span>
        </div>
      </div>
    </header>
  );
}
