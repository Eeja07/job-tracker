import type { ApplicationStatus } from "./api";

export const STATUS_CONFIG: Record<ApplicationStatus, { label: string; color: string; bg: string; border: string }> = {
  SAVED:          { label: "Saved",            color: "var(--status-saved-color)", bg: "var(--status-saved-bg)", border: "var(--status-saved-border)" },
  APPLIED:        { label: "Applied",          color: "var(--status-applied-color)", bg: "var(--status-applied-bg)", border: "var(--status-applied-border)" },
  ASSESSMENT:     { label: "Assessment / Tes", color: "#a855f7", bg: "rgba(168, 85, 247, 0.12)", border: "rgba(168, 85, 247, 0.25)" },
  HR_INTERVIEW:   { label: "Interview HR",     color: "#3b82f6", bg: "rgba(59, 130, 246, 0.12)", border: "rgba(59, 130, 246, 0.25)" },
  USER_INTERVIEW: { label: "Interview User",   color: "#06b6d4", bg: "rgba(6, 182, 212, 0.12)", border: "rgba(6, 182, 212, 0.25)" },
  OFFER:          { label: "Offer",            color: "var(--status-offer-color)", bg: "var(--status-offer-bg)", border: "var(--status-offer-border)" },
  REJECTED:       { label: "Rejected",         color: "var(--status-rejected-color)", bg: "var(--status-rejected-bg)", border: "var(--status-rejected-border)" },
  WITHDRAWN:      { label: "Withdrawn",        color: "var(--status-withdrawn-color)", bg: "var(--status-withdrawn-bg)", border: "var(--status-withdrawn-border)" },
  SCREENING:      { label: "Assessment / Tes", color: "#a855f7", bg: "rgba(168, 85, 247, 0.12)", border: "rgba(168, 85, 247, 0.25)" },
  INTERVIEWING:   { label: "Interview HR",     color: "#3b82f6", bg: "rgba(59, 130, 246, 0.12)", border: "rgba(59, 130, 246, 0.25)" },
};

export const REJECTION_STAGE_LABELS: Record<string, string> = {
  APPLIED: "Ditolak di Applied (CV)",
  ASSESSMENT: "Ditolak di Assessment / Tes",
  SCREENING: "Ditolak di Assessment / Tes",
  HR_INTERVIEW: "Ditolak di HR Interview",
  INTERVIEWING: "Ditolak di HR Interview",
  USER_INTERVIEW: "Ditolak di User Interview",
  OFFER: "Ditolak saat Offering",
  SAVED: "Ditolak di Tahap Awal",
};

export const WORK_MODE_LABELS = { REMOTE: "Remote", HYBRID: "Hybrid", ONSITE: "Onsite" };
export const SOURCE_LABELS: Record<string, string> = {
  LINKEDIN: "LinkedIn",
  JOBSTREET: "JobStreet",
  GLINTS: "Glints",
  KALIBRR: "Kalibrr",
  EMAIL: "Email",
  WHATSAPP: "WhatsApp",
  TELEGRAM: "Telegram",
  WEBSITE: "Website",
  INSTAGRAM: "Instagram",
  THREADS: "Threads",
  DEALLS: "Dealls",
  KITALULUS: "KitaLulus",
  OTHER: "Lainnya",
};

export function formatCurrency(amount: number, currency = "IDR"): string {
  if (!amount && amount !== 0) return "—";
  if (currency === "IDR") {
    return `Rp ${new Intl.NumberFormat("id-ID").format(amount)}`;
  }
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${new Intl.NumberFormat("id-ID").format(amount)}`;
  }
}

export function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

export function getDaysAgo(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "—";
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const diffTime = today.getTime() - target.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Hari ini";
  if (diffDays < 0) return `H-${Math.abs(diffDays)}`;
  if (diffDays === 1) return "1 hari lalu";
  return `${diffDays} hari lalu`;
}

export function timeAgo(iso: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m}m lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}j lalu`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}h lalu`;
  return formatDate(iso);
}
