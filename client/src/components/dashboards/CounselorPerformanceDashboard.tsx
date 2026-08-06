import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { excludeOtherFromChartData, isExcludedChartCategory, sanitizeChartCategory, chartTooltipStyle } from '@/lib/analyticsChartUtils';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Target, 
  CheckCircle,
  Clock,
  UserCheck,
  Activity,
  Award,
  Star,
  Gauge
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import {
  AnalyticsCategoryBarChart,
  AnalyticsGroupedBarChart,
} from '@/components/charts/AnalyticsCharts';

interface Lead {
  id: string;
  enquiryDate: string | Date;
  leadName: string;
  contact: string;
  emailId: string;
  course: string;
  courseDuration: string;
  education: string;
  source: string;
  cityArea: string;
  followUpDate?: string | Date;
  status: string;
  counselorName: string;
  remark?: string;
  feedbackCallRemarks?: string;
  centreHeadRemarks?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  centreId?: string;
  assignedTo?: string;
  priority?: 'low' | 'medium' | 'high';
  type?: 'lead' | 'admission';
  courseInterest?: string;
  reminderDate?: string | Date;
  visitDate?: string | Date;
  callDate?: string | Date;
  admissionDate?: string | Date;
  notes?: string;
  followUpType?: 'call' | 'visit' | 'meeting' | 'admission';
  followUpNotes?: string;
}

interface CounselorPerformanceDashboardProps {
  leads: Lead[];
  visibleCharts?: Set<string>;
}

export default function CounselorPerformanceDashboard({ leads, visibleCharts = new Set(['counselors', 'conversions']) }: CounselorPerformanceDashboardProps) {
  
  const chartData = useMemo(() => {
    const counselorData = leads.reduce((acc, lead) => {
      const raw = lead.counselorName || lead.assignedTo || 'Unassigned';
      const counselor = sanitizeChartCategory(raw) || 'Unassigned';
      if (!acc[counselor]) {
        acc[counselor] = {
          totalLeads: 0,
          convertedLeads: 0,
          pendingFollowups: 0,
          completedFollowups: 0,
          hotLeads: 0,
          recentActivity: 0
        };
      }
      
      acc[counselor].totalLeads++;
      
      // Count converted leads
      if (['Converted', 'Done', 'Admission Done'].includes(lead.status)) {
        acc[counselor].convertedLeads++;
      }
      
      // Count hot leads
      if (lead.status === 'Hot Lead') {
        acc[counselor].hotLeads++;
      }
      
      // Count follow-ups (simplified logic)
      if (lead.followUpDate) {
        const followUpDate = new Date(lead.followUpDate);
        const now = new Date();
        if (followUpDate > now) {
          acc[counselor].pendingFollowups++;
        } else {
          acc[counselor].completedFollowups++;
        }
      }
      
      // Count recent activity (leads updated in last 7 days)
      const updatedDate = new Date(lead.updatedAt);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      if (updatedDate > weekAgo) {
        acc[counselor].recentActivity++;
      }
      
      return acc;
    }, {} as Record<string, any>);

    // Calculate conversion rates
    Object.keys(counselorData).forEach(counselor => {
      const data = counselorData[counselor];
      data.conversionRate = data.totalLeads > 0 ? (data.convertedLeads / data.totalLeads * 100) : 0;
      data.followupCompletionRate = (data.pendingFollowups + data.completedFollowups) > 0 
        ? (data.completedFollowups / (data.pendingFollowups + data.completedFollowups) * 100) 
        : 0;
    });

    // Prepare chart data
    const leadsAssignedData = excludeOtherFromChartData(
      Object.entries(counselorData)
        .sort(([,a], [,b]) => b.totalLeads - a.totalLeads)
        .slice(0, 8)
        .map(([counselor, data]) => ({
          name: counselor,
          value: data.totalLeads,
          leads: data.totalLeads,
          converted: data.convertedLeads,
          conversionRate: data.conversionRate
        }))
    );

    const conversionRateData = excludeOtherFromChartData(
      Object.entries(counselorData)
        .sort(([,a], [,b]) => b.conversionRate - a.conversionRate)
        .slice(0, 8)
        .map(([counselor, data]) => ({
          name: counselor,
          value: Math.round(data.conversionRate * 10) / 10,
          conversionRate: data.conversionRate
        }))
    );

    const followupData = excludeOtherFromChartData(
      Object.entries(counselorData)
        .sort(([,a], [,b]) => (b.completedFollowups + b.pendingFollowups) - (a.completedFollowups + a.pendingFollowups))
        .slice(0, 8)
        .map(([counselor, data]) => ({
          name: counselor,
          completed: data.completedFollowups,
          pending: data.pendingFollowups,
          total: data.completedFollowups + data.pendingFollowups
        }))
    );

    // Overall statistics
    const totalLeads = leads.length;
    const totalConverted = leads.filter(lead => 
      ['Converted', 'Done', 'Admission Done'].includes(lead.status)
    ).length;
    const overallConversionRate = totalLeads > 0 ? (totalConverted / totalLeads * 100) : 0;

    // Follow-up completion gauge data
    const totalPendingFollowups = Object.values(counselorData).reduce((sum, data) => sum + data.pendingFollowups, 0);
    const totalCompletedFollowups = Object.values(counselorData).reduce((sum, data) => sum + data.completedFollowups, 0);
    const totalFollowups = totalPendingFollowups + totalCompletedFollowups;
    const followupCompletionRate = totalFollowups > 0 ? (totalCompletedFollowups / totalFollowups * 100) : 0;

    const gaugeData = [
      { name: 'Completed', value: totalCompletedFollowups, color: '#10B981' },
      { name: 'Pending', value: totalPendingFollowups, color: '#F59E0B' }
    ];

    // Top performers
    const topPerformers = Object.entries(counselorData)
      .filter(([name]) => !isExcludedChartCategory(name))
      .sort(([,a], [,b]) => b.conversionRate - a.conversionRate)
      .slice(0, 3);

    return {
      counselorData,
      leadsAssignedData,
      conversionRateData,
      followupData,
      gaugeData,
      overallConversionRate,
      followupCompletionRate,
      topPerformers,
      totalLeads,
      totalConverted,
      totalPendingFollowups,
      totalCompletedFollowups
    };
  }, [leads]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Counselor Performance Dashboard</h2>
          <p className="text-gray-600 mt-1">Track counselor performance and conversion rates</p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {Object.keys(chartData.counselorData).length} Active Counselors
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {visibleCharts.has('counselors') && (
          <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Leads Assigned per Counselor
              </CardTitle>
              <BarChart3 className="w-4 h-4 text-gray-400" />
            </CardHeader>
            <CardContent className="pt-2 pb-6">
              <AnalyticsCategoryBarChart
                data={chartData.leadsAssignedData}
                dataKey="leads"
                fill="#3B82F6"
                valueLabel="Leads"
              />
            </CardContent>
          </Card>
        )}

        {visibleCharts.has('conversions') && (
          <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Target className="w-5 h-5 text-green-600" />
                Conversion Rate per Counselor
              </CardTitle>
              <TrendingUp className="w-4 h-4 text-gray-400" />
            </CardHeader>
            <CardContent className="pt-2 pb-6">
              <AnalyticsCategoryBarChart
                data={chartData.conversionRateData}
                fill="#10B981"
                valueLabel="Conversion %"
              />
            </CardContent>
          </Card>
        )}

        {visibleCharts.has('followups') && (
          <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-600" />
                Follow-up Completion Status
              </CardTitle>
              <Activity className="w-4 h-4 text-gray-400" />
            </CardHeader>
            <CardContent className="pt-2 pb-6">
              <AnalyticsGroupedBarChart
                data={chartData.followupData}
                bars={[
                  { dataKey: 'completed', fill: '#10B981', name: 'Completed' },
                  { dataKey: 'pending', fill: '#F59E0B', name: 'Pending' },
                ]}
              />
            </CardContent>
          </Card>
        )}

        {/* Pending vs Completed Follow-ups - Gauge Chart */}
        {visibleCharts.has('followups') && (
          <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Gauge className="w-5 h-5 text-purple-600" />
                Follow-up Completion Rate
              </CardTitle>
              <CheckCircle className="w-4 h-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData.gaugeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      startAngle={180}
                      endAngle={0}
                    >
                      {chartData.gaugeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value, name) => [value, name]}
                      contentStyle={chartTooltipStyle}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="text-center mt-4">
                <div className="text-3xl font-bold text-gray-900">
                  {chartData.followupCompletionRate.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600">Completion Rate</div>
              </div>
              <div className="flex justify-center mt-4 space-x-4">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">
                    {chartData.totalCompletedFollowups} Completed
                          </span>
                        </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                  <span className="text-sm text-gray-600">
                    {chartData.totalPendingFollowups} Pending
                          </span>
                        </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Performance Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700">Overall Conversion</p>
                <p className="text-lg font-bold text-blue-900">
                  {chartData.overallConversionRate.toFixed(1)}%
                </p>
              </div>
              <Target className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700">Top Performer</p>
                <p className="text-lg font-bold text-green-900">
                  {chartData.topPerformers[0]?.[0] || 'N/A'}
                </p>
              </div>
              <Award className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-700">Total Leads</p>
                <p className="text-lg font-bold text-purple-900">
                  {chartData.totalLeads}
                </p>
              </div>
              <Users className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-700">Total Converted</p>
                <p className="text-lg font-bold text-orange-900">
                  {chartData.totalConverted}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performers Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            Top Performing Counselors
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {chartData.topPerformers.map(([counselor, data], index) => (
              <div key={counselor} className="text-center p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg border border-yellow-200">
                <div className="flex items-center justify-center mb-2">
                  {index === 0 && <Award className="w-6 h-6 text-yellow-600 mr-2" />}
                  {index === 1 && <Star className="w-6 h-6 text-gray-600 mr-2" />}
                  {index === 2 && <Star className="w-6 h-6 text-orange-600 mr-2" />}
                  <h3 className="font-semibold text-gray-900">{counselor}</h3>
                </div>
                <p className="text-2xl font-bold text-yellow-700 mb-1">
                  {data.conversionRate.toFixed(1)}%
                </p>
                <p className="text-sm text-gray-600">
                  {data.convertedLeads} of {data.totalLeads} leads converted
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

