"use client";
import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { useReducedMotion } from "./motion";

/**
 * The hero: a warm particle graph that plays one 10-second story on a loop.
 * Noise (0–2 s) → Search finds a company (2–4 s) → Cite lights three signals (4–6 s) → Check ticks the draft (6–10 s).
 * Labels are generic on purpose: the live app is where real companies appear.
 */
const LOOP = 10_000;
const CLUSTERS = [
  { x: 0.62, y: 0.28, c: [155, 107, 196], n: 260, sd: 0.07 }, // companies
  { x: 0.86, y: 0.5, c: [79, 143, 192], n: 170, sd: 0.06 }, // people
  { x: 0.48, y: 0.42, c: [232, 150, 58], n: 160, sd: 0.055 }, // signals
  { x: 0.8, y: 0.17, c: [232, 150, 58], n: 90, sd: 0.04 },
  { x: 0.57, y: 0.7, c: [217, 112, 138], n: 130, sd: 0.055 }, // competitors
  { x: 0.93, y: 0.8, c: [155, 107, 196], n: 120, sd: 0.05 },
];
const CENTER = { x: 0.66, y: 0.5 };
const TARGET = { x: 0.62, y: 0.28 };
const SIGNALS = [
  { x: 0.8, y: 0.17, label: "careers page" },
  { x: 0.48, y: 0.42, label: "press release" },
  { x: 0.74, y: 0.36, label: "news" },
];
const GREEN = "47,122,74", VIOLET = "124,58,237", RED = "214,69,69";

function particles() {
  let s = 7;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const g = () => { const u = r() || 1e-9, v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283 * v); };
  const pts: { x: number; y: number; c: number[]; r: number; a: number; ph: number }[] = [];
  for (const k of CLUSTERS) for (let i = 0; i < k.n; i++) pts.push({ x: k.x + g() * k.sd, y: k.y + g() * k.sd, c: k.c, r: r() * 1.7 + 0.5, a: 0.3 + r() * 0.5, ph: r() * 6.28 });
  const edges: [number, number][] = [];
  for (let i = 0; i < 220; i++) edges.push([Math.floor(r() * pts.length), Math.floor(r() * pts.length)]);
  return { pts, edges };
}

export function HeroGraph() {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const mouse = useRef<{ x: number; y: number } | null>(null);
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState(reduced ? 9 : 0);

  useEffect(() => {
    const c = canvas.current, w = wrap.current; if (!c || !w) return;
    const { pts, edges } = particles();
    const ctx = c.getContext("2d")!;
    const t0 = performance.now();
    let raf = 0, W = 0, H = 0, lastPhase = -1;
    const size = () => { const dpr = window.devicePixelRatio || 1; W = w.clientWidth; H = w.clientHeight; c.width = W * dpr; c.height = H * dpr; c.style.width = `${W}px`; c.style.height = `${H}px`; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size();
    const ro = new ResizeObserver(size); ro.observe(w);
    const X = (x: number) => x * W, Y = (y: number) => y * H;
    const ease = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);

    const draw = (now: number) => {
      const t = reduced ? 9000 : (now - t0) % LOOP;
      const ph = Math.floor(t / 1000);
      if (ph !== lastPhase) { lastPhase = ph; setPhase(ph); }
      ctx.clearRect(0, 0, W, H);
      const focus = ease((t - 2000) / 1500);
      const m = mouse.current;

      ctx.lineWidth = 0.5;
      for (const [a, b] of edges) {
        const p = pts[a], q = pts[b];
        ctx.strokeStyle = `rgba(${p.c.join(",")},${0.1 * (1 - focus * 0.5)})`;
        ctx.beginPath(); ctx.moveTo(X(p.x), Y(p.y)); ctx.lineTo(X(q.x), Y(q.y)); ctx.stroke();
      }
      for (const p of pts) {
        let x = X(p.x) + Math.sin(now / 1600 + p.ph) * 2.5, y = Y(p.y) + Math.cos(now / 1900 + p.ph) * 2.5, r = p.r;
        const near = Math.hypot(X(TARGET.x) - X(p.x), Y(TARGET.y) - Y(p.y)) < 70;
        let a = p.a * (near ? 1 : 1 - focus * 0.45);
        if (near && focus > 0) { x += (X(TARGET.x) - x) * 0.25 * focus; y += (Y(TARGET.y) - y) * 0.25 * focus; }
        if (m) { const d = Math.hypot(m.x - x, m.y - y); if (d < 110) { const k = 1 - d / 110; x += (m.x - x) * 0.12 * k; y += (m.y - y) * 0.12 * k; r += 1.6 * k; a = Math.min(1, a + 0.4 * k); } }
        ctx.fillStyle = `rgba(${p.c.join(",")},${a})`;
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill();
      }
      for (const k of CLUSTERS) {
        const g = ctx.createRadialGradient(X(k.x), Y(k.y), 0, X(k.x), Y(k.y), k.sd * W * 2.2);
        g.addColorStop(0, `rgba(${k.c.join(",")},0.14)`); g.addColorStop(1, `rgba(${k.c.join(",")},0)`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X(k.x), Y(k.y), k.sd * W * 2.2, 0, 6.283); ctx.fill();
      }

      // Search: a pulse travels from Cited to the company.
      if (t > 2000 && t < 4000) {
        const k = ease((t - 2000) / 1400);
        const px = X(CENTER.x) + (X(TARGET.x) - X(CENTER.x)) * k, py = Y(CENTER.y) + (Y(TARGET.y) - Y(CENTER.y)) * k;
        ctx.fillStyle = `rgba(${VIOLET},0.9)`; ctx.beginPath(); ctx.arc(px, py, 4, 0, 6.283); ctx.fill();
        ctx.strokeStyle = `rgba(${VIOLET},${0.5 * (1 - k)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(CENTER.x), Y(CENTER.y), 20 + k * 120, 0, 6.283); ctx.stroke();
      }
      if (t > 3200) { ctx.fillStyle = `rgba(${VIOLET},1)`; ctx.beginPath(); ctx.arc(X(TARGET.x), Y(TARGET.y), 6, 0, 6.283); ctx.fill(); }

      // Cite: three signals draw a green edge back to the company, one after another.
      SIGNALS.forEach((s, i) => {
        const k = ease((t - 4000 - i * 550) / 600);
        if (k <= 0) return;
        ctx.strokeStyle = `rgba(${GREEN},0.9)`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(X(TARGET.x), Y(TARGET.y));
        ctx.lineTo(X(TARGET.x) + (X(s.x) - X(TARGET.x)) * k, Y(TARGET.y) + (Y(s.y) - Y(TARGET.y)) * k); ctx.stroke();
        if (k >= 1) { ctx.fillStyle = `rgba(${GREEN},1)`; ctx.beginPath(); ctx.arc(X(s.x), Y(s.y), 5, 0, 6.283); ctx.fill(); }
      });
      // Check: the unsupported claim reaches for evidence and finds none.
      if (t > 7600) {
        const k = ease((t - 7600) / 500);
        ctx.setLineDash([4, 6]); ctx.strokeStyle = `rgba(${RED},0.75)`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(X(CENTER.x), Y(CENTER.y)); ctx.lineTo(X(CENTER.x) + 90 * k, Y(CENTER.y) + 60 * k); ctx.stroke(); ctx.setLineDash([]);
      }
      // Cited node.
      ctx.shadowColor = `rgba(${VIOLET},0.45)`; ctx.shadowBlur = 24;
      ctx.fillStyle = `rgb(${VIOLET})`; ctx.beginPath(); ctx.arc(X(CENTER.x), Y(CENTER.y), 14, 0, 6.283); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = "#fff"; ctx.font = "700 12px Inter, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.fillText("C", X(CENTER.x), Y(CENTER.y) + 4);
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [reduced]);

  const labels = [
    { show: phase >= 3, x: TARGET.x, y: TARGET.y, text: "Company · Tier A", cls: "text-[#7A4E9C]", dy: -30 },
    ...SIGNALS.map((s, i) => ({ show: phase >= 4 + Math.floor((i * 550 + 600) / 1000), x: s.x, y: s.y, text: s.label, cls: "text-[#B7651B]", dy: -28 })),
  ];
  const claims = [
    { ok: true, text: "Saw you're hiring three finance data engineers.", src: "careers page · 0.82", at: 6 },
    { ok: true, text: "Congrats on the $45M Series C.", src: "press release · 0.91", at: 7 },
    { ok: false, text: "Congrats on closing your Series D.", src: "no evidence · blocked · 1.2 ms", at: 8 },
  ];

  return (
    <div ref={wrap} className="absolute inset-0" onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); mouse.current = { x: e.clientX - r.left, y: e.clientY - r.top }; }} onMouseLeave={() => { mouse.current = null; }}>
      <canvas ref={canvas} aria-hidden className="absolute inset-0" />
      {labels.map((l) => (
        <span key={l.text} className={`pointer-events-none absolute -translate-x-1/2 rounded-[6px] border border-[#78502826] bg-white/90 px-2 py-0.5 font-mono text-[11px] shadow-sm transition-all duration-500 ${l.cls} ${l.show ? "opacity-100" : "translate-y-1 opacity-0"}`} style={{ left: `${l.x * 100}%`, top: `calc(${l.y * 100}% + ${l.dy}px)` }}>{l.text}</span>
      ))}
      <div className={`absolute right-[4%] bottom-[6%] hidden w-[min(440px,42%)] rounded-[16px] border border-[#7850281f] bg-white/85 p-4 shadow-[0_30px_70px_rgba(150,90,40,0.18)] backdrop-blur-xl transition-all duration-700 lg:block ${phase >= 5 ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"}`}>
        <div className="font-mono text-[11px] text-[#2A211B]/50">DRAFT → VP Finance</div>
        {claims.map((c) => {
          const on = phase >= c.at;
          return (
            <div key={c.text} className={`mt-2 flex items-start gap-2.5 rounded-[10px] px-3 py-2 text-[13.5px] transition-colors duration-500 ${on ? (c.ok ? "bg-[#2F7A4A]/[0.08]" : "bg-[#D64545]/[0.08]") : "bg-[#2A211B]/[0.03]"}`}>
              <span className={`mt-0.5 transition-opacity duration-300 ${on ? "opacity-100" : "opacity-0"}`}>{c.ok ? <Check size={15} className="text-[#2F7A4A]" /> : <X size={15} className="text-[#D64545]" />}</span>
              <span className={!c.ok && on ? "text-[#2A211B]/55 line-through decoration-[#D64545]" : ""}>{c.text}
                <span className={`mt-0.5 block font-mono text-[10.5px] no-underline transition-opacity duration-300 ${on ? "opacity-100" : "opacity-0"} ${c.ok ? "text-[#2F7A4A]" : "text-[#D64545]"}`}>{c.src}</span>
              </span>
            </div>
          );
        })}
        <div className="mt-3 flex items-center gap-2.5 text-[12px] text-[#2A211B]/50">
          <span className={`rounded-[8px] bg-accent px-3.5 py-2 text-[13px] font-semibold text-white transition-shadow duration-700 ${phase >= 8 ? "shadow-[0_0_0_6px_rgba(124,58,237,0.15)]" : ""}`}>Approve &amp; send</span>waiting for you
        </div>
      </div>
    </div>
  );
}
