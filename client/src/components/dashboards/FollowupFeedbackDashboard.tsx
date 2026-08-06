import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { parseDate } from '@/lib/utils';
import { 
  Calendar,
  Clock,
  TrendingUp,
  FileText,
  AlertCircle,
  CheckCircle,
  XCircle,
  CalendarDays,
  MessageSquare,
  Activity
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

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

interface FollowupFeedbackDashboardProps {
  leads: Lead[];
  reminders?: any[];
  calendarEvents?: any[];
  visibleCharts?: Set<string>;
}

export default function FollowupFeedbackDashboard({ 
  leads, 
  reminders = [], 
  calendarEvents = [],
  visibleCharts = new Set(['followups', 'feedback']) 
}: FollowupFeedbackDashboardProps) {
  
  // Process data for charts
  const chartData = useMemo(() => {
    try {
    // Upcoming Follow-ups - Calendar Heatmap Data
    const upcomingFollowups = leads.filter(lead => {
      if (!lead.followUpDate) return false;
      const followUpDate = parseDate(lead.followUpDate);
      if (!followUpDate) return false;
      const today = new Date();
      return followUpDate >= today;
    });

    const heatmapData = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const count = upcomingFollowups.filter(lead => {
        const followUpDate = parseDate(lead.followUpDate!);
        if (!followUpDate) return false;
        return followUpDate.toISOString().split('T')[0] === dateStr;
      }).length;
      return { date: dateStr, count };
    });

    // Overdue Follow-ups - Donut Chart Data
    const overdueFollowups = leads.filter(lead => {
      if (!lead.followUpDate) return false;
      const followUpDate = parseDate(lead.followUpDate);
      if (!followUpDate) return false;
      const today = new Date();
      return followUpDate < today;
    });

    const onScheduleFollowups = leads.filter(lead => {
      if (!lead.followUpDate) return false;
      const followUpDate = parseDate(lead.followUpDate);
      if (!followUpDate) return false;
      const today = new Date();
      return followUpDate >= today;
    });

    const overdueData = [
      { name: 'Overdue', value: overdueFollowups.length, color: '#EF4444' },
      { name: 'On Schedule', value: onScheduleFollowups.length, color: '#10B981' }
    ];

    // Status Trend Over Time - Line Chart Data
    const statusTrendData = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
             const dayLeads = leads.filter(lead => {
         const leadDate = parseDate(lead.enquiryDate);
         if (!leadDate) return false;
         return leadDate.toISOString().split('T')[0] === dateStr;
       });

      const newLeads = dayLeads.filter(lead => lead.status === 'New' || lead.status === 'Other').length;
      const contactedLeads = dayLeads.filter(lead => lead.status === 'Contacted').length;
      const convertedLeads = dayLeads.filter(lead => 
        ['Converted', 'Done', 'Admission Done'].includes(lead.status)
      ).length;

      return {
        date: dateStr,
        new: newLeads,
        contacted: contactedLeads,
        converted: convertedLeads
      };
    }).reverse();

    // Feedback Call Remarks - Word Cloud Data
    const feedbackRemarks = leads
      .filter(lead => lead.feedbackCallRemarks)
      .map(lead => lead.feedbackCallRemarks)
      .join(' ')
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .reduce((acc, word) => {
        acc[word] = (acc[word] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const wordCloudData = Object.entries(feedbackRemarks)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 20)
      .map(([word, count]) => ({ word, count }));

         return {
       heatmapData,
       overdueData,
       statusTrendData,
       wordCloudData,
       totalOverdue: overdueFollowups.length,
       totalOnSchedule: onScheduleFollowups.length,
       totalFollowups: leads.filter(lead => lead.followUpDate).length
     };
   } catch (error) {
     console.error('❌ FollowupFeedbackDashboard: Error processing chart data:', error);
     // Return fallback data
     return {
       heatmapData: [],
       overdueData: [],
       statusTrendData: [],
       wordCloudData: [],
       totalOverdue: 0,
       totalOnSchedule: 0,
       totalFollowups: 0
     };
   }
 }, [leads]);

  const COLORS = ['#3B82F6', '#1D4ED8', '#1E40AF', '#1E3A8A', '#1E293B'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Follow-up & Feedback Dashboard</h2>
          <p className="text-gray-600 mt-1">Track follow-up activities and feedback insights</p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {chartData.totalFollowups} Total Follow-ups
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Follow-ups - Calendar Heatmap */}
        {visibleCharts.has('followups') && (
          <Card className="col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Upcoming Follow-ups (Next 30 Days)
              </CardTitle>
              <CalendarDays className="w-4 h-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-30 gap-1 h-64">
                {chartData.heatmapData.map(({ date, count }, index) => {
                  const intensity = count > 0 ? Math.min(count / 5, 1) : 0;
                  const bgColor = count > 0 
                    ? `rgba(59, 130, 246, ${0.2 + intensity * 0.8})`
                    : '#f3f4f6';
                  
                  return (
                    <div
                      key={date}
                      className="relative border border-gray-200 rounded-sm hover:border-blue-300 transition-colors"
                      style={{ backgroundColor: bgColor }}
                      title={`${date}: ${count} follow-ups`}
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-medium text-gray-700">
                          {count > 0 ? count : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-center mt-4 space-x-4">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-gray-200 rounded-sm"></div>
                  <span className="text-xs text-gray-600">0</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-blue-300 rounded-sm"></div>
                  <span className="text-xs text-gray-600">1-2</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-blue-500 rounded-sm"></div>
                  <span className="text-xs text-gray-600">3+</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Overdue Follow-ups - Donut Chart */}
        {visibleCharts.has('followups') && (
          <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                Overdue vs On Schedule
              </CardTitle>
              <Clock className="w-4 h-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData.overdueData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {chartData.overdueData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-4">
                {chartData.overdueData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="text-sm font-medium text-gray-700">
                        {entry.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        {((entry.value / chartData.totalFollowups) * 100).toFixed(1)}%
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {entry.value}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Trend Over Time - Line Chart */}
        {visibleCharts.has('trends') && (
          <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-purple-600" />
                Status Trend Over Time
              </CardTitle>
              <Activity className="w-4 h-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={chartData.statusTrendData} margin={{ top: 16, right: 24, left: 8, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#6b7280" 
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    minTickGap={20}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '10px',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12)',
                    }}
                    cursor={{ stroke: '#8B5CF6', strokeWidth: 1, strokeDasharray: '4 4' }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="new" 
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="contacted" 
                    stroke="#10B981" 
                    strokeWidth={2}
                    dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="converted" 
                    stroke="#F59E0B" 
                    strokeWidth={2}
                    dot={{ fill: '#F59E0B', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Feedback Call Remarks - Word Cloud */}
        {visibleCharts.has('feedback') && (
          <Card className="col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-green-600" />
                Feedback Call Remarks - Word Cloud
              </CardTitle>
              <FileText className="w-4 h-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 justify-center items-center min-h-48 p-4">
                {chartData.wordCloudData.map(({ word, count }, index) => {
                  const fontSize = Math.max(12, Math.min(24, 12 + (count * 2)));
                  const color = COLORS[index % COLORS.length];
                  
                  return (
                    <span
                      key={word}
                      className="inline-block px-2 py-1 rounded-full hover:scale-110 transition-transform cursor-pointer"
                      style={{ 
                        fontSize: `${fontSize}px`,
                        color: color,
                        backgroundColor: `${color}20`
                      }}
                      title={`${word}: ${count} mentions`}
                    >
                      {word}
                    </span>
                  );
                })}
              </div>
              {chartData.wordCloudData.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No feedback remarks available</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-700">Overdue Follow-ups</p>
                <p className="text-lg font-bold text-red-900">
                  {chartData.totalOverdue}
                </p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700">On Schedule</p>
                <p className="text-lg font-bold text-green-900">
                  {chartData.totalOnSchedule}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700">Completion Rate</p>
                <p className="text-lg font-bold text-blue-900">
                  {chartData.totalFollowups > 0 
                    ? ((chartData.totalOnSchedule / chartData.totalFollowups) * 100).toFixed(1)
                    : '0'}%
                </p>
              </div>
              <Activity className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
