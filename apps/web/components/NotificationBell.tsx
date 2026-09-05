"use client";
import { useEffect, useState, useRef, useSyncExternalStore } from "react";
import { Bell, Mail, CheckCheck, RefreshCw, AlertCircle, Check } from "lucide-react";
import { notificationApi, gmailApi, type NotificationItem, type GmailStatus } from "@/lib/api";
import styles from "./NotificationBell.module.css";

// Audio & Desktop Notification Deduplication Registries
const globalNotifiedSet = new Set<string>();
let lastSoundTime = 0;
let lastDesktopNotifTime = 0;

// Web Audio API sound generator for crisp notification chime (deduplicated)
function playNotificationSound() {
  const now = Date.now();
  if (now - lastSoundTime < 1500) return;
  lastSoundTime = now;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    console.error("Audio playback error:", e);
  }
}

// Browser Desktop Popup Notification (deduplicated across instances & tabs)
function triggerDesktopNotification(title: string, body: string, notifId?: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;

  const now = Date.now();
  if (now - lastDesktopNotifTime < 1500) return;
  lastDesktopNotifTime = now;

  if (notifId) {
    globalNotifiedSet.add(notifId);
    try {
      sessionStorage.setItem(`jt_notified_${notifId}`, "1");
    } catch {}
  }

  if (Notification.permission === "granted") {
    try {
      new Notification(title, {
        body,
        icon: "/favicon.ico",
      });
    } catch (e) {
      console.error("Desktop notification error:", e);
    }
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        new Notification(title, {
          body,
          icon: "/favicon.ico",
        });
      }
    });
  }
}

// ==========================================
// Centralized Singleton Notification Store
// Ensures only ONE polling loop runs, syncing desktop & mobile bells
// ==========================================
interface NotificationStoreState {
  notifications: NotificationItem[];
  gmailStatus: GmailStatus | null;
  syncing: boolean;
  loading: boolean;
}

let storeState: NotificationStoreState = {
  notifications: [],
  gmailStatus: null,
  syncing: false,
  loading: true,
};

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

let hasInitializedExisting = false;
let isFetching = false;
let pollingInterval: any = null;
let subscriberCount = 0;

async function fetchStatusAndNotifsGlobal() {
  if (isFetching) return;
  isFetching = true;

  try {
    const [status, notifs] = await Promise.all([
      gmailApi.getStatus().catch(() => null),
      notificationApi.getNotifications().catch(() => []),
    ]);

    const notifList = Array.isArray(notifs) ? notifs : [];

    // Check for newly arrived notifications
    if (hasInitializedExisting) {
      const newItems = notifList.filter((n) => {
        if (globalNotifiedSet.has(n.id)) return false;
        try {
          if (sessionStorage.getItem(`jt_notified_${n.id}`)) {
            globalNotifiedSet.add(n.id);
            return false;
          }
        } catch {}
        return true;
      });

      if (newItems.length > 0) {
        for (const item of newItems) {
          globalNotifiedSet.add(item.id);
          try {
            sessionStorage.setItem(`jt_notified_${item.id}`, "1");
          } catch {}
        }

        playNotificationSound();
        const firstNew = newItems[0];
        if (firstNew) {
          triggerDesktopNotification(
            firstNew.title || "Email Loker Baru!",
            firstNew.body || "Ada pembaruan email loker terbaru.",
            firstNew.id
          );
        }
      }
    } else {
      // First fetch: seed existing notifications so they don't trigger alerts
      for (const n of notifList) {
        globalNotifiedSet.add(n.id);
      }
      hasInitializedExisting = true;
    }

    storeState = {
      ...storeState,
      gmailStatus: status,
      notifications: notifList,
      loading: false,
    };
    emitChange();
  } catch (err) {
    console.error("fetchStatusAndNotifsGlobal error:", err);
  } finally {
    isFetching = false;
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  subscriberCount++;

  if (subscriberCount === 1) {
    fetchStatusAndNotifsGlobal();
    pollingInterval = setInterval(fetchStatusAndNotifsGlobal, 30000);
  }

  return () => {
    listeners.delete(callback);
    subscriberCount--;
    if (subscriberCount === 0 && pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  };
}

function getSnapshot() {
  return storeState;
}

export default function NotificationBell() {
  const { notifications, gmailStatus, syncing } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [selectedNotif, setSelectedNotif] = useState<NotificationItem | null>(null);

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
    storeState = { ...storeState, syncing: true };
    emitChange();
    try {
      await gmailApi.sync();
      await fetchStatusAndNotifsGlobal();
    } catch (err: any) {
      alert("Gagal sinkronisasi: " + (err.message || "Error"));
    } finally {
      storeState = { ...storeState, syncing: false };
      emitChange();
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllRead();
      storeState = { ...storeState, notifications: [] };
      emitChange();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkItemRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await notificationApi.markRead(id);
      storeState = {
        ...storeState,
        notifications: storeState.notifications.filter((n) => n.id !== id),
      };
      emitChange();
    } catch (err) {
      console.error(err);
    }
  };

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
            if (!open) fetchStatusAndNotifsGlobal();
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

              {(() => {
                const unreadNotifs = notifications.filter((n) => !n.isRead);
                if (unreadNotifs.length === 0) {
                  return <div className={styles.emptyState}>Semua notifikasi sudah dibaca.</div>;
                }
                return unreadNotifs.map((n) => (
                  <div
                    key={n.id}
                    className={`${styles.notifItem} ${styles.unread}`}
                    onClick={() => handleItemClick(n)}
                    style={{ cursor: "pointer" }}
                    title="Klik untuk membaca isi notifikasi selengkapnya"
                  >
                    <div className={styles.notifHeader}>
                      <div className={styles.titleGroup}>
                        <span className={styles.unreadDot} />
                        <span className={styles.notifTitle}>{n.title}</span>
                      </div>
                      <div className={styles.timeGroup}>
                        <span className={styles.notifTime}>
                          {new Date(n.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <button
                          className={styles.itemReadBtn}
                          onClick={(e) => handleMarkItemRead(n.id, e)}
                          title="Tandai sudah dibaca (hilangkan dari notifikasi)"
                        >
                          <Check size={12} />
                        </button>
                      </div>
                    </div>
                    <p className={styles.notifBody}>{n.body}</p>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "4px", fontWeight: 500 }}>
                      Klik untuk baca detail &rarr;
                    </div>
                  </div>
                ));
              })()}
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
                <Mail size={14} /> Buka Halaman Gmail Message
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
