import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {  Table, TableBody, TableCell, TableHead, TableHeader, TableRow  } from "@/components/ui/table";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import Loading from "@/components/ui/loading";
import FeeAlertManager from "@/components/FeeAlertManager";
import { 
  DollarSign, 
  Calendar, 
  User, 
  Plus, 
  Edit, 
  Trash2, 
  Download, 
  CreditCard,
  Bell,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  FileText,
  Send,
  Filter,
  Search,
  RefreshCw,
  Eye,
  Printer,
  BarChart3,
  Wallet,
  Receipt,
  IndianRupee
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { cn } from "@/lib/utils";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  course: string;
  batch: string;
  totalFees: number;
  paidFees: number;
  remainingFees: number;
  installmentCount: number;
  nextInstallmentDate: string;
  status: string;
}

interface FeeTransaction {
  id: string;
  studentId: string;
  studentName: string;
  amount: number;
  type: 'installment' | 'full' | 'partial';
  status: 'paid' | 'pending' | 'overdue' | 'partial';
  paymentMode: string;
  transactionId: string;
  dueDate: string;
  paidDate: string;
  remarks: string;
  installmentNumber?: number;
  totalInstallments?: number;
}

interface Notification {
  id: string;
  studentId: string;
  studentName: string;
  type: 'payment_reminder' | 'overdue_notice' | 'receipt' | 'installment_due';
  message: string;
  status: 'sent' | 'pending' | 'failed';
  sentDate: string;
  dueDate?: string;
  amount?: number;
}

interface FeeFormData {
  studentId: string;
  amount: number;
  type: 'installment' | 'full' | 'partial';
  paymentMode: string;
  transactionId: string;
  dueDate: string;
  remarks: string;
  installmentNumber?: number;
  totalInstallments?: number;
}

interface NotificationFormData {
  studentId: string;
  type: 'payment_reminder' | 'overdue_notice' | 'receipt' | 'installment_due';
  message: string;
  dueDate?: string;
  amount?: number;
}

export default function FeeManagement() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"overview" | "students" | "transactions" | "fee-alerts" | "notifications">("overview");
  const [isFeeDialogOpen, setIsFeeDialogOpen] = useState(false);
  const [isNotificationDialogOpen, setIsNotificationDialogOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<FeeTransaction | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch data
  const { data: students = [], isLoading: studentsLoading } = useQuery<Student[]>({
    queryKey: ['/api/students'],
  });

  const { data: feeTransactions = [], isLoading: feesLoading } = useQuery<FeeTransaction[]>({
    queryKey: ['/api/fee-transactions'],
  });

  const { data: notifications = [], isLoading: notificationsLoading } = useQuery<Notification[]>({
    queryKey: ['/api/notifications'],
  });

  // Form hooks
  const feeForm = useForm<FeeFormData>();
  const notificationForm = useForm<NotificationFormData>();

  // Mutations
  const createFeeMutation = useMutation({
    mutationFn: (data: FeeFormData) => apiRequest("POST", "/api/fee-transactions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fee-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/students'] });
      setIsFeeDialogOpen(false);
      feeForm.reset();
      toast({ title: "Success", description: "Fee transaction created successfully!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create fee transaction", variant: "destructive" });
    }
  });

  const sendNotificationMutation = useMutation({
    mutationFn: (data: NotificationFormData) => apiRequest("POST", "/api/notifications", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      setIsNotificationDialogOpen(false);
      notificationForm.reset();
      toast({ title: "Success", description: "Notification sent successfully!" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send notification", variant: "destructive" });
    }
  });

  // Computed data
  const filteredStudents = useMemo(() => {
    return students.filter((student: Student) => {
      const matchesSearch = 
        student.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.email.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || student.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [students, searchTerm, statusFilter]);

  const feeStats = useMemo(() => {
    const totalFees = students.reduce((sum: number, student: Student) => sum + student.totalFees, 0);
    const totalPaid = students.reduce((sum: number, student: Student) => sum + student.paidFees, 0);
    const totalRemaining = students.reduce((sum: number, student: Student) => sum + student.remainingFees, 0);
    const overdueCount = students.filter((student: Student) => student.status === 'overdue').length;
    const pendingCount = students.filter((student: Student) => student.status === 'pending').length;

    return {
      totalFees,
      totalPaid,
      totalRemaining,
      overdueCount,
      pendingCount,
      collectionRate: totalFees > 0 ? ((totalPaid / totalFees) * 100).toFixed(1) : '0'
    };
  }, [students]);

  const chartData = useMemo(() => {
    const monthlyData = feeTransactions.reduce((acc: any[], transaction: FeeTransaction) => {
      const date = new Date(transaction.paidDate || transaction.dueDate);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const existing = acc.find(item => item.month === month);
      
      if (existing) {
        existing.amount += transaction.amount;
        existing.count += 1;
      } else {
        acc.push({ month, amount: transaction.amount, count: 1 });
      }
      
      return acc;
    }, []);

    return monthlyData.sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
  }, [feeTransactions]);

  // Handlers
  const handleCreateFee = (data: FeeFormData) => {
    createFeeMutation.mutate(data);
  };

  const handleSendNotification = (data: NotificationFormData) => {
    sendNotificationMutation.mutate(data);
  };

  const calculateRemainingInstallments = (student: any) => {
    const total = parseFloat(student.noOfInstallments || '0');
    const paid = parseFloat(student.installmentsPaid || '0');
    return Math.max(0, total - paid);
  };

  const handlePrintFeeReceipt = (student: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: "Error",
        description: "Please allow pop-ups to print the receipt",
        variant: "destructive",
      });
      return;
    }

    const receiptHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Fee Receipt - ${student.firstName || 'Student'}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: white;
          }
          .receipt-container {
            max-width: 800px;
            margin: 0 auto;
            border: 2px solid #333;
            padding: 30px;
            background: white;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .institute-name {
            font-size: 28px;
            font-weight: bold;
            color: #1e40af;
            margin-bottom: 5px;
          }
          .institute-subtitle {
            font-size: 16px;
            color: #666;
            margin-bottom: 10px;
          }
          .receipt-title {
            font-size: 24px;
            font-weight: bold;
            color: #333;
            margin-bottom: 5px;
          }
          .receipt-number {
            font-size: 14px;
            color: #666;
          }
          .student-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
          }
          .info-group {
            margin-bottom: 15px;
          }
          .info-label {
            font-weight: bold;
            color: #333;
            margin-bottom: 5px;
          }
          .info-value {
            color: #666;
            border-bottom: 1px solid #ddd;
            padding-bottom: 5px;
          }
          .fees-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          .fees-table th,
          .fees-table td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
          }
          .fees-table th {
            background-color: #f8f9fa;
            font-weight: bold;
            color: #333;
          }
          .fees-table td {
            color: #666;
          }
          .total-row {
            font-weight: bold;
            background-color: #f8f9fa;
          }
          .footer {
            margin-top: 40px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
          }
          .signature-box {
            text-align: center;
            border-top: 1px solid #333;
            padding-top: 10px;
            margin-top: 20px;
          }
          .signature-line {
            width: 200px;
            border-top: 1px solid #333;
            margin: 10px auto;
          }
          .print-button {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 20px;
            background: #1e40af;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
          }
          @media print {
            .print-button {
              display: none;
            }
            body {
              padding: 0;
            }
            .receipt-container {
              border: none;
              padding: 20px;
            }
          }
        </style>
      </head>
      <body>
        <button class="print-button" onclick="window.print()">Print Receipt</button>
        <div class="receipt-container">
          <div class="header">
            <div class="institute-name">Zica Institute</div>
            <div class="institute-subtitle">Professional Training & Certification</div>
            <div class="receipt-title">FEE RECEIPT</div>
            <div class="receipt-number">Receipt No: ${student.srNo || 'N/A'} | Date: ${new Date().toLocaleDateString()}</div>
          </div>

          <div class="student-info">
            <div class="info-group">
              <div class="info-label">Student Name:</div>
              <div class="info-value">${student.firstName || ''} ${student.lastName || ''}</div>
            </div>
            <div class="info-group">
              <div class="info-label">Contact Number:</div>
              <div class="info-value">${student.phone || 'N/A'}</div>
            </div>
            <div class="info-group">
              <div class="info-label">Course:</div>
              <div class="info-value">${student.course || 'N/A'}</div>
            </div>
            <div class="info-group">
              <div class="info-label">Course Duration:</div>
              <div class="info-value">${student.courseDuration || 'N/A'}</div>
            </div>
            <div class="info-group">
              <div class="info-label">Admission Date:</div>
              <div class="info-value">${student.admissionDate || 'N/A'}</div>
            </div>
            <div class="info-group">
              <div class="info-label">Payment Mode:</div>
              <div class="info-value">${student.paymentMode || 'N/A'}</div>
            </div>
          </div>

          <table class="fees-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Amount (₹)</th>
                <th>Paid (₹)</th>
                <th>Balance (₹)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Course Fees</td>
                <td>${student.actualFees ? parseFloat(student.actualFees).toLocaleString() : '0'}</td>
                <td>${student.feesPaid ? parseFloat(student.feesPaid).toLocaleString() : '0'}</td>
                <td>${student.feesBalance ? parseFloat(student.feesBalance).toLocaleString() : '0'}</td>
              </tr>
              ${student.discountedFees && parseFloat(student.discountedFees) > 0 ? `
              <tr>
                <td>Discount Applied</td>
                <td>-${parseFloat(student.discountedFees).toLocaleString()}</td>
                <td>-</td>
                <td>-</td>
              </tr>
              ` : ''}
              <tr class="total-row">
                <td><strong>Total</strong></td>
                <td><strong>₹${student.actualFees ? parseFloat(student.actualFees).toLocaleString() : '0'}</strong></td>
                <td><strong>₹${student.feesPaid ? parseFloat(student.feesPaid).toLocaleString() : '0'}</strong></td>
                <td><strong>₹${student.feesBalance ? parseFloat(student.feesBalance).toLocaleString() : '0'}</strong></td>
              </tr>
            </tbody>
          </table>

          ${student.noOfInstallments && parseFloat(student.noOfInstallments) > 0 ? `
          <div style="margin-top: 20px;">
            <strong>Installment Details:</strong>
            <table class="fees-table" style="margin-top: 10px;">
              <tr>
                <th>Total Installments</th>
                <th>Installments Paid</th>
                <th>Remaining Installments</th>
                <th>Due Date</th>
              </tr>
              <tr>
                <td>${student.noOfInstallments}</td>
                <td>${student.installmentsPaid || '0'}</td>
                <td>${calculateRemainingInstallments(student)}</td>
                <td>${student.dueDate || 'N/A'}</td>
              </tr>
            </table>
          </div>
          ` : ''}

          <div class="footer">
            <div>
              <strong>Remarks:</strong><br>
              ${student.remarks || 'No remarks'}
            </div>
            <div>
              <strong>Status:</strong><br>
              ${student.status || 'Active'}
            </div>
          </div>

          <div class="signature-box">
            <div class="signature-line"></div>
            <div>Authorized Signature</div>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(receiptHtml);
    printWindow.document.close();
    
    toast({
      title: "Success",
      description: "Fee receipt opened in new window. Click 'Print Receipt' to print.",
    });
  };

  const handleNotifyStudent = (student: Student, type: string) => {
    setSelectedStudent(student);
    notificationForm.setValue('studentId', student.id);
    notificationForm.setValue('type', type as any);
    
    let message = '';
    let amount = student.remainingFees;
    
    switch (type) {
      case 'payment_reminder':
        message = `Dear ${student.firstName}, this is a friendly reminder that your next installment of ₹${student.remainingFees / student.installmentCount} is due on ${student.nextInstallmentDate}. Please make the payment to avoid any late fees.`;
        break;
      case 'overdue_notice':
        message = `Dear ${student.firstName}, your payment of ₹${student.remainingFees} is overdue. Please make the payment immediately to avoid any additional charges.`;
        break;
      case 'installment_due':
        message = `Dear ${student.firstName}, your installment of ₹${student.remainingFees / student.installmentCount} is due today. Please make the payment to continue your course.`;
        break;
    }
    
    notificationForm.setValue('message', message);
    notificationForm.setValue('amount', amount);
    notificationForm.setValue('dueDate', student.nextInstallmentDate);
    setIsNotificationDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'partial': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const { sortedData: sortedFilteredStudents, requestSort: requestSortStudents, sortConfig: sortConfigStudents } = useTableSort(filteredStudents);
  const { sortedData: sortedTransactions, requestSort: requestSortTransactions, sortConfig: sortConfigTransactions } = useTableSort(feeTransactions);
  const { sortedData: sortedNotifications, requestSort: requestSortNotifications, sortConfig: sortConfigNotifications } = useTableSort(notifications);

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid': return <CheckCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'overdue': return <AlertTriangle className="w-4 h-4" />;
      case 'partial': return <TrendingUp className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  if (studentsLoading || feesLoading) {
    return (
      <Loading fullScreen={true} size="lg" color="primary" text="Loading fee data..." />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Enhanced Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/60 shadow-sm mb-6">
        <div className="max-w-10xl mx-auto px-4 sm:px-6 py-4 lg:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl shadow-md">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Fee Management</h1>
                <p className="text-sm text-slate-500">Manage student fees, installments, and notifications</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-2" />
                Print Report
              </Button>
              <Dialog open={isFeeDialogOpen} onOpenChange={setIsFeeDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => { setEditingFee(null); feeForm.reset(); }} className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Fee Transaction
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add Fee Transaction</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={feeForm.handleSubmit(handleCreateFee)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Student</Label>
                        <Select onValueChange={(value) => feeForm.setValue('studentId', value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select student" />
                          </SelectTrigger>
                          <SelectContent>
                            {students.map((student: Student) => (
                              <SelectItem key={student.id} value={student.id}>
                                {student.firstName} {student.lastName} - {student.course}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Amount (₹)</Label>
                        <Input type="number" {...feeForm.register('amount', { required: true })} />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Type</Label>
                        <Select onValueChange={(value) => feeForm.setValue('type', value as any)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="installment">Installment</SelectItem>
                            <SelectItem value="full">Full Payment</SelectItem>
                            <SelectItem value="partial">Partial Payment</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Payment Mode</Label>
                        <Select onValueChange={(value) => feeForm.setValue('paymentMode', value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select mode" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cash">Cash</SelectItem>
                            <SelectItem value="card">Card</SelectItem>
                            <SelectItem value="upi">UPI</SelectItem>
                            <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                            <SelectItem value="cheque">Cheque</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Due Date</Label>
                        <Input type="date" {...feeForm.register('dueDate', { required: true })} />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Transaction ID</Label>
                        <Input {...feeForm.register('transactionId')} placeholder="Optional" />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Remarks</Label>
                      <Textarea {...feeForm.register('remarks')} placeholder="Additional notes..." />
                    </div>
                    
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsFeeDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createFeeMutation.isPending}>
                        {createFeeMutation.isPending ? 'Creating...' : 'Create Transaction'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-10xl mx-auto px-4 sm:px-6 pb-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <Card className="border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Total Fees</p>
                  <p className="text-2xl font-bold text-slate-900">₹{feeStats.totalFees.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-sm">
                  <IndianRupee className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Collected</p>
                  <p className="text-2xl font-bold text-emerald-600">₹{feeStats.totalPaid.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-sm">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Pending</p>
                  <p className="text-2xl font-bold text-amber-600">₹{feeStats.totalRemaining.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl shadow-sm">
                  <Clock className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Collection Rate</p>
                  <p className="text-2xl font-bold text-purple-600">{feeStats.collectionRate}%</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-sm">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Overdue</p>
                  <p className="text-2xl font-bold text-red-600">{feeStats.overdueCount}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-sm">
                  <AlertTriangle className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="mb-1">
          <div className="rounded-lg p-1">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-5 gap-1 p-1 bg-gray-100 rounded-lg">
                <TabsTrigger 
                  value="overview" 
                  className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium px-3 py-2.5 rounded-md transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-md data-[state=active]:font-semibold hover:bg-gray-50 hover:shadow-sm"
                >
                  <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Overview</span>
                  <span className="sm:hidden">Overview</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="students" 
                  className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium px-3 py-2.5 rounded-md transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-md data-[state=active]:font-semibold hover:bg-gray-50 hover:shadow-sm"
                >
                  <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Students</span>
                  <span className="sm:hidden">Students</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="transactions" 
                  className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium px-3 py-2.5 rounded-md transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-purple-600 data-[state=active]:shadow-md data-[state=active]:font-semibold hover:bg-gray-50 hover:shadow-sm"
                >
                  <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Transactions</span>
                  <span className="sm:hidden">Txns</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="fee-alerts" 
                  className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium px-3 py-2.5 rounded-md transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-amber-600 data-[state=active]:shadow-md data-[state=active]:font-semibold hover:bg-gray-50 hover:shadow-sm"
                >
                  <Bell className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Alerts</span>
                  <span className="sm:hidden">Alerts</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="notifications" 
                  className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm font-medium px-3 py-2.5 rounded-md transition-all duration-300 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-md data-[state=active]:font-semibold hover:bg-gray-50 hover:shadow-sm"
                >
                  <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Notifications</span>
                  <span className="sm:hidden">Notifs</span>
                </TabsTrigger>
              </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Fee Collection Chart */}
              <Card className="border border-slate-200/60 shadow-sm">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                  <CardTitle className="text-lg font-bold text-slate-800">Fee Collection Trend</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="month" stroke="#64748b" style={{ fontSize: '12px' }} />
                      <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                      <Tooltip 
                        formatter={(value: any) => [`₹${value}`, 'Amount']} 
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Payment Status Distribution */}
              <Card className="border border-slate-200/60 shadow-sm">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                  <CardTitle className="text-lg font-bold text-slate-800">Payment Status Distribution</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Paid', value: feeStats.totalPaid, color: '#10b981' },
                          { name: 'Pending', value: feeStats.totalRemaining, color: '#f59e0b' },
                          { name: 'Overdue', value: feeStats.overdueCount * 1000, color: '#ef4444' }
                        ]}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {[
                          { name: 'Paid', value: feeStats.totalPaid, color: '#10b981' },
                          { name: 'Pending', value: feeStats.totalRemaining, color: '#f59e0b' },
                          { name: 'Overdue', value: feeStats.overdueCount * 1000, color: '#ef4444' }
                        ].map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: any) => [`₹${value}`, 'Amount']} 
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Students Tab */}
          <TabsContent value="students" className="space-y-4 mt-6">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Search students..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Students Table */}
            <Card className="border border-slate-200/60 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3 px-6">
                <CardTitle className="text-lg font-bold text-slate-800">Student Fee Status</CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table className="min-w-full">
                  <TableHeader className="sticky top-0 z-30">
                    <TableRow className="bg-slate-50 border-b border-slate-200">
                      <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfigStudents} sortKey="firstName" requestSort={requestSortStudents}>Student</SortableTableHead>
                      <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfigStudents} sortKey="course" requestSort={requestSortStudents}>Course</SortableTableHead>
                      <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm text-right" sortConfig={sortConfigStudents} sortKey="totalFees" requestSort={requestSortStudents}>Total Fees</SortableTableHead>
                      <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm text-right" sortConfig={sortConfigStudents} sortKey="paidFees" requestSort={requestSortStudents}>Paid</SortableTableHead>
                      <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm text-right" sortConfig={sortConfigStudents} sortKey="remainingFees" requestSort={requestSortStudents}>Remaining</SortableTableHead>
                      <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm text-center" sortConfig={sortConfigStudents} sortKey="status" requestSort={requestSortStudents}>Status</SortableTableHead>
                      <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfigStudents} sortKey="nextInstallmentDate" requestSort={requestSortStudents}>Next Due</SortableTableHead>
                      <TableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedFilteredStudents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-32 text-center text-slate-500">
                          No students found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedFilteredStudents.map((student: Student) => (
                        <TableRow key={student.id} className="hover:bg-slate-50/80 transition-colors">
                          <TableCell>
                            <div>
                              <div className="font-semibold text-slate-900">{student.firstName} {student.lastName}</div>
                              <div className="text-xs text-slate-500 truncate max-w-[180px]">{student.email}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-900 font-medium">{student.course}</TableCell>
                          <TableCell className="text-right font-medium text-slate-900">₹{student.totalFees.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-medium text-emerald-600">₹{student.paidFees.toLocaleString()}</TableCell>
                          <TableCell className="text-right font-medium text-red-600">₹{student.remainingFees.toLocaleString()}</TableCell>
                          <TableCell className="text-center">
                            <Badge className={cn("text-[10px] px-2 py-0.5 flex items-center justify-center gap-1 w-fit mx-auto", getStatusColor(student.status))}>
                              {getStatusIcon(student.status)}
                              <span>{student.status}</span>
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-600">
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              {student.nextInstallmentDate}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleNotifyStudent(student, 'payment_reminder')}
                                className="h-8 w-8 p-0 border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                                title="Send Reminder"
                              >
                                <Bell className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handlePrintFeeReceipt(student)}
                                className="h-8 w-8 p-0 border-slate-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200"
                                title="Print Receipt"
                              >
                                <FileText className="w-3.5 h-3.5" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="h-8 w-8 p-0 border-slate-200 hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200"
                                title="View Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-4 mt-6">
            <Card className="border border-slate-200/60 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3 px-6">
                <CardTitle className="text-lg font-bold text-slate-800">Recent Fee Transactions</CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-30">
                    <TableRow className="bg-slate-50 border-b border-slate-200">
                      <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfigTransactions} sortKey="studentName" requestSort={requestSortTransactions}>Student</SortableTableHead>
                      <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm text-right" sortConfig={sortConfigTransactions} sortKey="amount" requestSort={requestSortTransactions}>Amount</SortableTableHead>
                      <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfigTransactions} sortKey="type" requestSort={requestSortTransactions}>Type</SortableTableHead>
                      <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm text-center" sortConfig={sortConfigTransactions} sortKey="status" requestSort={requestSortTransactions}>Status</SortableTableHead>
                      <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfigTransactions} sortKey="paymentMode" requestSort={requestSortTransactions}>Payment Mode</SortableTableHead>
                      <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfigTransactions} sortKey="paidDate" requestSort={requestSortTransactions}>Date</SortableTableHead>
                      <TableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-32 text-center text-slate-500">
                          No transactions found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedTransactions.slice(0, 10).map((transaction: FeeTransaction) => (
                        <TableRow key={transaction.id} className="hover:bg-slate-50/80 transition-colors">
                          <TableCell className="font-semibold text-slate-900">{transaction.studentName}</TableCell>
                          <TableCell className="text-right font-medium text-emerald-600">₹{transaction.amount.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] bg-slate-50">{transaction.type}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={cn("text-[10px] px-2 py-0.5 w-fit mx-auto", getStatusColor(transaction.status))}>
                              {transaction.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-600">{transaction.paymentMode}</TableCell>
                          <TableCell className="text-slate-600">{transaction.paidDate || transaction.dueDate}</TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="h-8 w-8 p-0 border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="h-8 w-8 p-0 border-slate-200 hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Fee Alerts Tab */}
          <TabsContent value="fee-alerts" className="space-y-4 mt-6">
            <FeeAlertManager 
              students={students} 
              onAlertSent={(alert) => {
                toast({
                  title: "Fee Alert Sent",
                  description: `Reminder sent to ${alert.studentName}`,
                });
              }}
            />
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-4 mt-6">
            <Card className="border border-slate-200/60 shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3 px-6">
                <CardTitle className="text-lg font-bold text-slate-800">Notification History</CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-30">
                    <TableRow className="bg-slate-50 border-b border-slate-200">
                      <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfigNotifications} sortKey="studentName" requestSort={requestSortNotifications}>Student</SortableTableHead>
                      <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfigNotifications} sortKey="type" requestSort={requestSortNotifications}>Type</SortableTableHead>
                      <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfigNotifications} sortKey="message" requestSort={requestSortNotifications}>Message</SortableTableHead>
                      <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm text-center" sortConfig={sortConfigNotifications} sortKey="status" requestSort={requestSortNotifications}>Status</SortableTableHead>
                      <SortableTableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm" sortConfig={sortConfigNotifications} sortKey="sentDate" requestSort={requestSortNotifications}>Sent Date</SortableTableHead>
                      <TableHead className="font-semibold text-slate-700 py-3 text-xs sm:text-sm text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedNotifications.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                          No notifications found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedNotifications.map((notification: Notification) => (
                        <TableRow key={notification.id} className="hover:bg-slate-50/80 transition-colors">
                          <TableCell className="font-semibold text-slate-900">{notification.studentName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] bg-slate-50">{notification.type.replace('_', ' ')}</Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-slate-600">{notification.message}</TableCell>
                          <TableCell className="text-center">
                            <Badge className={cn("text-[10px] px-2 py-0.5 w-fit mx-auto", getStatusColor(notification.status))}>
                              {notification.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-600">{notification.sentDate}</TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center">
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="h-8 w-8 p-0 border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                              >
                                <Send className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
          </div>
        </div>
      </div>

      {/* Notification Dialog */}
      <Dialog open={isNotificationDialogOpen} onOpenChange={setIsNotificationDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Send Notification</DialogTitle>
          </DialogHeader>
          <form onSubmit={notificationForm.handleSubmit(handleSendNotification)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Student</Label>
                <Input 
                  value={selectedStudent ? `${selectedStudent.firstName} ${selectedStudent.lastName}` : ''} 
                  disabled 
                />
              </div>
              
              <div className="space-y-2">
                <Label>Type</Label>
                <Select onValueChange={(value) => notificationForm.setValue('type', value as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="payment_reminder">Payment Reminder</SelectItem>
                    <SelectItem value="overdue_notice">Overdue Notice</SelectItem>
                    <SelectItem value="installment_due">Installment Due</SelectItem>
                    <SelectItem value="receipt">Payment Receipt</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea 
                {...notificationForm.register('message', { required: true })} 
                rows={4}
                placeholder="Enter notification message..."
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsNotificationDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={sendNotificationMutation.isPending}>
                {sendNotificationMutation.isPending ? 'Sending...' : 'Send Notification'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
