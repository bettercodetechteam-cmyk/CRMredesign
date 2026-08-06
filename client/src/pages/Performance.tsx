import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { performanceApi } from "@/lib/apiService";
import { InlineLoading } from "@/components/ui/loading";
import { useAuth } from "@/hooks/useAuth";
import { sourceManagerEvents } from "@/lib/sourceManager";
import { useLeadsStore } from "@/hooks/useCentreData";
import { usePageLoadingSignal } from "@/contexts/NavigationLoadingContext";
import { 
  CustomPieChart, 
  CustomBarChart
} from "@/components/ui/chart";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Bar,
  BarChart,
  Area,
  AreaChart
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown,
  Users, 
  DollarSign, 
  Target,
  Calendar,
  Clock,
  Activity,
  Zap,
  Award,
  BarChart3,
  PieChart,
  LineChart as LineChartIcon,
  Download,
  Filter,
  RefreshCw,
  BookOpen
} from "lucide-react";

// Mock data for performance metrics
const mockPerformanceData = {
  // Conversion Metrics
  conversionMetrics: {
    totalLeads: 581,
    convertedLeads: 127,
    conversionRate: 21.9,
    hotLeads: 89,
    warmLeads: 156,
    coldLeads: 336,
    avgConversionTime: 14.5, // days
    targetConversionRate: 25.0
  },
  
  // Revenue Performance
  revenueMetrics: {
    totalRevenue: 2450000,
    monthlyRevenue: 320000,
    revenueGrowth: 12.5,
    avgRevenuePerLead: 4200,
    revenueBySource: [
      { source: "Direct", revenue: 1200000, percentage: 49.0 },
      { source: "Referral", revenue: 735000, percentage: 30.0 },
      { source: "Just Dial", revenue: 367500, percentage: 15.0 },
      { source: "Other", revenue: 147500, percentage: 6.0 }
    ]
  },
  
  // Staff Performance
  staffMetrics: {
    totalStaff: 12,
    activeStaff: 11,
    avgResponseTime: 2.3, // hours
    avgFollowUps: 3.2,
    staffProductivity: [
      { name: "John Doe", leads: 45, conversions: 12, rate: 26.7 },
      { name: "Jane Smith", leads: 38, conversions: 15, rate: 39.5 },
      { name: "Mike Johnson", leads: 52, conversions: 18, rate: 34.6 },
      { name: "Sarah Wilson", leads: 41, conversions: 14, rate: 34.1 },
      { name: "David Brown", leads: 35, conversions: 11, rate: 31.4 }
    ]
  },
  
  // Lead Performance by Source
  leadSourcePerformance: [
    { source: "Website", leads: 156, conversions: 34, rate: 21.8 },
    { source: "Referral", leads: 89, conversions: 28, rate: 31.5 },
    { source: "Social Media", leads: 67, conversions: 18, rate: 26.9 },
    { source: "Just Dial", leads: 45, conversions: 15, rate: 33.3 },
    { source: "Walk-in", leads: 78, conversions: 22, rate: 28.2 },
    { source: "Other", leads: 146, conversions: 10, rate: 6.8 }
  ],
  
  // Monthly Trends
  monthlyTrends: [
    { month: "Jan", leads: 45, conversions: 12, revenue: 280000 },
    { month: "Feb", leads: 52, conversions: 15, revenue: 320000 },
    { month: "Mar", leads: 48, conversions: 14, revenue: 310000 },
    { month: "Apr", leads: 61, conversions: 18, revenue: 380000 },
    { month: "May", leads: 55, conversions: 16, revenue: 350000 },
    { month: "Jun", leads: 67, conversions: 20, revenue: 420000 },
    { month: "Jul", leads: 73, conversions: 22, revenue: 450000 },
    { month: "Aug", leads: 69, conversions: 21, revenue: 430000 },
    { month: "Sep", leads: 58, conversions: 17, revenue: 360000 },
    { month: "Oct", leads: 62, conversions: 19, revenue: 390000 },
    { month: "Nov", leads: 71, conversions: 23, revenue: 460000 },
    { month: "Dec", leads: 76, conversions: 25, revenue: 490000 }
  ],
  
  // Course Performance
  coursePerformance: [
    { course: "ZICA", leads: 234, conversions: 52, rate: 22.2, revenue: 1040000 },
    { course: "ZIMA", leads: 198, conversions: 45, rate: 22.7, revenue: 900000 },
    { course: "CA Foundation", leads: 89, conversions: 23, rate: 25.8, revenue: 345000 },
    { course: "CA Intermediate", leads: 60, conversions: 7, rate: 11.7, revenue: 165000 }
  ]
};

// Loading skeleton component
const PerformanceSkeleton = () => (
  <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="w-14 h-14 rounded-xl" />
          </div>
        </Card>
      ))}
    </div>
    
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i} className="p-6">
          <Skeleton className="h-6 w-48 mb-4" />
          <Skeleton className="h-64 w-full" />
        </Card>
      ))}
    </div>
  </div>
);

export default function Performance() {
  const navigate = useNavigate();
  const [selectedPeriod, setSelectedPeriod] = useState("monthly");
  const [selectedMetric, setSelectedMetric] = useState("conversion");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const { leads: storeLeads, loading: dataLoading } = useLeadsStore();
  usePageLoadingSignal(dataLoading);

  const leadsData = storeLeads as Array<{
    id: string;
    status?: string;
    source?: string;
    createdAt?: Date | string;
    counselorName?: string;
  }>;

  // Listen for source updates from other components
  useEffect(() => {
    const unsubscribe = sourceManagerEvents.subscribe((event) => {
      console.log('📊 Performance: Source update received:', event.detail);
      // Refresh data when a new source is added
      if (event.detail.newSource) {
        console.log('🔄 Refreshing performance data due to new source:', event.detail.newSource);
        // The performance data will automatically update since it's calculated from leads data
      }
    });

    return unsubscribe;
  }, []);

  // Calculate performance data from real leads
  const performanceData = useMemo(() => {
    if (!leadsData.length) return mockPerformanceData;

    const totalLeads = leadsData.length;
    const convertedLeads = leadsData.filter(lead => 
      lead.status === 'Converted' || 
      lead.status === 'Done' || 
      lead.status === 'Admission Done' ||
      lead.status === 'Admitted' ||
      lead.status === 'Completed'
    ).length;
    
    // Helper function to check if a lead is converted
    const isLeadConverted = (lead: any) => {
      return lead.status === 'Converted' || 
             lead.status === 'Done' || 
             lead.status === 'Admission Done' ||
             lead.status === 'Admitted' ||
             lead.status === 'Completed';
    };
    
    const hotLeads = leadsData.filter(lead => lead.status === 'Hot Lead').length;
    const warmLeads = leadsData.filter(lead => lead.status === 'Warm Lead').length;
    const coldLeads = leadsData.filter(lead => lead.status === 'Cold Lead').length;
    
    const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100) : 0;
    
    // Calculate revenue data (mock for now, should come from actual fee data)
    const totalRevenue = convertedLeads * 4200; // Average revenue per conversion
    const monthlyRevenue = totalRevenue / 12; // Simplified monthly calculation
    
    // Calculate source performance
    const sourceStats = leadsData.reduce((acc, lead) => {
      const source = lead.source || 'Other';
      if (!acc[source]) {
        acc[source] = { total: 0, converted: 0 };
      }
      acc[source].total++;
      if (isLeadConverted(lead)) {
        acc[source].converted++;
      }
      return acc;
    }, {} as Record<string, { total: number; converted: number }>);

    const leadSourcePerformance = Object.entries(sourceStats).map(([source, stats]) => ({
      source,
      leads: stats.total,
      conversions: stats.converted,
      rate: stats.total > 0 ? ((stats.converted / stats.total) * 100) : 0
    }));

    // Calculate monthly trends
    const monthlyTrends = leadsData.reduce((acc, lead) => {
      const date = lead.createdAt ? new Date(lead.createdAt) : new Date();
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!acc[monthKey]) {
        acc[monthKey] = { leads: 0, conversions: 0, revenue: 0 };
      }
      
      acc[monthKey].leads++;
      if (isLeadConverted(lead)) {
        acc[monthKey].conversions++;
        acc[monthKey].revenue += 4200; // Average revenue per conversion
      }
      
      return acc;
    }, {} as Record<string, { leads: number; conversions: number; revenue: number }>);

    return {
      conversionMetrics: {
        totalLeads,
        convertedLeads,
        conversionRate: parseFloat(conversionRate.toFixed(1)),
        hotLeads,
        warmLeads,
        coldLeads,
        avgConversionTime: 14.5, // Mock data
        targetConversionRate: 25.0
      },
      revenueMetrics: {
        totalRevenue,
        monthlyRevenue,
        revenueGrowth: 12.5, // Mock data
        avgRevenuePerLead: totalLeads > 0 ? (totalRevenue / totalLeads) : 0,
        revenueBySource: [
          { source: "Direct", revenue: totalRevenue * 0.49, percentage: 49.0 },
          { source: "Referral", revenue: totalRevenue * 0.30, percentage: 30.0 },
          { source: "Online", revenue: totalRevenue * 0.15, percentage: 15.0 },
          { source: "Other", revenue: totalRevenue * 0.06, percentage: 6.0 }
        ]
      },
      staffMetrics: {
        totalStaff: 12,
        activeStaff: 11,
        avgResponseTime: 2.3,
        avgFollowUps: 3.2,
        staffProductivity: [
          { name: "John Doe", leads: 45, conversions: 12, rate: 26.7 },
          { name: "Jane Smith", leads: 38, conversions: 15, rate: 39.5 },
          { name: "Mike Johnson", leads: 52, conversions: 18, rate: 34.6 },
          { name: "Sarah Wilson", leads: 41, conversions: 14, rate: 34.1 },
          { name: "David Brown", leads: 35, conversions: 11, rate: 31.4 }
        ]
      },
      leadSourcePerformance,
      monthlyTrends: Object.entries(monthlyTrends).map(([month, data]) => ({
        month,
        leads: data.leads,
        conversions: data.conversions,
        revenue: data.revenue
      })),
      coursePerformance: [
        { course: "ZICA", leads: 234, conversions: 52, rate: 22.2, revenue: 1040000 },
        { course: "ZIMA", leads: 198, conversions: 45, rate: 22.7, revenue: 900000 },
        { course: "CA Foundation", leads: 89, conversions: 23, rate: 25.8, revenue: 345000 },
        { course: "CA Intermediate", leads: 60, conversions: 7, rate: 11.7, revenue: 165000 }
      ]
    };
  }, [leadsData]);

  // Process data for charts
  const conversionData = [
    { name: "Converted", value: performanceData.conversionMetrics.convertedLeads, color: "#10B981" },
    { name: "Hot Leads", value: performanceData.conversionMetrics.hotLeads, color: "#F59E0B" },
    { name: "Warm Leads", value: performanceData.conversionMetrics.warmLeads, color: "#3B82F6" },
    { name: "Cold Leads", value: performanceData.conversionMetrics.coldLeads, color: "#6B7280" }
  ];

  const revenueSourceData = performanceData.revenueMetrics.revenueBySource.map(item => ({
    name: item.source,
    value: item.revenue,
    color: item.source === "Direct" ? "#10B981" : 
           item.source === "Referral" ? "#3B82F6" : 
           item.source === "Online" ? "#F59E0B" : "#6B7280"
  }));

  const leadSourceData = performanceData.leadSourcePerformance.map(item => ({
    name: item.source,
    value: item.conversions,
    rate: item.rate,
    color: item.rate > 30 ? "#10B981" : item.rate > 20 ? "#F59E0B" : "#6B7280"
  }));

  const courseData = performanceData.coursePerformance.map(item => ({
    name: item.course,
    value: item.conversions,
    rate: item.rate,
    revenue: item.revenue,
    color: item.rate > 25 ? "#10B981" : item.rate > 20 ? "#F59E0B" : "#6B7280"
  }));

  const staffData = performanceData.staffMetrics.staffProductivity.map(item => ({
    name: item.name,
    value: item.conversions,
    rate: item.rate,
    leads: item.leads,
    color: item.rate > 35 ? "#10B981" : item.rate > 25 ? "#F59E0B" : "#6B7280"
  }));

  const monthlyData = performanceData.monthlyTrends.map(item => ({
    month: item.month,
    leads: item.leads,
    conversions: item.conversions,
    revenue: item.revenue,
    conversionRate: ((item.conversions / item.leads) * 100).toFixed(1)
  }));

  const exportPerformanceReport = async () => {
    setIsLoading(true);
    try {
      const csvContent = [
        ["Metric", "Value"],
        ["Total Leads", performanceData.conversionMetrics.totalLeads],
        ["Converted Leads", performanceData.conversionMetrics.convertedLeads],
        ["Conversion Rate", `${performanceData.conversionMetrics.conversionRate}%`],
        ["Total Revenue", `₹${performanceData.revenueMetrics.totalRevenue.toLocaleString()}`],
        ["Monthly Revenue", `₹${performanceData.revenueMetrics.monthlyRevenue.toLocaleString()}`],
        ["Revenue Growth", `${performanceData.revenueMetrics.revenueGrowth}%`],
        ["Average Revenue per Lead", `₹${performanceData.revenueMetrics.avgRevenuePerLead.toLocaleString()}`],
        ["Average Conversion Time", `${performanceData.conversionMetrics.avgConversionTime} days`],
        ["Staff Productivity", `${performanceData.staffMetrics.avgResponseTime} hours avg response time`]
      ].map(row => row.join(",")).join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "performance_report.csv";
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast({ title: "Success", description: "Performance report exported successfully!" });
    } catch (error) {
      console.error("Export failed:", error);
      toast({ 
        title: "Error", 
        description: "Failed to export report. Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading skeleton if data is not ready
  if (dataLoading || !performanceData) {
    return <PerformanceSkeleton />;
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Performance Analytics</h1>
          <p className="text-sm sm:text-base text-gray-600">Comprehensive performance metrics and insights</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={() => window.location.reload()} 
            variant="outline"
            className="w-full sm:w-auto"
            disabled={dataLoading}
          >
            {dataLoading ? <InlineLoading size="sm" color="primary" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Refresh
          </Button>
          <Button 
            onClick={exportPerformanceReport} 
            className="w-full sm:w-auto"
            disabled={isLoading}
          >
            <Download className="w-4 h-4 mr-2" />
            {isLoading ? "Exporting..." : "Export Report"}
          </Button>
        </div>
      </div>

      {/* Performance Summary */}
      <Card className="shadow-lg border-0 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Performance Summary</h3>
            <Badge variant="outline" className="text-xs">
              {selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)} View
            </Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="text-center">
              <p className="text-gray-600">Target Conversion</p>
              <p className="text-2xl font-bold text-blue-600">25%</p>
            </div>
            <div className="text-center">
              <p className="text-gray-600">Current Rate</p>
              <p className="text-2xl font-bold text-green-600">{performanceData.conversionMetrics.conversionRate}%</p>
            </div>
            <div className="text-center">
              <p className="text-gray-600">Gap to Target</p>
              <p className="text-2xl font-bold text-orange-600">
                {(25 - performanceData.conversionMetrics.conversionRate).toFixed(1)}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-gray-600">Performance</p>
              <p className="text-2xl font-bold text-purple-600">
                {((performanceData.conversionMetrics.conversionRate / 25) * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600 uppercase tracking-wide">Conversion Rate</p>
                <p className="text-3xl font-bold text-green-900 mt-1">{performanceData.conversionMetrics.conversionRate}%</p>
                <div className="flex items-center mt-1">
                  <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                  <p className="text-xs text-green-500">+2.1% vs last month</p>
                </div>
              </div>
              <div className="w-14 h-14 bg-green-500 rounded-xl flex items-center justify-center shadow-lg">
                <Target className="w-7 h-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 uppercase tracking-wide">Total Revenue</p>
                <p className="text-3xl font-bold text-blue-900 mt-1">₹{(performanceData.revenueMetrics.totalRevenue / 100000).toFixed(1)}L</p>
                <div className="flex items-center mt-1">
                  <TrendingUp className="w-4 h-4 text-blue-600 mr-1" />
                  <p className="text-xs text-blue-500">+{performanceData.revenueMetrics.revenueGrowth}% growth</p>
                </div>
              </div>
              <div className="w-14 h-14 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg">
                <DollarSign className="w-7 h-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600 uppercase tracking-wide">Avg Response Time</p>
                <p className="text-3xl font-bold text-purple-900 mt-1">{performanceData.staffMetrics.avgResponseTime}h</p>
                <div className="flex items-center mt-1">
                  <Clock className="w-4 h-4 text-purple-600 mr-1" />
                  <p className="text-xs text-purple-500">Staff efficiency</p>
                </div>
              </div>
              <div className="w-14 h-14 bg-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                <Activity className="w-7 h-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600 uppercase tracking-wide">Hot Leads</p>
                <p className="text-3xl font-bold text-orange-900 mt-1">{performanceData.conversionMetrics.hotLeads}</p>
                <div className="flex items-center mt-1">
                  <Zap className="w-4 h-4 text-orange-600 mr-1" />
                  <p className="text-xs text-orange-500">High priority leads</p>
                </div>
              </div>
              <div className="w-14 h-14 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                <Zap className="w-7 h-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 gap-1 p-1 bg-gray-100 rounded-lg">
          <TabsTrigger value="overview" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium px-3 py-2.5 rounded-md transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-md data-[state=active]:font-semibold hover:bg-gray-50 hover:shadow-sm">
            <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Overview</span>
            <span className="sm:hidden">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="conversion" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium px-3 py-2.5 rounded-md transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-green-600 data-[state=active]:shadow-md data-[state=active]:font-semibold hover:bg-gray-50 hover:shadow-sm">
            <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Conversion</span>
            <span className="sm:hidden">Conversion</span>
          </TabsTrigger>
          <TabsTrigger value="revenue" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium px-3 py-2.5 rounded-md transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-md data-[state=active]:font-semibold hover:bg-gray-50 hover:shadow-sm">
            <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Revenue</span>
            <span className="sm:hidden">Revenue</span>
          </TabsTrigger>
          <TabsTrigger value="staff" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium px-3 py-2.5 rounded-md transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-md data-[state=active]:font-semibold hover:bg-gray-50 hover:shadow-sm">
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Staff</span>
            <span className="sm:hidden">Staff</span>
          </TabsTrigger>
          <TabsTrigger value="trends" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium px-3 py-2.5 rounded-md transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-md data-[state=active]:font-semibold hover:bg-gray-50 hover:shadow-sm">
            <LineChartIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Trends</span>
            <span className="sm:hidden">Trends</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-lg border-0 bg-white hover:shadow-xl transition-all duration-300">
              <CardHeader className="border-b border-gray-100">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <Target className="w-4 h-4 text-green-600" />
                  </div>
                  Lead Conversion Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <CustomPieChart
                  data={conversionData}
                  height={300}
                  showLegend={true}
                  showLabels={true}
                  labelType="percentage"
                />
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0 bg-white hover:shadow-xl transition-all duration-300">
              <CardHeader className="border-b border-gray-100">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-blue-600" />
                  </div>
                  Revenue by Source
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <CustomPieChart
                  data={revenueSourceData}
                  height={300}
                  showLegend={true}
                  showLabels={true}
                  labelType="percentage"
                />
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-lg border-0 bg-white hover:shadow-xl transition-all duration-300">
            <CardHeader className="border-b border-gray-100">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-purple-600" />
                </div>
                Monthly Performance Trends
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
                  <YAxis yAxisId="left" stroke="#6b7280" fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" stroke="#6b7280" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="leads" 
                    stroke="#3B82F6" 
                    fill="#3B82F6" 
                    fillOpacity={0.3}
                    yAxisId="left"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="conversions" 
                    stroke="#10B981" 
                    fill="#10B981" 
                    fillOpacity={0.3}
                    yAxisId="left"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#F59E0B" 
                    strokeWidth={3}
                    yAxisId="right"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Conversion Tab */}
        <TabsContent value="conversion" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-lg border-0 bg-white hover:shadow-xl transition-all duration-300">
              <CardHeader className="border-b border-gray-100">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <Target className="w-4 h-4 text-green-600" />
                  </div>
                  Lead Source Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <CustomBarChart
                  data={leadSourceData}
                  height={300}
                  color="#10B981"
                />
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0 bg-white hover:shadow-xl transition-all duration-300">
              <CardHeader className="border-b border-gray-100">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-blue-600" />
                  </div>
                  Course Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <CustomBarChart
                  data={courseData}
                  height={300}
                  color="#3B82F6"
                />
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-lg border-0 bg-white hover:shadow-xl transition-all duration-300">
            <CardHeader className="border-b border-gray-100">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Award className="w-4 h-4 text-purple-600" />
                </div>
                Conversion Rate Comparison
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                {leadSourceData.map((item, index) => (
                  <div key={item.name} className="text-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200">
                    <div className="text-3xl font-bold mb-2" style={{ color: item.color }}>
                      {item.rate}%
                    </div>
                    <div className="text-sm font-medium text-gray-700">{item.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{item.value} conversions</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-lg border-0 bg-white hover:shadow-xl transition-all duration-300">
              <CardHeader className="border-b border-gray-100">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-green-600" />
                  </div>
                  Revenue Trends
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
                    <YAxis stroke="#6b7280" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={3} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="shadow-lg border-0 bg-white hover:shadow-xl transition-all duration-300">
              <CardHeader className="border-b border-gray-100">
                <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                  </div>
                  Revenue Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span className="text-sm font-medium text-green-700">Total Revenue</span>
                    <span className="text-lg font-bold text-green-900">₹{(performanceData.revenueMetrics.totalRevenue / 100000).toFixed(1)}L</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm font-medium text-blue-700">Monthly Revenue</span>
                    <span className="text-lg font-bold text-blue-900">₹{(performanceData.revenueMetrics.monthlyRevenue / 1000).toFixed(0)}K</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                    <span className="text-sm font-medium text-purple-700">Avg Revenue per Lead</span>
                    <span className="text-lg font-bold text-purple-900">₹{performanceData.revenueMetrics.avgRevenuePerLead.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                    <span className="text-sm font-medium text-orange-700">Growth Rate</span>
                    <span className="text-lg font-bold text-orange-900">+{performanceData.revenueMetrics.revenueGrowth}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Staff Tab */}
        <TabsContent value="staff" className="space-y-6">
          <Card className="shadow-lg border-0 bg-white hover:shadow-xl transition-all duration-300">
            <CardHeader className="border-b border-gray-100">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Users className="w-4 h-4 text-purple-600" />
                </div>
                Staff Performance Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Staff Member</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">Total Leads</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">Conversions</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">Conversion Rate</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-700">Performance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffData.map((staff, index) => (
                      <tr key={staff.name} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 font-medium text-gray-900">{staff.name}</td>
                        <td className="py-3 px-4 text-center text-gray-700">{staff.leads}</td>
                        <td className="py-3 px-4 text-center text-gray-700">{staff.value}</td>
                        <td className="py-3 px-4 text-center">
                          <Badge 
                            variant={staff.rate > 35 ? "default" : staff.rate > 25 ? "secondary" : "destructive"}
                            className="font-medium"
                          >
                            {staff.rate}%
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="h-2 rounded-full" 
                              style={{ 
                                width: `${Math.min(staff.rate, 100)}%`,
                                backgroundColor: staff.color 
                              }}
                            ></div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-6">
          <Card className="shadow-lg border-0 bg-white hover:shadow-xl transition-all duration-300">
            <CardHeader className="border-b border-gray-100">
              <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                </div>
                Performance Trends Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
                  <YAxis yAxisId="left" stroke="#6b7280" fontSize={12} />
                  <YAxis yAxisId="right" orientation="right" stroke="#6b7280" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="leads" 
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    yAxisId="left"
                    name="Leads"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="conversions" 
                    stroke="#10B981" 
                    strokeWidth={2}
                    yAxisId="left"
                    name="Conversions"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#F59E0B" 
                    strokeWidth={3}
                    yAxisId="right"
                    name="Revenue"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 