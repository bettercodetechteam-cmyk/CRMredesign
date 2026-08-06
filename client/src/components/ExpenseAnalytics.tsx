import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  BarChart3, 
  PieChart, 
  Calendar,
  DollarSign,
  CreditCard,
  Clock,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  FileText,
  Banknote,
  Smartphone
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

interface Expense {
  id: string;
  description: string;
  category: string;
  amount: number;
  paymentMode: string;
  expenseDate: string;
  paidBy: string;
  otherPersonName?: string;
  isReimbursement: boolean;
  reimbursementStatus: 'pending' | 'approved' | 'reimbursed';
  createdAt: Timestamp;
}

interface ExpenseAnalyticsProps {
  expenses?: Expense[]; // Made optional with default fallback
}

const ExpenseAnalytics: React.FC<ExpenseAnalyticsProps> = ({ expenses = [] }) => {
  const [selectedView, setSelectedView] = useState<'overview' | 'trends' | 'categories' | 'payments'>('overview');

  // Early return with loading state if no expenses data
  if (!expenses) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  const stats = useMemo(() => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    
    const thisMonthExpenses = expenses.filter(expense => {
      const expenseDate = new Date(expense.expenseDate);
      return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear;
    });

    const lastMonthExpenses = expenses.filter(expense => {
      const expenseDate = new Date(expense.expenseDate);
      const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      return expenseDate.getMonth() === lastMonth && expenseDate.getFullYear() === lastMonthYear;
    });

    const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const thisMonthTotal = thisMonthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const lastMonthTotal = lastMonthExpenses.reduce((sum, expense) => sum + expense.amount, 0);

    const averageExpense = expenses.length > 0 ? totalAmount / expenses.length : 0;
    const monthlyChange = lastMonthTotal > 0 ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0;

    // Reimbursement calculations
    const reimbursementExpenses = expenses.filter(expense => 
      expense.isReimbursement && expense.reimbursementStatus
    );

    const reimbursementAmounts = {
      pending: reimbursementExpenses
        .filter(expense => expense.reimbursementStatus === 'pending')
        .reduce((sum, expense) => sum + expense.amount, 0),
      approved: reimbursementExpenses
        .filter(expense => expense.reimbursementStatus === 'approved')
        .reduce((sum, expense) => sum + expense.amount, 0),
      reimbursed: reimbursementExpenses
        .filter(expense => expense.reimbursementStatus === 'reimbursed')
        .reduce((sum, expense) => sum + expense.amount, 0),
    };

    const totalReimbursementAmount = reimbursementAmounts.pending + reimbursementAmounts.approved + reimbursementAmounts.reimbursed;

    return {
      total: totalAmount,
      count: expenses.length,
      average: averageExpense,
      thisMonth: thisMonthTotal,
      lastMonth: lastMonthTotal,
      monthlyChange,
      reimbursement: {
        total: totalReimbursementAmount,
        pending: reimbursementAmounts.pending,
        approved: reimbursementAmounts.approved,
        reimbursed: reimbursementAmounts.reimbursed,
      }
    };
  }, [expenses]);

  const reimbursementStats = useMemo(() => {
    const reimbursementExpenses = expenses.filter(expense => 
      expense.isReimbursement && expense.reimbursementStatus
    );

    const pendingCount = reimbursementExpenses.filter(expense => expense.reimbursementStatus === 'pending').length;
    const approvedCount = reimbursementExpenses.filter(expense => expense.reimbursementStatus === 'approved').length;
    const reimbursedCount = reimbursementExpenses.filter(expense => expense.reimbursementStatus === 'reimbursed').length;
    const totalCount = reimbursementExpenses.length;

    const pendingPercentage = totalCount > 0 ? (pendingCount / totalCount) * 100 : 0;
    const approvedPercentage = totalCount > 0 ? (approvedCount / totalCount) * 100 : 0;
    const reimbursedPercentage = totalCount > 0 ? (reimbursedCount / totalCount) * 100 : 0;

    return {
      pendingCount,
      approvedCount,
      reimbursedCount,
      totalCount,
      pendingPercentage,
      approvedPercentage,
      reimbursedPercentage,
    };
  }, [expenses]);

  // Analytics calculations
  const analytics = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Basic totals
    const totalAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const totalCount = expenses.length;
    const averageExpense = totalCount > 0 ? totalAmount / totalCount : 0;

    // Current month expenses
    const currentMonthExpenses = expenses.filter(expense => {
      const expenseDate = new Date(expense.expenseDate);
      return expenseDate.getMonth() === currentMonth && expenseDate.getFullYear() === currentYear;
    });
    const currentMonthAmount = currentMonthExpenses.reduce((sum, expense) => sum + expense.amount, 0);

    // Category analysis
    const categoryData = expenses.reduce((acc, expense) => {
      if (!acc[expense.category]) acc[expense.category] = { amount: 0, count: 0 };
      acc[expense.category].amount += expense.amount;
      acc[expense.category].count += 1;
      return acc;
    }, {} as Record<string, { amount: number; count: number }>);

    // Payment mode analysis
    const paymentModeData = expenses.reduce((acc, expense) => {
      if (!acc[expense.paymentMode]) acc[expense.paymentMode] = { amount: 0, count: 0 };
      acc[expense.paymentMode].amount += expense.amount;
      acc[expense.paymentMode].count += 1;
      return acc;
    }, {} as Record<string, { amount: number; count: number }>);

    // Reimbursement data
    const pendingReimbursements = expenses.filter(e => e.isReimbursement && e.reimbursementStatus === 'pending');
    const pendingAmount = pendingReimbursements.reduce((sum, expense) => sum + expense.amount, 0);

    // Monthly trends (last 6 months)
    const monthlyTrends = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - i, 1);
      const monthExpenses = expenses.filter(expense => {
        const expenseDate = new Date(expense.expenseDate);
        return expenseDate.getMonth() === date.getMonth() && expenseDate.getFullYear() === date.getFullYear();
      });
      
      monthlyTrends.push({
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        amount: monthExpenses.reduce((sum, expense) => sum + expense.amount, 0),
        count: monthExpenses.length
      });
    }

    return {
      totalAmount,
      totalCount,
      averageExpense,
      currentMonthAmount,
      currentMonthCount: currentMonthExpenses.length,
      categoryData: Object.entries(categoryData).sort(([, a], [, b]) => b.amount - a.amount).slice(0, 5),
      paymentModeData: Object.entries(paymentModeData).sort(([, a], [, b]) => b.amount - a.amount),
      pendingReimbursements: { count: pendingReimbursements.length, amount: pendingAmount },
      monthlyTrends
    };
  }, [expenses]);

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      office: 'from-blue-500 to-blue-600',
      equipment: 'from-purple-500 to-purple-600',
      marketing: 'from-green-500 to-green-600',
      travel: 'from-orange-500 to-orange-600',
      utilities: 'from-yellow-500 to-yellow-600',
      maintenance: 'from-red-500 to-red-600'
    };
    return colors[category?.toLowerCase()] || 'from-gray-500 to-gray-600';
  };

  const getPaymentIcon = (mode: string) => {
    switch (mode?.toLowerCase()) {
      case 'cash': return <Banknote className="w-4 h-4" />;
      case 'card': return <CreditCard className="w-4 h-4" />;
      case 'upi': return <Smartphone className="w-4 h-4" />;
      default: return <Wallet className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Analytics Header */}
      <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-white to-blue-100 bg-clip-text text-transparent">
              Expense Analytics Dashboard
            </h2>
            <p className="text-purple-100">Comprehensive insights into your expense patterns</p>
          </div>
          <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
            <BarChart3 className="w-8 h-8" />
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 bg-gradient-to-br from-green-50 to-emerald-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Total Expenses</p>
                <p className="text-2xl font-bold text-green-800">₹{analytics.totalAmount.toLocaleString()}</p>
                <p className="text-xs text-green-600">{analytics.totalCount} transactions</p>
              </div>
              <div className="p-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">This Month</p>
                <p className="text-2xl font-bold text-blue-800">₹{analytics.currentMonthAmount.toLocaleString()}</p>
                <p className="text-xs text-blue-600">{analytics.currentMonthCount} transactions</p>
              </div>
              <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl">
                <Calendar className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-gradient-to-br from-purple-50 to-violet-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Average Expense</p>
                <p className="text-2xl font-bold text-purple-800">₹{analytics.averageExpense.toLocaleString()}</p>
                <p className="text-xs text-purple-600">Per transaction</p>
              </div>
              <div className="p-3 bg-gradient-to-r from-purple-500 to-violet-600 rounded-xl">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 bg-gradient-to-br from-orange-50 to-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide">Pending Reimbursement</p>
                <p className="text-2xl font-bold text-orange-800">₹{analytics.pendingReimbursements.amount.toLocaleString()}</p>
                <p className="text-xs text-orange-600">{analytics.pendingReimbursements.count} items</p>
              </div>
              <div className="p-3 bg-gradient-to-r from-orange-500 to-amber-600 rounded-xl">
                <Clock className="w-6 h-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics Tabs */}
      <Tabs value={selectedView} onValueChange={(value) => setSelectedView(value as any)} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 bg-gray-100 rounded-lg p-1">
          <TabsTrigger 
            value="overview"
            className="text-xs sm:text-sm font-medium px-3 py-2.5 rounded-md transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-md data-[state=active]:font-semibold hover:bg-gray-50 hover:shadow-sm"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger 
            value="trends"
            className="text-xs sm:text-sm font-medium px-3 py-2.5 rounded-md transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-green-600 data-[state=active]:shadow-md data-[state=active]:font-semibold hover:bg-gray-50 hover:shadow-sm"
          >
            Trends
          </TabsTrigger>
          <TabsTrigger 
            value="categories"
            className="text-xs sm:text-sm font-medium px-3 py-2.5 rounded-md transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-md data-[state=active]:font-semibold hover:bg-gray-50 hover:shadow-sm"
          >
            Categories
          </TabsTrigger>
          <TabsTrigger 
            value="payments"
            className="text-xs sm:text-sm font-medium px-3 py-2.5 rounded-md transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-orange-600 data-[state=active]:shadow-md data-[state=active]:font-semibold hover:bg-gray-50 hover:shadow-sm"
          >
            Payments
          </TabsTrigger>
          <TabsTrigger 
            value="reimbursements"
            className="text-xs sm:text-sm font-medium px-3 py-2.5 rounded-md transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md data-[state=active]:font-semibold hover:bg-gray-50 hover:shadow-sm"
          >
            Reimbursements
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card className="border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg">
              <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                Monthly Performance Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-700">Key Metrics</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Transactions:</span>
                      <span className="font-semibold">{analytics.totalCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">This Month:</span>
                      <span className="font-semibold">{analytics.currentMonthCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Average per Transaction:</span>
                      <span className="font-semibold">₹{analytics.averageExpense.toFixed(0)}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-700">Reimbursement Status</h4>
                  <div className="bg-gradient-to-r from-orange-50 to-amber-50 p-3 rounded-lg border border-orange-200">
                    <div className="flex items-center justify-between">
                      <span className="text-orange-700 font-medium">Pending Amount</span>
                      <span className="text-orange-800 font-bold">₹{analytics.pendingReimbursements.amount.toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-orange-600 mt-1">
                      {analytics.pendingReimbursements.count} items awaiting reimbursement
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card className="border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-t-lg">
              <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                Monthly Expense Trends
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {analytics.monthlyTrends.map((month, index) => {
                  const maxAmount = Math.max(...analytics.monthlyTrends.map(m => m.amount));
                  const percentage = maxAmount > 0 ? (month.amount / maxAmount) * 100 : 0;
                  
                  return (
                    <div key={month.month} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-sm">
                            {month.month}
                          </div>
                          <span className="font-medium text-gray-800">{month.count} transactions</span>
                        </div>
                        <span className="font-bold text-gray-800">₹{month.amount.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-1000 ease-out rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <Card className="border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-t-lg">
              <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <PieChart className="w-5 h-5 text-purple-600" />
                Category-wise Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {analytics.categoryData.map(([category, data]) => {
                  const percentage = (data.amount / analytics.totalAmount) * 100;
                  
                  return (
                    <div key={category} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-lg bg-gradient-to-r ${getCategoryColor(category)} flex items-center justify-center text-white`}>
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 capitalize">{category.replace('_', ' ')}</p>
                            <p className="text-sm text-gray-600">{data.count} transactions</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-800">₹{data.amount.toLocaleString()}</p>
                          <p className="text-sm text-gray-600">{percentage.toFixed(1)}%</p>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div 
                          className={`h-full bg-gradient-to-r ${getCategoryColor(category)} transition-all duration-1000 ease-out`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-6">
          <Card className="border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-t-lg">
              <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-orange-600" />
                Payment Methods Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analytics.paymentModeData.map(([mode, data]) => {
                  const percentage = (data.amount / analytics.totalAmount) * 100;
                  
                  return (
                    <div key={mode} className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-orange-500 to-amber-600 flex items-center justify-center text-white">
                          {getPaymentIcon(mode)}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-800 capitalize">{mode.replace('_', ' ')}</p>
                          <p className="text-sm text-gray-600">{data.count} transactions</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-800">₹{data.amount.toLocaleString()}</p>
                          <p className="text-sm text-gray-600">{percentage.toFixed(1)}%</p>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-orange-400 to-amber-500 transition-all duration-1000 ease-out"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reimbursements" className="mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Reimbursement Status Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-800">
                  Reimbursement Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Pending Reimbursements */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-orange-600">Pending</span>
                      <span className="text-sm text-gray-600">
                        ₹{stats.reimbursement.pending.toLocaleString()} ({reimbursementStats.pendingCount} expenses)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-gradient-to-r from-orange-400 to-orange-600 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${reimbursementStats.pendingPercentage}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {reimbursementStats.pendingPercentage.toFixed(1)}% of total reimbursements
                    </p>
                  </div>

                  {/* Approved Reimbursements */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-blue-600">Approved</span>
                      <span className="text-sm text-gray-600">
                        ₹{stats.reimbursement.approved.toLocaleString()} ({reimbursementStats.approvedCount} expenses)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-gradient-to-r from-blue-400 to-blue-600 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${reimbursementStats.approvedPercentage}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {reimbursementStats.approvedPercentage.toFixed(1)}% of total reimbursements
                    </p>
                  </div>

                  {/* Reimbursed */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-green-600">Completed</span>
                      <span className="text-sm text-gray-600">
                        ₹{stats.reimbursement.reimbursed.toLocaleString()} ({reimbursementStats.reimbursedCount} expenses)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${reimbursementStats.reimbursedPercentage}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {reimbursementStats.reimbursedPercentage.toFixed(1)}% of total reimbursements
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Reimbursement Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-800">
                  Reimbursement Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-gray-800">
                      ₹{stats.reimbursement.total.toLocaleString()}
                    </div>
                    <p className="text-sm text-gray-600">Total Reimbursements</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <div className="text-lg font-semibold text-green-600">
                        {reimbursementStats.reimbursedCount}
                      </div>
                      <p className="text-xs text-gray-600">Completed</p>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <div className="text-lg font-semibold text-orange-600">
                        {reimbursementStats.pendingCount + reimbursementStats.approvedCount}
                      </div>
                      <p className="text-xs text-gray-600">In Progress</p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Average Reimbursement:</span>
                      <span className="font-semibold text-gray-800">
                        ₹{reimbursementStats.totalCount > 0 ? 
                          Math.round(stats.reimbursement.total / reimbursementStats.totalCount).toLocaleString() : 
                          '0'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-sm text-gray-600">Completion Rate:</span>
                      <span className="font-semibold text-green-600">
                        {reimbursementStats.reimbursedPercentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ExpenseAnalytics;