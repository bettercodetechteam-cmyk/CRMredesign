import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { useAppNavigate } from "@/hooks/useAppNavigate";
import { usePageLoadingSignal } from "@/contexts/NavigationLoadingContext";
import { useAuth } from "@/hooks/useAuth";
import {
  UserPlus,
  GraduationCap,
  Calendar,
  TrendingUp,
  RefreshCw,
  BookOpen,
  Users,
  Eye,
  Wifi,
  ArrowUpRight,
  Flame,
  IndianRupee,
  Receipt,
} from "lucide-react";
import Loading from "@/components/ui/loading";
import { nestDashboardApi } from "@/services/nest/dashboardApi";

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  interested: "Hot",
  visit_scheduled: "Visit scheduled",
  visited: "Visited",
  converted: "Converted",
  lost: "Lost",
};

export default function Dashboard() {
  const navigate = useAppNavigate();
  const { user, userProfile } = useAuth();

  const liveQuery = useQuery({
    queryKey: ["nest-dashboard-live"],
    queryFn: () => nestDashboardApi.live(),
    refetchInterval: 8_000,
    refetchOnWindowFocus: true,
    staleTime: 4_000,
  });

  usePageLoadingSignal(liveQuery.isLoading && !liveQuery.data);

  const live = liveQuery.data;
  const snapshot = live?.snapshot;
  const overview = live?.overview;

  if (liveQuery.isLoading && !live) {
    return <Loading fullScreen text="Loading dashboard..." color="primary" />;
  }

  if (liveQuery.isError && !live) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-lg font-semibold">Dashboard could not load</p>
        <p className="text-sm text-gray-600">
          {liveQuery.error instanceof Error ? liveQuery.error.message : "Check that you are signed in and the API is running."}
        </p>
        <Button onClick={() => liveQuery.refetch()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white px-4 sm:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-blue-100 mt-1">
              Welcome back, {user?.displayName || userProfile?.firstName || "User"}
            </p>
            <div className="flex gap-2 mt-3">
              <Badge className="bg-white/20 text-white border-white/30">{userProfile?.role ?? "staff"}</Badge>
              <Badge className="bg-emerald-500/20 text-white border-emerald-400/30">
                <Wifi className="w-3 h-3 mr-1" />
                Live · {live?.generatedAt ? new Date(live.generatedAt).toLocaleTimeString("en-IN") : "syncing"}
              </Badge>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={() => liveQuery.refetch()}
            disabled={liveQuery.isFetching}
            className="text-blue-700"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${liveQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="px-4 sm:px-8 py-8 space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard title="Total leads" value={snapshot?.totalLeads ?? 0} icon={UserPlus} tone="blue" hint="All-time enquiries" />
          <StatCard title="Active students" value={snapshot?.totalStudents ?? 0} icon={GraduationCap} tone="emerald" hint="Currently enrolled" />
          <StatCard title="Conversion" value={`${snapshot?.conversionRate ?? 0}%`} icon={TrendingUp} tone="amber" hint="In selected range" />
          <StatCard title="Today's leads" value={snapshot?.todayLeads ?? 0} icon={Calendar} tone="purple" hint="Created today" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard title="Collected" value={`₹${Number(snapshot?.totalRevenue ?? 0).toLocaleString("en-IN")}`} icon={IndianRupee} tone="emerald" hint="All recorded payments" />
          <StatCard title="Outstanding installments" value={snapshot?.outstandingInstallments ?? 0} icon={Receipt} tone="amber" hint="Pending / partial / overdue" />
          <StatCard title="Follow-ups due" value={snapshot?.pendingFollowUps ?? 0} icon={Users} tone="blue" hint="Open leads past follow-up time" />
        </div>

        {overview?.leads.funnel && (
          <Card>
            <CardHeader>
              <CardTitle>Lead funnel</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {overview.leads.funnel.map((row) => (
                <Badge key={row.status} variant="secondary" className="px-3 py-1">
                  {STATUS_LABEL[row.status] ?? row.status}: {row.count}
                </Badge>
              ))}
            </CardContent>
          </Card>
        )}

        {(live?.hotLeads.length ?? 0) > 0 && (
          <Card className="border-orange-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-600" />
                Hot leads
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/leads")}>
                View all <ArrowUpRight className="w-4 h-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {live?.hotLeads.map((lead) => (
                <LeadCard key={lead.id} name={lead.leadName} phone={lead.contact} course={lead.course} status="Hot" />
              ))}
            </CardContent>
          </Card>
        )}

        {(live?.todayLeads.length ?? 0) > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Today's new leads</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate("/leads")}>
                View all <ArrowUpRight className="w-4 h-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {live?.todayLeads.map((lead) => (
                <LeadCard
                  key={lead.id}
                  name={lead.leadName}
                  phone={lead.contact}
                  course={lead.course}
                  status={STATUS_LABEL[lead.status] ?? lead.status}
                />
              ))}
            </CardContent>
          </Card>
        )}

        {(live?.followUpsDue.length ?? 0) > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Follow-ups due</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {live?.followUpsDue.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                  <div>
                    <Link to={`/leads?leadId=${lead.id}`} className="font-medium text-blue-700 hover:underline">
                      {lead.leadName}
                    </Link>
                    <p className="text-xs text-gray-500">{lead.course || "No course"}</p>
                  </div>
                  <Badge variant="outline">
                    {lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt).toLocaleDateString("en-IN") : "Due"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-emerald-600" />
                Recent students
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(live?.recentStudents.length ?? 0) === 0 && <p className="text-sm text-gray-500">No students yet.</p>}
              {live?.recentStudents.map((student) => (
                <div key={student.id} className="border rounded-lg p-3">
                  <div className="flex justify-between">
                    <p className="font-medium">{student.name}</p>
                    <Badge>{student.rollNo}</Badge>
                  </div>
                  <p className="text-sm text-gray-600">{student.course}</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-600" />
                Recent receipts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(live?.recentPayments.length ?? 0) === 0 && <p className="text-sm text-gray-500">No payments yet.</p>}
              {live?.recentPayments.map((payment) => (
                <div key={payment.id} className="border rounded-lg p-3">
                  <div className="flex justify-between">
                    <p className="font-medium">{payment.studentName}</p>
                    <span>₹{payment.amount.toLocaleString("en-IN")}</span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {payment.receiptNo ?? "No receipt"} · {payment.rollNo}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  tone,
  hint,
}: {
  title: string;
  value: string | number;
  icon: typeof Users;
  tone: "blue" | "emerald" | "amber" | "purple";
  hint: string;
}) {
  const tones = {
    blue: "from-blue-50 to-blue-100/50 text-blue-900",
    emerald: "from-emerald-50 to-green-100/50 text-emerald-900",
    amber: "from-amber-50 to-orange-100/50 text-amber-900",
    purple: "from-purple-50 to-indigo-100/50 text-purple-900",
  };
  return (
    <Card className={`bg-gradient-to-br ${tones[tone]} border-0 shadow-md`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        <Icon className="w-5 h-5" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        <p className="text-xs opacity-70 mt-1">{hint}</p>
      </CardContent>
    </Card>
  );
}

function LeadCard({ name, phone, course, status }: { name: string; phone: string; course: string; status: string }) {
  const navigate = useAppNavigate();
  return (
    <div className="bg-white border rounded-xl p-4 shadow-sm">
      <div className="flex justify-between gap-2">
        <h4 className="font-semibold truncate">{name}</h4>
        <Badge>{status}</Badge>
      </div>
      <p className="text-sm text-gray-600 mt-2">{phone || "No phone"}</p>
      <p className="text-sm text-gray-600 flex items-center gap-1">
        <BookOpen className="w-3 h-3" />
        {course || "Course not set"}
      </p>
      <Button size="sm" variant="ghost" className="mt-2 h-7 px-2" onClick={() => navigate("/leads")}>
        <Eye className="w-3 h-3 mr-1" />
        View
      </Button>
    </div>
  );
}
