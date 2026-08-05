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

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
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
                  onClick={() => !n.isRead && handleMarkItemRead(n.id)}
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
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
