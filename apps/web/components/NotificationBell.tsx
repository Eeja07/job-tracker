"use client";
import { useEffect, useState, useRef } from "react";
import { Bell, Mail, CheckCheck, RefreshCw, AlertCircle, Check } from "lucide-react";
import { notificationApi, gmailApi, type NotificationItem, type GmailStatus } from "@/lib/api";
import styles from "./NotificationBell.module.css";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchStatusAndNotifs = async () => {
    try {
      const [status, notifs] = await Promise.all([
        gmailApi.getStatus().catch(() => null),
        notificationApi.getNotifications().catch(() => []),
      ]);
      setGmailStatus(status);
      setNotifications(Array.isArray(notifs) ? notifs : []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStatusAndNotifs();
    const interval = setInterval(fetchStatusAndNotifs, 30000); // Polling every 30s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await gmailApi.sync();
      await fetchStatusAndNotifs();
    } catch (err: any) {
      alert("Gagal sinkronisasi: " + (err.message || "Error"));
    } finally {
      setSyncing(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkItemRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await notificationApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const [selectedNotif, setSelectedNotif] = useState<NotificationItem | null>(null);

  const handleItemClick = (n: NotificationItem) => {
    if (!n.isRead) {
      handleMarkItemRead(n.id);
    }
    setSelectedNotif(n);
    setOpen(false);
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <>
      <div className={styles.bellContainer} ref={dropdownRef}>
        <button
          className={styles.bellBtn}
          onClick={() => {
            setOpen(!open);
            if (!open) fetchStatusAndNotifs();
          }}
          title="Notifikasi Email Loker"
        >
          <Bell size={15} />
          {unreadCount > 0 && <span className={styles.badge}>{unreadCount > 99 ? "99+" : unreadCount}</span>}
        </button>

        {open && (
          <div className={styles.dropdown}>
            <div className={styles.header}>
              <div className={styles.titleRow}>
                <span className={styles.title}>Notifikasi Loker & Gmail</span>
                {unreadCount > 0 && (
                  <button className={styles.markReadBtn} onClick={handleMarkAllRead} title="Tandai semua dibaca">
                    <CheckCheck size={13} /> Semuanya Dibaca
                  </button>
                )}
              </div>
              {gmailStatus && (
                <div className={styles.statusRow}>
                  <span className={`${styles.statusDot} ${gmailStatus.connected ? styles.online : styles.offline}`} />
                  <span className={styles.statusText}>
                    {gmailStatus.connected ? gmailStatus.gmailEmail : "Gmail belum terhubung"}
                  </span>
                  {gmailStatus.connected && (
                    <button className={styles.syncBtn} onClick={handleSync} disabled={syncing} title="Sinkronisasi Email Sekarang">
                      <RefreshCw size={12} className={syncing ? styles.spin : ""} />
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className={styles.body}>
              {!gmailStatus?.connected && (
                <div className={styles.connectPrompt}>
                  <AlertCircle size={18} className={styles.promptIcon} />
                  <p>Hubungkan Gmail Anda untuk menerima pemberitahuan balasan & status lowongan secara real-time.</p>
                  <button
                    className={styles.connectBtn}
                    onClick={async () => {
                      const res = await gmailApi.getConnectUrl();
                      if (res?.url) window.location.href = res.url;
                    }}
                  >
                    <Mail size={14} /> Hubungkan Gmail
                  </button>
                </div>
              )}

              {notifications.length === 0 ? (
                <div className={styles.emptyState}>Belum ada notifikasi email loker.</div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`${styles.notifItem} ${!n.isRead ? styles.unread : ""}`}
                    onClick={() => handleItemClick(n)}
                    style={{ cursor: "pointer" }}
                    title="Klik untuk membaca isi notifikasi selengkapnya"
                  >
                    <div className={styles.notifHeader}>
                      <div className={styles.titleGroup}>
                        {!n.isRead && <span className={styles.unreadDot} />}
                        <span className={styles.notifTitle}>{n.title}</span>
                      </div>
                      <div className={styles.timeGroup}>
                        <span className={styles.notifTime}>
                          {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {!n.isRead && (
                          <button
                            className={styles.itemReadBtn}
                            onClick={(e) => handleMarkItemRead(n.id, e)}
                            title="Tandai sudah dibaca"
                          >
                            <Check size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className={styles.notifBody}>{n.body}</p>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "4px", fontWeight: 500 }}>
                      Klik untuk baca detail &rarr;
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Notification Detail Modal Reader */}
      {selectedNotif && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            zIndex: 1100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={(e) => e.target === e.currentTarget && setSelectedNotif(null)}
        >
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "12px",
              width: "100%",
              maxWidth: "520px",
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "1.25rem 1.5rem",
                borderBottom: "1px solid var(--border)",
                background: "var(--bg-subtle)",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "1rem",
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Detail Notifikasi Loker
                </span>
                <h3 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text)", marginTop: "4px" }}>
                  {selectedNotif.title}
                </h3>
                <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  {new Date(selectedNotif.createdAt).toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" })}
                </span>
              </div>
              <button
                onClick={() => setSelectedNotif(null)}
                style={{
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  borderRadius: "6px",
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                ✕
              </button>
            </div>

            {/* Body Text */}
            <div style={{ padding: "1.5rem", flex: 1, overflowY: "auto", fontSize: "0.9rem", color: "var(--text)", lineHeight: 1.6, whiteSpace: "pre-line" }}>
              {selectedNotif.body}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "1rem 1.5rem",
                borderTop: "1px solid var(--border)",
                background: "var(--bg-subtle)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "0.75rem",
              }}
            >
              <a
                href="/dashboard/gmail"
                style={{
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: "var(--btn-text)",
                  background: "var(--btn-bg)",
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Mail size={14} /> Buka Halaman Gmail Sync
              </a>
              <button
                onClick={() => setSelectedNotif(null)}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text-muted)",
                  fontSize: "0.82rem",
                  cursor: "pointer",
                }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
