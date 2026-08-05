"use client";
import { useEffect, useState } from "react";
import { Mail, RefreshCw, CheckCircle, AlertTriangle, Trash2, ExternalLink, X, Calendar, User, ArrowRight } from "lucide-react";
import { gmailApi, type GmailStatus, type EmailMessage } from "@/lib/api";
import styles from "./page.module.css";

export default function GmailSyncPage() {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [st, em] = await Promise.all([
        gmailApi.getStatus(),
        gmailApi.getEmails(true, 200),
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
  }, []);

  const filteredEmails = emails
    .filter((m) => {
      if (!typeFilter) return true;
      return m.detectedType === typeFilter;
    })
    .sort((a, b) => {
      const timeA = new Date(a.receivedAt).getTime();
      const timeB = new Date(b.receivedAt).getTime();
      return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
    });

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

  const getGmailWebUrl = (msg: EmailMessage) => {
    if (msg.gmailMessageId) {
      return `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(msg.gmailMessageId)}`;
    }
    const cleanSubject = msg.subject ? msg.subject.replace(/[^a-zA-Z0-9 ]/g, " ") : "";
    return `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(msg.fromEmail)}+${encodeURIComponent(cleanSubject)}`;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Gmail Message & Monitor</h1>
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
        <div className={styles.inboxHeader} style={{ flexWrap: "wrap", gap: "0.75rem" }}>
          <h2 className={styles.inboxTitle}>Email Loker Masuk & Terlacak</h2>
          <div className={styles.filterGroup} style={{ flexWrap: "wrap", gap: "0.5rem" }}>
            {/* Filter by Status/Type */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className={styles.filterBtn}
              style={{
                background: "var(--bg-subtle)",
                color: "var(--text)",
                border: "1px solid var(--border)",
                padding: "0.35rem 0.65rem",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <option value="">Semua Status / Tipe</option>
              <option value="INTERVIEW">Undangan Interview</option>
              <option value="OFFER">Job Offer Diterima</option>
              <option value="REJECTED">Lamaran Ditolak</option>
              <option value="SCREENING">Lolos Screening</option>
              <option value="APPLIED_CONFIRM">Lamaran Dikonfirmasi</option>
            </select>

            {/* Sort Order */}
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "desc" | "asc")}
              className={styles.filterBtn}
              style={{
                background: "var(--bg-subtle)",
                color: "var(--text)",
                border: "1px solid var(--border)",
                padding: "0.35rem 0.65rem",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <option value="desc">Urutkan: Terbaru</option>
              <option value="asc">Urutkan: Terlama</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className={styles.loadingBox}>Memuat daftar email...</div>
        ) : filteredEmails.length === 0 ? (
          <div className={styles.emptyBox}>
            <p>Belum ada pesan email terkait loker yang sesuai filter.</p>
            {status?.connected && (
              <button className={styles.subtleBtn} onClick={handleSync}>
                Jalankan Sinkronisasi Gmail
              </button>
            )}
          </div>
        ) : (
          <div className={styles.emailList}>
            {filteredEmails.map((m) => (
              <div
                key={m.id}
                className={styles.emailCard}
                onClick={() => setSelectedEmail(m)}
                title="Klik untuk membaca email lengkap atau buka di Gmail"
              >
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

                <button
                  className={styles.cardFooterHint}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedEmail(m);
                  }}
                  type="button"
                >
                  <span>Klik untuk baca isi pesan</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Email Detail Modal Overview */}
      {selectedEmail && (
        <div
          className={styles.modalOverlay}
          onClick={(e) => e.target === e.currentTarget && setSelectedEmail(null)}
        >
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleBox}>
                {selectedEmail.detectedType && (
                  <span className={`${styles.typeTag} ${styles[`type_${selectedEmail.detectedType}`] || ""}`}>
                    {selectedEmail.detectedType}
                  </span>
                )}
                <h2 className={styles.modalSubject}>{selectedEmail.subject}</h2>
              </div>
              <button className={styles.closeBtn} onClick={() => setSelectedEmail(null)}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalMeta}>
              <div className={styles.metaRow}>
                <User size={14} className={styles.metaIcon} />
                <span><strong>Dari:</strong> {selectedEmail.fromName ? `${selectedEmail.fromName} <${selectedEmail.fromEmail}>` : selectedEmail.fromEmail}</span>
              </div>
              {selectedEmail.toEmail && (
                <div className={styles.metaRow}>
                  <Mail size={14} className={styles.metaIcon} />
                  <span><strong>Kepada:</strong> {selectedEmail.toEmail}</span>
                </div>
              )}
              <div className={styles.metaRow}>
                <Calendar size={14} className={styles.metaIcon} />
                <span><strong>Waktu:</strong> {new Date(selectedEmail.receivedAt).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "medium" })}</span>
              </div>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.bodyContent}>
                {selectedEmail.bodyText || selectedEmail.snippet}
              </div>
            </div>

            <div className={styles.modalFooter}>
              <a
                href={getGmailWebUrl(selectedEmail)}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.openGmailBtn}
              >
                <ExternalLink size={14} />
                <span>Buka di Gmail (mail.google.com)</span>
              </a>
              <button className={styles.closeModalBtn} onClick={() => setSelectedEmail(null)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
