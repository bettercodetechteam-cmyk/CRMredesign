import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { BookOpen, Plus, Trash2, Upload } from "lucide-react";
import { syllabusApi, errorMessage } from "@/lib/syllabusApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";
import Loading from "@/components/ui/loading";
import { cloneModules, instituteTemplates, orderModules, SYLLABUS_STATUS_LABEL } from "@shared/courseSetup";
import type { DashboardTopicRow, StudentFeedbackNote, SyllabusModule, SyllabusPdfPreview, SyllabusPdfWarning, SyllabusStatus, Understanding } from "@shared/syllabusTypes";
import { ProgressReadout, SyllabusEmpty, SyllabusError, SyllabusPage, showDate, useSyllabusAccess } from "./SyllabusChrome";
import { AssignBatch, CopySource, ImportIssues, PasteTopics, RoleNote, StatusBadge, StatusStepper, courseSummary } from "./CourseSetupFlow";

function newId(): string {
  return crypto.randomUUID();
}

function emptyTopic(order: number) {
  return { id: newId(), title: "", description: "", displayOrder: order, estimatedMinutes: null as number | null };
}

function blankModule(order: number): SyllabusModule {
  return { id: newId(), title: "", weekLabel: "", displayOrder: order, topics: [emptyTopic(1)] };
}

function PdfUploadButton({
  busy,
  onFiles,
  beforeOpen,
  variant = "outline",
  className,
  buttonClassName,
  label = "Upload File",
}: {
  busy: boolean;
  onFiles: (files: File[]) => void;
  beforeOpen?: () => boolean;
  variant?: "default" | "outline";
  className?: string;
  buttonClassName?: string;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState("");

  return (
    <div className={className ?? "space-y-2"}>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(event) => {
          const chosen = [...(event.target.files ?? [])];
          event.target.value = "";
          if (chosen.length === 0) return;
          const accepted: File[] = [];
          const problems: string[] = [];
          chosen.forEach((file) => {
            const name = file.name.toLowerCase();
            const allowed = [".pdf", ".doc", ".docx", ".xls", ".xlsx"].some((extension) => name.endsWith(extension));
            if (!allowed) {
              problems.push(`${file.name} is not a PDF, Word, or Excel file.`);
              return;
            }
            if (file.size > 8 * 1024 * 1024) {
              problems.push(`${file.name} is larger than 8 MB.`);
              return;
            }
            accepted.push(file);
          });
          setFileError(problems.join(" "));
          if (accepted.length > 0) onFiles(accepted);
        }}
      />
      <Button
        type="button"
        variant={variant}
        className={buttonClassName}
        disabled={busy}
        onClick={() => {
          if (beforeOpen && !beforeOpen()) return;
          inputRef.current?.click();
        }}
      >
        <Upload className="w-4 h-4" />
        {busy ? "Reading files..." : label}
      </Button>
      {fileError ? <p className="text-sm text-red-700">{fileError}</p> : null}
    </div>
  );
}

export default function SyllabusSetup() {
  const access = useSyllabusAccess();
  const canEdit = Boolean(access.data?.canAuthor || access.data?.canEditSyllabus);
  const canReview = Boolean(access.data?.canReview);
  const canCoordinate = Boolean(access.data?.canCoordinate);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [courseName, setCourseName] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [modules, setModules] = useState<SyllabusModule[]>([]);
  const [importWarnings, setImportWarnings] = useState<SyllabusPdfWarning[]>([]);
  const [unimported, setUnimported] = useState<SyllabusPdfWarning[]>([]);
  const [localName, setLocalName] = useState("");
  const [setupStep, setSetupStep] = useState<"closed" | "choose" | "preview">("closed");
  const [reviewNote, setReviewNote] = useState("");
  const [formError, setFormError] = useState("");
  const [versionToDelete, setVersionToDelete] = useState<number | null>(null);
  const previewingPdf = useRef(false);
  const keepWarnings = useRef(false);
  const startManual = useRef(false);
  const keepBlank = useRef(false);
  const closeCourse = () => {
    setSelectedId("");
    setLocalName("");
    setSetupStep("closed");
    setImportWarnings([]);
    setUnimported([]);
    setFormError("");
    setReviewNote("");
  };

  const syllabi = useQuery({
    queryKey: ["syllabi"],
    queryFn: () => syllabusApi.list(),
    enabled: canCoordinate || canEdit,
  });
  const meta = useQuery({
    queryKey: ["syllabus-meta"],
    queryFn: () => syllabusApi.meta(),
    enabled: canCoordinate,
  });
  const detail = useQuery({
    queryKey: ["syllabus", selectedId],
    queryFn: () => syllabusApi.get(selectedId),
    enabled: Boolean(selectedId),
  });
  const feedback = useQuery({
    queryKey: ["syllabus-feedback", selectedId],
    queryFn: () => syllabusApi.courseFeedback(selectedId),
    enabled: Boolean(selectedId && (canCoordinate || canEdit || access.data?.canTeach)),
    retry: false,
  });

  useEffect(() => {
    if (localName) return;
    previewingPdf.current = false;
    if (!startManual.current) keepBlank.current = false;
  }, [selectedId, localName]);

  useEffect(() => {
    if (!selectedId || !detail.data || previewingPdf.current || localName) return;
    const source = detail.data.draft ?? detail.data.published;
    const next = source ? source.modules.map((module) => ({ ...module, topics: module.topics.map((topic) => ({ ...topic })) })) : [];
    const manual = startManual.current;
    startManual.current = false;
    if (manual && next.length === 0) {
      keepBlank.current = true;
      setModules([blankModule(1)]);
    } else if (!(keepBlank.current && next.length === 0)) {
      keepBlank.current = false;
      setModules(next);
    }
    if (keepWarnings.current) keepWarnings.current = false;
    else {
      setImportWarnings([]);
      setUnimported([]);
      setFormError("");
    }
    if (manual) {
      requestAnimationFrame(() => {
        document.getElementById("syllabus-preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [detail.data, localName, selectedId]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["syllabi"] });
    if (selectedId) await queryClient.invalidateQueries({ queryKey: ["syllabus", selectedId] });
  };

  const save = useMutation({
    mutationFn: () => syllabusApi.save(selectedId, orderModules(modules)),
    onSuccess: async () => {
      previewingPdf.current = false;
      toast({ title: "Draft saved" });
      await refresh();
    },
    onError: (error) => setFormError(errorMessage(error)),
  });

  const applyPreview = (preview: SyllabusPdfPreview, name: string) => {
    previewingPdf.current = true;
    keepWarnings.current = true;
    setModules(orderModules(preview.modules));
    setImportWarnings(preview.warnings);
    setUnimported(preview.unimported ?? []);
    if (!selectedId) {
      setLocalName(name);
      setSetupStep("preview");
    }
    requestAnimationFrame(() => {
      document.getElementById("syllabus-preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const importPdf = useMutation({
    mutationFn: async (files: File[]) => {
      const preview = await syllabusApi.previewFile(files[0]);
      const failed = files.slice(1).map((file) => `${file.name} was skipped. Set up one course at a time.`);
      return { preview, failed };
    },
    onSuccess: ({ preview, failed }) => {
      const name = courseName.trim() || localName || preview.courseName || "";
      if (!selectedId && !name) {
        setFormError("Type a course name, then upload the syllabus.");
        return;
      }
      if (!selectedId) setCourseName(name);
      applyPreview(preview, name);
      setFormError(failed.join(" "));
      toast({ title: "Preview ready", description: "Correct the topics, then save the draft. Nothing is published yet." });
    },
    onError: (error) => setFormError(errorMessage(error)),
  });

  const removeVersion = useMutation({
    mutationFn: (version: number) => syllabusApi.deleteVersion(selectedId, version),
    onSuccess: async (result) => {
      setVersionToDelete(null);
      toast({ title: result ? `Version ${versionToDelete} deleted` : "Course removed" });
      if (!result) closeCourse();
      await queryClient.invalidateQueries({ queryKey: ["syllabi"] });
      await queryClient.invalidateQueries({ queryKey: ["syllabus-dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["syllabus-batches"] });
      if (result && selectedId) await queryClient.invalidateQueries({ queryKey: ["syllabus", selectedId] });
    },
    onError: (error) => {
      setVersionToDelete(null);
      setFormError(errorMessage(error));
    },
  });

  const publish = useMutation({
    mutationFn: async () => {
      if (detail.data?.draft?.status === "approved") await syllabusApi.save(selectedId, orderModules(modules));
      return syllabusApi.publish(selectedId);
    },
    onSuccess: async (published) => {
      previewingPdf.current = false;
      setLocalName("");
      toast({ title: "Version published", description: `Version ${published.currentVersion} is now published.` });
      await refresh();
      requestAnimationFrame(() => {
        document.getElementById("assign-batch")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    },
    onError: (error) => setFormError(errorMessage(error)),
  });

  const submit = useMutation({
    mutationFn: async () => {
      await syllabusApi.save(selectedId, orderModules(modules));
      return syllabusApi.submit(selectedId);
    },
    onSuccess: async () => {
      previewingPdf.current = false;
      toast({ title: "Submitted for review", description: "A director or academic head can approve it." });
      await refresh();
    },
    onError: (error) => setFormError(errorMessage(error)),
  });

  const approve = useMutation({
    mutationFn: async () => {
      await syllabusApi.save(selectedId, orderModules(modules));
      return syllabusApi.approve(selectedId);
    },
    onSuccess: async () => {
      previewingPdf.current = false;
      toast({ title: "Course approved", description: "Publish it when the version should go live." });
      await refresh();
    },
    onError: (error) => setFormError(errorMessage(error)),
  });

  const withdraw = useMutation({
    mutationFn: () => syllabusApi.withdraw(selectedId, reviewNote.trim()),
    onSuccess: async () => {
      toast({ title: "Returned to draft" });
      setReviewNote("");
      await refresh();
    },
    onError: (error) => setFormError(errorMessage(error)),
  });

  const removeDraft = useMutation({
    mutationFn: () => syllabusApi.removeDraft(selectedId),
    onSuccess: async () => {
      toast({ title: "Draft removed" });
      closeCourse();
      await queryClient.invalidateQueries({ queryKey: ["syllabi"] });
    },
    onError: (error) => setFormError(errorMessage(error)),
  });

  const saveLocal = useMutation({
    mutationFn: () => syllabusApi.create(localName.trim(), orderModules(modules)),
    onSuccess: async (created) => {
      previewingPdf.current = false;
      setLocalName("");
      setSetupStep("closed");
      setSelectedId(created.id);
      toast({ title: "Draft saved", description: `${created.courseName} can be submitted for review.` });
      await refresh();
    },
    onError: (error) => setFormError(errorMessage(error)),
  });

  if (access.data && !canCoordinate && !canEdit) {
    return (
      <SyllabusPage title="Syllabus" description="Course syllabi for the institute.">
        {access.data ? <RoleNote access={access.data} /> : null}
        <SyllabusEmpty title="This screen is for faculty and coordinators" detail="Open My lessons, My class, or Progress for your own batch." />
      </SyllabusPage>
    );
  }

  const existing = syllabi.data?.find((item) => item.courseName.toLowerCase() === courseName.trim().toLowerCase());
  const openStatus: SyllabusStatus | null = detail.data?.draft?.status ?? null;
  const stepperStatus: SyllabusStatus = localName ? "draft" : (openStatus ?? (detail.data && detail.data.currentVersion > 0 ? "published" : "draft"));
  const locked = Boolean(detail.data?.draft && detail.data.draft.status !== "draft" && !canReview);
  const workflowBusy = save.isPending || publish.isPending || submit.isPending || approve.isPending || withdraw.isPending || saveLocal.isPending || importPdf.isPending || removeDraft.isPending;
  const showFeedback = canCoordinate || canEdit || Boolean(access.data?.canTeach);

  const beginSetup = () => {
    setFormError("");
    const name = courseName.trim();
    if (!name) {
      setFormError("Type a course name first.");
      return;
    }
    if (existing && existing.courseName.toLowerCase() === name.toLowerCase()) {
      setLocalName("");
      setSetupStep("closed");
      setSelectedId(existing.id);
      return;
    }
    setSelectedId("");
    setLocalName("");
    setModules([]);
    setImportWarnings([]);
    setUnimported([]);
    setSetupStep("choose");
  };

  const showLocal = (next: SyllabusModule[], warnings: SyllabusPdfWarning[] = [], skipped: SyllabusPdfWarning[] = []) => {
    previewingPdf.current = true;
    setSelectedId("");
    setModules(next);
    setImportWarnings(warnings);
    setUnimported(skipped);
    setLocalName(courseName.trim());
    setSetupStep("preview");
    requestAnimationFrame(() => {
      document.getElementById("syllabus-preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const copyCourse = async (course: { id: string; courseName: string }) => {
    setFormError("");
    try {
      const source = await syllabusApi.get(course.id);
      const copied = cloneModules((source.draft ?? source.published)?.modules ?? []);
      if (copied.length === 0) {
        setFormError("That course has no topics to copy.");
        return;
      }
      showLocal(copied);
      toast({ title: "Course copied", description: "This is a new draft. Save it when the topics look right." });
    } catch (error) {
      setFormError(errorMessage(error));
    }
  };

  const workflowActions = (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row flex-wrap gap-2">
        {localName ? (
          <Button type="button" onClick={() => { setFormError(""); saveLocal.mutate(); }} disabled={workflowBusy}>
            {saveLocal.isPending ? "Saving..." : "Save draft"}
          </Button>
        ) : null}
        {canEdit && selectedId && !locked ? (
          <Button type="button" onClick={() => { setFormError(""); save.mutate(); }} disabled={workflowBusy}>
            {save.isPending ? "Saving..." : detail.data?.draft ? "Save draft" : "Save as new draft"}
          </Button>
        ) : null}
        {canEdit && detail.data?.draft?.status === "draft" ? (
          <Button type="button" variant="secondary" onClick={() => { setFormError(""); submit.mutate(); }} disabled={workflowBusy}>
            {submit.isPending ? "Submitting..." : "Submit for review"}
          </Button>
        ) : null}
        {canReview && detail.data?.draft?.status === "submitted" ? (
          <Button type="button" onClick={() => { setFormError(""); approve.mutate(); }} disabled={workflowBusy}>
            {approve.isPending ? "Approving..." : "Approve"}
          </Button>
        ) : null}
        {canReview && detail.data?.draft?.status === "approved" ? (
          <Button type="button" onClick={() => { setFormError(""); publish.mutate(); }} disabled={workflowBusy}>
            {publish.isPending ? "Publishing..." : "Publish"}
          </Button>
        ) : null}
      </div>
      {detail.data?.draft && (detail.data.draft.status === "submitted" || detail.data.draft.status === "approved") && (canEdit || canReview) && !(detail.data.draft.status === "approved" && !canReview) ? (
        <div className="space-y-2">
          <Label htmlFor="review-note">Note for the draft</Label>
          <Textarea id="review-note" value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} maxLength={500} placeholder="Optional note" />
          <Button type="button" variant="outline" onClick={() => { setFormError(""); withdraw.mutate(); }} disabled={workflowBusy}>
            {withdraw.isPending ? "Returning..." : canReview ? "Return to draft" : "Withdraw submission"}
          </Button>
        </div>
      ) : null}
      {localName ? (
        <p className="text-sm text-slate-500">This preview is not saved yet. Saving creates a draft. Submit it after you have checked the topics.</p>
      ) : (
        <p className="text-sm text-slate-500">
          {canReview
            ? "A course is submitted, then approved, then published. Publishing freezes that version for batches."
            : "Submit the draft when it is ready. A director or academic head approves and publishes it."}
        </p>
      )}
    </div>
  );

  return (
    <SyllabusPage title="Syllabus" description="Set up a course, review it, and publish it before it is assigned to a batch.">
      {access.data ? <RoleNote access={access.data} /> : null}
      {syllabi.isLoading || (canCoordinate && meta.isLoading) ? <Loading text="Loading courses..." /> : null}
      {syllabi.isError ? <SyllabusError message={errorMessage(syllabi.error)} onRetry={() => syllabi.refetch()} /> : null}
      {canCoordinate && meta.isError ? <SyllabusError message={errorMessage(meta.error)} onRetry={() => meta.refetch()} /> : null}
      {formError ? <p className="text-sm text-red-700">{formError}</p> : null}

      {canEdit ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> New course
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="syllabus-course">Course name</Label>
              <Input
                id="syllabus-course"
                value={courseName}
                onChange={(event) => setCourseName(event.target.value)}
                placeholder="Type the course name"
                maxLength={80}
              />
            </div>
            {existing && courseName.trim() ? (
              <Button type="button" onClick={() => { setLocalName(""); setSetupStep("closed"); setSelectedId(existing.id); }}>
                Open {existing.courseName}
              </Button>
            ) : (
              <Button type="button" onClick={beginSetup} disabled={!courseName.trim()}>
                Set up this course
              </Button>
            )}
            {setupStep === "choose" ? (
              <div className="space-y-4 border-t border-slate-100 pt-4">
                <p className="text-sm text-slate-600">Choose how to start {courseName.trim()}. You can correct the topics before anything is saved.</p>
                <div className="flex flex-wrap gap-2">
                  <PdfUploadButton
                    busy={importPdf.isPending}
                    beforeOpen={() => { setFormError(""); return true; }}
                    onFiles={(files) => importPdf.mutate(files)}
                    label="Upload syllabus"
                  />
                  <Button type="button" variant="outline" onClick={() => showLocal([blankModule(1)])}>
                    <Plus className="w-4 h-4" /> Type topics
                  </Button>
                </div>
                <PasteTopics
                  disabled={importPdf.isPending}
                  onApply={(parsed) => {
                    if (parsed.modules.length === 0) {
                      setImportWarnings(parsed.warnings);
                      setUnimported(parsed.unimported);
                      setFormError(parsed.unimported[0]?.message || "No topics were found in that list.");
                      return;
                    }
                    showLocal(parsed.modules, parsed.warnings, parsed.unimported);
                  }}
                />
                <PdfUploadButton
                  busy={importPdf.isPending}
                  variant="outline"
                  label="Import spreadsheet"
                  beforeOpen={() => { setFormError(""); return true; }}
                  onFiles={(files) => importPdf.mutate(files)}
                />
                <p className="text-xs text-slate-500">Spreadsheet columns: Module, Topic, Week, Duration. Description is optional. A header row is enough for the columns to be recognised.</p>
                <CopySource
                  courses={(syllabi.data ?? []).filter((item) => item.courseName.toLowerCase() !== courseName.trim().toLowerCase())}
                  disabled={importPdf.isPending}
                  onCopyCourse={(course) => { void copyCourse(course); }}
                  onCopyTemplate={(templateId) => {
                    const template = instituteTemplates().find((item) => item.id === templateId);
                    if (!template) return;
                    showLocal(cloneModules(template.modules));
                    toast({ title: "Template copied", description: "Edit the topics, then save the draft." });
                  }}
                />
              </div>
            ) : null}
            {syllabi.data && syllabi.data.length === 0 ? (
              <p className="text-sm text-slate-600">No courses yet. Type a name, then upload a syllabus or enter the topics.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {syllabi.data && syllabi.data.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {syllabi.data.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => { setLocalName(""); setSetupStep("closed"); setSelectedId(item.id); }}
              className="text-left"
            >
              <Card className={selectedId === item.id ? "border-slate-900" : ""}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900">{item.courseName}</p>
                    <StatusBadge status={item.openStatus ?? (item.currentVersion > 0 ? "published" : item.status)} />
                  </div>
                  <p className="text-sm text-slate-600">{courseSummary(item)}</p>
                  {item.batchesOnOlderVersion.length > 0 ? (
                    <p className="text-sm text-amber-700">
                      {item.batchesOnOlderVersion.length} batch{item.batchesOnOlderVersion.length === 1 ? "" : "es"} still on an older version
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      ) : null}

      {detail.data && canCoordinate && !localName ? <CourseProgress course={detail.data.courseName} onClose={closeCourse} /> : null}
      {detail.isLoading && selectedId ? <Loading text="Loading syllabus..." /> : null}
      {detail.isError ? <SyllabusError message={errorMessage(detail.error)} onRetry={() => detail.refetch()} /> : null}

      {localName || detail.data ? (
        <Card id="syllabus-preview">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
            <div className="space-y-2">
              <CardTitle className="text-base">{localName || detail.data?.courseName}</CardTitle>
              <StatusStepper status={stepperStatus} />
            </div>
            <div className="flex flex-wrap gap-2">
              {canReview && detail.data && !localName ? detail.data.versions.map((version) => (
                <Button key={version.version} type="button" variant="destructive" size="sm" onClick={() => setVersionToDelete(version.version)}>
                  Delete version {version.version}
                </Button>
              )) : null}
              {canEdit && detail.data && !localName && detail.data.currentVersion === 0 && detail.data.draft?.status !== "approved" ? (
                <Button type="button" variant="destructive" size="sm" onClick={() => removeDraft.mutate()} disabled={workflowBusy}>
                  Delete draft
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={closeCourse}>Close</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              {detail.data && !localName && detail.data.currentVersion > 0
                ? `Published version ${detail.data.currentVersion}${detail.data.published?.effectiveDate ? ` from ${showDate(detail.data.published.effectiveDate)}` : ""}.`
                : "Nothing is published yet."}
              {detail.data?.draft && !localName ? ` ${SYLLABUS_STATUS_LABEL[detail.data.draft.status]} version ${detail.data.draft.version} is the working copy.` : ""}
            </p>
            {detail.data?.draft?.reviewNote ? <p className="text-sm text-slate-700">Review note: {detail.data.draft.reviewNote}</p> : null}
            {locked ? <p className="text-sm text-amber-800">This course is with the reviewers. Withdraw the submission to edit it.</p> : null}
            {detail.data && !localName && detail.data.batchesOnOlderVersion.length > 0 ? (
              <div className="text-sm text-amber-800 space-y-1">
                <p>These batches still use an older version:</p>
                <ul className="list-disc pl-5">
                  {detail.data.batchesOnOlderVersion.map((batch) => (
                    <li key={batch.batchId}>{batch.batchName} · version {batch.syllabusVersion}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {canEdit && !locked ? (
              <Editor
                modules={modules}
                setModules={setModules}
                warnings={importWarnings}
                unimported={unimported}
                feedback={feedback.data ?? {}}
                showFeedback={showFeedback}
                importing={importPdf.isPending}
                onImport={(files) => { setFormError(""); importPdf.mutate(files); }}
                footer={workflowActions}
              />
            ) : (
              <Outline
                modules={localName ? modules : ((detail.data?.draft ?? detail.data?.published)?.modules ?? [])}
                feedback={feedback.data ?? {}}
                showFeedback={showFeedback}
              />
            )}
            {locked ? workflowActions : null}
            {!canEdit ? (
              <p className="text-sm text-slate-600">You can view this course. Drafting is available to faculty. A director can also allow a centre head to draft.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {canCoordinate && detail.data && detail.data.currentVersion > 0 && !localName ? (
        <AssignBatch courseName={detail.data.courseName} syllabusId={detail.data.id} version={detail.data.currentVersion} />
      ) : null}
      {detail.data && detail.data.currentVersion > 0 && !localName && !canCoordinate ? (
        <SyllabusEmpty
          title="Assign this course"
          detail="A director, academic head, or centre head assigns the published course to a batch and chooses the faculty."
        />
      ) : null}

      {access.data?.canGrantEdit ? <AccountLinks /> : null}
      <DeleteConfirmationDialog
        open={versionToDelete !== null}
        onOpenChange={(open) => { if (!open) setVersionToDelete(null); }}
        onConfirm={() => { if (versionToDelete !== null) removeVersion.mutate(versionToDelete); }}
        title={`Delete version ${versionToDelete ?? ""}`}
        description="Topics in this version are removed. If a batch is using it and no other published version remains, that batch plan is cleared. If this is the only version, the course is removed."
        confirmText="Delete version"
        isLoading={removeVersion.isPending}
        loadingText="Deleting..."
      />
    </SyllabusPage>
  );
}

function CourseProgress({ course, onClose }: { course: string; onClose: () => void }) {
  const report = useQuery({
    queryKey: ["syllabus-dashboard", { course }],
    queryFn: () => syllabusApi.dashboard({ course }),
  });
  const topics = report.data?.byTopic ?? [];
  const covered = topics.filter((topic) => topic.statusLabel === "Covered").length;
  const partly = topics.filter((topic) => topic.statusLabel === "Partly covered").length;
  const incomplete = topics.filter((topic) => topic.statusLabel === "Incomplete").length;
  const notStarted = topics.filter((topic) => topic.statusLabel === "Not started").length;
  const percent = topics.length === 0 ? 0 : Math.round((covered / topics.length) * 100);
  const slices = [
    { name: "Covered", value: covered, color: "#059669" },
    { name: "Partly covered", value: partly, color: "#d97706" },
    { name: "Incomplete", value: incomplete, color: "#0284c7" },
    { name: "Not started", value: notStarted, color: "#94a3b8" },
  ].filter((slice) => slice.value > 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-2">
        <CardTitle className="text-base">How {course || "this course"} is going</CardTitle>
        <Button type="button" variant="outline" onClick={onClose}>Close</Button>
      </CardHeader>
      <CardContent>
        {report.isLoading ? <Loading text="Loading class progress..." /> : null}
        {report.isError ? <p className="text-sm text-red-700">{errorMessage(report.error)}</p> : null}
        {!report.isLoading && topics.length === 0 ? (
          <p className="text-sm text-slate-600">Pin this course to a batch to track which topics are covered.</p>
        ) : null}
        {topics.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-[220px_1fr] md:items-center">
            <div className="relative mx-auto h-52 w-full max-w-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={slices} dataKey="value" nameKey="name" innerRadius={62} outerRadius={84} stroke="none" paddingAngle={slices.length > 1 ? 2 : 0}>
                    {slices.map((slice) => (
                      <Cell key={slice.name} fill={slice.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-3xl font-semibold text-slate-900">{percent}%</p>
                <p className="text-xs text-slate-500">covered</p>
              </div>
            </div>
            <div className="space-y-2 text-sm text-slate-700">
              <p><span className="font-medium text-slate-900">{covered} of {topics.length} topics</span> are covered across batches on this course.</p>
              <p>{partly} partly covered · {incomplete} incomplete · {notStarted} not started</p>
              <ul className="space-y-1">
                {topics.slice(0, 4).map((topic: DashboardTopicRow) => (
                  <li key={`${topic.batchId}-${topic.topicTitle}`}>{topic.topicTitle} · {topic.batchName} · {topic.statusLabel}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

const FEEDBACK_LABEL: Record<Understanding, string> = {
  understood: "Understood",
  partly_understood: "Partly understood",
  need_help: "Need help",
};

function TopicFeedback({ notes }: { notes: StudentFeedbackNote[] }) {
  return (
    <div className="mt-1 rounded-md bg-slate-50 px-2 py-1.5">
      <p className="text-xs font-medium text-slate-500">Student feedback</p>
      {notes.length === 0 ? <p className="text-xs text-slate-500">No feedback yet.</p> : null}
      <ul className="space-y-1">
        {notes.map((note) => (
          <li key={`${note.studentName}-${note.understanding}-${note.comment}`} className="text-xs text-slate-700">
            <span className="font-medium text-slate-900">{note.studentName}</span>
            {`: ${FEEDBACK_LABEL[note.understanding]}`}
            {note.comment ? ` — ${note.comment}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Outline({ modules, feedback, showFeedback }: { modules: SyllabusModule[]; feedback: Record<string, StudentFeedbackNote[]>; showFeedback: boolean }) {
  if (modules.length === 0) return <SyllabusEmpty title="No topics yet" detail="Add a module and at least one topic before submitting." />;
  return (
    <div className="space-y-3">
      {modules.map((module) => (
        <div key={module.id} className="rounded-lg border border-slate-200 p-3">
          <p className="font-medium text-slate-900">{module.displayOrder}. {module.title}</p>
          <p className="text-sm text-slate-600">{module.weekLabel?.trim() || "Week not set"}</p>
          <ul className="mt-2 space-y-2 text-sm text-slate-700">
            {module.topics.map((topic) => (
              <li key={topic.id}>
                <p>{topic.displayOrder}. {topic.title}{topic.estimatedMinutes ? ` · ${topic.estimatedMinutes} min` : ""}</p>
                {showFeedback ? <TopicFeedback notes={feedback[topic.id] ?? []} /> : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Editor({
  modules,
  setModules,
  warnings,
  unimported,
  feedback,
  showFeedback,
  importing,
  onImport,
  footer,
}: {
  modules: SyllabusModule[];
  setModules: Dispatch<SetStateAction<SyllabusModule[]>>;
  warnings: SyllabusPdfWarning[];
  unimported: SyllabusPdfWarning[];
  feedback: Record<string, StudentFeedbackNote[]>;
  showFeedback: boolean;
  importing: boolean;
  onImport: (files: File[]) => void;
  footer: ReactNode;
}) {
  const updateModule = (moduleId: string, patch: Partial<SyllabusModule>) => {
    setModules((current) => current.map((module) => (module.id === moduleId ? { ...module, ...patch } : module)));
  };
  const insertModule = (index: number) => {
    setModules((current) => {
      const next = [...current];
      next.splice(index, 0, blankModule(index + 1));
      return next.map((module, order) => ({ ...module, displayOrder: order + 1 }));
    });
  };
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <PdfUploadButton busy={importing} onFiles={onImport} />
        <p className="text-sm text-slate-500">
          {importing
            ? "Reading the file..."
            : "Correct the modules and topics, then save the draft. An upload replaces this preview and is not saved until you save."}
        </p>
      </div>
      <ImportIssues warnings={warnings} unimported={unimported} />
      {modules.map((module, index) => (
        <div key={module.id} className="space-y-3">
          {index > 0 ? (
            <div className="flex justify-center">
              <Button type="button" variant="outline" size="sm" onClick={() => insertModule(index)}>
                <Plus className="w-4 h-4 mr-1" /> Add module here
              </Button>
            </div>
          ) : null}
          <div className="rounded-lg border border-slate-200 p-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_160px_120px_auto]">
            <div>
              <Label>Module title</Label>
              <Input value={module.title} onChange={(event) => updateModule(module.id, { title: event.target.value })} />
            </div>
            <div>
              <Label>Week</Label>
              <Input
                value={module.weekLabel ?? ""}
                placeholder="Weeks 1–3"
                onChange={(event) => updateModule(module.id, { weekLabel: event.target.value })}
              />
            </div>
            <div>
              <Label>Order</Label>
              <Input
                type="number"
                value={module.displayOrder}
                onChange={(event) => updateModule(module.id, { displayOrder: Number(event.target.value) })}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              className="self-end"
              onClick={() => setModules((current) => current.filter((item) => item.id !== module.id))}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          {module.topics.map((topic) => {
            const topicWarning = [...warnings, ...unimported].find((warning) => warning.row && (warning.row === topic.title || topic.title.startsWith(warning.row)));
            return (
            <div key={topic.id} className="grid gap-2 sm:grid-cols-2 border-t border-slate-100 pt-3">
              <div>
                <Label>Topic title</Label>
                {topicWarning ? <p className="text-xs text-amber-800">{topicWarning.message}</p> : null}
                <Input
                  value={topic.title}
                  onChange={(event) =>
                    updateModule(module.id, {
                      topics: module.topics.map((item) => (item.id === topic.id ? { ...item, title: event.target.value } : item)),
                    })
                  }
                />
              </div>
              <div>
                <Label>Order</Label>
                <Input
                  type="number"
                  value={topic.displayOrder}
                  onChange={(event) =>
                    updateModule(module.id, {
                      topics: module.topics.map((item) =>
                        item.id === topic.id ? { ...item, displayOrder: Number(event.target.value) } : item
                      ),
                    })
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={topic.description}
                  onChange={(event) =>
                    updateModule(module.id, {
                      topics: module.topics.map((item) =>
                        item.id === topic.id ? { ...item, description: event.target.value } : item
                      ),
                    })
                  }
                />
              </div>
              {showFeedback ? (
                <div className="sm:col-span-2">
                  <TopicFeedback notes={feedback[topic.id] ?? []} />
                </div>
              ) : null}
              <div>
                <Label>Estimated minutes</Label>
                <Input
                  type="number"
                  value={topic.estimatedMinutes ?? ""}
                  onChange={(event) =>
                    updateModule(module.id, {
                      topics: module.topics.map((item) =>
                        item.id === topic.id
                          ? { ...item, estimatedMinutes: event.target.value === "" ? null : Number(event.target.value) }
                          : item
                      ),
                    })
                  }
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                className="self-end justify-self-start"
                onClick={() =>
                  updateModule(module.id, { topics: module.topics.filter((item) => item.id !== topic.id) })
                }
              >
                Remove topic
              </Button>
            </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            onClick={() => updateModule(module.id, { topics: [...module.topics, emptyTopic(module.topics.length + 1)] })}
          >
            <Plus className="w-4 h-4 mr-1" /> Add topic
          </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          setModules((current) => [
            ...current,
            { id: newId(), title: "", weekLabel: "", displayOrder: current.length + 1, topics: [emptyTopic(1)] },
          ])
        }
      >
        <Plus className="w-4 h-4 mr-1" /> Add module
      </Button>
      {footer}
    </div>
  );
}

function AccountLinks() {
  const access = useSyllabusAccess();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const directory = useQuery({
    queryKey: ["syllabus-directory"],
    queryFn: () => syllabusApi.directory(),
    enabled: Boolean(access.data?.canGrantEdit),
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const run = async (action: () => Promise<unknown>, success: string) => {
    setError("");
    setMessage("");
    try {
      const result = await action();
      const note = typeof result === "string" && result ? result : success;
      setMessage(note);
      toast({ title: note });
      await queryClient.invalidateQueries({ queryKey: ["syllabus-directory"] });
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  if (!access.data?.canGrantEdit) return null;
  if (directory.isLoading) return <Loading text="Loading accounts..." />;
  if (directory.isError) return <SyllabusError message={errorMessage(directory.error)} onRetry={() => directory.refetch()} />;
  if (!directory.data) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Centre head editing</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-slate-600">Centre heads can assign a published course without this. Turn it on so that centre head can draft and submit. Approval and publishing stay with a director or academic head.</p>
        {directory.data.centreHeads.length === 0 ? <SyllabusEmpty title="No centre heads" detail="Approve a centre head in Access Management first." /> : null}
        {directory.data.centreHeads.map((user) => (
          <div key={user.uid} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-slate-200 rounded-lg p-3">
            <div>
              <p className="text-sm font-medium text-slate-900">{user.name}</p>
              <p className="text-sm text-slate-600">{user.email}</p>
            </div>
            <Button
              type="button"
              variant={user.canEditSyllabus ? "default" : "outline"}
              onClick={() => run(() => syllabusApi.setCentreHeadEdit(user.uid, !user.canEditSyllabus), user.canEditSyllabus ? "Editing removed" : "Editing granted")}
            >
              {user.canEditSyllabus ? "Can edit" : "Allow editing"}
            </Button>
          </div>
        ))}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
