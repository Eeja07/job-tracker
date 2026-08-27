"use client";
import { useState, useEffect, useRef } from "react";
import { companiesApi, applicationsApi, resolveImageUrl, type Application, type ApplicationStatus } from "@/lib/api";
import { X, Loader2, Image as ImageIcon, FileText, CheckSquare, Upload, Link as LinkIcon, Trash2, Plus, FileCode, Briefcase, Download, Sparkles, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import styles from "./ApplicationModal.module.css";

const STATUSES: ApplicationStatus[] = ["SAVED","APPLIED","ASSESSMENT","HR_INTERVIEW","USER_INTERVIEW","OFFER","REJECTED","WITHDRAWN"];
const WORK_MODES = ["REMOTE","HYBRID","ONSITE"];
const SOURCES = ["LINKEDIN","JOBSTREET","GLINTS","KALIBRR","EMAIL","WHATSAPP","TELEGRAM","WEBSITE","INSTAGRAM","THREADS","DEALLS","KITALULUS","OTHER"];
const CURRENCIES = ["IDR","USD","SGD","EUR","GBP","AUD","JPY","MYR","CNY"];

interface Props {
  app?: Application;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}

export default function ApplicationModal({ app, onSave, onClose }: Props) {
  const [form, setForm] = useState({
    jobTitle: app?.jobTitle ?? "",
    companyName: app?.company?.name ?? "",
    status: (app?.status ?? "SAVED") as ApplicationStatus,
    rejectedAtStage: app?.rejectedAtStage ?? "APPLIED",
    workMode: app?.workMode ?? "REMOTE",
    source: app?.source ?? "LINKEDIN",
    location: app?.location ?? "",
    sourceUrl: app?.sourceUrl ?? "",
    salaryMin: app?.salaryMin ? String(app.salaryMin) : "",
    salaryMax: app?.salaryMax ? String(app.salaryMax) : "",
    currency: app?.currency ?? "IDR",
    appliedAt: app?.appliedAt ? app.appliedAt.split("T")[0] : new Date().toISOString().split("T")[0],
    deadline: app?.deadline ? app.deadline.split("T")[0] : "",
    requirements: (app as any)?.requirements ?? "",
    notesContent: (app as any)?.notesContent ?? "",
    imageUrl: (app as any)?.imageUrl ?? "",
    cvName: (app as any)?.cvName ?? "",
    cvUrl: (app as any)?.cvUrl ?? "",
    portfolioName: (app as any)?.portfolioName ?? "",
    portfolioUrl: (app as any)?.portfolioUrl ?? "",
    coverLetterName: (app as any)?.coverLetterName ?? "",
    coverLetterUrl: (app as any)?.coverLetterUrl ?? "",
    coverLetterText: (app as any)?.coverLetterText ?? (app as any)?.coverLetter ?? "",
  });
  const [notesImages, setNotesImages] = useState<string[]>((app as any)?.notesImages ?? []);
  const [previewNoteIndex, setPreviewNoteIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"general" | "requirements" | "documents" | "notes" | "image">("general");
  const [saving, setSaving] = useState(false);
  const [scrapingUrl, setScrapingUrl] = useState(false);
  const [scrapeNotice, setScrapeNotice] = useState("");
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const notesFileInputRef = useRef<HTMLInputElement>(null);
  const cvFileInputRef = useRef<HTMLInputElement>(null);
  const portfolioFileInputRef = useRef<HTMLInputElement>(null);
  const coverLetterFileInputRef = useRef<HTMLInputElement>(null);

  const handleScrapeUrl = async () => {
    const rawUrl = form.sourceUrl.trim();
    if (!rawUrl) {
      setError("Silakan masukkan URL Link Lowongan (Jobstreet/Glints/LinkedIn) terlebih dahulu.");
      return;
    }
    setScrapingUrl(true);
    setScrapeNotice("");
    setError("");
    try {
      const res = await applicationsApi.scrapeUrl(rawUrl);
      let autoSource = form.source;
      const urlLower = rawUrl.toLowerCase();
      if (urlLower.includes("jobstreet")) autoSource = "JOBSTREET";
      else if (urlLower.includes("glints")) autoSource = "GLINTS";
      else if (urlLower.includes("linkedin")) autoSource = "LINKEDIN";
      else if (urlLower.includes("kalibrr")) autoSource = "KALIBRR";

      setForm(f => ({
        ...f,
        jobTitle: res.jobTitle || f.jobTitle,
        companyName: res.companyName || f.companyName,
        location: res.location || f.location,
        source: autoSource,
        requirements: res.requirements || f.requirements,
      }));
      setScrapeNotice("Detail lowongan berhasil di-import dari URL!");
    } catch (err: any) {
      setError(err.message || "Gagal meng-import detail lowongan dari URL");
    } finally {
      setScrapingUrl(false);
    }
  };

  useEffect(() => {
    if (app) {
      setForm({
        jobTitle: app.jobTitle ?? "",
        companyName: app.company?.name ?? "",
        status: (app.status ?? "SAVED") as ApplicationStatus,
        rejectedAtStage: app.rejectedAtStage ?? "APPLIED",
        workMode: app.workMode ?? "REMOTE",
        source: app.source ?? "LINKEDIN",
        location: app.location ?? "",
        sourceUrl: app.sourceUrl ?? "",
        salaryMin: app.salaryMin ? String(app.salaryMin) : "",
        salaryMax: app.salaryMax ? String(app.salaryMax) : "",
        currency: app.currency ?? "IDR",
        appliedAt: app.appliedAt ? app.appliedAt.split("T")[0] : new Date().toISOString().split("T")[0],
        deadline: app.deadline ? app.deadline.split("T")[0] : "",
        requirements: (app as any).requirements ?? "",
        notesContent: (app as any).notesContent ?? (app as any).notes ?? "",
        imageUrl: (app as any).imageUrl ?? "",
        cvName: (app as any).cvName ?? "",
        cvUrl: (app as any).cvUrl ?? "",
        portfolioName: (app as any).portfolioName ?? "",
        portfolioUrl: (app as any).portfolioUrl ?? "",
        coverLetterName: (app as any).coverLetterName ?? "",
        coverLetterUrl: (app as any).coverLetterUrl ?? "",
        coverLetterText: (app as any).coverLetterText ?? (app as any).coverLetter ?? "",
      });
      setNotesImages((app as any).notesImages ?? []);
    }
  }, [app]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith("image/")) {
        reject("File harus berupa gambar (PNG, JPG, WebP, GIF)");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        reject("Ukuran gambar maksimal 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject("Gagal membaca file gambar");
      reader.readAsDataURL(file);
    });
  };

  const handleCvFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setForm(f => ({ ...f, cvName: file.name, cvUrl: e.target!.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePortfolioFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setForm(f => ({ ...f, portfolioName: file.name, portfolioUrl: e.target!.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCoverLetterFile = (file: File) => {
    if (file.type.includes("text") || file.name.endsWith(".txt")) {
      const textReader = new FileReader();
      textReader.onload = (e) => {
        const text = (e.target?.result as string) || "";
        setForm(f => ({
          ...f,
          coverLetterName: file.name,
          coverLetterText: text,
          coverLetterUrl: f.coverLetterUrl || text,
        }));
      };
      textReader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setForm(f => ({ ...f, coverLetterName: file.name, coverLetterUrl: e.target!.result as string }));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMainImageFile = async (file: File) => {
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setForm(f => ({ ...f, imageUrl: dataUrl }));
      setError("");
    } catch (err: any) {
      setError(String(err));
    }
  };

  const handleNoteImageFiles = async (files: FileList | File[]) => {
    try {
      const fileArr = Array.from(files).filter(f => f.type.startsWith("image/"));
      if (fileArr.length === 0) return;
      const dataUrls = await Promise.all(fileArr.map(readFileAsDataUrl));
      setNotesImages(prev => [...prev, ...dataUrls]);
      setError("");
    } catch (err: any) {
      setError(String(err));
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const pastedImageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) pastedImageFiles.push(file);
      }
    }
    if (pastedImageFiles.length > 0) {
      e.preventDefault();
      if (activeTab === "notes") {
        await handleNoteImageFiles(pastedImageFiles);
      } else if (pastedImageFiles[0]) {
        await handleMainImageFile(pastedImageFiles[0]);
      }
    }
  };

  const handleDropMain = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await handleMainImageFile(file);
  };

  const handleDropNotes = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleNoteImageFiles(e.dataTransfer.files);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.jobTitle.trim()) { setError("Judul posisi wajib diisi"); return; }
    setError(""); setSaving(true);
    try {
      let companyId = app?.companyId;
      if (form.companyName && !app?.companyId) {
        try {
          const companies = await companiesApi.list(form.companyName);
          const existing = companies.data.find((c: any) => c.name.toLowerCase() === form.companyName.toLowerCase());
          if (existing) {
            companyId = existing.id;
          } else {
            const created = await companiesApi.create({ name: form.companyName });
            companyId = created.id;
          }
        } catch { /* ignore company create failure */ }
      }

      await onSave({
        jobTitle: form.jobTitle,
        companyId,
        status: form.status,
        rejectedAtStage: form.status === "REJECTED" ? form.rejectedAtStage : undefined,
        workMode: form.workMode || undefined,
        source: form.source || undefined,
        location: form.location ?? "",
        sourceUrl: form.sourceUrl ?? "",
        salaryMin: form.salaryMin ? parseInt(form.salaryMin) : (null as any),
        salaryMax: form.salaryMax ? parseInt(form.salaryMax) : (null as any),
        currency: form.currency || undefined,
        appliedAt: form.status === "SAVED" ? undefined : (form.appliedAt ? new Date(form.appliedAt).toISOString() : undefined),
        deadline: form.deadline ? new Date(form.deadline).toISOString() : (null as any),
        requirements: form.requirements ?? "",
        notesContent: form.notesContent ?? "",
        notesImages: notesImages,
        imageUrl: form.imageUrl ?? "",
        cvName: form.cvName ?? "",
        cvUrl: form.cvUrl ?? "",
        portfolioName: form.portfolioName ?? "",
        portfolioUrl: form.portfolioUrl ?? "",
        coverLetterName: form.coverLetterName ?? "",
        coverLetterUrl: form.coverLetterUrl ?? "",
        coverLetterText: form.coverLetterText ?? "",
      });
    } catch (err: any) {
      setError(err.message ?? "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} onPaste={handlePaste}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{app ? "Edit Lamaran Kerja" : "Tambah Lamaran Baru"}</h2>
          <button className={styles.closeBtn} onClick={onClose}><X size={16} /></button>
        </div>

        <div className={styles.tabNav}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === "general" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("general")}
          >
            Info Utama
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === "requirements" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("requirements")}
          >
            <CheckSquare size={13} /> Requirements
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === "documents" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("documents")}
          >
            <FileCode size={13} /> CV & Portfolio
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === "notes" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("notes")}
          >
            <FileText size={13} /> Catatan
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === "image" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("image")}
          >
            <ImageIcon size={13} /> Poster
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {activeTab === "general" && (
            <>
              <div className={styles.grid2}>
                <div className={styles.field}>
                  <label className={styles.label}>Posisi / Job Title *</label>
                  <input className={styles.input} value={form.jobTitle} onChange={set("jobTitle")} placeholder="Frontend Engineer" required />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Perusahaan</label>
                  <input className={styles.input} value={form.companyName} onChange={set("companyName")} placeholder="Nama perusahaan" />
                </div>
              </div>

              <div className={styles.grid3}>
                <div className={styles.field}>
                  <label className={styles.label}>Status</label>
                  <select className={styles.input} value={form.status} onChange={set("status")}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Work Mode</label>
                  <select className={styles.input} value={form.workMode} onChange={set("workMode")}>
                    {WORK_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Source</label>
                  <select className={styles.input} value={form.source} onChange={set("source")}>
                    {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {form.status === "REJECTED" && (
                <div className={styles.field} style={{ marginTop: "0.5rem" }}>
                  <label className={styles.label} style={{ color: "#f87171", fontWeight: 600 }}>Ditolak di Tahap Mana?</label>
                  <select className={styles.input} value={form.rejectedAtStage} onChange={set("rejectedAtStage")}>
                    <option value="APPLIED">Ditolak di Applied (CV Screening)</option>
                    <option value="ASSESSMENT">Ditolak di Assessment / Tes</option>
                    <option value="HR_INTERVIEW">Ditolak di HR Interview</option>
                    <option value="USER_INTERVIEW">Ditolak di User Interview</option>
                    <option value="OFFER">Ditolak saat Offering</option>
                  </select>
                </div>
              )}

              <div className={styles.grid2}>
                <div className={styles.field}>
                  <label className={styles.label}>Lokasi</label>
                  <input className={styles.input} value={form.location} onChange={set("location")} placeholder="Jakarta, Indonesia" />
                </div>
                <div className={styles.field}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label className={styles.label}>Link Lowongan / Listing</label>
                    <button
                      type="button"
                      onClick={handleScrapeUrl}
                      disabled={scrapingUrl}
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text)",
                        background: "var(--bg-subtle)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        padding: "2px 8px",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        fontWeight: 600,
                      }}
                    >
                      {scrapingUrl ? <Loader2 size={11} className={styles.spinner} /> : <Download size={11} />}
                      <span>{scrapingUrl ? "Mengambil Data..." : "Auto-Import Info"}</span>
                    </button>
                  </div>
                  <input className={styles.input} value={form.sourceUrl} onChange={set("sourceUrl")} placeholder="https://jobstreet.co.id/... atau https://glints.com/..." type="url" />
                </div>
              </div>

              {scrapeNotice && (
                <div style={{ fontSize: "0.8rem", color: "#10b981", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)", padding: "6px 12px", borderRadius: "var(--radius-sm)" }}>
                  {scrapeNotice}
                </div>
              )}

              <div className={styles.grid3}>
                <div className={styles.field}>
                  <label className={styles.label}>Gaji Min</label>
                  <input className={styles.input} value={form.salaryMin} onChange={set("salaryMin")} placeholder="10000000" type="number" min={0} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Gaji Max</label>
                  <input className={styles.input} value={form.salaryMax} onChange={set("salaryMax")} placeholder="15000000" type="number" min={0} />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Mata Uang</label>
                  <select className={styles.input} value={form.currency} onChange={set("currency")}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className={styles.grid2}>
                <div className={styles.field}>
                  <label className={styles.label}>Tanggal Melamar (Applied Date)</label>
                  <input className={styles.input} value={form.appliedAt} onChange={set("appliedAt")} type="date" />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Deadline Lamaran</label>
                  <input className={styles.input} value={form.deadline} onChange={set("deadline")} type="date" />
                </div>
              </div>
            </>
          )}

          {activeTab === "requirements" && (
            <div className={styles.field}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                <label className={styles.label}>Kualifikasi & Job Requirements</label>
                {form.requirements && (
                  <button
                    type="button"
                    className={styles.clearFieldBtn}
                    onClick={() => setForm(f => ({ ...f, requirements: "" }))}
                    title="Kosongkan kualifikasi"
                  >
                    <Trash2 size={12} /> Hapus Teks
                  </button>
                )}
              </div>
              <textarea
                className={styles.textarea}
                rows={8}
                value={form.requirements}
                onChange={set("requirements")}
                placeholder="Tulis atau paste kualifikasi lowongan di sini...&#10;- Minimal 2 tahun pengalaman Next.js&#10;- Memahami REST API & Docker&#10;- Bahasa Inggris pasif/aktif"
              />
            </div>
          )}

          {activeTab === "documents" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* CV Attachment */}
              <div className={styles.field}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                  <label className={styles.label}>CV / Resume Terlampir untuk Lowongan Ini</label>
                  {(form.cvUrl || form.cvName) && (
                    <button
                      type="button"
                      className={styles.clearFieldBtn}
                      onClick={() => {
                        setForm(f => ({ ...f, cvUrl: "", cvName: "" }));
                        if (cvFileInputRef.current) cvFileInputRef.current.value = "";
                      }}
                      title="Hapus file dan link CV"
                    >
                      <Trash2 size={12} /> Hapus CV
                    </button>
                  )}
                </div>
                <input
                  type="file"
                  ref={cvFileInputRef}
                  style={{ display: "none" }}
                  accept=".pdf,.doc,.docx"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleCvFile(f);
                  }}
                />
                <div className={styles.inputGroupRow}>
                  <input
                    className={styles.input}
                    value={form.cvName}
                    onChange={set("cvName")}
                    placeholder="Nama file / Label CV (misal: CV_Frontend_Engineer.pdf)"
                  />
                  <button
                    type="button"
                    className={styles.uploadFileBtn}
                    onClick={() => cvFileInputRef.current?.click()}
                  >
                    <Upload size={14} /> Upload File PDF/DOC
                  </button>
                </div>
                <div className={styles.inputWithIcon} style={{ marginTop: "0.4rem" }}>
                  <LinkIcon size={14} className={styles.inputIcon} />
                  <input
                    className={styles.input}
                    style={{ paddingLeft: "2.2rem" }}
                    value={form.cvUrl}
                    onChange={set("cvUrl")}
                    placeholder="Atau Paste Link CV (Google Drive, Dropbox, dll)"
                  />
                </div>
                {(form.cvUrl || form.cvName) && (
                  <div className={styles.docBadge}>
                    <FileCode size={14} />
                    <span>File/Link CV: {form.cvName || "Terlampir"}</span>
                    <button
                      type="button"
                      className={styles.removeNoteImgBtn}
                      onClick={() => {
                        setForm(f => ({ ...f, cvUrl: "", cvName: "" }));
                        if (cvFileInputRef.current) cvFileInputRef.current.value = "";
                      }}
                      title="Hapus CV"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>

              {/* Portfolio Attachment */}
              <div className={styles.field}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                  <label className={styles.label}>Portfolio / Project Portfolio Terlampir</label>
                  {(form.portfolioUrl || form.portfolioName) && (
                    <button
                      type="button"
                      className={styles.clearFieldBtn}
                      onClick={() => {
                        setForm(f => ({ ...f, portfolioUrl: "", portfolioName: "" }));
                        if (portfolioFileInputRef.current) portfolioFileInputRef.current.value = "";
                      }}
                      title="Hapus file dan link portfolio"
                    >
                      <Trash2 size={12} /> Hapus Portfolio
                    </button>
                  )}
                </div>
                <input
                  type="file"
                  ref={portfolioFileInputRef}
                  style={{ display: "none" }}
                  accept=".pdf,.doc,.docx,.zip,.png,.jpg"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handlePortfolioFile(f);
                  }}
                />
                <div className={styles.inputGroupRow}>
                  <input
                    className={styles.input}
                    value={form.portfolioName}
                    onChange={set("portfolioName")}
                    placeholder="Nama / Label Portfolio (misal: Portfolio_Budi_2026)"
                  />
                  <button
                    type="button"
                    className={styles.uploadFileBtn}
                    onClick={() => portfolioFileInputRef.current?.click()}
                  >
                    <Upload size={14} /> Upload File
                  </button>
                </div>
                <div className={styles.inputWithIcon} style={{ marginTop: "0.4rem" }}>
                  <LinkIcon size={14} className={styles.inputIcon} />
                  <input
                    className={styles.input}
                    style={{ paddingLeft: "2.2rem" }}
                    value={form.portfolioUrl}
                    onChange={set("portfolioUrl")}
                    placeholder="Atau Paste Link Portfolio (GitHub, Behance, Personal Web)"
                  />
                </div>
                {(form.portfolioUrl || form.portfolioName) && (
                  <div className={styles.docBadge}>
                    <Briefcase size={14} />
                    <span>Link/File Portfolio: {form.portfolioName || "Terlampir"}</span>
                    <button
                      type="button"
                      className={styles.removeNoteImgBtn}
                      onClick={() => {
                        setForm(f => ({ ...f, portfolioUrl: "", portfolioName: "" }));
                        if (portfolioFileInputRef.current) portfolioFileInputRef.current.value = "";
                      }}
                      title="Hapus Portfolio"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>

              {/* Cover Letter (Surat Lamaran) Attachment */}
              <div className={styles.field}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                  <label className={styles.label}>Cover Letter / Surat Lamaran Terlampir</label>
                  {(form.coverLetterUrl || form.coverLetterName) && (
                    <button
                      type="button"
                      className={styles.clearFieldBtn}
                      onClick={() => {
                        setForm(f => ({ ...f, coverLetterUrl: "", coverLetterName: "" }));
                        if (coverLetterFileInputRef.current) coverLetterFileInputRef.current.value = "";
                      }}
                      title="Hapus file/link cover letter"
                    >
                      <Trash2 size={12} /> Hapus Dokumen
                    </button>
                  )}
                </div>
                <input
                  type="file"
                  ref={coverLetterFileInputRef}
                  style={{ display: "none" }}
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleCoverLetterFile(f);
                  }}
                />
                <div className={styles.inputGroupRow}>
                  <input
                    className={styles.input}
                    value={form.coverLetterName}
                    onChange={set("coverLetterName")}
                    placeholder="Nama / Label Cover Letter (misal: CoverLetter_Frontend.pdf)"
                  />
                  <button
                    type="button"
                    className={styles.uploadFileBtn}
                    onClick={() => coverLetterFileInputRef.current?.click()}
                  >
                    <Upload size={14} /> Upload File (PDF/DOC/TXT)
                  </button>
                </div>
                <div className={styles.inputWithIcon} style={{ marginTop: "0.4rem" }}>
                  <LinkIcon size={14} className={styles.inputIcon} />
                  <input
                    className={styles.input}
                    style={{ paddingLeft: "2.2rem" }}
                    value={form.coverLetterUrl}
                    onChange={set("coverLetterUrl")}
                    placeholder="Atau Paste Link Cover Letter (Google Docs, Drive, Cloud, dll)"
                  />
                </div>
                
                {/* Textarea for writing or copy-pasting Cover Letter text */}
                <div style={{ marginTop: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                    <label className={styles.label} style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      Atau Tulis / Paste Isi Teks Surat Lamaran (Cover Letter):
                    </label>
                    {form.coverLetterText && (
                      <button
                        type="button"
                        className={styles.clearFieldBtn}
                        onClick={() => setForm(f => ({ ...f, coverLetterText: "" }))}
                        title="Kosongkan teks cover letter"
                      >
                        <Trash2 size={12} /> Hapus Teks
                      </button>
                    )}
                  </div>
                  <textarea
                    className={styles.textarea}
                    rows={6}
                    value={form.coverLetterText}
                    onChange={set("coverLetterText")}
                    placeholder="Kepada Yth. HRD / Hiring Manager...&#10;&#10;Dengan hormat,&#10;Saya bermaksud untuk mengajukan lamaran pekerjaan..."
                  />
                </div>

                {(form.coverLetterUrl || form.coverLetterName || form.coverLetterText) && (
                  <div className={styles.docBadge}>
                    <FileText size={14} />
                    <span>
                      {form.coverLetterText ? "Isi Teks Cover Letter Terisi" : `File/Link: ${form.coverLetterName || "Terlampir"}`}
                    </span>
                    <button
                      type="button"
                      className={styles.removeNoteImgBtn}
                      onClick={() => setForm(f => ({ ...f, coverLetterUrl: "", coverLetterName: "", coverLetterText: "" }))}
                      title="Hapus semua data Cover Letter"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "notes" && (
            <div className={styles.field}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                <label className={styles.label}>Catatan Pribadi & Interview Notes</label>
                {form.notesContent && (
                  <button
                    type="button"
                    className={styles.clearFieldBtn}
                    onClick={() => setForm(f => ({ ...f, notesContent: "" }))}
                    title="Kosongkan teks catatan"
                  >
                    <Trash2 size={12} /> Hapus Teks
                  </button>
                )}
              </div>
              <textarea
                className={styles.textarea}
                rows={6}
                value={form.notesContent}
                onChange={set("notesContent")}
                placeholder="Catatan wawancara, nama HR, atau kontak recruiter...&#10;- User interview tanggal 12 Agustus jam 14:00&#10;- Persiapkan pertanyaan seputar arsitektur microservices"
              />

              <div style={{ marginTop: "1rem" }}>
                <div className={styles.notesImageHeader}>
                  <label className={styles.label}>Gambar / Lampiran Catatan ({notesImages.length})</label>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    {notesImages.length > 0 && (
                      <button
                        type="button"
                        className={styles.clearAllImagesBtn}
                        onClick={() => {
                          setNotesImages([]);
                          setPreviewNoteIndex(null);
                        }}
                        title="Hapus semua gambar catatan"
                      >
                        <Trash2 size={12} /> Hapus Semua Gambar
                      </button>
                    )}
                    <button
                      type="button"
                      className={styles.addNoteImgBtn}
                      onClick={() => notesFileInputRef.current?.click()}
                    >
                      <Plus size={13} /> Upload Gambar Komputer
                    </button>
                  </div>
                </div>

                <input
                  type="file"
                  ref={notesFileInputRef}
                  style={{ display: "none" }}
                  accept="image/*"
                  multiple
                  onChange={e => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleNoteImageFiles(e.target.files);
                    }
                    e.target.value = "";
                  }}
                />

                <div
                  className={`${styles.notesDropZone} ${isDragging ? styles.dropZoneActive : ""}`}
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDropNotes}
                  onClick={() => notesFileInputRef.current?.click()}
                >
                  <Upload size={18} className={styles.dropIcon} />
                  <span>Tekan <strong>Ctrl + V (Cmd + V)</strong> untuk Paste Gambar dari Clipboard, atau Drag & Drop / Klik di sini untuk memilih gambar (bisa lebih dari 1).</span>
                </div>

                {notesImages.length > 0 && (
                  <div className={styles.notesGallery}>
                    {notesImages.map((img, idx) => (
                      <div
                        key={idx}
                        className={styles.noteThumbWrap}
                        onClick={() => setPreviewNoteIndex(idx)}
                        title="Klik untuk melihat pratinjau penuh"
                      >
                        <img src={img} alt={`Catatan ${idx + 1}`} className={styles.noteThumb} />
                        <button
                          type="button"
                          className={styles.removeNoteImgBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            setNotesImages(prev => prev.filter((_, i) => i !== idx));
                            if (previewNoteIndex === idx) setPreviewNoteIndex(null);
                            else if (previewNoteIndex !== null && previewNoteIndex > idx) setPreviewNoteIndex(previewNoteIndex - 1);
                          }}
                          title="Hapus gambar catatan"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "image" && (
            <div className={styles.field}>
              <label className={styles.label}>Upload Gambar Poster Lowongan / Screenshot Bukti Apply</label>
              
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                accept="image/*"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleMainImageFile(f);
                }}
              />

              <div
                className={`${styles.dropZone} ${isDragging ? styles.dropZoneActive : ""}`}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDropMain}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={24} className={styles.dropIcon} />
                <p className={styles.dropText}>
                  Klik untuk pilih file gambar dari komputer
                </p>
                <span className={styles.dropSubtext}>
                  Atau <strong>Drag & Drop</strong> gambar ke sini, atau tekan <strong>Ctrl + V (Cmd + V)</strong> untuk Paste screenshot dari Clipboard.
                </span>
              </div>

              <div className={styles.orDivider}>
                <span>ATAU VIA URL GAMBAR</span>
              </div>

              <div className={styles.inputWithIcon}>
                <LinkIcon size={14} className={styles.inputIcon} />
                <input
                  className={styles.input}
                  style={{ paddingLeft: "2.2rem" }}
                  value={form.imageUrl && !form.imageUrl.startsWith("data:") && !form.imageUrl.startsWith("/api/") ? form.imageUrl : ""}
                  onChange={set("imageUrl")}
                  placeholder="https://example.com/screenshot-poster.png"
                />
              </div>

              {form.imageUrl && (
                <div className={styles.imagePreviewSection}>
                  <div className={styles.previewHeader}>
                    <span>Preview Gambar:</span>
                    <button
                      type="button"
                      className={styles.removeImgBtn}
                      onClick={() => setForm(f => ({ ...f, imageUrl: "" }))}
                    >
                      <Trash2 size={13} /> Hapus Gambar
                    </button>
                  </div>
                  <div className={styles.imagePreviewWrap}>
                    <img src={resolveImageUrl(form.imageUrl)} alt="Poster Lowongan" className={styles.imagePreview} />
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Batal</button>
            <button type="submit" className={styles.saveBtn} disabled={saving}>
              {saving ? <Loader2 size={14} className={styles.spinner} /> : (app ? "Simpan Perubahan" : "Tambah Lamaran")}
            </button>
          </div>
        </form>
      </div>

      {/* Lightbox Preview for Note Images */}
      {previewNoteIndex !== null && notesImages[previewNoteIndex] && (
        <div
          className={styles.lightboxOverlay}
          onClick={(e) => e.target === e.currentTarget && setPreviewNoteIndex(null)}
        >
          <div className={styles.lightboxTopBar}>
            <span className={styles.lightboxCounter}>
              Gambar {previewNoteIndex + 1} dari {notesImages.length}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <button
                type="button"
                className={styles.lightboxDeleteBtn}
                onClick={() => {
                  const curIdx = previewNoteIndex!;
                  setNotesImages(prev => prev.filter((_, i) => i !== curIdx));
                  if (notesImages.length <= 1) {
                    setPreviewNoteIndex(null);
                  } else if (curIdx >= notesImages.length - 1) {
                    setPreviewNoteIndex(curIdx - 1);
                  }
                }}
                title="Hapus gambar ini dari catatan"
              >
                <Trash2 size={16} />
              </button>
              <button
                type="button"
                className={styles.lightboxCloseBtn}
                onClick={() => setPreviewNoteIndex(null)}
                title="Tutup Preview (Esc)"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className={styles.lightboxMainArea}>
            {notesImages.length > 1 && (
              <button
                type="button"
                className={`${styles.lightboxNavBtn} ${styles.lightboxNavPrev}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewNoteIndex(prev => (prev !== null && prev > 0 ? prev - 1 : notesImages.length - 1));
                }}
                title="Gambar Sebelumnya"
              >
                <ChevronLeft size={24} />
              </button>
            )}

            <div className={styles.lightboxImageWrap}>
              <img
                src={notesImages[previewNoteIndex]}
                alt={`Preview Catatan ${previewNoteIndex + 1}`}
                className={styles.lightboxImage}
              />
            </div>

            {notesImages.length > 1 && (
              <button
                type="button"
                className={`${styles.lightboxNavBtn} ${styles.lightboxNavNext}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewNoteIndex(prev => (prev !== null && prev < notesImages.length - 1 ? prev + 1 : 0));
                }}
                title="Gambar Selanjutnya"
              >
                <ChevronRight size={24} />
              </button>
            )}
          </div>

          {notesImages.length > 1 && (
            <div className={styles.lightboxThumbStrip} onClick={e => e.stopPropagation()}>
              {notesImages.map((img, idx) => (
                <div
                  key={idx}
                  className={`${styles.lightboxThumbItem} ${idx === previewNoteIndex ? styles.lightboxThumbActive : ""}`}
                  onClick={() => setPreviewNoteIndex(idx)}
                >
                  <img src={img} alt={`Thumb ${idx + 1}`} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
