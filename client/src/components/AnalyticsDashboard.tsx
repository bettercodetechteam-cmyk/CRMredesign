import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Users, 
  Target, 
  Calendar,
  Download,
  Clock,
  Globe,
  GraduationCap,
  MapPin,
  UserCheck,
  Activity,
  FileText,
  Bell,
  CheckCircle,
  XCircle,
  Phone,
  Mail,
  Building,
  BookOpen,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { parseDate, isToday } from '@/lib/utils';
import Loading from '@/components/ui/loading';
import LeadsOverviewDashboard from './dashboards/LeadsOverviewDashboard';
import CounselorPerformanceDashboard from './dashboards/CounselorPerformanceDashboard';
import CourseDemandDashboard from './dashboards/CourseDemandDashboard';
import FollowupFeedbackDashboard from './dashboards/FollowupFeedbackDashboard';

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

interface AnalyticsDashboardProps {
  leads: Lead[];
  reminders?: any[];
  calendarEvents?: any[];
}

export default function AnalyticsDashboard({ leads, reminders = [], calendarEvents = [] }: AnalyticsDashboardProps) {
  const [activeDashboard, setActiveDashboard] = useState('overview');

  const [visibleCharts, setVisibleCharts] = useState<Set<string>>(new Set([
    'enquiries', 'sources', 'trends', 'status', 'cities', 'counselors', 'conversions', 'followups', 'courses', 'durations', 'feedback'
  ]));
  const { toast } = useToast();

  // Toggle chart visibility
  const toggleChart = (chartName: string) => {
    setVisibleCharts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(chartName)) {
        newSet.delete(chartName);
      } else {
        newSet.add(chartName);
      }
      return newSet;
    });
  };
  
  // Enhanced debug logging with data validation
  console.log('📊 AnalyticsDashboard: Received data:', {
    leadsCount: leads?.length || 0,
    remindersCount: reminders?.length || 0,
    calendarEventsCount: calendarEvents?.length || 0,
    leadsSample: leads?.slice(0, 2) || [],
    leadsValid: leads?.every(lead => lead && typeof lead === 'object' && lead.id) || false,
    dataTypes: {
      leads: Array.isArray(leads) ? 'array' : typeof leads,
      reminders: Array.isArray(reminders) ? 'array' : typeof reminders,
      calendarEvents: Array.isArray(calendarEvents) ? 'array' : typeof calendarEvents
    }
  });

  // Validate and sanitize leads data
  const validatedLeads = useMemo(() => {
    if (!leads || !Array.isArray(leads)) {
      console.warn('⚠️ AnalyticsDashboard: Invalid leads data received:', leads);
      return [];
    }

    return leads.filter(lead => {
      if (!lead || typeof lead !== 'object') {
        console.warn('⚠️ AnalyticsDashboard: Invalid lead object:', lead);
        return false;
      }
      
      if (!lead.id) {
        console.warn('⚠️ AnalyticsDashboard: Lead missing ID:', lead);
        return false;
      }

      return true;
    }).map(lead => ({
      ...lead,
      // Ensure required fields have fallback values
      leadName: lead.leadName || 'Unknown',
      contact: lead.contact || 'N/A',
      emailId: lead.emailId || 'N/A',
      course: lead.course || 'Unknown',
      source: lead.source || 'Unknown',
      cityArea: lead.cityArea || 'Unknown',
      status: lead.status === "New" ? "Other" : (lead.status || "Other"),
      counselorName: lead.counselorName || 'Unassigned',
      enquiryDate: lead.enquiryDate || lead.createdAt || new Date(),
      createdAt: lead.createdAt || new Date(),
      updatedAt: lead.updatedAt || new Date(),
      // Add missing fields that might be undefined
      education: lead.education || '',
      courseDuration: lead.courseDuration || '',
      remark: lead.remark || '',
      feedbackCallRemarks: lead.feedbackCallRemarks || '',
      centreHeadRemarks: lead.centreHeadRemarks || ''
    }));
  }, [leads]);

  const filteredLeads = validatedLeads;

  // Show loading state if no data or data is invalid
  if (!validatedLeads || validatedLeads.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loading 
            size="lg" 
            text="Loading lead analytics data..." 
            color="primary"
          />
          <p className="text-sm text-gray-500 mt-4">
            {leads && Array.isArray(leads) && leads.length === 0 
              ? 'No leads data available. Please add some leads to see analytics.'
              : 'Please ensure leads data is available'
            }
          </p>
          <div className="flex items-center gap-2 mt-4 justify-center">
            <AlertCircle className="w-4 h-4 text-orange-500" />
            <span className="text-sm text-orange-600">
              Data Status: {leads ? `${leads.length} leads received` : 'No data'}
            </span>
          </div>
          <Button 
            onClick={() => {
              window.dispatchEvent(new CustomEvent('analyticsDataUpdated', { 
                detail: { source: 'analytics-dashboard', timestamp: Date.now(), forceRefresh: true } 
              }));
            }}
            className="mt-4"
          >
            Retry Loading Data
          </Button>
        </div>
      </div>
    );
  }

  // Calculate summary statistics with improved error handling
  const summaryStats = useMemo(() => {
    try {
      const totalLeads = filteredLeads.length;
      const convertedLeads = filteredLeads.filter(lead => 
        ['Converted', 'Done', 'Admission Done', 'Interested'].includes(lead.status)
      ).length;
      const hotLeads = filteredLeads.filter(lead => lead.status === 'Hot Lead').length;
      const coldLeads = filteredLeads.filter(lead => lead.status === 'Cold Lead').length;
      // Calculate today's leads (leads created today)
      const todayLeads = filteredLeads.filter(lead => {
        const createdDate = parseDate(lead.createdAt);
        return createdDate ? isToday(createdDate) : false;
      }).length;

      return {
        totalLeads,
        convertedLeads,
        conversionRate: totalLeads > 0 ? (convertedLeads / totalLeads * 100) : 0,
        hotLeads,
        coldLeads,
        todayLeads,
        totalReminders: reminders?.length || 0,
        totalEvents: calendarEvents?.length || 0
      };
    } catch (error) {
      console.error('❌ AnalyticsDashboard: Error calculating summary stats:', error);
      return {
        totalLeads: 0,
        convertedLeads: 0,
        conversionRate: 0,
        hotLeads: 0,
        todayLeads: 0,
        totalReminders: reminders?.length || 0,
        totalEvents: calendarEvents?.length || 0
      };
    }
  }, [filteredLeads, reminders, calendarEvents]);



  // Export analytics data
  const exportAnalytics = () => {
    try {
      const dataStr = JSON.stringify({
        summaryStats,
        exportDate: new Date().toISOString(),
        totalRecords: filteredLeads.length,
        dataValidation: {
          originalLeadsCount: leads?.length || 0,
          validatedLeadsCount: validatedLeads.length,
          filteredLeadsCount: filteredLeads.length
        }
      }, null, 2);
      
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `analytics-export-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export Successful",
        description: "Analytics data has been exported successfully",
      });
    } catch (error) {
      console.error('❌ Export error:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export analytics data",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Modern Dashboard Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-2xl shadow-2xl p-6 sm:p-8">
        <div className="absolute inset-0 bg-grid-white/10"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 backdrop-blur-md rounded-xl shadow-lg">
              <BarChart3 className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white drop-shadow-lg">Lead Analytics Dashboard</h1>
              <p className="text-blue-100 mt-1">Comprehensive insights and performance metrics</p>
            </div>
          </div>
        </div>
      </div>

      {/* Premium Summary Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {/* Total Leads Card */}
        <Card className="group relative overflow-hidden bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.03] cursor-pointer border-0">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
          <CardContent className="p-5 relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-xs font-semibold uppercase tracking-wider mb-2">
                  Total Leads
                </p>
                <p className="text-3xl font-bold mb-1">{summaryStats.totalLeads}</p>
                <p className="text-blue-200 text-sm">Active enquiries</p>
              </div>
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-xl group-hover:bg-white/30 transition-all duration-300 group-hover:rotate-12">
                <Users className="w-7 h-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Converted Leads Card */}
        <Card className="group relative overflow-hidden bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.03] cursor-pointer border-0">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
          <CardContent className="p-5 relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-xs font-semibold uppercase tracking-wider mb-2">
                  Converted
                </p>
                <p className="text-3xl font-bold mb-1">{summaryStats.convertedLeads}</p>
                <p className="text-emerald-200 text-sm">
                  {summaryStats.conversionRate.toFixed(1)}% conversion rate
                </p>
              </div>
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-xl group-hover:bg-white/30 transition-all duration-300 group-hover:rotate-12">
                <CheckCircle className="w-7 h-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hot Leads Card */}
        <Card className="group relative overflow-hidden bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.03] cursor-pointer border-0">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
          <CardContent className="p-5 relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-xs font-semibold uppercase tracking-wider mb-2">
                  Hot Leads
                </p>
                <p className="text-3xl font-bold mb-1">{summaryStats.hotLeads}</p>
                <p className="text-orange-200 text-sm">High priority</p>
              </div>
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-xl group-hover:bg-white/30 transition-all duration-300 group-hover:rotate-12">
                <Activity className="w-7 h-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cold Leads Card */}
        <Card className="group relative overflow-hidden bg-gradient-to-br from-slate-500 via-slate-600 to-slate-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.03] cursor-pointer border-0">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
          <CardContent className="p-5 relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-100 text-xs font-semibold uppercase tracking-wider mb-2">
                  Cold Leads
                </p>
                <p className="text-3xl font-bold mb-1">{summaryStats.coldLeads}</p>
                <p className="text-slate-200 text-sm">Low engagement</p>
              </div>
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-xl group-hover:bg-white/30 transition-all duration-300 group-hover:rotate-12">
                <Clock className="w-7 h-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's Leads Card */}
        <Card className="group relative overflow-hidden bg-gradient-to-br from-purple-500 via-purple-600 to-purple-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.03] cursor-pointer border-2 border-purple-400">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>
          <CardContent className="p-5 relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                  </span>
                  Today's Leads
                </p>
                <p className="text-3xl font-bold mb-1">{summaryStats.todayLeads}</p>
                <p className="text-purple-200 text-sm">New today</p>
              </div>
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm shadow-xl group-hover:bg-white/30 transition-all duration-300 group-hover:rotate-12">
                <Calendar className="w-7 h-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>





      {/* Enhanced Dashboard Tabs */}
      <Tabs value={activeDashboard} onValueChange={setActiveDashboard} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 gap-1 p-1 bg-gray-100 rounded-lg">
          <TabsTrigger value="overview" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium px-3 py-2.5 rounded-md transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-md data-[state=active]:font-semibold hover:bg-gray-50 hover:shadow-sm">
            <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Leads Overview</span>
            <span className="sm:hidden">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="counselor" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium px-3 py-2.5 rounded-md transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-green-600 data-[state=active]:shadow-md data-[state=active]:font-semibold hover:bg-gray-50 hover:shadow-sm">
            <UserCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Counselor Performance</span>
            <span className="sm:hidden">Counselor</span>
          </TabsTrigger>
          <TabsTrigger value="course" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium px-3 py-2.5 rounded-md transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-md data-[state=active]:font-semibold hover:bg-gray-50 hover:shadow-sm">
            <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Course Demand</span>
            <span className="sm:hidden">Courses</span>
          </TabsTrigger>
          <TabsTrigger value="followup" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium px-3 py-2.5 rounded-md transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-md data-[state=active]:font-semibold hover:bg-gray-50 hover:shadow-sm">
            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Follow-up & Feedback</span>
            <span className="sm:hidden">Follow-up</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <LeadsOverviewDashboard 
            leads={filteredLeads} 
            visibleCharts={visibleCharts}
          />
        </TabsContent>

        <TabsContent value="counselor">
          <CounselorPerformanceDashboard 
            leads={filteredLeads} 
            visibleCharts={visibleCharts}
          />
        </TabsContent>

        <TabsContent value="course">
          <CourseDemandDashboard 
            leads={filteredLeads} 
            visibleCharts={visibleCharts}
          />
        </TabsContent>

        <TabsContent value="followup">
          <FollowupFeedbackDashboard 
            leads={filteredLeads} 
            reminders={reminders}
            calendarEvents={calendarEvents}
            visibleCharts={visibleCharts}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
