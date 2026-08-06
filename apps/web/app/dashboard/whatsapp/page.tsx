"use client";

import { useState, useEffect } from "react";
import { MessageSquare, QrCode, CheckCircle2, AlertCircle, RefreshCw, Send, LogOut, ShieldCheck, Terminal, Smartphone } from "lucide-react";
import { fetchApi } from "@/lib/api";

interface WaStatusResponse {
  status: "disconnected" | "connecting" | "qr_ready" | "connected";
  connectedUser: string | null;
  hasQr: boolean;
  qrDataUrl?: string;
}

export default function WhatsAppPage() {
  const [waState, setWaState] = useState<WaStatusResponse>({
    status: "disconnected",
    connectedUser: null,
    hasQr: false,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("Halo! Ini tes notifikasi dari Job Tracker Bot 👋");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [msgResult, setMsgResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchStatus = async () => {
    try {
      const data = await fetchApi<WaStatusResponse>("/api/v1/whatsapp/status");
      setWaState(data);
    } catch (err: any) {
      console.error("Failed to load WhatsApp status:", err);
      setWaState({ status: "disconnected", connectedUser: null, hasQr: false });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Auto refresh every 4 seconds to poll status or updated QR code
    const timer = setInterval(() => {
      fetchStatus();
    }, 4000);

    return () => clearInterval(timer);
  }, []);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchStatus();
  };

  const handleLogout = async () => {
    if (!confirm("Apakah Anda yakin ingin melepaskan koneksi WhatsApp Bot? Anda perlu scan ulang QR code untuk terhubung kembali.")) {
      return;
    }
    setLoading(true);
    try {
      await fetchApi("/api/v1/whatsapp/logout", { method: "POST" });
      await fetchStatus();
    } catch (err: any) {
      alert("Gagal memutuskan koneksi WhatsApp: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone) {
      setMsgResult({ success: false, message: "Masukkan nomor HP tujuan!" });
      return;
    }

    setSendingMsg(true);
    setMsgResult(null);
    try {
      const res = await fetchApi<{ success: boolean }>("/api/v1/whatsapp/test-send", {
        method: "POST",
        body: JSON.stringify({ to: testPhone, message: testMessage }),
      });

      if (res.success) {
        setMsgResult({ success: true, message: "Pesan WhatsApp berhasil terkirim!" });
      } else {
        setMsgResult({ success: false, message: "Gagal mengirim pesan WhatsApp." });
      }
    } catch (err: any) {
      setMsgResult({ success: false, message: err.message || "Gagal menghubungi WhatsApp Gateway." });
    } finally {
      setSendingMsg(false);
    }
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.75rem", margin: 0 }}>
            <MessageSquare style={{ color: "#25D366" }} size={28} />
            Central WhatsApp Gateway
          </h1>
          <p style={{ color: "#94a3b8", marginTop: "0.25rem", fontSize: "0.95rem" }}>
            Hubungkan nomor WhatsApp untuk notifikasi otomatis email HRD dan perintah interaktif via chat bot.
          </p>
        </div>

        <button
          onClick={handleManualRefresh}
          disabled={refreshing}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.6rem 1.2rem",
            borderRadius: "0.5rem",
            backgroundColor: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#f8fafc",
            cursor: "pointer",
            fontSize: "0.9rem",
            fontWeight: 500,
            transition: "all 0.2s ease",
          }}
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          Refresh Status
        </button>
      </div>

      {/* Main Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "1.5rem" }}>
        
        {/* Card 1: Connection & QR Scan */}
        <div style={{
          backgroundColor: "#1e293b",
          borderRadius: "1rem",
          border: "1px solid #334155",
          padding: "1.75rem",
          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center"
        }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 600, margin: 0, marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <QrCode size={20} style={{ color: "#38bdf8" }} />
            Koneksi WhatsApp Gateway
          </h2>

          {loading ? (
            <div style={{ padding: "3rem 0", color: "#94a3b8" }}>
              <RefreshCw size={32} className="animate-spin" style={{ margin: "0 auto 1rem" }} />
              <p>Memeriksa status koneksi...</p>
            </div>
          ) : waState.status === "connected" ? (
            <div style={{ width: "100%" }}>
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                backgroundColor: "rgba(16, 185, 129, 0.15)",
                color: "#34d399",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                padding: "0.5rem 1rem",
                borderRadius: "9999px",
                fontWeight: 600,
                fontSize: "0.9rem",
                marginBottom: "1.5rem"
              }}>
                <CheckCircle2 size={18} />
                STATUS: TERHUBUNG
              </div>

              <div style={{ backgroundColor: "#0f172a", borderRadius: "0.75rem", padding: "1.25rem", border: "1px solid #334155", marginBottom: "1.5rem" }}>
                <p style={{ margin: 0, color: "#94a3b8", fontSize: "0.85rem" }}>Nomor WA Terhubung:</p>
                <p style={{ margin: "0.25rem 0 0", color: "#38bdf8", fontWeight: 700, fontSize: "1.25rem" }}>
                  +{waState.connectedUser}
                </p>
                <p style={{ margin: "0.75rem 0 0", color: "#64748b", fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}>
                  <ShieldCheck size={14} color="#10b981" />
                  Koneksi Persistent (Tetap aktif meskipun server restart)
                </p>
              </div>

              <button
                onClick={handleLogout}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: "0.5rem",
                  backgroundColor: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "#f87171",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  transition: "all 0.2s ease"
                }}
              >
                <LogOut size={18} />
                Putuskan Koneksi (Logout)
              </button>
            </div>
          ) : waState.qrDataUrl ? (
            <div>
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                backgroundColor: "rgba(245, 158, 11, 0.15)",
                color: "#fbbf24",
                border: "1px solid rgba(245, 158, 11, 0.3)",
                padding: "0.4rem 0.9rem",
                borderRadius: "9999px",
                fontWeight: 600,
                fontSize: "0.85rem",
                marginBottom: "1.25rem"
              }}>
                <Smartphone size={16} />
                SILAKAN SCAN QR CODE
              </div>

              <div style={{
                backgroundColor: "#ffffff",
                padding: "0.75rem",
                borderRadius: "1rem",
                display: "inline-block",
                boxShadow: "0 10px 25px -5px rgba(0,0,0,0.5)",
                marginBottom: "1.25rem"
              }}>
                <img
                  src={waState.qrDataUrl}
                  alt="WhatsApp QR Code"
                  style={{ width: "220px", height: "220px", display: "block" }}
                />
              </div>

              <ol style={{ textAlign: "left", color: "#94a3b8", fontSize: "0.85rem", margin: "0 auto", paddingLeft: "1.25rem", maxWidth: "280px" }}>
                <li>Buka aplikasi WhatsApp di HP.</li>
                <li>Pilih <strong>Perangkat Tertaut (Linked Devices)</strong>.</li>
                <li>Klik <strong>Tautkan Perangkat</strong> & Scan QR Code di atas.</li>
              </ol>
            </div>
          ) : (
            <div style={{ padding: "2rem 0", color: "#94a3b8" }}>
              <AlertCircle size={36} style={{ color: "#ef4444", margin: "0 auto 1rem" }} />
              <p style={{ fontWeight: 600, color: "#f8fafc" }}>Gateway Belum Siap / Disconnected</p>
              <p style={{ fontSize: "0.85rem" }}>Menunggu WhatsApp Gateway membuat QR Code baru...</p>
            </div>
          )}
        </div>

        {/* Card 2: Test WhatsApp Notification */}
        <div style={{
          backgroundColor: "#1e293b",
          borderRadius: "1rem",
          border: "1px solid #334155",
          padding: "1.75rem",
          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)",
        }}>
          <h2 style={{ fontSize: "1.2rem", fontWeight: 600, margin: 0, marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Send size={20} style={{ color: "#25D366" }} />
            Kirim Pesan Uji Coba (Test Message)
          </h2>

          <form onSubmit={handleSendTestMessage}>
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", color: "#cbd5e1", fontSize: "0.85rem", marginBottom: "0.4rem", fontWeight: 500 }}>
                Nomor WhatsApp Tujuan (cth: 081234567890)
              </label>
              <input
                type="text"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="08xxxxxxxxxx"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: "0.5rem",
                  backgroundColor: "#0f172a",
                  border: "1px solid #334155",
                  color: "#f8fafc",
                  outline: "none",
                  fontSize: "0.95rem"
                }}
              />
            </div>

            <div style={{ marginBottom: "1.25rem" }}>
              <label style={{ display: "block", color: "#cbd5e1", fontSize: "0.85rem", marginBottom: "0.4rem", fontWeight: 500 }}>
                Isi Pesan
              </label>
              <textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                rows={4}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  borderRadius: "0.5rem",
                  backgroundColor: "#0f172a",
                  border: "1px solid #334155",
                  color: "#f8fafc",
                  outline: "none",
                  fontSize: "0.9rem",
                  resize: "vertical"
                }}
              />
            </div>

            {msgResult && (
              <div style={{
                padding: "0.75rem",
                borderRadius: "0.5rem",
                fontSize: "0.85rem",
                marginBottom: "1rem",
                backgroundColor: msgResult.success ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                color: msgResult.success ? "#34d399" : "#f87171",
                border: `1px solid ${msgResult.success ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`
              }}>
                {msgResult.message}
              </div>
            )}

            <button
              type="submit"
              disabled={sendingMsg || waState.status !== "connected"}
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "0.5rem",
                backgroundColor: waState.status === "connected" ? "#25D366" : "#334155",
                color: waState.status === "connected" ? "#022c22" : "#64748b",
                fontWeight: 700,
                cursor: waState.status === "connected" ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                border: "none",
                transition: "all 0.2s ease"
              }}
            >
              <Send size={16} />
              {sendingMsg ? "Mengirim Pesan..." : "Kirim Pesan WhatsApp"}
            </button>
          </form>
        </div>

      </div>

      {/* Card 3: Interactive Bot Commands Cheat Sheet */}
      <div style={{
        marginTop: "1.5rem",
        backgroundColor: "#1e293b",
        borderRadius: "1rem",
        border: "1px solid #334155",
        padding: "1.75rem",
        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.3)"
      }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 600, margin: 0, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Terminal size={20} style={{ color: "#a855f7" }} />
          Daftar Perintah WhatsApp Bot Interaktif
        </h2>

        <p style={{ color: "#94a3b8", fontSize: "0.9rem", marginBottom: "1.25rem" }}>
          Kirim pesan chat berikut langsung ke nomor bot WhatsApp yang terhubung untuk mengontrol Job Tracker Anda:
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
          <div style={{ backgroundColor: "#0f172a", padding: "1rem", borderRadius: "0.75rem", border: "1px solid #334155" }}>
            <span style={{ backgroundColor: "rgba(168, 85, 247, 0.2)", color: "#c084fc", padding: "0.2rem 0.5rem", borderRadius: "0.25rem", fontFamily: "monospace", fontWeight: 600, fontSize: "0.85rem" }}>
              !overview
            </span>
            <p style={{ color: "#cbd5e1", fontSize: "0.85rem", marginTop: "0.5rem", marginBottom: 0 }}>
              Cek total lamaran, breakdown status, & analisis stage penolakan.
            </p>
          </div>

          <div style={{ backgroundColor: "#0f172a", padding: "1rem", borderRadius: "0.75rem", border: "1px solid #334155" }}>
            <span style={{ backgroundColor: "rgba(56, 189, 248, 0.2)", color: "#38bdf8", padding: "0.2rem 0.5rem", borderRadius: "0.25rem", fontFamily: "monospace", fontWeight: 600, fontSize: "0.85rem" }}>
              !lamaran
            </span>
            <p style={{ color: "#cbd5e1", fontSize: "0.85rem", marginTop: "0.5rem", marginBottom: 0 }}>
              Menampilkan 5 daftar lamaran kerja terbaru yang Anda daftarkan.
            </p>
          </div>

          <div style={{ backgroundColor: "#0f172a", padding: "1rem", borderRadius: "0.75rem", border: "1px solid #334155" }}>
            <span style={{ backgroundColor: "rgba(34, 197, 94, 0.2)", color: "#4ade80", padding: "0.2rem 0.5rem", borderRadius: "0.25rem", fontFamily: "monospace", fontWeight: 600, fontSize: "0.85rem" }}>
              !email
            </span>
            <p style={{ color: "#cbd5e1", fontSize: "0.85rem", marginTop: "0.5rem", marginBottom: 0 }}>
              Cek 5 balasan email HRD / perusahaan terbaru yang terdeteksi.
            </p>
          </div>

          <div style={{ backgroundColor: "#0f172a", padding: "1rem", borderRadius: "0.75rem", border: "1px solid #334155" }}>
            <span style={{ backgroundColor: "rgba(251, 146, 60, 0.2)", color: "#fb923c", padding: "0.2rem 0.5rem", borderRadius: "0.25rem", fontFamily: "monospace", fontWeight: 600, fontSize: "0.85rem" }}>
              !tambah [Judul] | [Perusahaan]
            </span>
            <p style={{ color: "#cbd5e1", fontSize: "0.85rem", marginTop: "0.5rem", marginBottom: 0 }}>
              Tambah lamaran kerja baru langsung via WA (contoh: <code>!tambah Dev | Tokopedia</code>).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
