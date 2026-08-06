import { useState, useEffect, useMemo, useCallback } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
 } from "@/components/ui/table";
import { useTableSort } from "@/hooks/useTableSort";
import {
  assignContiguousSerialsToOrderedList,
  getNextSerialNumberFromItems,
  parseSerialNumber,
} from "@/lib/serialNumberUtils";

const BATCH_DATE_SORT = { key: "startDate" as const, direction: "desc" as const };
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { leadDataSync } from "@/lib/leadDataSync";
import { ALL_STANDARDIZED_COURSES, MODULAR_PROGRAMS } from "@/lib/leadDataCleaningService";
import { useAuth } from "@/hooks/useAuth";
import { firebaseHelpers } from "@/lib/firebaseHelpers";
import { useToast } from "@/hooks/use-toast";
import Loading from "@/components/ui/loading";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TimeClock } from "@/components/ui/time-clock";
import { GraduationCap, Download, Users, Plus, Edit, Trash2, Save, X, Filter, Search, Layers, UserPlus, ChevronDown, FileText, Settings2, BarChart3, TrendingUp, BookOpen, UserCheck, Clock, CalendarDays, Library, Award } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const BATCH_DATA_DOC = "batchEntriesData";

const SLOT_OPTIONS = ["Full Week", "MWF", "TTS"] as const;

export interface BatchEntryData {
  no?: number;
  name?: string;
  course?: string;
  subject?: string;
  slot?: string;
  time?: string;
  startDate?: string;
  endDate?: string;
  expectedEndDate?: string;
  comments?: string;
  teacherId?: string;
  isManual?: boolean;
}

export interface BatchEntry {
  id: string;
  no: number;
  name: string;
  course: string;
  subject: string;
  slot: string;
  time: string;
  startDate: string;
  endDate: string;
  expectedEndDate: string;
  comments: string;
  teacherId: string;
  isManual: boolean;
}

function parseDate(val: unknown): string {
  if (!val) return "";
  try {
    if (val && typeof val === "object" && "toDate" in val && typeof (val as { toDate: () => Date }).toDate === "function") {
      const d = (val as { toDate: () => Date }).toDate();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    if (val instanceof Date) {
      return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, "0")}-${String(val.getDate()).padStart(2, "0")}`;
    }
    const d = new Date(val as string | number);
    return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function displayDate(s: string): string {
  if (!s || s === "-") return "-";
  try {
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return s;
  }
}

function uuid(): string {
  return "manual-" + Date.now() + "-" + Math.random().toString(36).slice(2, 11);
}

export default function Batches() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const centreId = userProfile?.centreId || "default-centre";
  const [leads, setLeads] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<Record<string, BatchEntryData>>({});
  const [removedFromBatchIds, setRemovedFromBatchIds] = useState<string[]>([]);
  const [teachersList, setTeachersList] = useState<string[]>([]);
  const [batchRows, setBatchRows] = useState<BatchEntry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<BatchEntry> | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<string>("all");
  const [selectedStudent, setSelectedStudent] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("records");
  const [manageStaffOpen, setManageStaffOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState("");
  const [addForm, setAddForm] = useState({
    name: "",
    course: "",
    subject: "",
    slot: "",
    startTime: "",
    endTime: "",
    startDate: "",
    endDate: "",
    expectedEndDate: "",
    comments: "",
    teacherId: "",
  });

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const data = await firebaseHelpers.getStudents(centreId);
        setStudents(data || []);
      } catch (error) {
        console.error("Error fetching students for batches:", error);
      }
    };
    
    fetchStudents();
    
    const unsubscribe = leadDataSync.subscribeToLeads((data: any[]) => {
      setLeads(data || []);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [centreId]);

  const admissionDoneLeads = useMemo(() => {
    const statuses = ["Admission Done", "Converted (Admission Done)"];
    return leads.filter((lead) => {
      if (!statuses.includes(lead.status)) return false;
      if (centreId && lead.centreId && lead.centreId !== centreId) return false;
      return true;
    });
  }, [leads, centreId]);

  useEffect(() => {
    if (!db) {
      setEntries({});
      setRemovedFromBatchIds([]);
      return;
    }
    let cancelled = false;
    getDoc(doc(db, BATCH_DATA_DOC, centreId))
      .then((snap) => {
        if (cancelled) return;
        const data = snap.exists() ? snap.data() : {};
        const ent: Record<string, BatchEntryData> = (data?.entries && typeof data.entries === "object") ? data.entries : {};
        const removed: string[] = Array.isArray(data?.removedFromBatchIds) ? data.removedFromBatchIds : [];
        const tList: string[] = Array.isArray(data?.teachers) ? data.teachers : [];
        setEntries(ent);
        setRemovedFromBatchIds(removed);
        const teacherSet = new Set<string>(tList);
        Object.values(ent).forEach((e) => {
          if (e?.teacherId) teacherSet.add(e.teacherId);
        });
        setTeachersList(Array.from(teacherSet));
      })
      .catch(() => {
        if (!cancelled) setEntries({});
      });
    return () => {
      cancelled = true;
    };
  }, [centreId]);

  useEffect(() => {
    const ent = entries;
    const removedSet = new Set(removedFromBatchIds);
    const manualIds = Object.keys(ent).filter((k) => k.startsWith("manual-"));
    const rows: BatchEntry[] = [];

    // Use a Map to deduplicate students/leads by ID
    const studentMap = new Map<string, BatchEntry>();

    // 1. Process Admission Done Leads
    admissionDoneLeads.forEach((lead, i) => {
      const id = lead.id || `lead-${i}`;
      if (removedSet.has(id)) return;
      const e = ent[id] || {};
      studentMap.set(id, {
        id,
        no: parseSerialNumber(e.no) || 0,
        name: e.name ?? lead.leadName ?? lead.name ?? "",
        course: e.course ?? lead.course ?? lead.courseInterest ?? "",
        subject: e.subject ?? "",
        slot: e.slot ?? "",
        time: e.time ?? "",
        startDate: e.startDate ?? (lead.admissionDate ? parseDate(lead.admissionDate) : ""),
        endDate: e.endDate ?? "",
        expectedEndDate: e.expectedEndDate ?? "",
        comments: e.comments ?? lead.centreHeadRemarks ?? lead.finalRemark ?? "",
        teacherId: e.teacherId ?? "",
        isManual: false,
      });
    });

    // 2. Process Students from Students collection
    students.forEach((student) => {
      const id = student.id;
      if (removedSet.has(id)) return;
      const e = ent[id] || {};
      
      // If student already exists (likely from lead), we can merge or update
      // Here we prioritize the student record data for name/course
      studentMap.set(id, {
        id,
        no: parseSerialNumber(e.no) || 0,
        name: e.name ?? (student.firstName || student.name || ""),
        course: e.course ?? (student.course || ""),
        subject: e.subject ?? "",
        slot: e.slot ?? "",
        time: e.time ?? "",
        startDate: e.startDate ?? (student.admissionDate ? parseDate(student.admissionDate) : ""),
        endDate: e.endDate ?? "",
        expectedEndDate: e.expectedEndDate ?? "",
        comments: e.comments ?? (student.remarks || ""),
        teacherId: e.teacherId ?? "",
        isManual: false,
      });
    });

    studentMap.forEach((row) => {
      rows.push(row);
    });

    // 3. Process Manual Batch Entries (those not linked to leads/students)
    manualIds.forEach((id) => {
      const e = ent[id];
      if (!e) return;
      rows.push({
        id,
        no: parseSerialNumber(e.no) || 0,
        name: e.name ?? "",
        course: e.course ?? "",
        subject: e.subject ?? "",
        slot: e.slot ?? "",
        time: e.time ?? "",
        startDate: e.startDate ?? "",
        endDate: e.endDate ?? "",
        expectedEndDate: e.expectedEndDate ?? "",
        comments: e.comments ?? "",
        teacherId: e.teacherId ?? "",
        isManual: true,
      });
    });

    setBatchRows(rows);
  }, [admissionDoneLeads, students, entries, removedFromBatchIds]);

  const studentOptions = useMemo(() => {
    const set = new Set<string>();
    batchRows.forEach((r) => {
      if (r.name) set.add(r.name);
    });
    return Array.from(set).sort();
  }, [batchRows]);

  const filteredRows = useMemo(() => {
    let rows = batchRows;
    if (selectedTeacher !== "all") rows = rows.filter((r) => r.teacherId === selectedTeacher);
    if (selectedStudent !== "all") rows = rows.filter((r) => r.name === selectedStudent);
    return rows;
  }, [batchRows, selectedTeacher, selectedStudent]);

  const { sortedData: sortedFilteredRows, requestSort, sortConfig } = useTableSort(
    filteredRows,
    BATCH_DATE_SORT
  );

  const numberedRows = useMemo(
    () => assignContiguousSerialsToOrderedList(sortedFilteredRows, "no"),
    [sortedFilteredRows]
  );

  const displayedRows = useMemo(() => {
    if (!searchTerm.trim()) return numberedRows;
    const q = searchTerm.trim().toLowerCase();
    return numberedRows.filter(
      (r) =>
        (r.name || "").toLowerCase().includes(q) ||
        (r.course || "").toLowerCase().includes(q) ||
        (r.teacherId || "").toLowerCase().includes(q) ||
        (r.subject || "").toLowerCase().includes(q)
    );
  }, [numberedRows, searchTerm]);

  const totalEntries = batchRows.length;
  const fromLeadsCount = batchRows.filter((r) => !r.isManual).length;

  const saveEntries = useCallback(
    async (
      newEntries: Record<string, BatchEntryData>,
      removedIds: string[] = removedFromBatchIds
    ): Promise<boolean> => {
      if (!db) return false;
      setSavingId("_doc");
      try {
        await setDoc(
          doc(db, BATCH_DATA_DOC, centreId),
          { entries: newEntries, removedFromBatchIds: removedIds, updatedAt: new Date() },
          { merge: true }
        );
        setEntries(newEntries);
        setRemovedFromBatchIds(removedIds);
        return true;
      } catch (err) {
        toast({
          title: "Save failed",
          description: err instanceof Error ? err.message : "Could not save",
          variant: "destructive",
        });
        return false;
      } finally {
        setSavingId(null);
      }
    },
    [centreId, removedFromBatchIds, toast]
  );

  const saveStaffList = useCallback(
    async (newList: string[]) => {
      if (!db) return false;
      setSavingId("_staff");
      try {
        await setDoc(
          doc(db, BATCH_DATA_DOC, centreId),
          { teachers: newList, updatedAt: new Date() },
          { merge: true }
        );
        setTeachersList(newList);
        return true;
      } catch (err) {
        toast({
          title: "Save failed",
          description: err instanceof Error ? err.message : "Could not save staff list",
          variant: "destructive",
        });
        return false;
      } finally {
        setSavingId(null);
      }
    },
    [centreId, toast]
  );

  const handleAddStaff = useCallback(() => {
    const name = newStaffName.trim();
    if (!name) return;
    const next = Array.from(new Set([...teachersList, name])).sort();
    saveStaffList(next).then((ok) => {
      if (ok) {
        setNewStaffName("");
        toast({ title: "Added", description: `Staff "${name}" added.` });
      }
    });
  }, [newStaffName, teachersList, saveStaffList, toast]);

  const handleRemoveStaff = useCallback(
    (name: string) => {
      const next = teachersList.filter((t) => t !== name);
      saveStaffList(next).then((ok) => {
        if (ok) toast({ title: "Removed", description: `Staff "${name}" removed.` });
      });
    },
    [teachersList, saveStaffList, toast]
  );

  const handleStartEdit = useCallback((row: BatchEntry) => {
    setEditingId(row.id);
    setEditDraft({ ...row });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditDraft(null);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingId || !editDraft) return;
    const newEntries = { ...entries };
    const prev = newEntries[editingId] || {};
    newEntries[editingId] = {
      ...prev,
      name: editDraft.name ?? prev.name,
      course: editDraft.course ?? prev.course,
      subject: editDraft.subject ?? prev.subject,
      slot: editDraft.slot ?? prev.slot,
      time: editDraft.time ?? prev.time,
      startDate: editDraft.startDate ?? prev.startDate,
      endDate: editDraft.endDate ?? prev.endDate,
      expectedEndDate: editDraft.expectedEndDate ?? prev.expectedEndDate,
      comments: editDraft.comments ?? prev.comments,
      teacherId: editDraft.teacherId ?? prev.teacherId,
      isManual: editDraft.isManual ?? prev.isManual ?? editingId.startsWith("manual-"),
    };
    const ok = await saveEntries(newEntries);
    if (!ok) return;
    setEditingId(null);
    setEditDraft(null);
    toast({ title: "Saved", description: "Entry updated." });
  }, [editingId, editDraft, entries, saveEntries, toast]);

  const handleDelete = useCallback(
    async (id: string, isManual: boolean) => {
      if (!confirm("Remove this student from batch entries?")) return;
      const newEntries = { ...entries };
      delete newEntries[id];
      const newRemovedIds = isManual ? removedFromBatchIds : [...removedFromBatchIds, id];
      const ok = await saveEntries(newEntries, newRemovedIds);
      if (!ok) return;
      if (editingId === id) {
        setEditingId(null);
        setEditDraft(null);
      }
      toast({ title: "Removed", description: "Entry removed from batch." });
    },
    [entries, removedFromBatchIds, saveEntries, editingId, toast]
  );

  const handleAddStudent = useCallback(async () => {
    const timeStr = [addForm.startTime.trim(), addForm.endTime.trim()].filter(Boolean).join(" - ") || "";
    
    // Also save to students collection so it appears in Student Management
    // We'll use the same data we have
    const studentData = {
      firstName: addForm.name.trim(),
      course: addForm.course.trim(),
      remarks: addForm.comments.trim(),
      admissionDate: addForm.startDate ? new Date(addForm.startDate) : new Date(),
      status: 'active',
      centreId,
      // Adding placeholders for required fields in Student Management
      phone: "Not provided",
      srNo: getNextSerialNumberFromItems(students),
    };

    const nextBatchNo = getNextSerialNumberFromItems(batchRows, { field: "no" });
    
    let studentId = "";
    try {
      const result = await firebaseHelpers.saveStudent(studentData);
      if (result) studentId = result;
    } catch (error) {
      console.error("Error saving student to collection:", error);
    }

    const id = studentId || uuid();
    const newEntries = { ...entries };
    newEntries[id] = {
      no: nextBatchNo,
      name: addForm.name.trim(),
      course: addForm.course.trim(),
      subject: addForm.subject.trim(),
      slot: addForm.slot.trim(),
      time: timeStr,
      startDate: addForm.startDate || undefined,
      endDate: addForm.endDate || undefined,
      expectedEndDate: addForm.expectedEndDate || undefined,
      comments: addForm.comments.trim(),
      teacherId: addForm.teacherId.trim(),
      isManual: false,
    };

    const ok = await saveEntries(newEntries);
    if (!ok) return;

    // Refresh students list
    try {
      const updatedStudents = await firebaseHelpers.getStudents(centreId);
      setStudents(updatedStudents || []);
    } catch (e) {
      console.error("Error refreshing students:", e);
    }
    setAddForm({
      name: "",
      course: "",
      subject: "",
      slot: "",
      startTime: "",
      endTime: "",
      startDate: "",
      endDate: "",
      expectedEndDate: "",
      comments: "",
      teacherId: "",
    });
    setAddOpen(false);
    toast({ title: "Added", description: "Student added to batch." });
  }, [addForm, entries, saveEntries, toast, centreId]);

  const teacherOptions = useMemo(() => {
    const set = new Set<string>(teachersList);
    batchRows.forEach((r) => r.teacherId && set.add(r.teacherId));
    return Array.from(set).filter(Boolean).sort();
  }, [teachersList, batchRows]);

  const teachersCount = teacherOptions.length;

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

  const courseDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    displayedRows.forEach((r) => {
      const c = r.course || "Unknown";
      counts[c] = (counts[c] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [displayedRows]);

  const teacherDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    displayedRows.forEach((r) => {
      if (r.teacherId) {
        counts[r.teacherId] = (counts[r.teacherId] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [displayedRows]);

  const slotDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    displayedRows.forEach((r) => {
      const s = r.slot || "Unassigned";
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [displayedRows]);

  const subjectDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    displayedRows.forEach((r) => {
      const s = r.subject || "Unknown";
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [displayedRows]);

  const timeDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    displayedRows.forEach((r) => {
      const t = r.time || "Unassigned";
      counts[t] = (counts[t] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [displayedRows]);

  const newExistingDistribution = useMemo(() => {
    const counts: Record<string, number> = { "New": 0, "Existing": 0 };
    displayedRows.forEach((r) => {
      if (r.isManual) counts["New"]++;
      else counts["Existing"]++;
    });
    return [
      { name: "New", value: counts["New"] },
      { name: "Existing", value: counts["Existing"] }
    ];
  }, [displayedRows]);

  const courseOptions = useMemo(() => {
    const custom = (() => {
      try {
        return JSON.parse(localStorage.getItem("customCourses") || "[]") as string[];
      } catch {
        return [];
      }
    })();
    return Array.from(
      new Set([...ALL_STANDARDIZED_COURSES, ...MODULAR_PROGRAMS, ...custom])
    ).sort();
  }, [addOpen]);

  const exportToCSV = () => {
    const headers = ["No.", "Name", "Course", "Subject", "Slot", "Time", "Course Start Date", "Course End Date", "Expected End Date", "Staff", "Comments"];
    const rows = displayedRows.map((e, i) => [
      i + 1,
      e.name,
      e.course,
      e.subject,
      e.slot,
      e.time,
      e.startDate || "-",
      e.endDate || "-",
      e.expectedEndDate || "-",
      e.teacherId || "-",
      `"${(e.comments || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "batches-admission-done.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return <Loading fullScreen={true} text="Loading batches..." color="primary" />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/60 shadow-sm mb-6">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 lg:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl shadow-md">
                <Layers className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Batches</h1>
                <p className="text-sm text-slate-500">Manage batch entries, students from admission-done leads</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Button onClick={exportToCSV} variant="outline" size="sm" className="border-slate-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200">
                <Download className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Download</span>
              </Button>
              <Button onClick={() => setAddOpen(true)} size="sm" className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-sm">
                <UserPlus className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Add Student</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
          <Card className="border-0 ring-1 ring-slate-200/60 shadow-[0_2px_10px_-3px_rgba(15,23,42,0.06)] hover:shadow-[0_8px_20px_-6px_rgba(15,23,42,0.1)] transition-all duration-300 bg-white/90 backdrop-blur-xl overflow-hidden relative group rounded-[20px]">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-100/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-1.5">Total entries</p>
                  <p className="text-3xl font-extrabold text-slate-800 tracking-tight">{totalEntries}</p>
                </div>
                <div className="p-3.5 bg-slate-800 text-white rounded-2xl shadow-lg shadow-slate-800/20 group-hover:scale-110 transition-transform duration-300">
                  <Users className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 ring-1 ring-blue-100/80 shadow-[0_2px_10px_-3px_rgba(59,130,246,0.1)] hover:shadow-[0_8px_20px_-6px_rgba(59,130,246,0.15)] transition-all duration-300 bg-white/90 backdrop-blur-xl overflow-hidden relative group rounded-[20px]">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-[11px] font-semibold text-blue-500/80 uppercase tracking-widest mb-1.5">From admission done</p>
                  <p className="text-3xl font-extrabold text-blue-600 tracking-tight">{fromLeadsCount}</p>
                </div>
                <div className="p-3.5 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-600/20 group-hover:scale-110 transition-transform duration-300">
                  <GraduationCap className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 ring-1 ring-emerald-100/80 shadow-[0_2px_10px_-3px_rgba(16,185,129,0.1)] hover:shadow-[0_8px_20px_-6px_rgba(16,185,129,0.15)] transition-all duration-300 bg-white/90 backdrop-blur-xl overflow-hidden relative group rounded-[20px]">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1">
                  <p className="text-[11px] font-semibold text-emerald-600/80 uppercase tracking-widest mb-1.5">Staff</p>
                  <p className="text-3xl font-extrabold text-emerald-600 tracking-tight">{teachersCount}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-800 font-medium rounded-xl transition-colors shadow-sm"
                    onClick={() => setManageStaffOpen(true)}
                  >
                    <Settings2 className="w-4 h-4 mr-2" />
                    Manage
                  </Button>
                  <div className="p-3.5 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform duration-300">
                    <Layers className="w-6 h-6" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-[480px] grid-cols-2 gap-2 p-1.5 h-auto bg-slate-100/80 backdrop-blur-xl rounded-[16px] mb-8 shadow-inner border border-slate-200/80">
            <TabsTrigger value="records" className="flex items-center justify-center gap-2 text-sm font-bold px-4 py-3 rounded-[12px] text-slate-500 hover:text-emerald-600 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-[0_2px_10px_rgba(16,185,129,0.15)] transition-all duration-300">
              <FileText className="w-5 h-5" />
              Batch Records
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center justify-center gap-2 text-sm font-bold px-4 py-3 rounded-[12px] text-slate-500 hover:text-indigo-600 hover:bg-white/60 data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-[0_2px_10px_rgba(79,70,229,0.15)] transition-all duration-300">
              <BarChart3 className="w-5 h-5" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)] rounded-[20px] p-3.5 mb-8">
            <div className="flex flex-col lg:flex-row gap-3 items-center">
              <div className="flex-1 w-full">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <Input
                    placeholder="Search by name, course, or staff..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-11 border-slate-200/80 bg-slate-50/80 hover:bg-slate-50 focus:bg-white h-12 rounded-[14px] transition-all shadow-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                  />
                </div>
              </div>
              <div className="flex flex-wrap lg:flex-nowrap gap-3 items-center w-full lg:w-auto">
                <div className="flex items-center gap-2.5 bg-slate-50/80 border border-slate-200/80 rounded-[14px] px-3.5 py-1 h-12 shadow-sm focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Student</Label>
                  <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                    <SelectTrigger className="w-[150px] sm:w-[180px] border-0 bg-transparent shadow-none focus:ring-0 focus:ring-offset-0 font-semibold text-slate-700 h-9 px-2">
                      <SelectValue placeholder="All students" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                      <SelectItem value="all" className="font-medium">All students</SelectItem>
                      {studentOptions.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center gap-2.5 bg-slate-50/80 border border-slate-200/80 rounded-[14px] px-3.5 py-1 h-12 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
                  <Filter className="w-4 h-4 text-indigo-600" />
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">Staff</Label>
                  <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                    <SelectTrigger className="w-[140px] sm:w-[160px] border-0 bg-transparent shadow-none focus:ring-0 focus:ring-offset-0 font-semibold text-slate-700 h-9 px-2">
                      <SelectValue placeholder="All staff" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                      <SelectItem value="all" className="font-medium">All staff</SelectItem>
                      {teacherOptions.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={exportToCSV} variant="outline" className="h-12 rounded-[14px] border-slate-200 hover:bg-slate-800 hover:text-white hover:border-slate-800 transition-colors shadow-sm px-5 flex-1 lg:flex-none">
                  <Download className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline font-semibold">Export</span>
                </Button>
              </div>
            </div>
          </div>

          <TabsContent value="records" className="mt-0">

        <Card className="border border-slate-200/60 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] overflow-hidden rounded-[20px] bg-white/95 backdrop-blur-xl">
          <CardHeader className="border-b border-slate-100/80 bg-white py-5 px-6">
            <CardTitle className="flex items-center gap-3 text-lg font-bold text-slate-800 tracking-tight">
              <div className="p-2 bg-slate-100 rounded-lg">
                <FileText className="h-5 w-5 text-slate-600" />
              </div>
              Batch Records
              <span className="font-medium text-sm text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full ml-2">
                {displayedRows.length} {selectedTeacher !== "all" ? "for selected staff" : ""}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto max-h-[calc(100vh-320px)] min-h-[280px] rounded-b-[20px] bg-white">
              <Table className="min-w-[1400px]">
                <TableHeader>
                  <TableRow className="border-b border-slate-200 bg-slate-50/80 sticky top-0 z-10 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:bg-slate-50/80">
                    <SortableTableHead className="h-12 px-5 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 whitespace-nowrap bg-slate-50/80 w-16 min-w-[2.5rem]" sortConfig={sortConfig} sortKey="no" requestSort={requestSort}>No.</SortableTableHead>
                    <SortableTableHead className="h-12 px-5 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 whitespace-nowrap bg-slate-50/80 min-w-[140px]" sortConfig={sortConfig} sortKey="name" requestSort={requestSort}>Name</SortableTableHead>
                    <SortableTableHead className="h-12 px-5 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 whitespace-nowrap bg-slate-50/80 min-w-[220px]" sortConfig={sortConfig} sortKey="course" requestSort={requestSort}>Course</SortableTableHead>
                    <SortableTableHead className="h-12 px-5 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 whitespace-nowrap bg-slate-50/80 min-w-[120px]" sortConfig={sortConfig} sortKey="subject" requestSort={requestSort}>Subject</SortableTableHead>
                    <SortableTableHead className="h-12 px-5 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 whitespace-nowrap bg-slate-50/80 min-w-[110px]" sortConfig={sortConfig} sortKey="slot" requestSort={requestSort}>Slot</SortableTableHead>
                    <SortableTableHead className="h-12 px-5 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 whitespace-nowrap bg-slate-50/80 min-w-[180px]" sortConfig={sortConfig} sortKey="time" requestSort={requestSort}>Time</SortableTableHead>
                    <TableHead className="h-12 px-5 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 whitespace-nowrap bg-slate-50/80 min-w-[130px]">Faculty</TableHead>
                    <TableHead className="h-12 px-5 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 whitespace-nowrap bg-slate-50/80 min-w-[130px]">New/Existing</TableHead>
                    <SortableTableHead className="h-12 px-5 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 whitespace-nowrap bg-slate-50/80 min-w-[120px]" sortConfig={sortConfig} sortKey="startDate" requestSort={requestSort}>Course Start Date</SortableTableHead>
                    <SortableTableHead className="h-12 px-5 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 whitespace-nowrap bg-slate-50/80 min-w-[120px]" sortConfig={sortConfig} sortKey="endDate" requestSort={requestSort}>Course End Date</SortableTableHead>
                    <SortableTableHead className="h-12 px-5 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 whitespace-nowrap bg-slate-50/80 min-w-[140px]" sortConfig={sortConfig} sortKey="expectedEndDate" requestSort={requestSort}>Expected Course End Date</SortableTableHead>
                    <SortableTableHead className="h-12 px-5 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 whitespace-nowrap bg-slate-50/80 min-w-[130px]" sortConfig={sortConfig} sortKey="startDate" requestSort={requestSort}>Batch Start Date</SortableTableHead>
                    <TableHead className="h-12 px-5 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 whitespace-nowrap bg-slate-50/80 min-w-[130px]">Batch End Date</TableHead>
                    <TableHead className="h-12 px-5 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 whitespace-nowrap bg-slate-50/80 min-w-[120px]">Status</TableHead>
                    <SortableTableHead className="h-12 px-5 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 whitespace-nowrap bg-slate-50/80 min-w-[160px]" sortConfig={sortConfig} sortKey="comments" requestSort={requestSort}>Remarks</SortableTableHead>
                    <TableHead className="h-12 px-5 text-[10px] font-extrabold uppercase tracking-widest text-slate-500 text-center w-32 whitespace-nowrap bg-slate-50/80">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedRows.length === 0 ? (
                    <TableRow className="hover:bg-transparent bg-white">
                      <TableCell
                        colSpan={16}
                        className="h-48 text-center text-slate-500 text-sm py-12"
                      >
                        {searchTerm.trim()
                          ? "No entries match your search."
                            : selectedTeacher !== "all"
                            ? "No students for this staff."
                            : 'No batch entries yet. Mark leads as "Admission Done" on the Leads page, or add a student manually.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayedRows.map((row, idx) => {
                      const isEditing = editingId === row.id;
                      const draft = isEditing && editDraft ? editDraft : row;
                      return (
                        <TableRow
                          key={row.id}
                          className={cn(
                            "border-b border-slate-100/80 transition-all hover:bg-slate-50/80 group",
                            isEditing && "bg-blue-50/50"
                          )}
                        >
                          <TableCell className="px-5 py-4 text-sm text-slate-500 tabular-nums w-16 shrink-0 align-middle font-medium">
                            {row.no}
                          </TableCell>
                          <TableCell className="px-5 py-4 min-w-[140px] align-middle">
                            {isEditing ? (
                              <Input
                                className="h-9 text-sm border-slate-200 focus-visible:ring-slate-400 rounded-lg shadow-sm"
                                value={draft.name}
                                onChange={(e) => setEditDraft((p) => (p ? { ...p, name: e.target.value } : null))}
                              />
                            ) : (
                              <span className="text-sm font-bold text-slate-800">{row.name || "—"}</span>
                            )}
                          </TableCell>
                          <TableCell className="px-5 py-4 min-w-[140px] align-middle">
                            {isEditing ? (
                              <Input
                                className="h-9 text-sm border-slate-200 focus-visible:ring-slate-400 min-w-[120px] rounded-lg shadow-sm"
                                value={draft.course}
                                onChange={(e) => setEditDraft((p) => (p ? { ...p, course: e.target.value } : null))}
                              />
                            ) : (
                              <span className="inline-flex items-center rounded-lg border border-indigo-200/60 bg-gradient-to-r from-indigo-50 to-blue-50/50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-700 shadow-[0_1px_2px_rgba(0,0,0,0.02)] whitespace-nowrap">
                                {row.course || "—"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="px-5 py-4 min-w-[120px] align-middle">
                            {isEditing ? (
                              <Input
                                className="h-9 text-sm border-slate-200 focus-visible:ring-slate-400 min-w-[100px] rounded-lg shadow-sm"
                                value={draft.subject}
                                onChange={(e) => setEditDraft((p) => (p ? { ...p, subject: e.target.value } : null))}
                              />
                            ) : (
                              <span className={cn("text-sm font-semibold", row.subject ? "text-slate-700" : "text-slate-300")}>{row.subject || "—"}</span>
                            )}
                          </TableCell>
                          <TableCell className="px-5 py-4 min-w-[110px] align-middle">
                            {isEditing ? (
                              <Select
                                value={draft.slot || "_none"}
                                onValueChange={(v) => setEditDraft((p) => (p ? { ...p, slot: v === "_none" ? "" : v } : null))}
                              >
                                <SelectTrigger className="h-9 text-sm border-slate-200 focus-visible:ring-slate-400 rounded-lg shadow-sm">
                                  <SelectValue placeholder="Slot" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl shadow-lg">
                                  <SelectItem value="_none">Select</SelectItem>
                                  {SLOT_OPTIONS.map((opt) => (
                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className={cn("text-sm font-semibold", row.slot ? "text-slate-700" : "text-slate-300")}>{row.slot || "—"}</span>
                            )}
                          </TableCell>
                          <TableCell className="px-5 py-4 min-w-[180px] align-middle">
                            {isEditing ? (() => {
                              const parts = (draft.time || "").split(/\s*[-–—to]+\s*/i);
                              const start = (parts[0] || "").trim();
                              const end = (parts[1] || "").trim();
                              return (
                                <div className="flex items-center gap-2">
                                  <TimeClock
                                    value={start}
                                    onChange={(newStart) => {
                                      setEditDraft((p) => (p ? { ...p, time: [newStart, end].filter(Boolean).join(" - ") } : null));
                                    }}
                                    placeholder="--:--"
                                    className="w-[88px] shrink-0 h-9 text-sm rounded-lg shadow-sm"
                                    aria-label="Start time"
                                  />
                                  <TimeClock
                                    value={end}
                                    onChange={(newEnd) => {
                                      setEditDraft((p) => (p ? { ...p, time: [start, newEnd].filter(Boolean).join(" - ") } : null));
                                    }}
                                    placeholder="--:--"
                                    className="w-[88px] shrink-0 h-9 text-sm rounded-lg shadow-sm"
                                    aria-label="End time"
                                  />
                                </div>
                              );
                            })() : (
                              <span className={cn("inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold", row.time ? "bg-slate-100/80 text-slate-700 border border-slate-200/60" : "text-slate-300")}>
                                {row.time || "—"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="px-5 py-4 min-w-[130px] align-middle">
                            {isEditing ? (
                              <Select
                                value={draft.teacherId || "_none"}
                                onValueChange={(v) => setEditDraft((p) => (p ? { ...p, teacherId: v === "_none" ? "" : v } : null))}
                              >
                                <SelectTrigger className="h-9 text-sm border-slate-200 focus-visible:ring-slate-400 min-w-[120px] rounded-lg shadow-sm">
                                  <SelectValue placeholder="Select faculty" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl shadow-lg">
                                  <SelectItem value="_none">Unassigned</SelectItem>
                                  {teacherOptions.map((t) => (
                                    <SelectItem key={t} value={t}>{t}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className={cn("text-sm font-semibold", row.teacherId ? "text-slate-800" : "text-slate-400 italic")}>{row.teacherId || "Unassigned"}</span>
                            )}
                          </TableCell>
                          <TableCell className="px-5 py-4 min-w-[130px] align-middle">
                            {isEditing ? (
                              <Select
                                value={draft.isManual ? "new" : "existing"}
                                onValueChange={(v) => setEditDraft((p) => (p ? { ...p, isManual: v === "new" } : null))}
                              >
                                <SelectTrigger className="h-9 text-sm border-slate-200 focus-visible:ring-slate-400 min-w-[120px] rounded-lg shadow-sm">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl shadow-lg">
                                  <SelectItem value="new">New</SelectItem>
                                  <SelectItem value="existing">Existing</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "rounded-lg border px-3 py-1 text-[10px] font-bold uppercase tracking-wider shadow-[0_1px_2px_rgba(0,0,0,0.02)]",
                                  row.isManual
                                    ? "border-emerald-200/60 bg-gradient-to-r from-emerald-50 to-teal-50/50 text-emerald-700"
                                    : "border-sky-200/60 bg-gradient-to-r from-sky-50 to-blue-50/50 text-sky-700"
                                )}
                              >
                                {row.isManual ? "New" : "Existing"}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3 min-w-[120px] align-middle">
                            {isEditing ? (
                              <Input
                                type="date"
                                className="h-9 text-sm border-slate-200 focus-visible:ring-slate-400 min-w-[112px]"
                                value={draft.startDate || ""}
                                onChange={(e) => setEditDraft((p) => (p ? { ...p, startDate: e.target.value } : null))}
                              />
                            ) : (
                              <span className="text-sm font-medium text-slate-700">{row.startDate ? displayDate(row.startDate) : "—"}</span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3 min-w-[120px] align-middle">
                            {isEditing ? (
                              <Input
                                type="date"
                                className="h-9 text-sm border-slate-200 focus-visible:ring-slate-400 min-w-[112px]"
                                value={draft.endDate || ""}
                                onChange={(e) => setEditDraft((p) => (p ? { ...p, endDate: e.target.value } : null))}
                              />
                            ) : (
                              <span className="text-sm font-medium text-slate-600">{row.endDate ? displayDate(row.endDate) : "—"}</span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3 min-w-[130px] align-middle">
                            {isEditing ? (
                              <Input
                                type="date"
                                className="h-9 text-sm border-slate-200 focus-visible:ring-slate-400 min-w-[112px]"
                                value={draft.expectedEndDate || ""}
                                onChange={(e) => setEditDraft((p) => (p ? { ...p, expectedEndDate: e.target.value } : null))}
                              />
                            ) : (
                              <span className="text-sm font-medium text-slate-600">{row.expectedEndDate ? displayDate(row.expectedEndDate) : "—"}</span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3 min-w-[130px] align-middle">
                            {isEditing ? (
                              <Input
                                type="date"
                                className="h-9 text-sm border-slate-200 focus-visible:ring-slate-400 min-w-[112px]"
                                value={draft.startDate || ""}
                                onChange={(e) => setEditDraft((p) => (p ? { ...p, startDate: e.target.value } : null))}
                              />
                            ) : (
                              <span className="text-sm font-medium text-slate-700">{row.startDate ? displayDate(row.startDate) : "—"}</span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3 min-w-[130px] align-middle">
                            {isEditing ? (
                              <Input
                                type="date"
                                className="h-9 text-sm border-slate-200 focus-visible:ring-slate-400 min-w-[112px]"
                                value={draft.endDate || ""}
                                onChange={(e) => setEditDraft((p) => (p ? { ...p, endDate: e.target.value } : null))}
                              />
                            ) : (
                              <span className="text-sm font-medium text-slate-600">{row.endDate ? displayDate(row.endDate) : "—"}</span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3 min-w-[120px] align-middle">
                            {isEditing ? (
                              <Select
                                value={draft.endDate ? "completed" : "ongoing"}
                                onValueChange={(v) =>
                                  setEditDraft((p) => {
                                    if (!p) return null;
                                    if (v === "ongoing") {
                                      return { ...p, endDate: "" };
                                    }
                                    const today = new Date().toISOString().slice(0, 10);
                                    return { ...p, endDate: p.endDate || today };
                                  })
                                }
                              >
                                <SelectTrigger className="h-9 text-sm border-slate-200 focus-visible:ring-slate-400 min-w-[120px]">
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="ongoing">Ongoing</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                                  row.endDate
                                    ? "border-violet-200 bg-violet-50 text-violet-700"
                                    : "border-amber-200 bg-amber-50 text-amber-700"
                                )}
                              >
                                {row.endDate ? "Completed" : "Ongoing"}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3 min-w-[200px] max-w-[320px] align-middle">
                            {isEditing ? (
                              <Input
                                className="h-9 text-sm border-slate-200 focus-visible:ring-slate-400 min-w-[140px]"
                                value={draft.comments}
                                onChange={(e) => setEditDraft((p) => (p ? { ...p, comments: e.target.value } : null))}
                              />
                            ) : (
                              <span className="text-sm text-slate-600 truncate block leading-5" title={row.comments}>
                                {row.comments || "—"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3 w-32 shrink-0 text-center align-middle">
                            {isEditing ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="h-8 w-8 p-0 rounded-md bg-slate-900 hover:bg-slate-800 shadow-sm"
                                  onClick={() => handleSaveEdit()}
                                  disabled={savingId !== null}
                                >
                                  <Save className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                                  onClick={handleCancelEdit}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1.5">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-transparent hover:border-slate-200"
                                  onClick={() => handleStartEdit(row)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100"
                                  onClick={() => handleDelete(row.id, row.isManual)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
          </TabsContent>
          <TabsContent value="analytics" className="mt-0 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Course Distribution */}
              <Card className="border border-slate-200/80 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)] rounded-2xl bg-white/95 backdrop-blur overflow-hidden">
                <CardHeader className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50 to-white pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-100/80 rounded-xl">
                      <BookOpen className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold text-slate-800">Course</CardTitle>
                      <p className="text-xs text-slate-500 mt-0.5">Distribution by Course</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="h-[280px] w-full">
                    {courseDistribution.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={courseDistribution} margin={{ top: 20, right: 30, left: 0, bottom: 5 }} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                          <XAxis type="number" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                          <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                          <Tooltip 
                            cursor={{ fill: '#f8fafc' }} 
                            contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                            {courseDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-400 text-sm">No course data</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Subject Distribution */}
              <Card className="border border-slate-200/80 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)] rounded-2xl bg-white/95 backdrop-blur overflow-hidden">
                <CardHeader className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50 to-white pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-100/80 rounded-xl">
                      <Library className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold text-slate-800">Subject</CardTitle>
                      <p className="text-xs text-slate-500 mt-0.5">Distribution by Subject</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="h-[280px] w-full">
                    {subjectDistribution.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={subjectDistribution} margin={{ top: 20, right: 30, left: 0, bottom: 5 }} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                          <XAxis type="number" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                          <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                          <Tooltip 
                            cursor={{ fill: '#f8fafc' }} 
                            contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                            {subjectDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-400 text-sm">No subject data</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Slot Distribution */}
              <Card className="border border-slate-200/80 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)] rounded-2xl bg-white/95 backdrop-blur overflow-hidden">
                <CardHeader className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50 to-white pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-100/80 rounded-xl">
                      <Clock className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold text-slate-800">Slot</CardTitle>
                      <p className="text-xs text-slate-500 mt-0.5">Distribution by Slot</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="h-[280px] w-full">
                    {slotDistribution.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={slotDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={2}
                            dataKey="value"
                            stroke="none"
                          >
                            {slotDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-400 text-sm">No slot data</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Time Distribution */}
              <Card className="border border-slate-200/80 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)] rounded-2xl bg-white/95 backdrop-blur overflow-hidden">
                <CardHeader className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50 to-white pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-rose-100/80 rounded-xl">
                      <Clock className="w-5 h-5 text-rose-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold text-slate-800">Time</CardTitle>
                      <p className="text-xs text-slate-500 mt-0.5">Distribution by Time</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="h-[280px] w-full">
                    {timeDistribution.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={timeDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={2}
                            dataKey="value"
                            stroke="none"
                          >
                            {timeDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[(index + 5) % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-400 text-sm">No time data</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Faculty Distribution */}
              <Card className="border border-slate-200/80 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)] rounded-2xl bg-white/95 backdrop-blur overflow-hidden">
                <CardHeader className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50 to-white pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-100/80 rounded-xl">
                      <UserCheck className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold text-slate-800">Faculty</CardTitle>
                      <p className="text-xs text-slate-500 mt-0.5">Distribution by Faculty</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="h-[280px] w-full">
                    {teacherDistribution.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={teacherDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={2}
                            dataKey="value"
                            stroke="none"
                          >
                            {teacherDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                          <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-400 text-sm">No faculty data</div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* New/Existing Distribution */}
              <Card className="border border-slate-200/80 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.15)] rounded-2xl bg-white/95 backdrop-blur overflow-hidden">
                <CardHeader className="border-b border-slate-100/80 bg-gradient-to-r from-slate-50 to-white pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-sky-100/80 rounded-xl">
                      <Users className="w-5 h-5 text-sky-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold text-slate-800">New / Existing</CardTitle>
                      <p className="text-xs text-slate-500 mt-0.5">Distribution by Student Type</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="h-[280px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={newExistingDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={2}
                          dataKey="value"
                          stroke="none"
                        >
                          <Cell fill="#10b981" /> {/* New - Emerald */}
                          <Cell fill="#0ea5e9" /> {/* Existing - Sky */}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

      <Dialog open={manageStaffOpen} onOpenChange={setManageStaffOpen}>
        <DialogContent className="sm:max-w-md border-slate-200 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-slate-900">Manage Staff</DialogTitle>
            <p className="text-sm text-slate-500">Add or remove staff names. These appear in the Staff dropdown when adding or editing batch entries.</p>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Input
                className="border-slate-200 flex-1"
                placeholder="New staff name"
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddStaff())}
              />
              <Button
                type="button"
                size="sm"
                onClick={handleAddStaff}
                disabled={savingId !== null || !newStaffName.trim()}
                className="shrink-0"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add
              </Button>
            </div>
            <div className="border border-slate-200 rounded-md max-h-[240px] overflow-y-auto">
              {teachersList.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-sm">No staff added yet. Add a name above.</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {teachersList.map((name) => (
                    <li key={name} className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-slate-50">
                      <span className="text-sm font-medium text-slate-800 truncate">{name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                        onClick={() => handleRemoveStaff(name)}
                        disabled={savingId !== null}
                        aria-label={`Remove ${name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <DialogFooter className="border-t border-slate-100 pt-4">
            <Button variant="outline" onClick={() => setManageStaffOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg border-slate-200 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-slate-900">Add Student to Batch</DialogTitle>
          </DialogHeader>
          <div className="grid gap-5 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Name</Label>
                <Input
                  className="border-slate-200"
                  value={addForm.name}
                  onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Student name"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Course</Label>
                <Select
                  value={addForm.course || "_none"}
                  onValueChange={(v) => setAddForm((p) => ({ ...p, course: v === "_none" ? "" : v }))}
                >
                  <SelectTrigger className="border-slate-200">
                    <SelectValue placeholder="Select course" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Select course</SelectItem>
                    {courseOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Staff</Label>
              <Select
                value={addForm.teacherId || "_none"}
                onValueChange={(v) => setAddForm((p) => ({ ...p, teacherId: v === "_none" ? "" : v }))}
              >
                <SelectTrigger className="border-slate-200">
                  <SelectValue placeholder="Select staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Select staff</SelectItem>
                  {teacherOptions.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Subject</Label>
                <Input
                  className="border-slate-200"
                  value={addForm.subject}
                  onChange={(e) => setAddForm((p) => ({ ...p, subject: e.target.value }))}
                  placeholder="Subject"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Slot</Label>
                <Select
                  value={addForm.slot || "_none"}
                  onValueChange={(v) => setAddForm((p) => ({ ...p, slot: v === "_none" ? "" : v }))}
                >
                  <SelectTrigger className="border-slate-200">
                    <SelectValue placeholder="Select slot" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Select slot</SelectItem>
                    {SLOT_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Time</Label>
              <div className="flex items-center gap-3">
                <div className="flex-1 space-y-1">
                  <span className="text-xs text-slate-500">Start</span>
                  <TimeClock
                    value={addForm.startTime}
                    onChange={(v) => setAddForm((p) => ({ ...p, startTime: v }))}
                    placeholder="--:--"
                    className="w-full border-slate-200"
                    aria-label="Start time"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <span className="text-xs text-slate-500">End</span>
                  <TimeClock
                    value={addForm.endTime}
                    onChange={(v) => setAddForm((p) => ({ ...p, endTime: v }))}
                    placeholder="--:--"
                    className="w-full border-slate-200"
                    aria-label="End time"
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">Start Date</Label>
                <Input
                  type="date"
                  className="border-slate-200"
                  value={addForm.startDate}
                  onChange={(e) => setAddForm((p) => ({ ...p, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">End Date</Label>
                <Input
                  type="date"
                  className="border-slate-200"
                  value={addForm.endDate}
                  onChange={(e) => setAddForm((p) => ({ ...p, endDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Expected End Date</Label>
              <Input
                type="date"
                className="border-slate-200"
                value={addForm.expectedEndDate}
                onChange={(e) => setAddForm((p) => ({ ...p, expectedEndDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-slate-700">Comments</Label>
              <Input
                className="border-slate-200"
                value={addForm.comments}
                onChange={(e) => setAddForm((p) => ({ ...p, comments: e.target.value }))}
                placeholder="Comments"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 border-t border-slate-100 pt-4 mt-2">
            <Button
              variant="outline"
              className="border-slate-200"
              onClick={() => setAddOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddStudent}
              disabled={savingId !== null || !addForm.name.trim()}
              className="bg-slate-900 hover:bg-slate-800"
            >
              Add Student
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {batchRows.length === 0 && selectedTeacher === "all" && (
        <Card className="border-slate-200/80 border-dashed bg-white/60">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-slate-100 p-4 mb-4">
              <GraduationCap className="h-10 w-10 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-1">No batch entries</h3>
            <p className="text-sm text-slate-500 max-w-sm">
              Mark leads as &quot;Admission Done&quot; on the Leads page to add them here, or add a student manually above.
            </p>
          </CardContent>
        </Card>
      )}
      </div>
    </div>
  );
}
