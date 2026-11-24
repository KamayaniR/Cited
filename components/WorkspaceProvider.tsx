"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Workspace } from "@/lib/types";

type Modes = { vendors: Record<string, "live" | "mock">; band: "live" | "local"; graph: "neo4j" | "memory"; demo: boolean };
interface Ctx { ws: Workspace | null; modes: Modes | null; loading: boolean; refresh: () => Promise<Workspace | null>; loadDemo: () => Promise<void>; reset: () => Promise<void> }

const WorkspaceCtx = createContext<Ctx | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [ws, setWs] = useState<Workspace | null>(null);
  const [modes, setModes] = useState<Modes | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/state", { cache: "no-store" });
    const body = await res.json();
    setWs(body.workspace);
    setModes(body.modes);
    setLoading(false);
    return body.workspace as Workspace;
  }, []);

  const loadDemo = useCallback(async () => {
    setLoading(true);
    await fetch("/api/demo/seed", { method: "POST" });
    await refresh();
  }, [refresh]);

  const reset = useCallback(async () => {
    setLoading(true);
    await fetch("/api/demo/seed", { method: "DELETE" });
    await refresh();
  }, [refresh]);

  useEffect(() => { void refresh(); }, [refresh]);

  return <WorkspaceCtx.Provider value={{ ws, modes, loading, refresh, loadDemo, reset }}>{children}</WorkspaceCtx.Provider>;
}

export function useWorkspace() {
  const c = useContext(WorkspaceCtx);
  if (!c) throw new Error("useWorkspace outside WorkspaceProvider");
  return c;
}
