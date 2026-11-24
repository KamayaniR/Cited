import Link from "next/link";
import { ArrowRight, Check, Play } from "lucide-react";
import { Reveal } from "@/components/landing/motion";
import { HeroBackdrop, HeroFeed, AppWindow, OldWay, Board, CHAPTERS } from "@/components/landing/V2";

/**
 * Landing page: cream, violet and green, Fraunces headings. "Every claim, cited."
 * Motion explains the product (claims tick, a bad one is struck out); all of it stops under reduced motion.
 */

const PLANS = [
  { name: "Free", price: "$0", note: "100 credits, once", items: ["Full pipeline", "Demo inbox sending"] },
  { name: "Founder", price: "$99", note: "per month · 1,500 credits", items: ["Live enrichment", "Knowledge graph", "Claim check"], featured: true },
  { name: "Team", price: "$399", note: "per month · 7,500 credits", items: ["5 seats", "Band agent room", "Audit trail"] },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#FBF7F0] text-ink selection:bg-accent/20">
      <header className="fixed inset-x-0 top-3 z-30 px-4">
        <div className="c-glass mx-auto flex h-14 max-w-[72rem] items-center gap-7 rounded-[16px] px-5 shadow-[0_10px_30px_-12px_rgba(60,30,120,0.2)]">
          <Link href="/" className="flex items-center gap-2 font-serif text-[20px]"><span className="grid h-7 w-7 place-items-center rounded-[8px] bg-accent font-sans text-[14px] font-bold text-white">C</span>Cited</Link>
          <nav className="hidden gap-6 text-[14px] text-ink/65 md:flex">
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#why" className="hover:text-ink">Why Cited</a>
            <a href="#pricing" className="hover:text-ink">Pricing</a>
          </nav>
          <Link href="/overview" className="ml-auto inline-flex items-center gap-1.5 rounded-[10px] bg-ink px-3.5 py-2 text-[13px] font-medium text-[#FBF7F0] hover:bg-ink/85">Open the app <ArrowRight size={14} /></Link>
        </div>
      </header>

      <section className="relative min-h-[880px] overflow-hidden">
        <HeroBackdrop />
        <div className="relative mx-auto grid max-w-[1240px] items-center gap-10 px-6 pt-40 pb-24 lg:grid-cols-[1.05fr_1fr]">
          <div className="c-rise">
            <span className="inline-block rounded-[6px] bg-white/70 px-2.5 py-1 font-mono text-[11px] tracking-[0.12em]">AI GO-TO-MARKET ENGINE</span>
            <h1 className="mt-6 font-serif text-[64px] leading-[0.95] tracking-[-0.03em] md:text-[96px]">Every claim,<br /><em className="text-accent">cited.</em></h1>
            <p className="mt-6 max-w-[500px] text-[18px] leading-relaxed text-ink/70">Tell Cited what you sell. It finds companies that need it, writes outreach where every fact links to its source, and sends nothing until you say so.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/overview" className="inline-flex items-center gap-2 rounded-[10px] bg-ink px-5 py-3.5 text-[15px] font-semibold text-[#FBF7F0] hover:bg-ink/85">Try it live <ArrowRight size={15} /></Link>
              <Link href="/demo" className="c-glass inline-flex items-center gap-2 rounded-[10px] px-5 py-3.5 text-[15px] font-semibold hover:bg-white"><Play size={14} />Watch a recorded run</Link>
            </div>
          </div>
          <div className="hidden lg:block"><HeroFeed /></div>
        </div>
      </section>

      <section className="relative mx-auto -mt-16 max-w-[1160px] px-6 pb-24">
        <Reveal><AppWindow /></Reveal>
      </section>

      <section id="why" className="mx-auto max-w-[1160px] px-6 py-20">
        <Reveal className="text-center">
          <h2 className="font-serif text-[44px] leading-[1.05] tracking-[-0.02em] md:text-[56px]">Where the <em className="text-accent">source</em> gets lost.</h2>
          <p className="mx-auto mt-3 max-w-[560px] text-[15px] text-ink/60">Most teams pull leads from one tool, enrich them in another and write in a third. By the time an email goes out, nobody can say where a fact came from. Cited keeps the link the whole way.</p>
        </Reveal>
        <Reveal className="mt-12"><OldWay /></Reveal>
      </section>

      <section id="how" className="mx-auto max-w-[1160px] px-6 py-20">
        <Reveal><h2 className="max-w-[640px] font-serif text-[44px] leading-[1.05] tracking-[-0.02em] md:text-[56px]">How a <em className="text-accent">run</em> works.</h2></Reveal>
        <div className="mt-14 space-y-24">
          {CHAPTERS.map((c, i) => (
            <div key={c.n} className={`grid items-center gap-10 md:grid-cols-2 ${i % 2 ? "md:[&>*:first-child]:order-2" : ""}`}>
              <Reveal>
                <div className="font-mono text-[12px] tracking-[0.12em] text-accent">{c.n} · {c.label}</div>
                <h3 className="mt-3 font-serif text-[34px] leading-[1.1] tracking-[-0.01em]">{c.title}</h3>
                <p className="mt-3 max-w-[440px] text-[15px] leading-relaxed text-ink/60">{c.body}</p>
              </Reveal>
              <Reveal delay={120}><Board stage={c.stage} tasks={c.tasks} /></Reveal>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-[1160px] px-6 py-20">
        <Reveal>
          <div className="font-mono text-[12px] tracking-[0.12em] text-accent">PRICING</div>
          <h2 className="mt-2 font-serif text-[44px] leading-[1.05] tracking-[-0.02em]">Pay for what you <em className="text-accent">send</em>.</h2>
          <p className="mt-3 text-[15px] text-ink/60">Drafts are free. Credits cover enrichment, approved sends and graph queries.</p>
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {PLANS.map((p, i) => (
            <Reveal key={p.name} delay={i * 80}>
              <div className={`h-full rounded-[20px] border p-6 transition hover:-translate-y-1 ${p.featured ? "border-accent bg-accent text-white c-shadow" : "border-line bg-white"}`}>
                <div className="text-[14px] font-semibold">{p.name}</div>
                <div className="mt-3 font-serif text-[44px] leading-none">{p.price}</div>
                <div className={`mt-1.5 text-[13px] ${p.featured ? "text-white/75" : "text-ink/55"}`}>{p.note}</div>
                <ul className="mt-5 space-y-2 text-[14px]">{p.items.map((it) => <li key={it} className="flex items-center gap-2"><Check size={15} className={p.featured ? "text-white" : "text-tier-a"} />{it}</li>)}</ul>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1160px] px-6 pb-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-[32px] bg-ink px-8 py-20 text-center text-[#FBF7F0]">
            <span aria-hidden className="c-float absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-accent/50 blur-[80px]" />
            <h2 className="relative font-serif text-[44px] leading-[1.05] tracking-[-0.02em] md:text-[56px]">See it catch a claim it <em className="text-[#B9A0FF]">can’t back up.</em></h2>
            <p className="relative mx-auto mt-4 max-w-[460px] text-[15px] text-white/60">Describe your product and run it. Every sentence is checked against a source before it reaches you.</p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/overview" className="inline-flex items-center gap-2 rounded-[10px] bg-[#FBF7F0] px-5 py-3.5 text-[15px] font-semibold text-ink hover:bg-white">Try it live <ArrowRight size={15} /></Link>
              <Link href="/demo" className="inline-flex items-center gap-2 rounded-[10px] border border-white/25 px-5 py-3.5 text-[15px] font-semibold hover:bg-white/10"><Play size={14} />Watch a recorded run</Link>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1160px] items-center justify-between px-6 py-6 text-[12px] text-ink/55">
          <span className="flex items-center gap-1.5 font-serif text-[16px] text-ink"><span className="grid h-5 w-5 place-items-center rounded-[5px] bg-accent font-sans text-[11px] font-bold text-white">C</span>Cited</span>
          <span>Outreach you can back up.</span>
        </div>
      </footer>
    </div>
  );
}
