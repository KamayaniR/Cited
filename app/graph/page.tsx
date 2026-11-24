"use client";
import { PageTitle, Card } from "@/components/ui";
import { StageNote } from "@/components/StageNote";

export default function GraphPage() {
  return (
    <div>
      <PageTitle kicker="Graph" title="Knowledge graph queries" />
      <StageNote stage="P4">Neo4j writes and the three multi-hop queries (warm path, hiring, competitor displacement) with an in-memory fallback are built in P4.</StageNote>
      <Card className="p-6 text-[13px] text-muted">The graph schema is in <span className="font-mono">lib/graph/schema.cypher</span>. Nodes: Company, Person, Product, Competitor, Signal, Team, School.</Card>
    </div>
  );
}
