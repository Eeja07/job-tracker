"use client";
import { useState } from "react";
import type { Application } from "@/lib/api";
import { applicationsApi } from "@/lib/api";
import { STATUS_CONFIG, WORK_MODE_LABELS, SOURCE_LABELS, formatCurrency, formatDate } from "@/lib/utils";
import { X, Edit2, Trash2, ExternalLink, FileText, Image as ImageIcon, Briefcase, Calendar, MapPin, DollarSign, CheckSquare, Download, Eye, RefreshCw, CheckCircle, AlertTriangle, HelpCircle } from "lucide-react";
import styles from "./ApplicationDetailModal.module.css";

interface Props {
  app: Application;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function ApplicationDetailModal({ app, onEdit, onDelete, onClose }: Props) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ name: string; url: string } | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [listingStatus, setListingStatus] = useState<"ACTIVE" | "CLOSED" | "UNKNOWN" | "ERROR" | null>(null);
  const [listingDetail, setListingDetail] = useState<string | undefined>();

  const handleCheckListingStatus = async () => {
    setCheckingStatus(true);
    try {
      const res = await applicationsApi.checkListingStatus(app.id);
      if (res) {
        setListingStatus(res.listingStatus);
        setListingDetail(res.detail);
      }
    } catch {
      setListingStatus("ERROR");
    } finally {
      setCheckingStatus(false);
    }
  };

  const statusCfg = STATUS_CONFIG[app.status];

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.titleArea}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <h2 className={styles.jobTitle}>{app.jobTitle}</h2>
              <span
                className={styles.statusBadge}
                style={{ color: statusCfg.color, background: statusCfg.bg, borderColor: statusCfg.border }}
              >
                {statusCfg.label}
              </span>
            </div>
            <div className={styles.companyRow}>
              <span className={styles.companyName}>{app.company?.name ?? "—"}</span>
              {app.location && (
                <>
                  <span>•</span>
                  <span><MapPin size={13} style={{ display: "inline-block", verticalAlign: "middle" }} /> {app.location}</span>
                </>
              )}
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={16} /></button>
        </div>

        {/* Modal Content Body */}
        <div className={styles.modalBody}>
          {/* Main Hero Image / Screenshot / Company Photo */}
          {app.imageUrl && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>
                <ImageIcon size={15} /> Poster / Tangkapan Layar Lowongan (Klik untuk Layar Penuh)
              </h3>
              <div className={styles.heroImageContainer} onClick={() => setSelectedImage(app.imageUrl!)} title="Klik untuk perbesar poster">
                <img src={app.imageUrl} alt="Foto/Screenshot Lamaran" className={styles.heroImage} />
              </div>
            </div>
          )}

          {/* Key Metrics Grid */}
          <div className={styles.metaGrid}>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Gaji / Salary</span>
              <span className={styles.metaValue}>
                <DollarSign size={14} className={styles.metaIcon} />
                {app.salaryMin || app.salaryMax
                  ? `${app.salaryMin ? formatCurrency(app.salaryMin, app.currency) : "?"} - ${app.salaryMax ? formatCurrency(app.salaryMax, app.currency) : "?"}`
                  : "—"}
              </span>
            </div>

            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Work Mode</span>
              <span className={styles.metaValue}>
                <Briefcase size={14} className={styles.metaIcon} />
                {app.workMode ? WORK_MODE_LABELS[app.workMode as keyof typeof WORK_MODE_LABELS] : "—"}
              </span>
            </div>

            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Sumber Info</span>
              <span className={styles.metaValue}>
                {app.source ? SOURCE_LABELS[app.source as keyof typeof SOURCE_LABELS] : "—"}
              </span>
            </div>

            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Tanggal Apply</span>
              <span className={styles.metaValue}>
                <Calendar size={14} className={styles.metaIcon} />
                {formatDate(app.appliedAt)}
              </span>
            </div>

            {app.deadline && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Deadline</span>
                <span className={styles.metaValue}>{formatDate(app.deadline)}</span>
              </div>
            )}
          </div>

          {/* Job Requirements / Description */}
          {app.requirements && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>
                <CheckSquare size={15} /> Kualifikasi & Persyaratan (Requirements)
              </h3>
              <div className={styles.contentBox}>{app.requirements}</div>
            </div>
          )}

          {/* Uploaded Documents (CV & Portfolio) */}
          {(app.cvName || app.portfolioName || app.sourceUrl) && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>
                <FileText size={15} /> Dokumen & Link Terlampir
              </h3>
              <div className={styles.docsGrid}>
                {app.sourceUrl && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <a href={app.sourceUrl} target="_blank" rel="noopener noreferrer" className={styles.docCard} style={{ flex: 1 }}>
                      <div className={styles.docInfo}>
                        <ExternalLink size={16} className={styles.docIcon} />
                        <span className={styles.docName}>Link Lowongan Asli</span>
                      </div>
                      <ExternalLink size={14} style={{ opacity: 0.6 }} />
                    </a>
                    <button
                      type="button"
                      onClick={handleCheckListingStatus}
                      disabled={checkingStatus}
                      title="Cek apakah lowongan masih aktif"
                      style={{
                        flexShrink: 0,
                        padding: "0.5rem 0.75rem",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--bg-subtle)",
                        color: "var(--text)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {checkingStatus
                        ? <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} />
                        : <RefreshCw size={13} />}
                      {checkingStatus ? "Mengecek..." : "Cek Status"}
                    </button>
                  </div>
                )}
                {listingStatus && (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid",
                    fontSize: "0.82rem",
                    fontWeight: 500,
                    borderColor: listingStatus === "ACTIVE" ? "rgba(16,185,129,0.3)" : listingStatus === "CLOSED" ? "rgba(239,68,68,0.3)" : "var(--border)",
                    background: listingStatus === "ACTIVE" ? "rgba(16,185,129,0.08)" : listingStatus === "CLOSED" ? "rgba(239,68,68,0.08)" : "var(--bg-subtle)",
                    color: listingStatus === "ACTIVE" ? "#10b981" : listingStatus === "CLOSED" ? "#ef4444" : "var(--text-muted)",
                  }}>
                    {listingStatus === "ACTIVE" && <CheckCircle size={14} />}
                    {listingStatus === "CLOSED" && <AlertTriangle size={14} />}
                    {(listingStatus === "UNKNOWN" || listingStatus === "ERROR") && <HelpCircle size={14} />}
                    <span>
                      {listingStatus === "ACTIVE" && "Lowongan masih aktif"}
                      {listingStatus === "CLOSED" && "Lowongan telah ditutup"}
                      {listingStatus === "UNKNOWN" && "Status tidak dapat dideteksi (situs terproteksi)"}
                      {listingStatus === "ERROR" && "Gagal mengecek status"}
                      {listingDetail && ` — ${listingDetail}`}
                    </span>
                  </div>
                )}

                {app.cvName && (
                  <div
                    className={styles.docCard}
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                      if (app.cvUrl) {
                        setPreviewDoc({ name: app.cvName!, url: app.cvUrl });
                      }
                    }}
                  >
                    <div className={styles.docInfo}>
                      <FileText size={16} className={styles.docIcon} />
                      <div>
                        <div className={styles.docName}>{app.cvName}</div>
                        <span style={{ fontSize: "0.75rem", color: "#60a5fa" }}>Klik untuk Pratinjau (Preview)</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <button
                        title="Pratinjau CV"
                        style={{ background: "none", border: "none", color: "#60a5fa", cursor: "pointer", display: "flex" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (app.cvUrl) setPreviewDoc({ name: app.cvName!, url: app.cvUrl });
                        }}
                      >
                        <Eye size={16} />
                      </button>
                      <a
                        href={app.cvUrl || "#"}
                        download={app.cvName}
                        title="Unduh CV"
                        style={{ color: "#9ca3af", display: "flex" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download size={15} />
                      </a>
                    </div>
                  </div>
                )}

                {app.portfolioName && (
                  <div
                    className={styles.docCard}
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                      if (app.portfolioUrl) {
                        if (app.portfolioUrl.startsWith("data:")) {
                          setPreviewDoc({ name: app.portfolioName!, url: app.portfolioUrl });
                        } else {
                          window.open(app.portfolioUrl, "_blank");
                        }
                      }
                    }}
                  >
                    <div className={styles.docInfo}>
                      <FileText size={16} className={styles.docIcon} />
                      <div>
                        <div className={styles.docName}>{app.portfolioName}</div>
                        <span style={{ fontSize: "0.75rem", color: "#60a5fa" }}>Klik untuk Buka Portofolio</span>
                      </div>
                    </div>
                    <ExternalLink size={15} style={{ opacity: 0.6 }} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes & Notes Images Gallery */}
          {(app.notesContent || (app.notesImages && app.notesImages.length > 0)) && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>
                <ImageIcon size={15} /> Catatan & Tangkapan Layar (Notes)
              </h3>
              {app.notesContent && <div className={styles.contentBox}>{app.notesContent}</div>}

              {app.notesImages && app.notesImages.length > 0 && (
                <div className={styles.imageGallery}>
                  {app.notesImages.map((img, idx) => (
                    <div key={idx} className={styles.galleryThumb} onClick={() => setSelectedImage(img)}>
                      <img src={img} alt={`Catatan Gambar ${idx + 1}`} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className={styles.modalFooter}>
          <button className={styles.deleteBtn} onClick={onDelete}>
            <Trash2 size={14} /> Hapus
          </button>
          <button className={styles.editBtn} onClick={onEdit}>
            <Edit2 size={14} /> Edit Data Lamaran
          </button>
        </div>
      </div>

      {/* CV & Document Previewer Modal */}
      {previewDoc && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(6px)",
            zIndex: 1200,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
          }}
          onClick={(e) => e.target === e.currentTarget && setPreviewDoc(null)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "900px",
              height: "85vh",
              background: "#111827",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "12px",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.7)",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "1rem 1.25rem",
                borderBottom: "1px solid rgba(255,255,255,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <FileText size={18} style={{ color: "#3b82f6" }} />
                <span style={{ fontWeight: 600, color: "#fff", fontSize: "0.95rem" }}>{previewDoc.name}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <a
                  href={previewDoc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.3rem",
                    fontSize: "0.8rem",
                    color: "#60a5fa",
                    textDecoration: "none",
                    background: "rgba(59,130,246,0.15)",
                    padding: "0.35rem 0.75rem",
                    borderRadius: "6px",
                  }}
                >
                  <ExternalLink size={13} /> Buka Tab Baru
                </a>
                <button
                  onClick={() => setPreviewDoc(null)}
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    border: "none",
                    color: "#fff",
                    borderRadius: "6px",
                    width: 30,
                    height: 30,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Body Document Frame */}
            <div style={{ flex: 1, background: "#1f2937", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {previewDoc.url.startsWith("data:image/") ? (
                <img src={previewDoc.url} alt={previewDoc.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
              ) : (
                <iframe
                  src={previewDoc.url}
                  title={previewDoc.name}
                  style={{ width: "100%", height: "100%", border: "none" }}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox / Zoom Image Overlay */}
      {selectedImage && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.9)",
            zIndex: 1100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
          }}
          onClick={() => setSelectedImage(null)}
        >
          <img src={selectedImage} alt="Expanded Preview" style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8, objectFit: "contain" }} />
          <button
            onClick={() => setSelectedImage(null)}
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              background: "rgba(255,255,255,0.2)",
              color: "#fff",
              border: "none",
              borderRadius: "50%",
              width: 36,
              height: 36,
              cursor: "pointer",
            }}
          >
            <X size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
