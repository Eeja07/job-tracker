// API client — all calls to backend
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  isEmailVerified: boolean;
}

export interface Application {
  id: string;
  jobTitle: string;
  companyId?: string;
  company?: { id: string; name: string; industry?: string };
  applicationCode?: string;
  status: ApplicationStatus;
  workMode?: "REMOTE" | "HYBRID" | "ONSITE";
  source?: string;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  sourceUrl?: string;
  location?: string;
  deadline?: string;
  appliedAt: string;
  requirements?: string;
  notes?: string;
  notesContent?: string;
  notesImages?: string[];
  imageUrl?: string;
  cvName?: string;
  cvUrl?: string;
  cvText?: string;
  portfolioName?: string;
  portfolioUrl?: string;
  coverLetterName?: string;
  coverLetterUrl?: string;
  coverLetterText?: string;
  coverLetter?: string;
  createdAt: string;
  updatedAt: string;
}

export type ApplicationStatus =
  | "SAVED" | "APPLIED" | "SCREENING" | "INTERVIEWING" | "OFFER" | "REJECTED" | "WITHDRAWN";

export interface DashboardStats {
  totalApplications: number;
  byStatus: Record<ApplicationStatus, number>;
  recentApplications: Application[];
  conversionRate?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Token storage (client-side)
const getToken = () => (typeof window !== "undefined" ? localStorage.getItem("access_token") : null);
const setToken = (t: string) => localStorage.setItem("access_token", t);
const clearToken = () => { localStorage.removeItem("access_token"); localStorage.removeItem("refresh_token"); };
export { getToken, setToken, clearToken };

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opts.headers,
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message ?? `HTTP ${res.status}`);
  return json as T;
}

// Auth
export const authApi = {
  register: (body: { email: string; password: string; fullName: string }) =>
    request<{ accessToken: string; refreshToken: string; user: User }>("/api/v1/auth/register", {
      method: "POST", body: JSON.stringify(body),
    }),
  login: (body: { email: string; password: string }) =>
    request<{ accessToken: string; refreshToken: string; user: User }>("/api/v1/auth/login", {
      method: "POST", body: JSON.stringify(body),
    }),
  me: async () => {
    const res = await request<User | { user: User }>("/api/v1/auth/me");
    return "user" in res ? (res as { user: User }) : { user: res as User };
  },
  refreshToken: (refreshToken: string) =>
    request<{ accessToken: string; refreshToken: string }>("/api/v1/auth/refresh", {
      method: "POST", body: JSON.stringify({ refreshToken }),
    }),
  logout: () => request("/api/v1/auth/logout", { method: "POST" }),
};

// Applications
export const applicationsApi = {
  list: async (params?: { page?: number; limit?: number; status?: string; search?: string }): Promise<PaginatedResponse<Application>> => {
    const q = new URLSearchParams();
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.status) q.set("status", params.status);
    if (params?.search) q.set("search", params.search);
    const res = await request<any>(`/api/v1/applications?${q}`);
    if (Array.isArray(res)) {
      return { data: res, total: res.length, page: params?.page ?? 1, limit: params?.limit ?? 15, totalPages: 1 };
    }
    return {
      data: Array.isArray(res?.data) ? res.data : [],
      total: typeof res?.total === "number" ? res.total : (res?.data?.length ?? 0),
      page: res?.page ?? 1,
      limit: res?.limit ?? 15,
      totalPages: res?.totalPages ?? 1,
    };
  },
  get: (id: string) => request<Application>(`/api/v1/applications/${id}`),
  create: (body: Partial<Application> & { jobTitle: string }) =>
    request<Application>("/api/v1/applications", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: Partial<Application>) =>
    request<Application>(`/api/v1/applications/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  updateStatus: (id: string, status: ApplicationStatus, note?: string) =>
    request<Application>(`/api/v1/applications/${id}/status`, {
      method: "PATCH", body: JSON.stringify({ status, note }),
    }),
  delete: (id: string) => request(`/api/v1/applications/${id}`, { method: "DELETE" }),
  scrapeUrl: (url: string) =>
    request<{ jobTitle: string; companyName: string; location?: string; salary?: string; requirements: string; jobUrl: string }>("/api/v1/applications/scrape-url", {
      method: "POST",
      body: JSON.stringify({ url }),
    }),
  checkListingStatus: (applicationId: string) =>
    request<{ applicationId: string; jobTitle: string; sourceUrl: string; listingStatus: "ACTIVE" | "CLOSED" | "UNKNOWN" | "ERROR"; checkedAt: string; detail?: string }>("/api/v1/applications/check-listing-status", {
      method: "POST",
      body: JSON.stringify({ applicationId }),
    }),
  checkAllListings: () =>
    request<Array<{ applicationId: string; jobTitle: string; listingStatus: string; checkedAt: string; detail?: string }>>("/api/v1/applications/check-all-listings", {
      method: "POST",
    }),
};

// Dashboard
export const dashboardApi = {
  get: () => request<any>("/api/v1/dashboard"),
};

export interface CompanyItem {
  id: string;
  name: string;
  industry?: string;
}

// Companies
export const companiesApi = {
  list: async (search?: string): Promise<PaginatedResponse<CompanyItem>> => {
    const q = search ? `?search=${encodeURIComponent(search)}` : "";
    const res = await request<any>(`/api/v1/companies${q}`);
    if (Array.isArray(res)) {
      return { data: res, total: res.length, page: 1, limit: 50, totalPages: 1 };
    }
    return {
      data: Array.isArray(res?.data) ? res.data : [],
      total: typeof res?.total === "number" ? res.total : (res?.data?.length ?? 0),
      page: 1, limit: 50, totalPages: 1,
    };
  },
  create: (body: { name: string; industry?: string; website?: string; location?: string }) =>
    request<{ id: string; name: string }>("/api/v1/companies", { method: "POST", body: JSON.stringify(body) }),
};

export interface GmailStatus {
  connected: boolean;
  gmailEmail?: string;
  lastSyncAt?: string;
  unreadCount: number;
}

export interface EmailMessage {
  id: string;
  gmailMessageId: string;
  gmailThreadId?: string;
  subject: string;
  fromEmail: string;
  fromName?: string;
  toEmail?: string;
  snippet: string;
  bodyText?: string;
  receivedAt: string;
  isJobRelated: boolean;
  detectedType?: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  metadata?: any;
}

export const gmailApi = {
  getConnectUrl: () => request<{ url: string }>("/api/v1/gmail/connect"),
  getStatus: () => request<GmailStatus>("/api/v1/gmail/status"),
  disconnect: () => request<{ message: string }>("/api/v1/gmail/disconnect", { method: "POST" }),
  sync: () => request<{ success: boolean; newMessages: number; jobRelated: number }>("/api/v1/gmail/sync", { method: "POST" }),
  getEmails: (jobOnly = false, limit = 200) => request<EmailMessage[]>(`/api/v1/gmail/emails?jobOnly=${jobOnly}&limit=${limit}`),
};

export const notificationApi = {
  getNotifications: () => request<NotificationItem[]>("/api/v1/gmail/notifications"),
  markRead: (id: string) => request<{ success: boolean }>(`/api/v1/gmail/notifications/${id}/read`, { method: "PATCH" }),
  markAllRead: () => request<{ success: boolean }>("/api/v1/gmail/notifications/read-all", { method: "PATCH" }),
};

