// Lead Data Cleaning and Classification Service
// This service ensures all lead data conforms to CRM standards

// Standardized Lead Sources
export const STANDARDIZED_LEAD_SOURCES = [
  "Website Inquiry",
  "Google Ad",
  "Facebook",
  "Instagram",
  "Just Dial",
  "Webinar / Online Workshop",
  "Direct Walk-in",
  "Career Fair / Exhibition",
  "School / College Seminar",
  "Parent Referral",
  "Student Referral",
  "Hoarding",
  "Banner",
  "Poster",
  "Newspaper Ad",
  "Phone Call Inquiry",
  "Institute Tie-up",
  "Head Office"
] as const;

// Standardized Zica Courses
export const STANDARDIZED_ZICA_COURSES = [
  "2D Animation",
  "3D Animation",
  "Visual Effects (VFX)",
  "Game Art Design",
  "Graphic Design",
  "UI & UX Design",
  "Web Design",
  "Motion Graphics",
  "Interior Design",
  "Fashion Design",
  "Digital Marketing",
  "Digital Photography",
  "Blender",
  "Unreal Engine",
  "Digital Audio & Video Editing"
] as const;

// Standardized Zima Courses
export const STANDARDIZED_ZIMA_COURSES = [
  "Film & TV Production",
  "Cinematography",
  "Film & TV Editing",
  "Acting",
  "Screenwriting",
  "Film Sound Design / Audio Engineering",
  "Dancing"
] as const;

// All Standardized Courses
export const ALL_STANDARDIZED_COURSES = [
  ...STANDARDIZED_ZICA_COURSES,
  ...STANDARDIZED_ZIMA_COURSES
] as const;

// Modular Programs
export const MODULAR_PROGRAMS = [
  "Adobe Photoshop",
  "Adobe Illustrator",
  "Adobe Premiere Pro",
  "Adobe After Effects",
  "Adobe Animate",
  "Adobe InDesign",
  "Adobe Audition",
  "Adobe XD",
  "Figma",
  "Final Cut Pro",
  "Autodesk Maya",
  "Autodesk 3DS Max",
  "Autodesk Revit",
  "Autodesk CAD",
  "Nuke",
  "Houdini",
  "Substance Painter",
  "Blender",
  "Unity",
  "Unreal Engine",
  "PF Track",
  "Mocha",
  "Silhouette"
] as const;

// Standardized Lead Statuses (only these 8 in the form; "Other" adds custom via UI)
export const STANDARDIZED_LEAD_STATUSES = [
  "Admission Done",
  "Cold Lead",
  "Hot Lead",
  "Not Interested",
  "Visited",
  "Placement",
  "Not Contacted",
  "Job Seeker"
] as const;

// Source mapping for cleaning existing data
const SOURCE_MAPPING: Record<string, string> = {
  // Website variations
  "Website": "Website Inquiry",
  "website": "Website Inquiry",
  "web": "Website Inquiry",
  "online": "Website Inquiry",
  "enquiry": "Website Inquiry",
  "inquiry": "Website Inquiry",
  
  // Google Ad variations
  "Google Ad": "Google Ad",
  "google ad": "Google Ad",
  "google ads": "Google Ad",
  "google": "Google Ad",
  "adwords": "Google Ad",
  
  // Facebook variations
  "Facebook": "Facebook",
  "facebook": "Facebook",
  "fb": "Facebook",
  "Facebook Ad": "Facebook",
  "facebook ad": "Facebook",
  
  // Instagram variations
  "Instagram": "Instagram",
  "instagram": "Instagram",
  "insta": "Instagram",
  "Instagram Ad": "Instagram",
  "instagram ad": "Instagram",
  
  // Webinar variations
  "Webinar": "Webinar / Online Workshop",
  "webinar": "Webinar / Online Workshop",
  "Online Workshop": "Webinar / Online Workshop",
  "online workshop": "Webinar / Online Workshop",
  "workshop": "Webinar / Online Workshop",
  
  // Walk-in variations
  "Walk-in": "Direct Walk-in",
  "walk-in": "Direct Walk-in",
  "walkin": "Direct Walk-in",
  "Direct Walk-in": "Direct Walk-in",
  "direct walk-in": "Direct Walk-in",
  "direct walkin": "Direct Walk-in",
  
  // Career Fair variations
  "Career Fair": "Career Fair / Exhibition",
  "career fair": "Career Fair / Exhibition",
  "Exhibition": "Career Fair / Exhibition",
  "exhibition": "Career Fair / Exhibition",
  "fair": "Career Fair / Exhibition",
  
  // Seminar variations
  "Seminar": "School / College Seminar",
  "seminar": "School / College Seminar",
  "School Seminar": "School / College Seminar",
  "College Seminar": "School / College Seminar",
  "school seminar": "School / College Seminar",
  "college seminar": "School / College Seminar",
  
  // Referral variations
  "Referral": "Parent Referral",
  "referral": "Parent Referral",
  "Parent Referral": "Parent Referral",
  "parent referral": "Parent Referral",
  "Student Referral": "Student Referral",
  "student referral": "Student Referral",
  "referred": "Parent Referral",
  
  // Hoarding variations
  "Hoarding": "Hoarding",
  "hoarding": "Hoarding",
  "billboard": "Hoarding",
  "outdoor": "Hoarding",
  
  // Banner variations
  "Banner": "Banner",
  "banner": "Banner",
  "digital banner": "Banner",
  
  // Poster variations
  "Poster": "Poster",
  "poster": "Poster",
  "Pamphlet": "Poster",
  "pamphlet": "Poster",
  "flyer": "Poster",
  
  // Newspaper variations
  "Newspaper": "Newspaper Ad",
  "newspaper": "Newspaper Ad",
  "Newspaper Ad": "Newspaper Ad",
  "newspaper ad": "Newspaper Ad",
  "print": "Newspaper Ad",
  
  // Phone variations
  "Phone Call": "Phone Call Inquiry",
  "phone call": "Phone Call Inquiry",
  "Phone": "Phone Call Inquiry",
  "phone": "Phone Call Inquiry",
  "call": "Phone Call Inquiry",
  "telephone": "Phone Call Inquiry",
  
  // Institute Tie-up variations
  "Institute Tie-up": "Institute Tie-up",
  "institute tie-up": "Institute Tie-up",
  "tie-up": "Institute Tie-up",
  "partnership": "Institute Tie-up",
  "collaboration": "Institute Tie-up",
  
  // Other common variations
  "Social Media": "Facebook", // Default to Facebook for social media
  "social media": "Facebook",
  "Email Campaign": "Website Inquiry", // Default to website inquiry
  "email campaign": "Website Inquiry",
  "MIS": "Website Inquiry", // Default to website inquiry
  "mis": "Website Inquiry",
  "Radio Ad": "Newspaper Ad", // Default to newspaper ad
  "radio ad": "Newspaper Ad",
  "Other": "Website Inquiry", // Default to website inquiry
  "other": "Website Inquiry",
  "unknown": "Website Inquiry"
};

// Course mapping for cleaning existing data
const COURSE_MAPPING: Record<string, string> = {
  // 2D Animation variations
  "2D Animation": "2D Animation",
  "2d animation": "2D Animation",
  "2D": "2D Animation",
  "2d": "2D Animation",
  "2D Anim": "2D Animation",
  "2d anim": "2D Animation",
  
  // 3D Animation variations
  "3D Animation": "3D Animation",
  "3d animation": "3D Animation",
  "3D": "3D Animation",
  "3d": "3D Animation",
  "3D Anim": "3D Animation",
  "3d anim": "3D Animation",
  
  // VFX variations
  "VFX": "Visual Effects (VFX)",
  "vfx": "Visual Effects (VFX)",
  "VFX & Compositing": "Visual Effects (VFX)",
  "vfx & compositing": "Visual Effects (VFX)",
  "Visual Effects": "Visual Effects (VFX)",
  "visual effects": "Visual Effects (VFX)",
  "Compositing": "Visual Effects (VFX)",
  "compositing": "Visual Effects (VFX)",
  
  // Game Design variations
  "Game Design": "Game Art Design",
  "game design": "Game Art Design",
  "Game Art": "Game Art Design",
  "game art": "Game Art Design",
  "Gaming": "Game Art Design",
  "gaming": "Game Art Design",
  
  // Graphic Design variations
  "Graphic Design": "Graphic Design",
  "graphic design": "Graphic Design",
  "Graphics": "Graphic Design",
  "graphics": "Graphic Design",
  "GD": "Graphic Design",
  "gd": "Graphic Design",
  
  // UI/UX variations
  "UI/UX Design": "UI & UX Design",
  "ui/ux design": "UI & UX Design",
  "UI Design": "UI & UX Design",
  "ui design": "UI & UX Design",
  "UX Design": "UI & UX Design",
  "ux design": "UI & UX Design",
  "UI": "UI & UX Design",
  "UX": "UI & UX Design",
  "ui": "UI & UX Design",
  "ux": "UI & UX Design",
  
  // Web Design variations
  "Web Design": "Web Design",
  "web design": "Web Design",
  "Web Development": "Web Design",
  "web development": "Web Design",
  "Website Design": "Web Design",
  "website design": "Web Design",
  
  // Digital Photography variations
  "Digital Photography": "Digital Photography",
  "digital photography": "Digital Photography",
  "Photography": "Digital Photography",
  "photography": "Digital Photography",
  "Photo": "Digital Photography",
  "photo": "Digital Photography",
  
  // Motion Graphics variations
  "Motion Graphics": "Motion Graphics",
  "motion graphics": "Motion Graphics",
  "Motion": "Motion Graphics",
  "motion": "Motion Graphics",
  "Motion Design": "Motion Graphics",
  "motion design": "Motion Graphics",
  
  // Interior Design variations
  "Interior Design": "Interior Design",
  "interior design": "Interior Design",
  "Interior": "Interior Design",
  "interior": "Interior Design",
  
  // Fashion Design variations
  "Fashion Design": "Fashion Design",
  "fashion design": "Fashion Design",
  "Fashion": "Fashion Design",
  "fashion": "Fashion Design",
  
  // Digital Marketing variations
  "Digital Marketing": "Digital Marketing",
  "digital marketing": "Digital Marketing",
  "Marketing": "Digital Marketing",
  "marketing": "Digital Marketing",
  "DM": "Digital Marketing",
  "dm": "Digital Marketing",
  
  // Blender variations
  "Blender": "Blender",
  "blender": "Blender",
  
  // Unreal Engine variations
  "Unreal Engine": "Unreal Engine",
  "unreal engine": "Unreal Engine",
  "Unreal": "Unreal Engine",
  "unreal": "Unreal Engine",
  "UE": "Unreal Engine",
  "ue": "Unreal Engine",
  
  // Digital Audio & Video Editing variations
  "Digital Audio & Video Editing": "Digital Audio & Video Editing",
  "digital audio & video editing": "Digital Audio & Video Editing",
  "Video Editing": "Digital Audio & Video Editing",
  "video editing": "Digital Audio & Video Editing",
  "Audio Editing": "Digital Audio & Video Editing",
  "audio editing": "Digital Audio & Video Editing",
  "Video": "Digital Audio & Video Editing",
  "video": "Digital Audio & Video Editing",
  "Audio": "Digital Audio & Video Editing",
  "audio": "Digital Audio & Video Editing",
  
  // Film & TV Production variations
  "Film & TV Production": "Film & TV Production",
  "film & tv production": "Film & TV Production",
  "Film Production": "Film & TV Production",
  "film production": "Film & TV Production",
  "TV Production": "Film & TV Production",
  "tv production": "Film & TV Production",
  "Film": "Film & TV Production",
  "film": "Film & TV Production",
  
  // Cinematography variations
  "Cinematography": "Cinematography",
  "cinematography": "Cinematography",
  "Cinema": "Cinematography",
  "cinema": "Cinematography",
  
  // Film & TV Editing variations
  "Film & TV Editing": "Film & TV Editing",
  "film & tv editing": "Film & TV Editing",
  "Film Editing": "Film & TV Editing",
  "film editing": "Film & TV Editing",
  "TV Editing": "Film & TV Editing",
  "tv editing": "Film & TV Editing",
  
  // Acting variations
  "Acting": "Acting",
  "acting": "Acting",
  "Actor": "Acting",
  "actor": "Acting",
  
  // Screenwriting variations
  "Screenwriting": "Screenwriting",
  "screenwriting": "Screenwriting",
  "Script Writing": "Screenwriting",
  "script writing": "Screenwriting",
  "Script": "Screenwriting",
  "script": "Screenwriting",
  
  // Film Sound Design variations
  "Film Sound Design": "Film Sound Design / Audio Engineering",
  "film sound design": "Film Sound Design / Audio Engineering",
  "Audio Engineering": "Film Sound Design / Audio Engineering",
  "audio engineering": "Film Sound Design / Audio Engineering",
  "Sound Design": "Film Sound Design / Audio Engineering",
  "sound design": "Film Sound Design / Audio Engineering",
  "Sound": "Film Sound Design / Audio Engineering",
  "sound": "Film Sound Design / Audio Engineering",
  
  // Dancing variations
  "Dancing": "Dancing",
  "dancing": "Dancing",
  "Dance": "Dancing",
  "dance": "Dancing",
  
  // Not Sure variations
  "Not Sure": "Not Sure",
  "not sure": "Not Sure",
  "unsure": "Not Sure",
  "don't know": "Not Sure",
  "dont know": "Not Sure",
  "unknown": "Not Sure",
  "": "Not Sure"
};

// Status mapping for cleaning existing data
const STATUS_MAPPING: Record<string, string> = {
  // Admission Done (renamed from Converted (Admission Done))
  "Converted": "Admission Done",
  "converted": "Admission Done",
  "Admission Done": "Admission Done",
  "admission done": "Admission Done",
  "Converted (Admission Done)": "Admission Done",
  "converted (admission done)": "Admission Done",
  "Done": "Admission Done",
  "done": "Admission Done",
  // Cold Lead
  "Cold Lead": "Cold Lead",
  "cold lead": "Cold Lead",
  "Cold": "Cold Lead",
  "cold": "Cold Lead",
  // Hot Lead
  "Hot Lead": "Hot Lead",
  "hot lead": "Hot Lead",
  "Interested": "Hot Lead",
  "interested": "Hot Lead",
  "Warm Lead": "Hot Lead",
  "warm lead": "Hot Lead",
  "Warm": "Hot Lead",
  "warm": "Hot Lead",
  "Hot": "Hot Lead",
  "hot": "Hot Lead",
  // Not Interested
  "Not Interested": "Not Interested",
  "not interested": "Not Interested",
  "Not interested": "Not Interested",
  "Rejected": "Not Interested",
  "rejected": "Not Interested",
  "Dropped": "Not Interested",
  "dropped": "Not Interested",
  "Lost": "Not Interested",
  "lost": "Not Interested",
  "Lost Lead": "Not Interested",
  "Fake": "Not Interested",
  "fake": "Not Interested",
  // Visited
  "Visited": "Visited",
  "visited": "Visited",
  "Visit Completed": "Visited",
  "visit completed": "Visited",
  "Visit Scheduled": "Visited",
  "visit scheduled": "Visited",
  "Visit": "Visited",
  "visit": "Visited",
  "Counseling Done": "Visited",
  "Counseling Scheduled": "Visited",
  "Follow-up Required": "Visited",
  "Follow-up Completed": "Visited",
  // Placement
  "Placement": "Placement",
  "placement": "Placement",
  // Not Contacted
  "Not Contacted": "Not Contacted",
  "not contacted": "Not Contacted",
  "Contacted": "Not Contacted",
  // New / New Lead → Other
  "New": "Other",
  "new": "Other",
  "New Lead": "Other",
  "new lead": "Other",
  "contacted": "Not Contacted",
  "Called": "Not Contacted",
  "called": "Not Contacted",
  "Application Pending": "Not Contacted",
  "Application Submitted": "Not Contacted",
  "Admission Pending": "Not Contacted",
  // Job Seeker
  "Job Seeker": "Job Seeker",
  "job seeker": "Job Seeker",
  "Job seeker": "Job Seeker"
};

// Interface for lead data
export interface LeadData {
  id?: string;
  leadName?: string;
  name?: string;
  emailId?: string;
  email?: string;
  contact?: string;
  phone?: string;
  course?: string;
  interestedCourse?: string;
  source?: string;
  status?: string;
  counselorName?: string;
  assignedTo?: string;
  remark?: string;
  notes?: string;
  cityArea?: string;
  enquiryDate?: any;
  contactedDate?: any;
  followUpDate?: any;
  nextFollowUpDate?: any;
  feedbackCallRemarks?: string;
  centreHeadRemarks?: string;
  finalRemark?: string;
  courseDuration?: string;
  education?: string;
  centreId?: string;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
  updatedBy?: string;
  userRole?: string;
}

// Interface for cleaning result
export interface CleaningResult {
  cleanedData: LeadData;
  changes: {
    source?: { from: string; to: string };
    course?: { from: string; to: string };
    status?: { from: string; to: string };
  };
  warnings: string[];
  errors: string[];
}

// Main cleaning function
export function cleanLeadData(leadData: LeadData): CleaningResult {
  const result: CleaningResult = {
    cleanedData: { ...leadData },
    changes: {},
    warnings: [],
    errors: []
  };

  try {
    // Clean source
    if (leadData.source) {
      const originalSource = leadData.source;
      const cleanedSource = cleanSource(leadData.source);
      if (originalSource !== cleanedSource) {
        result.changes.source = { from: originalSource, to: cleanedSource };
        result.cleanedData.source = cleanedSource;
      }
    } else {
      result.cleanedData.source = "Website Inquiry"; // Default source
      result.warnings.push("Source was empty, set to default: Website Inquiry");
    }

    // Clean course
    if (leadData.course || leadData.interestedCourse) {
      const originalCourse = leadData.course || leadData.interestedCourse;
      const cleanedCourse = cleanCourse(originalCourse || "");
      if (originalCourse !== cleanedCourse) {
        result.changes.course = { from: originalCourse || "", to: cleanedCourse };
        result.cleanedData.course = cleanedCourse;
        result.cleanedData.interestedCourse = cleanedCourse;
      }
    } else {
      result.cleanedData.course = "Not Sure";
      result.cleanedData.interestedCourse = "Not Sure";
      result.warnings.push("Course was empty, set to: Not Sure");
    }

    // Clean status
    if (leadData.status) {
      const originalStatus = leadData.status;
      const cleanedStatus = cleanStatus(leadData.status);
      if (originalStatus !== cleanedStatus) {
        result.changes.status = { from: originalStatus, to: cleanedStatus };
        result.cleanedData.status = cleanedStatus;
      }
    } else {
      result.cleanedData.status = "Not Contacted"; // Default status
      result.warnings.push("Status was empty, set to default: Not Contacted");
    }

    // Clean and standardize other fields
    result.cleanedData.leadName = cleanName(leadData.leadName || leadData.name || "");
    result.cleanedData.name = result.cleanedData.leadName;
    
    result.cleanedData.emailId = cleanEmail(leadData.emailId || leadData.email || "");
    result.cleanedData.email = result.cleanedData.emailId;
    
    result.cleanedData.contact = cleanPhone(leadData.contact || leadData.phone || "");
    result.cleanedData.phone = result.cleanedData.contact;
    
    result.cleanedData.counselorName = cleanName(leadData.counselorName || leadData.assignedTo || "");
    result.cleanedData.assignedTo = result.cleanedData.counselorName;
    
    result.cleanedData.remark = cleanText(leadData.remark || leadData.notes || "");
    result.cleanedData.notes = result.cleanedData.remark;
    
    result.cleanedData.cityArea = cleanText(leadData.cityArea || "");
    result.cleanedData.courseDuration = cleanText(leadData.courseDuration || "");
    result.cleanedData.education = cleanText(leadData.education || "");
    result.cleanedData.feedbackCallRemarks = cleanText(leadData.feedbackCallRemarks || "");
    result.cleanedData.centreHeadRemarks = cleanText(leadData.centreHeadRemarks || "");
    result.cleanedData.finalRemark = cleanText(leadData.finalRemark || "");

    // Clean dates
    result.cleanedData.enquiryDate = cleanDate(leadData.enquiryDate);
    result.cleanedData.contactedDate = cleanDate(leadData.contactedDate);
    result.cleanedData.followUpDate = cleanDate(leadData.followUpDate);
    result.cleanedData.nextFollowUpDate = cleanDate(leadData.nextFollowUpDate || leadData.followUpDate);

    // Set timestamps
    const now = new Date();
    if (!result.cleanedData.createdAt) {
      result.cleanedData.createdAt = now;
    }
    result.cleanedData.updatedAt = now;

  } catch (error) {
    result.errors.push(`Error during cleaning: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

// Clean source field
function cleanSource(source: string): string {
  if (!source || source.trim() === "") {
    return "Website Inquiry";
  }

  const normalized = source.trim();
  const lowerSource = normalized.toLowerCase();

  // If it already matches a standardized source (case-insensitive), keep it as-is.
  const exactStandardized = STANDARDIZED_LEAD_SOURCES.find(
    (item) => item.toLowerCase() === lowerSource
  );
  if (exactStandardized) {
    return exactStandardized;
  }
  
  // IMPORTANT: Check for "Just Dial" explicitly FIRST before any other mapping
  // This prevents partial matching from converting it to something else
  if (lowerSource === "just dial" || lowerSource === "justdial" || lowerSource === "just-dial") {
    return "Just Dial";
  }

  // Common typo handling
  if (lowerSource === "refral" || lowerSource === "referal") {
    return "Parent Referral";
  }
  if (lowerSource === "instgram" || lowerSource === "instragram") {
    return "Instagram";
  }
  
  // Check exact match in mapping
  const mapped = SOURCE_MAPPING[lowerSource];
  
  if (mapped) {
    return mapped;
  }

  // If no exact match, try partial matching
  // NOTE: This should NOT match "Just Dial" because we checked it above
  for (const [key, value] of Object.entries(SOURCE_MAPPING)) {
    // Only match against non-empty keys to avoid matching everything
    if (key && (lowerSource.includes(key) || key.includes(lowerSource))) {
      return value;
    }
  }

  // If still no match, keep user-entered source instead of forcing Website Inquiry.
  // Preserve phrase casing better than strict title-case conversion.
  return normalized;
}

// Clean course field
function cleanCourse(course: string): string {
  if (!course || course.trim() === "") {
    return "Not Sure";
  }

  const normalized = course.trim();
  
  // Handle multiple courses (comma-separated)
  if (normalized.includes(",")) {
    const courses = normalized.split(",").map(c => c.trim()).filter(c => c);
    if (courses.length > 0) {
      // Return the first valid course
      return cleanSingleCourse(courses[0]);
    }
  }

  return cleanSingleCourse(normalized);
}

// Clean a single course
function cleanSingleCourse(course: string): string {
  const normalized = course.trim();
  const mapped = COURSE_MAPPING[normalized.toLowerCase()];
  
  if (mapped) {
    return mapped;
  }

  // If no exact match, try partial matching
  const lowerCourse = normalized.toLowerCase();
  for (const [key, value] of Object.entries(COURSE_MAPPING)) {
    if (lowerCourse.includes(key) || key.includes(lowerCourse)) {
      return value;
    }
  }

  // Check if it's a modular program
  for (const program of MODULAR_PROGRAMS) {
    if (lowerCourse.includes(program.toLowerCase()) || program.toLowerCase().includes(lowerCourse)) {
      return program;
    }
  }

  // If still no match, return "Not Sure"
  return "Not Sure";
}

// Clean status field
function cleanStatus(status: string): string {
  if (!status || status.trim() === "") {
    return "Not Contacted";
  }

  const normalized = status.trim();
  const mapped = STATUS_MAPPING[normalized.toLowerCase()];
  
  if (mapped) {
    return mapped;
  }

  // If no exact match, try partial matching
  const lowerStatus = normalized.toLowerCase();
  for (const [key, value] of Object.entries(STATUS_MAPPING)) {
    if (lowerStatus.includes(key) || key.includes(lowerStatus)) {
      return value;
    }
  }

  // If still no match, return the original (capitalized)
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}

// Clean name field
function cleanName(name: string): string {
  if (!name || name.trim() === "") {
    return "";
  }
  
  return name.trim().replace(/\s+/g, " ");
}

// Clean email field
function cleanEmail(email: string): string {
  if (!email || email.trim() === "") {
    return "";
  }
  
  return email.trim().toLowerCase();
}

// Clean phone field
function cleanPhone(phone: string): string {
  if (!phone || phone.trim() === "") {
    return "";
  }
  
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, "");
  
  // Ensure it starts with + for international numbers or is 10 digits for local
  if (cleaned.startsWith("+")) {
    return cleaned;
  } else if (cleaned.length === 10) {
    return cleaned;
  } else if (cleaned.length > 10) {
    // If longer than 10, assume it's international without +
    return "+" + cleaned;
  }
  
  return cleaned;
}

// Clean text field
function cleanText(text: string): string {
  if (!text || text.trim() === "") {
    return "";
  }
  
  return text.trim().replace(/\s+/g, " ");
}

// Clean date field
function cleanDate(date: any): Date | null {
  if (!date) {
    return null;
  }
  
  try {
    if (date instanceof Date) {
      return date;
    }
    
    if (typeof date === 'string') {
      const parsed = new Date(date);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    
    if (date.toDate && typeof date.toDate === 'function') {
      // Firebase Timestamp
      return date.toDate();
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

// Batch clean multiple leads
export function batchCleanLeads(leads: LeadData[]): CleaningResult[] {
  return leads.map(lead => cleanLeadData(lead));
}

// Validate cleaned data
export function validateCleanedData(leadData: LeadData): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Required fields
  if (!leadData.leadName || leadData.leadName.trim() === "") {
    errors.push("Lead name is required");
  }
  
  if (!leadData.contact || leadData.contact.trim() === "") {
    errors.push("Contact number is required");
  }
  
  if (!leadData.source || leadData.source.trim() === "") {
    errors.push("Source is required");
  }
  
  if (!leadData.course || leadData.course.trim() === "") {
    errors.push("Course is required");
  }
  
  if (!leadData.status || leadData.status.trim() === "") {
    errors.push("Status is required");
  }
  
  // Source: allow standardized list or any non-empty custom source
  if (leadData.source && leadData.source.trim() === "") {
    errors.push("Source cannot be empty");
  }
  
  // Validate course is in standardized list or modular programs
  if (leadData.course && 
      !ALL_STANDARDIZED_COURSES.includes(leadData.course as any) && 
      !MODULAR_PROGRAMS.includes(leadData.course as any) && 
      leadData.course !== "Not Sure") {
    errors.push(`Course "${leadData.course}" is not in the standardized list`);
  }
  
  // Status: allow standardized list or any non-empty custom status (from "Other")
  if (leadData.status && typeof leadData.status === "string" && leadData.status.trim() === "") {
    errors.push("Status cannot be empty");
  }
  
  // Validate email format
  if (leadData.emailId && leadData.emailId.trim() !== "") {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(leadData.emailId)) {
      errors.push("Invalid email format");
    }
  }
  
  // Validate phone format (Nest API requires Indian mobile starting 6–9)
  if (leadData.contact && leadData.contact.trim() !== "") {
    const ten = leadData.contact.replace(/\D/g, '').slice(-10);
    if (!/^[6-9][0-9]{9}$/.test(ten)) {
      errors.push("Enter a valid 10-digit Indian mobile number (starting with 6–9)");
    }
  }

  if (leadData.leadName && leadData.leadName.trim().length === 1) {
    errors.push("Lead name must be at least 2 characters");
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Export all standardized lists for use in forms
export {
  STANDARDIZED_LEAD_SOURCES as LEAD_SOURCES,
  ALL_STANDARDIZED_COURSES as COURSES,
  STANDARDIZED_LEAD_STATUSES as LEAD_STATUSES
};
