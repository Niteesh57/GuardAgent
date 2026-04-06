"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Settings as SettingsIcon, CheckCircle, Plus, ArrowLeft } from "lucide-react";
import { FaEnvelope, FaCommentAlt, FaLink, FaFileAlt, FaCalendarAlt } from "react-icons/fa";

export default function SettingsPage() {
  const [services, setServices] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  useEffect(() => {
    fetch(`${API_URL}/permissions/services`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load services");
        return res.json();
      })
      .then((data) => {
        if (data.services) {
          setServices(data.services);
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [API_URL]);

  const handleConnect = async (service: string) => {
    try {
      const res = await fetch(`${API_URL}/permissions/connect/${service}`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.connect_url) {
        window.location.href = data.connect_url;
      }
    } catch (err) {
      console.error("Failed to connect", err);
    }
  };

  const SERVICE_NAMES: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    gmail: { label: "Google Gmail", icon: <FaEnvelope />, color: "#4285F4" },
    calendar: { label: "Google Calendar", icon: <FaCalendarAlt />, color: "#34A853" },
    docs: { label: "Google Docs", icon: <FaFileAlt />, color: "#4285F4" },
    twilio: { label: "Twilio SMS", icon: <FaCommentAlt />, color: "#F25022" },
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-slate-50 text-white overflow-hidden">
      {/* Header */}
      <header className="px-6 py-4 flex items-center sticky top-0 z-10 bg-white border-b border-slate-200">
        <Link href="/" className="mr-4 text-indigo-600 hover:text-indigo-700 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(99,102,241,0.15)" }}>
            <SettingsIcon className="w-4 h-4 text-indigo-600" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-indigo-800">Connected Apps</h1>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-6 md:p-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-indigo-800">Integrations</h2>
          <p className="text-slate-600 mt-1 text-sm">
            Manage third-party apps and permissions. Your tokens are securely stored in Auth0 Token Vault.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/20 border-t-indigo-400"></div>
          </div>
        ) : error ? (
          <div className="rounded-2xl p-4 border border-red-400/20" style={{ background: "rgba(239,68,68,0.15)" }}>
            <p className="text-red-300 text-sm">{error}. Please make sure you are signed in.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(services).map(([service, isConnected]) => {
              const info = SERVICE_NAMES[service] || { label: service, icon: <FaLink />, color: "#94a3b8" };

              return (
                <div
                  key={service}
                  className="rounded-xl border border-slate-200 p-5 flex items-center justify-between transition-all hover:border-slate-300"
                  style={{ background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
                      style={{ background: `${info.color}10`, color: info.color }}
                    >
                      {info.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">{info.label}</h3>
                      <p className="text-slate-500 mt-0.5">
                        {isConnected ? "Ready to use in commands" : "Action required to enable"}
                      </p>
                    </div>
                  </div>

                  <div>
                    {isConnected ? (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleConnect(service)}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
                        >
                          Reconnect
                        </button>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                          style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.15)", color: "#10b981" }}>
                          <CheckCircle className="w-3.5 h-3.5" />
                          Connected
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleConnect(service)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition-all hover:bg-indigo-50 active:scale-95"
                        style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))", border: "1px solid transparent" }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Connect
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer info card */}
        <div className="mt-8 rounded-xl border border-slate-200 p-5" style={{ background: "white", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-none mt-0.5" style={{ background: "rgba(99,102,241,0.1)" }}>
              <img src="/auth0.png" alt="Auth0" className="w-5 h-5 rounded" />
            </div>
            <div>
              <h4 className="font-semibold text-sm text-slate-700">Secured by Auth0 Token Vault</h4>
              <p className="text-slate-500 mt-1 leading-relaxed">
                All OAuth tokens are stored securely in Auth0's Token Vault. The Guard Agent never sees or stores your credentials directly.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}