import { z } from "zod";

// Phone number validation schema that can be reused
export const phoneNumberSchema = z.string()
  .min(1, "Phone number is required")
  .transform((val) => val.toString()) // Ensure it's always a string
  .refine((val) => /^[0-9+\-\s()]+$/.test(val), "Invalid phone number format")
  .refine((val) => val.replace(/[^0-9]/g, '').length >= 10, "Phone number must be at least 10 digits");

// Email validation schema
export const emailSchema = z.string()
  .email("Invalid email address")
  .optional()
  .or(z.literal(""));

// Required string validation
export const requiredStringSchema = z.string()
  .min(1, "This field is required");

// Optional string validation
export const optionalStringSchema = z.string()
  .optional()
  .or(z.literal(""));

// Number validation for fees and amounts
export const amountSchema = z.coerce.string()
  .optional()
  .or(z.literal(""));

// Date validation
export const dateSchema = z.string()
  .optional()
  .or(z.literal(""));

// Validation utility functions
export const validationUtils = {
  // Validate phone number
  validatePhone: (phone: string | number): string => {
    const phoneStr = phone.toString();
    if (!phoneStr) return "Phone number is required";
    if (!/^[0-9+\-\s()]+$/.test(phoneStr)) return "Invalid phone number format";
    if (phoneStr.replace(/[^0-9]/g, '').length < 10) return "Phone number must be at least 10 digits";
    return "";
  },

  // Validate email
  validateEmail: (email: string): string => {
    if (!email) return ""; // Email is optional
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return "Invalid email address";
    return "";
  },

  // Validate required field
  validateRequired: (value: any, fieldName: string): string => {
    if (!value || (typeof value === 'string' && value.trim() === '')) {
      return `${fieldName} is required`;
    }
    return "";
  },

  // Validate number
  validateNumber: (value: any, fieldName: string, min?: number, max?: number): string => {
    if (value === undefined || value === null || value === '') return "";
    
    const num = parseFloat(value);
    if (isNaN(num)) return `${fieldName} must be a valid number`;
    if (min !== undefined && num < min) return `${fieldName} must be at least ${min}`;
    if (max !== undefined && num > max) return `${fieldName} must be at most ${max}`;
    return "";
  },

  // Sanitize phone number (remove non-numeric characters)
  sanitizePhone: (phone: string): string => {
    return phone.replace(/[^0-9]/g, '');
  },

  // Format phone number for display
  formatPhone: (phone: string): string => {
    const sanitized = phone.replace(/[^0-9]/g, '');
    if (sanitized.length === 10) {
      return `+91 ${sanitized.slice(0, 5)} ${sanitized.slice(5)}`;
    }
    return phone;
  },

  // Validate date
  validateDate: (date: string): string => {
    if (!date) return "";
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return "Invalid date format";
    return "";
  },

  // Validate date range
  validateDateRange: (startDate: string, endDate: string): string => {
    if (!startDate || !endDate) return "";
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return "Invalid date format";
    }
    
    if (start > end) {
      return "Start date cannot be after end date";
    }
    
    return "";
  }
};

// Common validation schemas for forms
export const commonSchemas = {
  phone: phoneNumberSchema,
  email: emailSchema,
  requiredString: requiredStringSchema,
  optionalString: optionalStringSchema,
  amount: amountSchema,
  date: dateSchema,
  
  // Student form schema
  student: z.object({
    srNo: z.coerce.string().optional(),
    studentFullName: requiredStringSchema,
    email: emailSchema,
    phone: phoneNumberSchema,
    parentsContactNumber: optionalStringSchema,
    source: optionalStringSchema,
    admissionDate: optionalStringSchema,
    zicaZima: requiredStringSchema,
    zicaSubCategory: optionalStringSchema,
    feesStructure: optionalStringSchema,
    course: requiredStringSchema,
    courseDuration: optionalStringSchema,
    courseStartDate: optionalStringSchema,
    actualFees: amountSchema,
    discountedFees: amountSchema,
    feesPaid: amountSchema,
    feesPaidDate: optionalStringSchema,
    feesBalance: amountSchema,
    paymentMode: optionalStringSchema,
    chequeNumber: optionalStringSchema,
    noOfInstallments: amountSchema,
    installmentsPaid: amountSchema,
    remainingInstallments: amountSchema,
    dueDate: optionalStringSchema,
    remarks: optionalStringSchema,
    status: optionalStringSchema,
    centreId: optionalStringSchema,
  }),

  // Lead form schema
  lead: z.object({
    name: requiredStringSchema,
    email: emailSchema,
    phone: phoneNumberSchema,
    centreId: requiredStringSchema,
    interestedCourse: requiredStringSchema,
    source: optionalStringSchema,
    status: requiredStringSchema,
    assignedTo: optionalStringSchema,
    notes: optionalStringSchema,
    courseDuration: optionalStringSchema,
    education: optionalStringSchema,
    cityArea: optionalStringSchema,
    enquiryDate: optionalStringSchema,
    contactedDate: optionalStringSchema,
    nextFollowUpDate: optionalStringSchema,
    followUpDate: optionalStringSchema,
    feedbackCallRemarks: optionalStringSchema,
    centreHeadRemarks: optionalStringSchema,
    finalRemark: optionalStringSchema,
  }),

  // Call log schema
  callLog: z.object({
    leadId: z.number().optional(),
    studentId: z.number().optional(),
    phoneNumber: phoneNumberSchema,
    callType: z.enum(["incoming", "outgoing", "missed"]),
    callDuration: z.number().min(0).default(0),
    notes: optionalStringSchema,
    followUpRequired: z.boolean().default(false),
    nextFollowUpDate: optionalStringSchema,
  }),

  // Visit schema
  visit: z.object({
    leadId: z.number().optional(),
    visitorName: z.string().min(2, "Visitor name is required"),
    phoneNumber: phoneNumberSchema,
    visitDate: requiredStringSchema,
    visitTime: requiredStringSchema,
    purpose: z.string().min(5, "Purpose must be at least 5 characters"),
    assignedTo: optionalStringSchema,
    notes: optionalStringSchema,
  }),
};

// Type exports for use in components
export type StudentFormData = z.infer<typeof commonSchemas.student>;
export type LeadFormData = z.infer<typeof commonSchemas.lead>;
export type CallLogFormData = z.infer<typeof commonSchemas.callLog>;
export type VisitFormData = z.infer<typeof commonSchemas.visit>; 