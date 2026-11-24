"use client";
import { Sparkles } from "lucide-react";
import { useWorkspace } from "./WorkspaceProvider";
import { Button, Card } from "./ui";

export function EmptyState({ what }: { what: string }) {
  const { loadDemo, loading } = useWorkspace();
  return (
    <Card className="grid place-items-center gap-3 p-10 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-accent/10 text-accent"><Sparkles size={20} /></span>
      <p className="text-[13px] text-muted">No {what} yet</p>
      <Button onClick={loadDemo} disabled={loading}>Load demo data</Button>
    </Card>
  );
}
