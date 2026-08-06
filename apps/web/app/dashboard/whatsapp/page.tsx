"use client";

import { useState, useEffect } from "react";
import { MessageSquare, QrCode, CheckCircle2, AlertCircle, RefreshCw, Send, LogOut, ShieldCheck, Terminal, Smartphone } from "lucide-react";
import { fetchApi } from "@/lib/api";
import styles from "./page.module.css";

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
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Auto refresh status every 3 seconds to poll for QR Code updates or connection state changes
    const timer = setInterval(() => {
      fetchStatus();
    }, 3000);

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
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>
            <MessageSquare size={28} className={styles.titleIcon} />
            Central WhatsApp Gateway
          </h1>
          <p className={styles.subtitle}>
            Hubungkan nomor WhatsApp untuk notifikasi otomatis email HRD dan perintah interaktif via chat bot.
          </p>
        </div>

        <button
          onClick={handleManualRefresh}
          disabled={refreshing}
          className={styles.refreshBtn}
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          Refresh Status
        </button>
      </div>

      {/* Main Grid */}
      <div className={styles.grid}>
        
        {/* Card 1: Connection & QR Scan */}
        <div className={styles.card}>
          <h2 className={styles.cardHeader}>
            <QrCode size={20} className={styles.iconQr} />
            Koneksi WhatsApp Gateway
          </h2>

          <div className={styles.qrContainer}>
            {loading ? (
              <div style={{ padding: "3rem 0", color: "var(--text-muted)" }}>
                <RefreshCw size={32} className="animate-spin" style={{ margin: "0 auto 1rem" }} />
                <p style={{ margin: 0 }}>Memeriksa status koneksi...</p>
              </div>
            ) : waState.status === "connected" ? (
              <div style={{ width: "100%" }}>
                <div className={styles.badgeConnected}>
                  <CheckCircle2 size={18} />
                  STATUS: TERHUBUNG
                </div>

                <div className={styles.connectedDetails}>
                  <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.85rem" }}>Nomor WA Terhubung:</p>
                  <p className={styles.connectedUser}>
                    +{waState.connectedUser}
                  </p>
                  <p style={{ margin: "0.75rem 0 0", color: "var(--text-subtle)", fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}>
                    <ShieldCheck size={14} color="#10b981" />
                    Koneksi Persistent (Tetap aktif meskipun server restart)
                  </p>
                </div>

                <button
                  onClick={handleLogout}
                  className={styles.logoutBtn}
                >
                  <LogOut size={18} />
                  Putuskan Koneksi (Logout)
                </button>
              </div>
            ) : waState.qrDataUrl || waState.hasQr || waState.status === "qr_ready" ? (
              <div style={{ width: "100%" }}>
                <div className={styles.badgeQrReady}>
                  <Smartphone size={16} />
                  SILAKAN SCAN QR CODE
                </div>

                {waState.qrDataUrl ? (
                  <div className={styles.qrCodeFrame}>
                    <img
                      src={waState.qrDataUrl}
                      alt="WhatsApp QR Code"
                      className={styles.qrImage}
                    />
                  </div>
                ) : (
                  <div style={{ padding: "2rem 0", color: "var(--text-muted)" }}>
                    <RefreshCw size={28} className="animate-spin" style={{ margin: "0 auto 0.75rem" }} />
                    <p style={{ margin: 0, fontSize: "0.9rem" }}>Menyiapkan gambar QR Code...</p>
                  </div>
                )}

                <ol className={styles.qrInstructions}>
                  <li>Buka aplikasi WhatsApp di HP.</li>
                  <li>Pilih <strong>Perangkat Tertaut (Linked Devices)</strong>.</li>
                  <li>Klik <strong>Tautkan Perangkat</strong> & Scan QR Code di atas.</li>
                </ol>
              </div>
            ) : (
              <div style={{ padding: "2rem 0", color: "var(--text-muted)" }}>
                <AlertCircle size={36} style={{ color: "var(--status-rejected-color)", margin: "0 auto 1rem" }} />
                <p style={{ fontWeight: 600, color: "var(--text)", margin: 0 }}>Gateway Belum Siap / Disconnected</p>
                <p style={{ fontSize: "0.85rem", marginTop: "0.35rem" }}>Menyiapkan koneksi WhatsApp Gateway baru...</p>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Test WhatsApp Notification */}
        <div className={styles.card}>
          <h2 className={styles.cardHeader}>
            <Send size={20} className={styles.iconSend} />
            Kirim Pesan Uji Coba (Test Message)
          </h2>

          <form onSubmit={handleSendTestMessage} style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Nomor WhatsApp Tujuan (cth: 081234567890)
              </label>
              <input
                type="text"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="08xxxxxxxxxx"
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup} style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <label className={styles.label}>
                Isi Pesan
              </label>
              <textarea
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                rows={4}
                className={styles.textarea}
                style={{ flex: 1 }}
              />
            </div>

            {msgResult && (
              <div style={{
                padding: "0.75rem",
                borderRadius: "var(--radius, 6px)",
                fontSize: "0.85rem",
                marginBottom: "1rem",
                backgroundColor: msgResult.success ? "var(--status-offer-bg)" : "var(--status-rejected-bg)",
                color: msgResult.success ? "var(--status-offer-color)" : "var(--status-rejected-color)",
                border: `1px solid ${msgResult.success ? "var(--status-offer-border)" : "var(--status-rejected-border)"}`
              }}>
                {msgResult.message}
              </div>
            )}

            <button
              type="submit"
              disabled={sendingMsg || waState.status !== "connected"}
              className={styles.submitBtn}
              style={{ marginTop: "auto" }}
            >
              <Send size={16} />
              {sendingMsg ? "Mengirim Pesan..." : "Kirim Pesan WhatsApp"}
            </button>
          </form>
        </div>

      </div>

      {/* Card 3: Interactive Bot Commands Cheat Sheet */}
      <div className={styles.card} style={{ marginTop: "0.5rem" }}>
        <h2 className={styles.cardHeader}>
          <Terminal size={20} className={styles.iconTerminal} />
          Daftar Perintah WhatsApp Bot Interaktif
        </h2>

        <p className={styles.subtitle} style={{ marginBottom: "1.25rem" }}>
          Kirim pesan chat berikut langsung ke nomor bot WhatsApp yang terhubung untuk mengontrol Job Tracker Anda:
        </p>

        <div className={styles.cheatGrid}>
          <div className={styles.cheatCard}>
            <span className={`${styles.cmdTag} ${styles.cmdOverview}`}>
              !overview
            </span>
            <p className={styles.cheatDesc}>
              Cek total lamaran, breakdown status, & analisis stage penolakan.
            </p>
          </div>

          <div className={styles.cheatCard}>
            <span className={`${styles.cmdTag} ${styles.cmdLamaran}`}>
              !lamaran
            </span>
            <p className={styles.cheatDesc}>
              Menampilkan 5 daftar lamaran kerja terbaru yang Anda daftarkan.
            </p>
          </div>

          <div className={styles.cheatCard}>
            <span className={`${styles.cmdTag} ${styles.cmdEmail}`}>
              !email
            </span>
            <p className={styles.cheatDesc}>
              Cek 5 balasan email HRD / perusahaan terbaru yang terdeteksi.
            </p>
          </div>

          <div className={styles.cheatCard}>
            <span className={`${styles.cmdTag} ${styles.cmdTambah}`}>
              !tambah [Judul] | [Perusahaan]
            </span>
            <p className={styles.cheatDesc}>
              Tambah lamaran kerja baru langsung via WA (contoh: <code>!tambah Dev | Tokopedia</code>).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
