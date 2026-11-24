"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MessageSquareText, Search, Share2, Inbox, KanbanSquare, BarChart3, CreditCard, ScrollText } from "lucide-react";
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
];

export function SideNav() {
  const path = usePathname();
  const { ws } = useWorkspace();
  return (
    <nav className="w-[188px] shrink-0 border-r border-line px-2.5 py-5">
      <ul className="space-y-0.5">
        {TABS.map((t) => {
          const active = path.startsWith(t.href);
          const n = ws && t.count ? t.count(ws) : 0;
          return (
            <li key={t.href}>
              <Link href={t.href} className={`flex items-center gap-2.5 rounded-[6px] px-2.5 py-1.5 text-[13px] ${active ? "bg-ink text-white" : "text-ink hover:bg-line/50"}`}>
                <t.icon size={15} className={active ? "" : "text-muted"} />
                <span className="flex-1">{t.label}</span>
                {n > 0 && <span className={`rounded-full px-1.5 text-[10px] font-semibold ${active ? "bg-white/20" : t.href === "/outreach" ? "bg-tier-b/15 text-tier-b" : "bg-line/70 text-muted"}`}>{n}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
