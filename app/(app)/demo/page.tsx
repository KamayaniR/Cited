"use client";
import { useEffect, useRef, useState } from "react";
import { PlayCircle, Film, Info } from "lucide-react";
import { Badge, Card, PageTitle } from "@/components/ui";

interface Chapter { t: number; label: string }

/**
 * A recorded run of the whole loop on demo data, kept apart from the live workspace.
 * It is the backup if live calls fail on stage. Re-record with `npm run record-demo`.
 */
export default function DemoPage() {
  const video = useRef<HTMLVideoElement>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [missing, setMissing] = useState(false);
  const [now, setNow] = useState(0);
  useEffect(() => { fetch("/demo/chapters.json").then((r) => (r.ok ? r.json() : [])).then(setChapters).catch(() => setChapters([])); }, []);
  const seek = (t: number) => { if (video.current) { video.current.currentTime = t; void video.current.play(); } };
  const active = chapters.filter((c) => c.t <= now).at(-1);

  return (
    <div>
      <PageTitle icon={PlayCircle} title="Demo" tip="A recorded run on demo data. The rest of the app shows only real data from your keys.">
        <Badge tone="amber" icon={Film}>Recorded · demo data</Badge>
      </PageTitle>
      <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
        <Card className="overflow-hidden bg-ink">
          {missing
            ? <div className="grid aspect-[16/10] place-items-center p-6 text-center text-[13px] text-white/70"><Info size={20} />No recording yet. Run npm run record-demo to make one.</div>
            : <video ref={video} src="/demo/cited-demo.webm" controls playsInline className="block aspect-[16/10] w-full" onError={() => setMissing(true)} onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)} />}
        </Card>
        <Card className="h-fit p-2">
          <div className="px-2 pt-1 pb-2 text-[11px] font-semibold tracking-wider text-muted uppercase">Chapters</div>
          <ol className="space-y-0.5">
            {chapters.map((c) => (
              <li key={c.t}>
                <button onClick={() => seek(c.t)} className={`flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[13px] ${active?.t === c.t ? "bg-accent/10 text-accent" : "hover:bg-line/50"}`}>
                  <span className="w-9 font-mono text-[11px] text-muted">{Math.floor(c.t / 60)}:{String(Math.floor(c.t % 60)).padStart(2, "0")}</span>{c.label}
                </button>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
