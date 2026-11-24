import type { Metadata } from "next";
import { Instrument_Sans, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { WorkspaceProvider } from "@/components/WorkspaceProvider";

const inter = Instrument_Sans({ subsets: ["latin"], variable: "--font-inter" });
const serif = Fraunces({ subsets: ["latin"], variable: "--font-source-serif", style: ["normal", "italic"] });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "Cited",
  description: "Cited leads, human-approved outreach, one loop.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable} ${mono.variable}`}>
      <body className="antialiased">
        <WorkspaceProvider>{children}</WorkspaceProvider>
      </body>
    </html>
  );
}
