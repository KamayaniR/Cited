"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Overview" },
  { href: "/intake", label: "Intake & ICP" },
  { href: "/discovery", label: "Discovery" },
  { href: "/graph", label: "Graph" },
  { href: "/outreach", label: "Approval queue" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/analytics", label: "Analytics" },
  { href: "/billing", label: "Billing" },
  { href: "/audit", label: "Audit log" },
];

export function SideNav() {
  const path = usePathname();
  return (
    <nav className="w-48 shrink-0 border-r border-line px-3 py-6">
      <ul className="space-y-0.5">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <li key={t.href}>
              <Link href={t.href} className={`block rounded-[6px] px-3 py-1.5 text-[13px] ${active ? "bg-ink text-white" : "text-ink hover:bg-line/50"}`}>{t.label}</Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
