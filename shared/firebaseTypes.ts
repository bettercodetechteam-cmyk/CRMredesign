// Firebase Firestore Data Types for ZICA ZIMA CRM
// This replaces the PostgreSQL schema with Firebase-compatible types

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profileImageUrl?: string;
  role: 'director' | 'centre_head' | 'faculty' | 'student' | 'admin';
  centreId?: string;
  phone?: string;
  isActive: boolean;
  approved?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Centre {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  phone?: string;
  email?: string;
  headId?: string;
  isActive: boolean;
  createdAt: Date;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  description?: string;
  duration?: number; // in months
  fees?: number;
  category?: string; // Animation, VFX, Gaming, etc.
  isActive: boolean;
  createdAt: Date;
}

export interface Batch {
  id: string;
  name: string;
  courseId: string;
  centreId: string;
  instructorId?: string;
  startDate?: Date;
  endDate?: Date;
  timings?: string;
  capacity: number;
  currentStrength: number;
  status: 'upcoming' | 'ongoing' | 'completed';
  createdAt: Date;
}

export interface Student {
  id: string;
  userId: string;
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  centreId: string;
  batchId?: string;
  courseId: string;
  course?: string;
  batch?: string;
  admissionDate?: Date;
  status: 'active' | 'inactive' | 'graduated' | 'dropped';
  previousEducation?: string;
  parentName?: string;
  parentPhone?: string;
  address?: string;
  emergencyContact?: string;
  feesBalance?: number;
  feesPaid?: number;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Lead {
  id: string;
  name: string;
  email?: string;
  phone: string;
  centreId: string;
  interestedCourse?: string;
  source?: string; // walk-in, online, referral, etc.
  status: 'new' | 'contacted' | 'interested' | 'converted' | 'lost';
  assignedTo?: string;
  notes?: string;
  followUpDate?: Date;
  convertedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface FeeTransaction {
  id: string;
  studentId: string;
  centreId: string;
  amount: number;
  type: 'admission' | 'monthly' | 'extra';
  paymentMode?: string; // cash, card, online, upi
  transactionId?: string;
  dueDate?: Date;
  paidDate?: Date;
  status: 'pending' | 'paid' | 'overdue';
  remarks?: string;
  createdAt: Date;
}

export interface Assignment {
  id: string;
  title: string;
  description?: string;
  batchId: string;
  courseId: string;
  assignedBy: string;
  assignedDate: Date;
  dueDate: Date;
  maxMarks: number;
  attachments?: string[];
  createdAt: Date;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  submissionText?: string;
  attachments?: string[];
  submittedAt: Date;
  marksObtained?: number;
  feedback?: string;
  evaluatedBy?: string;
  evaluatedAt?: Date;
}

export interface Staff {
  id: string;
  userId: string;
  employeeId: string;
  centreId: string;
  designation: string;
  department?: string;
  joiningDate?: Date;
  salary?: number;
  status: 'active' | 'inactive' | 'terminated';
  reportingTo?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Expense {
  id: string;
  centreId: string;
  category: string; // rent, utilities, marketing, etc.
  amount: number;
  description?: string;
  expenseDate: Date;
  paymentMode?: string;
  approvedBy?: string;
  receipt?: string;
  createdBy: string;
  createdAt: Date;
}

export interface Target {
  id: string;
  centreId?: string;
  assignedTo: string;
  targetType: string; // admissions, revenue, etc.
  targetValue: number;
  achievedValue: number;
  period: 'monthly' | 'quarterly' | 'yearly';
  startDate: Date;
  endDate: Date;
  status: 'active' | 'completed' | 'expired';
  createdAt: Date;
  updatedAt: Date;
}

export interface PerformanceMetric {
  id: string;
  centreId?: string;
  userId: string;
  metricType: string;
  value: number;
  period: string;
  recordedDate: Date;
  createdAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  isRead: boolean;
  createdAt: Date;
}

// Insert types (for creating new records)
export type InsertUser = Omit<User, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
export type InsertCentre = Omit<Centre, 'id' | 'createdAt'> & { id?: string };
export type InsertCourse = Omit<Course, 'id' | 'createdAt'> & { id?: string };
export type InsertBatch = Omit<Batch, 'id' | 'createdAt'> & { id?: string };
export type InsertStudent = Omit<Student, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
export type InsertLead = Omit<Lead, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
export type InsertFeeTransaction = Omit<FeeTransaction, 'id' | 'createdAt'> & { id?: string };
export type InsertAssignment = Omit<Assignment, 'id' | 'createdAt'> & { id?: string };
export type InsertStaff = Omit<Staff, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
export type InsertExpense = Omit<Expense, 'id' | 'createdAt'> & { id?: string };
export type InsertTarget = Omit<Target, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };
export type InsertNotification = Omit<Notification, 'id' | 'createdAt'> & { id?: string };
// Update types (for partial updates)
export type UpdateUser = Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>;
export type UpdateStudent = Partial<Omit<Student, 'id' | 'createdAt' | 'updatedAt'>>;
export type UpdateLead = Partial<Omit<Lead, 'id' | 'createdAt' | 'updatedAt'>>;
export type UpdateNotification = Partial<Omit<Notification, 'id' | 'createdAt'>>; 