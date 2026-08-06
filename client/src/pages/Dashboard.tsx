import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import { usePageLoadingSignal } from "@/contexts/NavigationLoadingContext";
import { useAuth } from "@/hooks/useAuth";
import { useLeadsStore } from "@/hooks/useCentreData";
import {
  getWebsiteEnquiryReceivedAt,
  isRecentWebsiteEnquiry,
  isWebsiteEnquiryLead,
  type LeadRecord,
} from "@/lib/centreDataStore";
import { useToast } from "@/hooks/use-toast";
import {
  UserPlus,
  GraduationCap,
  Calendar,
  Bell,
  TrendingUp,
  DollarSign,
  RefreshCw,
  BookOpen,
  Users,
  Eye,
  Activity,
  Award,
  Shield,
  Crown,
  Star,
  Zap,
  CheckCircle,
  AlertCircle,
  Info,
  Wifi,
  ArrowUpRight,
  ArrowDownRight,
  TrendingDown,
  Sparkles,
  Flame,
  Globe,
  Mail,
} from "lucide-react";
import { collection, getDocs, query, orderBy, where, Timestamp, onSnapshot, limit, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Loading from "@/components/ui/loading";
import ReminderWidget from "@/components/ReminderWidget";


interface DashboardStats {
  totalLeads: number;
  totalStudents: number;
  totalRevenue: number;
  conversionRate: number;
  todayLeads: number;
  pendingFollowUps: number;
  hotLeads: number;
  recentConversions: number;
}

interface Lead {
  id: string;
  leadName: string;
  contact: string;
  emailId?: string;
  status: string;
  createdAt: any;
  enquiryDate: string | Date;
  followUpDate?: any;
  nextFollowUpDate?: any;
  followUpNotificationDone?: boolean;
  followUpDoneAt?: any;
  counselorName: string;
  course: string;
}

interface Student {
  id: string;
  name: string;
  course: string;
  admissionDate: any;
  status: string;
}

export default function Dashboard() {
  const navigate = useAppNavigate();
  const { user, userProfile } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    totalLeads: 0,
    totalStudents: 0,
    totalRevenue: 0,
    conversionRate: 0,
    todayLeads: 0,
    pendingFollowUps: 0,
    hotLeads: 0,
    recentConversions: 0,
  });
  const [todayLeads, setTodayLeads] = useState<Lead[]>([]);
  const [recentStudents, setRecentStudents] = useState<Student[]>([]);
  const { leads: storeLeads, loading, isLive: isConnected, refresh, patchLead } = useLeadsStore();
  usePageLoadingSignal(loading);
  const allLeads = storeLeads as unknown as Lead[];
  const [followUpNotificationOpen, setFollowUpNotificationOpen] = useState(false);
  const [markingDoneLeadId, setMarkingDoneLeadId] = useState<string | null>(null);
  const [dashboardClock, setDashboardClock] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setDashboardClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const recentWebsiteInquiries = useMemo(() => {
    void dashboardClock;
    return allLeads
      .filter((lead) => isRecentWebsiteEnquiry(lead as unknown as LeadRecord))
      .sort((a, b) => {
        const aTime = getWebsiteEnquiryReceivedAt(a as unknown as LeadRecord)?.getTime() ?? 0;
        const bTime = getWebsiteEnquiryReceivedAt(b as unknown as LeadRecord)?.getTime() ?? 0;
        return bTime - aTime;
      });
  }, [allLeads, dashboardClock]);

  const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === "string") {
      // Parse YYYY-MM-DD as local date to avoid timezone day shift.
      const localDateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      const parsed = localDateMatch
        ? new Date(
            Number(localDateMatch[1]),
            Number(localDateMatch[2]) - 1,
            Number(localDateMatch[3]),
            12,
            0,
            0,
            0
          )
        : new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    if (typeof value === "object" && "toDate" in value) {
      const parsed = (value as any).toDate();
      return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
    }
    return null;
  };

  const isPendingFollowUp = (lead: Lead) => {
    const followUpDate = toDate(lead.nextFollowUpDate || lead.followUpDate);
    if (!followUpDate) return false;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Show all current-month follow-ups (past + upcoming within this month).
    const isCurrentMonthFollowUp =
      followUpDate.getTime() >= startOfMonth.getTime() &&
      followUpDate.getTime() <= endOfMonth.getTime();
    if (!isCurrentMonthFollowUp) return false;

    if (!lead.followUpNotificationDone) return true;

    // If follow-up was marked done but date was changed later, show again.
    const doneAt = toDate(lead.followUpDoneAt);
    if (!doneAt) return false;
    return followUpDate.getTime() > doneAt.getTime();
  };

  const hotLeadsList = useMemo(() => allLeads.filter((lead) => lead.status === "Hot Lead"), [allLeads]);
  const followUpNotifications = useMemo(() => {
    return allLeads
      .filter((lead) => isPendingFollowUp(lead))
      .map((lead) => ({ lead, date: toDate(lead.followUpDate || lead.nextFollowUpDate) }))
      .filter((entry): entry is { lead: Lead; date: Date } => !!entry.date)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [allLeads]);

  // Check if lead was created today (same logic as Leads.tsx)
  const isTodayLead = (lead: Lead) => {
    // Check both enquiryDate and createdAt (matching Leads page logic)
    const checkDate = (date: any) => {
      if (!date) return false;
      
      let leadDate: Date;
      
      // Handle different date formats
      if (date instanceof Date) {
        leadDate = date;
      } else if (typeof date === 'string') {
        leadDate = new Date(date);
      } else if (date && typeof date === 'object' && 'toDate' in date) {
        // Handle Firestore Timestamp
        leadDate = (date as any).toDate();
      } else {
        return false;
      }
      
      // Check if date is valid
      if (isNaN(leadDate.getTime())) {
        return false;
      }
      
      const today = new Date();
      return (
        leadDate.getDate() === today.getDate() &&
        leadDate.getMonth() === today.getMonth() &&
        leadDate.getFullYear() === today.getFullYear()
      );
    };
    
    const isToday = checkDate(lead.enquiryDate) || checkDate(lead.createdAt);
    
    // Debug logging for today's leads
    if (isToday && process.env.NODE_ENV === 'development') {
      console.log('📅 Today lead found:', {
        id: lead.id,
        name: lead.leadName,
        enquiryDate: lead.enquiryDate,
        createdAt: lead.createdAt
      });
    }
    
    return isToday;
  };

  useEffect(() => {
    const leads = allLeads;
    const totalLeads = leads.length;
    const todayLeadsList = leads.filter((lead) => isTodayLead(lead) && !isWebsiteEnquiryLead(lead as unknown as LeadRecord));
    const hotLeads = leads.filter((lead) => lead.status === "Hot Lead").length;
    const pendingFollowUps = leads.filter((lead) => isPendingFollowUp(lead)).length;
    const convertedLeads = leads.filter((lead) => lead.status === "Admission Done").length;
    const conversionRate =
      totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : "0";

    setStats({
      totalLeads,
      totalStudents: convertedLeads,
      totalRevenue: 0,
      conversionRate: parseFloat(conversionRate),
      todayLeads: todayLeadsList.length,
      pendingFollowUps,
      hotLeads,
      recentConversions: 0,
    });
    setTodayLeads(todayLeadsList);
  }, [allLeads]);

  const getRoleDisplayName = () => {
    const role = userProfile?.role || "counselor";
    const roleNames = {
      admin: "Administrator",
      counselor: "Counselor",
      centre_head: "Centre Head",
      director: "Director",
    };
    return roleNames[role as keyof typeof roleNames] || "User";
  };

  const getRoleIcon = () => {
    const role = userProfile?.role || "counselor";
    const roleIcons = {
      admin: Shield,
      counselor: Users,
      centre_head: Crown,
      director: Star,
    };
    return roleIcons[role as keyof typeof roleIcons] || Users;
  };

  // Manual test function to verify data
  const testDataFetch = async () => {
    try {
      console.log('🧪 Testing data fetch...');
      const leadsQuery = query(collection(db, "leads"));
      const snapshot = await getDocs(leadsQuery);
      const leads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Lead[];
      
      console.log('🧪 Test results:', {
        totalLeads: leads.length,
        convertedLeads: leads.filter(lead => lead.status === "Admission Done").length,
        todayLeads: leads.filter(isTodayLead).length,
        sampleStatuses: leads.slice(0, 5).map(l => ({ id: l.id, status: l.status }))
      });
      
      // Show detailed breakdown
      const convertedLeads = leads.filter(lead => lead.status === "Admission Done");
      const todayLeads = leads.filter(isTodayLead);
      
      console.log('🔍 Detailed breakdown:');
      console.log('Converted leads:', convertedLeads.map(l => ({ id: l.id, status: l.status, name: l.leadName })));
      console.log('Today leads:', todayLeads.map(l => ({ id: l.id, status: l.status, name: l.leadName, createdAt: l.createdAt })));
      
      // Alert the results for immediate visibility
      alert(`Test Results:
Total Leads: ${leads.length}
Converted Leads: ${convertedLeads.length}
Today's Leads: ${todayLeads.length}
Check console for details`);
      
    } catch (error) {
      console.error('🧪 Test error:', error);
      alert('Test failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const getRoleColor = () => {
    const role = userProfile?.role || "counselor";
    const roleColors = {
      admin: "bg-red-500",
      counselor: "bg-blue-500",
      centre_head: "bg-purple-500",
      director: "bg-yellow-500",
    };
    return roleColors[role as keyof typeof roleColors] || "bg-blue-500";
  };

  const formatFollowUpDate = (value: any) => {
    if (!value) return "N/A";
    const parsed = toDate(value);
    if (!(parsed instanceof Date) || isNaN(parsed.getTime())) return "N/A";
    return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const handleMarkFollowUpDone = async (leadId: string) => {
    const normalizedLeadId = String(leadId);
    try {
      setMarkingDoneLeadId(normalizedLeadId);
      const leadRef = doc(db, "leads", normalizedLeadId);
      const updates = {
        followUpNotificationDone: true,
        followUpDoneAt: new Date(),
        followUpDate: null,
        nextFollowUpDate: null,
        updatedAt: new Date(),
        updatedBy: userProfile?.uid || "unknown",
      };
      await updateDoc(leadRef, updates);

      patchLead(normalizedLeadId, updates as Partial<Lead>);

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("leadDataUpdated", {
            detail: {
              leadId: normalizedLeadId,
              action: "update",
              source: "dashboard_followup_notification",
              timestamp: Date.now(),
              preventRefresh: false,
              updates,
            },
          })
        );
      }

      toast({
        title: "Follow-up marked done",
        description: "Notification has been cleared from dashboard.",
      });
    } catch (error) {
      console.error("Failed to mark follow-up as done:", error);
      toast({
        title: "Action failed",
        description: "Could not mark this follow-up as done. Please try again.",
        variant: "destructive",
      });
    } finally {
      setMarkingDoneLeadId(null);
    }
  };

  if (loading) {
    return <Loading fullScreen={true} text="Loading dashboard..." color="primary" />;
  }

  const RoleIcon = getRoleIcon();
  const roleColor = getRoleColor();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30">
      {/* Modern Header with Gradient */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 border-b border-indigo-200/50">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]" />
        <div className="relative px-4 xs:px-5 sm:px-6 lg:px-8 py-6 xs:py-7 sm:py-8">
          <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-4 xs:gap-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 xs:gap-4 mb-3">
                <div className="p-2.5 xs:p-3 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg border border-white/30">
                  <Sparkles className="w-5 h-5 xs:w-6 xs:h-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-2xl xs:text-3xl sm:text-4xl font-bold text-white font-heading truncate drop-shadow-lg">
                    Dashboard
                  </h1>
                  <p className="text-blue-50 mt-1.5 text-sm xs:text-base font-body truncate">
                    Welcome back, {user?.displayName || "User"}! Here's your performance overview.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 text-xs xs:text-sm px-3 py-1.5 rounded-full shadow-sm">
                  <RoleIcon className="w-3 h-3 mr-1.5" />
                  <span className="hidden xs:inline">{getRoleDisplayName()}</span>
                  <span className="xs:hidden">{getRoleDisplayName().split(' ')[0]}</span>
                </Badge>
                {isConnected && (
                  <Badge className="bg-emerald-500/20 backdrop-blur-sm text-white border-emerald-400/30 text-xs px-2 py-1 rounded-full">
                    <Wifi className="w-3 h-3 mr-1" />
                    Live
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 w-full xs:w-auto">
              <Popover open={followUpNotificationOpen} onOpenChange={setFollowUpNotificationOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="relative bg-white/90 hover:bg-white text-blue-600 shadow-lg hover:shadow-xl transition-all"
                  >
                    <Bell className="w-4 h-4" />
                    {followUpNotifications.length > 0 && (
                      <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
                        {followUpNotifications.length > 99 ? "99+" : followUpNotifications.length}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[360px] max-w-[95vw] p-0">
                  <div className="border-b px-4 py-3 bg-blue-50/70">
                    <p className="text-sm font-semibold text-blue-900">Follow-up Notifications</p>
                    <p className="text-xs text-blue-700/80">
                      {followUpNotifications.length > 0
                        ? `${followUpNotifications.length} pending follow-up${followUpNotifications.length > 1 ? "s" : ""}`
                        : "All caught up"}
                    </p>
                  </div>
                  <div className="max-h-[360px] overflow-auto">
                    {followUpNotifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-gray-500">
                        No pending follow-ups.
                      </div>
                    ) : (
                      <div className="p-2 space-y-2">
                        {followUpNotifications.slice(0, 12).map(({ lead, date }) => {
                          const isOverdue = date.getTime() < new Date(new Date().setHours(0, 0, 0, 0)).getTime();
                          return (
                            <div key={lead.id} className="rounded-lg border bg-white p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <Link
                                    to={`/leads?leadId=${encodeURIComponent(String(lead.id))}`}
                                    onClick={() => setFollowUpNotificationOpen(false)}
                                    className="text-sm font-semibold text-blue-700 hover:text-blue-900 hover:underline truncate block"
                                  >
                                    {lead.leadName}
                                  </Link>
                                  <p className="text-xs text-gray-600 truncate">{lead.course || "Course N/A"}</p>
                                </div>
                                <Badge
                                  variant="outline"
                                  className={isOverdue ? "text-red-700 border-red-300 bg-red-50" : "text-blue-700 border-blue-300 bg-blue-50"}
                                >
                                  {formatFollowUpDate(date)}
                                </Badge>
                              </div>
                              <div className="mt-2 flex items-center justify-between gap-2">
                                <p className={`text-[11px] ${isOverdue ? "text-red-600" : "text-blue-600"}`}>
                                  {isOverdue ? "Overdue" : "Due today"}
                                </p>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700"
                                  disabled={markingDoneLeadId === String(lead.id)}
                                  onClick={() => handleMarkFollowUpDone(String(lead.id))}
                                >
                                  {markingDoneLeadId === String(lead.id) ? "Marking..." : "Mark Done"}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              <Button
                onClick={() => {
                  void refresh();
                }}
                variant="secondary"
                size="sm"
                className="flex items-center gap-2 w-full xs:w-auto bg-white/90 hover:bg-white text-blue-600 shadow-lg hover:shadow-xl transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden xs:inline">Refresh</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 xs:px-4 sm:px-5 md:px-6 lg:px-8 py-6 xs:py-7 sm:py-8 lg:py-10">
        {/* Enhanced Stats Grid with Modern Cards */}
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-4 xs:gap-5 sm:gap-6 mb-6 xs:mb-8 sm:mb-10">
          {/* Total Leads Card */}
          <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-blue-50 to-blue-100/50">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/10 rounded-full blur-3xl" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
              <CardTitle className="text-xs xs:text-sm font-semibold text-blue-900/80">Total Leads</CardTitle>
              <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <UserPlus className="w-5 h-5 text-white" />
              </div>
            </CardHeader>
            <CardContent className="pt-0 relative z-10">
              <div className="text-3xl xs:text-4xl font-bold text-blue-900 mb-2">
                {stats.totalLeads}
              </div>
              <div className="flex items-center gap-1 text-xs text-blue-700/70">
                <TrendingUp className="w-3 h-3" />
                <span>Active enquiries</span>
              </div>
            </CardContent>
          </Card>

          {/* Converted Leads Card */}
          <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-emerald-50 to-green-100/50">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/10 rounded-full blur-3xl" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
              <CardTitle className="text-xs xs:text-sm font-semibold text-emerald-900/80">Converted</CardTitle>
              <div className="p-2 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
            </CardHeader>
            <CardContent className="pt-0 relative z-10">
              <div className="text-3xl xs:text-4xl font-bold text-emerald-900 mb-2">
                {stats.totalStudents}
              </div>
              <div className="flex items-center gap-1 text-xs text-emerald-700/70">
                <CheckCircle className="w-3 h-3" />
                <span>Successful conversions</span>
              </div>
            </CardContent>
          </Card>

          {/* Conversion Rate Card */}
          <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-amber-50 to-orange-100/50">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full blur-3xl" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
              <CardTitle className="text-xs xs:text-sm font-semibold text-amber-900/80">Conversion Rate</CardTitle>
              <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
            </CardHeader>
            <CardContent className="pt-0 relative z-10">
              <div className="text-3xl xs:text-4xl font-bold text-amber-900 mb-2">
                {stats.conversionRate}%
              </div>
              <div className="flex items-center gap-1 text-xs text-amber-700/70">
                <ArrowUpRight className="w-3 h-3" />
                <span>Lead to student</span>
              </div>
            </CardContent>
          </Card>

          {/* Today's Leads Card */}
          <Card className="group relative overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-300 bg-gradient-to-br from-purple-50 to-indigo-100/50">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-400/10 rounded-full blur-3xl" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
              <CardTitle className="text-xs xs:text-sm font-semibold text-purple-900/80">Today's Leads</CardTitle>
              <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                <Calendar className="w-5 h-5 text-white" />
              </div>
            </CardHeader>
            <CardContent className="pt-0 relative z-10">
              <div className="text-3xl xs:text-4xl font-bold text-purple-900 mb-2">
                {stats.todayLeads}
              </div>
              <div className="flex items-center gap-1 text-xs text-purple-700/70">
                <Zap className="w-3 h-3" />
                <span>New today</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Website inquiry flash — visible for 24 hours only, no extra Firebase reads */}
        {recentWebsiteInquiries.length > 0 && (
          <div className="mb-6 xs:mb-8 sm:mb-10">
            <Card className="border-2 border-indigo-300 shadow-xl bg-gradient-to-br from-indigo-50 via-blue-50/80 to-sky-50/50 overflow-hidden animate-pulse [animation-duration:3s]">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-sky-500" />
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-3 text-gray-900 text-lg xs:text-xl font-bold">
                    <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl shadow-lg">
                      <Globe className="w-6 h-6 text-white" />
                    </div>
                    <span>Lead Received from Website</span>
                    <Badge className="bg-indigo-600 text-white px-3 py-1 text-sm font-semibold flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      {recentWebsiteInquiries.length}
                    </Badge>
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/leads")}
                    className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                  >
                    View in Leads
                    <ArrowUpRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
                <p className="text-sm text-indigo-700/80 mt-1">
                  New website submissions from the last 24 hours. Older enquiries stay in the Leads table only.
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 xs:gap-5">
                  {recentWebsiteInquiries.slice(0, 6).map((lead) => {
                    const receivedAt = getWebsiteEnquiryReceivedAt(lead as unknown as LeadRecord);
                    return (
                      <div
                        key={lead.id}
                        className="group relative bg-white rounded-xl p-4 border-2 border-indigo-200 shadow-md hover:shadow-xl hover:border-indigo-400 transition-all duration-300 hover:-translate-y-1"
                      >
                        <div className="absolute top-3 right-3">
                          <div className="p-1.5 bg-indigo-100 rounded-full">
                            <Globe className="w-4 h-4 text-indigo-600" />
                          </div>
                        </div>
                        <div className="flex items-start justify-between mb-3 pr-10">
                          <h4 className="font-bold text-gray-900 text-sm sm:text-base font-heading flex-1 line-clamp-1">
                            {lead.leadName}
                          </h4>
                        </div>
                        <div className="space-y-2 text-xs sm:text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <div className="p-1 bg-blue-100 rounded">
                              <UserPlus className="w-3 h-3 text-blue-600" />
                            </div>
                            <span className="truncate">{lead.contact || "No phone"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="p-1 bg-emerald-100 rounded">
                              <Mail className="w-3 h-3 text-emerald-600" />
                            </div>
                            <span className="truncate">{lead.emailId || "No email"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="p-1 bg-purple-100 rounded">
                              <BookOpen className="w-3 h-3 text-purple-600" />
                            </div>
                            <span className="truncate">{lead.course || "Course not specified"}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-indigo-100">
                          <Badge className="text-xs px-2 py-1 bg-indigo-600 text-white border-0">
                            Website Inquiry
                          </Badge>
                          <span className="text-[11px] text-indigo-600">
                            {receivedAt
                              ? receivedAt.toLocaleString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Just now"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Hot Leads */}
        {hotLeadsList.length > 0 && (
          <div className="mb-6 xs:mb-8 sm:mb-10">
            {hotLeadsList.length > 0 && (
              <Card className="border-2 border-orange-300 shadow-xl bg-gradient-to-br from-orange-50 via-red-50/50 to-amber-50/50 overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-red-500 to-amber-500" />
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-3 text-gray-900 text-lg xs:text-xl font-bold">
                      <div className="p-2.5 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl shadow-lg">
                        <Flame className="w-6 h-6 text-white" />
                      </div>
                      <span>Hot Leads</span>
                      <Badge className="bg-orange-500 text-white px-3 py-1 text-sm font-semibold flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5" />
                        {hotLeadsList.length}
                      </Badge>
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate("/leads")}
                      className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                    >
                      View All
                      <ArrowUpRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 xs:gap-5">
                    {hotLeadsList.slice(0, 4).map((lead) => (
                      <div
                        key={lead.id}
                        className="group relative bg-white rounded-xl p-4 border-2 border-orange-200 shadow-md hover:shadow-xl hover:border-orange-400 transition-all duration-300 hover:-translate-y-1"
                      >
                        <div className="absolute top-3 right-3">
                          <div className="p-1.5 bg-orange-100 rounded-full">
                            <Flame className="w-4 h-4 text-orange-600" />
                          </div>
                        </div>
                        <div className="flex items-start justify-between mb-3 pr-10">
                          <h4 className="font-bold text-gray-900 text-sm sm:text-base font-heading flex-1 line-clamp-1">
                            {lead.leadName}
                          </h4>
                        </div>
                        <div className="space-y-2 text-xs sm:text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <div className="p-1 bg-blue-100 rounded">
                              <UserPlus className="w-3 h-3 text-blue-600" />
                            </div>
                            <span className="truncate">{lead.contact}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="p-1 bg-purple-100 rounded">
                              <BookOpen className="w-3 h-3 text-purple-600" />
                            </div>
                            <span className="truncate">{lead.course}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-orange-100">
                          <Badge className="text-xs px-2 py-1 bg-orange-500 text-white border-0 flex items-center gap-1">
                            <Flame className="w-3 h-3" />
                            Hot Lead
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate("/leads")}
                            className="h-7 px-3 text-xs hover:bg-orange-50 text-orange-700"
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            View
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Today's Leads Section - Enhanced */}
        {stats.todayLeads > 0 && (
          <Card className="mb-6 xs:mb-8 sm:mb-10 border-0 shadow-xl bg-gradient-to-br from-white to-emerald-50/30 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400" />
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 text-gray-900 text-lg xs:text-xl font-bold">
                  <div className="p-2 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl shadow-lg">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <span>Today's New Leads</span>
                  <Badge className="bg-emerald-500 text-white px-3 py-1 text-sm font-semibold">
                    {stats.todayLeads}
                  </Badge>
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate("/leads")}
                  className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                >
                  View All
                  <ArrowUpRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 xs:gap-5">
                {todayLeads.slice(0, 6).map((lead) => {
                  const isHotLead = lead.status === "Hot Lead";
                  return (
                  <div 
                    key={lead.id} 
                    className={`group relative rounded-xl p-4 border shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1 ${
                      isHotLead 
                        ? "bg-gradient-to-br from-orange-50 to-red-50/50 border-2 border-orange-300" 
                        : "bg-white border-gray-200"
                    }`}
                  >
                    {isHotLead && (
                      <div className="absolute top-3 right-3">
                        <div className="p-1.5 bg-orange-100 rounded-full">
                          <Flame className="w-4 h-4 text-orange-600" />
                        </div>
                      </div>
                    )}
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-bold text-gray-900 text-sm sm:text-base font-heading flex-1 mr-2 line-clamp-1">
                        {lead.leadName}
                      </h4>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isHotLead && <Flame className="w-4 h-4 text-orange-500" />}
                        <Badge className={isHotLead ? "bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full" : "bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full"}>
                          {isHotLead ? "Hot" : "Other"}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-2 text-xs sm:text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-blue-100 rounded">
                          <UserPlus className="w-3 h-3 text-blue-600" />
                        </div>
                        <span className="truncate">{lead.contact}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-purple-100 rounded">
                          <BookOpen className="w-3 h-3 text-purple-600" />
                        </div>
                        <span className="truncate">{lead.course}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-orange-100 rounded">
                          <Users className="w-3 h-3 text-orange-600" />
                        </div>
                        <span className="truncate">{lead.counselorName}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                      <Badge 
                        variant="outline" 
                        className={`text-xs px-2 py-1 flex items-center gap-1 ${
                          lead.status === "Hot Lead" ? "border-orange-400 text-orange-700 bg-orange-50" :
                          lead.status === "Warm Lead" ? "border-orange-300 text-orange-700 bg-orange-50" :
                          "border-blue-300 text-blue-700 bg-blue-50"
                        }`}
                      >
                        {isHotLead && <Flame className="w-3 h-3" />}
                        {lead.status}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/leads`)}
                        className="h-7 px-3 text-xs hover:bg-gray-100"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        View
                      </Button>
                    </div>
                  </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Students Section for Higher Roles */}
        {(userProfile?.role === "centre_head" || userProfile?.role === "director") && recentStudents.length > 0 && (
          <Card className="mt-6 sm:mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-green-600" />
                Recent Students
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentStudents.map((student) => (
                  <div key={student.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{student.name}</h4>
                      <Badge className="bg-green-500 text-white text-xs">Enrolled</Badge>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p>📚 {student.course}</p>
                      <p>📅 {student.admissionDate?.toDate ? student.admissionDate.toDate().toLocaleDateString() : "N/A"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}