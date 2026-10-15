import { useState } from "react";
import Pipeline from "./Pipeline";
import { Rotator, STEPS, spot } from "./lib";

const WORDS = [
  { text: "Zepto", color: "lav" }, { text: "Razorpay", color: "mint" }, { text: "CRED", color: "peach" },
  { text: "Groww", color: "sky" }, { text: "Swiggy", color: "pink" },
];
const EXAMPLES = ["Zepto", "Razorpay", "CRED", "Groww"];

export default function Home({ onStart, error }: { onStart: (name: string, objective: string) => void; error: string }) {
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  return (
    <section className="home">
      <div className="glow" />
      <div className="eyebrow-pill rise" style={{ ["--d" as string]: "0ms" }}><span className="live" />Six agents · live web sources · every claim cited</div>
      <h1 className="hero-title rise" style={{ ["--d" as string]: "80ms" }}>
        <span className="hero-line">Know <Rotator words={WORDS} /> inside out,</span>
        <span className="hero-line hero-fade">before your chai gets cold.</span>
      </h1>
      <p className="sub rise" style={{ ["--d" as string]: "160ms" }}>
        Name a startup. Our agents scour the web in parallel, fact-check each other, and hand you a sourced dossier in about a minute.
      </p>
      <form className="command rise" style={{ ["--d" as string]: "240ms" }} onSubmit={e => { e.preventDefault(); if (name.trim()) onStart(name, objective); }}>
        <span className="cmd-icon">⌕</span>
        <input autoFocus placeholder="Which startup?" value={name} onChange={e => setName(e.target.value)} />
        <input className="obj" placeholder="Focus (optional)" value={objective} onChange={e => setObjective(e.target.value)} />
        <button className="btn primary">Research <kbd>↵</kbd></button>
      </form>
      <div className="examples rise" style={{ ["--d" as string]: "320ms" }}>
        <span className="muted">Try</span>
        {EXAMPLES.map((x, i) => (
          <button key={x} className="ex" onClick={() => onStart(x, objective)}>
            <span className={`bullet ${["lav", "mint", "peach", "sky"][i]}`} />{x}
          </button>
        ))}
      </div>
      {error && <div className="note bad">{error}</div>}

      <div className="showcase rise" style={{ ["--d" as string]: "420ms" }} onMouseMove={spot}>
        <div className="showcase-head">
          <span className="dots"><i /><i /><i /></span>
          <span className="muted small">How a research run flows</span>
        </div>
        <Pipeline demo />
      </div>

      <div className="features">
        {STEPS.map((s, i) => (
          <div key={s.key} className="feature rise" style={{ ["--d" as string]: `${520 + i * 60}ms` }} onMouseMove={spot}>
            <span className={`ficon ${s.color}`}>{s.icon}</span>
            <div className="f-title">{s.label}</div>
            <div className="f-desc">{s.desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}