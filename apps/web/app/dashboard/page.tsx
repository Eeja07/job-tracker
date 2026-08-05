"use client";
import { useEffect, useState, useCallback } from "react";
import { dashboardApi, applicationsApi, type Application } from "@/lib/api";
import { STATUS_CONFIG, timeAgo } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { Plus, ArrowRight } from "lucide-react";
import Link from "next/link";
import ApplicationDetailModal from "@/components/ApplicationDetailModal";
import ApplicationModal from "@/components/ApplicationModal";
import styles from "./page.module.css";

const STATUS_ORDER = ["SAVED","APPLIED","SCREENING","INTERVIEWING","OFFER","REJECTED","WITHDRAWN"] as const;

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Record<string,number>>({});
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
        SAVED: 0, APPLIED: 0, SCREENING: 0, INTERVIEWING: 0, OFFER: 0, REJECTED: 0, WITHDRAWN: 0
      };

      if (apps.status === "fulfilled") {
        const res = apps.value;
        const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
        setRecent(list.slice(0, 5));

        list.forEach((app: Application) => {
          if (app.status) {
            fetchedStats[app.status] = (fetchedStats[app.status] || 0) + 1;
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
  const active = (stats["APPLIED"] ?? 0) + (stats["SCREENING"] ?? 0) + (stats["INTERVIEWING"] ?? 0);
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
                <div key={status} className={styles.statusRow}>
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
                      <span className={styles.recentTime}>{timeAgo(app.createdAt)}</span>
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

