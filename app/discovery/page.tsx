"use client";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Badge, Card, PageTitle, TierBadge } from "@/components/ui";
import { EmptyState } from "@/components/EmptyState";
import { StageNote } from "@/components/StageNote";

const EMAIL_TONE = { valid: "green", accept_all: "amber", invalid: "red", unknown: "neutral" } as const;

export default function DiscoveryPage() {
  const { ws } = useWorkspace();
  if (!ws?.companies.length) return (<div><PageTitle kicker="Discovery" title="Cited companies" /><EmptyState what="companies" /></div>);
  const rows = [...ws.companies].sort((a, b) => Number(a.excluded) - Number(b.excluded) || b.score - a.score);
  return (
    <div>
      <PageTitle kicker="Discovery" title="Cited companies" />
      <StageNote stage="P1">Live Tavily discovery with citation validation runs next. Rows below come from the demo seed.</StageNote>
      <Card className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 bg-paper text-left text-[11px] uppercase tracking-wider text-muted">
            <tr>{["Score", "Company", "Industry", "Size", "HQ", "Signals", "Buyer", "Email", "LinkedIn", "Sources"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((c) => {
              const signals = ws.signals.filter((s) => s.companyId === c.id);
              const buyer = ws.people.find((p) => p.companyId === c.id);
              const cites = ws.citations.filter((x) => x.entityId === c.id || signals.some((s) => s.id === x.entityId));
              const urls = [...new Set(cites.map((x) => x.url))];
              return (
                <tr key={c.id} className={`hover:bg-paper ${c.excluded ? "opacity-60" : ""}`}>
                  <td className="px-3 py-1.5">{c.excluded ? <Badge tone="red" title={c.excludeReason ?? ""}>Filtered</Badge> : <TierBadge tier={c.tier} score={c.score} />}</td>
                  <td className="px-3 py-1.5 font-medium">{c.name}<div className="font-mono text-[11px] font-normal text-muted">{c.domain}</div>{c.excluded && <div className="text-[11px] font-normal text-danger">{c.excludeReason}</div>}</td>
                  <td className="px-3 py-1.5">{c.industry}</td>
                  <td className="px-3 py-1.5 font-mono text-[12px]">{c.headcount}</td>
                  <td className="px-3 py-1.5">{c.hq ?? <span className="text-muted">–</span>}{c.hqSource && <div><Badge>{c.hqSource}</Badge></div>}</td>
                  <td className="px-3 py-1.5 text-[12px]">{signals.map((s) => <div key={s.id}>{s.summary}</div>)}</td>
                  <td className="px-3 py-1.5">{buyer ? <>{buyer.name}<div className="text-[11px] text-muted">{buyer.title}</div></> : "–"}</td>
                  <td className="px-3 py-1.5">{buyer && <Badge tone={EMAIL_TONE[buyer.emailStatus]} title={`MX: ${buyer.mx ? "yes" : "no"} · source: ${buyer.emailSource ?? "none"}`}>{buyer.emailStatus.replace("_", "-")}</Badge>}</td>
                  <td className="px-3 py-1.5">{buyer?.linkedinUrl ? <a className="text-accent hover:underline" href={buyer.linkedinUrl} target="_blank" rel="noreferrer">profile</a> : <span className="text-muted">–</span>}</td>
                  <td className="px-3 py-1.5 text-[12px]">{urls.map((u, i) => <a key={u} href={u} title={u} target="_blank" rel="noreferrer" className="mr-1 text-accent hover:underline">[{i + 1}]</a>)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <h2 className="mt-8 mb-3 font-serif text-xl">Competitor map</h2>
      <div className="grid grid-cols-3 gap-3">
        {ws.competitors.map((c) => (
          <Card key={c.id} className="p-4 text-[13px]">
            <div className="flex items-center justify-between"><span className="font-medium">{c.name}</span><Badge>{c.category.replace("_", " ")}</Badge></div>
            <p className="mt-1 text-muted">{c.positioning}</p>
            <p className="mt-2 text-[12px]"><span className="text-muted">Pricing:</span> {c.pricing}</p>
            <p className="mt-1 text-[12px]"><span className="text-muted">Our advantage:</span> {c.ourAdvantage}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
