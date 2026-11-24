"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";

/**
 * The knowledge graph as a network, styled after a Gephi ForceAtlas2 render: fine edges that take the
 * colors of the nodes they join, clusters that settle on load, and a query's matches lit up with a pulse.
 */
export interface NetNode { id: string; label: string; props: Record<string, string | number | boolean | null> }
export interface NetEdge { type: string; from: string; to: string }

export const LABEL_COLOR: Record<string, string> = {
  Company: "#7C3AED", Person: "#0284C7", Signal: "#D97706", Competitor: "#E11D48", Team: "#059669", School: "#0D9488", Product: "#14161A",
};
const HEIGHT = 440;

interface P { x: number; y: number; born: number }

export function GraphNetwork({ nodes, edges, highlight }: { nodes: NetNode[]; edges: NetEdge[]; highlight: Set<string> | null }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const positions = useRef(new Map<string, P>());
  const tiers = useRef(new Map<string, { tier: unknown; changedAt: number }>());
  const [width, setWidth] = useState(800);
  const [hover, setHover] = useState<{ n: NetNode; x: number; y: number } | null>(null);
  const view = useRef({ scale: 1, ox: 0, oy: 0 });

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const degree = useMemo(() => {
    const d = new Map<string, number>();
    for (const e of edges) { d.set(e.from, (d.get(e.from) ?? 0) + 1); d.set(e.to, (d.get(e.to) ?? 0) + 1); }
    return d;
  }, [edges]);

  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(320, e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Lay out with ForceAtlas2, keeping nodes we already placed so a refresh only settles what is new.
  const [layoutTick, setLayoutTick] = useState(0);
  useEffect(() => {
    const g = new Graph({ multi: false, type: "undirected" });
    const now = performance.now();
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const n of nodes) {
      const old = positions.current.get(n.id);
      g.addNode(n.id, { x: old?.x ?? (rnd() - 0.5) * 100, y: old?.y ?? (rnd() - 0.5) * 100 });
      if (!old) positions.current.set(n.id, { x: 0, y: 0, born: now });
      if (n.label === "Company") {
        const t = tiers.current.get(n.id);
        if (t && t.tier !== n.props.tier) tiers.current.set(n.id, { tier: n.props.tier, changedAt: now });
        else if (!t) tiers.current.set(n.id, { tier: n.props.tier, changedAt: 0 });
      }
    }
    for (const e of edges) if (g.hasNode(e.from) && g.hasNode(e.to) && e.from !== e.to && !g.hasEdge(e.from, e.to)) g.addEdge(e.from, e.to);
    const settings = { ...forceAtlas2.inferSettings(g), linLogMode: true, gravity: 1.2, scalingRatio: 8, slowDown: 2 };
    let frame = 0, raf = 0;
    const step = () => {
      forceAtlas2.assign(g, { iterations: 12, settings });
      g.forEachNode((id, a) => { const p = positions.current.get(id)!; p.x = a.x; p.y = a.y; });
      setLayoutTick((t) => t + 1);
      if (++frame < 30) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    for (const id of [...positions.current.keys()]) if (!g.hasNode(id)) positions.current.delete(id);
    return () => cancelAnimationFrame(raf);
  }, [nodes, edges]);

  // Draw. Runs every frame while something moves (layout, a highlight pulse, new nodes fading in).
  useEffect(() => {
    const c = canvas.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = width * dpr; c.height = HEIGHT * dpr;
    const ctx = c.getContext("2d")!;
    let raf = 0;
    const draw = (t: number) => {
      const pts = [...positions.current.values()];
      if (!pts.length) return;
      const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
      const pad = 40, scale = Math.min((width - pad * 2) / Math.max(1, maxX - minX), (HEIGHT - pad * 2) / Math.max(1, maxY - minY));
      const ox = (width - (maxX - minX) * scale) / 2 - minX * scale, oy = (HEIGHT - (maxY - minY) * scale) / 2 - minY * scale;
      view.current = { scale, ox, oy };
      const P = (id: string) => { const p = positions.current.get(id); return p ? { x: p.x * scale + ox, y: p.y * scale + oy, born: p.born } : null; };
      const fade = (born: number) => Math.min(1, (t - born) / 700);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, HEIGHT);
      const hl = highlight && highlight.size ? highlight : null;

      for (const e of edges) {
        const a = P(e.from), b = P(e.to); if (!a || !b) continue;
        const on = hl ? hl.has(e.from) && hl.has(e.to) : false;
        const alpha = (hl ? (on ? 0.9 : 0.05) : 0.32) * Math.min(fade(a.born), fade(b.born));
        const ca = color(byId.get(e.from)), cb = color(byId.get(e.to));
        const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        grad.addColorStop(0, rgba(ca, alpha)); grad.addColorStop(1, rgba(cb, alpha));
        ctx.strokeStyle = grad; ctx.lineWidth = on ? 2 : 0.8;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        if (on) {
          const k = ((t / 1400) + (e.from.length % 7) / 7) % 1;
          ctx.fillStyle = rgba(ca, 0.95);
          ctx.beginPath(); ctx.arc(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, 2.6, 0, Math.PI * 2); ctx.fill();
        }
      }
      for (const n of nodes) {
        const p = P(n.id); if (!p) continue;
        const r = radius(n, degree.get(n.id) ?? 0);
        const on = hl ? hl.has(n.id) : true;
        const a = (on ? 1 : 0.15) * fade(p.born);
        const col = n.label === "Company" && n.props.excluded ? "#9CA3AF" : color(n);
        if (on && hl) { ctx.fillStyle = rgba(col, 0.18); ctx.beginPath(); ctx.arc(p.x, p.y, r + 6, 0, Math.PI * 2); ctx.fill(); }
        const tc = tiers.current.get(n.id);
        if (tc?.changedAt && t - tc.changedAt < 2400) {
          const k = ((t - tc.changedAt) % 800) / 800;
          ctx.strokeStyle = rgba(col, 0.6 * (1 - k)); ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(p.x, p.y, r + 4 + k * 14, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.fillStyle = rgba(col, a); ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = rgba("#ffffff", a); ctx.lineWidth = 1; ctx.stroke();
        const showLabel = (hl ? on : n.label === "Product" || (n.label === "Company" && (n.props.tier === "A" || n.props.tier === "B") && !n.props.excluded)) && a > 0.5;
        if (showLabel) {
          ctx.font = "500 11px Inter, system-ui, sans-serif"; ctx.fillStyle = rgba("#14161A", 0.85); ctx.textAlign = "center";
          ctx.fillText(name(n).slice(0, 28), p.x, p.y - r - 5);
        }
      }
      const moving = hl || pts.some((p) => t - p.born < 800) || [...tiers.current.values()].some((x) => x.changedAt && t - x.changedAt < 2400);
      if (moving) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [width, nodes, edges, highlight, byId, degree, layoutTick]);

  const onMove = (e: React.MouseEvent) => {
    const rect = canvas.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const { scale, ox, oy } = view.current;
    let best: { n: NetNode; d: number; x: number; y: number } | null = null;
    for (const n of nodes) {
      const p = positions.current.get(n.id); if (!p) continue;
      const x = p.x * scale + ox, y = p.y * scale + oy, d = Math.hypot(x - mx, y - my);
      if (d < radius(n, degree.get(n.id) ?? 0) + 6 && (!best || d < best.d)) best = { n, d, x, y };
    }
    setHover(best ? { n: best.n, x: best.x, y: best.y } : null);
  };
  const onClick = () => { const u = hover?.n.props.url; if (typeof u === "string") window.open(u, "_blank", "noopener"); };

  return (
    <div ref={wrap} className="relative w-full" style={{ height: HEIGHT }}>
      <canvas ref={canvas} style={{ width, height: HEIGHT }} className={hover?.n.props.url ? "cursor-pointer" : ""} onMouseMove={onMove} onMouseLeave={() => setHover(null)} onClick={onClick} aria-label="Knowledge graph network" role="img" />
      {hover && (
        <div className="pointer-events-none absolute z-10 max-w-[260px] -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-[6px] bg-ink px-2.5 py-1.5 text-[12px] text-white shadow-lg" style={{ left: hover.x, top: hover.y }}>
          <div className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: color(hover.n) }} /><span className="text-white/60">{hover.n.label}</span></div>
          <div className="font-medium">{name(hover.n)}</div>
          {detail(hover.n) && <div className="text-white/70">{detail(hover.n)}</div>}
          {typeof hover.n.props.url === "string" && <div className="mt-0.5 truncate font-mono text-[10px] text-white/60">{hostOf(hover.n.props.url)} · click to open</div>}
        </div>
      )}
    </div>
  );
}

const color = (n?: NetNode) => (n ? LABEL_COLOR[n.label] ?? "#6B7280" : "#6B7280");
const name = (n: NetNode) => String(n.props.name ?? n.props.summary ?? n.id);
const detail = (n: NetNode) => n.label === "Company" && n.props.tier ? `Tier ${n.props.tier} · score ${n.props.score}` : n.label === "Person" ? String(n.props.title ?? "") : n.label === "Team" ? String(n.props.role ?? "") : n.label === "Signal" ? String(n.props.type ?? "").replace(/_/g, " ") : "";
const radius = (n: NetNode, deg: number) => n.label === "Product" ? 9 : n.label === "Company" && typeof n.props.score === "number" ? 4 + n.props.score / 14 : 3 + Math.min(3, deg * 0.5);
const hostOf = (u: string) => { try { return new URL(u).hostname; } catch { return u; } };
function rgba(hex: string, a: number) {
  const h = hex.replace("#", ""); const v = parseInt(h, 16);
  return `rgba(${(v >> 16) & 255},${(v >> 8) & 255},${v & 255},${a})`;
}
