import { nestApi } from '@/lib/nestApi';

export interface NestDashboardOverview {
  range: { from: string; to: string; centreId: string | null };
  leads: {
    totalInRange: number;
    funnel: Array<{ status: string; count: number }>;
    followUpsDue: number;
    conversionRatePercent: number;
  };
  conversions: {
    convertedInRange: number;
    byStaff: Array<{
      userId: string;
      name: string;
      email: string;
      convertedCount: number;
    }>;
    byCourse: Array<{
      courseId: string;
      courseName: string;
      courseCode: string;
      convertedCount: number;
    }>;
  };
  students: {
    totalActive: number;
    admittedInRange: number;
  };
  fees: {
    collectedInRange: number;
    paymentsInRange: number;
    activePlans: number;
    outstandingInstallments: number;
  };
}

export const nestDashboardApi = {
  overview: (params?: { centreId?: string; from?: string; to?: string }) =>
    nestApi.get<NestDashboardOverview>('/dashboard/overview', params),

  live: (params?: { centreId?: string; from?: string; to?: string }) =>
    nestApi.get<NestDashboardLive>('/dashboard/live', params),
};

export interface NestDashboardLeadCard {
  id: string;
  leadNo: string;
  leadName: string;
  contact: string;
  emailId: string | null;
  status: string;
  source: string;
  course: string;
  counselorName: string;
  createdAt: string;
  nextFollowUpAt: string | null;
}

export interface NestDashboardLive {
  generatedAt: string;
  overview: NestDashboardOverview;
  snapshot: {
    totalLeads: number;
    totalStudents: number;
    totalRevenue: number;
    conversionRate: number;
    todayLeads: number;
    pendingFollowUps: number;
    hotLeads: number;
    recentConversions: number;
    collectedInRange: number;
    outstandingInstallments: number;
  };
  todayLeads: NestDashboardLeadCard[];
  hotLeads: NestDashboardLeadCard[];
  followUpsDue: NestDashboardLeadCard[];
  recentStudents: Array<{
    id: string;
    name: string;
    rollNo: string;
    course: string;
    admissionDate: string;
    status: string;
  }>;
  recentPayments: Array<{
    id: string;
    amount: number;
    paidAt: string;
    studentName: string;
    rollNo: string;
    receiptNo: string | null;
  }>;
}
