import Link from "next/link";
import { ArrowRight, Check, X, Search, Share2, ShieldCheck, UserCheck, MessageSquareText, Target, Mail, KanbanSquare, Play } from "lucide-react";

/**
 * Landing page. Structure and copy only for now: visual style and animation come from Kamayani's
 * inspiration references. Every section has a data-section id so motion can be layered on later.
 */

const FEATURES = [
  { icon: Search, title: "Cited discovery", body: "Finds companies that fit your ICP. Every lead and signal links to the page it came from, or it is dropped." },
  { icon: Share2, title: "Warm paths", body: "A knowledge graph finds shared employers, hiring signals and competitor renewals, so you know the way in." },
  { icon: ShieldCheck, title: "Claim-checked drafts", body: "Every sentence is checked against stored evidence in milliseconds. Unsupported claims can't be approved." },
  { icon: UserCheck, title: "You approve every send", body: "Four agents plan, write, review and security-check. Nothing goes out until you say so." },
];

const STEPS = [
  { icon: MessageSquareText, title: "Describe", body: "Tell Cited what you sell, in a short chat." },
  { icon: Target, title: "Target", body: "It infers your ICP with a confidence score on every field." },
  { icon: Search, title: "Discover", body: "Cited companies, buying signals and contacts, scored A to C." },
  { icon: Mail, title: "Draft and check", body: "A three-touch sequence, each claim tied to a source." },
  { icon: KanbanSquare, title: "Approve and track", body: "You approve, Cited sends, and the pipeline updates itself." },
];

const STATS = [
  { value: "100%", label: "of leads cite a source" },
  { value: "<10 ms", label: "to check a claim" },
  { value: "0", label: "sends without approval" },
  { value: "4", label: "agents, one human gate" },
];

const PLANS = [
  { name: "Free", price: "$0", note: "100 credits, once", items: ["Full pipeline", "Demo inbox sending"] },
  { name: "Founder", price: "$99", note: "per month · 1,500 credits", items: ["Live enrichment", "Knowledge graph", "Claim check"], featured: true },
  { name: "Team", price: "$399", note: "per month · 7,500 credits", items: ["5 seats", "Band agent room", "Audit trail"] },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* Nav */}
      <header data-section="nav" className="sticky top-0 z-30 border-b border-line/70 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1180px] items-center gap-6 px-5">
          <Link href="/" className="flex items-center gap-2 font-serif text-xl font-semibold"><span className="grid h-7 w-7 place-items-center rounded-[7px] bg-accent text-[14px] font-bold text-white">C</span>Cited</Link>
          <nav className="hidden gap-5 text-[13px] text-muted md:flex">
            <a href="#what" className="hover:text-ink">Product</a>
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#pricing" className="hover:text-ink">Pricing</a>
          </nav>
          <Link href="/overview" className="ml-auto inline-flex items-center gap-1.5 rounded-[8px] bg-ink px-3.5 py-2 text-[13px] font-medium text-white hover:bg-ink/85">Open the app <ArrowRight size={14} /></Link>
        </div>
      </header>

      {/* Hero */}
      <section data-section="hero" className="mx-auto grid max-w-[1180px] items-center gap-12 px-5 pt-20 pb-16 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1 text-[12px] text-muted"><ShieldCheck size={13} className="text-accent" />AI outbound you can trust</span>
          <h1 className="mt-5 font-serif text-[44px] leading-[1.08] md:text-[56px]">Booked meetings, with a source for every claim.</h1>
          <p className="mt-5 max-w-[520px] text-[17px] leading-relaxed text-muted">Describe your product. Cited finds the companies that need it, the warm way in, and drafts outreach that is fact-checked before you approve it.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/overview" className="inline-flex items-center gap-2 rounded-[8px] bg-ink px-5 py-3 text-[14px] font-medium text-white hover:bg-ink/85">Try the live demo <ArrowRight size={15} /></Link>
            <a href="#how" className="inline-flex items-center gap-2 rounded-[8px] border border-line bg-white px-5 py-3 text-[14px] font-medium hover:bg-paper"><Play size={14} />See how it works</a>
          </div>
        </div>

        {/* Hero visual: the claim check, shown rather than explained */}
        <div data-section="hero-visual" className="rounded-[14px] border border-line bg-white p-5 shadow-[0_12px_40px_rgb(0_0_0/0.06)]">
          <div className="flex items-center gap-2 text-[12px] text-muted"><Mail size={14} />Draft to Priya, VP Finance · Northwind Analytics</div>
          <div className="mt-4 space-y-2.5 text-[14px]">
            <div className="flex items-start gap-2.5 rounded-[8px] bg-tier-a/5 p-2.5"><Check size={16} className="mt-0.5 shrink-0 text-tier-a" /><span>Saw Northwind is hiring three finance data engineers.<span className="mt-1 block text-[11px] text-tier-a">careers page · 0.82 match</span></span></div>
            <div className="flex items-start gap-2.5 rounded-[8px] bg-tier-a/5 p-2.5"><Check size={16} className="mt-0.5 shrink-0 text-tier-a" /><span>Congrats on the $45M Series C.<span className="mt-1 block text-[11px] text-tier-a">press release · 0.91 match</span></span></div>
            <div className="flex items-start gap-2.5 rounded-[8px] bg-danger/5 p-2.5"><X size={16} className="mt-0.5 shrink-0 text-danger" /><span className="line-through decoration-danger/50">Congrats on closing your Series D.<span className="mt-1 block text-[11px] text-danger no-underline">no evidence · blocked</span></span></div>
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-line pt-4">
            <span className="rounded-[6px] bg-ink px-3 py-1.5 text-[12px] font-medium text-white">Approve & send</span>
            <span className="text-[12px] text-muted">waiting for you</span>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section data-section="stats" className="border-y border-line bg-white">
        <div className="mx-auto grid max-w-[1180px] grid-cols-2 gap-6 px-5 py-8 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label}><div className="font-serif text-[34px] leading-none">{s.value}</div><div className="mt-1.5 text-[13px] text-muted">{s.label}</div></div>
          ))}
        </div>
      </section>

      {/* Problem */}
      <section data-section="problem" className="mx-auto max-w-[1180px] px-5 py-20">
        <p className="max-w-[760px] font-serif text-[28px] leading-snug">Founders without a sales team stitch together a list tool, an enrichment tool, a sequencer and a spreadsheet, and still send email nobody can trace to a real reason.</p>
        <p className="mt-4 text-[15px] text-muted">Cited is one loop instead of four tools.</p>
      </section>

      {/* What it does */}
      <section id="what" data-section="features" className="mx-auto max-w-[1180px] px-5 pb-20">
        <div className="text-[12px] font-semibold tracking-wider text-accent uppercase">What it does</div>
        <h2 className="mt-2 font-serif text-[34px]">Find them, reach them, prove it.</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-[12px] border border-line bg-white p-5">
              <span className="grid h-10 w-10 place-items-center rounded-[9px] bg-accent/10 text-accent"><f.icon size={19} /></span>
              <h3 className="mt-4 text-[16px] font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" data-section="how" className="border-t border-line bg-white">
        <div className="mx-auto max-w-[1180px] px-5 py-20">
          <div className="text-[12px] font-semibold tracking-wider text-accent uppercase">How it works</div>
          <h2 className="mt-2 font-serif text-[34px]">From product description to booked meeting.</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-5">
            {STEPS.map((s, i) => (
              <li key={s.title} data-step={i + 1} className="relative">
                <div className="flex items-center gap-2">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-ink text-white"><s.icon size={18} /></span>
                  <span className="font-mono text-[12px] text-muted">0{i + 1}</span>
                </div>
                <h3 className="mt-4 text-[16px] font-semibold">{s.title}</h3>
                <p className="mt-1 text-[14px] leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" data-section="pricing" className="mx-auto max-w-[1180px] px-5 py-20">
        <div className="text-[12px] font-semibold tracking-wider text-accent uppercase">Pricing</div>
        <h2 className="mt-2 font-serif text-[34px]">Pay for what you send.</h2>
        <p className="mt-2 text-[15px] text-muted">Drafts are free. Credits cover enrichment, approved sends and graph queries.</p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {PLANS.map((p) => (
            <div key={p.name} className={`rounded-[12px] border p-6 ${p.featured ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>
              <div className="text-[14px] font-semibold">{p.name}</div>
              <div className="mt-3 font-serif text-[38px] leading-none">{p.price}</div>
              <div className={`mt-1.5 text-[13px] ${p.featured ? "text-white/70" : "text-muted"}`}>{p.note}</div>
              <ul className="mt-5 space-y-2 text-[14px]">{p.items.map((it) => <li key={it} className="flex items-center gap-2"><Check size={15} className={p.featured ? "text-white" : "text-tier-a"} />{it}</li>)}</ul>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section data-section="cta" className="mx-auto max-w-[1180px] px-5 pb-24">
        <div className="rounded-[16px] bg-accent px-8 py-14 text-center text-white">
          <h2 className="font-serif text-[36px]">Your first 20 meetings, without hiring an SDR.</h2>
          <Link href="/overview" className="mt-7 inline-flex items-center gap-2 rounded-[8px] bg-white px-5 py-3 text-[14px] font-medium text-ink hover:bg-paper">Try the live demo <ArrowRight size={15} /></Link>
        </div>
      </section>

      <footer data-section="footer" className="border-t border-line">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between px-5 py-6 text-[12px] text-muted">
          <span className="font-serif text-[15px] text-ink">Cited</span>
          <span>Cited leads, checked claims, human-approved outreach.</span>
        </div>
      </footer>
    </div>
  );
}
