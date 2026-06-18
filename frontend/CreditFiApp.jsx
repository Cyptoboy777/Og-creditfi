import { useState, useEffect, useRef, useCallback } from "react";

// ─── GENERATIVE LOGO ──────────────────────────────────────────────────────────
function drawLogo(canvas, seed, size = 72) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  canvas.width = size; canvas.height = size;
  let r = seed | 0;
  const rand = () => { r = (r * 1664525 + 1013904223) & 0xffffffff; return (r >>> 0) / 4294967296; };
  const pals = [["#00D4FF","#1050E8"],["#00D4FF","#7B2FFF"],["#1050E8","#00F0A0"],["#00D4FF","#2B38E8"],["#7B2FFF","#00D4FF"]];
  const pal = pals[Math.floor(rand() * pals.length)];
  const cx = size / 2, cy = size / 2, s = size;

  // BG
  ctx.fillStyle = "#0C1018";
  ctx.beginPath(); rr(ctx, 0, 0, s, s, s * 0.22); ctx.fill();

  const g = ctx.createLinearGradient(0, 0, s, s);
  g.addColorStop(0, pal[0]); g.addColorStop(1, pal[1]);

  ctx.save(); ctx.beginPath(); rr(ctx, 0, 0, s, s, s * 0.22); ctx.clip();

  const style = Math.floor(rand() * 6);
  if (style === 0) {
    // Hexagon
    ctx.strokeStyle = g; ctx.lineWidth = s * 0.045;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = (i/6)*Math.PI*2-Math.PI/6; i===0?ctx.moveTo(cx+s*0.32*Math.cos(a),cy+s*0.32*Math.sin(a)):ctx.lineTo(cx+s*0.32*Math.cos(a),cy+s*0.32*Math.sin(a)); }
    ctx.closePath(); ctx.stroke();
    ctx.fillStyle = g; ctx.font = `700 ${s*0.34}px 'Space Mono',monospace`; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("C",cx,cy+s*0.02);
  } else if (style === 1) {
    // Rotating squares
    for (let i = 0; i < 3; i++) { ctx.save(); ctx.translate(cx,cy); ctx.rotate(rand()*0.8+i*0.35); const side=s*(0.24+i*0.1); ctx.strokeStyle=i===0?pal[0]:i===1?pal[1]:"#fff2"; ctx.lineWidth=s*0.035; ctx.strokeRect(-side/2,-side/2,side,side); ctx.restore(); }
    ctx.fillStyle="#fff"; ctx.font=`700 ${s*0.26}px 'Space Mono',monospace`; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("CF",cx,cy+s*0.02);
  } else if (style === 2) {
    // Circuit
    [[0,-0.34],[0.34,0],[0,0.34],[-0.34,0]].forEach(([nx,ny])=>{ ctx.strokeStyle=pal[0]; ctx.lineWidth=s*0.024; ctx.setLineDash([s*0.04,s*0.04]); ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+nx*s,cy+ny*s); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle=pal[1]; ctx.beginPath(); ctx.arc(cx+nx*s,cy+ny*s,s*0.05,0,Math.PI*2); ctx.fill(); });
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,s*0.13,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#fff"; ctx.font=`700 ${s*0.19}px 'Space Mono',monospace`; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("CF",cx,cy+s*0.01);
  } else if (style === 3) {
    // Diamond
    ctx.strokeStyle=g; ctx.lineWidth=s*0.05; ctx.lineJoin="round";
    ctx.beginPath(); ctx.moveTo(cx,cy-s*0.3); ctx.lineTo(cx+s*0.3,cy); ctx.lineTo(cx,cy+s*0.3); ctx.lineTo(cx-s*0.3,cy); ctx.closePath(); ctx.stroke();
    ctx.strokeStyle=pal[1]; ctx.lineWidth=s*0.055; ctx.beginPath(); ctx.moveTo(cx-s*0.1,cy+s*0.15); ctx.lineTo(cx+s*0.1,cy-s*0.15); ctx.stroke();
  } else if (style === 4) {
    // Arcs
    [3,2,1].forEach(i=>{ ctx.strokeStyle=i===3?pal[0]+"33":i===2?pal[0]+"88":pal[0]; ctx.lineWidth=s*0.028; ctx.beginPath(); ctx.arc(cx,cy,s*i*0.1,-Math.PI*0.7,Math.PI*0.7); ctx.stroke(); });
    ctx.fillStyle=g; ctx.font=`700 ${s*0.3}px 'Space Mono',monospace`; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("C",cx+s*0.04,cy+s*0.02);
  } else {
    // 0G Zero
    ctx.strokeStyle=g; ctx.lineWidth=s*0.054; ctx.beginPath(); ctx.arc(cx-s*0.1,cy,s*0.21,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle=pal[1]; ctx.lineWidth=s*0.06; ctx.beginPath(); ctx.moveTo(cx-s*0.23,cy+s*0.16); ctx.lineTo(cx+s*0.03,cy-s*0.16); ctx.stroke();
  }
  // Glow
  const gw = ctx.createRadialGradient(cx,cy,0,cx,cy,s*0.5);
  gw.addColorStop(0,pal[0]+"18"); gw.addColorStop(1,"transparent");
  ctx.fillStyle=gw; ctx.fillRect(0,0,s,s);
  ctx.restore();
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r); ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h); ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r); ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}

// ─── LOGO CANVAS ──────────────────────────────────────────────────────────────
function LogoCanvas({ seed, size = 72, onClick, className = "" }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) drawLogo(ref.current, seed, size); }, [seed, size]);
  return <canvas ref={ref} onClick={onClick} className={className} style={{ borderRadius: 10, cursor: onClick ? "pointer" : "default", display: "block" }} />;
}

// ─── HALF-CIRCLE GAUGE ────────────────────────────────────────────────────────
function ScoreGauge({ score }) {
  const pct = Math.max(0, Math.min(1, (score - 300) / 550));
  const dasharray = 157;
  const dashoffset = dasharray - pct * dasharray;
  const color = score >= 650 ? "#00F0A0" : score >= 500 ? "#FFAA30" : "#FF3B6B";
  return (
    <div style={{ position: "relative", width: 130, height: 76, margin: "0 auto 8px" }}>
      <svg viewBox="0 0 130 76" width="130" height="76" style={{ overflow: "visible" }}>
        <defs>
          <linearGradient id="gg" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00D4FF" />
            <stop offset="100%" stopColor="#1050E8" />
          </linearGradient>
        </defs>
        <path d="M 10 70 A 55 55 0 0 1 120 70" fill="none" stroke="#263D56" strokeWidth="7" strokeLinecap="round" />
        <path d="M 10 70 A 55 55 0 0 1 120 70" fill="none" stroke="url(#gg)" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={dasharray} strokeDashoffset={dashoffset}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)" }} />
      </svg>
      <div style={{ position: "absolute", bottom: -2, left: "50%", transform: "translateX(-50%)", textAlign: "center" }}>
        <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 28, fontWeight: 700, color: "#EBF3FA", letterSpacing: "-0.03em", lineHeight: 1 }}>
          {score || "—"}
        </div>
        <div style={{ fontFamily: "'Space Mono',monospace", fontSize: 9, color: "#6B8DAE", marginTop: 2 }}>/ 850</div>
      </div>
    </div>
  );
}

// ─── TIER BADGE ───────────────────────────────────────────────────────────────
function TierBadge({ score }) {
  const tiers = [
    [750, "Prime",     "#00F0A0", "rgba(0,240,160,0.1)",  "rgba(0,240,160,0.2)"],
    [650, "Near-Prime","#00D4FF", "rgba(0,212,255,0.1)",  "rgba(0,212,255,0.2)"],
    [550, "Sub-Prime", "#FFAA30", "rgba(255,170,48,0.1)", "rgba(255,170,48,0.2)"],
    [0,   "High-Risk", "#FF3B6B", "rgba(255,59,107,0.1)", "rgba(255,59,107,0.2)"],
  ];
  const [,label,col,bg,border] = tiers.find(([t]) => score >= t) || tiers[3];
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:11, fontWeight:600, padding:"3px 10px", borderRadius:5, background:bg, color:col, border:`1px solid ${border}` }}>
      ◈ {label}
    </span>
  );
}

// ─── TOKENS ───────────────────────────────────────────────────────────────────
const T = {
  base:    "#080C12", card:    "#0F1520", surface: "#0C1018",
  line:    "#1C2D42", muted:   "#263D56", dim:     "#3D5A78",
  soft:    "#6B8DAE", text:    "#9AB8D4", lit:     "#C8DCED", white:   "#EBF3FA",
  cyan:    "#00D4FF", blue:    "#1050E8", green:   "#00F0A0",
  amber:   "#FFAA30", rose:    "#FF3B6B",
  grad:    "linear-gradient(135deg, #00D4FF 0%, #1050E8 100%)",
};

const mono = { fontFamily:"'Space Mono',monospace" };
const eyebrow = { ...mono, fontSize:9, letterSpacing:"0.12em", textTransform:"uppercase", color:T.dim };
const panelTitle = { ...mono, fontSize:10, fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:T.cyan };

// ─── SUBCOMPONENTS ────────────────────────────────────────────────────────────
function Panel({ children, style = {} }) {
  return <div style={{ background:T.card, border:`1px solid ${T.line}`, borderRadius:14, padding:"20px 22px", position:"relative", ...style }}>{children}</div>;
}

function PanelHead({ title, badge }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18, paddingBottom:14, borderBottom:`1px solid ${T.line}` }}>
      <div style={panelTitle}>{title}</div>
      {badge && <span style={{ ...mono, fontSize:9, padding:"2px 8px", borderRadius:4, background:"rgba(0,212,255,0.08)", color:T.cyan, border:`1px solid rgba(0,212,255,0.15)` }}>{badge}</span>}
    </div>
  );
}

function StatCard({ label, value, unit, sub, accent, glyph }) {
  return (
    <div style={{ background:T.card, border:`1px solid ${T.line}`, borderRadius:14, padding:"18px 20px", position:"relative", overflow:"hidden", display:"flex", flexDirection:"column", justifyContent:"space-between", minHeight:120 }}>
      <div style={{ position:"absolute", bottom:-8, right:8, fontSize:52, fontWeight:700, opacity:0.03, color:T.cyan, ...mono, lineHeight:1, pointerEvents:"none" }}>{glyph}</div>
      <div>
        <div style={eyebrow}>{label}</div>
        <div style={{ ...mono, fontSize:24, fontWeight:700, color: accent || T.white, letterSpacing:"-0.03em", lineHeight:1, marginTop:6 }}>
          {value}<span style={{ fontSize:11, color:T.soft, fontWeight:400 }}> {unit}</span>
        </div>
      </div>
      <div style={{ fontSize:11, color:T.dim, marginTop:8 }}>{sub}</div>
    </div>
  );
}

function ActionBtn({ children, variant = "primary", onClick, disabled, sm }) {
  const styles = {
    primary: { background: T.grad, color: "#fff", border: "none", boxShadow:"0 4px 20px rgba(0,212,255,0.15)" },
    green:   { background:"rgba(0,240,160,0.08)", color:T.green, border:`1px solid rgba(0,240,160,0.2)` },
    amber:   { background:"rgba(255,170,48,0.08)", color:T.amber, border:`1px solid rgba(255,170,48,0.2)` },
  };
  return (
    <button disabled={disabled} onClick={onClick}
      style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:7, width: sm ? "auto" : "100%",
        padding: sm ? "8px 14px" : "11px 20px", borderRadius:9,
        fontFamily:"'Space Grotesk',sans-serif", fontSize: sm ? 12 : 13, fontWeight:600,
        cursor: disabled ? "not-allowed" : "pointer", letterSpacing:"0.01em",
        opacity: disabled ? 0.3 : 1, transition:"opacity 0.2s, transform 0.15s",
        ...styles[variant] }}>
      {children}
    </button>
  );
}

function FieldInput({ label, id, value, onChange, placeholder, suffix, step = "0.01" }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ ...eyebrow, display:"block", marginBottom:6 }}>{label}</label>
      <div style={{ position:"relative" }}>
        <input type="number" value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} step={step}
          style={{ width:"100%", background:T.surface, border:`1px solid ${T.line}`, borderRadius:8,
            color:T.white, fontFamily:"'Space Grotesk',sans-serif", fontSize:13,
            padding:"10px 38px 10px 14px", outline:"none" }} />
        <span style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)", ...mono, fontSize:10, color:T.dim }}>{suffix}</span>
      </div>
    </div>
  );
}

// ─── LOGO GENERATOR MODAL ────────────────────────────────────────────────────
function LogoModal({ onClose, onApply }) {
  const [seeds, setSeeds] = useState([]);
  const [selected, setSelected] = useState(0);

  const generate = useCallback(() => {
    setSeeds(Array.from({ length: 10 }, () => Math.floor(Math.random() * 9999999)));
    setSelected(0);
  }, []);

  useEffect(() => { generate(); }, []);

  return (
    <div style={{ position:"fixed", inset:0, zIndex:200, background:"rgba(4,6,10,0.92)", backdropFilter:"blur(20px)", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:T.card, border:`1px solid ${T.line}`, borderRadius:16, padding:"28px 32px", width:460, boxShadow:"0 24px 80px rgba(0,0,0,0.6)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <span style={{ ...mono, fontSize:11, fontWeight:700, letterSpacing:"0.1em", color:T.white }}>// LOGO GENERATOR</span>
          <span onClick={onClose} style={{ cursor:"pointer", color:T.dim, fontSize:20, lineHeight:1 }}>×</span>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginBottom:20 }}>
          {seeds.map((seed, i) => (
            <div key={seed} onClick={() => setSelected(i)}
              style={{ borderRadius:10, border:`2px solid ${i === selected ? T.cyan : "transparent"}`, cursor:"pointer", transition:"border-color 0.2s, transform 0.2s", transform: i === selected ? "scale(1.06)" : "scale(1)", aspectRatio:"1", overflow:"hidden" }}>
              <LogoCanvas seed={seed} size={72} />
            </div>
          ))}
        </div>

        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          <ActionBtn variant="primary" sm onClick={generate}>⟳ Regenerate</ActionBtn>
          <ActionBtn variant="green" sm onClick={() => { onApply(seeds[selected]); onClose(); }}>Apply Selected</ActionBtn>
        </div>
      </div>
    </div>
  );
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function Toast({ msg, type }) {
  const colors = { success: T.green, error: T.rose, info: T.cyan };
  const borders = { success:"rgba(0,240,160,0.35)", error:"rgba(255,59,107,0.35)", info:"rgba(0,212,255,0.35)" };
  if (!msg) return null;
  return (
    <div style={{ position:"fixed", bottom:28, right:28, zIndex:300, background:T.card, border:`1px solid ${borders[type]}`, borderRadius:12, padding:"14px 18px", fontSize:12, color:colors[type], maxWidth:320, boxShadow:"0 12px 40px rgba(0,0,0,0.5)", fontFamily:"'Space Grotesk',sans-serif" }}>
      {msg}
    </div>
  );
}

// ─── WAVE STRIP ───────────────────────────────────────────────────────────────
function WaveStrip() {
  const waves = ["W1 · Scope","W2 · Testnet","W3 · Mainnet","W4 · Traction","W5 · Demo"];
  return (
    <div style={{ background:T.card, border:`1px solid ${T.line}`, borderRadius:14, padding:"14px 22px", marginBottom:12, display:"flex", alignItems:"center", gap:20 }}>
      <div style={{ display:"flex", gap:5, flex:1 }}>
        {waves.map((w, i) => (
          <div key={i} style={{ flex:1, position:"relative" }}>
            <div style={{ height:3, borderRadius:2, background: i === 0 ? T.cyan : T.muted, boxShadow: i === 0 ? `0 0 8px ${T.cyan}60` : "none" }} />
            <div style={{ ...mono, fontSize:8, color:T.dim, marginTop:6, whiteSpace:"nowrap" }}>{w}</div>
          </div>
        ))}
      </div>
      <div style={{ ...mono, fontSize:10, color:T.soft, whiteSpace:"nowrap" }}>Wave 1 · Jun 26</div>
      <span style={{ fontSize:11, fontWeight:600, padding:"3px 10px", borderRadius:5, background:"rgba(0,240,160,0.1)", color:T.green, border:"1px solid rgba(0,240,160,0.2)" }}>Active</span>
    </div>
  );
}

// ─── AI SCORER PANEL ──────────────────────────────────────────────────────────
function ScorerPanel() {
  const [fields, setFields] = useState({ rep:"8", bor:"10", def:"2", days:"6", col:"2.1", age:"75" });
  const [result, setResult] = useState(null);
  const set = (k) => (v) => setFields(f => ({ ...f, [k]: v }));

  const run = () => {
    const rep=+fields.rep||0, bor=Math.max(+fields.bor||1,1), def=+fields.def||0;
    const days=+fields.days||30, col=+fields.col||1.5, age=+fields.age||1;
    const prob = Math.max(0, Math.min(1,
      (rep/bor)*0.35 + (1-Math.min(days,90)/90)*0.15 + (Math.min(col,5)/5)*0.15 + (1-def/bor)*0.25 + (Math.min(age,365)/365)*0.10
    ));
    const score = Math.round(300 + prob * 550);
    const ltv = +(50 + (score-300)*25/550).toFixed(1);
    setResult({ score, ltv, prob, rep, bor, def, days, col, age });
  };

  return (
    <Panel style={{ marginBottom:12 }}>
      <PanelHead title="AI Credit Scorer · 0G Compute" badge="GBM Model" />
      <p style={{ fontSize:11, color:T.soft, marginBottom:16, lineHeight:1.7 }}>Simulate the AI model running on 0G Compute Network that scores your agent's creditworthiness.</p>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:14 }}>
        <FieldInput label="Repayments" value={fields.rep} onChange={set("rep")} suffix="txns" step="1" />
        <FieldInput label="Total Borrows" value={fields.bor} onChange={set("bor")} suffix="txns" step="1" />
        <FieldInput label="Defaults" value={fields.def} onChange={set("def")} suffix="×" step="1" />
        <FieldInput label="Avg Repay Days" value={fields.days} onChange={set("days")} suffix="d" step="1" />
        <FieldInput label="Collateral Ratio" value={fields.col} onChange={set("col")} suffix="×" />
        <FieldInput label="Account Age" value={fields.age} onChange={set("age")} suffix="d" step="1" />
      </div>
      <ActionBtn variant="primary" sm onClick={run}>⚡ Run AI Scorer</ActionBtn>

      {result && (
        <div style={{ marginTop:16, background:T.surface, border:`1px solid ${T.line}`, borderRadius:10, padding:"16px 18px" }}>
          <div style={{ display:"flex", gap:28, alignItems:"center", marginBottom:12, flexWrap:"wrap" }}>
            <div>
              <div style={{ ...eyebrow, marginBottom:4 }}>Predicted Score</div>
              <div style={{ ...mono, fontSize:42, fontWeight:700, color: result.score>=650?T.green:result.score>=500?T.amber:T.rose, letterSpacing:"-0.04em", lineHeight:1 }}>{result.score}</div>
            </div>
            <div>
              <div style={{ ...eyebrow, marginBottom:6 }}>Risk Tier</div>
              <TierBadge score={result.score} />
              <div style={{ ...eyebrow, marginTop:10, marginBottom:4 }}>Max LTV</div>
              <div style={{ ...mono, fontSize:18, fontWeight:700, color:T.cyan }}>{result.ltv}%</div>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ ...eyebrow, marginBottom:8 }}>Score Breakdown</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:"6px 16px" }}>
                {[["Repay Rate",(result.rep/result.bor*100).toFixed(0)+"%"],["Default Rate",(result.def/result.bor*100).toFixed(0)+"%"],["Collateral",result.col+"×"],["Avg Repay",result.days+"d"],["Age",result.age+"d"],["Confidence",(result.prob*100).toFixed(0)+"%"]].map(([k,v]) => (
                  <div key={k} style={{ ...mono, fontSize:10, color:T.dim }}>{k}: <span style={{ color:T.lit }}>{v}</span></div>
                ))}
              </div>
            </div>
          </div>
          <div style={{ height:5, background:T.muted, borderRadius:3, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${(result.ltv-50)/25*100}%`, background:T.grad, borderRadius:3, transition:"width 0.8s ease" }} />
          </div>
        </div>
      )}
    </Panel>
  );
}

// ─── HISTORY TABLE ────────────────────────────────────────────────────────────
function HistoryTable({ history }) {
  return (
    <Panel>
      <PanelHead title="Transaction History" badge={`${history.length} txns`} />
      {!history.length ? (
        <div style={{ textAlign:"center", padding:28, color:T.dim, ...mono, fontSize:11 }}>// Connect wallet to view history</div>
      ) : (
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${T.line}` }}>
              {["Type","Amount","Score Δ","Time","Status"].map(h => (
                <th key={h} style={{ ...eyebrow, textAlign:"left", paddingBottom:10, fontWeight:400 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map((tx, i) => {
              const dColor = tx.delta.startsWith("+") ? T.green : tx.delta === "0" || tx.delta === "—" ? T.dim : T.rose;
              return (
                <tr key={i} style={{ borderBottom: i < history.length-1 ? `1px solid ${T.line}40` : "none" }}>
                  <td style={{ padding:"11px 0", fontWeight:600, color:T.lit }}>
                    <span style={{ marginRight:8 }}>{tx.icon}</span>{tx.type}
                  </td>
                  <td style={{ ...mono, fontSize:11, color:T.text }}>{tx.amount}</td>
                  <td style={{ ...mono, fontSize:11, color:dColor }}>{tx.delta}</td>
                  <td style={{ ...mono, fontSize:11, color:T.dim }}>{tx.time}</td>
                  <td>
                    <span style={{ ...mono, fontSize:10 }}>
                      <span style={{ display:"inline-block", width:5, height:5, borderRadius:"50%", background: tx.status==="success"?T.green:T.amber, boxShadow:`0 0 5px ${tx.status==="success"?T.green:T.amber}`, marginRight:5 }} />
                      {tx.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════════════════════════════════════════════
export default function CreditFiApp() {
  const [logoSeed, setLogoSeed] = useState(4827391);
  const [showLogoModal, setShowLogoModal] = useState(false);
  const [toast, setToast] = useState({ msg:"", type:"info" });
  const toastTimer = useRef(null);

  const [connected, setConnected] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [score, setScore] = useState(0);
  const [deposited, setDeposited] = useState(0);
  const [borrowed, setBorrowed] = useState(0);
  const [history, setHistory] = useState([]);

  const [inDeposit, setInDeposit] = useState("");
  const [inWithdraw, setInWithdraw] = useState("");
  const [inBorrow, setInBorrow] = useState("");

  const showToast = (msg, type = "info") => {
    setToast({ msg, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast({ msg:"", type:"info" }), 3500);
  };

  const addTx = (tx) => setHistory(h => [tx, ...h]);
  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  const ltv = 50 + (score - 300) * 25 / 550;
  const creditLimit = deposited * ltv / 100;
  const utilized = creditLimit > 0 ? (borrowed / creditLimit * 100) : 0;
  const interest = borrowed * 0.05 / 365;
  const totalOwed = borrowed + interest;

  const doConnect = async () => {
    if (connected) { setConnected(false); setRegistered(false); setScore(0); setDeposited(0); setBorrowed(0); setHistory([]); return; }
    showToast("Connecting to 0G Galileo…", "info");
    await wait(800);
    setConnected(true);
    setRegistered(true); setScore(520); setDeposited(0.5); setBorrowed(0.1);
    setHistory([
      {type:"Register", icon:"◈", amount:"—",        delta:"+0", time:"2h ago", status:"success"},
      {type:"Deposit",  icon:"↓", amount:"0.500 OG",  delta:"+0", time:"2h ago", status:"success"},
      {type:"Borrow",   icon:"⟶", amount:"0.100 OG",  delta:"0",  time:"1h ago", status:"active"},
    ]);
    showToast("✓ Connected to 0G Galileo Testnet", "success");
  };

  const doRegister = async () => {
    showToast("Registering on 0G Chain…", "info"); await wait(1200);
    setRegistered(true); setScore(500);
    addTx({type:"Register",icon:"◈",amount:"—",delta:"+0",time:"now",status:"success"});
    showToast("✓ Agent registered · Score: 500", "success");
  };

  const doDeposit = async () => {
    const amt = parseFloat(inDeposit); if (!amt || amt <= 0) { showToast("Enter a valid amount","error"); return; }
    showToast(`Depositing ${amt} OG…`,"info"); await wait(1000);
    setDeposited(d => d + amt); setInDeposit("");
    addTx({type:"Deposit",icon:"↓",amount:`${amt.toFixed(3)} OG`,delta:"+0",time:"now",status:"success"});
    showToast(`✓ Deposited ${amt} OG`,"success");
  };

  const doWithdraw = async () => {
    const amt = parseFloat(inWithdraw); if (!amt||amt<=0){showToast("Enter amount","error");return;}
    if (borrowed > 0){showToast("Repay borrow first","error");return;}
    if (amt > deposited){showToast("Insufficient collateral","error");return;}
    showToast(`Withdrawing ${amt} OG…`,"info"); await wait(1000);
    setDeposited(d => d - amt); setInWithdraw("");
    addTx({type:"Withdraw",icon:"↑",amount:`${amt.toFixed(3)} OG`,delta:"+0",time:"now",status:"success"});
    showToast(`✓ Withdrew ${amt} OG`,"success");
  };

  const doBorrow = async () => {
    const amt = parseFloat(inBorrow); if (!amt||amt<=0){showToast("Enter amount","error");return;}
    if (borrowed>0){showToast("Repay existing borrow first","error");return;}
    if (amt>creditLimit){showToast(`Exceeds credit limit of ${creditLimit.toFixed(3)} OG`,"error");return;}
    showToast(`Borrowing ${amt} OG at score ${score}…`,"info"); await wait(1200);
    setBorrowed(amt); setInBorrow("");
    addTx({type:"Borrow",icon:"⟶",amount:`${amt.toFixed(3)} OG`,delta:"0",time:"now",status:"active"});
    showToast(`✓ Borrowed ${amt} OG · Repay to boost score`,"success");
  };

  const doRepay = async () => {
    if (borrowed<=0){showToast("No active borrow","error");return;}
    showToast(`Repaying ${totalOwed.toFixed(6)} OG…`,"info"); await wait(1200);
    const old = score; const newScore = Math.min(score + 20, 850);
    setScore(newScore); setBorrowed(0);
    addTx({type:"Repay",icon:"✓",amount:`${totalOwed.toFixed(6)} OG`,delta:`+${newScore-old}`,time:"now",status:"success"});
    showToast(`✓ Repaid · Score ${old} → ${newScore}`,"success");
  };

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ background:T.base, minHeight:"100vh", fontFamily:"'Space Grotesk',system-ui,sans-serif", color:T.text, fontSize:13, position:"relative", overflow:"hidden" }}>
      {/* BG Grid */}
      <div style={{ position:"fixed", inset:0, backgroundImage:"linear-gradient(rgba(0,212,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.025) 1px,transparent 1px)", backgroundSize:"48px 48px", pointerEvents:"none", zIndex:0 }} />
      <div style={{ position:"fixed", width:500, height:500, top:-100, left:-100, borderRadius:"50%", background:"radial-gradient(circle,rgba(0,212,255,0.07) 0%,transparent 70%)", filter:"blur(80px)", pointerEvents:"none", zIndex:0 }} />
      <div style={{ position:"fixed", width:400, height:400, bottom:"10%", right:-80, borderRadius:"50%", background:"radial-gradient(circle,rgba(16,80,232,0.09) 0%,transparent 70%)", filter:"blur(80px)", pointerEvents:"none", zIndex:0 }} />

      {showLogoModal && <LogoModal onClose={() => setShowLogoModal(false)} onApply={setLogoSeed} />}
      <Toast {...toast} />

      <div style={{ position:"relative", zIndex:1, maxWidth:1120, margin:"0 auto", padding:"0 24px 80px" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 0", borderBottom:`1px solid ${T.line}`, marginBottom:32, position:"sticky", top:0, zIndex:50, background:"rgba(8,12,18,0.88)", backdropFilter:"blur(20px)", marginLeft:-24, marginRight:-24, paddingLeft:24, paddingRight:24 }}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <LogoCanvas seed={logoSeed} size={40} onClick={() => setShowLogoModal(true)} />
            <div>
              <div style={{ fontSize:17, fontWeight:700, color:T.white, letterSpacing:"-0.03em", lineHeight:1 }}>CreditFi</div>
              <div style={{ ...mono, fontSize:9, color:T.cyan, letterSpacing:"0.12em", textTransform:"uppercase", opacity:0.8 }}>on 0G Chain · AI Credit Protocol</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, ...mono, fontSize:10, color:T.soft, background:T.surface, border:`1px solid ${T.line}`, padding:"5px 12px", borderRadius:20 }}>
              <span style={{ width:5, height:5, borderRadius:"50%", background:T.green, boxShadow:`0 0 6px ${T.green}`, display:"inline-block" }} />
              0G Galileo
            </div>
            <button onClick={doConnect}
              style={{ ...mono, fontSize:10, fontWeight:700, letterSpacing:"0.06em", padding:"8px 18px", borderRadius:8, border: connected?"1px solid rgba(0,240,160,0.3)":"none", cursor:"pointer", background: connected?"transparent":T.grad, color: connected?T.green:"#fff" }}>
              {connected ? "0x71a…3f2c" : "Connect Wallet"}
            </button>
          </div>
        </div>

        <WaveStrip />

        {/* Hero strip */}
        <div style={{ display:"grid", gridTemplateColumns:"260px 1fr 1fr 1fr", gap:12, marginBottom:12 }}>
          {/* Score card */}
          <div style={{ background:T.card, border:`1px solid ${T.line}`, borderRadius:14, padding:"22px 22px 18px", position:"relative", overflow:"hidden",
            backgroundImage:"linear-gradient(135deg,rgba(0,212,255,0.04) 0%,rgba(16,80,232,0.04) 100%)" }}>
            <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:T.grad }} />
            <div style={{ ...mono, fontSize:9, letterSpacing:"0.14em", textTransform:"uppercase", color:T.cyan, marginBottom:14, opacity:0.9 }}>// Credit Score</div>
            <ScoreGauge score={registered ? score : 0} />
            <div style={{ textAlign:"center", marginTop:14 }}>
              <TierBadge score={registered ? score : 0} />
            </div>
            <div style={{ marginTop:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", ...mono, fontSize:9, color:T.dim, marginBottom:4 }}>
                <span>Max LTV</span><span>{registered ? ltv.toFixed(1) + "%" : "—"}</span>
              </div>
              <div style={{ height:4, background:T.muted, borderRadius:2, overflow:"hidden" }}>
                <div style={{ height:"100%", width: registered ? `${(ltv-50)/25*100}%` : "0%", background:T.grad, transition:"width 1s ease", borderRadius:2 }} />
              </div>
            </div>
          </div>

          <StatCard label="Collateral" value={deposited.toFixed(3)} unit="OG" sub={deposited>0?"Collateral active":"No collateral yet"} glyph="Ξ" />
          <StatCard label="Active Borrow" value={borrowed.toFixed(3)} unit="OG" accent={T.amber} sub={borrowed>0?"Position open":"No active position"} glyph="↑" />
          <StatCard label="Pool Balance" value="12.4" unit="OG" sub="17 agents · 5% APR" glyph="Σ" />
        </div>

        {/* Body grid */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>

          {/* Collateral panel */}
          <Panel>
            <PanelHead title="Collateral Manager" badge={registered ? "Registered" : "Unregistered"} />
            {!registered ? (
              <>
                <p style={{ fontSize:12, color:T.soft, marginBottom:16, lineHeight:1.7 }}>Register your agent on 0G Chain. On-chain activity is scored by AI running on 0G Compute — building your verifiable credit history.</p>
                <ActionBtn onClick={doConnect && doRegister}>↗ Register Agent</ActionBtn>
              </>
            ) : (
              <>
                <FieldInput label="Deposit Amount" value={inDeposit} onChange={setInDeposit} placeholder="0.10" suffix="OG" />
                <ActionBtn variant="green" onClick={doDeposit}>↓ Deposit Collateral</ActionBtn>
                <div style={{ height:1, background:T.line, margin:"14px 0" }} />
                <FieldInput label="Withdraw Amount" value={inWithdraw} onChange={setInWithdraw} placeholder="0.05" suffix="OG" />
                <ActionBtn variant="amber" onClick={doWithdraw}>↑ Withdraw</ActionBtn>
              </>
            )}
          </Panel>

          {/* Borrow panel */}
          <Panel>
            <PanelHead title="Borrow & Repay" badge="5% APR" />
            {/* Credit meter */}
            <div style={{ background:T.surface, border:`1px solid ${T.line}`, borderRadius:10, padding:"14px 16px", marginBottom:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:8 }}>
                <span style={{ ...mono, fontSize:9, color:T.dim, letterSpacing:"0.1em", textTransform:"uppercase" }}>Credit Limit</span>
                <span style={{ ...mono, fontSize:14, fontWeight:700, color:T.cyan }}>{creditLimit.toFixed(3)} OG</span>
              </div>
              <div style={{ height:5, background:T.muted, borderRadius:3, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${Math.min(utilized,100)}%`, background:T.grad, transition:"width 0.8s ease", borderRadius:3 }} />
              </div>
              <div style={{ ...mono, fontSize:9, color:T.dim, textAlign:"right", marginTop:4 }}>{utilized.toFixed(1)}% utilized</div>
            </div>

            {borrowed > 0 && (
              <div style={{ border:`1px solid rgba(255,170,48,0.2)`, background:"rgba(255,170,48,0.04)", borderRadius:9, padding:"12px 14px", marginBottom:12 }}>
                <div style={{ ...mono, fontSize:9, color:T.amber, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:4 }}>Total Owed · Principal + Interest</div>
                <div style={{ ...mono, fontSize:18, fontWeight:700, color:T.amber }}>{totalOwed.toFixed(6)} OG</div>
              </div>
            )}

            <FieldInput label="Borrow Amount" value={inBorrow} onChange={setInBorrow} placeholder="0.05" suffix="OG" />
            <div style={{ display:"flex", gap:8 }}>
              <ActionBtn onClick={doBorrow}>⟶ Borrow</ActionBtn>
              <ActionBtn variant="green" onClick={doRepay} disabled={borrowed <= 0}>✓ Repay & Boost</ActionBtn>
            </div>
          </Panel>
        </div>

        <ScorerPanel />
        <HistoryTable history={history} />

      </div>
    </div>
  );
}
