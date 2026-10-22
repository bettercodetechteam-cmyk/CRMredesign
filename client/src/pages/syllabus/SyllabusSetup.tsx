import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
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
import type { DashboardTopicRow, StudentFeedbackNote, SyllabusModule, SyllabusPdfWarning, Understanding } from "@shared/syllabusTypes";
import { ProgressReadout, SyllabusEmpty, SyllabusError, SyllabusPage, showDate, useSyllabusAccess } from "./SyllabusChrome";

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
  onFile,
  beforeOpen,
  variant = "outline",
  className,
  buttonClassName,
}: {
  busy: boolean;
  onFile: (file: File) => void;
  beforeOpen?: () => boolean;
  variant?: "default" | "outline";
  className?: string;
  buttonClassName?: string;
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
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          const name = file.name.toLowerCase();
          const allowed = [".pdf", ".doc", ".docx", ".xls", ".xlsx"].some((extension) => name.endsWith(extension));
          if (!allowed) {
            setFileError("Choose a PDF, Word, or Excel file.");
            return;
          }
          if (file.size > 8 * 1024 * 1024) {
            setFileError("Choose a file of 8 MB or less.");
            return;
          }
          setFileError("");
          onFile(file);
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
        {busy ? "Reading file..." : "Upload File"}
      </Button>
      {fileError ? <p className="text-sm text-red-700">{fileError}</p> : null}
    </div>
  );
}

export default function SyllabusSetup() {
  const access = useSyllabusAccess();
  const canEdit = Boolean(access.data?.canEditSyllabus);
  const canCoordinate = Boolean(access.data?.canCoordinate);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [courseName, setCourseName] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [modules, setModules] = useState<SyllabusModule[]>([]);
  const [importWarnings, setImportWarnings] = useState<SyllabusPdfWarning[]>([]);
  const [formError, setFormError] = useState("");
  const [versionToDelete, setVersionToDelete] = useState<number | null>(null);
  const [manualBusy, setManualBusy] = useState(false);
  const previewingPdf = useRef(false);
  const startManual = useRef(false);
  const keepBlank = useRef(false);
  const closeCourse = () => {
    setSelectedId("");
    setImportWarnings([]);
    setFormError("");
  };

  const syllabi = useQuery({
    queryKey: ["syllabi"],
    queryFn: () => syllabusApi.list(),
    enabled: canCoordinate || canEdit,
  });
  const meta = useQuery({
    queryKey: ["syllabus-meta"],
    queryFn: () => syllabusApi.meta(),
    enabled: canCoordinate || canEdit,
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
    previewingPdf.current = false;
    if (!startManual.current) keepBlank.current = false;
  }, [selectedId]);

  useEffect(() => {
    if (!detail.data || previewingPdf.current) return;
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
    setImportWarnings([]);
    setFormError("");
    if (manual) {
      requestAnimationFrame(() => {
        document.getElementById("syllabus-preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [detail.data]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["syllabi"] });
    if (selectedId) await queryClient.invalidateQueries({ queryKey: ["syllabus", selectedId] });
  };

  const create = useMutation({
    mutationFn: () => syllabusApi.create(courseName.trim()),
    onSuccess: async (created) => {
      setSelectedId(created.id);
      toast({ title: "Draft created", description: `${created.courseName} is ready to edit.` });
      await refresh();
    },
    onError: (error) => setFormError(errorMessage(error)),
  });

  const save = useMutation({
    mutationFn: () => syllabusApi.save(selectedId, modules),
    onSuccess: async () => {
      previewingPdf.current = false;
      toast({ title: "Draft saved" });
      await refresh();
    },
    onError: (error) => setFormError(errorMessage(error)),
  });

  const importPdf = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => syllabusApi.importPdf(id, file),
    onSuccess: (preview) => {
      previewingPdf.current = true;
      setModules(preview.modules);
      setImportWarnings(preview.warnings);
      setFormError("");
      toast({
        title: "File read",
        description: "Review the topics, then save the draft. Nothing is published yet.",
      });
      requestAnimationFrame(() => {
        document.getElementById("syllabus-preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
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
      await syllabusApi.save(selectedId, modules);
      return syllabusApi.publish(selectedId);
    },
    onSuccess: async (published) => {
      previewingPdf.current = false;
      toast({ title: "Version published", description: `Version ${published.currentVersion} is now published.` });
      await refresh();
    },
    onError: (error) => setFormError(errorMessage(error)),
  });

  if (access.data && !canCoordinate && !canEdit) {
    return (
      <SyllabusPage title="Syllabus" description="Course syllabi for the institute.">
        <SyllabusEmpty title="This screen is for coordinators" detail="Open My lessons or My class from the menu for your own batch." />
      </SyllabusPage>
    );
  }

  const existing = syllabi.data?.find((item) => item.courseName.toLowerCase() === courseName.trim().toLowerCase());

  const openManual = async () => {
    setFormError("");
    const name = courseName.trim();
    if (!name && !existing) {
      setFormError("Type a course name, then add it manually.");
      return;
    }
    if (existing) {
      startManual.current = true;
      if (selectedId === existing.id && detail.data) {
        if ((detail.data.draft ?? detail.data.published)?.modules.length === 0) {
          keepBlank.current = true;
          setModules([blankModule(1)]);
        }
        startManual.current = false;
        requestAnimationFrame(() => {
          document.getElementById("syllabus-preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      } else {
        setSelectedId(existing.id);
      }
      return;
    }
    setManualBusy(true);
    try {
      startManual.current = true;
      const created = await syllabusApi.create(name);
      setSelectedId(created.id);
      toast({ title: "Draft created", description: `${created.courseName} is ready to type in.` });
      await refresh();
    } catch (error) {
      startManual.current = false;
      setFormError(errorMessage(error));
    } finally {
      setManualBusy(false);
    }
  };

  return (
    <SyllabusPage title="Syllabus" description="Create a course here, then add its topics by hand or from a PDF, Word, or Excel file.">
      {syllabi.isLoading || meta.isLoading ? <Loading text="Loading courses..." /> : null}
      {syllabi.isError ? <SyllabusError message={errorMessage(syllabi.error)} onRetry={() => syllabi.refetch()} /> : null}
      {meta.isError ? <SyllabusError message={errorMessage(meta.error)} onRetry={() => meta.refetch()} /> : null}

      {canEdit ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Course
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="syllabus-course" className="sr-only">Course name</Label>
              <Input
                id="syllabus-course"
                value={courseName}
                onChange={(event) => setCourseName(event.target.value)}
                placeholder="Type the course name"
                maxLength={80}
              />
              <div className="flex flex-wrap items-center gap-2">
                {existing ? (
                  <Button type="button" className="shrink-0" onClick={() => setSelectedId(existing.id)}>
                    Open {existing.courseName}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="shrink-0"
                    onClick={() => { setFormError(""); create.mutate(); }}
                    disabled={!courseName.trim() || create.isPending || manualBusy}
                  >
                    {create.isPending ? "Creating..." : "Create course"}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => { void openManual(); }}
                  disabled={manualBusy || create.isPending || importPdf.isPending}
                >
                  <Plus className="w-4 h-4" />
                  {manualBusy ? "Opening..." : "Add manually"}
                </Button>
                <PdfUploadButton
                  className="shrink-0"
                  busy={importPdf.isPending || create.isPending}
                beforeOpen={() => {
                  if (!courseName.trim() && !existing && !selectedId) {
                    setFormError("Type a course name, then upload the file.");
                    return false;
                  }
                  setFormError("");
                  return true;
                }}
                onFile={async (file) => {
                  try {
                    let id = existing?.id || "";
                    const name = courseName.trim();
                    if (!id && name) {
                      const created = await syllabusApi.create(name);
                      id = created.id;
                      setSelectedId(id);
                      await refresh();
                    }
                    if (!id) id = selectedId;
                    if (!id) {
                      setFormError("Type a course name, then upload the file.");
                      return;
                    }
                    setSelectedId(id);
                    importPdf.mutate({ id, file });
                  } catch (error) {
                    setFormError(errorMessage(error));
                  }
                }}
              />
              </div>
            </div>
            {formError ? <p className="text-sm text-red-700">{formError}</p> : null}
            {syllabi.data && syllabi.data.length === 0 ? (
              <p className="text-sm text-slate-600">No courses yet. Type a name, then use Add manually or upload a file.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {syllabi.data && syllabi.data.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {syllabi.data.map((item) => (
            <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className="text-left">
              <Card className={selectedId === item.id ? "border-slate-900" : ""}>
                <CardContent className="p-4 space-y-1">
                  <p className="font-medium text-slate-900">{item.courseName}</p>
                  <p className="text-sm text-slate-600">
                    {item.currentVersion > 0 ? `Published version ${item.currentVersion}` : "Not published yet"}
                    {item.draftVersion ? ` · Draft version ${item.draftVersion}` : ""}
                  </p>
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

      {detail.data && canCoordinate ? <CourseProgress course={detail.data.courseName} onClose={closeCourse} /> : null}
      {detail.isLoading ? <Loading text="Loading syllabus..." /> : null}
      {detail.isError ? <SyllabusError message={errorMessage(detail.error)} onRetry={() => detail.refetch()} /> : null}
      {detail.data ? (
        <Card id="syllabus-preview">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-base">{detail.data.courseName}</CardTitle>
            <div className="flex flex-wrap gap-2">
              {canEdit ? detail.data.versions.map((version) => (
                <Button key={version.version} type="button" variant="destructive" size="sm" onClick={() => setVersionToDelete(version.version)}>
                  Delete version {version.version}
                </Button>
              )) : null}
              <Button type="button" variant="outline" onClick={closeCourse}>Close</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-600">
              {detail.data.currentVersion > 0
                ? `Published version ${detail.data.currentVersion}${detail.data.published?.effectiveDate ? ` from ${showDate(detail.data.published.effectiveDate)}` : ""}.`
                : "Nothing is published yet."}
              {detail.data.draftVersion ? ` Draft version ${detail.data.draftVersion} is open for editing.` : ""}
            </p>
            {detail.data.batchesOnOlderVersion.length > 0 ? (
              <div className="text-sm text-amber-800 space-y-1">
                <p>These batches still use an older version:</p>
                <ul className="list-disc pl-5">
                  {detail.data.batchesOnOlderVersion.map((batch) => (
                    <li key={batch.batchId}>{batch.batchName} · version {batch.syllabusVersion}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {canEdit ? (
              <Editor
                modules={modules}
                setModules={setModules}
                warnings={importWarnings}
                feedback={feedback.data ?? {}}
                showFeedback={canCoordinate || canEdit || Boolean(access.data?.canTeach)}
                busy={save.isPending || publish.isPending || importPdf.isPending}
                importing={importPdf.isPending}
                onImport={(file) => { setFormError(""); importPdf.mutate({ id: selectedId, file }); }}
                onSave={() => { setFormError(""); save.mutate(); }}
                onPublish={() => { setFormError(""); publish.mutate(); }}
                onClose={closeCourse}
              />
            ) : (
              <Outline
                modules={(detail.data.published ?? detail.data.draft)?.modules ?? []}
                feedback={feedback.data ?? {}}
                showFeedback={canCoordinate || canEdit || Boolean(access.data?.canTeach)}
              />
            )}
            {!canEdit ? (
              <p className="text-sm text-slate-600">Centre heads schedule batches. A director can allow a centre head to edit syllabi from the access tab.</p>
            ) : null}
          </CardContent>
        </Card>
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
  if (modules.length === 0) return <SyllabusEmpty title="No topics yet" detail="An academic head can add modules and topics." />;
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
  feedback,
  showFeedback,
  busy,
  importing,
  onImport,
  onSave,
  onPublish,
  onClose,
}: {
  modules: SyllabusModule[];
  setModules: Dispatch<SetStateAction<SyllabusModule[]>>;
  warnings: SyllabusPdfWarning[];
  feedback: Record<string, StudentFeedbackNote[]>;
  showFeedback: boolean;
  busy: boolean;
  importing: boolean;
  onImport: (file: File) => void;
  onSave: () => void;
  onPublish: () => void;
  onClose: () => void;
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
        <PdfUploadButton busy={importing} onFile={onImport} />
        <p className="text-sm text-slate-500">
          {importing
            ? "Reading the file..."
            : "Type a module and its topics below, or upload a PDF, Word, or Excel file. Save the draft, then publish when it is ready."}
        </p>
      </div>
      {warnings.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 space-y-1">
          <p className="font-medium">Some rows need a look before you save.</p>
          <ul className="list-disc pl-5">
            {warnings.map((warning, index) => (
              <li key={`${warning.page}-${warning.row}-${index}`}>
                {warning.page > 0 ? `Page ${warning.page}: ` : ""}
                {warning.row ? `${warning.row} — ` : ""}
                {warning.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
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
          {module.topics.map((topic) => (
            <div key={topic.id} className="grid gap-2 sm:grid-cols-2 border-t border-slate-100 pt-3">
              <div>
                <Label>Topic title</Label>
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
          ))}
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
      <div className="flex flex-col sm:flex-row gap-2">
        <Button type="button" onClick={onSave} disabled={busy}>{busy ? "Saving..." : "Save draft"}</Button>
        <Button type="button" variant="secondary" onClick={onPublish} disabled={busy}>Publish version</Button>
        <Button type="button" variant="outline" onClick={onClose}>Close</Button>
      </div>
      <p className="text-sm text-slate-500">Publishing freezes this version. Later edits create the next version and do not change a version already pinned to a batch.</p>
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
        <p className="text-sm text-slate-600">Centre heads can assign and schedule without this. Turn it on to let that centre head edit syllabus content.</p>
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
