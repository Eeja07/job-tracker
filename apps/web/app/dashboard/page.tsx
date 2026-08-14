"use client";
import { useEffect, useState, useCallback } from "react";
import { dashboardApi, applicationsApi, type Application } from "@/lib/api";
import { STATUS_CONFIG, formatDate, getDaysAgo } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { Plus, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ApplicationDetailModal from "@/components/ApplicationDetailModal";
import ApplicationModal from "@/components/ApplicationModal";
import styles from "./page.module.css";

const STATUS_ORDER = ["SAVED","APPLIED","ASSESSMENT","HR_INTERVIEW","USER_INTERVIEW","OFFER","REJECTED","WITHDRAWN"] as const;

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<Record<string,number>>({});
  const [rejectionStats, setRejectionStats] = useState<Record<string,number>>({});
  const [recent, setRecent] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailApp, setDetailApp] = useState<Application | undefined>();
  const [editApp, setEditApp] = useState<Application | undefined>();

  const loadData = useCallback(async () => {
    try {
      const [dash, apps] = await Promise.allSettled([
        dashboardApi.get(),
        applicationsApi.list({ limit: 100, page: 1 }),
      ]);

      let fetchedStats: Record<string, number> = {
        SAVED: 0, APPLIED: 0, ASSESSMENT: 0, HR_INTERVIEW: 0, USER_INTERVIEW: 0, OFFER: 0, REJECTED: 0, WITHDRAWN: 0
      };
      let fetchedRejections: Record<string, number> = {
        APPLIED: 0, ASSESSMENT: 0, HR_INTERVIEW: 0, USER_INTERVIEW: 0, OFFER: 0
      };

      if (apps.status === "fulfilled") {
        const res = apps.value;
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        const sortedByApplied = [...list].sort((a: Application, b: Application) => {
          const tA = new Date(a.appliedAt || a.createdAt).getTime();
          const tB = new Date(b.appliedAt || b.createdAt).getTime();
          return tB - tA;
        });
        setRecent(sortedByApplied.slice(0, 5));

        list.forEach((app: Application) => {
          if (app.status) {
            fetchedStats[app.status] = (fetchedStats[app.status] || 0) + 1;
          }
          if (app.status === "REJECTED") {
            const stage = app.rejectedAtStage || "APPLIED";
            fetchedRejections[stage] = (fetchedRejections[stage] || 0) + 1;
          }
        });
      }

      if (dash.status === "fulfilled") {
        const d = dash.value;
        const dist = d?.pipelineDistribution ?? d?.data?.pipelineDistribution ?? d?.byStatus ?? d?.data?.byStatus;
        if (dist && Object.keys(dist).length > 0) {
          fetchedStats = { ...fetchedStats, ...dist };
        }
      }

      setStats(fetchedStats);
      setRejectionStats(fetchedRejections);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus lamaran ini?")) return;
    try {
      await applicationsApi.delete(id);
      setDetailApp(undefined);
      loadData();
    } catch (err: any) { alert(err.message); }
  };

  const handleSave = async (data: any) => {
    if (editApp) {
      await applicationsApi.update(editApp.id, data);
    } else {
      await applicationsApi.create(data);
    }
    setEditApp(undefined);
    loadData();
  };

  const total = Object.values(stats).reduce((s, n) => s + n, 0);
  const active =
    (stats["APPLIED"] ?? 0) +
    (stats["SCREENING"] ?? 0) +
    (stats["ASSESSMENT"] ?? 0) +
    (stats["HR_INTERVIEW"] ?? 0) +
    (stats["INTERVIEWING"] ?? 0) +
    (stats["USER_INTERVIEW"] ?? 0);
  const offers = stats["OFFER"] ?? 0;
  const rejected = stats["REJECTED"] ?? 0;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Overview</h1>
          <p className={styles.subtitle}>Ringkasan aktivitas lamaran kerja</p>
        </div>
        <Link href="/dashboard/applications?new=1" className={styles.primaryBtn}>
          <Plus size={15} /> Tambah Lamaran
        </Link>
      </div>

      <div className={styles.metricsGrid}>
        {[
          { label: "Total Lamaran", value: total },
          { label: "Aktif Diproses", value: active },
          { label: "Offer Diterima", value: offers },
          { label: "Ditolak", value: rejected },
        ].map(({ label, value }) => (
          <div key={label} className={styles.metricCard}>
            <span className={styles.metricLabel}>{label}</span>
            <span className={styles.metricValue}>{loading ? "—" : value}</span>
          </div>
        ))}
      </div>

      <div className={styles.layoutGrid}>
        <div className={styles.sectionCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Status Breakdown</h2>
          </div>
          <div className={styles.statusRows}>
            {STATUS_ORDER.map(status => {
              const cfg = STATUS_CONFIG[status];
              const count = stats[status] ?? 0;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div
                  key={status}
                  className={styles.statusRow}
                  onClick={() => router.push(`/dashboard/applications?status=${status}`)}
                  style={{ cursor: "pointer" }}
                  title={`Lihat semua lamaran status ${cfg.label}`}
                >
                  <div className={styles.statusLabelWrap}>
                    <span className={styles.statusBadge} style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className={styles.progressTrack}>
                    <div className={styles.progressBar} style={{ width: `${pct}%`, background: cfg.color }} />
                  </div>
                  <span className={styles.statusCount}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.sectionCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Diagram Persentase Status Lamaran</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", flexWrap: "wrap", gap: "1.25rem" }}>
              <div style={{ position: "relative", width: "130px", height: "130px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="130" height="130" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--bg-subtle)" strokeWidth="12" />
                  {(() => {
                    let accumulated = 0;
                    const r = 40;
                    const circumference = 2 * Math.PI * r;
                    return STATUS_ORDER.map((status) => {
                      const cfg = STATUS_CONFIG[status];
                      const count = stats[status] ?? 0;
                      if (!count || total <= 0) return null;
                      const pct = (count / total) * 100;
                      const dashArray = `${(pct / 100) * circumference} ${circumference}`;
                      const dashOffset = -((accumulated / 100) * circumference);
                      accumulated += pct;

                      return (
                        <circle
                          key={status}
                          cx="50"
                          cy="50"
                          r={r}
                          fill="transparent"
                          stroke={cfg.color}
                          strokeWidth="12"
                          strokeDasharray={dashArray}
                          strokeDashoffset={dashOffset}
                          style={{ transition: "all 0.4s ease", cursor: "pointer" }}
                          onClick={() => router.push(`/dashboard/applications?status=${status}`)}
                        >
                          <title>{`${cfg.label}: ${count} (${pct.toFixed(1)}%)`}</title>
                        </circle>
                      );
                    });
                  })()}
                </svg>
                <div style={{ position: "absolute", textAlign: "center" }}>
                  <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text)" }}>{total}</div>
                  <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Lamaran</div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", flex: 1, minWidth: "160px" }}>
                {STATUS_ORDER.map((status) => {
                  const cfg = STATUS_CONFIG[status];
                  const count = stats[status] ?? 0;
                  if (!count) return null;
                  const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0";
                  return (
                    <div
                      key={status}
                      onClick={() => router.push(`/dashboard/applications?status=${status}`)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontSize: "0.78rem",
                        cursor: "pointer",
                        padding: "0.3rem 0.5rem",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--bg-subtle)",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: cfg.color }} />
                        <span style={{ fontWeight: 500, color: "var(--text)" }}>{cfg.label}</span>
                      </div>
                      <span style={{ fontWeight: 700, color: cfg.color }}>{pct}% ({count})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.sectionCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Diagram Analisis Stage Penolakan</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {(() => {
              const totalRejected = stats.REJECTED ?? 0;
              const stages = [
                { key: "APPLIED", label: "Ditolak di Applied (CV)", color: "#ef4444" },
                { key: "ASSESSMENT", label: "Ditolak di Assessment / Tes", color: "#a855f7" },
                { key: "HR_INTERVIEW", label: "Ditolak di HR Interview", color: "#3b82f6" },
                { key: "USER_INTERVIEW", label: "Ditolak di User Interview", color: "#06b6d4" },
                { key: "OFFER", label: "Ditolak saat Offering", color: "#f59e0b" },
              ];

              if (totalRejected === 0) {
                return (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", flexWrap: "wrap", gap: "1.25rem", padding: "0.5rem 0" }}>
                    <div style={{ position: "relative", width: "130px", height: "130px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="130" height="130" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
                        <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--bg-subtle)" strokeWidth="12" />
                      </svg>
                      <div style={{ position: "absolute", textAlign: "center" }}>
                        <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-muted)" }}>0</div>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Ditolak</div>
                      </div>
                    </div>
                    <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.82rem", flex: 1, minWidth: "160px" }}>
                      Belum ada lamaran berstatus ditolak.
                    </div>
                  </div>
                );
              }

              let accumulated = 0;
              const r = 40;
              const circumference = 2 * Math.PI * r;

              return (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", flexWrap: "wrap", gap: "1.25rem" }}>
                  <div style={{ position: "relative", width: "130px", height: "130px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="130" height="130" viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)" }}>
                      <circle cx="50" cy="50" r="40" fill="transparent" stroke="var(--bg-subtle)" strokeWidth="12" />
                      {stages.map((st) => {
                        const count = rejectionStats[st.key] ?? 0;
                        if (!count || totalRejected <= 0) return null;
                        const pct = (count / totalRejected) * 100;
                        const dashArray = `${(pct / 100) * circumference} ${circumference}`;
                        const dashOffset = -((accumulated / 100) * circumference);
                        accumulated += pct;

                        return (
                          <circle
                            key={st.key}
                            cx="50"
                            cy="50"
                            r={r}
                            fill="transparent"
                            stroke={st.color}
                            strokeWidth="12"
                            strokeDasharray={dashArray}
                            strokeDashoffset={dashOffset}
                            style={{ transition: "all 0.4s ease" }}
                          >
                            <title>{`${st.label}: ${count} (${pct.toFixed(1)}%)`}</title>
                          </circle>
                        );
                      })}
                    </svg>
                    <div style={{ position: "absolute", textAlign: "center" }}>
                      <div style={{ fontSize: "1.2rem", fontWeight: 700, color: "#ef4444" }}>{totalRejected}</div>
                      <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Ditolak</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", flex: 1, minWidth: "160px" }}>
                    {stages.map((st) => {
                      const count = rejectionStats[st.key] ?? 0;
                      if (!count) return null;
                      const pct = ((count / totalRejected) * 100).toFixed(1);
                      return (
                        <div
                          key={st.key}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            fontSize: "0.78rem",
                            padding: "0.3rem 0.5rem",
                            borderRadius: "var(--radius-sm)",
                            background: "var(--bg-subtle)",
                            border: "1px solid var(--border-subtle)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: st.color }} />
                            <span style={{ fontWeight: 500, color: "var(--text)" }}>{st.label}</span>
                          </div>
                          <span style={{ fontWeight: 700, color: st.color }}>{pct}% ({count})</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        <div className={styles.sectionCard}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Lamaran Terbaru</h2>
            <Link href="/dashboard/applications" className={styles.textLink}>
              Lihat semua <ArrowRight size={12} />
            </Link>
          </div>
          {loading ? (
            <div className={styles.loadingPlaceholder}>Memuat data...</div>
          ) : recent.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Belum ada lamaran tersimpan</p>
              <Link href="/dashboard/applications?new=1" className={styles.subtleLink}>+ Tambah lamaran pertama</Link>
            </div>
          ) : (
            <div className={styles.recentList}>
              {recent.map(app => {
                const cfg = STATUS_CONFIG[app.status];
                const companyName = app.company?.name ?? "—";
                const initial = companyName.charAt(0).toUpperCase();

                return (
                  <div key={app.id} className={styles.recentRow} onClick={() => setDetailApp(app)}>
                    <div className={styles.recentLeft}>
                      {app.imageUrl ? (
                        <img src={app.imageUrl} alt={app.jobTitle} className={styles.thumbImg} />
                      ) : (
                        <div className={styles.thumbPlaceholder}>{initial}</div>
                      )}
                      <div className={styles.recentMeta}>
                        <span className={styles.recentTitle}>{app.jobTitle}</span>
                        <span className={styles.recentCompany}>{companyName}</span>
                      </div>
                    </div>
                    <div className={styles.recentRight}>
                      <span className={styles.statusBadge} style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}>
                        {cfg.label}
                      </span>
                      <span className={styles.recentTime}>{formatDate(app.appliedAt)} ({getDaysAgo(app.appliedAt)})</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detail Full Preview Modal */}
      {detailApp && (
        <ApplicationDetailModal
          app={detailApp}
          onEdit={() => {
            setEditApp(detailApp);
            setDetailApp(undefined);
          }}
          onDelete={() => handleDelete(detailApp.id)}
          onClose={() => setDetailApp(undefined)}
        />
      )}

      {/* Edit Modal */}
      {editApp && (
        <ApplicationModal
          app={editApp}
          onSave={handleSave}
          onClose={() => setEditApp(undefined)}
        />
      )}
    </div>
  );
}

