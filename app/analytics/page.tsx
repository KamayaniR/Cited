"use client";
import { PageTitle, Card } from "@/components/ui";
import { StageNote } from "@/components/StageNote";

export default function AnalyticsPage() {
  return (
    <div>
      <PageTitle kicker="Analytics" title="Conversion by industry, tier and variant" />
      <StageNote stage="P3">Funnel and A/B analytics are built with the Kanban in P3.</StageNote>
      <Card className="p-6 text-[13px] text-muted">Nothing to chart yet.</Card>
    </div>
  );
}
