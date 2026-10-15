import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { stripCites, Cite, CountUp, evidenceCoverage, fmtAmount, domain, spot, StatusIcon, useReveal } from "./lib";
import type { Agent, Item, Job } from "./lib";

const SECTIONS = [
  { id: "summary", label: "Summary" }, { id: "facts", label: "Key facts" }, { id: "market", label: "Market" },
  { id: "competitors", label: "Competitors" }, { id: "funding", label: "Funding" }, { id: "insights", label: "Insights" },
  { id: "sources", label: "Sources" },
];

function Section({ id, title, color, aside, children }: { id: string; title: string; color: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="r-sec">
      <div className="r-sec-head reveal"><span className={`bullet ${color}`} /><h2>{title}</h2>{aside && <span className="r-aside">{aside}</span>}</div>
      {children}
    </section>
  );
}

function useScrollSpy(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && setActive(e.target.id)), { rootMargin: "-35% 0px -60% 0px" });
    ids.forEach(id => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [ids.join()]);
  return active;
}

function Ring({ value, max, color }: { value: number; max: number; color: string }) {
  const c = 2 * Math.PI * 19;
  return (
    <svg className={`ring pe-${color}`} viewBox="0 0 48 48" style={{ ["--off" as string]: `${c * (1 - value / max)}`, ["--c-len" as string]: `${c}` }}>
      <circle className="ring-bg" cx="24" cy="24" r="19" />
      <circle className="ring-fg" cx="24" cy="24" r="19" strokeDasharray={c} />
      <text x="24" y="28.5" textAnchor="middle">{value}</text>
    </svg>
  );
}

const threatColor = (t?: string) => (t === "high" ? "pink" : t === "medium" ? "peach" : "sky");

export default function ReportView({ job, onExport, onRetry }: { job: Job; onExport: () => void; onRetry: () => void }) {
  const research = job.agents.research?.output ?? {};
  const comps: any[] = job.agents.competitor?.output?.competitors ?? [];
  const rounds: any[] = job.agents.funding?.output?.rounds ?? [];
  const trends: any[] = job.agents.market?.output?.trends ?? [];
  const v = job.verification ?? {};
  const r = job.report;
  const sources = useMemo(() => Object.entries(job.sources ?? {}), [job.sources]);
  const coverage = useMemo(() => evidenceCoverage(job), [job]);
  const maxMentions = Math.max(1, ...comps.map(c => c.mentions ?? 0));
  const [filter, setFilter] = useState<"all" | "fact" | "estimate">("all");
  const [allSources, setAllSources] = useState(false);
  const hasInsights = !!r && (r.opportunities.length + r.risks.length + r.recommendations.length) > 0;
  const show: Record<string, boolean> = {
    summary: true, facts: !!(research.claims?.length || research.business_model), market: trends.length > 0,
    competitors: comps.length > 0, funding: rounds.length > 0 || !!v.conflicts?.length, insights: hasInsights, sources: true,
  };
  const sections = SECTIONS.filter(s => show[s.id]);
  const active = useScrollSpy(sections.map(s => s.id));
  useReveal([job.id, filter, allSources]);

  const tagline = (research.description ?? "").split(/(?<=\.)\s/)[0];
  const shownTrends = trends.filter(t => filter === "all" || t.type === filter);
  const geo = research.geography ? String(research.geography).split(/[(,]/)[0].trim() : null;
  const date = new Date(job.created * 1000).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="report">
      <header className="r-hero">
        <div className="glow soft" />
        <div className="r-hero-top rise">
          <span className="eyebrow-pill"><StatusIcon s={job.status} />Intelligence report · {date}</span>
          <div className="actions">
            {(job.status === "partial" || job.status === "failed") && <button className="btn" onClick={onRetry}>Retry failed steps</button>}
            {r && <button className="btn primary" onClick={onExport}>Export ↓</button>}
          </div>
        </div>
        <h1 className="r-name rise" style={{ ["--d" as string]: "60ms" }}>{job.startup}</h1>
        {tagline && <p className="r-tagline rise" style={{ ["--d" as string]: "120ms" }}>{tagline}</p>}
        <div className="r-chips rise" style={{ ["--d" as string]: "180ms" }}>
          {research.founded_year && <span className="chip"><span className="bullet lav" />Founded {research.founded_year}</span>}
          {geo && <span className="chip"><span className="bullet sky" />{geo}</span>}
          {job.objective && job.objective !== "general overview" && <span className="chip"><span className="bullet peach" />Focus: {job.objective}</span>}
        </div>
        <div className="r-stats">
          {[
            { n: comps.length, label: "competitors mapped", c: "pink" },
            { n: rounds.length, label: "funding rounds", c: "mint" },
            { n: sources.length, label: "sources read", c: "sky" },
            { n: coverage, label: "claims with a source", c: "lav", suffix: "%" },
          ].map((s, i) => (
            <div key={s.label} className={`r-stat rise ${s.c}-edge`} style={{ ["--d" as string]: `${240 + i * 70}ms` }} onMouseMove={spot}>
              <div className="r-num"><CountUp to={s.n} suffix={s.suffix} /></div>
              <div className="muted">{s.label}</div>
            </div>
          ))}
        </div>
      </header>

      {job.status === "partial" && <div className="note warn reveal">{job.error ?? <>Some steps couldn't finish. Everything shown is still backed by sources; see <b>Sources → Gaps</b>.</>}
        <button className="link-btn" style={{ marginLeft: 8 }} onClick={onRetry}>Retry ↻</button></div>}
      {job.status === "failed" && <div className="note bad reveal">Research couldn't complete. {job.error ?? "Every agent failed; check your API keys."}</div>}

      <div className="r-layout">
        <nav className="r-nav">
          {sections.map(s => (
            <a key={s.id} href={`#${s.id}`} className={active === s.id ? "on" : ""}
              onClick={e => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
              {s.label}
            </a>
          ))}
        </nav>

        <div className="r-content">
          <Section id="summary" title="Summary" color="lav">
            <p className="r-summary reveal">{stripCites(r?.executive_summary) || research.description || "No summary available."}</p>
            {r?.error && (
              <div className="note soft reveal">This summary was assembled straight from the verified findings because the AI writer hit a limit.
                <button className="link-btn" onClick={onRetry}>Regenerate the full report ↻</button></div>
            )}
            {(v.conflicts?.length > 0) && (
              <div className="note warn reveal">⚠ {v.conflicts.length} conflicting report{v.conflicts.length > 1 ? "s" : ""} found. See <b>Funding</b>.</div>
            )}
          </Section>

          {show.facts && (
          <Section id="facts" title="Key facts" color="sky" aside={research.business_model ? undefined : null}>
            <div className="facts-grid">
              {(research.claims ?? []).map((c: Item, i: number) => (
                <div key={i} className="fact reveal" style={{ ["--d" as string]: `${(i % 4) * 60}ms` }} onMouseMove={spot}>
                  <span className="fact-n mono">{String(i + 1).padStart(2, "0")}</span>
                  <span>{c.text}<Cite urls={c.sources} /></span>
                </div>
              ))}
            </div>
            {research.business_model && (
              <div className="model reveal"><span className="label lav">Business model</span>{research.business_model}</div>
            )}
            {research.products?.length > 0 && (
              <div className="tags reveal">{research.products.map((p: string) => <span key={p} className="tag">{p}</span>)}</div>
            )}
          </Section>)}

          {show.market && (
          <Section id="market" title="Market signals" color="sky" aside={
            <span className="seg">{(["all", "fact", "estimate"] as const).map(f => (
              <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>{f === "all" ? "All" : f === "fact" ? "Facts" : "Estimates"}</button>
            ))}</span>
          }>
            {shownTrends.length === 0 ? <p className="nf reveal">No market signals found.</p> : (
              <div className="signals">
                {shownTrends.map((t, i) => (
                  <div key={`${filter}-${i}`} className="signal reveal" style={{ ["--d" as string]: `${(i % 5) * 50}ms` }}>
                    <span className="sig-date mono">{t.date ?? "undated"}</span>
                    <span className={`label ${t.type === "fact" ? "mint" : "peach"}`}>{t.type === "fact" ? "Fact" : "Estimate"}</span>
                    <span className="sig-text">{t.text}<Cite urls={t.sources} /></span>
                  </div>
                ))}
              </div>
            )}
          </Section>)}

          {show.competitors && (
          <Section id="competitors" title="Competitors" color="pink" aside={<span className="muted small">Sorted by who keeps {job.startup} up at night</span>}>
            {comps.length === 0 && <p className="nf reveal">No competitor data found.</p>}
            <div className="comp-list">
              {comps.map((c, i) => {
                const facts = [["Market share", c.market_share, "sky"], ["Users", c.users, "mint"], ["Pricing", c.pricing, "peach"],
                  ["Positioning", c.positioning, "lav"], ["Customers", c.target_customers, "butter"]].filter(([, v]) => v);
                return (
                  <article key={i} className="comp-card wide reveal" style={{ ["--d" as string]: `${i * 80}ms` }} onMouseMove={spot}>
                    <div className="cw-left">
                      <span className="cc-rank mono">#{i + 1}</span>
                      <div className="cc-name">{c.name}</div>
                      <span className={`label ${threatColor(c.threat)}`}>{c.threat ?? "unrated"} threat</span>
                      <div className="cc-ring"><Ring value={c.mentions ?? 0} max={maxMentions} color={threatColor(c.threat)} /><span className="muted small">sources<br />mention them</span></div>
                    </div>
                    <div className="cw-right">
                      <p className="cw-how">{c.how_they_compete ?? c.why}<Cite urls={c.sources} /></p>
                      {c.edge && <div className="cw-edge"><span className="cw-k">Their edge</span>{c.edge}</div>}
                      {facts.length > 0 && (
                        <div className="cw-facts">
                          {facts.map(([k, v, col]) => (
                            <div key={k} className="cw-fact"><span className="cw-k"><span className={`bullet ${col}`} />{k}</span><span>{v}</span></div>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </Section>)}

          {show.funding && (
          <Section id="funding" title="Funding history" color="mint">
            {v.conflicts?.map((c: any, i: number) => (
              <div className="note warn reveal" key={i}><b>Conflicting reports · {c.round}</b><br />
                {c.reported.map((x: any) => fmtAmount(x.amount, x.currency)).join("  vs  ")}. {c.note ?? "Needs review."}</div>
            ))}
            {rounds.length === 0 ? <p className="nf reveal">No publicly reported funding found. Nothing has been guessed.</p> : (
              <div className="timeline reveal">
                <span className="tl-line" />
                {rounds.map((x, i) => (
                  <div key={i} className="tl reveal" style={{ ["--d" as string]: `${i * 80}ms` }}>
                    <span className="tl-dot" />
                    <div className="tl-date mono">{x.date ?? "Undated"}{["article_date", "url_date"].includes(x.date_basis) && <span className="approx" title="Date taken from the article, not stated in it"> ~approx</span>}</div>
                    <div className="tl-card" onMouseMove={spot}>
                      <div className="tl-row">
                        <span className="tl-round">{x.round || "Funding round"}{!x.investors?.length && <Cite urls={x.sources} />}</span>
                        {x.amount && <span className="tl-amt">{fmtAmount(x.amount, x.currency)}</span>}
                      </div>
                      {x.investors?.length > 0 && <div className="tl-inv">
                        {x.investors.map((n: string) => <span key={n} className="tag">{n}</span>)}
                        <Cite urls={x.sources} />
                      </div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {v.excluded?.length > 0 && (
              <details className="excluded reveal">
                <summary>{v.excluded.length} round{v.excluded.length > 1 ? "s" : ""} excluded: likely a different company with the same name</summary>
                <ul>{v.excluded.map((e: any, i: number) => <li key={i}>{e.round || "Unnamed round"} · {e.date}<Cite urls={e.sources} /></li>)}</ul>
              </details>
            )}
          </Section>)}

          {show.insights && (
          <Section id="insights" title="Insights" color="peach">
            <div className="insights">
              {([["opportunities", "Opportunities", "mint", "↗"], ["risks", "Risks", "pink", "!"], ["recommendations", "Recommendations", "lav", "→"]] as const).map(([k, label, color, icon], i) => (
                <div key={k} className={`insight reveal ${color}-edge`} style={{ ["--d" as string]: `${i * 90}ms` }} onMouseMove={spot}>
                  <div className="ins-head"><span className={`ficon ${color}`}>{icon}</span>{label}<span className="muted">{r?.[k]?.length ?? 0}</span></div>
                  {r?.[k]?.length ? <ul>{r[k].map((it, n) => <li key={n}>{stripCites(it.text)}<Cite urls={it.sources} /></li>)}</ul> : <p className="nf">None generated.</p>}
                </div>
              ))}
            </div>
          </Section>)}

          <Section id="sources" title="Sources & fact-check" color="butter">
            <div className="checks reveal">
              {[
                [sources.length, "sources read"], [v.duplicate_sources_removed ?? 0, "duplicates removed"],
                [v.unsupported?.length ?? 0, "unsourced claims"], [v.conflicts?.length ?? 0, "conflicts"],
                [job.security.length, "injections blocked"],
              ].map(([n, l]) => <div key={l as string} className="check"><b>{n}</b><span className="muted">{l}</span></div>)}
            </div>
            {(r?.missing?.length || r?.error) ? (
              <div className="gaps reveal"><b>Gaps</b><ul>{r?.error && <li>{r.error}</li>}{r?.missing.map((m, i) => <li key={i}>{m}</li>)}</ul></div>
            ) : null}
            <div className="src-list reveal">
              {(allSources ? sources : sources.slice(0, 8)).map(([u, s], i) => (
                <a className="src" key={u} href={u} target="_blank" rel="noreferrer">
                  <span className="muted mono">{String(i + 1).padStart(2, "0")}</span>
                  <span className="src-title">{s.title || u}</span>
                  <span className="muted small">{domain(u)}</span>
                </a>
              ))}
              {sources.length > 8 && <button className="src-more" onClick={() => setAllSources(!allSources)}>{allSources ? "Show fewer" : `Show all ${sources.length} sources`}</button>}
            </div>
            <details className="dev reveal">
              <summary>Developer details <span className="muted">· agents, tools, budget, log</span></summary>
              <div className="muted small">API calls {job.budget.calls}/{job.budget.max_calls} · LLM tokens {job.budget.tokens}/{job.budget.max_tokens} · job {job.id}</div>
              <div className="dev-agents">{Object.entries(job.agents).map(([n, a]: [string, Agent]) => (
                <div key={n} className="dev-agent"><StatusIcon s={a.status} /><b>{n}</b><span className="muted small">{a.tools.join(", ") || "-"}</span>{a.error && <div className="small err">{a.error}</div>}</div>
              ))}</div>
              <div className="log mono">{job.events.map((e, i) => <div key={i}><span className="muted">{e.agent}{e.tool ? `/${e.tool}` : ""}</span> {e.msg}</div>)}</div>
            </details>
          </Section>
        </div>
      </div>
    </div>
  );
}