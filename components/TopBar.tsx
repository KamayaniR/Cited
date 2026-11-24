"use client";
import Link from "next/link";
import { Coins, Cpu, Radio, Play, Loader2 } from "lucide-react";
import { useRun } from "./run/RunProvider";
import { useWorkspace } from "./WorkspaceProvider";
import { Dot } from "./ui";
import { Tip } from "./Tip";

const VENDOR_LABEL: Record<string, string> = { llm: "Claude", tavily: "Tavily", hunter: "Hunter", apollo: "Apollo", sendgrid: "SendGrid", flexprice: "Flexprice", band: "Band", neo4j: "Neo4j", supabase: "Supabase", moss: "Moss" };

export function TopBar() {
  const { ws, modes } = useWorkspace();
  const { run, runLoop } = useRun();
  const running = Boolean(run?.active);
  const vendors = modes ? Object.entries(modes.vendors) : [];
  const live = vendors.filter(([, m]) => m === "live").length;
  const tokens = ws?.agentEvents.reduce((s, e) => s + e.tokens, 0) ?? 0;
  const cost = ws?.agentEvents.reduce((s, e) => s + e.costUsd, 0) ?? 0;
  const credits = ws?.org.creditsBalance;
  const low = credits !== undefined && credits < 2;

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-[1440px] items-center gap-4 px-5">
        <Link href="/" className="flex items-center gap-1.5 font-serif text-xl font-semibold"><span className="grid h-6 w-6 place-items-center rounded-[6px] bg-accent text-[13px] font-bold text-white">C</span>Cited</Link>
        <Tip side="bottom" content={vendors.length ? `${live ? `${live} live` : "Mock mode"}: every vendor without keys runs on a mock.\n\n${vendors.map(([v, m]) => `${m === "live" ? "●" : "○"} ${VENDOR_LABEL[v] ?? v}: ${m}`).join("\n")}\nGraph: ${modes?.graph}` : ""}>
          <span className="flex items-center gap-2 rounded-full border border-line bg-white px-2.5 py-1 text-[11px]">
            <Radio size={12} className={live ? "text-tier-a" : "text-muted"} />
            <span className="font-medium">{live ? `${live} live` : "Mock"}</span>
            <span className="flex items-center gap-1">{vendors.map(([v, m]) => <Dot key={v} tone={m === "live" ? "green" : "neutral"} />)}</span>
          </span>
        </Tip>
        {modes && (
          <Tip side="bottom" content={modes.band === "live" ? "Agents talk in the Band room; decisions there run the same code." : "Band offline: the four agents run locally."}>
            <span className="flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-medium"><Dot tone={modes.band === "live" ? "violet" : "neutral"} pulse={modes.band === "live"} />Band</span>
          </Tip>
        )}
        <div className="ml-auto flex items-center gap-2 text-[12px]">
          <Tip side="bottom" content="Run every step that has work: discovery, enrichment, drafting and the claim check. It stops at your approval, because sends always need you.">
            <button onClick={() => void runLoop()} disabled={running} className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-[12px] font-medium text-white hover:opacity-90 disabled:opacity-60">
              {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}{running ? "Running…" : "Run the loop"}
            </button>
          </Tip>
          <Tip side="bottom" content={`${tokens.toLocaleString()} tokens · $${cost.toFixed(2)} LLM spend`}>
            <span className="flex items-center gap-1 text-muted"><Cpu size={13} /><span className="font-mono">${cost.toFixed(2)}</span></span>
          </Tip>
          <Tip side="bottom" content={low ? "Out of credits: paid calls return 402 until you top up." : "Credits: 2 per lead enriched, 1 per send, 0.5 per graph query, 0.2 per refresh."}>
            <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ${low ? "bg-danger/10 text-danger" : "bg-accent/10 text-accent"}`}><Coins size={13} /><span className="font-mono">{credits ?? "–"}</span></span>
          </Tip>
        </div>
      </div>
    </header>
  );
}
