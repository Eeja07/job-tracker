"use client";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { applicationsApi, type Application, type ApplicationStatus } from "@/lib/api";
import { STATUS_CONFIG, WORK_MODE_LABELS, SOURCE_LABELS, formatCurrency, formatDate } from "@/lib/utils";
import { Plus, Search, ExternalLink, Trash2, X, Loader2, Edit2, Eye, FileText, Image as ImageIcon, CheckSquare, RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";
import ApplicationModal from "@/components/ApplicationModal";
import ApplicationDetailModal from "@/components/ApplicationDetailModal";
import styles from "./page.module.css";

const STATUSES = ["SAVED","APPLIED","SCREENING","INTERVIEWING","OFFER","REJECTED","WITHDRAWN"] as const;

export default function ApplicationsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [apps, setApps] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "">("");
  const [showModal, setShowModal] = useState(false);
  const [editApp, setEditApp] = useState<Application | undefined>();
  const [detailApp, setDetailApp] = useState<Application | undefined>();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [checkingAll, setCheckingAll] = useState(false);
  const [checkAllResults, setCheckAllResults] = useState<Array<{ applicationId: string; jobTitle: string; listingStatus: string; detail?: string }> | null>(null);
  const [showCheckResults, setShowCheckResults] = useState(false);

  const limit = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await applicationsApi.list({ page, limit, status: statusFilter || undefined, search: search || undefined });
      setApps(Array.isArray(res?.data) ? res.data : []);
      setTotal(res?.total ?? 0);
    } catch {
      setApps([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setShowModal(true);
      router.replace("/dashboard/applications");
    }
  }, [searchParams, router]);

  const handleSave = async (data: any) => {
    if (editApp) {
      await applicationsApi.update(editApp.id, data);
    } else {
      await applicationsApi.create(data);
    }
    setShowModal(false);
    setEditApp(undefined);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus lamaran ini?")) return;
    setDeletingId(id);
    try {
      await applicationsApi.delete(id);
      if (detailApp?.id === id) setDetailApp(undefined);
      load();
    } catch (err: any) { alert(err.message); }
    finally { setDeletingId(null); }
  };

  const handleStatusChange = async (id: string, status: ApplicationStatus) => {
    await applicationsApi.updateStatus(id, status);
    load();
  };

  const handleCheckAllListings = async () => {
    setCheckingAll(true);
    setCheckAllResults(null);
    try {
      const results = await applicationsApi.checkAllListings();
      setCheckAllResults(results);
      setShowCheckResults(true);
    } catch (err: any) {
      alert(err.message || "Gagal mengecek status listing");
    } finally {
      setCheckingAll(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Applications</h1>
          <p className={styles.subtitle}>{total} total lamaran</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button
            className={styles.primaryBtn}
            style={{ background: "var(--bg-subtle)", color: "var(--text)", border: "1px solid var(--border)" }}
            onClick={handleCheckAllListings}
            disabled={checkingAll}
            title="Cek status keaktifan semua lowongan yang tersimpan"
          >
            {checkingAll ? <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={14} />}
            {checkingAll ? "Mengecek..." : "Cek Status Listing"}
          </button>
          <button className={styles.primaryBtn} onClick={() => { setEditApp(undefined); setShowModal(true); }}>
            <Plus size={15} /> Tambah Lamaran
          </button>
        </div>
      </div>

      {showCheckResults && checkAllResults && (
        <div style={{
          background: "var(--bg-subtle)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Hasil Cek Status Listing ({checkAllResults.length} lowongan)</span>
            <button onClick={() => setShowCheckResults(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}><X size={14} /></button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {checkAllResults.map(r => (
              <div key={r.applicationId} style={{
                display: "flex", alignItems: "center", gap: "8px",
                fontSize: "0.82rem", padding: "0.3rem 0",
                borderBottom: "1px solid var(--border-subtle)",
              }}>
                {r.listingStatus === "ACTIVE" && <CheckCircle size={13} style={{ color: "#10b981", flexShrink: 0 }} />}
                {r.listingStatus === "CLOSED" && <AlertTriangle size={13} style={{ color: "#ef4444", flexShrink: 0 }} />}
                {(r.listingStatus === "UNKNOWN" || r.listingStatus === "ERROR") && <RefreshCw size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
                <span style={{ flex: 1, fontWeight: 500 }}>{r.jobTitle}</span>
                <span style={{
                  color: r.listingStatus === "ACTIVE" ? "#10b981" : r.listingStatus === "CLOSED" ? "#ef4444" : "var(--text-muted)",
                  fontWeight: 600,
                }}>{r.listingStatus}</span>
                {r.detail && <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>— {r.detail}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.filterRow}>
        <div className={styles.searchBox}>
          <Search size={14} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Cari posisi atau perusahaan..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
          {search && <button className={styles.clearBtn} onClick={() => setSearch("")}><X size={12} /></button>}
        </div>

        <select className={styles.selectFilter} value={statusFilter} onChange={e => { setStatusFilter(e.target.value as any); setPage(1); }}>
          <option value="">Semua Status</option>
          {STATUSES.map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className={styles.loadingWrap}>
          <Loader2 size={18} className={styles.spinner} />
        </div>
      ) : apps.length === 0 ? (
        <div className={styles.emptyState}>
          <p>Tidak ada lamaran ditemukan</p>
          <button className={styles.subtleBtn} onClick={() => setShowModal(true)}>+ Tambah baru</button>
        </div>
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Posisi & Perusahaan</th>
                <th>Status</th>
                <th>Work Mode</th>
                <th>Salary Range</th>
                <th>Tanggal Apply</th>
                <th style={{ textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {apps.map(app => {
                const cfg = STATUS_CONFIG[app.status];
                const companyName = app.company?.name ?? "—";
                const initial = companyName.charAt(0).toUpperCase();

                return (
                  <tr key={app.id}>
                    <td>
                      <div className={styles.jobCellRow}>
                        {app.imageUrl ? (
                          <img src={app.imageUrl} alt={app.jobTitle} className={styles.thumbImg} />
                        ) : (
                          <div className={styles.thumbPlaceholder}>{initial}</div>
                        )}
                        <div className={styles.jobCell}>
                          <span
                            className={styles.jobTitle}
                            style={{ cursor: "pointer" }}
                            onClick={() => setDetailApp(app)}
                          >
                            {app.jobTitle}
                          </span>
                          <span className={styles.companyName}>
                            {companyName}
                            {app.location ? ` • ${app.location}` : ""}
                          </span>
                          
                          {/* Attachment badges */}
                          {(app.cvName || app.portfolioName || app.requirements || app.notesContent || (app.notesImages && app.notesImages.length > 0)) && (
                            <div className={styles.badgesRow}>
                              {app.cvName && (
                                <span className={styles.miniBadge} title={`CV: ${app.cvName}`}>
                                  <FileText size={10} /> CV
                                </span>
                              )}
                              {app.portfolioName && (
                                <span className={styles.miniBadge} title={`Portfolio: ${app.portfolioName}`}>
                                  <FileText size={10} /> Portofolio
                                </span>
                              )}
                              {app.requirements && (
                                <span className={styles.miniBadge} title="Persyaratan terisi">
                                  <CheckSquare size={10} /> Req
                                </span>
                              )}
                              {(app.notesContent || (app.notesImages && app.notesImages.length > 0)) && (
                                <span className={styles.miniBadge} title="Catatan/Foto terisi">
                                  <ImageIcon size={10} /> Catatan
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <select
                        className={styles.statusSelect}
                        value={app.status}
                        onChange={e => handleStatusChange(app.id, e.target.value as ApplicationStatus)}
                        style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
                      >
                        {STATUSES.map(s => (
                          <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className={styles.textCell}>
                        {app.workMode ? WORK_MODE_LABELS[app.workMode as keyof typeof WORK_MODE_LABELS] : "—"}
                      </span>
                    </td>
                    <td>
                      <span className={styles.textCell}>
                        {app.salaryMin || app.salaryMax
                          ? `${app.salaryMin ? formatCurrency(app.salaryMin, app.currency) : "?"} - ${app.salaryMax ? formatCurrency(app.salaryMax, app.currency) : "?"}`
                          : "—"}
                      </span>
                    </td>
                    <td>
                      <span className={styles.textCell}>{formatDate(app.appliedAt)}</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className={styles.actionBtns}>
                        <button className={styles.iconBtn} onClick={() => setDetailApp(app)} title="Lihat Detail Full">
                          <Eye size={13} />
                        </button>
                        {app.sourceUrl && (
                          <a href={app.sourceUrl} target="_blank" rel="noopener noreferrer" className={styles.iconBtn} title="Buka Link">
                            <ExternalLink size={13} />
                          </a>
                        )}
                        <button className={styles.iconBtn} onClick={() => { setEditApp(app); setShowModal(true); }} title="Edit">
                          <Edit2 size={13} />
                        </button>
                        <button
                          className={`${styles.iconBtn} ${styles.deleteBtn}`}
                          onClick={() => handleDelete(app.id)}
                          disabled={deletingId === app.id}
                          title="Hapus"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button className={styles.pageBtn} disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
          <span className={styles.pageInfo}>{page} / {totalPages}</span>
          <button className={styles.pageBtn} disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
        </div>
      )}

      {/* Edit / Create Modal */}
      {showModal && (
        <ApplicationModal
          app={editApp}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditApp(undefined); }}
        />
      )}

      {/* Detail Full Preview Modal */}
      {detailApp && (
        <ApplicationDetailModal
          app={detailApp}
          onEdit={() => {
            setEditApp(detailApp);
            setDetailApp(undefined);
            setShowModal(true);
          }}
          onDelete={() => handleDelete(detailApp.id)}
          onClose={() => setDetailApp(undefined)}
        />
      )}
    </div>
  );
}

