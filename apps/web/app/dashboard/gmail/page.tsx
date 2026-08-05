"use client";
import { useEffect, useState } from "react";
import { Mail, RefreshCw, CheckCircle, AlertTriangle, Trash2 } from "lucide-react";
import { gmailApi, type GmailStatus, type EmailMessage } from "@/lib/api";
import styles from "./page.module.css";

export default function GmailSyncPage() {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [jobOnly, setJobOnly] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [st, em] = await Promise.all([
        gmailApi.getStatus(),
        gmailApi.getEmails(jobOnly),
      ]);
      setStatus(st);
      setEmails(Array.isArray(em) ? em : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [jobOnly]);

  const handleConnect = async () => {
    try {
      const res = await gmailApi.getConnectUrl();
      if (res?.url) {
        window.location.href = res.url;
      }
    } catch (err: any) {
      alert("Gagal mendapatkan link otorisasi: " + (err.message || "Error"));
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Putuskan koneksi Gmail Anda?")) return;
    try {
      await gmailApi.disconnect();
      await loadData();
    } catch (err: any) {
      alert("Gagal memutuskan koneksi: " + err.message);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await gmailApi.sync();
      alert(`Sinkronisasi selesai! ${res.newMessages} email baru (${res.jobRelated} terkait loker).`);
      await loadData();
    } catch (err: any) {
      alert("Gagal melakukan sinkronisasi: " + (err.message || "Error"));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Gmail Real-time Sync & Monitor</h1>
          <p className={styles.subtitle}>
            Hubungkan Gmail Anda untuk mendeteksi email balasan loker, undangan interview, dan konfirmasi otomatis.
          </p>
        </div>
        <div className={styles.headerActions}>
          {status?.connected && (
            <button className={styles.syncBtn} onClick={handleSync} disabled={syncing}>
              <RefreshCw size={14} className={syncing ? styles.spin : ""} />
              {syncing ? "Mengecek Gmail..." : "Sinkronkan Sekarang"}
            </button>
          )}
        </div>
      </div>

      {/* Account Status Card */}
      <div className={styles.statusCard}>
        <div className={styles.cardInfo}>
          <div className={`${styles.iconBg} ${status?.connected ? styles.iconConnected : styles.iconDisconnected}`}>
            <Mail size={20} />
          </div>
          <div>
            <div className={styles.cardTitle}>
              {status?.connected ? (
                <>
                  <CheckCircle size={15} className={styles.connectedBadgeIcon} /> Connected: <strong>{status.gmailEmail}</strong>
                </>
              ) : (
                <>
                  <AlertTriangle size={15} className={styles.disconnectedBadgeIcon} /> Gmail Belum Terhubung
                </>
              )}
            </div>
            <p className={styles.cardDesc}>
              {status?.connected
                ? `Terakhir disinkronkan: ${status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString("id-ID") : "Belum pernah"}`
                : "Hubungkan akun Gmail Anda dengan izin Read-only untuk melacak email lamaran secara otomatis."}
            </p>
          </div>
        </div>

        <div>
          {status?.connected ? (
            <button className={styles.disconnectBtn} onClick={handleDisconnect}>
              <Trash2 size={14} /> Putuskan Akun
            </button>
          ) : (
            <button className={styles.connectBtn} onClick={handleConnect}>
              <Mail size={14} /> Hubungkan Akun Gmail
            </button>
          )}
        </div>
      </div>

      {/* Filter & Messages List */}
      <div className={styles.inboxSection}>
        <div className={styles.inboxHeader}>
          <h2 className={styles.inboxTitle}>Email Loker Masuk & Terlacak</h2>
          <div className={styles.filterGroup}>
            <button
              className={`${styles.filterBtn} ${jobOnly ? styles.filterActive : ""}`}
              onClick={() => setJobOnly(true)}
            >
              Hanya Loker / Balasan HR
            </button>
            <button
              className={`${styles.filterBtn} ${!jobOnly ? styles.filterActive : ""}`}
              onClick={() => setJobOnly(false)}
            >
              Semua Email
            </button>
          </div>
        </div>

        {loading ? (
          <div className={styles.loadingBox}>Memuat daftar email...</div>
        ) : emails.length === 0 ? (
          <div className={styles.emptyBox}>
            <p>Belum ada pesan email {jobOnly ? "terkait loker" : ""} yang ditemukan.</p>
            {status?.connected && (
              <button className={styles.subtleBtn} onClick={handleSync}>
                Jalankan Sinkronisasi Gmail
              </button>
            )}
          </div>
        ) : (
          <div className={styles.emailList}>
            {emails.map((m) => (
              <div key={m.id} className={styles.emailCard}>
                <div className={styles.emailTop}>
                  <div className={styles.senderGroup}>
                    <span className={styles.senderName}>{m.fromName || m.fromEmail}</span>
                    <span className={styles.senderEmail}>&lt;{m.fromEmail}&gt;</span>
                  </div>
                  <span className={styles.emailDate}>
                    {new Date(m.receivedAt).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className={styles.subjectRow}>
                  {m.detectedType && (
                    <span className={`${styles.typeTag} ${styles[`type_${m.detectedType}`] || ""}`}>
                      {m.detectedType}
                    </span>
                  )}
                  <h3 className={styles.emailSubject}>{m.subject}</h3>
                </div>
                <p className={styles.snippet}>{m.snippet}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
