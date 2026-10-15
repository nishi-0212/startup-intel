import { useEffect, useState } from "react";

/** Animated agent graph: Supervisor -> 4 parallel agents -> Fact-check -> Report. */
type St = "pending" | "running" | "done" | "failed" | "skipped";

const AGENTS = [
  { key: "research", label: "Profile", color: "lav", y: 40 },
  { key: "market", label: "Market", color: "sky", y: 100 },
  { key: "competitor", label: "Competitors", color: "pink", y: 160 },
  { key: "funding", label: "Funding", color: "mint", y: 220 },
];

function Node({ x, y, w, label, color, st }: { x: number; y: number; w: number; label: string; color: string; st: St }) {
  return (
    <g className={`pnode pn-${color} ${st}`} transform={`translate(${x - w / 2},${y - 18})`}>
      <rect className="halo" x={-4} y={-4} width={w + 8} height={44} rx={13} />
      <rect className="body" width={w} height={36} rx={10} />
      <circle className="pdot" cx={17} cy={18} r={4} />
      <text x={30} y={22.5}>{label}</text>
    </g>
  );
}

/** Demo loop used on the home page so the graph feels alive. */
function useDemo(enabled: boolean) {
  const [t, setT] = useState(0);
  useEffect(() => { if (!enabled) return; const i = setInterval(() => setT(x => (x + 1) % 7), 1100); return () => clearInterval(i); }, [enabled]);
  const s = (start: number, end: number): St => (t < start ? "pending" : t < end ? "running" : "done");
  return (key: string): St => key === "sup" ? s(0, 1)
    : key === "verification" ? s(3, 4) : key === "synthesis" ? s(4, 5) : s(1, key === "market" ? 2 : 3);
}

export default function Pipeline({ state, demo = false }: { state?: (key: string) => string; demo?: boolean }) {
  const demoState = useDemo(demo);
  const get = (k: string) => (demo ? demoState(k) : ((state?.(k) ?? "pending") as St));
  const sup: St = demo ? demoState("sup") : "done";
  const edge = (to: St) => (to === "running" ? "running" : to === "done" || to === "failed" ? "done" : "");
  const v = get("verification"), syn = get("synthesis");
  return (
    <svg className="pipeline" viewBox="0 0 780 260" role="img" aria-label="Agent pipeline">
      {AGENTS.map(a => (
        <g key={a.key}>
          <path className={`pedge pe-${a.color} ${edge(get(a.key))}`} d={`M150,130 C215,130 205,${a.y} 270,${a.y}`} />
          <path className={`pedge pe-${a.color} ${edge(v)}`} d={`M390,${a.y} C455,${a.y} 445,130 510,130`} />
        </g>
      ))}
      <path className={`pedge pe-peach ${edge(syn)}`} d="M620,130 L665,130" />
      <Node x={90} y={130} w={120} label="Supervisor" color="lav" st={sup} />
      {AGENTS.map(a => <Node key={a.key} x={330} y={a.y} w={120} label={a.label} color={a.color} st={get(a.key)} />)}
      <Node x={565} y={130} w={110} label="Fact-check" color="butter" st={v} />
      <Node x={720} y={130} w={110} label="Report" color="peach" st={syn} />
    </svg>
  );
}