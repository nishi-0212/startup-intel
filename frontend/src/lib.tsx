import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";

export type Agent = { status: string; error: string | null; output: any; tools: string[] };
export type Item = { text: string; sources: string[] };
export type Ev = { t: number; agent: string; tool: string | null; msg: string };
export type Report = { executive_summary: string; opportunities: Item[]; risks: Item[]; recommendations: Item[]; missing: string[]; error?: string };
export type Job = {
  id: string; startup: string; objective: string; status: string; error?: string; created: number;
  agents: Record<string, Agent>;
  events: Ev[];
  budget: { calls: number; tokens: number; max_calls: number; max_tokens: number };
  verification: any;
  sources: Record<string, { title: string; date: string | null }>;
  security: { url: string; action: string }[];
  report: Report | null;
};
export type Summary = { id: string; startup: string; status: string; created: number };

export const STEPS = [
  { key: "research", label: "Company profile", short: "Profile", color: "lav", icon: "◎", desc: "Products, geography and business model from official and credible sources." },
  { key: "market", label: "Market signals", short: "Market", color: "sky", icon: "↗", desc: "Dated industry trends, with sourced facts kept apart from estimates." },
  { key: "competitor", label: "Competitors", short: "Competitors", color: "pink", icon: "⇄", desc: "Rivals ranked by threat and prominence, with pricing and positioning." },
  { key: "funding", label: "Funding history", short: "Funding", color: "mint", icon: "₹", desc: "Rounds, amounts and investors on a timeline. Nothing guessed." },
  { key: "verification", label: "Fact-check", short: "Fact-check", color: "butter", icon: "✓", desc: "Flags conflicts, duplicates, unsourced claims and same-name companies." },
  { key: "synthesis", label: "Final report", short: "Report", color: "peach", icon: "¶", desc: "Summary, risks and recommendations, every claim linked to a source." },
];

export const domain = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
export const ago = (t: number) => {
  const s = Date.now() / 1000 - t;
  return s < 60 ? "now" : s < 3600 ? `${Math.floor(s / 60)}m` : s < 86400 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 86400)}d`;
};

const UNITS: Record<string, number> = { k: 1e3, thousand: 1e3, lakh: 1e5, lac: 1e5, lakhs: 1e5, m: 1e6, mn: 1e6, mil: 1e6, mill: 1e6,
  million: 1e6, millions: 1e6, cr: 1e7, crore: 1e7, crores: 1e7, b: 1e9, bn: 1e9, bil: 1e9, billion: 1e9 };

/** One format everywhere (mirrors the backend): "$200M", "$1B", "₹12B". */
export function fmtAmount(a?: string | null, cur?: string | null) {
  if (!a) return null;
  const t = String(a).trim();
  const inr = /₹|\binr\b|\brs\.?|crore|\bcr\b|lakh/i.test(t) || (cur || "").toUpperCase() === "INR";
  const m = t.match(/(\d[\d,]*(?:\.\d+)?)\s*([a-zA-Z]+)?/);
  if (!m) return t;
  let n = Number(m[1].replace(/,/g, ""));
  const unit = (m[2] || "").toLowerCase();
  if (UNITS[unit]) n *= UNITS[unit];
  else if (n < 100000) n *= 1e6; // a bare "83" on a funding round means 83 million
  const sym = inr ? "₹" : "$";
  for (const [div, suf] of [[1e9, "B"], [1e6, "M"], [1e3, "K"]] as const)
    if (n >= div) return `${sym}${parseFloat((n / div).toFixed(2))}${suf}`;
  return `${sym}${n}`;
}

/** Inline [1][2] markers typed into prose; citations are shown as badges instead. */
export const stripCites = (t?: string | null) => (t || "").replace(/\s*(\[\d+(?:\s*[,–-]\s*\d+)*\])+/g, "").trim();

export function stepState(job: Job, key: string) {
  const settled = Object.values(job.agents).every(a => !["pending", "running"].includes(a.status));
  if (key === "verification") return job.verification ? "done" : job.status === "running" ? (settled ? "running" : "pending") : "skipped";
  if (key === "synthesis") return job.report ? (job.report.error ? "failed" : "done") : job.status === "running" ? (job.verification ? "running" : "pending") : "skipped";
  return job.agents[key]?.status ?? "pending";
}

export function friendly(e?: Ev) {
  if (!e) return null;
  const m = e.msg;
  if (/retrying/.test(m)) return "Rate limited, retrying shortly";
  if (/optional source unavailable/.test(m)) return "Optional source skipped";
  if (/enriched/.test(m)) return "Filling in pricing and positioning";
  if (e.tool === "tavily") return "Searching the web";
  if (e.tool === "wikipedia") return "Reading Wikipedia";
  if (e.tool === "hackernews") return "Scanning Hacker News";
  if (e.tool === "groq") return "Extracting facts from sources";
  return null;
}

/** Share of extracted items that carry at least one source URL. */
export function evidenceCoverage(job: Job) {
  let total = 0, sourced = 0;
  const walk = (x: any) => {
    if (Array.isArray(x)) return x.forEach(walk);
    if (x && typeof x === "object") {
      if (Array.isArray(x.sources)) { total++; if (x.sources.length) sourced++; }
      Object.values(x).forEach(walk);
    }
  };
  Object.values(job.agents).forEach(a => a.status === "done" && walk(a.output));
  if (job.report) walk([job.report.opportunities, job.report.risks, job.report.recommendations]);
  return total ? Math.round((sourced / total) * 100) : 0;
}

/** Adds .in to every .reveal element as it scrolls into view. */
export function useReveal(deps: unknown[]) {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal:not(.in)"));
    if (!("IntersectionObserver" in window)) { els.forEach(e => e.classList.add("in")); return; }
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    }), { threshold: 0.08, rootMargin: "0px 0px -30px 0px" });
    els.forEach(e => io.observe(e));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [v, setV] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0, started = false;
    const el = ref.current;
    if (!el) return;
    const run = () => {
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / 1200);
        setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([en]) => { if (en.isIntersecting && !started) { started = true; run(); } });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to]);
  return <span ref={ref}>{v}{suffix}</span>;
}

export function Rotator({ words, every = 2400 }: { words: { text: string; color: string }[]; every?: number }) {
  const [i, setI] = useState(0);
  const [w, setW] = useState<number | undefined>(undefined);
  const refs = useRef<(HTMLSpanElement | null)[]>([]);
  useEffect(() => { const t = setInterval(() => setI(x => (x + 1) % words.length), every); return () => clearInterval(t); }, [words.length, every]);
  useLayoutEffect(() => { const el = refs.current[i]; if (el) setW(el.offsetWidth); }, [i]);
  useEffect(() => { (document as any).fonts?.ready.then(() => { const el = refs.current[0]; if (el) setW(el.offsetWidth); }); }, []);
  const prev = (i - 1 + words.length) % words.length;
  return (
    <span className="rotator" style={{ width: w }} aria-live="polite">
      {words.map((wd, n) => (
        <span key={wd.text} ref={el => { refs.current[n] = el; }} className={`rw ${wd.color} ${n === i ? "on" : n === prev ? "off" : ""}`}>{wd.text}</span>
      ))}
    </span>
  );
}

/** Cursor-following highlight for cards (reads --mx/--my in CSS). */
export function spot(e: MouseEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
}

export function Cite({ urls }: { urls?: string[] }) {
  if (!urls?.length) return null;
  return <span className="cites">{urls.map((u, i) => (
    <a key={u} className="cite" href={u} target="_blank" rel="noreferrer" title={domain(u)}>{i + 1}</a>
  ))}</span>;
}

export function StatusIcon({ s }: { s: string }) {
  if (s === "running") return <span className="spin" />;
  return <span className={`sicon ${s}`}>{s === "done" || s === "completed" ? "✓" : s === "failed" ? "!" : s === "skipped" || s === "partial" ? "–" : ""}</span>;
}