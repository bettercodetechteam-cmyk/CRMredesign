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
};
