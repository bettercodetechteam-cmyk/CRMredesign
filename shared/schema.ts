import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  decimal,
  boolean,
  date,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Users table with role-based authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role").notNull().default("student"),
  centreId: varchar("centre_id"),
  phone: varchar("phone"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Centres table
export const centres = pgTable("centres", {
  id: varchar("id").primaryKey().notNull(),
  name: varchar("name").notNull(),
  address: text("address"),
  city: varchar("city"),
  state: varchar("state"),
  pincode: varchar("pincode"),
  phone: varchar("phone"),
  email: varchar("email"),
  headId: varchar("head_id"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Courses table
export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  code: varchar("code").unique().notNull(),
  description: text("description"),
  duration: integer("duration"), // in months
  fees: decimal("fees", { precision: 10, scale: 2 }),
  category: varchar("category"), // Animation, VFX, Gaming, etc.
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Batches table
export const batches = pgTable("batches", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  courseId: integer("course_id").notNull(),
  centreId: varchar("centre_id").notNull(),
  instructorId: varchar("instructor_id"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  timings: varchar("timings"),
  capacity: integer("capacity").default(20),
  currentStrength: integer("current_strength").default(0),
  status: varchar("status").default("upcoming"), // upcoming, ongoing, completed
  createdAt: timestamp("created_at").defaultNow(),
});

// Students table
export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  studentId: varchar("student_id").unique().notNull(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  email: varchar("email").notNull(),
  phone: varchar("phone").notNull(),
  centreId: varchar("centre_id").notNull(),
  batchId: integer("batch_id"),
  courseId: integer("course_id").notNull(),
  course: varchar("course"),
  batch: varchar("batch"),
  admissionDate: date("admission_date"),
  status: varchar("status").default("active"), // active, inactive, graduated, dropped
  previousEducation: text("previous_education"),
  parentName: varchar("parent_name"),
  parentPhone: varchar("parent_phone"),
  address: text("address"),
  emergencyContact: varchar("emergency_contact"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Leads table for enquiry management
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  email: varchar("email"),
  phone: varchar("phone").notNull(),
  centreId: varchar("centre_id").notNull(),
  interestedCourse: varchar("interested_course"),
  source: varchar("source"), // walk-in, online, referral, etc.
  status: varchar("status").default("new"), // new, contacted, interested, converted, lost
  assignedTo: varchar("assigned_to"),
  notes: text("notes"),
  contactedDate: date("contacted_date"),
  followUpDate: date("follow_up_date"),
  nextFollowUpDate: date("next_follow_up_date"),
  followUpNotificationDone: boolean("follow_up_notification_done").default(false),
  followUpDoneAt: timestamp("follow_up_done_at"),
  convertedAt: timestamp("converted_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Fee transactions table
export const feeTransactions = pgTable("fee_transactions", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  centreId: varchar("centre_id").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  type: varchar("type").notNull(), // admission, monthly, extra
  paymentMode: varchar("payment_mode"), // cash, card, online, upi
  transactionId: varchar("transaction_id"),
  dueDate: date("due_date"),
  paidDate: date("paid_date"),
  status: varchar("status").default("pending"), // pending, paid, overdue
  remarks: text("remarks"),
  createdAt: timestamp("created_at").defaultNow(),
});


// Teacher Course Assignments table
export const teacherCourseAssignments = pgTable("teacher_course_assignments", {
  id: serial("id").primaryKey(),
  teacherId: varchar("teacher_id").notNull(),
  courseId: integer("course_id").notNull(),
  batchId: integer("batch_id").notNull(),
  assignedBy: varchar("assigned_by").notNull(), // who assigned this teacher
  assignedAt: timestamp("assigned_at").defaultNow(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Assignments table
export const assignments = pgTable("assignments", {
  id: serial("id").primaryKey(),
  title: varchar("title").notNull(),
  description: text("description"),
  batchId: integer("batch_id").notNull(),
  courseId: integer("course_id").notNull(),
  assignedBy: varchar("assigned_by").notNull(),
  assignedDate: date("assigned_date").notNull(),
  dueDate: date("due_date").notNull(),
  maxMarks: integer("max_marks").default(100),
  attachments: jsonb("attachments"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Assignment submissions table
export const assignmentSubmissions = pgTable("assignment_submissions", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignment_id").notNull(),
  studentId: integer("student_id").notNull(),
  submissionText: text("submission_text"),
  attachments: jsonb("attachments"),
  submittedAt: timestamp("submitted_at").defaultNow(),
  marksObtained: integer("marks_obtained"),
  feedback: text("feedback"),
  evaluatedBy: varchar("evaluated_by"),
  evaluatedAt: timestamp("evaluated_at"),
});

// Staff table
export const staff = pgTable("staff", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  employeeId: varchar("employee_id").unique().notNull(),
  centreId: varchar("centre_id").notNull(),
  designation: varchar("designation").notNull(),
  department: varchar("department"),
  joiningDate: date("joining_date"),
  salary: decimal("salary", { precision: 10, scale: 2 }),
  status: varchar("status").default("active"), // active, inactive, terminated
  reportingTo: varchar("reporting_to"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Expenses table
export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  centreId: varchar("centre_id").notNull(),
  category: varchar("category").notNull(), // rent, utilities, marketing, etc.
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  expenseDate: date("expense_date").notNull(),
  paymentMode: varchar("payment_mode"),
  approvedBy: varchar("approved_by"),
  receipt: varchar("receipt_url"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Targets table
export const targets = pgTable("targets", {
  id: serial("id").primaryKey(),
  centreId: varchar("centre_id"),
  assignedTo: varchar("assigned_to").notNull(),
  targetType: varchar("target_type").notNull(), // admissions, revenue, etc.
  targetValue: decimal("target_value", { precision: 10, scale: 2 }).notNull(),
  achievedValue: decimal("achieved_value", { precision: 10, scale: 2 }).default("0"),
  period: varchar("period").notNull(), // monthly, quarterly, yearly
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: varchar("status").default("active"), // active, completed, expired
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Performance metrics table
export const performanceMetrics = pgTable("performance_metrics", {
  id: serial("id").primaryKey(),
  centreId: varchar("centre_id"),
  userId: varchar("user_id").notNull(),
  metricType: varchar("metric_type").notNull(),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  period: varchar("period").notNull(),
  recordedDate: date("recorded_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Notifications table
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  type: varchar("type").default("info"), // info, warning, success, error
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Define relationships
export const userRelations = relations(users, ({ one, many }) => ({
  centre: one(centres, {
    fields: [users.centreId],
    references: [centres.id],
  }),
  student: one(students, {
    fields: [users.id],
    references: [students.userId],
  }),
  staff: one(staff, {
    fields: [users.id],
    references: [staff.userId],
  }),
  notifications: many(notifications),
}));

export const centreRelations = relations(centres, ({ one, many }) => ({
  head: one(users, {
    fields: [centres.headId],
    references: [users.id],
  }),
  users: many(users),
  students: many(students),
  batches: many(batches),
  staff: many(staff),
  leads: many(leads),
  expenses: many(expenses),
}));

export const courseRelations = relations(courses, ({ many }) => ({
  batches: many(batches),
  students: many(students),
  assignments: many(assignments),
  teacherAssignments: many(teacherCourseAssignments),
}));

export const batchRelations = relations(batches, ({ one, many }) => ({
  course: one(courses, {
    fields: [batches.courseId],
    references: [courses.id],
  }),
  centre: one(centres, {
    fields: [batches.centreId],
    references: [centres.id],
  }),
  instructor: one(users, {
    fields: [batches.instructorId],
    references: [users.id],
  }),
  students: many(students),
  teacherAssignments: many(teacherCourseAssignments),
  assignments: many(assignments),
}));

export const studentRelations = relations(students, ({ one, many }) => ({
  user: one(users, {
    fields: [students.userId],
    references: [users.id],
  }),
  centre: one(centres, {
    fields: [students.centreId],
    references: [centres.id],
  }),
  batch: one(batches, {
    fields: [students.batchId],
    references: [batches.id],
  }),
  course: one(courses, {
    fields: [students.courseId],
    references: [courses.id],
  }),
  feeTransactions: many(feeTransactions),
  assignmentSubmissions: many(assignmentSubmissions),
}));


// Teacher Course Assignment relations
export const teacherCourseAssignmentRelations = relations(teacherCourseAssignments, ({ one }) => ({
  teacher: one(users, {
    fields: [teacherCourseAssignments.teacherId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [teacherCourseAssignments.courseId],
    references: [courses.id],
  }),
  batch: one(batches, {
    fields: [teacherCourseAssignments.batchId],
    references: [batches.id],
  }),
  assignedByUser: one(users, {
    fields: [teacherCourseAssignments.assignedBy],
    references: [users.id],
  }),
}));

// Type exports
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type UpsertUser = Omit<InsertUser, "id"> & { id?: string };

export type Centre = typeof centres.$inferSelect;
export type InsertCentre = typeof centres.$inferInsert;

export type Course = typeof courses.$inferSelect;
export type InsertCourse = typeof courses.$inferInsert;

export type Batch = typeof batches.$inferSelect;
export type InsertBatch = typeof batches.$inferInsert;

export type Student = typeof students.$inferSelect;
export type InsertStudent = typeof students.$inferInsert;

export type Lead = typeof leads.$inferSelect;
export type InsertLead = typeof leads.$inferInsert;

export type FeeTransaction = typeof feeTransactions.$inferSelect;
export type InsertFeeTransaction = typeof feeTransactions.$inferInsert;

export type TeacherCourseAssignment = typeof teacherCourseAssignments.$inferSelect;
export type InsertTeacherCourseAssignment = typeof teacherCourseAssignments.$inferInsert;

export type Assignment = typeof assignments.$inferSelect;
export type InsertAssignment = typeof assignments.$inferInsert;

export type AssignmentSubmission = typeof assignmentSubmissions.$inferSelect;
export type InsertAssignmentSubmission = typeof assignmentSubmissions.$inferInsert;

export type Staff = typeof staff.$inferSelect;
export type InsertStaff = typeof staff.$inferInsert;

export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = typeof expenses.$inferInsert;

export type Target = typeof targets.$inferSelect;
export type InsertTarget = typeof targets.$inferInsert;

export type PerformanceMetric = typeof performanceMetrics.$inferSelect;
export type InsertPerformanceMetric = typeof performanceMetrics.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users);
export const insertCentreSchema = createInsertSchema(centres);
export const insertCourseSchema = createInsertSchema(courses);
export const insertBatchSchema = createInsertSchema(batches);
export const insertStudentSchema = createInsertSchema(students);
export const insertLeadSchema = createInsertSchema(leads);
export const insertFeeTransactionSchema = createInsertSchema(feeTransactions);
export const insertAssignmentSchema = createInsertSchema(assignments);
export const insertStaffSchema = createInsertSchema(staff);
export const insertExpenseSchema = createInsertSchema(expenses);
export const insertTargetSchema = createInsertSchema(targets);
export const insertNotificationSchema = createInsertSchema(notifications);