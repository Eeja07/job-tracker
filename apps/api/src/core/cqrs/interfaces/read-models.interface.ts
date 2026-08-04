export interface DashboardReadModel {
  totalApplications: number;
  activeApplications: number;
  interviewsScheduled: number;
  offersReceived: number;
  rejections: number;
  lastUpdated: string;
}

export interface ApplicationReadModelItem {
  id: string;
  userId: string;
  companyId?: string | null;
  companyName?: string;
  title: string;
  status: string;
  appliedDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationsReadModel {
  items: ApplicationReadModelItem[];
  total: number;
}

export interface CompanyReadModelItem {
  id: string;
  name: string;
  website?: string;
  applicationCount: number;
  createdAt: string;
}

export interface CompaniesReadModel {
  items: CompanyReadModelItem[];
  total: number;
}

export interface StatisticsReadModel {
  totalUsers: number;
  totalApplications: number;
  totalCompanies: number;
  totalAttachments: number;
  statusBreakdown: Record<string, number>;
  generatedAt: string;
}

export interface ActivityTimelineItem {
  id: string;
  eventType: string;
  userId?: string;
  details: Record<string, any>;
  timestamp: string;
}

export interface ActivityTimelineReadModel {
  activities: ActivityTimelineItem[];
  total: number;
}

export interface RecentJobsReadModel {
  jobs: Array<{
    id: string;
    title: string;
    companyName: string;
    status: string;
    createdAt: string;
  }>;
  total: number;
}

export interface SearchReadModel {
  query: string;
  applications: ApplicationReadModelItem[];
  companies: CompanyReadModelItem[];
  totalMatches: number;
}
