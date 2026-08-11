"use client";

import { useState, useEffect } from "react";
import { Bot, CheckCircle2, AlertCircle, RefreshCw, Send, ShieldCheck, Key, Terminal, MessageSquare } from "lucide-react";
import { fetchApi } from "@/lib/api";
import styles from "./page.module.css";

interface TelegramStatus {
  configured: boolean;
  hasChatId: boolean;
  botTokenMasked: string | null;
  chatId: string | null;
  isPolling: boolean;
}

export default function TelegramDashboardPage() {
  const [status, setStatus] = useState<TelegramStatus>({
    configured: false,
    hasChatId: false,
    botTokenMasked: null,
    chatId: null,
    isPolling: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [botTokenInput, setBotTokenInput] = useState("");
  const [chatIdInput, setChatIdInput] = useState("");
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchStatus = async () => {
    try {
      const data = await fetchApi<TelegramStatus>("/api/v1/telegram/status");
      setStatus(data);
      if (data.chatId) setChatIdInput(data.chatId);
    } catch (err: any) {
      console.error("Failed to load Telegram status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveResult(null);

    try {
      const res = await fetchApi<{ success: boolean; status: TelegramStatus }>("/api/v1/telegram/config", {
        method: "POST",
        body: JSON.stringify({ botToken: botTokenInput, chatId: chatIdInput }),
      });
      if (res.success) {
        setStatus(res.status);
        setSaveResult({ success: true, message: "Konfigurasi Telegram Bot berhasil disimpan!" });
        setBotTokenInput("");
      }
    } catch (err: any) {
      setSaveResult({ success: false, message: err.message || "Gagal menyimpan konfigurasi Telegram" });
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetchApi<{ success: boolean }>("/api/v1/telegram/test-send", {
        method: "POST",
        body: JSON.stringify({
          message: "🤖 <b>Halo!</b> Uji coba notifikasi Telegram Bot dari Job Tracker berhasil! Notifikasi suara & getar 100% aktif 🎉",
        }),
      });

      if (res.success) {
        setTestResult({ success: true, message: "Pesan uji coba berhasil terkirim ke Telegram Anda!" });
      } else {
        setTestResult({ success: false, message: "Gagal mengirim pesan uji coba. Periksa Bot Token dan Chat ID." });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || "Gagal menghubungi Telegram API." });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>
            <Bot className={styles.titleIcon} size={28} />
            Telegram Bot Gateway
          </h1>
          <p className={styles.subtitle}>
            Notifikasi email HRD & perintah otomatis dengan suara berdering 100% tanpa scan QR
          </p>
        </div>
        <button className={styles.refreshBtn} onClick={fetchStatus} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} size={16} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Status & Configuration Cards */}
      <div className={styles.grid}>
        {/* Status Card */}
        <div className={styles.card}>
          <h2 className={styles.cardHeader}>
            <ShieldCheck className={styles.iconMonochrome} size={20} />
            Status Layanan Telegram
          </h2>

          {status.configured ? (
            <div className={styles.badgeConnected}>
              <CheckCircle2 size={16} />
              <span>BOT AKTIF & SYNCING</span>
            </div>
          ) : (
            <div className={styles.badgeDisconnected}>
              <AlertCircle size={16} />
              <span>BELUM DIKONFIGURASI</span>
            </div>
          )}

          <div className={styles.connectedDetails}>
            <div className={styles.detailRow}>
              <span>Bot Token:</span>
              <code>{status.botTokenMasked || "Belum diisi"}</code>
            </div>
            <div className={styles.detailRow}>
              <span>Chat ID Target:</span>
              <code>{status.chatId || "Belum diisi"}</code>
            </div>
            <div className={styles.detailRow}>
              <span>Mode Polling Command:</span>
              <span className={status.isPolling ? styles.activeText : styles.inactiveText}>
                {status.isPolling ? "● Active (Listening)" : "○ Inactive"}
              </span>
            </div>
          </div>

          {status.configured && (
            <button onClick={handleTestSend} disabled={testing} className={styles.testBtn}>
              <Send size={16} />
              <span>{testing ? "Mengirim..." : "Kirim Pesan Tes ke Telegram"}</span>
            </button>
          )}

          {testResult && (
            <div className={testResult.success ? styles.alertSuccess : styles.alertError}>
              {testResult.message}
            </div>
          )}
        </div>

        {/* Configuration Card */}
        <div className={styles.card}>
          <h2 className={styles.cardHeader}>
            <Key className={styles.iconMonochrome} size={20} />
            Konfigurasi Bot Token & Chat ID
          </h2>

          <form onSubmit={handleSaveConfig} style={{ width: "100%" }}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Telegram Bot Token</label>
              <input
                type="password"
                className={styles.input}
                placeholder="Contoh: 8739277720:AAHeNSPRrm4lDczE4..."
                value={botTokenInput}
                onChange={(e) => setBotTokenInput(e.target.value)}
              />
              <span className={styles.hint}>Dapatkan token dari @BotFather di aplikasi Telegram</span>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Telegram Chat ID Anda</label>
              <input
                type="text"
                className={styles.input}
                placeholder="Contoh: 123456789"
                value={chatIdInput}
                onChange={(e) => setChatIdInput(e.target.value)}
              />
              <span className={styles.hint}>Ketik /start atau /chatid ke bot Anda di Telegram</span>
            </div>

            {saveResult && (
              <div className={saveResult.success ? styles.alertSuccess : styles.alertError}>
                {saveResult.message}
              </div>
            )}

            <button type="submit" disabled={saving} className={styles.submitBtn}>
              <span>{saving ? "Menyimpan..." : "Simpan Konfigurasi Bot"}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Guide & Commands Section */}
      <div className={styles.grid}>
        {/* Quick Guide Card */}
        <div className={styles.card}>
          <h2 className={styles.cardHeader}>
            <MessageSquare className={styles.iconMonochrome} size={20} />
            Cara Setup Telegram Bot (2 Menit)
          </h2>
          <ol className={styles.guideList}>
            <li>Buka aplikasi Telegram di HP Anda dan cari kontak <code>@BotFather</code>.</li>
            <li>Ketik pesan <code>/newbot</code> lalu ikuti petunjuk nama bot Anda.</li>
            <li>Salin <b>HTTP API Token</b> yang diberikan @BotFather dan tempel di form konfigurasi di atas.</li>
            <li>Buka obrolan dengan bot Anda, lalu ketik <code>/start</code> atau <code>/chatid</code>.</li>
            <li>Salin Chat ID Anda dan tempel di kolom "Telegram Chat ID", lalu klik <b>Simpan</b>.</li>
          </ol>
        </div>

        {/* Commands Card */}
        <div className={styles.card}>
          <h2 className={styles.cardHeader}>
            <Terminal className={styles.iconMonochrome} size={20} />
            Daftar Perintah Interaktif Bot
          </h2>
          <div className={styles.cheatGrid}>
            <div className={styles.cheatCard}>
              <span className={styles.cmdTag}>/overview</span>
              <p className={styles.cheatDesc}>Total lamaran, breakdown status & stage penolakan</p>
            </div>
            <div className={styles.cheatCard}>
              <span className={styles.cmdTag}>/lamaran</span>
              <p className={styles.cheatDesc}>Lihat 5 daftar lamaran kerja terbaru</p>
            </div>
            <div className={styles.cheatCard}>
              <span className={styles.cmdTag}>/email</span>
              <p className={styles.cheatDesc}>Lihat 5 balasan email HRD/perusahaan terbaru</p>
            </div>
            <div className={styles.cheatCard}>
              <span className={styles.cmdTag}>/tambah [Judul] | [Perusahaan]</span>
              <p className={styles.cheatDesc}>Tambah lamaran kerja baru via chat Telegram</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
