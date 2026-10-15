import { useEffect, useState } from "react";
import Home from "./Home";
import Pipeline from "./Pipeline";
import ReportView from "./Report";
import { STEPS, StatusIcon, ago, stepState } from "./lib";
import type { Job, Summary } from "./lib";

type Theme = "system" | "light" | "dark";

// Backend base URL: empty in local dev (Vite proxies /api), the Render URL in production (set VITE_API_URL on Vercel).
const API = ((import.meta as any).env?.VITE_API_URL ?? "").replace(/\/$/, "");

/** A little personality for each agent while it works. Lines rotate every few seconds. */
const QUIPS: Record<string, { running: string[]; done: string }> = {
  research: { running: ["Stalking their socials", "Reading their About page so you don't have to", "Googling harder than an intern on day one"], done: "Got the full backstory" },
  market: { running: ["Skimming market reports nobody finishes", "Separating real numbers from pitch-deck numbers", "Asking Hacker News for its hot take"], done: "Market mapped" },
  competitor: { running: ["Finding out who they're scared of", "Checking who's eating their lunch", "Comparing delivery fees, obsessively"], done: "Rivals spotted" },
  funding: { running: ["Following the money", "Counting other people's crores", "Reading term-sheet gossip"], done: "Money trail found" },
  verification: { running: ["Cross-examining every source", "Catching sources that disagree", "Playing devil's advocate"], done: "Facts double-checked" },
  synthesis: { running: ["Turning 60 tabs into one page", "Brewing the final report ☕", "Polishing the last paragraph"], done: "Served hot" },
};

function RunView({ job }: { job: Job }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const done = STEPS.filter(s => ["done", "failed", "skipped"].includes(stepState(job, s.key))).length;
  const secs = Math.max(0, Math.floor(now / 1000 - job.created));
  const pending = job.id === "pending";
  const AGENT_KEYS = ["research", "market", "competitor", "funding"];
  const stateOf = (k: string) => (pending && AGENT_KEYS.includes(k) ? "running" : stepState(job, k));
  const tick = Math.floor(now / 3200);
  const quip = (k: string, st: string, i: number) =>
    st === "running" ? (pending ? "Stretching before the sprint" : QUIPS[k].running[(tick + i) % QUIPS[k].running.length])
      : st === "done" ? QUIPS[k].done : st === "failed" ? "Couldn't crack this one" : st === "skipped" ? "Sat this one out" : "Waiting for its turn";
  return (
    <div className="run">
      <div className="glow soft" />
      <div className="eyebrow-pill rise"><span className="live" />{job.id === "pending" ? "Starting agents…" : `Researching · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`}</div>
      <h1 className="run-title rise" style={{ ["--d" as string]: "60ms" }}>Digging into <span className="shimmer">{job.startup}</span></h1>
      <p className="sub rise" style={{ ["--d" as string]: "120ms" }}>Six agents, one startup, zero guesswork. Put the kettle on, this takes about a minute.</p>
      <div className="showcase big rise" style={{ ["--d" as string]: "180ms" }}>
        <Pipeline state={stateOf} />
        <div className="track"><div style={{ width: `${(done / STEPS.length) * 100}%` }} /></div>
      </div>
      <div className="run-rows">
        {STEPS.map((s, i) => {
          const st = stateOf(s.key);
          return (
            <div key={s.key} className={`run-row ${st} rise`} style={{ ["--d" as string]: `${240 + i * 50}ms` }}>
              <StatusIcon s={st} />
              <span className={`bullet ${s.color}`} />
              <span className="row-title">{s.label}</span>
              <span key={quip(s.key, st, i)} className="row-meta">{quip(s.key, st, i)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function App() {
  const [job, setJob] = useState<Job | null>(null);
  const [past, setPast] = useState<Summary[]>([]);
  const [err, setErr] = useState("");
  const [theme, setTheme] = useState<Theme>(() => { try { return (localStorage.getItem("theme") as Theme) || "dark"; } catch { return "dark"; } });

  useEffect(() => {
    const el = document.documentElement;
    if (theme === "system") el.removeAttribute("data-theme"); else el.setAttribute("data-theme", theme);
    try { localStorage.setItem("theme", theme); } catch { /* storage unavailable */ }
  }, [theme]);

  const loadPast = () => fetch(API + "/api/jobs").then(r => r.json()).then(setPast).catch(() => {});
  useEffect(() => { loadPast(); }, []);

  useEffect(() => {
    if (!job || job.status !== "running" || job.id === "pending") return;
    const t = setInterval(async () => {
      const r = await fetch(`${API}/api/jobs/${job.id}`);
      if (r.ok) { const j = await r.json(); setJob(j); if (j.status !== "running") loadPast(); }
    }, 1500);
    return () => clearInterval(t);
  }, [job?.id, job?.status]);

  const open = async (id: string) => {
    const r = await fetch(`${API}/api/jobs/${id}`);
    if (r.ok) { setJob(await r.json()); window.scrollTo({ top: 0 }); }
  };

  const start = async (name: string, objective: string) => {
    setErr("");
    // Show the research screen instantly while the backend spins up the job.
    const agents = Object.fromEntries(["research", "market", "competitor", "funding"].map(k => [k, { status: "pending", error: null, output: null, tools: [] }]));
    setJob({ id: "pending", startup: name.trim(), objective, status: "running", created: Date.now() / 1000, agents, events: [],
      budget: { calls: 0, tokens: 0, max_calls: 0, max_tokens: 0 }, verification: null, sources: {}, security: [], report: null });
    window.scrollTo({ top: 0 });
    try {
      const r = await fetch(API + "/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ startup: name, objective: objective || "general overview" }) });
      if (!r.ok) { setJob(null); setErr((await r.json()).detail ?? "Could not start research"); return; }
      await open((await r.json()).id); loadPast();
    } catch { setJob(null); setErr("Can't reach the backend. If it was idle it may be waking up, so try again in about 30 seconds."); }
  };

  const [removing, setRemoving] = useState<string | null>(null);
  const remove = async (id: string) => {
    setRemoving(id);                                   // play the exit animation first
    await new Promise(r => setTimeout(r, 220));
    const r = await fetch(`${API}/api/jobs/${id}`, { method: "DELETE" });
    setRemoving(null);
    if (r.ok) { setPast(ps => ps.filter(p => p.id !== id)); if (job?.id === id) setJob(null); }
  };
  const clearAll = async () => {
    if (!window.confirm("Delete all finished research from history?")) return;
    await fetch(API + "/api/jobs", { method: "DELETE" });
    if (job && job.status !== "running") setJob(null);
    loadPast();
  };

  const resume = async () => { await fetch(`${API}/api/jobs/${job!.id}/resume`, { method: "POST" }); open(job!.id); };
  const exportMd = async () => {
    const txt = await (await fetch(`${API}/api/jobs/${job!.id}/export`)).text();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([txt], { type: "text/markdown" }));
    a.download = `${job!.startup}-intelligence-report.md`; a.click();
  };

  // the run view keeps one key so swapping the placeholder for the real job doesn't replay the entrance animation
  const view = !job ? "home" : job.status === "running" ? "run" : `report-${job.id}`;

  return (
    <div className="app">
      <aside className="sidebar">
        <button className="brand" onClick={() => setJob(null)}><img className="mark" src="/favicon.svg" alt="" /> Startup Intel</button>
        <button className="new-btn" onClick={() => setJob(null)}><span>＋</span> New research</button>
        <div className="side-label"><span>Recent</span>
          {past.some(p => p.status !== "running") && <button className="side-clear" onClick={clearAll}>Clear all</button>}
        </div>
        <div className="history">
          {past.length === 0 && <div className="side-empty">Your research will show up here</div>}
          {past.map(p => (
            <div key={p.id} className={`h-row ${job?.id === p.id ? "active" : ""} ${removing === p.id ? "leaving" : ""}`}>
              <button className="h-item" onClick={() => open(p.id)}>
                <span className={`sdot ${p.status}`} />
                <span className="h-name">{p.startup}</span>
                <span className="h-time">{ago(p.created)}</span>
              </button>
              {p.status !== "running" && <button className="h-del" title="Delete" aria-label={`Delete ${p.startup}`} onClick={() => remove(p.id)}>×</button>}
            </div>
          ))}
        </div>
        <div className="theme-switch" role="group" aria-label="Theme">
          {(["system", "light", "dark"] as Theme[]).map(t => (
            <button key={t} className={theme === t ? "on" : ""} onClick={() => setTheme(t)}>{t === "system" ? "Auto" : t === "light" ? "Light" : "Dark"}</button>
          ))}
        </div>
      </aside>

      <main className="main">
        <div key={view} className="view">
          {!job && <Home onStart={start} error={err} />}
          {job && job.status === "running" && <RunView job={job} />}
          {job && job.status !== "running" && <ReportView job={job} onExport={exportMd} onRetry={resume} />}
        </div>
      </main>
    </div>
  );
}