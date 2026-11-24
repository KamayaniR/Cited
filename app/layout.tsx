import type { Metadata } from "next";
import { Inter, Source_Serif_4, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { WorkspaceProvider } from "@/components/WorkspaceProvider";
import { TopBar } from "@/components/TopBar";
import { SideNav } from "@/components/SideNav";
import { AgentPanel } from "@/components/AgentPanel";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-source-serif" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "Cited",
  description: "Cited leads, human-approved outreach, one loop.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${serif.variable} ${mono.variable} antialiased`}>
        <WorkspaceProvider>
          <div className="flex min-h-screen flex-col">
            <TopBar />
            <div className="mx-auto flex w-full max-w-[1440px] flex-1">
              <SideNav />
              <main className="min-w-0 flex-1 px-6 py-6">{children}</main>
              <AgentPanel />
            </div>
          </div>
        </WorkspaceProvider>
      </body>
    </html>
  );
}
