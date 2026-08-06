import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Search, 
  Plus, 
  Download, 
  Printer, 
  Share2, 
  Trash2, 
  Eye, 
  GraduationCap, 
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  Pencil,
  Copy,
  Share
} from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useNavigate } from "react-router-dom";
import { firebaseHelpers } from "@/lib/firebaseHelpers";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { fillCertificatePdf, CertificateData } from "@/lib/pdfFiller";
import { format } from "date-fns";
import { formatDateForInput } from "@/utils/dateUtils";
import { initializeImageKit, getImageKitAuthParams } from "@/lib/imagekitConfig";
import { useTableSort } from "@/hooks/useTableSort";
import { SortableTableHead } from "@/components/ui/sortable-table-head";

let imagekit: any = null;

export default function CertificateManagement() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [successfullyCompleting, setSuccessfullyCompleting] = useState("");
  const [courseName, setCourseName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [completionDate, setCompletionDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [duration, setDuration] = useState("");
  const [grade, setGrade] = useState("");
  const STATIC_LOCATION = "ZICA/ZIMA, PCMC";
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingCertId, setEditingCertId] = useState<string | null>(null);
  const [viewingPdfUrl, setViewingPdfUrl] = useState<string | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Initialize ImageKit
  useEffect(() => {
    const init = async () => {
      try {
        imagekit = await initializeImageKit();
      } catch (error) {
        console.error("ImageKit init failed:", error);
      }
    };
    init();
  }, []);

  // Fetch students for selection
  const { data: students = [], isLoading: isLoadingStudents } = useQuery({
    queryKey: ["students", userProfile?.centreId],
    queryFn: () => firebaseHelpers.getStudents(userProfile?.centreId),
    enabled: !!userProfile?.centreId,
  });

  // Fetch batch data (includes both lead-based and manual batch entries)
  const { data: batchEntries = {} } = useQuery({
    queryKey: ["batchEntries", userProfile?.centreId],
    queryFn: async () => {
      if (!userProfile?.centreId) return {};
      return firebaseHelpers.getBatchEntries(userProfile.centreId);
    },
    enabled: !!userProfile?.centreId,
  });

  // Combined list: students + manual batch entries so manual entries are also selectable
  const studentsForSelection = useMemo(() => {
    const list: Array<{ id: string; firstName: string; lastName: string; course?: string; isManualBatchEntry?: boolean }> = [
      ...students.map((s: any) => ({
        id: s.id,
        firstName: s.firstName || "",
        lastName: s.lastName || "",
        course: s.course || s.program || s.courseInterest,
        isManualBatchEntry: false,
      })),
    ];
    const seenNames = new Set(list.map((s) => `${(s.firstName + " " + s.lastName).trim().toLowerCase()}`));
    Object.entries(batchEntries).forEach(([id, entry]: [string, any]) => {
      if (!id.startsWith("manual-") || !entry?.name) return;
      const name = (entry.name || "").trim();
      const key = name.toLowerCase();
      if (seenNames.has(key)) return;
      seenNames.add(key);
      list.push({
        id,
        firstName: name,
        lastName: "",
        course: entry.course || "",
        isManualBatchEntry: true,
      });
    });
    return list;
  }, [students, batchEntries]);

  // Auto-populate fields from student and batch data (supports both students and manual batch entries)
  useEffect(() => {
    if (!selectedStudentId || isEditMode) return;
    const student = studentsForSelection.find((s: any) => s.id === selectedStudentId);
    if (!student) return;

    let batchEntry = batchEntries[selectedStudentId];
    if (!batchEntry && !student.isManualBatchEntry) {
      const studentFullName = `${student.firstName} ${student.lastName || ""}`.trim().toLowerCase();
      const foundBatchId = Object.keys(batchEntries).find((id) => {
        const entry = batchEntries[id];
        const entryName = (entry?.name || "").trim().toLowerCase();
        return entryName === studentFullName;
      });
      if (foundBatchId) batchEntry = batchEntries[foundBatchId];
    }

    setCourseName(batchEntry?.course || student.course || "");
    setSuccessfullyCompleting("");

    const sDate =
      batchEntry?.startDate ||
      (student as any).courseStartDate ||
      (student as any).startDate ||
      (student as any).admissionDate ||
      "";
    setStartDate(formatDateForInput(sDate));

    const cDate = batchEntry?.expectedEndDate || batchEntry?.endDate || (student as any).completionDate || (student as any).endDate || "";
    if (formatDateForInput(cDate)) setCompletionDate(formatDateForInput(cDate));
    else setCompletionDate(format(new Date(), "yyyy-MM-dd"));

    setDuration(batchEntry?.duration || (student as any).courseDuration || (student as any).duration || "");
    setGrade((student as any).grade || "");
  }, [selectedStudentId, studentsForSelection, batchEntries, isEditMode]);

  // Fetch generated certificates
  const { data: certificates = [], isLoading: isLoadingCerts } = useQuery({
    queryKey: ["certificates", userProfile?.centreId],
    queryFn: () => firebaseHelpers.getCertificates(userProfile?.centreId),
    enabled: !!userProfile?.centreId,
  });

  const saveCertMutation = useMutation({
    mutationFn: (certData: any) => firebaseHelpers.saveCertificate(certData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
      toast({
        title: "Success",
        description: "Certificate record saved successfully",
      });
      setIsCreateModalOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save certificate record",
        variant: "destructive",
      });
    }
  });

  const updateCertMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      firebaseHelpers.updateCertificate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
      toast({
        title: "Updated",
        description: "Certificate record updated successfully",
      });
      setIsCreateModalOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update certificate",
        variant: "destructive",
      });
    }
  });

  const deleteCertMutation = useMutation({
    mutationFn: (id: string) => firebaseHelpers.deleteCertificate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["certificates"] });
      toast({
        title: "Deleted",
        description: "Certificate record removed",
      });
    }
  });

  const resetForm = () => {
    setSelectedStudentId("");
    setSuccessfullyCompleting("");
    setCourseName("");
    setStartDate("");
    setCompletionDate(format(new Date(), "yyyy-MM-dd"));
    setDuration("");
    setGrade("");
    setPreviewPdfUrl(null);
    setIsEditMode(false);
    setEditingCertId(null);
  };

  const handleGenerateCertificate = async () => {
    if (!selectedStudentId) {
      toast({
        title: "Missing Info",
        description: "Please select a student at least.",
        variant: "destructive",
      });
      return;
    }

    const studentOrEntry = studentsForSelection.find((s: any) => s.id === selectedStudentId);
    if (!studentOrEntry) return;

    const studentName = `${studentOrEntry.firstName} ${studentOrEntry.lastName || ""}`.trim();

    setIsGenerating(true);
    try {
      const certData: CertificateData = {
        studentName,
        successfullyCompleting,
        courseName,
        startDate: startDate ? format(new Date(startDate), "MMMM dd, yyyy") : "",
        completionDate: completionDate ? format(new Date(completionDate), "MMMM dd, yyyy") : "",
        duration,
        location: STATIC_LOCATION,
        grade,
      };

      const pdfBytes = await fillCertificatePdf(certData);
      
      const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
      const fileName = `Certificate_${certData.studentName.replace(/\s+/g, "_")}.pdf`;
      
      // Upload to ImageKit
      const { token, expire, signature } = await getImageKitAuthParams();
      
      const uploadResult = await new Promise<any>((resolve, reject) => {
        imagekit.upload({
          file: blob,
          fileName,
          folder: "/certificates",
          token,
          expire,
          signature,
          useUniqueFileName: false,
        }, (err: any, result: any) => {
          if (err) reject(err);
          else resolve(result);
        });
      });

      const pdfUrl = uploadResult.url;
      setPreviewPdfUrl(pdfUrl);

      if (isEditMode && editingCertId) {
        updateCertMutation.mutate({
          id: editingCertId,
          data: {
            studentId: selectedStudentId,
            studentName: certData.studentName,
            successfullyCompleting,
            courseName,
            startDate,
            completionDate,
            duration,
            location: STATIC_LOCATION,
            grade,
            pdfUrl: pdfUrl,
            fileId: uploadResult.fileId,
          }
        });
      } else {
        // Save record to Firebase (metadata + link)
        saveCertMutation.mutate({
          studentId: selectedStudentId,
          studentName: certData.studentName,
          successfullyCompleting,
          courseName,
          startDate,
          completionDate,
          duration,
          location: STATIC_LOCATION,
          grade,
          centreId: userProfile?.centreId,
          generatedBy: userProfile?.uid,
          pdfUrl: pdfUrl,
          fileId: uploadResult.fileId,
        });
      }

    } catch (error) {
      console.error("Generation error:", error);
      toast({
        title: "Generation Failed",
        description: "Could not generate or upload certificate",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (cert: any) => {
    // Re-generate or if we had a link we'd use it. 
    // For now, let's re-generate to download the actual PDF
    // In a real app, you might upload the PDF to Storage and save that link.
    // The user asked to "save this certificate in Firebase database only in link format"
    // and "required info in this certificate".
    // I'll re-trigger generation for download if needed, or simply let them click "View"
    // which generates it on the fly from the stored metadata.
    toast({
      title: "Downloading",
      description: `Preparing certificate for ${cert.studentName}...`,
    });
    viewCertificate(cert, true);
  };

  const viewCertificate = (cert: any, autoDownload = false) => {
    if (autoDownload) {
      const link = document.createElement("a");
      link.href = cert.pdfUrl;
      link.download = `Certificate_${cert.studentName.replace(/\s+/g, "_")}.pdf`;
      link.target = "_blank";
      link.click();
    } else {
      setViewingPdfUrl(cert.pdfUrl);
      setIsViewModalOpen(true);
    }
  };

  const handleEdit = (cert: any) => {
    setSelectedStudentId(cert.studentId);
    setSuccessfullyCompleting(cert.successfullyCompleting || "");
    setCourseName(cert.courseName);
    setStartDate(cert.startDate || "");
    setCompletionDate(cert.completionDate);
    setDuration(cert.duration || "");
    setGrade(cert.grade || "");
    setEditingCertId(cert.id);
    setIsEditMode(true);
    setIsCreateModalOpen(true);
  };

  const handleShare = async (cert: any) => {
    const shareData = {
      title: 'Course Completion Certificate',
      text: `View completion certificate for ${cert.studentName} for the course ${cert.courseName}`,
      url: cert.pdfUrl
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error('Share failed:', err);
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(cert.pdfUrl);
        toast({
          title: "Link Copied",
          description: "Certificate link copied to clipboard",
        });
      } catch (err) {
        console.error('Copy failed:', err);
      }
    }
  };

  const filteredCerts = certificates.filter((c: any) => 
    c.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.courseName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { sortedData: sortedFilteredCerts, requestSort, sortConfig } = useTableSort(filteredCerts);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate("/academics")}
            className="text-slate-500 hover:text-slate-700 text-sm font-medium flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Academics
          </button>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <GraduationCap className="w-8 h-8 text-purple-600" />
            Certificate Management
          </h1>
          <p className="text-slate-500 mt-1">
            Generate and manage course completion certificates
          </p>
        </div>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-purple-600 hover:bg-purple-700">
              <Plus className="w-4 h-4 mr-2" /> Generate New
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{isEditMode ? "Edit Certificate" : "Generate Certificate"}</DialogTitle>
              <DialogDescription>
                {isEditMode 
                  ? "Update certificate details and re-generate." 
                  : "Select a student and enter course details to generate a certificate."}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="student">Select Student</Label>
                <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a student" />
                  </SelectTrigger>
                  <SelectContent>
                    {studentsForSelection.map((student: any) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.firstName} {student.lastName ? ` ${student.lastName}` : ""}
                        {student.course ? ` (${student.course})` : ""}
                        {student.isManualBatchEntry ? " — Batch" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sc-text">For Successfully Completing</Label>
                <Input 
                  id="sc-text" 
                  value={successfullyCompleting} 
                  onChange={(e) => setSuccessfullyCompleting(e.target.value)}
                  placeholder="e.g. Professional Course" 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="course">Course Name</Label>
                <Input 
                  id="course" 
                  value={courseName} 
                  onChange={(e) => setCourseName(e.target.value)}
                  placeholder="e.g. Graphic Designing" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input 
                    id="startDate" 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="date">Completion Date</Label>
                  <Input 
                    id="date" 
                    type="date" 
                    value={completionDate} 
                    onChange={(e) => setCompletionDate(e.target.value)} 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="duration">Duration</Label>
                  <Input 
                    id="duration" 
                    value={duration} 
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="e.g. 6 Months" 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="grade">Grade</Label>
                  <Input 
                    id="grade" 
                    value={grade} 
                    onChange={(e) => setGrade(e.target.value)}
                    placeholder="e.g. A+" 
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => { setIsCreateModalOpen(false); resetForm(); }}>
                Cancel
              </Button>
              <Button 
                onClick={handleGenerateCertificate} 
                className="bg-purple-600 hover:bg-purple-700"
                disabled={isGenerating || !selectedStudentId}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isEditMode ? "Updating..." : "Generating..."}
                  </>
                ) : (
                  isEditMode ? "Update & Re-generate" : "Generate & Preview"
                )}
              </Button>
            </DialogFooter>
            
            {previewPdfUrl && (
              <div className="mt-4 p-4 border rounded-lg bg-slate-50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-700">Preview Ready</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => window.open(previewPdfUrl, "_blank")}>
                      <Eye className="w-4 h-4 mr-2" /> View Full
                    </Button>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => setIsCreateModalOpen(false)}>
                      Confirm & Close
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Main Content */}
      <Card className="border-slate-200/60 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Issued Certificates</CardTitle>
              <CardDescription>Records of all generated certificates</CardDescription>
            </div>
            <div className="relative w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by student or course..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingCerts ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 text-purple-600 animate-spin mb-4" />
              <p className="text-slate-500">Loading certificates...</p>
            </div>
          ) : filteredCerts.length === 0 ? (
            <div className="text-center py-12">
              <GraduationCap className="h-12 w-12 text-slate-200 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900">No certificates found</h3>
              <p className="text-slate-500">Generate your first certificate to see it here.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead sortConfig={sortConfig} sortKey="studentName" requestSort={requestSort}>Student Name</SortableTableHead>
                  <SortableTableHead sortConfig={sortConfig} sortKey="courseName" requestSort={requestSort}>Course</SortableTableHead>
                  <SortableTableHead sortConfig={sortConfig} sortKey="completionDate" requestSort={requestSort}>Completion Date</SortableTableHead>
                  <SortableTableHead sortConfig={sortConfig} sortKey="status" requestSort={requestSort}>Status</SortableTableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedFilteredCerts.map((cert: any) => (
                  <TableRow key={cert.id}>
                    <TableCell className="font-medium text-slate-900">{cert.studentName}</TableCell>
                    <TableCell>{cert.courseName}</TableCell>
                    <TableCell>{format(new Date(cert.completionDate), "MMM dd, yyyy")}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Generated
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => viewCertificate(cert)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleEdit(cert)}
                          className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDownload(cert)}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleShare(cert)}
                          className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                          title="Share"
                        >
                          <Share className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => {
                            if (window.confirm("Are you sure you want to delete this certificate record?")) {
                              deleteCertMutation.mutate(cert.id);
                            }
                          }}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View Certificate Modal */}
      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="sm:max-w-[90vw] sm:max-h-[90vh] p-0 overflow-hidden bg-slate-800 border-slate-700">
          <DialogHeader className="p-4 bg-slate-900 text-white border-b border-slate-700 flex flex-row items-center justify-between">
            <div>
              <DialogTitle className="text-white">Certificate Viewer</DialogTitle>
              <DialogDescription className="text-slate-400">
                Course Completion Authentication
              </DialogDescription>
            </div>
            <div className="flex gap-2 mr-8">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => window.open(viewingPdfUrl!, "_blank")}
                className="bg-slate-800 text-white border-slate-600 hover:bg-slate-700"
              >
                <Eye className="w-4 h-4 mr-2" /> Open Externally
              </Button>
              <Button 
                size="sm" 
                onClick={() => {
                  const link = document.createElement("a");
                  link.href = viewingPdfUrl!;
                  link.download = "Certificate.pdf";
                  link.click();
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Download className="w-4 h-4 mr-2" /> Download
              </Button>
            </div>
          </DialogHeader>
          <div className="w-full h-[80vh] bg-slate-800">
            {viewingPdfUrl && (
              <iframe 
                src={`${viewingPdfUrl}#toolbar=1&navpanes=0&scrollbar=1`}
                className="w-full h-full border-0"
                title="Certificate PDF"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
