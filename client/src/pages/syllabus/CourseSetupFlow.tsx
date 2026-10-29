import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { syllabusApi, errorMessage } from "@/lib/syllabusApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  instituteTemplates,
  parseTopicPaste,
  syllabusStatuses,
  SYLLABUS_STATUS_LABEL,
} from "@shared/courseSetup";
import type { SyllabusAccess, SyllabusPdfWarning, SyllabusRecord, SyllabusStatus } from "@shared/syllabusTypes";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<SyllabusStatus, string> = {
  draft: "bg-slate-100 text-slate-800 border-slate-200",
  submitted: "bg-amber-50 text-amber-900 border-amber-200",
  approved: "bg-sky-50 text-sky-900 border-sky-200",
  published: "bg-emerald-50 text-emerald-900 border-emerald-200",
};

export function StatusBadge({ status }: { status: SyllabusStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", STATUS_STYLE[status])}>
      {SYLLABUS_STATUS_LABEL[status]}
    </span>
  );
}

export function StatusStepper({ status }: { status: SyllabusStatus }) {
  return (
    <ol className="flex flex-wrap gap-2" aria-label="Course status">
      {syllabusStatuses().map((step) => {
        const current = step === status;
        return (
          <li
            key={step}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium",
              current ? STATUS_STYLE[step] : "border-slate-200 bg-white text-slate-400"
            )}
            aria-current={current ? "step" : undefined}
          >
            {SYLLABUS_STATUS_LABEL[step]}
          </li>
        );
      })}
    </ol>
  );
}

export function courseSummary(item: Pick<SyllabusRecord, "currentVersion" | "draftVersion" | "openStatus" | "status">): string {
  const parts: string[] = [];
  if (item.currentVersion > 0) parts.push(`Published version ${item.currentVersion}`);
  if (item.openStatus && item.draftVersion) parts.push(`${SYLLABUS_STATUS_LABEL[item.openStatus]} version ${item.draftVersion}`);
  else if (item.currentVersion === 0) parts.push(SYLLABUS_STATUS_LABEL[item.openStatus ?? item.status]);
  return parts.join(" · ");
}

function roleCopy(access: SyllabusAccess): { title: string; actions: string[] } {
  if (access.canReview) {
    return {
      title: "You review the curriculum.",
      actions: [
        "Draft a course and submit it",
        "Approve a submitted course",
        "Publish an approved course",
        "Assign a published course to a batch and choose faculty",
      ],
    };
  }
  if (access.canAuthor && access.canCoordinate) {
    return {
      title: "You can draft a course and assign a published one.",
      actions: [
        "Draft a course and submit it for review",
        "Assign a published course to a batch and choose faculty",
        "A director or academic head approves and publishes",
      ],
    };
  }
  if (access.canAuthor) {
    return {
      title: "You can prepare a course.",
      actions: [
        "Draft a course and submit it for review",
        "A director or academic head approves and publishes",
        "A coordinator assigns the published course to a batch",
      ],
    };
  }
  if (access.canCoordinate) {
    return {
      title: "You assign published courses.",
      actions: [
        "Assign a published course to a batch and choose faculty",
        "A director turns on drafting for a centre head",
      ],
    };
  }
  return {
    title: "Your syllabus pages are class and progress.",
    actions: ["Open My lessons, My class, or Progress for your own batch."],
  };
}

export function RoleNote({ access }: { access: SyllabusAccess }) {
  const copy = roleCopy(access);
  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <p className="text-sm font-medium text-slate-900">{copy.title}</p>
        <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
          {copy.actions.map((action) => (
            <li key={action}>{action}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function ImportIssues({
  warnings,
  unimported,
}: {
  warnings: SyllabusPdfWarning[];
  unimported: SyllabusPdfWarning[];
}) {
  if (warnings.length === 0 && unimported.length === 0) return null;
  return (
    <div className="space-y-3">
      {unimported.length > 0 ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900 space-y-1">
          <p className="font-medium">These rows were not imported. Add them by hand if they belong in the course.</p>
          <ul className="list-disc pl-5">
            {unimported.map((row, index) => (
              <li key={`${row.row}-${row.message}-${index}`}>
                {row.page > 0 ? `Page ${row.page}: ` : ""}
                {row.row ? `${row.row} — ` : ""}
                {row.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {warnings.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 space-y-1">
          <p className="font-medium">Check these before you save.</p>
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
    </div>
  );
}

export function PasteTopics({
  disabled,
  onApply,
}: {
  disabled: boolean;
  onApply: (value: ReturnType<typeof parseTopicPaste>) => void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  return (
    <div className="space-y-2">
      <Label htmlFor="topic-paste">Paste topics</Label>
      <Textarea
        id="topic-paste"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={"Module: Colour\n- Contrast - 90 min\n- Palette\n\nOr one row per topic:\nModule | Topic | Week | Duration"}
        rows={6}
      />
      <p className="text-xs text-slate-500">A plain list becomes one module. A table needs Module and Topic. Week, duration, and description can be left blank. Order is assigned from the list.</p>
      <Button
        type="button"
        variant="outline"
        disabled={disabled || !text.trim()}
        onClick={() => {
          const parsed = parseTopicPaste(text);
          if (parsed.modules.length === 0) {
            setError(parsed.unimported[0]?.message || "No topics were found in that list.");
            onApply(parsed);
            return;
          }
          setError("");
          onApply(parsed);
        }}
      >
        Preview pasted topics
      </Button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

export function CopySource({
  courses,
  disabled,
  onCopyCourse,
  onCopyTemplate,
}: {
  courses: SyllabusRecord[];
  disabled: boolean;
  onCopyCourse: (course: SyllabusRecord) => void;
  onCopyTemplate: (templateId: string) => void;
}) {
  const [courseId, setCourseId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const templates = instituteTemplates();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-2">
        <Label>Existing course</Label>
        {courses.length === 0 ? <p className="text-sm text-slate-500">No other course to copy yet.</p> : null}
        <Select value={courseId || undefined} onValueChange={setCourseId} disabled={courses.length === 0}>
          <SelectTrigger><SelectValue placeholder="Choose a course" /></SelectTrigger>
          <SelectContent>
            {courses.map((course) => (
              <SelectItem key={course.id} value={course.id}>{course.courseName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || !courseId}
          onClick={() => {
            const course = courses.find((item) => item.id === courseId);
            if (course) onCopyCourse(course);
          }}
        >
          Use this course
        </Button>
      </div>
      <div className="space-y-2">
        <Label>Institute template</Label>
        <Select value={templateId || undefined} onValueChange={setTemplateId}>
          <SelectTrigger><SelectValue placeholder="Choose a template" /></SelectTrigger>
          <SelectContent>
            {templates.map((template) => (
              <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-slate-500">{templates.find((item) => item.id === templateId)?.summary || "Templates are a starting point. Edit them before submitting."}</p>
        <Button type="button" variant="outline" disabled={disabled || !templateId} onClick={() => onCopyTemplate(templateId)}>
          Use this template
        </Button>
      </div>
    </div>
  );
}

export function AssignBatch({
  courseName,
  syllabusId,
  version,
}: {
  courseName: string;
  syllabusId: string;
  version: number;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const batches = useQuery({ queryKey: ["syllabus-batches"], queryFn: () => syllabusApi.batches() });
  const meta = useQuery({ queryKey: ["syllabus-meta"], queryFn: () => syllabusApi.meta() });
  const [batchId, setBatchId] = useState("");
  const [facultyUid, setFacultyUid] = useState("");
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [formError, setFormError] = useState("");
  const matches = (batches.data ?? []).filter((batch) => batch.course.trim().toLowerCase() === courseName.trim().toLowerCase());
  const selected = matches.find((batch) => batch.id === batchId);
  const nameMismatch = Boolean(selected && selected.course !== courseName);

  const save = useMutation({
    mutationFn: () => {
      if (!batchId || !facultyUid || !startDate || !targetDate) {
        throw new Error("Choose a batch, a faculty login, a start date, and a target date.");
      }
      if (nameMismatch) {
        throw new Error(`The batch course is "${selected?.course}". It has to match "${courseName}" exactly.`);
      }
      return syllabusApi.savePlan(batchId, {
        syllabusId,
        syllabusVersion: version,
        facultyUid,
        startDate,
        targetCompletionDate: targetDate,
      });
    },
    onSuccess: async () => {
      setFormError("");
      toast({ title: "Batch assigned", description: "The faculty login can now record lessons for this course." });
      await queryClient.invalidateQueries({ queryKey: ["syllabus-batches"] });
      await queryClient.invalidateQueries({ queryKey: ["syllabus-batch", batchId] });
    },
    onError: (error) => setFormError(errorMessage(error)),
  });

  return (
    <Card id="assign-batch">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Assign this course to a batch</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-slate-600">
          Version {version} is published. Choose the batch and the faculty login who will teach it.
        </p>
        {batches.isLoading || meta.isLoading ? <p className="text-sm text-slate-500">Loading batches...</p> : null}
        {batches.isError ? <p className="text-sm text-red-700">{errorMessage(batches.error)}</p> : null}
        {meta.isError ? <p className="text-sm text-red-700">{errorMessage(meta.error)}</p> : null}
        {batches.data && matches.length === 0 ? (
          <p className="text-sm text-slate-600">
            No batch uses the course name "{courseName}". Add the batch on the Batches page with that exact name, then come back.
          </p>
        ) : null}
        {matches.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Batch</Label>
              <Select value={batchId || undefined} onValueChange={setBatchId}>
                <SelectTrigger><SelectValue placeholder="Choose a batch" /></SelectTrigger>
                <SelectContent>
                  {matches.map((batch) => (
                    <SelectItem key={batch.id} value={batch.id}>
                      {batch.name}{batch.plan ? ` · version ${batch.plan.syllabusVersion}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Faculty</Label>
              <Select value={facultyUid || undefined} onValueChange={setFacultyUid}>
                <SelectTrigger><SelectValue placeholder="Choose faculty" /></SelectTrigger>
                <SelectContent>
                  {(meta.data?.faculty ?? []).map((faculty) => (
                    <SelectItem key={faculty.uid} value={faculty.uid}>
                      {faculty.name}{faculty.email ? ` · ${faculty.email}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="assign-start">Start date</Label>
              <Input id="assign-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assign-target">Target completion</Label>
              <Input id="assign-target" type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
            </div>
          </div>
        ) : null}
        {nameMismatch ? (
          <p className="text-sm text-amber-800">The batch course name is "{selected?.course}". Rename it to "{courseName}" before assigning.</p>
        ) : null}
        {formError ? <p className="text-sm text-red-700">{formError}</p> : null}
        <div className="flex flex-wrap gap-2">
          {matches.length > 0 ? (
            <Button type="button" onClick={() => save.mutate()} disabled={save.isPending || nameMismatch}>
              {save.isPending ? "Assigning..." : "Assign faculty"}
            </Button>
          ) : null}
          <Button type="button" variant="outline" asChild>
            <Link to="/syllabus/batches">Open batch plans</Link>
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/batches">Batches</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
