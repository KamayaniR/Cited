"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MessageSquareText, Search, Share2, Inbox, KanbanSquare, BarChart3, CreditCard, ScrollText, PlayCircle } from "lucide-react";
import { useWorkspace } from "./WorkspaceProvider";
import type { Workspace } from "@/lib/types";

const TABS: { href: string; label: string; icon: typeof Inbox; count?: (ws: Workspace) => number }[] = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/intake", label: "Intake & ICP", icon: MessageSquareText },
  { href: "/discovery", label: "Discovery", icon: Search, count: (ws) => ws.companies.filter((c) => !c.excluded).length },
  { href: "/graph", label: "Graph", icon: Share2 },
  { href: "/outreach", label: "Approvals", icon: Inbox, count: (ws) => ws.messages.filter((m) => m.status === "pending_approval" || m.status === "needs_fix").length },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/audit", label: "Audit log", icon: ScrollText },
  { href: "/demo", label: "Demo", icon: PlayCircle },
];

export function SideNav() {
  const path = usePathname();
  const { ws } = useWorkspace();
  return (
    <nav className="w-[196px] shrink-0 border-r border-line px-3 py-5">
      <ul className="space-y-0.5">
        {TABS.map((t) => {
          const active = path.startsWith(t.href);
          const n = ws && t.count ? t.count(ws) : 0;
          return (
            <li key={t.href}>
              <Link href={t.href} className={`group flex items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-[13px] transition ${active ? "bg-white font-medium shadow-[0_8px_24px_-12px_rgba(60,30,120,0.35)]" : "text-ink/80 hover:bg-white/60"}`}>
                <span className={`grid h-7 w-7 place-items-center rounded-[8px] transition ${active ? "bg-ink text-white shadow-[0_0_0_4px_rgba(106,53,224,0.18)]" : "bg-[#E6DBC8] text-ink/75 group-hover:bg-accent/10 group-hover:text-accent"}`}><t.icon size={14} /></span>
                <span className="flex-1">{t.label}</span>
                {n > 0 && <span className={`rounded-full px-1.5 text-[10px] font-semibold ${active ? "bg-accent/10 text-accent" : t.href === "/outreach" ? "bg-tier-b/15 text-tier-b" : "bg-line/70 text-muted"}`}>{n}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
