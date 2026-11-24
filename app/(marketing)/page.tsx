import Link from "next/link";
import { ArrowRight, Check, Search, Share2, ShieldCheck, UserCheck, Play } from "lucide-react";
import { HeroGraph } from "@/components/landing/HeroGraph";
import { Untangle, HowItWorks, AgentsStrip } from "@/components/landing/Sections";
import { Reveal, CountUp } from "@/components/landing/motion";

/**
 * Landing page: light and warm (cream, peach glow, warm shadows), violet brand, "Every claim, cited."
 * Motion explains the product and nothing moves just to move; every effect respects reduced motion.
 */

const FEATURES = [
  { icon: Search, title: "Cited discovery", body: "Finds companies that fit your ICP. Every lead and signal links to the page it came from, or it is dropped." },
  { icon: Share2, title: "Warm paths", body: "A knowledge graph finds shared employers, hiring signals and competitor renewals, so you know the way in." },
  { icon: ShieldCheck, title: "Claim-checked drafts", body: "Every sentence is checked against stored evidence in milliseconds. Unsupported claims can't be approved." },
  { icon: UserCheck, title: "You approve every send", body: "Four agents plan, write, review and security-check. Nothing goes out until you say so." },
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
    <div className="min-h-screen bg-[#FAF6EF] text-[#2A211B] selection:bg-accent/20">
      <header data-section="nav" className="fixed inset-x-0 top-4 z-30 px-4">
        <div className="mx-auto flex h-14 max-w-[1100px] items-center gap-7 rounded-[14px] border border-[#7850281f] bg-white/70 px-4 shadow-[0_6px_24px_rgba(120,80,40,0.06)] backdrop-blur-xl">
          <Link href="/" className="flex items-center gap-2 text-[18px] font-semibold tracking-[-0.02em]"><span className="grid h-7 w-7 place-items-center rounded-[8px] bg-accent text-[14px] font-bold text-white">C</span>Cited</Link>
          <nav className="hidden gap-6 text-[14px] text-[#2A211B]/65 md:flex">
            <a href="#what" className="hover:text-[#2A211B]">Product</a>
            <a href="#how" className="hover:text-[#2A211B]">How it works</a>
            <a href="#pricing" className="hover:text-[#2A211B]">Pricing</a>
          </nav>
          <Link href="/overview" className="ml-auto inline-flex items-center gap-1.5 rounded-[9px] bg-[#2A211B] px-3.5 py-2 text-[13px] font-medium text-[#FAF6EF] hover:bg-[#2A211B]/85">Open the app <ArrowRight size={14} /></Link>
        </div>
      </header>

      <section data-section="hero" className="relative overflow-hidden">
        <div aria-hidden className="landing-glow pointer-events-none absolute top-[-10%] right-[-10%] h-[90%] w-[75%] rounded-full bg-[radial-gradient(closest-side,#FDE4CC,transparent)]" />
        <div className="relative mx-auto h-[min(900px,100vh)] min-h-[700px] max-w-[1440px]">
          <div className="absolute inset-0 hidden md:block"><HeroGraph /></div>
          <div className="relative z-10 px-6 pt-44 md:pl-[8%] lg:max-w-[50%]">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/[0.06] px-3 py-1.5 text-[13px] text-accent"><span className="h-1.5 w-1.5 rounded-full bg-accent" />Every sentence checked before you approve</span>
            <h1 className="mt-6 text-[60px] leading-[0.98] font-semibold tracking-[-0.035em] md:text-[84px]">Every claim,<br /><em className="font-serif font-normal text-accent">cited.</em></h1>
            <p className="mt-6 max-w-[520px] text-[18px] leading-relaxed text-[#2A211B]/62">Cited turns your product into booked meetings: it finds the companies, the warm way in, and outreach you can prove.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/overview" className="inline-flex items-center gap-2 rounded-[10px] bg-[#2A211B] px-5 py-3.5 text-[15px] font-semibold text-[#FAF6EF] hover:bg-[#2A211B]/85">Try the live demo <ArrowRight size={15} /></Link>
              <Link href="/demo" className="inline-flex items-center gap-2 rounded-[10px] border border-[#2A211B]/20 bg-white/60 px-5 py-3.5 text-[15px] font-semibold hover:bg-white"><Play size={14} />Watch the recorded demo</Link>
            </div>
            <div className="mt-14 hidden flex-wrap gap-5 text-[12px] text-[#2A211B]/60 md:flex">
              {[["#9B6BC4", "Companies"], ["#4F8FC0", "People"], ["#E8963A", "Signals"], ["#D9708A", "Competitors"], ["#2F7A4A", "Cited"]].map(([c, l]) => <span key={l} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{l}</span>)}
            </div>
          </div>
        </div>
      </section>

      <section data-section="untangle" className="px-5 py-16">
        <Reveal><p className="mx-auto mb-8 max-w-[640px] text-center text-[15px] text-[#2A211B]/60">Pages, job posts, news and profiles go in tangled. One line comes out, with its source attached.</p></Reveal>
        <Untangle />
      </section>

      <section data-section="stats" className="border-y border-[#7850281a] bg-white/60">
        <div className="mx-auto grid max-w-[1100px] grid-cols-2 gap-6 px-5 py-10 md:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 80}><div className="text-[44px] leading-none font-semibold tracking-[-0.03em]"><CountUp value={s.value} /></div><div className="mt-2 text-[14px] text-[#2A211B]/60">{s.label}</div></Reveal>
          ))}
        </div>
      </section>

      <section data-section="problem" className="mx-auto max-w-[1100px] px-5 py-24">
        <Reveal><p className="max-w-[820px] text-[30px] leading-snug font-medium tracking-[-0.02em]">Founders without a sales team stitch together a list tool, an enrichment tool, a sequencer and a spreadsheet, and still send email nobody can trace to a real reason. <span className="text-[#2A211B]/45">Cited is one loop instead of four tools.</span></p></Reveal>
      </section>

      <section id="what" data-section="features" className="mx-auto max-w-[1100px] px-5 pb-12">
        <Reveal>
          <div className="text-[12px] font-semibold tracking-wider text-accent uppercase">What it does</div>
          <h2 className="mt-2 text-[44px] leading-[1.05] font-semibold tracking-[-0.03em]">Find them, reach them, <em className="font-serif font-normal text-accent">prove</em> it.</h2>
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 60}>
              <div className="group h-full rounded-[16px] border border-[#7850281f] bg-white/80 p-5 shadow-[0_10px_30px_rgba(150,90,40,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(150,90,40,0.12)]">
                <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-accent/10 text-accent transition group-hover:scale-110"><f.icon size={19} /></span>
                <h3 className="mt-4 text-[16px] font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-[#2A211B]/60">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="how" data-section="how"><HowItWorks /></section>

      <section data-section="agents" className="border-y border-[#7850281a] bg-white/50 px-5 py-16">
        <Reveal><p className="mb-10 text-center text-[15px] text-[#2A211B]/60">Four agents plan, write, review and check. Only you hold the button that sends.</p></Reveal>
        <AgentsStrip />
      </section>

      <section id="pricing" data-section="pricing" className="mx-auto max-w-[1100px] px-5 py-24">
        <Reveal>
          <div className="text-[12px] font-semibold tracking-wider text-accent uppercase">Pricing</div>
          <h2 className="mt-2 text-[44px] leading-[1.05] font-semibold tracking-[-0.03em]">Pay for what you <em className="font-serif font-normal text-accent">send</em>.</h2>
          <p className="mt-3 text-[15px] text-[#2A211B]/60">Drafts are free. Credits cover enrichment, approved sends and graph queries.</p>
        </Reveal>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {PLANS.map((p, i) => (
            <Reveal key={p.name} delay={i * 60}>
              <div className={`h-full rounded-[16px] border p-6 transition hover:-translate-y-0.5 ${p.featured ? "border-accent bg-accent text-white shadow-[0_20px_50px_rgba(124,58,237,0.25)]" : "border-[#7850281f] bg-white/80"}`}>
                <div className="text-[14px] font-semibold">{p.name}</div>
                <div className="mt-3 text-[42px] leading-none font-semibold tracking-[-0.03em]">{p.price}</div>
                <div className={`mt-1.5 text-[13px] ${p.featured ? "text-white/75" : "text-[#2A211B]/55"}`}>{p.note}</div>
                <ul className="mt-5 space-y-2 text-[14px]">{p.items.map((it) => <li key={it} className="flex items-center gap-2"><Check size={15} className={p.featured ? "text-white" : "text-[#2F7A4A]"} />{it}</li>)}</ul>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section data-section="cta" className="mx-auto max-w-[1100px] px-5 pb-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-[22px] border border-[#7850281f] bg-[radial-gradient(ellipse_at_70%_20%,#FDE4CC,#FBEFE2_45%,#FAF6EF)] px-8 py-16 text-center">
            <span aria-hidden className="absolute top-8 right-12 h-3 w-3 animate-ping rounded-full bg-accent/50 motion-reduce:animate-none" />
            <span aria-hidden className="absolute top-8 right-12 h-3 w-3 rounded-full bg-accent" />
            <h2 className="text-[40px] leading-[1.05] font-semibold tracking-[-0.03em]">Your first 20 meetings,<br /><em className="font-serif font-normal text-accent">without</em> hiring an SDR.</h2>
            <Link href="/overview" className="mt-8 inline-flex items-center gap-2 rounded-[10px] bg-[#2A211B] px-5 py-3.5 text-[15px] font-semibold text-[#FAF6EF] hover:bg-[#2A211B]/85">Try the live demo <ArrowRight size={15} /></Link>
          </div>
        </Reveal>
      </section>

      <footer data-section="footer" className="border-t border-[#7850281a]">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between px-5 py-6 text-[12px] text-[#2A211B]/55">
          <span className="flex items-center gap-1.5 text-[15px] font-semibold text-[#2A211B]"><span className="grid h-5 w-5 place-items-center rounded-[5px] bg-accent text-[11px] font-bold text-white">C</span>Cited</span>
          <span>Cited leads, checked claims, human-approved outreach.</span>
        </div>
      </footer>
    </div>
  );
}
