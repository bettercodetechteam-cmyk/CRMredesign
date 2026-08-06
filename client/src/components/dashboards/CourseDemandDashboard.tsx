import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { parseDate } from '@/lib/utils';
import {
  excludeOtherFromChartData,
  isExcludedChartCategory,
  sanitizeChartCategory,
} from '@/lib/analyticsChartUtils';
import { 
  BarChart3, 
  TrendingUp, 
  GraduationCap, 
  Clock,
  Globe,
  BookOpen,
  Activity,
  Target,
  Users,
  Star
} from 'lucide-react';
import {
  AnalyticsCategoryBarChart,
  AnalyticsStackedBarChart,
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

interface CourseDemandDashboardProps {
  leads: Lead[];
  visibleCharts?: Set<string>;
}

export default function CourseDemandDashboard({ leads, visibleCharts = new Set(['courses', 'durations']) }: CourseDemandDashboardProps) {
  
  const chartData = useMemo(() => {
    try {
    const courseData = leads.reduce((acc, lead) => {
      const course = sanitizeChartCategory(lead.course || '');
      if (!course) return acc;
      if (!acc[course]) {
        acc[course] = {
          totalEnquiries: 0,
          convertedLeads: 0,
          sources: {} as Record<string, number>,
          recentEnquiries: 0
        };
      }
      acc[course].totalEnquiries++;
      if (['Converted', 'Done', 'Admission Done'].includes(lead.status)) acc[course].convertedLeads++;
      const source = sanitizeChartCategory(lead.source || '');
      if (source) {
        acc[course].sources[source] = (acc[course].sources[source] || 0) + 1;
      }
      const enquiryDate = parseDate(lead.enquiryDate);
      if (enquiryDate) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        if (enquiryDate > thirtyDaysAgo) acc[course].recentEnquiries++;
      }
      return acc;
    }, {} as Record<string, any>);

    const popularCoursesData = excludeOtherFromChartData(
      Object.entries(courseData)
        .sort(([,a], [,b]) => b.totalEnquiries - a.totalEnquiries)
        .slice(0, 10)
        .map(([course, data]) => ({
          name: course,
          value: data.totalEnquiries,
          enquiries: data.totalEnquiries,
          converted: data.convertedLeads,
          conversionRate: data.totalEnquiries > 0 ? (data.convertedLeads / data.totalEnquiries * 100) : 0
        }))
    );

    const durationData = leads.reduce((acc, lead) => {
      const duration = sanitizeChartCategory(lead.courseDuration || '') || 'Not specified';
      if (isExcludedChartCategory(duration)) return acc;
      acc[duration] = (acc[duration] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const durationChartData = excludeOtherFromChartData(
      Object.entries(durationData)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 8)
        .map(([duration, count]) => ({ name: duration, value: count, enquiries: count }))
    );

    const sourceCourseData = leads.reduce((acc, lead) => {
      const course = sanitizeChartCategory(lead.course || '');
      const source = sanitizeChartCategory(lead.source || '');
      if (!course || !source) return acc;
      if (!acc[course]) acc[course] = {};
      acc[course][source] = (acc[course][source] || 0) + 1;
      return acc;
    }, {} as Record<string, Record<string, number>>);

    const topSources = Array.from(
      new Set(
        Object.values(sourceCourseData).flatMap((sources) => Object.keys(sources))
      )
    )
      .filter((s) => !isExcludedChartCategory(s))
      .slice(0, 8);

    const stackedBarData = excludeOtherFromChartData(
      Object.entries(sourceCourseData)
        .sort(([,a], [,b]) => Object.values(b).reduce((s, v) => s + v, 0) - Object.values(a).reduce((s, v) => s + v, 0))
        .slice(0, 8)
        .map(([course, sources]) => {
          const data: Record<string, string | number> = { name: course };
          topSources.forEach(source => { data[source] = sources[source] || 0; });
          return data;
        })
    );

    const totalEnquiries = leads.length;
    const totalConverted = leads.filter(lead => 
      ['Converted', 'Done', 'Admission Done'].includes(lead.status)
    ).length;
    const overallConversionRate = totalEnquiries > 0 ? (totalConverted / totalEnquiries * 100) : 0;

    const topCourse = popularCoursesData[0];

    return {
      popularCoursesData,
      durationChartData,
      stackedBarData,
      topSources,
      totalEnquiries,
      totalConverted,
      overallConversionRate,
      topCourse
    };
  } catch (error) {
    console.error('❌ CourseDemandDashboard: Error processing chart data:', error);
    return {
      popularCoursesData: [],
      durationChartData: [],
      stackedBarData: [],
      topSources: [],
      totalEnquiries: 0,
      totalConverted: 0,
      overallConversionRate: 0,
      topCourse: null
    };
  }
}, [leads]);

  const COLORS = ['#3B82F6', '#1D4ED8', '#10B981', '#059669', '#8B5CF6', '#EC4899', '#F59E0B', '#EF4444'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Course Demand Dashboard</h2>
          <p className="text-gray-600 mt-1">Analyze course popularity and demand patterns</p>
        </div>
        <Badge variant="secondary" className="text-sm">
          {chartData.totalEnquiries} Total Enquiries
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {visibleCharts.has('courses') && (
          <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-blue-600" />
                Most Popular Courses
              </CardTitle>
              <BarChart3 className="w-4 h-4 text-gray-400" />
            </CardHeader>
            <CardContent className="pt-2 pb-6">
              <AnalyticsCategoryBarChart
                data={chartData.popularCoursesData}
                dataKey="enquiries"
                fill="#3B82F6"
                valueLabel="Enquiries"
              />
            </CardContent>
          </Card>
        )}

        {visibleCharts.has('durations') && (
          <Card className="col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Clock className="w-5 h-5 text-green-600" />
                Course Duration Enquiries
              </CardTitle>
              <BookOpen className="w-4 h-4 text-gray-400" />
            </CardHeader>
            <CardContent className="pt-2 pb-6">
              <AnalyticsCategoryBarChart
                data={chartData.durationChartData}
                dataKey="enquiries"
                fill="#10B981"
                valueLabel="Enquiries"
              />
            </CardContent>
          </Card>
        )}

        {visibleCharts.has('sources') && chartData.stackedBarData.length > 0 && (
          <Card className="col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Globe className="w-5 h-5 text-purple-600" />
                Source vs Course Distribution
              </CardTitle>
              <Activity className="w-4 h-4 text-gray-400" />
            </CardHeader>
            <CardContent className="pt-2 pb-6">
              <AnalyticsStackedBarChart
                data={chartData.stackedBarData}
                series={chartData.topSources.map((source, index) => ({
                  dataKey: source,
                  fill: COLORS[index % COLORS.length],
                  name: source,
                }))}
              />
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700">Most Popular Course</p>
                <p className="text-lg font-bold text-blue-900">
                  {chartData.topCourse?.name || 'N/A'}
                </p>
              </div>
              <GraduationCap className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700">Top Course Enquiries</p>
                <p className="text-lg font-bold text-green-900">
                  {chartData.topCourse?.enquiries || 0}
                </p>
              </div>
              <Users className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-700">Overall Conversion</p>
                <p className="text-lg font-bold text-purple-900">
                  {chartData.overallConversionRate.toFixed(1)}%
                </p>
              </div>
              <Target className="w-8 h-8 text-purple-600" />
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
              <Star className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            Course Performance Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {chartData.popularCoursesData.slice(0, 6).map((course, index) => (
              <div key={course.name} className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-900 truncate" title={course.name}>{course.name}</h3>
                  <Badge variant="secondary" className="text-xs">
                    #{index + 1}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Enquiries:</span>
                    <span className="font-semibold text-gray-900">{course.enquiries}</span>
              </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Converted:</span>
                    <span className="font-semibold text-gray-900">{course.converted}</span>
          </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Rate:</span>
                    <span className="font-semibold text-green-600">{course.conversionRate.toFixed(1)}%</span>
                  </div>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
