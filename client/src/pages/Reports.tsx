import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
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
  BarChart
} from "recharts";
import { 
  Download, 
  TrendingUp, 
  Users, 
  DollarSign, 
  BookOpen, 
  Calendar,
  FileText,
  Target,
  AlertCircle
} from "lucide-react";

// Mock data for development - replace with actual API calls
const mockDashboardStats = {
  totalStudents: 156,
  activeStudents: 142,
  totalRevenue: 2450000,
  pendingFees: 180000,
  newEnquiries: 23,
  conversions: 8
};

const mockStudents = [
  { id: 1, course: "ZICA", status: "active" },
  { id: 2, course: "ZICA", status: "active" },
  { id: 3, course: "ZICA", status: "active" },
  { id: 4, course: "ZICA", status: "inactive" },
  { id: 5, course: "ZICA", status: "active" },
  { id: 6, course: "ZICA", status: "active" },
  { id: 7, course: "ZICA", status: "active" },
  { id: 8, course: "ZICA", status: "active" }
];

const mockFeeTransactions = [
  { id: 1, amount: 50000, status: "paid", paidDate: "2024-01-15" },
  { id: 2, amount: 75000, status: "paid", paidDate: "2024-01-20" },
  { id: 3, amount: 60000, status: "pending", createdAt: "2024-01-25" },
  { id: 4, amount: 45000, status: "paid", paidDate: "2024-02-01" },
  { id: 5, amount: 80000, status: "paid", paidDate: "2024-02-05" },
  { id: 6, amount: 55000, status: "pending", createdAt: "2024-02-10" }
];

const mockLeads = [
  { id: 1, status: "new" },
  { id: 2, status: "contacted" },
  { id: 3, status: "qualified" },
  { id: 4, status: "converted" },
  { id: 5, status: "new" },
  { id: 6, status: "contacted" },
  { id: 7, status: "qualified" },
  { id: 8, status: "lost" }
];

const mockExpenses = [
  { id: 1, category: "Rent", amount: 50000 },
  { id: 2, category: "Salaries", amount: 150000 },
  { id: 3, category: "Utilities", amount: 25000 },
  { id: 4, category: "Marketing", amount: 30000 },
  { id: 5, category: "Equipment", amount: 45000 },
  { id: 6, category: "Other", amount: 15000 }
];

// Loading skeleton component
const ReportSkeleton = () => (
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

export default function Reports() {
  const [reportType, setReportType] = useState("overview");
  const [dateRange, setDateRange] = useState("30");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Use mock data for now - replace with actual API calls when backend is ready
  const dashboardStats = mockDashboardStats;
  const students = mockStudents;
  const feeTransactions = mockFeeTransactions;
  const leads = mockLeads;
  const expenses = mockExpenses;

  // Process data for charts with error handling
  const studentsByCourse = students.reduce((acc: any, student: any) => {
    const course = student.course || 'Unknown';
    acc[course] = (acc[course] || 0) + 1;
    return acc;
  }, {});

  const studentsCourseData = Object.entries(studentsByCourse).map(([course, count]) => ({
    name: course,
    value: count,
    students: count
  }));

  const feeStatusData = feeTransactions.reduce((acc: any, transaction: any) => {
    const status = transaction.status || 'unknown';
    const amount = parseFloat(transaction.amount) || 0;
    acc[status] = (acc[status] || 0) + amount;
    return acc;
  }, {});

  const feeChartData = Object.entries(feeStatusData).map(([status, amount]) => ({
    name: status,
    amount: amount
  }));

  const monthlyRevenue = feeTransactions
    .filter((t: any) => t.status === 'paid')
    .reduce((acc: any, transaction: any) => {
      const date = new Date(transaction.paidDate || transaction.createdAt);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const amount = parseFloat(transaction.amount) || 0;
      acc[month] = (acc[month] || 0) + amount;
      return acc;
    }, {});

  const revenueData = Object.entries(monthlyRevenue).map(([month, revenue]) => ({
    month,
    revenue
  }));

  const leadConversionData = leads.reduce((acc: any, lead: any) => {
    const status = lead.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const conversionChartData = Object.entries(leadConversionData).map(([status, count]) => ({
    name: status,
    value: count
  }));

  const expensesByCategory = expenses.reduce((acc: any, expense: any) => {
    const category = expense.category || 'Other';
    const amount = parseFloat(expense.amount) || 0;
    acc[category] = (acc[category] || 0) + amount;
    return acc;
  }, {});

  const expenseData = Object.entries(expensesByCategory).map(([category, amount]) => ({
    name: category,
    value: amount
  }));

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  const exportReport = async (type: string) => {
    setIsLoading(true);
    try {
      let csvContent = "";
      let filename = "";

      switch (type) {
        case "students":
          csvContent = [
            ["Course", "Student Count"],
            ...Object.entries(studentsByCourse).map(([course, count]) => [course, count])
          ].map(row => row.join(",")).join("\n");
          filename = "students_report.csv";
          break;
        case "revenue":
          csvContent = [
            ["Month", "Revenue"],
            ...Object.entries(monthlyRevenue).map(([month, revenue]) => [month, revenue])
          ].map(row => row.join(",")).join("\n");
          filename = "revenue_report.csv";
          break;
        case "expenses":
          csvContent = [
            ["Category", "Amount"],
            ...Object.entries(expensesByCategory).map(([category, amount]) => [category, amount])
          ].map(row => row.join(",")).join("\n");
          filename = "expenses_report.csv";
          break;
        default:
          csvContent = [
            ["Metric", "Value"],
            ["Total Students", dashboardStats?.totalStudents || 0],
            ["Active Students", dashboardStats?.activeStudents || 0],
            ["Total Revenue", dashboardStats?.totalRevenue || 0],
            ["Pending Fees", dashboardStats?.pendingFees || 0],
            ["New Enquiries", dashboardStats?.newEnquiries || 0],
            ["Conversions", dashboardStats?.conversions || 0]
          ].map(row => row.join(",")).join("\n");
          filename = "overview_report.csv";
      }

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast({ title: "Success", description: `${type} report exported successfully!` });
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
  if (!dashboardStats || !students || !feeTransactions) {
    return <ReportSkeleton />;
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-sm sm:text-base text-gray-600">Comprehensive insights and data analytics</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Report Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overview">Overview</SelectItem>
              <SelectItem value="students">Students</SelectItem>
              <SelectItem value="revenue">Revenue</SelectItem>
              <SelectItem value="expenses">Expenses</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={() => exportReport(reportType)} 
            className="w-full sm:w-auto"
            disabled={isLoading}
          >
            <Download className="w-4 h-4 mr-2" />
            {isLoading ? "Exporting..." : "Export Report"}
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 uppercase tracking-wide">Total Students</p>
                <p className="text-3xl font-bold text-blue-900 mt-1">{dashboardStats?.totalStudents || 0}</p>
                <p className="text-xs text-blue-500 mt-1">Enrolled students</p>
              </div>
              <div className="w-14 h-14 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg">
                <Users className="w-7 h-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600 uppercase tracking-wide">Total Revenue</p>
                <p className="text-3xl font-bold text-green-900 mt-1">₹{(dashboardStats?.totalRevenue || 0).toLocaleString()}</p>
                <p className="text-xs text-green-500 mt-1">Total earnings</p>
              </div>
              <div className="w-14 h-14 bg-green-500 rounded-xl flex items-center justify-center shadow-lg">
                <DollarSign className="w-7 h-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600 uppercase tracking-wide">New Enquiries</p>
                <p className="text-3xl font-bold text-yellow-900 mt-1">{dashboardStats?.newEnquiries || 0}</p>
                <p className="text-xs text-yellow-500 mt-1">Recent leads</p>
              </div>
              <div className="w-14 h-14 bg-yellow-500 rounded-xl flex items-center justify-center shadow-lg">
                <TrendingUp className="w-7 h-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600 uppercase tracking-wide">Conversions</p>
                <p className="text-3xl font-bold text-purple-900 mt-1">{dashboardStats?.conversions || 0}</p>
                <p className="text-xs text-purple-500 mt-1">Successful conversions</p>
              </div>
              <div className="w-14 h-14 bg-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                <Target className="w-7 h-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <Card className="shadow-lg border-0 bg-white hover:shadow-xl transition-all duration-300">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-blue-600" />
              </div>
              Students by Course
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {studentsCourseData.length > 0 ? (
              <CustomPieChart
                data={studentsCourseData}
                height={300}
                showLegend={true}
                showLabels={true}
                labelType="percentage"
              />
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <AlertCircle className="w-8 h-8 mr-2" />
                No student data available
              </div>
            )}
          </CardContent>
        </Card>

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
            {revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueData}>
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
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <AlertCircle className="w-8 h-8 mr-2" />
                No revenue data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg border-0 bg-white hover:shadow-xl transition-all duration-300">
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <FileText className="w-4 h-4 text-green-600" />
              </div>
              Expenses by Category
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {expenseData.length > 0 ? (
              <CustomBarChart
                data={expenseData}
                height={300}
                color="#ffc658"
              />
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                <AlertCircle className="w-8 h-8 mr-2" />
                No expense data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Lead Conversion Stats */}
      <Card className="shadow-lg border-0 bg-white hover:shadow-xl transition-all duration-300">
        <CardHeader className="border-b border-gray-100">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-orange-600" />
            </div>
            Lead Conversion Statistics
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {conversionChartData.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
              {conversionChartData.map((item, index) => (
                <div key={item.name} className="text-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200">
                  <div className="text-3xl font-bold mb-2" style={{ color: COLORS[index % COLORS.length] }}>
                    {item.value}
                  </div>
                  <div className="text-sm font-medium text-gray-700 capitalize">{item.name}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32 text-gray-500">
              <AlertCircle className="w-8 h-8 mr-2" />
              No lead conversion data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}