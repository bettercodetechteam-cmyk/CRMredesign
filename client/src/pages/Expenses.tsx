import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {  Table, TableBody, TableCell, TableHead, TableHeader, TableRow  } from "@/components/ui/table";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import Loading from "@/components/ui/loading";
import { 
  Calendar, 
  FileText, 
  Plus, 
  Edit, 
  Trash2, 
  Download, 
  Receipt, 
  Upload, 
  Image as ImageIcon, 
  X, 
  Eye,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  CreditCard,
  Banknote,
  Smartphone,
  History,
  Bell,
  Target,
  Award,
  Star,
  Bookmark,
  Share2,
  Copy,
  Archive,
  Tag,
  Settings,
  Printer,
  FileDown,
  CalendarDays,
  Wallet,
  Coins,
  Percent,
  Minus,
  Plus as PlusIcon,
  RefreshCw,
  MoreHorizontal,
  Send,
  User,
  Phone,
  Mail,
  MapPin,
  Calculator,
  Loader2,
  ChevronDown
} from "lucide-react";
import { collection, addDoc, updateDoc, deleteDoc, doc, getDocs, query, orderBy, Timestamp } from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { uploadFileToStorage, deleteFileFromStorage } from "@/lib/uploadService";
import { useAuth } from "@/hooks/useAuth";
import { usePageLoadingSignal } from "@/contexts/NavigationLoadingContext";
import ExpenseAnalytics from "@/components/ExpenseAnalytics";

interface Expense {
  id: string;
  description: string;
  category: string;
  amount: number;
  paymentMode: string;
  expenseDate: string;
  paidBy: string;
  otherPersonName?: string;
  receiptNumber: string;
  receiptImageUrl?: string;
  receiptImagePath?: string;
  isReimbursement: boolean;
  reimbursementStatus: 'pending' | 'approved' | 'reimbursed';
  reimbursedBy?: string;
  reimbursedAt?: Timestamp;
  createdBy: string;
  centreId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface ExpenseFormData {
  description: string;
  category: string;
  amount: number | string;
  paymentMode: string;
  expenseDate: string;
  paidBy: string;
  otherPersonName?: string;
  receiptNumber: string;
  receiptImage?: File;
  isReimbursement: boolean;
  reimbursementStatus: 'pending' | 'approved' | 'reimbursed';
}

export default function Expenses() {
  // Force rebuild - base64 image storage implemented
  
  // Add CSS for hiding scrollbars
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .hide-scrollbar::-webkit-scrollbar {
        display: none;
      }
      .hide-scrollbar {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
    `;
    document.head.appendChild(style);
    return () => {
      if (style.parentNode) {
        document.head.removeChild(style);
      }
    };
  }, []);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [mutationProgress, setMutationProgress] = useState<string>('');
  const [activeTab, setActiveTab] = useState('expenses');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterPaymentMode, setFilterPaymentMode] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [filterReimbursement, setFilterReimbursement] = useState('all');
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [showExpenseDetails, setShowExpenseDetails] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userProfile } = useAuth();

  // Rupee Icon Component
  const RupeeIcon = ({ className }: { className?: string }) => (
    <span className={`font-bold ${className}`} style={{ fontSize: 'inherit' }}>
      ₹
    </span>
  );

  // Firebase Firestore query
  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const expensesRef = collection(db, 'expenses');
      const q = query(expensesRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Expense[];
    },
  });

  usePageLoadingSignal(isLoading);

  const { register, handleSubmit, reset, setValue, watch, setError, clearErrors, formState: { errors } } = useForm<ExpenseFormData>({
    defaultValues: {
      category: '',
      paymentMode: '',
      paidBy: 'office',
      otherPersonName: '',
      isReimbursement: false,
      reimbursementStatus: 'pending'
    }
  });

  const paidByValue = watch("paidBy");

  // Calculate statistics
  const totalExpenses = expenses.reduce((sum, expense) => {
    const amount = typeof expense.amount === 'string' ? parseFloat(expense.amount) : expense.amount;
    return sum + amount;
  }, 0);
  
  const totalExpensesCount = expenses.length;
  const thisMonthExpenses = expenses.filter(expense => {
    const expenseDate = new Date(expense.expenseDate);
    const now = new Date();
    return expenseDate.getMonth() === now.getMonth() && expenseDate.getFullYear() === now.getFullYear();
  }).reduce((sum, expense) => {
    const amount = typeof expense.amount === 'string' ? parseFloat(expense.amount) : expense.amount;
    return sum + amount;
  }, 0);

  // Calculate reimbursement statistics
  const pendingReimbursements = expenses.filter(expense => 
    expense.isReimbursement && expense.reimbursementStatus === 'pending'
  );
  const pendingReimbursementAmount = pendingReimbursements.reduce((sum, expense) => {
    const amount = typeof expense.amount === 'string' ? parseFloat(expense.amount) : expense.amount;
    return sum + amount;
  }, 0);

  const reimbursedExpenses = expenses.filter(expense => 
    expense.isReimbursement && expense.reimbursementStatus === 'reimbursed'
  );
  const reimbursedAmount = reimbursedExpenses.reduce((sum, expense) => {
    const amount = typeof expense.amount === 'string' ? parseFloat(expense.amount) : expense.amount;
    return sum + amount;
  }, 0);
  const averageExpense = totalExpensesCount > 0 ? totalExpenses / totalExpensesCount : 0;

  // Filter expenses
  const filteredExpenses = expenses.filter(expense => {
    const matchesSearch = 
      expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.paidBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (expense.otherPersonName && expense.otherPersonName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      expense.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = filterCategory === 'all' || expense.category === filterCategory;
    const matchesPaymentMode = filterPaymentMode === 'all' || expense.paymentMode === filterPaymentMode;
    
    // Date filtering
    let matchesDate = true;
    if (selectedDate) {
      const expenseDate = new Date(expense.expenseDate);
      const filterDate = new Date(selectedDate);
      // Compare only the date part (ignore time)
      matchesDate = expenseDate.toDateString() === filterDate.toDateString();
    }
    
    // Month filtering
    let matchesMonth = true;
    if (selectedMonth) {
      const expenseDate = new Date(expense.expenseDate);
      const [year, month] = selectedMonth.split('-');
      matchesMonth = expenseDate.getFullYear() === parseInt(year) && 
                    expenseDate.getMonth() === (parseInt(month) - 1);
    }
    
    // Reimbursement filtering
    let matchesReimbursement = true;
    if (filterReimbursement !== 'all') {
      if (filterReimbursement === 'reimbursement') {
        matchesReimbursement = expense.isReimbursement === true;
      } else if (filterReimbursement === 'pending') {
        matchesReimbursement = expense.isReimbursement === true && expense.reimbursementStatus === 'pending';
      } else if (filterReimbursement === 'approved') {
        matchesReimbursement = expense.isReimbursement === true && expense.reimbursementStatus === 'approved';
      } else if (filterReimbursement === 'reimbursed') {
        matchesReimbursement = expense.isReimbursement === true && expense.reimbursementStatus === 'reimbursed';
      } else if (filterReimbursement === 'non-reimbursement') {
        matchesReimbursement = expense.isReimbursement === false;
      }
    }
    
    return matchesSearch && matchesCategory && matchesPaymentMode && matchesDate && matchesMonth && matchesReimbursement;
  });

  const { sortedData, requestSort, sortConfig } = useTableSort(filteredExpenses);

  // Compress and convert image to base64
  const convertImageToBase64 = (file: File): Promise<string> => {
    console.log('🔄 NEW: convertImageToBase64 function called');
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions (max 800px width, maintain aspect ratio)
        const maxWidth = 800;
        const maxHeight = 600;
        let { width, height } = img;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Convert to base64 with compression (0.7 quality)
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
        
        console.log('✅ NEW: Image compressed and converted to base64, size:', compressedDataUrl.length);
        resolve(compressedDataUrl);
      };
      
      img.onerror = () => reject(new Error('Error loading image'));
      img.src = URL.createObjectURL(file);
    });
  };

  // Get image source (handles both base64 and URL)
  const getImageSource = (expense: any): string | null => {
    if (expense.receiptImageData) {
      return expense.receiptImageData; // Base64 data
    }
    if (hasImage(expense)) {
      return expense.receiptImageUrl; // URL
    }
    return null;
  };

  // Check if expense has image
  const hasImage = (expense: any): boolean => {
    return !!(expense.receiptImageData || (expense.receiptImageUrl && expense.receiptImageUrl !== 'undefined' && expense.receiptImageUrl.trim() !== ''));
  };


  // Delete image from storage (S3 or legacy Firebase Storage)
  const deleteImageFromStorage = async (expense: { receiptImagePath?: string; storageMethod?: string }) => {
    if (!expense.receiptImagePath) return;
    if (expense.storageMethod === 's3') {
      await deleteFileFromStorage(expense.receiptImagePath);
      return;
    }
    if (storage) {
      const imageRef = ref(storage, expense.receiptImagePath);
      await deleteObject(imageRef);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: ExpenseFormData) => {
      console.log('Create mutation started with data:', data);
      setMutationProgress('Preparing expense data...');
      
        // First create the expense document to get an ID
        const expenseData = {
          description: data.description,
          category: data.category,
        amount: typeof data.amount === 'string' ? parseFloat(data.amount) : data.amount,
          paymentMode: data.paymentMode,
          expenseDate: data.expenseDate,
          paidBy: data.paidBy,
          otherPersonName: data.otherPersonName || '',
          receiptNumber: data.receiptNumber,
          isReimbursement: data.isReimbursement || false,
          reimbursementStatus: data.reimbursementStatus || 'pending',
          createdBy: `${userProfile?.firstName || ''} ${userProfile?.lastName || ''}`.trim() || userProfile?.email || 'Unknown',
          centreId: userProfile?.centreId || 'default',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        };

      console.log('Expense data to create:', expenseData);

      let docRef;
      try {
        console.log('Creating expense document in Firestore...');
        setMutationProgress('Creating expense in database...');
        docRef = await addDoc(collection(db, 'expenses'), expenseData);
        console.log('Expense document created with ID:', docRef.id);
        setMutationProgress('Expense created successfully!');
      } catch (error) {
        console.error('Error creating expense document:', error);
        setMutationProgress('Error creating expense');
        throw new Error(`Failed to create expense document: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
        
        // Upload receipt to S3 (fallback to base64 if S3 unavailable)
        if (data.receiptImage) {
          console.log('Uploading receipt for expense:', docRef.id);
          setIsUploading(true);
          setMutationProgress('Processing receipt image...');
          try {
            const uploadResult = await uploadFileToStorage(
              data.receiptImage,
              `expenses/${docRef.id}`,
              data.receiptImage.name
            );
            await updateDoc(docRef, {
              receiptImageUrl: uploadResult.url,
              receiptImagePath: uploadResult.key,
              receiptImageData: null,
              storageMethod: 's3',
            });
            setMutationProgress('Image uploaded successfully!');
          } catch (s3Error) {
            console.warn('S3 upload failed, falling back to base64:', s3Error);
            const imageData = await convertImageToBase64(data.receiptImage);
            await updateDoc(docRef, {
              receiptImageData: imageData,
              receiptImageUrl: null,
              receiptImagePath: null,
              storageMethod: 'base64',
            });
            setMutationProgress('Image saved as fallback (base64)');
          } finally {
            setIsUploading(false);
          }
        }

        console.log('Mutation completed successfully');
        return { id: docRef!.id, ...expenseData };
    },
    onSuccess: () => {
      console.log('Create mutation onSuccess called');
      setMutationProgress('');
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setIsDialogOpen(false);
      reset();
      setSelectedImage(null);
      setImagePreview(null);
      setIsUploading(false); // Ensure loading state is reset
      toast({ title: "Success", description: "Expense created successfully!" });
    },
    onError: (error) => {
      console.error('Create mutation onError called:', error);
      setMutationProgress('');
      setIsUploading(false); // Reset loading state on error
      toast({ 
        title: "Error", 
        description: `Failed to create expense: ${error.message || 'Unknown error'}`, 
        variant: "destructive" 
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ExpenseFormData }) => {
        const expenseRef = doc(db, 'expenses', id);
        const updateData: any = {
          description: data.description,
          category: data.category,
        amount: typeof data.amount === 'string' ? parseFloat(data.amount) : data.amount,
          paymentMode: data.paymentMode,
          expenseDate: data.expenseDate,
          paidBy: data.paidBy,
          otherPersonName: data.otherPersonName || '',
          receiptNumber: data.receiptNumber,
          isReimbursement: data.isReimbursement || false,
          reimbursementStatus: data.reimbursementStatus || 'pending',
          updatedAt: Timestamp.now(),
        };

      if (data.receiptImage) {
        setIsUploading(true);
        try {
          const uploadResult = await uploadFileToStorage(
            data.receiptImage,
            `expenses/${id}`,
            data.receiptImage.name
          );
          updateData.receiptImageUrl = uploadResult.url;
          updateData.receiptImagePath = uploadResult.key;
          updateData.receiptImageData = null;
          updateData.storageMethod = 's3';
        } catch (s3Error) {
          console.warn('S3 upload failed during update, using base64:', s3Error);
          const imageData = await convertImageToBase64(data.receiptImage);
          updateData.receiptImageData = imageData;
          updateData.receiptImageUrl = null;
          updateData.receiptImagePath = null;
          updateData.storageMethod = 'base64';
        } finally {
          setIsUploading(false);
        }
      }

        await updateDoc(expenseRef, updateData);
        return { id, ...updateData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setIsDialogOpen(false);
      setEditingExpense(null);
      reset();
      setSelectedImage(null);
      setImagePreview(null);
      setIsUploading(false); // Ensure loading state is reset
      toast({ title: "Success", description: "Expense updated successfully!" });
    },
    onError: (error) => {
      console.error('Error updating expense:', error);
      setIsUploading(false); // Reset loading state on error
      toast({ title: "Error", description: "Failed to update expense", variant: "destructive" });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const expense = expenses.find(e => e.id === id);
      
      // Delete image from storage if exists
      if (expense?.receiptImagePath) {
        await deleteImageFromStorage(expense);
      }
      
      // Delete document from Firestore
      await deleteDoc(doc(db, 'expenses', id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast({ title: "Success", description: "Expense deleted successfully!" });
    },
    onError: (error) => {
      console.error('Error deleting expense:', error);
      toast({ title: "Error", description: "Failed to delete expense", variant: "destructive" });
    }
  });

  const handleCreateOrUpdate = (data: ExpenseFormData) => {
    console.log('Form submission started with data:', data);
    console.log('Reimbursement status:', data.reimbursementStatus);
    console.log('Is reimbursement:', data.isReimbursement);
    console.log('Current isUploading state:', isUploading);
    console.log('Selected image:', selectedImage);
    
    
    // Check if user is authenticated
    if (!userProfile) {
      toast({ 
        title: "Authentication Error", 
        description: "Please log in to add expenses", 
        variant: "destructive" 
      });
      return;
    }
    
    // Validate required fields
    if (!data.category) {
      setError('category', { type: 'required', message: 'Category is required' });
      toast({ 
        title: "Validation Error", 
        description: "Please select a category", 
        variant: "destructive" 
      });
      return;
    }
    
    if (!data.paymentMode) {
      setError('paymentMode', { type: 'required', message: 'Payment mode is required' });
      toast({ 
        title: "Validation Error", 
        description: "Please select a payment mode", 
        variant: "destructive" 
      });
      return;
    }
    
    // Ensure amount is a number and validate reimbursement status
    const processedData = {
      ...data,
      amount: typeof data.amount === 'string' ? parseFloat(data.amount) : data.amount,
      // Ensure reimbursement status is properly set
      reimbursementStatus: data.reimbursementStatus || 'pending'
    };
    
    // Add the selected image to the data
    const dataWithImage = {
      ...processedData,
      receiptImage: selectedImage || undefined
    };
    
    console.log('Processed data with image:', dataWithImage);

    if (editingExpense) {
      updateMutation.mutate({ id: editingExpense.id, data: dataWithImage });
    } else {
      createMutation.mutate(dataWithImage);
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setValue("description", expense.description || "");
    setValue("category", expense.category);
    setValue("amount", expense.amount);
    setValue("paymentMode", expense.paymentMode || "");
    setValue("expenseDate", expense.expenseDate);
    setValue("paidBy", expense.paidBy || "office");
    setValue("otherPersonName", expense.otherPersonName || "");
    setValue("receiptNumber", expense.receiptNumber || "");
    setValue("isReimbursement", expense.isReimbursement || false);
    setValue("reimbursementStatus", expense.reimbursementStatus || 'pending');
    
    // Set image preview if exists
    const imageSource = getImageSource(expense);
    if (imageSource) {
      setImagePreview(imageSource);
    } else {
      setImagePreview(null);
    }
    setSelectedImage(null);
    setIsUploading(false); // Reset loading state
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this expense? This will also delete the associated receipt image.")) {
      deleteMutation.mutate(id);
    }
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({ title: "Error", description: "Please select a valid image file", variant: "destructive" });
        return;
      }
      
      // Validate file size (10MB limit - will be compressed)
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "Error", description: "Image size should be less than 10MB", variant: "destructive" });
        return;
      }

      setSelectedImage(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleOpenDialog = () => {
    setEditingExpense(null);
    reset();
    setSelectedImage(null);
    setImagePreview(null);
    setIsUploading(false); // Reset loading state
    setIsDialogOpen(true);
  };

  const openImageModal = (imageUrl: string) => {
    setSelectedImageUrl(imageUrl);
    setShowImageModal(true);
  };

  const closeImageModal = () => {
    setShowImageModal(false);
    setSelectedImageUrl(null);
  };

  const openExpenseDetails = (expense: Expense) => {
    console.log('Opening expense details:', expense);
    console.log('Receipt image data:', (expense as any).receiptImageData ? 'Base64 data present' : 'No base64 data');
    console.log('Receipt image URL:', expense.receiptImageUrl);
    console.log('Has image:', hasImage(expense));
    console.log('Image source:', getImageSource(expense) ? 'Available' : 'Not available');
    setSelectedExpense(expense);
    setShowExpenseDetails(true);
  };

  const closeExpenseDetails = () => {
    setShowExpenseDetails(false);
    setSelectedExpense(null);
  };

  const exportToCSV = () => {
    const csvContent = [
      ["Description", "Category", "Amount", "Payment Mode", "Paid By", "Person Name", "Expense Date", "Receipt Number", "Receipt Image"],
      ...expenses.map((expense: Expense) => [
        expense.description || "",
        expense.category,
        expense.amount,
        expense.paymentMode || "",
        expense.paidBy === 'office' ? 'Office' : expense.paidBy === 'other' ? 'Other' : expense.paidBy || "",
        expense.otherPersonName || "",
        expense.expenseDate,
        expense.receiptNumber || "",
        hasImage(expense) ? "Yes" : "No"
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "expenses.csv";
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast({ title: "Success", description: "Expenses exported successfully!" });
  };

  const getCategoryColor = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'office rent': return 'bg-blue-100 text-blue-800';
      case 'office expense': return 'bg-indigo-100 text-indigo-800';
      case 'marketing': return 'bg-green-100 text-green-800';
      case 'bills': return 'bg-amber-100 text-amber-800';
      case 'salaries': return 'bg-emerald-100 text-emerald-800';
      case 'hardware purchase': return 'bg-purple-100 text-purple-800';
      case 'miscellaneous': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method?.toLowerCase()) {
      case 'cash': return <Banknote className="w-4 h-4" />;
      case 'card': return <CreditCard className="w-4 h-4" />;
      case 'bank_transfer': return <Banknote className="w-4 h-4" />;
      case 'upi': return <Smartphone className="w-4 h-4" />;
      case 'cheque': return <FileText className="w-4 h-4" />;
      default: return <RupeeIcon className="w-4 h-4" />;
    }
  };

  const getPaymentMethodColor = (method: string) => {
    switch (method?.toLowerCase()) {
      case 'cash': return 'bg-green-100 text-green-800';
      case 'card': return 'bg-blue-100 text-blue-800';
      case 'bank_transfer': return 'bg-purple-100 text-purple-800';
      case 'upi': return 'bg-orange-100 text-orange-800';
      case 'cheque': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loading size="md" color="primary" text="Loading expenses..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Enhanced Modern Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/60 shadow-sm mb-6">
        <div className="max-w-10xl mx-auto px-4 sm:px-6 py-4 lg:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-red-600 to-pink-600 rounded-xl shadow-md">
                <Wallet className="w-6 h-6 text-white" />
              </div>
        <div>
                <h1 className="text-2xl font-bold text-slate-800">
                  Expense Management
                </h1>
                <p className="text-sm text-slate-500">
                  Track and manage business expenses with receipt images
                </p>
        </div>
            </div>
            
                         <div className="flex flex-wrap items-center gap-2 sm:gap-3">
               <Button
                 onClick={exportToCSV}
                 variant="outline"
                 className="border-slate-200 hover:bg-slate-50"
                 size="sm"
               >
            <Download className="w-4 h-4 mr-2" />
                 <span className="hidden sm:inline">Export CSV</span>
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
                   <Button 
                     onClick={handleOpenDialog} 
                     className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white"
                     size="sm"
                   >
                <Plus className="w-4 h-4 mr-2" />
                     <span className="hidden sm:inline">Add Expense</span>
              </Button>
            </DialogTrigger>
               </Dialog>
             </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-10xl mx-auto px-4 sm:px-6 pb-8">
        {/* Modern Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <Card className="border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Total Expenses</p>
                  <p className="text-2xl font-bold text-slate-900">₹{totalExpenses.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl shadow-sm">
                  <RupeeIcon className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">This Month</p>
                  <p className="text-2xl font-bold text-amber-600">₹{thisMonthExpenses.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-sm">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Total Count</p>
                  <p className="text-2xl font-bold text-blue-600">{totalExpensesCount}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-sm">
                  <FileText className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Pending Request</p>
                  <p className="text-2xl font-bold text-yellow-600">₹{pendingReimbursementAmount.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-xl shadow-sm">
                  <Clock className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Reimbursed</p>
                  <p className="text-2xl font-bold text-emerald-600">₹{reimbursedAmount.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-sm">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Tabs Structure */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg mb-6">
            <TabsTrigger 
              value="expenses" 
              className="flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
            >
              <FileText className="w-4 h-4" />
              <span>Expense Records</span>
            </TabsTrigger>
            <TabsTrigger 
              value="analytics" 
              className="flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-md transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
            >
              <BarChart3 className="w-4 h-4" />
              <span>Analytics & Insights</span>
            </TabsTrigger>
          </TabsList>

          {/* Expenses Tab */}
          <TabsContent value="expenses" className="space-y-6">
            
        {/* Modern Search and Filters */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Search expenses by description, category, person name, or receipt number..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            
            <Button
              onClick={() => setShowFilters(!showFilters)}
              variant="outline"
              className="flex items-center gap-2 border-slate-200 hover:bg-slate-50"
            >
              <Filter className="w-4 h-4" />
              <span>Filters</span>
              <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${showFilters ? 'rotate-180' : ''}`} />
            </Button>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  onClick={handleOpenDialog} 
                  className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white shadow-sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Add Expense</span>
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>

          {/* Collapsible Filters Panel */}
          <div className={`mt-4 overflow-hidden transition-all duration-500 ease-in-out ${
            showFilters ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
          }`}>
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Category</Label>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="border-slate-200">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="Office Rent">Office Rent</SelectItem>
                      <SelectItem value="Office Expense">Office Expense</SelectItem>
                      <SelectItem value="Marketing">Marketing</SelectItem>
                      <SelectItem value="Bills">Bills</SelectItem>
                      <SelectItem value="Salaries">Salaries</SelectItem>
                      <SelectItem value="Hardware Purchase">Hardware Purchase</SelectItem>
                      <SelectItem value="Miscellaneous">Miscellaneous</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Payment Mode</Label>
                  <Select value={filterPaymentMode} onValueChange={setFilterPaymentMode}>
                    <SelectTrigger className="border-slate-200">
                      <SelectValue placeholder="All Methods" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700">Reimbursement</Label>
                  <Select value={filterReimbursement} onValueChange={setFilterReimbursement}>
                    <SelectTrigger className="h-11 border-2 border-gray-200 focus:border-blue-500 rounded-xl">
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-2">
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="reimbursement">All Reimbursements</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="reimbursed">Reimbursed</SelectItem>
                      <SelectItem value="non-reimbursement">Non-Reimbursement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

              </div>

              {/* Date Filters Section */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  <h4 className="text-lg font-semibold text-gray-800">Date Filters</h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Specific Date Filter */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Specific Date
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="flex-1 h-11 border-2 border-gray-200 focus:border-blue-500 rounded-xl"
                      />
                      {selectedDate && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedDate('')}
                          className="h-11 px-4 rounded-xl border-2"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Month Filter */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Month & Year
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="flex-1 h-11 border-2 border-gray-200 focus:border-blue-500 rounded-xl"
                      />
                      {selectedMonth && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedMonth('')}
                          className="h-11 px-4 rounded-xl border-2"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Clear Filters Button */}
              {(searchTerm || filterCategory !== 'all' || filterPaymentMode !== 'all' || filterReimbursement !== 'all' || selectedDate || selectedMonth) && (
                <div className="mt-4 flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm('');
                      setFilterCategory('all');
                      setFilterPaymentMode('all');
                      setFilterReimbursement('all');
                      setSelectedDate('');
                      setSelectedMonth('');
                    }}
                    className="h-10 px-6 rounded-xl border-2 border-gray-300 hover:border-red-400 hover:text-red-600 transition-all duration-200"
                  >
                    Clear All Filters
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
          

        {/* Expenses Content */}
        <div className="space-y-6">
          {/* Enhanced View Mode Toggle with Title */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                Expense Records
              </h2>
              <p className="text-gray-600">View and manage your expenses in grid or list format</p>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  {filteredExpenses.length} expenses found
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  ₹{filteredExpenses.reduce((sum, expense) => sum + (typeof expense.amount === 'string' ? parseFloat(expense.amount) : expense.amount), 0).toLocaleString()} total
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">View Mode:</span>
              <div className="flex items-center gap-1 bg-white/80 backdrop-blur-sm p-1 rounded-xl border border-gray-200">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className={`px-4 py-2 rounded-lg ${
                    viewMode === 'grid' 
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white' 
                      : ''
                  }`}
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Grid
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className={`px-4 py-2 rounded-lg ${
                    viewMode === 'list' 
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white' 
                      : ''
                  }`}
                >
                  <Table className="w-4 h-4 mr-2" />
                  List
                </Button>
              </div>
            </div>
          </div>
          
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedData.map((expense) => (
                <Card key={expense.id} className="cursor-pointer border border-gray-200 bg-white" onClick={() => openExpenseDetails(expense)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-pink-600 rounded-lg flex items-center justify-center flex-shrink-0">
                          <RupeeIcon className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <CardTitle className="text-xl font-bold text-gray-900">₹{(typeof expense.amount === 'string' ? parseFloat(expense.amount) : expense.amount).toLocaleString()}</CardTitle>
                          <p className="text-sm text-gray-600 font-medium">{expense.category}</p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {expense.description && (
                      <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed">{expense.description}</p>
                    )}
                    
                    <div className="flex items-center space-x-2 text-sm bg-gray-50 rounded-lg p-2">
                      <Calendar className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <span className="text-gray-700 font-medium">{expense.expenseDate}</span>
                    </div>
                    
                    <div className="flex flex-wrap gap-2">
                      {expense.paymentMode && (
                        <Badge className={`${getPaymentMethodColor(expense.paymentMode)} text-xs px-3 py-1 rounded-full font-semibold`}>
                          <div className="flex items-center gap-1">
                            {getPaymentMethodIcon(expense.paymentMode)}
                            {expense.paymentMode.replace('_', ' ')}
                          </div>
                        </Badge>
                      )}

                      {/* Paid By Badge */}
                      {expense.paidBy === 'office' ? (
                        <Badge className="bg-blue-100 text-blue-800 border border-blue-200 text-xs px-3 py-1 rounded-full font-semibold">
                          Office
                        </Badge>
                      ) : expense.paidBy === 'other' ? (
                        <Badge className="bg-orange-100 text-orange-800 border border-orange-200 text-xs px-3 py-1 rounded-full font-semibold">
                          {expense.otherPersonName || 'Other Person'}
                        </Badge>
                      ) : null}

                      {expense.isReimbursement && (
                        <Badge className={`text-xs px-3 py-1 rounded-full font-semibold ${
                          expense.reimbursementStatus === 'pending' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' :
                          expense.reimbursementStatus === 'approved' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                          'bg-green-100 text-green-800 border border-green-200'
                        }`}>
                          {expense.reimbursementStatus === 'pending' ? 'Pending' :
                           expense.reimbursementStatus === 'approved' ? 'Approved' :
                           'Reimbursed'}
                        </Badge>
                      )}
                    </div>
                    
                    
                    {expense.receiptNumber && (
                      <div className="flex items-center space-x-2 text-sm">
                        <Receipt className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <span className="text-gray-600">{expense.receiptNumber}</span>
                      </div>
                    )}

                    {/* Receipt Image Thumbnail */}
                    {hasImage(expense) ? (
                      <div className="relative group overflow-hidden rounded-lg">
                        <img
                          src={getImageSource(expense)!}
                          alt="Receipt"
                          className="w-full h-20 object-cover rounded border cursor-pointer transition-all duration-300 group-hover:scale-110"
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log('Opening image modal with URL:', expense.receiptImageUrl);
                            openImageModal(getImageSource(expense)!);
                          }}
                          onLoad={() => {
                            console.log('Receipt image loaded successfully:', expense.receiptImageUrl);
                          }}
                          onError={(e) => {
                            console.error('Receipt image failed to load:', expense.receiptImageUrl);
                            e.currentTarget.style.display = 'none';
                            // Show fallback
                            const fallback = e.currentTarget.parentElement?.querySelector('.image-fallback');
                            if (fallback) {
                              (fallback as HTMLElement).style.display = 'flex';
                            }
                          }}
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <div className="bg-white bg-opacity-90 p-1 rounded-full shadow-lg">
                            <Eye className="w-4 h-4 text-gray-700" />
                          </div>
                        </div>
                        {/* Fallback for failed images */}
                        <div className="image-fallback hidden absolute inset-0 bg-gray-100 rounded border items-center justify-center">
                          <div className="text-center">
                            <ImageIcon className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                            <p className="text-xs text-gray-500">Image failed to load</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-20 bg-gray-100 rounded border flex items-center justify-center">
                        <div className="text-center">
                          <ImageIcon className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                          <p className="text-xs text-gray-500">No receipt</p>
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-2 pt-2">
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(expense);
                          }}
                          className="flex-1"
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(expense.id);
                          }}
                          className="flex-1"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            

            <Card className="border border-slate-200/60 shadow-sm overflow-hidden bg-white">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50 border-b border-slate-200">
                      <TableRow>
                        <SortableTableHead sortConfig={sortConfig} sortKey="amount" requestSort={requestSort}>Amount</SortableTableHead>
                        <SortableTableHead sortConfig={sortConfig} sortKey="description" requestSort={requestSort}>Description</SortableTableHead>
                        <SortableTableHead sortConfig={sortConfig} sortKey="category" requestSort={requestSort}>Category</SortableTableHead>
                        <SortableTableHead sortConfig={sortConfig} sortKey="paymentMode" requestSort={requestSort}>Payment Mode</SortableTableHead>
                        <SortableTableHead sortConfig={sortConfig} sortKey="paidBy" requestSort={requestSort}>Paid By</SortableTableHead>
                        <SortableTableHead sortConfig={sortConfig} sortKey="expenseDate" requestSort={requestSort}>Date</SortableTableHead>
                        <SortableTableHead sortConfig={sortConfig} sortKey="isReimbursement" requestSort={requestSort}>Reimbursement</SortableTableHead>
                        <TableHead className="font-semibold text-slate-700 py-4">Receipt</TableHead>
                        <TableHead className="font-semibold text-slate-700 py-4 pr-6 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedData.map((expense) => (
                        <TableRow key={expense.id} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50/50 transition-colors" onClick={() => openExpenseDetails(expense)}>
                          <TableCell className="font-bold text-lg text-slate-700 py-4 pl-6">₹{(typeof expense.amount === 'string' ? parseFloat(expense.amount) : expense.amount).toLocaleString()}</TableCell>
                          <TableCell className="max-w-xs truncate font-medium text-slate-800 py-4">
                            <div className="flex flex-col">
                              <span>{expense.description || 'No description'}</span>
                              {expense.receiptNumber && <span className="text-xs text-slate-400 mt-0.5">#{expense.receiptNumber}</span>}
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <Badge className={`${getCategoryColor(expense.category)} px-2.5 py-0.5 rounded-full font-medium border border-opacity-20`}>
                              {expense.category}
                            </Badge>
                          </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-slate-600">
                             <div className={`p-1.5 rounded-md ${getPaymentMethodColor(expense.paymentMode)} bg-opacity-20`}>
                              {getPaymentMethodIcon(expense.paymentMode)}
                             </div>
                             <span className="text-sm font-medium capitalize">{expense.paymentMode.replace('_', ' ')}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          {expense.paidBy === 'office' ? (
                            <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full">
                              Office
                            </Badge>
                          ) : expense.paidBy === 'other' ? (
                            <div className="flex flex-col">
                              <Badge variant="outline" className="border-orange-200 text-orange-700 bg-orange-50 px-2.5 py-0.5 rounded-full w-fit">
                                Other
                              </Badge>
                              <span className="text-xs text-slate-500 mt-1 ml-1">{expense.otherPersonName}</span>
                            </div>
                          ) : (
                            <Badge variant="outline" className="border-slate-200 text-slate-700 bg-slate-50 px-2.5 py-0.5 rounded-full">
                              {expense.paidBy || 'Not specified'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-600 font-medium">{new Date(expense.expenseDate).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {expense.isReimbursement ? (
                            <Badge className={`text-xs px-2.5 py-0.5 border ${
                              expense.reimbursementStatus === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              expense.reimbursementStatus === 'approved' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              {expense.reimbursementStatus === 'pending' ? 'Pending' :
                               expense.reimbursementStatus === 'approved' ? 'Approved' :
                               'Reimbursed'}
                            </Badge>
                          ) : (
                            <span className="text-slate-400 text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {hasImage(expense) ? (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  console.log('Opening image modal with URL:', expense.receiptImageUrl);
                                  openImageModal(getImageSource(expense)!);
                                }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </TableCell>
                        <TableCell className="pr-6 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(expense);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-slate-500 hover:text-red-600 hover:bg-red-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(expense.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {filteredExpenses.length === 0 && (
            <div className="text-center py-16 bg-white border border-slate-200 rounded-lg shadow-sm">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <RupeeIcon className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">No expenses found</h3>
              <p className="text-slate-500 mb-8 max-w-md mx-auto">Try adjusting your search or filter criteria, or add a new expense to get started.</p>
              <Button 
                onClick={handleOpenDialog}
                className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white px-6 py-2 rounded-lg font-medium shadow-sm transition-all"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add First Expense
              </Button>
            </div>
          )}
        </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6 mt-8">
            <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    Analytics & Insights
                  </h2>
                  <p className="text-gray-600">Comprehensive expense analytics and reimbursement tracking</p>
                </div>
              </div>
              <ExpenseAnalytics expenses={expenses} />
            </div>
          </TabsContent>
        </Tabs>

        {/* Expense Form Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-[700px] max-h-[95vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">
                {editingExpense ? "Edit Expense" : "Add New Expense"}
              </DialogTitle>
              <DialogDescription>
                {editingExpense ? "Update the expense details below." : "Fill in the details to add a new expense."}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit(handleCreateOrUpdate)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-base font-medium">
                    Description
                  </Label>
                  <Input
                    id="description"
                    {...register("description")}
                    placeholder="Enter expense description"
                    className="h-12 text-base"
                  />
                  {errors.description && (
                    <p className="text-sm text-red-600">{errors.description.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category" className="text-base font-medium">
                    Category <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Select
                      value={watch("category")}
                      onValueChange={(value) => setValue("category", value)}
                    >
                      <SelectTrigger className="h-12 text-base">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Office Rent">Office Rent</SelectItem>
                        <SelectItem value="Office Expense">Office Expense</SelectItem>
                        <SelectItem value="Marketing">Marketing</SelectItem>
                        <SelectItem value="Bills">Bills</SelectItem>
                        <SelectItem value="Salaries">Salaries</SelectItem>
                        <SelectItem value="Hardware Purchase">Hardware Purchase</SelectItem>
                        <SelectItem value="Miscellaneous">Miscellaneous</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {errors.category && (
                    <p className="text-sm text-red-600">{errors.category.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-base font-medium">
                    Amount <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    {...register("amount", { 
                      required: "Amount is required",
                      min: { value: 0.01, message: "Amount must be greater than 0" }
                    })}
                    placeholder="0.00"
                    className="h-12 text-base"
                  />
                  {errors.amount && (
                    <p className="text-sm text-red-600">{errors.amount.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paymentMode" className="text-base font-medium">
                    Payment Mode <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Select
                      value={watch("paymentMode")}
                      onValueChange={(value) => setValue("paymentMode", value)}
                    >
                      <SelectTrigger className="h-12 text-base">
                        <SelectValue placeholder="Select payment mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {errors.paymentMode && (
                    <p className="text-sm text-red-600">{errors.paymentMode.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paidBy" className="text-base font-medium">
                    Paid By <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={watch("paidBy")}
                    onValueChange={(value) => {
                      setValue("paidBy", value);
                      // Automatically set reimbursement to true when "Other" is selected
                      if (value === 'other') {
                        setValue("isReimbursement", true);
                        setValue("reimbursementStatus", 'pending');
                      } else {
                        setValue("isReimbursement", false);
                        setValue("reimbursementStatus", 'pending');
                      }
                      console.log('Paid By changed to:', value, 'Reimbursement set to:', value === 'other');
                    }}
                  >
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="Select who paid for this expense" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="office">Office</SelectItem>
                      <SelectItem value="other">Other (Personal Payment)</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.paidBy && (
                    <p className="text-sm text-red-600">{errors.paidBy.message}</p>
                  )}
                </div>

                {/* Other Person Name Field - Only show when "Other" is selected */}
                {paidByValue === 'other' && (
                  <div className="space-y-2">
                    <Label htmlFor="otherPersonName" className="text-base font-medium">
                      Person Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="otherPersonName"
                      {...register("otherPersonName", { 
                        required: paidByValue === 'other' ? "Person name is required when 'Other' is selected" : false 
                      })}
                      placeholder="Enter the name of the person who paid"
                      className="h-12 text-base"
                    />
                    {errors.otherPersonName && (
                      <p className="text-sm text-red-600">{errors.otherPersonName.message}</p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="expenseDate" className="text-base font-medium">
                    Expense Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="expenseDate"
                    type="date"
                    {...register("expenseDate", { required: "Expense date is required" })}
                    className="h-12 text-base"
                  />
                  {errors.expenseDate && (
                    <p className="text-sm text-red-600">{errors.expenseDate.message}</p>
                  )}
                </div>


                <div className="space-y-2">
                  <Label htmlFor="receiptNumber" className="text-base font-medium">
                    Receipt Number
                  </Label>
                  <Input
                    id="receiptNumber"
                    {...register("receiptNumber")}
                    placeholder="Enter receipt number"
                    className="h-12 text-base"
                  />
                </div>
              </div>

              {/* Reimbursement Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="isReimbursement" className="text-base font-medium">
                    Reimbursement Required
                  </Label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isReimbursement"
                      checked={watch("isReimbursement")}
                      onChange={(e) => {
                        setValue("isReimbursement", e.target.checked);
                        if (!e.target.checked) {
                          setValue("reimbursementStatus", "pending");
                        }
                        console.log('Reimbursement checkbox changed to:', e.target.checked);
                      }}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="isReimbursement" className="text-sm text-gray-700">
                      This expense was paid personally and needs reimbursement
                    </label>
                  </div>
                </div>

                {/* Only show reimbursement status when reimbursement is required */}
                {watch("isReimbursement") && (
                  <div className="space-y-2">
                    <Label htmlFor="reimbursementStatus" className="text-base font-medium">
                      Reimbursement Status
                    </Label>
                    <Select
                      value={watch("reimbursementStatus") as "pending" | "approved" | "reimbursed"}
                      onValueChange={(value) => {
                        setValue("reimbursementStatus", value as "pending" | "approved" | "reimbursed");
                        console.log('Reimbursement status changed to:', value);
                      }}
                    >
                      <SelectTrigger className="h-12 text-base">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="reimbursed">Reimbursed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-base font-medium">Receipt Image</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer h-[200px] flex flex-col items-center justify-center"
                     onClick={() => document.getElementById('receiptImage')?.click()}>
                  <input
                    id="receiptImage"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleImageSelect}
                  />
                  
                  {imagePreview ? (
                    <div className="relative w-full h-full">
                      <img
                        src={imagePreview}
                        alt="Receipt preview"
                        className="w-full h-full object-cover rounded-lg"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all duration-200 rounded-lg flex items-center justify-center">
                        <div className="opacity-0 hover:opacity-100 transition-opacity duration-200 flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              openImageModal(imagePreview);
                            }}
                            className="bg-white/90 hover:bg-white"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setImagePreview(null);
                              setSelectedImage(null);
                              if (fileInputRef.current) {
                                fileInputRef.current.value = '';
                              }
                            }}
                            className="bg-red-500/90 hover:bg-red-500"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-8 h-8 text-gray-400" />
                      <p className="text-sm text-gray-600">Click to upload receipt image</p>
                      <p className="text-xs text-gray-500">PNG, JPG up to 5MB</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    reset();
                    setSelectedImage(null);
                    setImagePreview(null);
                    setEditingExpense(null);
                    setIsUploading(false);
                    setMutationProgress('');
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending || isUploading}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                >
                  {(isUploading || createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  {editingExpense 
                    ? (updateMutation.isPending ? "Updating..." : "Update Expense")
                    : (createMutation.isPending ? "Adding..." : "Add Expense")
                  }
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Expense Details Modal */}
        {showExpenseDetails && selectedExpense && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
              {/* Header */}
              <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">Expense Details</h2>
                    <p className="text-blue-100 mt-1">Complete expense information</p>
                  </div>
                  <Button
                    onClick={closeExpenseDetails}
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/20 rounded-full p-2"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-120px)] hide-scrollbar">
                {/* Amount and Category Header */}
                <div className="bg-gradient-to-r from-gray-50 to-blue-50 p-6 rounded-xl border">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-3xl font-bold text-gray-900">
                        ₹{(typeof selectedExpense.amount === 'string' ? parseFloat(selectedExpense.amount) : selectedExpense.amount).toLocaleString()}
                      </h3>
                      <p className="text-lg text-gray-600 capitalize mt-1">{selectedExpense.category}</p>
                    </div>
                    <Badge className={`${getCategoryColor(selectedExpense.category)} text-white px-4 py-2 text-sm`}>
                      {selectedExpense.category.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>

                {/* Description */}
                {selectedExpense.description && (
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">Description</h4>
                    <p className="text-gray-700 leading-relaxed">{selectedExpense.description}</p>
                  </div>
                )}

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Expense Information</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Date:</span>
                        <span className="font-medium">{selectedExpense.expenseDate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Payment Mode:</span>
                        <Badge className={getPaymentMethodColor(selectedExpense.paymentMode)}>
                          <div className="flex items-center gap-1">
                            {getPaymentMethodIcon(selectedExpense.paymentMode)}
                            {selectedExpense.paymentMode.replace('_', ' ')}
                          </div>
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Paid By:</span>
                        <div>
                          {selectedExpense.paidBy === 'office' ? (
                            <Badge className="bg-blue-100 text-blue-800 border border-blue-200 px-3 py-1 rounded-full font-semibold">
                              Office
                            </Badge>
                          ) : selectedExpense.paidBy === 'other' ? (
                            <Badge className="bg-orange-100 text-orange-800 border border-orange-200 px-3 py-1 rounded-full font-semibold">
                              {selectedExpense.otherPersonName || 'Other Person'}
                            </Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-800 border border-gray-200 px-3 py-1 rounded-full font-semibold">
                              {selectedExpense.paidBy || 'Not specified'}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {selectedExpense.receiptNumber && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Receipt Number:</span>
                          <span className="font-medium">{selectedExpense.receiptNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Record Information</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Created At:</span>
                        <span className="font-medium">
                          {selectedExpense.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                        </span>
                      </div>
                      {selectedExpense.updatedAt && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Updated At:</span>
                          <span className="font-medium">
                            {selectedExpense.updatedAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Receipt Image */}
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                 <h4 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4 flex items-center gap-2">
                   <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                   Receipt Image
                 </h4>
                 
                 {hasImage(selectedExpense) ? (
                   <div className="space-y-3">
                     <div className="relative group overflow-hidden rounded-lg border-2 border-gray-200 bg-gray-50 min-h-[200px] flex items-center justify-center">
                       <img
                         src={getImageSource(selectedExpense)!}
                         alt="Receipt"
                         className="w-full h-auto max-h-64 sm:max-h-96 object-contain cursor-pointer transition-all duration-300 group-hover:scale-105"
                         onClick={() => openImageModal(getImageSource(selectedExpense)!)}
                         onLoad={() => {
                           console.log('Image loaded successfully:', selectedExpense.receiptImageUrl);
                         }}
                         onError={(e) => {
                           console.error('Receipt image failed to load:', selectedExpense.receiptImageUrl);
                           e.currentTarget.style.display = 'none';
                           // Show error message
                           const container = e.currentTarget.parentElement;
                           if (container) {
                             container.innerHTML = `
                               <div class="flex flex-col items-center gap-2">
                                 <ImageIcon class="w-8 h-8 text-gray-400" />
                                 <p class="text-sm text-gray-500">Failed to load image</p>
                                 <p class="text-xs text-gray-400 break-all">URL: ${selectedExpense.receiptImageUrl}</p>
                               </div>
                             `;
                           }
                         }}
                       />
                     </div>
                   </div>
                 ) : (
                   <div className="text-center py-8">
                     <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                     <p className="text-gray-600">No receipt image available</p>
                     {selectedExpense.receiptImageUrl && (
                       <p className="text-gray-400 text-xs mt-2">URL: {selectedExpense.receiptImageUrl}</p>
                     )}
                   </div>
                 )}
               </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200">
                  <Button
                    onClick={() => {
                      closeExpenseDetails();
                      handleEdit(selectedExpense);
                    }}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Expense
                  </Button>
                  <Button
                    onClick={() => {
                      closeExpenseDetails();
                      handleDelete(selectedExpense.id);
                    }}
                    variant="destructive"
                    className="flex-1"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Expense
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Image Modal */}
        {selectedImageUrl && (
          <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-50">
            <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center">
              <Button
                onClick={closeImageModal}
                variant="ghost"
                size="sm"
                className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full p-2 z-10"
              >
                <X className="w-6 h-6" />
              </Button>
              <img
                src={selectedImageUrl}
                alt="Receipt"
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}