import type { ModulePermission } from '@shared/permissions';

export type UserRole = 
  | 'director' 
  | 'centre_head' 
  | 'bdm' 
  | 'marketing' 
  | 'digital_marketing' 
  | 'faculty' 
  | 'academic_head'
  | 'accounting'
  | 'designer'
  | 'employee'
  | 'admin'
  | 'accountant'
  | 'pending';

export interface DashboardStats {
  newEnquiries: number;
  admissions: number;
  revenue: number;
  pendingTasks: number;
}

export interface LeadStats {
  cold: number;
  warm: number;
  hot: number;
  converted: number;
}

export interface StudentStats {
  total: number;
  active: number;
  graduated: number;
  dropouts: number;
}

export type { Task, TaskStats as CrmTaskStats } from '@shared/taskTypes';

export interface DashboardTaskStats {
  pending: number;
  completed: number;
  overdue: number;
}

export interface FeeStats {
  totalDue: number;
  totalPaid: number;
  overdue: number;
}

export { ROLE_DEFAULT_PERMISSIONS as ROLE_PERMISSIONS } from '@shared/permissions';

export const ROLE_NAMES: Record<UserRole, string> = {
  director: 'Director',
  centre_head: 'Centre Head',
  bdm: 'BDM (Counselor)',
  marketing: 'Marketing Executive',
  digital_marketing: 'Digital Marketing Executive',
  faculty: 'Faculty',
  academic_head: 'Academic Head',
  accounting: 'Accounting',
  designer: 'Graphic Designer',
  employee: 'Employee',
  admin: 'Administrator',
  accountant: 'Accountant',
  pending: 'Pending Approval',
};

export interface UserProfilePermissions {
  permissionsGranted?: ModulePermission[];
  permissionsRevoked?: ModulePermission[];
}

// Database entity types
export interface PromotionalOffer {
  id: string;
  text: string;
  active: boolean;
  priority: number;
  createdAt: any; // Firestore Timestamp or Date
  startDate?: any; // Firestore Timestamp or Date
  endDate?: any; // Firestore Timestamp or Date
}

export interface Lead {
  id: number;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  courseInterest: number;
  status: string;
  source: string;
  lastContactDate?: Date;
  nextFollowUpDate?: Date;
  assignedTo?: string;
  centreId?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StaffMember {
  id: string;
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone?: string;
  address?: string;
  joiningDate?: Date;
  status: 'active' | 'inactive' | 'suspended';
  profileImage?: string;
  createdAt: Date;
  updatedAt: Date;
  approved: boolean;
  password?: string;
}

export interface Student {
  id: number;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  dateOfBirth?: Date;
  address?: string;
  courseId?: number;
  batchId?: number;
  admissionDate?: Date;
  status: string;
  totalFee?: number;
  paidAmount?: number;
  centreId?: string;
  leadId?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Course {
  id: number;
  name: string;
  duration: number;
  fee: number;
  description?: string;
  isActive: boolean;
  createdAt: Date;
}

export interface FeeTransaction {
  id: number;
  studentId: number;
  centreId?: string;
  amount: number;
  paymentMethod?: string;
  transactionType: string;
  status: string;
  dueDate?: Date;
  paidDate?: Date;
  notes?: string;
  createdAt: Date;
}

export interface Announcement {
  id: number;
  title: string;
  content: string;
  targetRole?: string;
  centreId?: string;
  isActive: boolean;
  createdBy?: string;
  createdAt: Date;
}
