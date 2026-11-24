import { TopBar } from "@/components/TopBar";
import { SideNav } from "@/components/SideNav";
import { AgentPanel } from "@/components/AgentPanel";
import { RunProvider } from "@/components/run/RunProvider";
import { RunCanvas } from "@/components/run/RunCanvas";

/** The product shell: top bar, navigation, Agent Thinking panel. The landing page at / has none of it. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <RunProvider>
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <TopBar />
      <div className="mx-auto flex w-full max-w-[1440px] flex-1">
        <SideNav />
        <main className="min-w-0 flex-1 px-6 py-6">{children}</main>
        <AgentPanel />
      </div>
      <RunCanvas />
    </div>
    </RunProvider>
  );
}
