"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, LogOut, Bot, Settings, Plus, MessageSquare, Trash2, Pencil, ChevronLeft, ChevronRight, User
} from "lucide-react";
import {
  FaCalendarCheck, FaLock, FaClipboardList, FaQuestionCircle,
  FaUndo, FaBan, FaTimesCircle, FaCheckCircle, FaEnvelope,
  FaPencilAlt, FaRobot, FaTimes, FaExclamationTriangle, FaFileAlt
} from "react-icons/fa";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import LandingPage from "./LandingPage";


// ─────────────────────────────────────────────────────────────────────────────

type ContractInfo = {
  contract_id: string;
  action_title: string;
  action: string;
  args: Record<string, string | number>;
  steps: string[];
  permissions_needed: { scope: string; reason: string }[];
  data_used: string[];
  data_not_used: string[];
  risk_level: "Low" | "Medium" | "High";
  risk_reason: string;
  reversible: boolean;
  reversible_description: string;
  estimated_time: string;
  _status?: "pending" | "approved" | "rejected" | "executed";
  _execution_success?: boolean;
  _result?: string;
  _editing?: boolean;
  _editedArgs?: Record<string, string>;
  selectable_resources?: { id: string; name: string; selected: boolean }[];
};

type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  permission_request?: {
    service: string;
    reason: string;
    connect_url: string;
    action?: string;
    _loadingExplanation?: boolean;
    _rejected?: boolean;
    _approved?: boolean;
    _explanation?: string;
  };
  action_contract?: ContractInfo;
  is_email_animation?: boolean;
  is_calendar_animation?: boolean;
  is_document_animation?: boolean;
};

type Session = {
  id: string;
  name: string;
  updated_at: string;
  message_count: number;
};

type HistoryEntry = {
  log_id: string;
  action: string;
  status: string;
  service_used: string;
  permissions_used: string[];
  timestamp: string;
  metadata: Record<string, any>;
};

const WELCOME: Message = {
  id: "welcome",
  role: "assistant",
  content: "Hello! I'm your AI Assistant. I can read your emails, send emails, check your calendar, create events, and help you create and edit documents. What can I do for you today?",
};

// ─────────────────────────────────────────────────────────────────────────────
// Settings / History Control Panel
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  success:              { bg: "rgba(16,185,129,0.08)",  text: "#10b981", dot: "bg-emerald-400" },
  failure:              { bg: "rgba(239,68,68,0.08)",   text: "#ef4444", dot: "bg-red-400" },
  permission_requested: { bg: "rgba(245,158,11,0.10)",  text: "#f59e0b", dot: "bg-amber-400" },
};

const ACTION_ICONS: Record<string, string> = {
  send_email: "📧", read_emails: "📬", read_calendar: "📅",
  create_calendar_event: "🗓️", create_document: "📝", edit_document: "✏️",
  template_document: "📄", search_drive: "🔍", read_drive_file: "📂",
  research_topic: "🌐",
};

function SettingsPanel({ open, onClose, history, loading }: {
  open: boolean;
  onClose: () => void;
  history: HistoryEntry[];
  loading: boolean;
}) {
  if (!open) return null;
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40"
        style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }}
      />
      {/* Sliding panel */}
      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col"
        style={{
          width: "min(420px, 100vw)",
          background: "linear-gradient(160deg, #f8faff 0%, #f0f4ff 100%)",
          borderLeft: "1px solid rgba(99,102,241,0.12)",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.12)",
        }}
      >
        {/* Panel header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-none"
          style={{
            background: "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08))",
            borderBottom: "1px solid rgba(99,102,241,0.1)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 2px 12px rgba(99,102,241,0.35)" }}
            >
              <Settings size={17} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm">Control Panel</p>
              <p className="text-[10px] text-slate-500">Permission & Action Timeline</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
          >
            <FaTimes size={13} />
          </button>
        </div>

        {/* Stats bar */}
        <div className="flex gap-2 px-4 py-3 flex-none" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
          {[
            { label: "Total Actions", value: history.length, icon: "⚡" },
            { label: "Successful",    value: history.filter(h => h.status === "success").length, icon: "✅" },
            { label: "Permissions",   value: history.filter(h => h.status === "permission_requested").length, icon: "🔐" },
          ].map(stat => (
            <div
              key={stat.label}
              className="flex-1 rounded-xl p-2.5 text-center"
              style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(99,102,241,0.08)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
            >
              <p className="text-lg font-bold text-slate-800">{stat.icon} {stat.value}</p>
              <p className="text-[10px] text-slate-500 leading-tight">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-indigo-300 border-t-indigo-600 animate-spin" />
              <p className="text-xs text-slate-400">Loading timeline…</p>
            </div>
          )}
          {!loading && history.length === 0 && (
            <div className="flex flex-col items-center justify-center py-14 gap-3">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(99,102,241,0.08)" }}>
                <FaClipboardList className="text-indigo-400" size={20} />
              </div>
              <p className="text-sm font-medium text-slate-500">No actions yet</p>
              <p className="text-xs text-slate-400 text-center">Your permission grants and agent actions will appear here.</p>
            </div>
          )}
          {!loading && history.map((entry, i) => {
            const colors = STATUS_COLORS[entry.status] ?? { bg: "rgba(0,0,0,0.04)", text: "#64748b", dot: "bg-slate-300" };
            const icon = ACTION_ICONS[entry.action] ?? "🤖";
            const date = new Date(entry.timestamp);
            const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            const dateStr = date.toLocaleDateString([], { month: "short", day: "numeric" });
            return (
              <div
                key={entry.log_id}
                className="rounded-xl p-3 flex gap-3 items-start"
                style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(99,102,241,0.07)", boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}
              >
                {/* Timeline dot + line */}
                <div className="flex flex-col items-center gap-1 flex-none pt-0.5">
                  <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                  {i < history.length - 1 && <div className="w-px flex-1 min-h-[12px]" style={{ background: "rgba(0,0,0,0.07)" }} />}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-xs font-semibold text-slate-700 leading-tight">
                      {icon} {entry.action.replace(/_/g, " ")}
                    </p>
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md flex-none"
                      style={{ background: colors.bg, color: colors.text }}
                    >
                      {entry.status.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-slate-400">{entry.service_used}</span>
                    {entry.permissions_used?.filter(Boolean).map((p, pi) => (
                      <span key={pi} className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: "rgba(99,102,241,0.08)", color: "#6366f1" }}>{p}</span>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">{dateStr} · {timeStr}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          className="flex-none px-4 py-3 text-center"
          style={{ borderTop: "1px solid rgba(0,0,0,0.05)", background: "rgba(255,255,255,0.6)" }}
        >
          <p className="text-[10px] text-slate-400">All actions are secured & logged · Auth0 Token Vault</p>
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Animations
// ─────────────────────────────────────────────────────────────────────────────

const CalendarSuccessAnimation = () => {
  const [phase, setPhase] = useState<"idle" | "appearing" | "glowing" | "success">("idle");
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("appearing"), 100);
    const t2 = setTimeout(() => setPhase("glowing"), 800);
    const t3 = setTimeout(() => setPhase("success"), 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);
  return (
    <div className="relative w-[320px] sm:w-[480px] shrink-0 max-w-[100vw] mx-auto h-[200px] overflow-hidden rounded-xl bg-gradient-to-b from-[#e8f5e9] via-[#f1f8e9] to-[#f9fbe7] my-3 border border-slate-200 shadow-sm">
      <style>{`
        .cal-star{position:absolute;width:4px;height:4px;background:#fdd835;border-radius:50%;opacity:0}
        .cal-star1{top:20%;left:15%;animation:starTwinkle 2s ease-in-out infinite 0s}
        .cal-star2{top:30%;left:80%;animation:starTwinkle 2s ease-in-out infinite 0.5s}
        .cal-star3{top:15%;left:50%;animation:starTwinkle 2s ease-in-out infinite 1s}
        .cal-star4{top:40%;left:25%;animation:starTwinkle 2s ease-in-out infinite 0.3s}
        .cal-star5{top:25%;left:70%;animation:starTwinkle 2s ease-in-out infinite 0.8s}
        @keyframes starTwinkle{0%,100%{opacity:0;transform:scale(0)}50%{opacity:1;transform:scale(1)}}
        .cal-icon{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(0);color:#4caf50}
        .cal-icon.appearing{animation:calPop 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards}
        .cal-icon.glowing{animation:calGlow 0.8s ease-in-out forwards}
        .cal-icon.success{animation:calBounce 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards}
        @keyframes calPop{0%{transform:translate(-50%,-50%) scale(0) rotate(-20deg);opacity:0}100%{transform:translate(-50%,-50%) scale(1) rotate(0deg);opacity:1}}
        @keyframes calGlow{0%{transform:translate(-50%,-50%) scale(1);filter:drop-shadow(0 0 0 rgba(76,175,80,0))}50%{transform:translate(-50%,-50%) scale(1.1);filter:drop-shadow(0 0 20px rgba(76,175,80,0.6))}100%{transform:translate(-50%,-50%) scale(1);filter:drop-shadow(0 0 10px rgba(76,175,80,0.3))}}
        @keyframes calBounce{0%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-60%) scale(1.15)}100%{transform:translate(-50%,-50%) scale(1)}}
        .cal-ring{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(0);width:80px;height:80px;border:3px solid #4caf50;border-radius:50%;opacity:0;pointer-events:none}
        .cal-ring.show{animation:ringExpand 0.6s cubic-bezier(0.22,1,0.36,1) forwards}
        @keyframes ringExpand{0%{transform:translate(-50%,-50%) scale(0);opacity:0.8}100%{transform:translate(-50%,-50%) scale(2.5);opacity:0}}
        .cal-checkmark{position:absolute;left:50%;top:50%;transform:translate(-50%,20px) scale(0);opacity:0;color:#4caf50}
        .cal-checkmark.show{animation:checkPop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards}
        @keyframes checkPop{0%{transform:translate(-50%,20px) scale(0);opacity:0}100%{transform:translate(-50%,20px) scale(1);opacity:1}}
      `}</style>
      <div className="cal-star cal-star1" /><div className="cal-star cal-star2" /><div className="cal-star cal-star3" /><div className="cal-star cal-star4" /><div className="cal-star cal-star5" />
      <div className={`cal-icon ${phase === "appearing" ? "appearing" : phase === "glowing" ? "glowing" : phase === "success" ? "success" : ""}`}><FaCalendarCheck size={64} /></div>
      <div className={`cal-ring ${phase === "success" ? "show" : ""}`} />
      <div className={`cal-checkmark ${phase === "success" ? "show" : ""}`}><FaCheckCircle size={28} /></div>
      {phase === "success" && <div className="absolute bottom-4 left-0 right-0 text-center"><p className="text-sm font-bold text-slate-700">Event Created Successfully!</p></div>}
    </div>
  );
};

const EmailSuccessAnimation = () => {
  const [phase, setPhase] = useState<"idle" | "opening" | "launched" | "success">("idle");
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("opening"), 100);
    const t2 = setTimeout(() => setPhase("launched"), 1200);
    const t3 = setTimeout(() => setPhase("success"), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);
  return (
    <div className="relative w-[320px] sm:w-[480px] shrink-0 max-w-[100vw] mx-auto h-[200px] overflow-hidden rounded-xl bg-gradient-to-b from-[#dce9f5] via-[#eef5fb] to-[#f5f9ff] my-3 border border-slate-200 shadow-sm">
      <style>{`
        .cloud{position:absolute;background:white;border-radius:50px;opacity:0.7}
        .cloud::before,.cloud::after{content:'';position:absolute;background:white;border-radius:50%}
        .cloud1{width:60px;height:18px;top:30px;left:-90px;animation:cloudMove1 8s linear infinite}
        .cloud1::before{width:28px;height:28px;top:-14px;left:10px}
        .cloud1::after{width:20px;height:20px;top:-10px;left:26px}
        @keyframes cloudMove1{from{left:-90px}to{left:110%}}
        .envelope-wrap{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);transition:all 0.2s}
        .envelope-wrap.launched{animation:flyOut 1.2s cubic-bezier(0.4,0,0.2,1) forwards}
        @keyframes flyOut{0%{transform:translate(-50%,-50%) scale(1) rotate(0deg);opacity:1}30%{transform:translate(-30%,-80%) scale(0.9) rotate(-8deg);opacity:1}70%{transform:translate(60%,-160%) scale(0.6) rotate(-15deg);opacity:0.8}100%{transform:translate(160%,-260%) scale(0.3) rotate(-20deg);opacity:0}}
        .envelope{width:90px;height:60px;position:relative;filter:drop-shadow(0 8px 20px rgba(74,111,165,0.18))}
        .env-body{width:90px;height:60px;background:#fff;border:1.5px solid #c5d3e8;border-radius:4px;position:relative;overflow:hidden}
        .env-line-left{position:absolute;bottom:0;left:0;width:45px;height:38px;border-right:1.5px solid #c5d3e8;clip-path:polygon(0 100%,100% 0,100% 100%);background:#f0f4ff}
        .env-line-right{position:absolute;bottom:0;right:0;width:45px;height:38px;clip-path:polygon(0 0,100% 100%,0 100%);background:#eef3fa;border-left:1.5px solid #c5d3e8}
        .env-flap{position:absolute;top:0;left:0;width:90px;height:38px;clip-path:polygon(0 0,45px 30px,90px 0);background:#f0f4ff;border-bottom:1.5px solid #c5d3e8;transition:clip-path 0.4s ease;z-index:2}
        .envelope.open .env-flap{clip-path:polygon(0 30px,45px 0,90px 30px)}
        .letter{position:absolute;width:60px;height:40px;background:#f7f9ff;border:1px solid #d8e4f0;border-radius:3px;left:50%;top:56%;transform:translate(-50%,-50%);z-index:1;padding:5px 6px;transition:transform 0.4s cubic-bezier(0.34,1.56,0.64,1),opacity 0.3s;opacity:0}
        .envelope.open .letter{transform:translate(-50%,-90%);opacity:1}
        .letter-line{height:2px;background:#c5d8ed;border-radius:2px;margin-bottom:4px}
        .success-ring{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(0);width:80px;height:80px;border:3px solid #2ecc71;border-radius:50%;opacity:0;pointer-events:none}
        .success-ring.show{animation:ringExpand2 0.6s cubic-bezier(0.22,1,0.36,1) forwards}
        @keyframes ringExpand2{0%{transform:translate(-50%,-50%) scale(0);opacity:0.8}100%{transform:translate(-50%,-50%) scale(2.5);opacity:0}}
        .checkmark{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(0);font-size:36px;opacity:0;color:#2ecc71;line-height:1}
        .checkmark.show{animation:checkPop2 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards}
        @keyframes checkPop2{0%{transform:translate(-50%,-50%) scale(0);opacity:0}100%{transform:translate(-50%,-50%) scale(1);opacity:1}}
      `}</style>
      <div className="cloud cloud1" />
      <div className={`envelope-wrap ${phase === "launched" || phase === "success" ? "launched" : ""}`}>
        <div className={`envelope ${phase === "opening" ? "open" : ""}`}>
          <div className="env-body">
            <div className="env-line-left" /><div className="env-line-right" />
            <div className="letter">
              <div className="letter-line" style={{ width: "80%" }} /><div className="letter-line" style={{ width: "95%" }} />
              <div className="letter-line" style={{ width: "60%" }} /><div className="letter-line" style={{ width: "85%", marginBottom: 0 }} />
            </div>
            <div className="env-flap" />
          </div>
        </div>
      </div>
      <div className={`success-ring ${phase === "success" ? "show" : ""}`} />
      <div className={`checkmark ${phase === "success" ? "show" : ""}`}>&#10003;</div>
      {phase === "success" && <div className="absolute bottom-4 left-0 right-0 text-center"><p className="text-sm font-bold text-slate-700">Email Sent Successfully!</p></div>}
    </div>
  );
};

const DocumentSuccessAnimation = () => {
  const [phase, setPhase] = useState<"idle" | "appearing" | "glowing" | "success">("idle");
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("appearing"), 100);
    const t2 = setTimeout(() => setPhase("glowing"), 800);
    const t3 = setTimeout(() => setPhase("success"), 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);
  return (
    <div className="relative w-[320px] sm:w-[480px] shrink-0 max-w-[100vw] mx-auto h-[200px] overflow-hidden rounded-xl bg-gradient-to-b from-[#e3f2fd] via-[#f5f9ff] to-[#f5f5f5] my-3 border border-slate-200 shadow-sm">
      <style>{`
        .doc-star{position:absolute;width:4px;height:4px;background:#64b5f6;border-radius:50%;opacity:0}
        .doc-star1{top:20%;left:15%;animation:docStarTwinkle 2s ease-in-out infinite 0s}
        .doc-star2{top:30%;left:80%;animation:docStarTwinkle 2s ease-in-out infinite 0.5s}
        .doc-star3{top:15%;left:50%;animation:docStarTwinkle 2s ease-in-out infinite 1s}
        .doc-star4{top:40%;left:25%;animation:docStarTwinkle 2s ease-in-out infinite 0.3s}
        .doc-star5{top:25%;left:70%;animation:docStarTwinkle 2s ease-in-out infinite 0.8s}
        @keyframes docStarTwinkle{0%,100%{opacity:0;transform:scale(0)}50%{opacity:1;transform:scale(1)}}
        .doc-icon{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(0);color:#1976d2}
        .doc-icon.appearing{animation:docPop 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards}
        .doc-icon.glowing{animation:docGlow 0.8s ease-in-out forwards}
        .doc-icon.success{animation:docBounce 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards}
        @keyframes docPop{0%{transform:translate(-50%,-50%) scale(0) rotate(-20deg);opacity:0}100%{transform:translate(-50%,-50%) scale(1) rotate(0deg);opacity:1}}
        @keyframes docGlow{0%{transform:translate(-50%,-50%) scale(1);filter:drop-shadow(0 0 0 rgba(25,118,210,0))}50%{transform:translate(-50%,-50%) scale(1.1);filter:drop-shadow(0 0 20px rgba(25,118,210,0.6))}100%{transform:translate(-50%,-50%) scale(1);filter:drop-shadow(0 0 10px rgba(25,118,210,0.3))}}
        @keyframes docBounce{0%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-60%) scale(1.15)}100%{transform:translate(-50%,-50%) scale(1)}}
        .doc-ring{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(0);width:80px;height:80px;border:3px solid #1976d2;border-radius:50%;opacity:0;pointer-events:none}
        .doc-ring.show{animation:docRingExpand 0.6s cubic-bezier(0.22,1,0.36,1) forwards}
        @keyframes docRingExpand{0%{transform:translate(-50%,-50%) scale(0);opacity:0.8}100%{transform:translate(-50%,-50%) scale(2.5);opacity:0}}
        .doc-checkmark{position:absolute;left:50%;top:50%;transform:translate(-50%,20px) scale(0);opacity:0;color:#1976d2}
        .doc-checkmark.show{animation:docCheckPop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards}
        @keyframes docCheckPop{0%{transform:translate(-50%,20px) scale(0);opacity:0}100%{transform:translate(-50%,20px) scale(1);opacity:1}}
      `}</style>
      <div className="doc-star doc-star1" /><div className="doc-star doc-star2" /><div className="doc-star doc-star3" /><div className="doc-star doc-star4" /><div className="doc-star doc-star5" />
      <div className={`doc-icon ${phase === "appearing" ? "appearing" : phase === "glowing" ? "glowing" : phase === "success" ? "success" : ""}`}><FaFileAlt size={64} /></div>
      <div className={`doc-ring ${phase === "success" ? "show" : ""}`} />
      <div className={`doc-checkmark ${phase === "success" ? "show" : ""}`}><FaCheckCircle size={28} /></div>
      {phase === "success" && <div className="absolute bottom-4 left-0 right-0 text-center"><p className="text-sm font-bold text-slate-700">Document Created Successfully!</p></div>}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

const API_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")
    : "http://localhost:8000";


// ─────────────────────────────────────────────────────────────────────────────


function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Chat Page
// ─────────────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<{ name: string; picture: string } | null>(null);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [autoSubmit, setAutoSubmit] = useState<string | null>(null);
  const lastUserQuery = useRef<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Settings / History ───────────────────────────────────────────────────────
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_URL}/history`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setHistoryEntries(data.history || []);
      }
    } catch { }
    finally { setHistoryLoading(false); }
  }, []);

  const openSettings = () => {
    setSettingsOpen(true);
    loadHistory();
  };

  useEffect(() => {
    if (autoSubmit) {
      setAutoSubmit(null);
      handleSendMessage(autoSubmit);
    }
  }, [autoSubmit]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const returnSession = params.get("session");
    fetch(`${API_URL}/me`, { credentials: "include" })
      .then((r) => r.json())
      .catch(() => ({ isAuthenticated: false }))
      .then((data) => {
        setIsAuthenticated(data.isAuthenticated);
        setUser(data.user);
        setIsLoading(false);
        if (data.isAuthenticated) {
          loadSessions(returnSession ?? undefined);
          const pendingRaw = localStorage.getItem("pending_intent");
          if (pendingRaw) {
            try {
              const pending = JSON.parse(pendingRaw);
              localStorage.removeItem("pending_intent");
              setTimeout(() => {
                setActiveSessionId(pending.session_id ?? null);
                setInput(pending.message);
                setTimeout(() => { setAutoSubmit(pending.message); }, 300);
              }, 600);
            } catch { }
          }
        }
      });
  }, []);

  const loadSessions = useCallback(async (selectId?: string) => {
    const res = await fetch(`${API_URL}/sessions`, { credentials: "include" });
    if (!res.ok) return;
    const data = await res.json();
    const list: Session[] = data.sessions || [];
    setSessions(list);
    const target = selectId ?? list[0]?.id ?? null;
    if (target) openSession(target);
  }, []);

  const openSession = async (sessionId: string) => {
    setActiveSessionId(sessionId);
    const res = await fetch(`${API_URL}/sessions/${sessionId}/messages`, { credentials: "include" });
    if (!res.ok) { setMessages([WELCOME]); return; }
    const data = await res.json();
    setMessages(data.messages.length ? data.messages : [WELCOME]);
  };

  const newSession = async () => {
    const res = await fetch(`${API_URL}/sessions`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const session = await res.json();
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
    setMessages([WELCOME]);
  };

  const deleteSession = async (sessionId: string) => {
    await fetch(`${API_URL}/sessions/${sessionId}`, { method: "DELETE", credentials: "include" });
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    if (activeSessionId === sessionId) {
      const remaining = sessions.filter((s) => s.id !== sessionId);
      if (remaining.length) openSession(remaining[0].id);
      else { setActiveSessionId(null); setMessages([WELCOME]); }
    }
  };

  const saveRename = async (sessionId: string) => {
    if (!editingName.trim()) { setEditingSessionId(null); return; }
    await fetch(`${API_URL}/sessions/${sessionId}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editingName }),
    });
    setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, name: editingName } : s)));
    setEditingSessionId(null);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send Message ────────────────────────────────────────────────────────────

  const handleSendMessage = async (text: string, currentSessionId?: string | null) => {
    const sid = currentSessionId !== undefined ? currentSessionId : activeSessionId;
    if (!text.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text.trim() };
    setMessages((prev) => [...prev.filter((m) => m.id !== "welcome"), userMsg]);
    setInput("");
    setSending(true);
    try {
      const apiMessages = [userMsg].map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ messages: apiMessages, session_id: sid }),
      });
      const data = await res.json();
      if (data.session_id) {
        const newSid = data.session_id;
        setActiveSessionId(newSid);
        setSessions((prev) =>
          prev.find((s) => s.id === newSid)
            ? prev.map((s) => s.id === newSid ? { ...s, updated_at: new Date().toISOString(), message_count: s.message_count + 2 } : s)
            : [{ id: newSid, name: `Session ${new Date().toLocaleTimeString()}`, updated_at: new Date().toISOString(), message_count: 2 }, ...prev]
        );
      }
      if (data.permission_request) {
        const pr = data.permission_request;
        localStorage.setItem("pending_intent", JSON.stringify({ message: text.trim(), session_id: data.session_id ?? sid }));
        setMessages((prev) => [...prev, { id: Date.now().toString(), role: "assistant", content: `I need access to **${pr.service}** to do that: *${pr.reason}*.`, permission_request: pr }]);
      } else if (data.action_contract) {
        const contract = data.action_contract;
        const tempId = Date.now().toString();
        const msgText = `I want to **${contract.action_title}** on your behalf. Please review the Action Contract below.`;
        setMessages((prev) => [...prev, { id: tempId, role: "assistant", content: msgText, action_contract: { ...contract, _status: "pending" } }]);
        fetch(`${API_URL}/sessions/${data.session_id ?? sid}/messages`, {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "assistant", content: msgText, action_contract: { ...contract, _status: "pending" } }),
        }).then(r => r.json()).then(r => { if (r.id) setMessages((prev) => prev.map(m => m.id === tempId ? { ...m, id: r.id } : m)); }).catch(console.error);
      } else if (data.messages) {
        const finalMsg = data.messages[data.messages.length - 1];
        setMessages((prev) => [...prev, { id: Date.now().toString(), role: "assistant", content: finalMsg.content || "Done! Anything else?" }]);
      }
    } catch {
      setMessages((prev) => [...prev, { id: Date.now().toString(), role: "assistant", content: "Sorry, I encountered an error. Is the backend running?" }]);
    } finally {
      setSending(false);
    }
  };

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || sending) return;
    lastUserQuery.current = input.trim();
    handleSendMessage(input.trim());
  };

  // ── Contract: Approve ───────────────────────────────────────────────────────

  const handleContractApprove = async (msgId: string, contract: ContractInfo) => {
    setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, action_contract: { ...m.action_contract!, _status: "approved" } } : m));
    setSending(true);
    try {
      const payload = {
        edited_args: contract._editedArgs ?? null,
        selected_file_ids: contract.selectable_resources ? contract.selectable_resources.filter(r => r.selected).map(r => r.id) : undefined,
      };
      const res = await fetch(`${API_URL}/contract/execute/${contract.contract_id}`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.type === "permission_request" || data.permission_request) {
        const pr = data.type === "permission_request" ? data : data.permission_request;
        localStorage.setItem("pending_intent", JSON.stringify({ message: "Retry the approved Action Contract", session_id: activeSessionId }));
        setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, action_contract: { ...m.action_contract!, _status: "pending" } } : m));
        setMessages((prev) => [...prev, { id: Date.now().toString(), role: "assistant", content: `Oops, your access to **${pr.service}** has expired. Please re-authorize.`, permission_request: pr }]);
        return;
      }
      const success = data.status === "success";
      const isEmail = contract.action.includes("email");
      const isCalendar = contract.action.includes("calendar");
      const isDocument = contract.action.includes("document");
      const resultText = success
        ? `✅ Done! The action completed successfully.${data.result ? "\n\n" + JSON.stringify(data.result, null, 2) : ""}`
        : `❌ Error: ${data.error || "Unknown error"}`;
      const updatedContract = { ...contract, _status: "executed" as const, _execution_success: success, _result: resultText };
      setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, action_contract: updatedContract } : m));
      fetch(`${API_URL}/sessions/${activeSessionId}/messages/${msgId}`, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action_contract: updatedContract }),
      }).catch(console.error);

      const persistAndShow = (animKey: "is_email_animation" | "is_calendar_animation" | "is_document_animation" | null, text?: string) => {
        const tempId = Date.now().toString();
        const newMsg: Message = animKey
          ? { id: tempId, role: "assistant", content: "", [animKey]: true }
          : { id: tempId, role: "assistant", content: text! };
        setMessages((prev) => [...prev, newMsg]);
        const body = animKey ? { role: "assistant", content: "", [animKey]: true } : { role: "assistant", content: text };
        fetch(`${API_URL}/sessions/${activeSessionId}/messages`, {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        }).then(r => r.json()).then(r => { if (r.id) setMessages((prev) => prev.map(m => m.id === tempId ? { ...m, id: r.id } : m)); }).catch(console.error);
      };

      if (success && isEmail) persistAndShow("is_email_animation");
      else if (success && isCalendar) persistAndShow("is_calendar_animation");
      else if (success && isDocument) persistAndShow("is_document_animation");
      else if (success && contract.action === "read_drive_file") {
        // Embed the actual file content in the prompt so the LLM has context to summarize.
        const fileContents = data.result
          ? (typeof data.result === "string"
              ? data.result
              : JSON.stringify(data.result, null, 2))
          : "(no content returned)";
        const summaryUserMsg = `Here are the file contents I just retrieved from Google Drive:\n\n${fileContents}\n\nPlease provide a clear, concise summary of this content for me.`;
        const summaryUserMsgObj: Message = { id: Date.now().toString(), role: "user", content: summaryUserMsg };
        setMessages((prev) => [...prev, summaryUserMsgObj]);
        setSending(true);
        try {
          const summarizeRes = await fetch(`${API_URL}/chat`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [{ role: "user", content: summaryUserMsg }],
              session_id: activeSessionId,
            }),
          });
          const summarizeData = await summarizeRes.json();
          const summaryText =
            summarizeData.messages?.[summarizeData.messages.length - 1]?.content
            || "Here is what I found in the files you selected.";
          const summaryMsgId = Date.now().toString();
          const summaryMsg: Message = { id: summaryMsgId, role: "assistant", content: summaryText };
          setMessages((prev) => [...prev, summaryMsg]);
          // Persist both messages to the session
          fetch(`${API_URL}/sessions/${activeSessionId}/messages`, {
            method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: "user", content: summaryUserMsg }),
          }).catch(console.error);
          fetch(`${API_URL}/sessions/${activeSessionId}/messages`, {
            method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: "assistant", content: summaryText }),
          }).catch(console.error);
        } catch {
          setMessages((prev) => [...prev, { id: Date.now().toString(), role: "assistant", content: "Files were read successfully, but I couldn't generate a summary. Please try asking me to summarize them." }]);
        } finally {
          setSending(false);
        }
      }
      else persistAndShow(null, resultText);
    } catch {
      setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, action_contract: { ...m.action_contract!, _status: "pending" } } : m));
    } finally {
      setSending(false);
    }
  };

  // ── Contract: Reject ────────────────────────────────────────────────────────

  const handleContractReject = async (msgId: string, contract: ContractInfo) => {
    const updatedContract = { ...contract, _status: "rejected" as const };
    setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, action_contract: updatedContract } : m));
    fetch(`${API_URL}/sessions/${activeSessionId}/messages/${msgId}`, {
      method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action_contract: updatedContract }),
    }).catch(console.error);
    try {
      const res = await fetch(`${API_URL}/contract/reject/${contract.contract_id}`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "User rejected the contract" }),
      });
      const data = await res.json();
      const tempId = Date.now().toString();
      const cancelText = data.agent_message || "Understood. I won't proceed with that action.";
      setMessages((prev) => [...prev, { id: tempId, role: "assistant", content: cancelText }]);
      fetch(`${API_URL}/sessions/${activeSessionId}/messages`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: "assistant", content: cancelText }),
      }).then(r => r.json()).then(r => { if (r.id) setMessages((prev) => prev.map(m => m.id === tempId ? { ...m, id: r.id } : m)); }).catch(console.error);
    } catch { }
  };

  // ── Contract: Edit ──────────────────────────────────────────────────────────

  const handleContractEdit = (msgId: string, contract: ContractInfo) => {
    setMessages((prev) => prev.map((m) =>
      m.id === msgId ? {
        ...m,
        action_contract: {
          ...m.action_contract!,
          _editing: !m.action_contract?._editing,
          _editedArgs: m.action_contract?._editedArgs ?? Object.fromEntries(Object.entries(contract.args).map(([k, v]) => [k, String(v)])),
        },
      } : m
    ));
  };

  // ── Contract: Arg Change ────────────────────────────────────────────────────

  const handleContractArgChange = (msgId: string, key: string, value: string) => {
    setMessages((prev) => prev.map((m) =>
      m.id === msgId && m.action_contract ? {
        ...m,
        action_contract: { ...m.action_contract, _editedArgs: { ...m.action_contract._editedArgs, [key]: value } },
      } : m
    ));
  };

  // ── Resource Toggle ─────────────────────────────────────────────────────────

  const handleResourceToggle = (msgId: string, resourceId: string) => {
    setMessages((prev) => prev.map((m) =>
      m.id === msgId && m.action_contract?.selectable_resources ? {
        ...m,
        action_contract: {
          ...m.action_contract,
          selectable_resources: m.action_contract.selectable_resources.map(r => r.id === resourceId ? { ...r, selected: !r.selected } : r),
        },
      } : m
    ));
  };

  // ── Permission: Explain ─────────────────────────────────────────────────────

  const handleExplain = async (msgId: string, action: string) => {
    setMessages((prev) => prev.map((m) =>
      m.id === msgId && m.permission_request ? { ...m, permission_request: { ...m.permission_request, _loadingExplanation: true } } : m
    ));
    try {
      const res = await fetch(`${API_URL}/permission/explain`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
      });
      const data = await res.json();
      setMessages((prev) => prev.map((m) =>
        m.id === msgId && m.permission_request ? { ...m, permission_request: { ...m.permission_request, _loadingExplanation: false, _explanation: data.explanation || "This permission is required to complete your request." } } : m
      ));
    } catch {
      setMessages((prev) => prev.map((m) =>
        m.id === msgId && m.permission_request ? { ...m, permission_request: { ...m.permission_request, _loadingExplanation: false, _explanation: "This permission is needed to complete your request." } } : m
      ));
    }
  };

  // ── Permission: Approve ─────────────────────────────────────────────────────

  const handleApprove = (msgId: string, pr: NonNullable<Message["permission_request"]>, originalQuery: string) => {
    setMessages((prev) => prev.map((m) =>
      m.id === msgId && m.permission_request ? { ...m, permission_request: { ...m.permission_request, _approved: true } } : m
    ));
    localStorage.setItem("pending_intent", JSON.stringify({ message: originalQuery, session_id: activeSessionId }));
    window.location.href = pr.connect_url;
  };

  // ── Permission: Reject ──────────────────────────────────────────────────────

  const handleReject = (msgId: string, action: string) => {
    setMessages((prev) => prev.map((m) =>
      m.id === msgId && m.permission_request ? { ...m, permission_request: { ...m.permission_request, _rejected: true } } : m
    ));
  };

  // ── Loading / Auth guard ────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center animate-pulse" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
            <Bot size={20} className="text-white" />
          </div>
          <p className="text-sm text-slate-400 font-medium">Loading…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <LandingPage apiUrl={API_URL} />;

  // ── Risk colour helper ──────────────────────────────────────────────────────

  const riskColorMap: Record<string, string> = {
    Low: "text-emerald-500",
    Medium: "text-amber-500",
    High: "text-red-500",
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%)" }}>

      {/* ── Sidebar ── */}
      <div
        className={`flex-none flex flex-col transition-all duration-300 ${sidebarOpen ? "w-64" : "w-0 overflow-hidden"}`}
        style={{ background: "rgba(255,255,255,0.8)", backdropFilter: "blur(20px)", borderRight: "1px solid rgba(0,0,0,0.06)" }}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-4 py-4" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
              <Bot size={14} className="text-white" />
            </div>
            <span className="font-bold text-slate-800 text-sm">Guard Agent</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
            <ChevronLeft size={16} />
          </button>
        </div>

        {/* New session */}
        <div className="px-3 py-3">
          <button onClick={newSession} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-95" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 2px 8px rgba(99,102,241,0.3)" }}>
            <Plus size={15} /> New Session
          </button>
        </div>

        {/* Session list */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => openSession(session.id)}
              className={`group relative flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${activeSessionId === session.id ? "text-indigo-700" : "text-slate-600 hover:bg-slate-50"}`}
              style={activeSessionId === session.id ? { background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.12)" } : {}}
            >
              <MessageSquare size={13} className="flex-none opacity-60" />
              {editingSessionId === session.id ? (
                <input
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => saveRename(session.id)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveRename(session.id); if (e.key === "Escape") setEditingSessionId(null); }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 text-xs bg-transparent border-none outline-none font-medium"
                />
              ) : (
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{session.name}</p>
                  <p className="text-[10px] opacity-50">{formatDate(session.updated_at)}</p>
                </div>
              )}
              <div className="hidden group-hover:flex gap-1 absolute right-2">
                <button onClick={(e) => { e.stopPropagation(); setEditingSessionId(session.id); setEditingName(session.name); }} className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"><Pencil size={11} /></button>
                <button onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }} className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"><Trash2 size={11} /></button>
              </div>
            </div>
          ))}
        </div>

        {/* User footer */}
        <div className="px-3 py-3" style={{ borderTop: "1px solid rgba(0,0,0,0.05)" }}>
          <div className="flex items-center gap-2 px-2 py-2 rounded-xl" style={{ background: "rgba(0,0,0,0.02)" }}>
            {user?.picture ? (
              <img src={user.picture} alt={user.name} className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center"><User size={13} className="text-indigo-500" /></div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-700 truncate">{user?.name || "User"}</p>
            </div>
            <a href={`${API_URL}/logout`} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all" title="Sign out"><LogOut size={13} /></a>
          </div>
        </div>
      </div>

      {/* ── Main chat area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <div className="flex-none flex items-center gap-3 px-4 py-3" style={{ background: "rgba(255,255,255,0.8)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          {!sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
              <ChevronRight size={16} />
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))", border: "1px solid rgba(99,102,241,0.1)" }}>
              <Bot size={14} className="text-indigo-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">AI Assistant</p>
              <p className="text-[10px] text-emerald-500 font-medium flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />Online</p>
            </div>
          </div>
          {/* Settings button */}
          <button
            onClick={openSettings}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
            title="Control Panel & History"
          >
            <Settings size={14} />
            Settings
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-2xl mx-auto space-y-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {/* Avatar for assistant */}
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center mr-2.5 mt-auto flex-none" style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))", border: "1px solid rgba(99,102,241,0.1)" }}>
                    <Bot size={16} className="text-indigo-500" />
                  </div>
                )}

                <div className={`max-w-[80%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
                  {/* Animations */}
                  {!!msg.is_email_animation && <EmailSuccessAnimation />}
                  {!!msg.is_calendar_animation && <CalendarSuccessAnimation />}
                  {!!msg.is_document_animation && <DocumentSuccessAnimation />}

                  {/* Bubble */}
                  {msg.content && (
                    <div
                      className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === "user"
                          ? "text-white rounded-br-md"
                          : "text-slate-700 rounded-bl-md"
                        }`}
                      style={
                        msg.role === "user"
                          ? { background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 2px 12px rgba(99,102,241,0.3)" }
                          : { background: "rgba(255,255,255,0.8)", backdropFilter: "blur(20px)", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }
                      }
                    >
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          table: ({ node, ...props }) => <div className="overflow-x-auto my-3"><table className="w-full text-left border-collapse border border-black/10 text-xs sm:text-sm" {...props} /></div>,
                          thead: ({ node, ...props }) => <thead className="bg-black/5 text-slate-800" {...props} />,
                          th: ({ node, ...props }) => <th className="border border-black/10 px-3 py-2 font-semibold" {...props} />,
                          td: ({ node, ...props }) => <td className="border border-black/10 px-3 py-2" {...props} />,
                          p: ({ node, ...props }) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                          a: ({ node, ...props }) => <a className="underline font-medium" style={{ color: "inherit" }} target="_blank" rel="noopener noreferrer" {...props} />,
                          ul: ({ node, ...props }) => <ul className="list-disc list-inside mb-2" {...props} />,
                          ol: ({ node, ...props }) => <ol className="list-decimal list-inside mb-2" {...props} />,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}

                  {/* ── Action Contract Card ── */}
                  {msg.action_contract && (() => {
                    const c = msg.action_contract!;
                    const riskColor = riskColorMap[c.risk_level] ?? "text-slate-500";
                    return (
                      <div className="mt-3 w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(20px)", border: "1px solid rgba(99,102,241,0.1)", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
                        {/* Header */}
                        <div className="px-4 py-3 flex items-center gap-2" style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.04))", borderBottom: "1px solid rgba(99,102,241,0.08)" }}>
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>
                            <FaClipboardList className="text-white text-xs" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-800">Action Contract</p>
                            <p className="text-[10px] text-slate-500">{c.action_title}</p>
                          </div>
                          {c._status === "rejected" && <span className="ml-auto text-[10px] font-semibold text-red-500 px-2 py-0.5 rounded-full" style={{ background: "rgba(239,68,68,0.08)" }}>Rejected</span>}
                          {c._status === "executed" && <span className="ml-auto text-[10px] font-semibold text-emerald-500 px-2 py-0.5 rounded-full" style={{ background: "rgba(16,185,129,0.08)" }}>Executed</span>}
                        </div>

                        <div className="p-4 space-y-3">
                          {/* Steps */}
                          {c.steps?.length > 0 && (
                            <div>
                              <p className="text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Steps</p>
                              <div className="space-y-1">
                                {c.steps.map((step, i) => (
                                  <div key={i} className="flex items-start gap-2">
                                    <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-none mt-0.5" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}>{i + 1}</span>
                                    <p className="text-xs text-slate-600 leading-relaxed">{step}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Selectable resources */}
                          {c.selectable_resources && c.selectable_resources.length > 0 && (
                            <div>
                              <p className="text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Select Resources</p>
                              <div className="space-y-1">
                                {c.selectable_resources.map((r) => (
                                  <label key={r.id} className="flex items-center gap-2 cursor-pointer p-1.5 rounded-lg hover:bg-slate-50">
                                    <input type="checkbox" checked={r.selected} onChange={() => handleResourceToggle(msg.id, r.id)} className="rounded text-indigo-500" />
                                    <span className="text-xs text-slate-600">{r.name}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Permissions */}
                          {c.permissions_needed?.length > 0 && (
                            <div>
                              <p className="text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wide">Permissions</p>
                              <div className="flex flex-wrap gap-1">
                                {c.permissions_needed.map((p, i) => (
                                  <span key={i} className="px-2 py-0.5 rounded-full text-[11px] font-medium" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.12)", color: "#6366f1" }}>{p.scope}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Badges */}
                          <div className="flex gap-2 flex-wrap">
                            <span className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 ${riskColor}`}>
                              ⚠ Risk: {c.risk_level}
                            </span>
                            <span className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 ${c.reversible ? "text-emerald-500" : "text-red-500"}`}>
                              {c.reversible ? <><FaUndo className="text-[10px]" /> Reversible</> : <><FaBan className="text-[10px]" /> Irreversible</>}
                            </span>
                            <span className="px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                              🕐 {c.estimated_time}
                            </span>
                          </div>

                          {c.risk_reason && <p className="text-xs text-slate-400 italic">{c.risk_reason}</p>}
                          {c.reversible_description && <p className="text-xs text-slate-400">{c.reversible_description}</p>}

                          {/* Inline Edit */}
                          {c._editing && (
                            <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.06)" }}>
                              <p className="text-xs font-bold text-slate-500"><FaPencilAlt className="inline mr-1" /> Edit action details:</p>
                              {Object.entries(c._editedArgs ?? {}).map(([key, val]) => (
                                <div key={key}>
                                  <label className="text-[11px] text-slate-400 font-medium capitalize">{key}</label>
                                  {key === "body" ? (
                                    <textarea className="w-full mt-0.5 p-2 rounded-lg text-xs text-slate-700 resize-y min-h-[64px] outline-none focus:ring-2 ring-indigo-400" style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(0,0,0,0.08)" }} value={val} onChange={(e) => handleContractArgChange(msg.id, key, e.target.value)} />
                                  ) : (
                                    <input className="w-full mt-0.5 p-2 rounded-lg text-xs text-slate-700 outline-none focus:ring-2 ring-indigo-400" style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(0,0,0,0.08)" }} value={val} onChange={(e) => handleContractArgChange(msg.id, key, e.target.value)} />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Action buttons */}
                          {c._status === "executed" ? (
                            <div className="flex items-center gap-2 text-emerald-600 px-3 py-2 rounded-lg" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)" }}>
                              <FaCheckCircle />
                              <p className="text-xs font-semibold">Contract executed successfully.</p>
                            </div>
                          ) : c._status === "approved" ? (
                            <div className="flex items-center gap-2 text-indigo-600">
                              <div className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse" />
                              <p className="text-xs font-semibold">Executing…</p>
                            </div>
                          ) : c._status === "rejected" ? (
                            <div className="flex items-center gap-2 text-red-500 px-3 py-2 rounded-lg" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)" }}>
                              <FaTimesCircle />
                              <p className="text-xs font-semibold">Contract rejected.</p>
                            </div>
                          ) : (
                            <div className="flex gap-2 flex-wrap pt-1">
                              <button onClick={() => handleContractApprove(msg.id, c)} className="flex-1 px-3 py-2 text-white rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 2px 8px rgba(99,102,241,0.3)" }}>
                                <FaCheckCircle className="text-[11px]" /> {c._editing ? "Approve with Edits" : "Approve"}
                              </button>
                              <button onClick={() => handleContractEdit(msg.id, c)} className="px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1" style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)", color: "#475569" }}>
                                <FaPencilAlt className="text-[10px] text-slate-400" /> {c._editing ? "Cancel Edit" : "Edit"}
                              </button>
                              <button onClick={() => handleContractReject(msg.id, c)} className="px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)", color: "#ef4444" }}>
                                <FaTimes className="text-[10px]" /> Reject
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── Permission Request Card ── */}
                  {msg.permission_request && (() => {
                    const pr = msg.permission_request!;
                    const action = pr.action || pr.service.toLowerCase().replace(" ", "_");
                    if (pr._rejected) return (
                      <div className="mt-3 rounded-xl p-3 text-center" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.12)" }}>
                        <p className="text-xs text-red-500 font-medium">Permission denied for this request.</p>
                      </div>
                    );
                    if (pr._approved) return (
                      <div className="mt-3 rounded-xl p-3 text-center" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.12)" }}>
                        <p className="text-xs text-emerald-500 font-medium"><FaCheckCircle className="inline mr-1" /> Approved! Redirecting…</p>
                      </div>
                    );
                    return (
                      <div className="mt-3 rounded-2xl p-4 text-left" style={{ background: "rgba(255,255,255,0.7)", backdropFilter: "blur(20px)", border: "1px solid rgba(245,158,11,0.12)", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
                        <div className="flex items-start gap-2 mb-3">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-none" style={{ background: "linear-gradient(135deg, #f59e0b, #f97316)" }}>
                            <FaLock className="text-white text-sm" />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-800 text-sm">Permission Required</h3>
                            <p className="text-xs text-slate-500 mt-0.5">To complete your request, I need access to <strong className="text-slate-700">{pr.service}</strong>.</p>
                          </div>
                        </div>
                        <div className="rounded-lg px-3 py-2 mb-3" style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.1)" }}>
                          <p className="text-xs text-slate-600"><FaClipboardList className="inline text-amber-500 mr-1" /> <strong>Reason:</strong> {pr.reason}</p>
                        </div>
                        {pr._loadingExplanation && (
                          <div className="rounded-lg px-3 py-2 mb-3 flex items-center gap-2" style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.1)" }}>
                            <div className="w-3 h-3 rounded-full bg-indigo-400 animate-pulse" />
                            <p className="text-xs text-indigo-500">Negotiator is explaining…</p>
                          </div>
                        )}
                        {pr._explanation && !pr._loadingExplanation && (
                          <div className="rounded-xl p-3 mb-3" style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.1)" }}>
                            <p className="text-xs font-semibold text-indigo-600 mb-1"><FaRobot className="inline mr-1" /> Negotiator explains:</p>
                            <p className="text-xs text-slate-600 leading-relaxed">{pr._explanation}</p>
                          </div>
                        )}
                        <div className="flex gap-2 flex-wrap">
                          {!pr._explanation && !pr._loadingExplanation && (
                            <button onClick={() => handleExplain(msg.id, action)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all" style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.12)", color: "#6366f1" }}>
                              <FaQuestionCircle /> Why?
                            </button>
                          )}
                          <button onClick={() => handleApprove(msg.id, pr, lastUserQuery.current)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-white rounded-xl text-xs font-semibold transition-all active:scale-95" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 2px 8px rgba(99,102,241,0.3)" }}>
                            <FaCheckCircle className="text-[11px]" /> Allow Access
                          </button>
                          <button onClick={() => handleReject(msg.id, action)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.12)", color: "#ef4444" }}>
                            <FaTimes /> Deny
                          </button>
                        </div>
                        <p className="text-center text-[10px] text-slate-400 mt-2">You can revoke this access anytime from Settings.</p>
                      </div>
                    );
                  })()}
                </div>

                {/* Avatar for user */}
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center ml-2.5 mt-auto flex-none bg-indigo-100">
                    {user?.picture ? <img src={user.picture} className="w-8 h-8 rounded-full object-cover" alt="" /> : <User size={14} className="text-indigo-500" />}
                  </div>
                )}
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="w-8 h-8 rounded-full flex items-center justify-center mr-2.5 mt-auto" style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))", border: "1px solid rgba(99,102,241,0.1)" }}>
                  <Bot size={16} className="text-indigo-500" />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-bl-md flex gap-1.5 items-center" style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(0,0,0,0.06)" }}>
                  {[0, 150, 300].map((delay) => (
                    <div key={delay} className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input bar */}
        <div className="flex-none p-4" style={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
          <div className="max-w-2xl mx-auto">
            <form onSubmit={handleSend} className="flex items-center gap-2 rounded-full pl-5 pr-2 py-2 transition-all" style={{ background: "rgba(255,255,255,0.8)", border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
              <input
                type="text" value={input} onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me to read your emails, send an email, check calendar…"
                className="flex-1 bg-transparent border-none outline-none text-slate-800 placeholder-slate-400 py-1.5 text-sm"
                disabled={sending}
              />
              <button type="submit" disabled={!input.trim() || sending} className="disabled:opacity-30 text-white p-2.5 rounded-full transition-all active:scale-95" style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)", boxShadow: "0 2px 8px rgba(99,102,241,0.3)" }}>
                <Send size={16} />
              </button>
            </form>
            <p className="text-center mt-2 text-[10px] text-slate-400 font-medium tracking-wider uppercase">AI Agent &middot; Secured by Auth0 Token Vault &middot; Action Contracts</p>
          </div>
        </div>
      </div>

      {/* ── Settings / History Control Panel ── */}
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        history={historyEntries}
        loading={historyLoading}
      />
    </div>
  );
}
