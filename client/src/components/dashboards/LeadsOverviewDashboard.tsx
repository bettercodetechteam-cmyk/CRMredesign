import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { parseDate } from '@/lib/utils';
import { aggregateCounts, chartTooltipStyle, excludeOtherFromChartData } from '@/lib/analyticsChartUtils';
import { 
  BarChart3, 
  TrendingUp, 
  Target, 
  MapPin,
  Users,
  Globe,
  GraduationCap,
  Clock
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
  AnalyticsTrendLineChart,
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

interface LeadsOverviewDashboardProps {
  leads: Lead[];
  visibleCharts?: Set<string>;
}

export default function LeadsOverviewDashboard({ leads, visibleCharts = new Set(['enquiries', 'sources', 'trends', 'status', 'cities']) }: LeadsOverviewDashboardProps) {
  
  if (!leads || !Array.isArray(leads) || leads.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Leads Overview Dashboard</h2>
            <p className="text-gray-600 mt-1">Comprehensive view of lead generation and distribution</p>
          </div>
          <Badge variant="secondary" className="text-sm">
            0 Total Leads
          </Badge>
        </div>
        
        <div className="text-center py-12">
          <BarChart3 className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 text-lg mb-2">No leads data available</p>
          <p className="text-gray-400 text-sm">Please add some leads to see analytics charts</p>
        </div>
      </div>
    );
  }
  
  const chartData = useMemo(() => {
    try {
      const courseChartData = excludeOtherFromChartData(
        aggregateCounts(leads, (lead) => lead.course, { limit: 10 })
      );

      const sourceChartData = excludeOtherFromChartData(
        aggregateCounts(leads, (lead) => lead.source, { limit: 10 })
      );

      const trendData = Array.from({ length: 30 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const count = leads.filter(lead => {
          const leadDate = parseDate(lead.enquiryDate) || parseDate(lead.createdAt);
          return leadDate ? leadDate.toISOString().split('T')[0] === dateStr : false;
        }).length;
        return { date: dateStr, enquiries: count };
      }).reverse();

      const statusChartData = excludeOtherFromChartData(
        aggregateCounts(leads, (lead) => lead.status, { limit: 10 })
      );

      const cityChartData = excludeOtherFromChartData(
        aggregateCounts(leads, (lead) => lead.cityArea, { limit: 10 })
      );

      return {
        courseChartData,
        sourceChartData,
        trendData,
        statusChartData,
        cityChartData
      };
    } catch (error) {
      console.error('❌ Error processing chart data:', error);
      return {
        courseChartData: [],
        sourceChartData: [],
        trendData: [],
        statusChartData: [],
        cityChartData: []
      };
    }
  }, [leads]);

  const STATUS_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Leads Overview Dashboard</h2>
          <p className="text-gray-600 mt-1">Comprehensive view of lead generation and distribution</p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {leads.length} Total Leads
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {visibleCharts.has('enquiries') && (
          <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-blue-600" />
                Enquiries by Course
              </CardTitle>
              <BarChart3 className="w-4 h-4 text-gray-400" />
            </CardHeader>
            <CardContent className="pt-2 pb-6">
              {chartData.courseChartData.length > 0 ? (
                <AnalyticsCategoryBarChart
                  data={chartData.courseChartData}
                  fill="#3B82F6"
                  valueLabel="Enquiries"
                  emptyMessage="No course data available"
                />
              ) : (
                <div className="flex items-center justify-center h-[280px] text-gray-500">
                  <div className="text-center">
                    <GraduationCap className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No course data available</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {visibleCharts.has('sources') && (
          <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Globe className="w-5 h-5 text-green-600" />
                Leads by Source
              </CardTitle>
              <BarChart3 className="w-4 h-4 text-gray-400" />
            </CardHeader>
            <CardContent className="pt-2 pb-6">
              {chartData.sourceChartData.length > 0 ? (
                <AnalyticsCategoryBarChart
                  data={chartData.sourceChartData}
                  fill="#10B981"
                  valueLabel="Leads"
                  emptyMessage="No source data available"
                />
              ) : (
                <div className="flex items-center justify-center h-[280px] text-gray-500">
                  <div className="text-center">
                    <Globe className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No source data available</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {visibleCharts.has('trends') && (
          <Card className="col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                Enquiry Trend (Last 30 Days)
              </CardTitle>
              <Clock className="w-4 h-4 text-gray-400" />
            </CardHeader>
            <CardContent className="pt-2 pb-6">
              <AnalyticsTrendLineChart
                data={chartData.trendData}
                dataKey="enquiries"
                stroke="#8B5CF6"
              />
            </CardContent>
          </Card>
        )}

        {visibleCharts.has('status') && (
          <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Target className="w-5 h-5 text-orange-600" />
                Leads by Status
              </CardTitle>
              <Users className="w-4 h-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={chartData.statusChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {chartData.statusChartData.map((entry, index) => (
                      <Cell key={`cell-${entry.name}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [value, name]}
                    contentStyle={chartTooltipStyle}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2 max-h-40 overflow-y-auto pr-1">
                {chartData.statusChartData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: STATUS_COLORS[index % STATUS_COLORS.length] }}
                      />
                      <span className="text-sm font-medium text-gray-700 truncate" title={entry.name}>
                        {entry.name}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900 shrink-0">{entry.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {visibleCharts.has('cities') && (
          <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <MapPin className="w-5 h-5 text-red-600" />
                Leads by City/Area
              </CardTitle>
              <BarChart3 className="w-4 h-4 text-gray-400" />
            </CardHeader>
            <CardContent className="pt-2 pb-6">
              <AnalyticsCategoryBarChart
                data={chartData.cityChartData}
                fill="#EF4444"
                valueLabel="Leads"
                emptyMessage="No city data available"
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
