"use client";
import { useState, useEffect, useRef } from "react";
import { Bot } from "lucide-react";
import { FaClipboardList } from "react-icons/fa";

const AGENTS = [
  { x: 50, y: 48, label: "Orchestrator", size: 52 },
  { x: 18, y: 22, label: "Agent A", size: 36 },
  { x: 82, y: 22, label: "Agent B", size: 36 },
  { x: 10, y: 68, label: "Agent C", size: 36 },
  { x: 90, y: 68, label: "Agent D", size: 36 },
  { x: 38, y: 82, label: "Agent E", size: 32 },
  { x: 62, y: 82, label: "Agent F", size: 32 },
];

const BAD_PERMS = [
  { icon: "📧", label: "Gmail — All Emails" },
  { icon: "📁", label: "Drive — All 2,847 Files" },
  { icon: "📅", label: "Calendar — Full Access" },
  { icon: "👥", label: "Contacts — Everyone" },
];

const GOOD_PERMS = [
  { icon: "📄", label: "Q4_Financial_Report.pdf", sel: true },
  { icon: "📊", label: "Budget_2026.xlsx", sel: true },
  { icon: "📝", label: "Project_Proposal.doc", sel: false },
  { icon: "📧", label: "Inbox — Unread only", sel: true },
];

const FLOW_STEPS = [
  { num: "01", icon: "🔐", label: "Auth0 Login", desc: "Secure authentication. JWT issued. No passwords stored locally." },
  { num: "02", icon: "🏦", label: "Token Vault", desc: "Google OAuth tokens stored in Auth0's encrypted vault. Never in your browser." },
  { num: "03", icon: "🤖", label: "Agent Intent", desc: "AI captures intent before execution. Nothing runs without a contract." },
  { num: "04", icon: "📋", label: "Action Contract", desc: "Review steps, risk level, permissions needed — before anything happens." },
  { num: "05", icon: "☑️", label: "File Selection", desc: "You pick exactly which files the agent may read. Nothing else is accessible." },
  { num: "06", icon: "⚡", label: "Secure Execute", desc: "Token retrieved from vault, action executed, logged immutably." },
];

const FEATURES = [
  { icon: "🛡️", color: "#6366f1", label: "Selective Scope Authorization", desc: "Beyond OAuth — pick exact files. The agent reads ONLY what you check, nothing more." },
  { icon: "📋", color: "#8b5cf6", label: "Action Contracts", desc: "Every agent action previewed: steps, risk, reversibility — requires your explicit approval." },
  { icon: "🌐", color: "#a78bfa", label: "Firecrawl Research Agent", desc: "Research any topic, auto-generate a structured Google Doc with sections, titles and references." },
  { icon: "📊", color: "#34d399", label: "Permission Timeline", desc: "Every grant, contract, and execution visible in a full audit timeline via the settings panel." },
  { icon: "🔄", color: "#60a5fa", label: "Re-Auth Flow", desc: "Expired tokens trigger a seamless re-authorization prompt — no data loss, no friction." },
  { icon: "🧠", color: "#f472b6", label: "Multi-Agent Ready", desc: "Built for the future: 10+ agent pipelines where each agent has its own scoped permissions." },
];

export default function LandingPage({ apiUrl }: { apiUrl: string }) {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const h = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("lv"); }),
      { threshold: 0.1, rootMargin: "0px 0px -60px 0px" }
    );
    document.querySelectorAll(".la,.la-l,.la-r,.la-s").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div style={{ background: "#06060f", minHeight: "100vh", color: "white", fontFamily: "'Inter',system-ui,sans-serif", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        .la,.la-l,.la-r,.la-s{opacity:0;transition:opacity .7s ease,transform .7s ease}
        .la{transform:translateY(28px)}.la-l{transform:translateX(-36px)}.la-r{transform:translateX(36px)}.la-s{transform:scale(.92)}
        .lv{opacity:1!important;transform:none!important}
        .d1{transition-delay:.1s}.d2{transition-delay:.2s}.d3{transition-delay:.3s}.d4{transition-delay:.4s}.d5{transition-delay:.5s}
        @keyframes lp-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes lp-pulse{0%,100%{box-shadow:0 0 0 0 rgba(99,102,241,.4)}50%{box-shadow:0 0 0 14px rgba(99,102,241,0)}}
        @keyframes lp-blink{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes lp-flow{0%{stroke-dashoffset:200}100%{stroke-dashoffset:0}}
        @keyframes lp-danger{0%,100%{border-color:rgba(239,68,68,.25)}50%{border-color:rgba(239,68,68,.7);box-shadow:0 0 24px rgba(239,68,68,.15)}}
        @keyframes lp-good{0%,100%{border-color:rgba(99,102,241,.25)}50%{border-color:rgba(99,102,241,.6);box-shadow:0 0 24px rgba(99,102,241,.12)}}
        .lp-flow-line{stroke-dasharray:200;animation:lp-flow 2.5s linear infinite}
        .card-hover{transition:transform .25s,box-shadow .25s,border-color .25s}
        .card-hover:hover{transform:translateY(-4px);box-shadow:0 20px 60px rgba(99,102,241,.14);border-color:rgba(99,102,241,.4)!important}
        .cta-btn{background:linear-gradient(135deg,#6366f1,#8b5cf6);transition:transform .2s,box-shadow .2s;text-decoration:none;color:white;display:inline-flex;align-items:center;gap:10px}
        .cta-btn:hover{transform:translateY(-2px);box-shadow:0 10px 36px rgba(99,102,241,.5)}
        .cta-btn:active{transform:scale(.97)}
        .ghost-btn{transition:all .2s;text-decoration:none;color:rgba(255,255,255,.6)}
        .ghost-btn:hover{color:white;border-color:rgba(255,255,255,.3)!important}
        .nav-link{text-decoration:none;color:rgba(255,255,255,.45);font-size:13px;font-weight:500;transition:color .2s}
        .nav-link:hover{color:rgba(255,255,255,.9)}
        .danger-card{border:1px solid rgba(239,68,68,.25);animation:lp-danger 3s ease-in-out infinite}
        .good-card{border:1px solid rgba(99,102,241,.25);animation:lp-good 3s ease-in-out infinite}
        .agent-center{animation:lp-pulse 2.4s ease-in-out infinite}
        .agent-float{animation:lp-float var(--dur,4s) ease-in-out infinite}
        .dot-blink{animation:lp-blink 1.6s ease-in-out infinite}
      `}</style>

      {/* Mouse glow */}
      <div style={{ position: "fixed", pointerEvents: "none", zIndex: 0, width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle,rgba(99,102,241,.06) 0%,transparent 70%)", top: mouse.y - 350, left: mouse.x - 350, transition: "top .35s ease,left .35s ease" }} />

      {/* ── NAV ─────────────────────────── */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, padding: "14px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,.04)", backdropFilter: "blur(20px)", background: "rgba(6,6,15,.85)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(99,102,241,.45)" }}>
            <Bot size={16} color="white" />
          </div>
          <span style={{ fontWeight: 800, fontSize: 15, letterSpacing: "-0.02em" }}>Authorized to Act</span>
          <span style={{ marginLeft: 4, padding: "2px 8px", borderRadius: 999, background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.25)", fontSize: 10, fontWeight: 700, color: "#818cf8", letterSpacing: "0.08em" }}>AUTH0 FOR AI AGENTS</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <a href="#problem" className="nav-link">Problem</a>
          <a href="#solution" className="nav-link">Solution</a>
          <a href="#auth0" className="nav-link">Auth0</a>
          <a href={`${apiUrl}/login`} className="cta-btn" style={{ padding: "8px 22px", borderRadius: 12, fontSize: 13, fontWeight: 700 }}>Try Live →</a>
        </div>
      </nav>

      {/* ── HERO ────────────────────────── */}
      <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "120px 40px 80px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
        <div style={{ position: "absolute", top: "20%", left: "8%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(99,102,241,.1) 0%,transparent 70%)", filter: "blur(40px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "15%", right: "8%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle,rgba(139,92,246,.08) 0%,transparent 70%)", filter: "blur(40px)", pointerEvents: "none" }} />

        <div style={{ maxWidth: 960, width: "100%", textAlign: "center", position: "relative", zIndex: 1 }}>
          {/* Badge */}
          <div style={{ marginBottom: 28, display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 18px", borderRadius: 999, border: "1px solid rgba(99,102,241,.3)", background: "rgba(99,102,241,.08)" }}>
            <span className="dot-blink" style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366f1", display: "inline-block" }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "#818cf8" }}>AUTH0 TOKEN VAULT · SELECTIVE SCOPE AUTHORIZATION · LIVE DEMO</span>
          </div>

          <h1 style={{ fontSize: "clamp(44px,7.5vw,88px)", fontWeight: 900, lineHeight: 1.04, letterSpacing: "-0.035em", marginBottom: 24 }}>
            <span style={{ display: "block", color: "rgba(255,255,255,.95)", fontSize: "0.45em", letterSpacing: "0.1em", marginBottom: 10, opacity: 0.8 }}>AUTH0 AUTHORized TO ACT</span>
            <span style={{ display: "block", background: "linear-gradient(135deg,#6366f1,#a78bfa 50%,#c4b5fd)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Who Controls Your AI Agents?</span>
          </h1>

          <p style={{ fontSize: "clamp(16px,2vw,20px)", color: "rgba(255,255,255,.48)", lineHeight: 1.75, maxWidth: 620, margin: "0 auto 52px", fontWeight: 400 }}>
            Build a secure, agentic AI application using <strong style={{ color: "rgba(255,255,255,.82)" }}>Auth0 for AI Agents Token Vault</strong>.<br />
            Ensure your agents are <strong style={{ color: "rgba(255,255,255,.82)" }}>Authorized to Act</strong>, but never uncontrolled.
          </p>

          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 72 }}>
            <a href={`${apiUrl}/login`} className="cta-btn" style={{ padding: "16px 40px", borderRadius: 16, fontSize: 15, fontWeight: 800 }}>
              Experience It Live <span style={{ fontSize: 20 }}>→</span>
            </a>
            <a href="#problem" className="ghost-btn" style={{ padding: "16px 36px", borderRadius: 16, fontSize: 15, fontWeight: 700, border: "1px solid rgba(255,255,255,.1)", background: "rgba(255,255,255,.04)" }}>
              See How It Works
            </a>
          </div>

          {/* Agent network */}
          <div className="la" style={{ position: "relative", width: "100%", maxWidth: 720, height: 300, margin: "0 auto" }}>
            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
              {AGENTS.slice(1).map((a, i) => (
                <line key={i} x1="50%" y1="48%" x2={`${a.x}%`} y2={`${a.y}%`}
                  stroke="rgba(99,102,241,.35)" strokeWidth="1"
                  className="lp-flow-line" style={{ animationDelay: `${i * .3}s` }} />
              ))}
            </svg>
            {AGENTS.map((a, i) => (
              <div key={i}
                className={i === 0 ? "agent-center agent-float" : "agent-float"}
                style={{
                  position: "absolute", left: `${a.x}%`, top: `${a.y}%`, transform: "translate(-50%,-50%)",
                  width: a.size, height: a.size, borderRadius: "50%",
                  background: i === 0 ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(99,102,241,.12)",
                  border: `1px solid rgba(99,102,241,${i === 0 ? .8 : .4})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: i === 0 ? "0 0 40px rgba(99,102,241,.5)" : "none",
                  ...({ "--dur": `${3 + i * .5}s` } as React.CSSProperties)
                }}>
                <Bot size={i === 0 ? 24 : 14} color={i === 0 ? "white" : "rgba(99,102,241,.9)"} />
                <div style={{ position: "absolute", top: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,.4)" }}>{a.label}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,.25)", letterSpacing: "0.1em", marginTop: 8 }}>MULTI-AGENT NETWORK — UNCONTROLLED ACCESS = YOUR DATA, EVERYWHERE, ALWAYS</p>
        </div>
      </section>

      {/* ── PROBLEM ─────────────────────── */}
      <section id="problem" style={{ padding: "120px 40px", position: "relative", borderTop: "1px solid rgba(255,255,255,.04)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="la" style={{ textAlign: "center", marginBottom: 72 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 999, background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", color: "#fca5a5", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 20 }}>⚠ THE PROBLEM</div>
            <h2 style={{ fontSize: "clamp(30px,5vw,56px)", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 16 }}>
              Today's Agents Get<br />
              <span style={{ color: "#ef4444" }}>All-or-Nothing Access</span>
            </h2>
            <p style={{ color: "rgba(255,255,255,.48)", fontSize: 18, maxWidth: 560, margin: "0 auto" }}>Like Android permissions — "Allow Drive" means ALL your 2,847 files. No boundaries. No selection. No control.</p>
          </div>

          {/* Problem cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 20, marginBottom: 56 }}>
            {[
              { icon: "🤖", title: "Agents Act Without Consent", color: "#ef4444", desc: "In a 10-agent pipeline, agents read emails, modify Drive, schedule meetings — all while you sleep, with no approval required." },
              { icon: "📁", title: "No File-Level Boundaries", color: "#f97316", desc: "\"Allow Drive\" exposes every document you've ever created. The agent doesn't know — or care — which files are sensitive." },
              { icon: "🧠", title: "RL Models Train on Your Data", color: "#eab308", desc: "Future reinforcement learning systems train on your private data with broad access — without your explicit, granular consent." },
            ].map((c, i) => (
              <div key={i} className={`la card-hover d${i + 1}`} style={{ padding: 32, borderRadius: 20, background: "rgba(239,68,68,.04)", border: "1px solid rgba(239,68,68,.18)" }}>
                <div style={{ fontSize: 36, marginBottom: 16 }}>{c.icon}</div>
                <h3 style={{ fontWeight: 800, fontSize: 17, marginBottom: 10, color: "#fca5a5" }}>{c.title}</h3>
                <p style={{ color: "rgba(255,255,255,.42)", fontSize: 14, lineHeight: 1.75 }}>{c.desc}</p>
              </div>
            ))}
          </div>

          {/* Comparison */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, maxWidth: 820, margin: "0 auto" }}>
            <div className="danger-card la" style={{ padding: 28, borderRadius: 20, background: "rgba(239,68,68,.04)" }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#f87171", marginBottom: 18 }}>❌ TODAY — ALL-OR-NOTHING</p>
              {BAD_PERMS.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", borderBottom: i < BAD_PERMS.length - 1 ? "1px solid rgba(239,68,68,.1)" : "none" }}>
                  <span style={{ fontSize: 18 }}>{p.icon}</span>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,.5)", flex: 1 }}>{p.label}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", padding: "3px 8px", borderRadius: 6, background: "rgba(239,68,68,.15)" }}>ALL ACCESS</span>
                </div>
              ))}
            </div>
            <div className="good-card la d2" style={{ padding: 28, borderRadius: 20, background: "rgba(99,102,241,.04)" }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#818cf8", marginBottom: 18 }}>✅ OUR APPROACH — FILE-LEVEL SELECTION</p>
              {GOOD_PERMS.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", borderBottom: i < GOOD_PERMS.length - 1 ? "1px solid rgba(99,102,241,.1)" : "none" }}>
                  <span style={{ fontSize: 18 }}>{p.icon}</span>
                  <span style={{ fontSize: 13, color: p.sel ? "rgba(255,255,255,.85)" : "rgba(255,255,255,.3)", flex: 1 }}>{p.label}</span>
                  <div style={{ width: 20, height: 20, borderRadius: 6, background: p.sel ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(255,255,255,.07)", border: p.sel ? "none" : "1px solid rgba(255,255,255,.14)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {p.sel && <span style={{ color: "white", fontSize: 12, fontWeight: 800 }}>✓</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SOLUTION ────────────────────── */}
      <section id="solution" style={{ padding: "120px 40px", position: "relative", borderTop: "1px solid rgba(255,255,255,.04)" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle,rgba(99,102,241,.05) 0%,transparent 70%)", pointerEvents: "none" }} />
        <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div className="la" style={{ textAlign: "center", marginBottom: 72 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 999, background: "rgba(99,102,241,.1)", border: "1px solid rgba(99,102,241,.3)", color: "#818cf8", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 20 }}>✦ THE SOLUTION</div>
            <h2 style={{ fontSize: "clamp(30px,5vw,56px)", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 16 }}>
              Pre-Initialization<br />
              <span style={{ background: "linear-gradient(135deg,#6366f1,#c4b5fd)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Consent Architecture</span>
            </h2>
            <p style={{ color: "rgba(255,255,255,.48)", fontSize: 18, maxWidth: 560, margin: "0 auto" }}>Before any agent executes, an <strong style={{ color: "white" }}>Action Contract</strong> is generated, reviewed, and explicitly approved — file by file.</p>
          </div>

          {/* Action Contract mockup */}
          <div className="la agent-float" style={{ maxWidth: 480, margin: "0 auto 80px", padding: 28, borderRadius: 24, border: "1px solid rgba(99,102,241,.22)", background: "rgba(8,8,24,.9)", backdropFilter: "blur(24px)", boxShadow: "0 40px 100px rgba(0,0,0,.55),0 0 60px rgba(99,102,241,.07)", ...({ "--dur": "5s" } as React.CSSProperties) }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid rgba(255,255,255,.06)" }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FaClipboardList color="white" size={15} />
              </div>
              <div>
                <p style={{ fontWeight: 800, fontSize: 14 }}>Action Contract</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,.4)" }}>Read Selected Drive Files</p>
              </div>
              <span style={{ marginLeft: "auto", padding: "4px 10px", borderRadius: 8, background: "rgba(245,158,11,.15)", color: "#fbbf24", fontSize: 11, fontWeight: 700 }}>PENDING REVIEW</span>
            </div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(255,255,255,.32)", marginBottom: 10 }}>SELECT FILES THE AGENT CAN ACCESS</p>
            {["Q4_Financial_Report.pdf", "Product_Roadmap_2026.doc", "Team_Contacts.xlsx", "Personal_Notes.txt"].map((f, i) => (
              <label key={f} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, cursor: "pointer", marginBottom: 4, background: i < 2 ? "rgba(99,102,241,.08)" : "transparent", border: `1px solid ${i < 2 ? "rgba(99,102,241,.22)" : "rgba(255,255,255,.05)"}` }}>
                <div style={{ width: 18, height: 18, borderRadius: 5, background: i < 2 ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(255,255,255,.06)", border: i < 2 ? "none" : "1px solid rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {i < 2 && <span style={{ color: "white", fontSize: 11, fontWeight: 800 }}>✓</span>}
                </div>
                <span style={{ fontSize: 13, color: i < 2 ? "rgba(255,255,255,.88)" : "rgba(255,255,255,.32)" }}>{f}</span>
              </label>
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "16px 0" }}>
              {[["RISK LEVEL", "⚠ Low", "#34d399"], ["REVERSIBLE", "Read-only", "#60a5fa"]].map(([k, v, c]) => (
                <div key={k} style={{ padding: "8px 12px", borderRadius: 10, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)" }}>
                  <p style={{ fontSize: 10, color: "rgba(255,255,255,.32)", marginBottom: 2 }}>{k}</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: c }}>{v}</p>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{ flex: 1, padding: "11px 0", borderRadius: 12, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", border: "none", color: "white", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>✓ Approve</button>
              <button style={{ padding: "11px 16px", borderRadius: 12, background: "transparent", border: "1px solid rgba(255,255,255,.1)", color: "rgba(255,255,255,.48)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>✕ Reject</button>
            </div>
          </div>

          {/* Flow steps */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 3 }}>
            {FLOW_STEPS.map((s, i) => (
              <div key={i} className={`la card-hover d${Math.min(i % 3 + 1, 5)}`} style={{ padding: "22px 18px", borderRadius: 16, background: "rgba(255,255,255,.025)", border: "1px solid rgba(255,255,255,.06)" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "rgba(99,102,241,.6)", letterSpacing: "0.1em", marginBottom: 10 }}>{s.num}</p>
                <p style={{ fontSize: 28, marginBottom: 10 }}>{s.icon}</p>
                <p style={{ fontWeight: 800, fontSize: 14, marginBottom: 8, color: "rgba(255,255,255,.88)" }}>{s.label}</p>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,.38)", lineHeight: 1.65 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AUTH0 DEEP DIVE ──────────────── */}
      <section id="auth0" style={{ padding: "120px 40px", borderTop: "1px solid rgba(255,255,255,.04)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, alignItems: "center" }}>
          <div>
            <div className="la" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 14px", borderRadius: 999, background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", color: "rgba(255,255,255,.55)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 24 }}>
              <img src="/auth0.png" alt="Auth0" style={{ width: 14, height: 14, borderRadius: 3 }} /> AUTH0 TOKEN VAULT
            </div>
            <h2 className="la" style={{ fontSize: "clamp(28px,4vw,48px)", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 20 }}>
              Zero Secrets<br />
              <span style={{ background: "linear-gradient(135deg,#34d399,#059669)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>In Your Browser</span>
            </h2>
            <p className="la" style={{ color: "rgba(255,255,255,.45)", fontSize: 16, lineHeight: 1.85, marginBottom: 32 }}>
              Your Google OAuth tokens live exclusively in Auth0's encrypted Token Vault. The frontend never sees them. The AI never stores them. Only the backend — after your explicit approval — retrieves and uses them for a single, scoped action.
            </p>
            <div className="la" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                ["🏦", "Token Vault Encryption", "Google tokens encrypted at rest in Auth0"],
                ["🔑", "Scoped Access Tokens", "Per-action, per-file token retrieval"],
                ["📊", "Immutable Audit Trail", "Every action logged with user, time, status"],
                ["↩️", "One-Click Revocation", "Revoke any service permission instantly"],
              ].map(([icon, label, desc], i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)" }}>
                  <span style={{ fontSize: 22 }}>{icon}</span>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 14, color: "rgba(255,255,255,.85)" }}>{label}</p>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,.38)" }}>{desc}</p>
                  </div>
                  <span style={{ marginLeft: "auto", fontSize: 14, color: "#34d399" }}>✓</span>
                </div>
              ))}
            </div>
          </div>

          <div className="la la-r">
            <div style={{ padding: 32, borderRadius: 24, background: "rgba(255,255,255,.025)", border: "1px solid rgba(255,255,255,.07)" }}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(255,255,255,.3)", marginBottom: 24, textAlign: "center" }}>AUTH0 TOKEN VAULT FLOW</p>
              {[
                ["Your Browser", "→", "Auth0 Universal Login", "#6366f1"],
                ["Auth0", "→", "JWT Issues to Backend", "#8b5cf6"],
                ["Google OAuth", "→", "Token Vault (Encrypted)", "#7c3aed"],
                ["Your Approval", "→", "Token Retrieved Once", "#34d399"],
                ["Backend", "→", "Execute Scoped Action", "#059669"],
                ["Vault", "→", "Token Invalidated", "#6366f1"],
              ].map(([from, arr, to, c], i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", borderBottom: i < 5 ? "1px solid rgba(255,255,255,.04)" : "none" }}>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,.38)", width: 120, textAlign: "right", flexShrink: 0 }}>{from}</span>
                  <span style={{ color: c, fontWeight: 900, fontSize: 18 }}>{arr}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.78)" }}>{to}</span>
                </div>
              ))}
              <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,.05)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["gmail:read", "gmail:send", "drive:readonly", "calendar:read", "docs:write"].map(s => (
                  <span key={s} style={{ padding: "4px 10px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: "rgba(99,102,241,.1)", border: "1px solid rgba(99,102,241,.2)", color: "#818cf8" }}>{s}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ───────────────────── */}
      <section style={{ padding: "120px 40px", borderTop: "1px solid rgba(255,255,255,.04)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="la" style={{ textAlign: "center", marginBottom: 72 }}>
            <h2 style={{ fontSize: "clamp(28px,4vw,48px)", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 16 }}>
              Everything Built for<br />
              <span style={{ background: "linear-gradient(135deg,#6366f1,#c4b5fd)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Trustworthy AI</span>
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 20 }}>
            {FEATURES.map((f, i) => (
              <div key={i} className={`la card-hover d${Math.min(i % 3 + 1, 5)}`} style={{ padding: 28, borderRadius: 20, background: "rgba(255,255,255,.025)", border: "1px solid rgba(255,255,255,.06)" }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: `${f.color}18`, border: `1px solid ${f.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 16 }}>{f.icon}</div>
                <h3 style={{ fontWeight: 800, fontSize: 15, marginBottom: 10, color: "rgba(255,255,255,.9)" }}>{f.label}</h3>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,.38)", lineHeight: 1.72 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────── */}
      <section style={{ padding: "120px 40px", borderTop: "1px solid rgba(255,255,255,.04)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,rgba(99,102,241,.06) 0%,transparent 60%)" }} />
        <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center", position: "relative", zIndex: 1 }}>
          <div className="la" style={{ padding: "64px 48px", borderRadius: 28, border: "1px solid rgba(99,102,241,.2)", background: "rgba(8,8,24,.85)", backdropFilter: "blur(32px)", boxShadow: "0 40px 120px rgba(0,0,0,.55),0 0 80px rgba(99,102,241,.07)" }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", boxShadow: "0 8px 32px rgba(99,102,241,.45)" }}>
              <Bot size={32} color="white" />
            </div>
            <h2 style={{ fontSize: "clamp(28px,4vw,44px)", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 16 }}>Authorized to Act</h2>
            <p style={{ color: "rgba(255,255,255,.47)", fontSize: 16, marginBottom: 44, lineHeight: 1.75 }}>
              The future of AI is autonomous. But it doesn't have to be uncontrollable.<br />
              <strong style={{ color: "rgba(255,255,255,.82)" }}>Try the live demo — real Google OAuth, Groq LLM, Auth0 Token Vault.</strong>
            </p>
            <a href={`${apiUrl}/login`} className="cta-btn" style={{ padding: "18px 52px", borderRadius: 18, fontSize: 16, fontWeight: 800, marginBottom: 44 }}>
              Launch Guard Agent <span style={{ fontSize: 22 }}>→</span>
            </a>
            <div style={{ display: "flex", justifyContent: "center", gap: 36, paddingTop: 36, borderTop: "1px solid rgba(255,255,255,.06)" }}>
              {[["🔐", "Auth0"], ["⚡", "Groq LLM"], ["📋", "Contracts"], ["📁", "File-Level"]].map(([icon, label]) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 22, marginBottom: 4 }}>{icon}</p>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,.3)", letterSpacing: "0.05em" }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: "28px 40px", borderTop: "1px solid rgba(255,255,255,.04)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 7, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center" }}><Bot size={12} color="white" /></div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,.4)" }}>Guard Agent · Auth0 Token Vault · Groq LLM · Firecrawl</span>
        </div>
        <p style={{ fontSize: 12, color: "rgba(255,255,255,.2)" }}>Hackathon 2026 · Selective Scope Authorization</p>
      </footer>
    </div>
  );
}
