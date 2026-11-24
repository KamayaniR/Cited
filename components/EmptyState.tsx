"use client";
import { useWorkspace } from "./WorkspaceProvider";
import { Button, Card } from "./ui";

export function EmptyState({ what }: { what: string }) {
  const { loadDemo, loading } = useWorkspace();
  return (
    <Card className="p-8 text-center">
      <p className="text-muted">No {what} yet. Run the pipeline from Intake, or load the demo workspace.</p>
      <Button className="mt-4" onClick={loadDemo} disabled={loading}>Load demo data</Button>
    </Card>
  );
}
