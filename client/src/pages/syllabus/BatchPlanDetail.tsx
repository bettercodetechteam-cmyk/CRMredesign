import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { syllabusApi, errorMessage } from "@/lib/syllabusApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import Loading from "@/components/ui/loading";
import type { LessonStatus, StudentFeedbackNote, TopicScheduleView, Understanding } from "@shared/syllabusTypes";
import { cn } from "@/lib/utils";
import { CourseClassPicker, SyllabusEmpty, SyllabusError, SyllabusPage, showDate, useSyllabusAccess } from "./SyllabusChrome";

function planStudent(id: string, name: string, topics: TopicScheduleView[]) {
  const covered = topics.filter((topic) => topic.lessonStatus === "completed").length;
  const partly = topics.filter((topic) => topic.lessonStatus === "partly_covered").length;
  const incomplete = topics.filter((topic) => topic.lessonStatus === "not_covered").length;
  const notStarted = topics.filter((topic) => !topic.lessonStatus).length;
  const percent = topics.length === 0 ? 0 : Math.round((covered / topics.length) * 100);
  return {
    id,
    name: name || "Student",
    detail: topics.length > 0 ? `${percent}% covered · ${topics.length} topics` : "No topics yet",
    covered,
    partly,
    incomplete,
    notStarted,
    total: topics.length,
  };
}

export default function BatchPlanDetailPage() {
  const { batchId = "" } = useParams();
  const access = useSyllabusAccess();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ["syllabus-batch", batchId],
    queryFn: () => syllabusApi.batch(batchId),
    enabled: Boolean(batchId && access.data?.canCoordinate),
  });
  const meta = useQuery({
    queryKey: ["syllabus-meta"],
    queryFn: () => syllabusApi.meta(),
    enabled: Boolean(access.data?.canCoordinate),
  });
  const [versionKey, setVersionKey] = useState("");
  const [facultyUid, setFacultyUid] = useState("");
  const [startDate, setStartDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!detail.data) return;
    setVersionKey(detail.data.syllabusVersion ? `${detail.data.syllabusId}:${detail.data.syllabusVersion}` : "");
    setFacultyUid(detail.data.facultyUid || "");
    setStartDate(detail.data.startDate || "");
    setTargetDate(detail.data.targetCompletionDate || "");
  }, [detail.data]);

  const savePlan = useMutation({
    mutationFn: () => {
      const [syllabusId, version] = versionKey.split(":");
      if (!syllabusId || !version || !facultyUid || !startDate || !targetDate) {
        throw new Error("Choose a published version, a faculty login, a start date, and a target date.");
      }
      return syllabusApi.savePlan(batchId, {
        syllabusId,
        syllabusVersion: Number(version),
        facultyUid,
        startDate,
        targetCompletionDate: targetDate,
      });
    },
    onSuccess: async () => {
      setFormError("");
      toast({ title: "Batch plan saved", description: "Lesson history and feedback were kept." });
      await queryClient.invalidateQueries({ queryKey: ["syllabus-batch", batchId] });
      await queryClient.invalidateQueries({ queryKey: ["syllabus-batches"] });
    },
    onError: (error) => setFormError(errorMessage(error)),
  });

  return (
    <SyllabusPage title="Batch plan" description="This class is selected. Assign a published version, then schedule each topic.">
      {access.data && !access.data.canCoordinate ? (
        <SyllabusEmpty title="Coordinators plan batches" detail="You can open My lessons if you teach a batch." />
      ) : null}
      {detail.isLoading || meta.isLoading ? <Loading text="Loading batch plan..." /> : null}
      {detail.isError ? <SyllabusError message={errorMessage(detail.error)} onRetry={() => detail.refetch()} /> : null}
      {meta.isError ? <SyllabusError message={errorMessage(meta.error)} onRetry={() => meta.refetch()} /> : null}
      {!detail.isLoading && !meta.isLoading && detail.data ? (
        <div className="space-y-4">
          <CourseClassPicker
            courses={[{
              name: detail.data.batch.course || "No course",
              topicCount: detail.data.topics.length,
              students: [planStudent(detail.data.batch.id, detail.data.batch.name, detail.data.topics)],
            }]}
            courseName={detail.data.batch.course || "No course"}
            studentId={detail.data.batch.id}
            hint="You are planning this student's class."
          />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{detail.data.batch.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-600">
                Course: {detail.data.batch.course || "No course name"}. Batch staff name: {detail.data.batch.teacherName || "Unassigned"}. The faculty login below is who can record lessons.
              </p>
              {!detail.data.batch.course ? (
                <p className="text-sm text-amber-700">This batch has no course name, so a syllabus cannot be pinned.</p>
              ) : null}
              {detail.data.publishedVersions.length === 0 ? (
                <SyllabusEmpty title="No published version" detail={`Publish a syllabus for ${detail.data.batch.course || "this course"} before assigning it.`} />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Published version</Label>
                    <Select value={versionKey || undefined} onValueChange={setVersionKey}>
                      <SelectTrigger><SelectValue placeholder="Choose a version" /></SelectTrigger>
                      <SelectContent>
                        {detail.data.publishedVersions.map((version) => (
                          <SelectItem key={version.version} value={`${version.syllabusId}:${version.version}`}>
                            Version {version.version}{version.effectiveDate ? ` · ${showDate(version.effectiveDate)}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Faculty login</Label>
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
                  <div>
                    <Label>Start date</Label>
                    <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                  </div>
                  <div>
                    <Label>Target completion</Label>
                    <Input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} />
                  </div>
                </div>
              )}
              {formError ? <p className="text-sm text-red-700">{formError}</p> : null}
              {detail.data.publishedVersions.length > 0 ? (
                <Button type="button" onClick={() => savePlan.mutate()} disabled={savePlan.isPending}>
                  {savePlan.isPending ? "Saving..." : "Save plan"}
                </Button>
              ) : null}
              {detail.data.planHistory.length > 0 ? (
                <div className="text-sm text-slate-600 space-y-1">
                  <p className="font-medium text-slate-800">Version changes</p>
                  {detail.data.planHistory.slice().reverse().map((entry) => (
                    <p key={`${entry.at}-${entry.toVersion}`}>
                      {showDate(entry.at)} · {entry.byName} moved {entry.fromVersion ? `version ${entry.fromVersion}` : "a new plan"} to version {entry.toVersion}
                    </p>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          {detail.data.topics.length === 0 && detail.data.syllabusVersion ? (
            <SyllabusEmpty title="No topics on this version" detail="Add topics to the syllabus, publish them, and pin that version." />
          ) : null}
          {detail.data.topics.length > 0 ? (
            <TopicProgress batchId={batchId} topics={detail.data.topics} faculty={meta.data?.faculty ?? []} />
          ) : null}
        </div>
      ) : null}
    </SyllabusPage>
  );
}

type TopicFilter = "all" | "covered" | "partly_covered" | "incomplete" | "not_started";

const STATUS_META = {
  covered: { label: "Covered", color: "#059669", chip: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  partly_covered: { label: "Partly covered", color: "#d97706", chip: "bg-amber-50 text-amber-800 border-amber-200" },
  incomplete: { label: "Incomplete", color: "#0284c7", chip: "bg-sky-50 text-sky-800 border-sky-200" },
  not_started: { label: "Not started", color: "#94a3b8", chip: "bg-slate-50 text-slate-700 border-slate-200" },
} as const;

const FEEDBACK_LABEL: Record<Understanding, string> = {
  understood: "Understood",
  partly_understood: "Partly understood",
  need_help: "Need help",
};

function topicBucket(status: LessonStatus | null): Exclude<TopicFilter, "all"> {
  if (status === "completed") return "covered";
  if (status === "partly_covered") return "partly_covered";
  if (status === "not_covered") return "incomplete";
  return "not_started";
}

function TopicProgress({
  batchId,
  topics,
  faculty,
}: {
  batchId: string;
  topics: TopicScheduleView[];
  faculty: { uid: string; name: string }[];
}) {
  const [filter, setFilter] = useState<TopicFilter>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState("");
  const [scheduleId, setScheduleId] = useState("");
  const covered = topics.filter((topic) => topicBucket(topic.lessonStatus) === "covered").length;
  const partly = topics.filter((topic) => topicBucket(topic.lessonStatus) === "partly_covered").length;
  const incomplete = topics.filter((topic) => topicBucket(topic.lessonStatus) === "incomplete").length;
  const notStarted = topics.filter((topic) => topicBucket(topic.lessonStatus) === "not_started").length;
  const percent = topics.length === 0 ? 0 : Math.round((covered / topics.length) * 100);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return topics.filter((topic) => {
      if (filter !== "all" && topicBucket(topic.lessonStatus) !== filter) return false;
      if (!needle) return true;
      return `${topic.topicTitle} ${topic.moduleTitle} ${topic.weekLabel} ${topic.description}`.toLowerCase().includes(needle);
    });
  }, [topics, filter, query]);
  const groups = useMemo(() => {
    const rows: { label: string; topics: TopicScheduleView[] }[] = [];
    const index = new Map<string, number>();
    visible.forEach((topic) => {
      const label = topic.weekLabel.trim() || topic.moduleTitle || "Topics";
      const existing = index.get(label);
      if (existing === undefined) {
        index.set(label, rows.length);
        rows.push({ label, topics: [topic] });
      } else {
        rows[existing].topics.push(topic);
      }
    });
    return rows;
  }, [visible]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Syllabus completion</CardTitle>
        </CardHeader>
        <CardContent>
          <CompletionChart
            percent={percent}
            covered={covered}
            partly={partly}
            incomplete={incomplete}
            notStarted={notStarted}
            total={topics.length}
            filter={filter}
            onFilter={setFilter}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Topics</CardTitle>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a topic name" aria-label="Search topics" />
          <div className="flex flex-wrap gap-2">
            <FilterButton active={filter === "all"} onClick={() => setFilter("all")} label={`All ${topics.length}`} />
            <FilterButton active={filter === "covered"} onClick={() => setFilter("covered")} label={`Covered ${covered}`} />
            <FilterButton active={filter === "partly_covered"} onClick={() => setFilter("partly_covered")} label={`Partly covered ${partly}`} />
            <FilterButton active={filter === "incomplete"} onClick={() => setFilter("incomplete")} label={`Incomplete ${incomplete}`} />
            <FilterButton active={filter === "not_started"} onClick={() => setFilter("not_started")} label={`Not started ${notStarted}`} />
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {groups.length === 0 ? <p className="text-sm text-slate-600">No topics match that search.</p> : null}
          {groups.map((group) => (
            <section key={group.label} className="space-y-2">
              <h2 className="text-sm font-semibold text-slate-900">{group.label}</h2>
              <ul className="space-y-2">
                {group.topics.map((topic) => (
                  <TopicRow
                    key={topic.topicId}
                    batchId={batchId}
                    topic={topic}
                    faculty={faculty}
                    open={openId === topic.topicId}
                    scheduling={scheduleId === topic.topicId}
                    onOpen={() => setOpenId(openId === topic.topicId ? "" : topic.topicId)}
                    onSchedule={() => setScheduleId(scheduleId === topic.topicId ? "" : topic.topicId)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function CompletionChart({
  percent,
  covered,
  partly,
  incomplete,
  notStarted,
  total,
  filter,
  onFilter,
}: {
  percent: number;
  covered: number;
  partly: number;
  incomplete: number;
  notStarted: number;
  total: number;
  filter: TopicFilter;
  onFilter: (filter: TopicFilter) => void;
}) {
  const slices = [
    { status: "covered" as const, name: STATUS_META.covered.label, value: covered, color: STATUS_META.covered.color },
    { status: "partly_covered" as const, name: STATUS_META.partly_covered.label, value: partly, color: STATUS_META.partly_covered.color },
    { status: "incomplete" as const, name: STATUS_META.incomplete.label, value: incomplete, color: STATUS_META.incomplete.color },
    { status: "not_started" as const, name: STATUS_META.not_started.label, value: notStarted, color: STATUS_META.not_started.color },
  ].filter((slice) => slice.value > 0);

  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr] md:items-center">
      <div className="relative mx-auto h-52 w-full max-w-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              innerRadius={62}
              outerRadius={84}
              stroke="none"
              paddingAngle={slices.length > 1 ? 2 : 0}
              onClick={(_, index) => {
                const status = slices[index]?.status;
                if (status) onFilter(filter === status ? "all" : status);
              }}
            >
              {slices.map((slice) => (
                <Cell key={slice.status} fill={slice.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-3xl font-semibold text-slate-900">{percent}%</p>
          <p className="text-xs text-slate-500">covered</p>
        </div>
      </div>
      <div className="space-y-3">
        <p className="text-sm text-slate-700">
          <span className="font-medium text-slate-900">{covered} of {total} topics</span> are covered.
        </p>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
          <span className="h-full bg-emerald-600" style={{ width: `${(covered / total) * 100}%` }} />
          <span className="h-full bg-amber-500" style={{ width: `${(partly / total) * 100}%` }} />
          <span className="h-full bg-sky-600" style={{ width: `${(incomplete / total) * 100}%` }} />
          <span className="h-full bg-slate-300" style={{ width: `${(notStarted / total) * 100}%` }} />
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          <LegendButton active={filter === "covered"} onClick={() => onFilter(filter === "covered" ? "all" : "covered")} color={STATUS_META.covered.color} label={`${covered} Covered`} />
          <LegendButton active={filter === "partly_covered"} onClick={() => onFilter(filter === "partly_covered" ? "all" : "partly_covered")} color={STATUS_META.partly_covered.color} label={`${partly} Partly covered`} />
          <LegendButton active={filter === "incomplete"} onClick={() => onFilter(filter === "incomplete" ? "all" : "incomplete")} color={STATUS_META.incomplete.color} label={`${incomplete} Incomplete`} />
          <LegendButton active={filter === "not_started"} onClick={() => onFilter(filter === "not_started" ? "all" : "not_started")} color={STATUS_META.not_started.color} label={`${notStarted} Not started`} />
        </ul>
      </div>
    </div>
  );
}

function LegendButton({ active, onClick, color, label }: { active: boolean; onClick: () => void; color: string; label: string }) {
  return (
    <li>
      <button type="button" onClick={onClick} className={cn("flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm font-medium text-slate-900", active ? "border-slate-900" : "border-slate-200")}>
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </button>
    </li>
  );
}

function FilterButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("rounded-full border px-3 py-1.5 text-sm", active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700")}>
      {label}
    </button>
  );
}

function TopicRow({
  batchId,
  topic,
  faculty,
  open,
  scheduling,
  onOpen,
  onSchedule,
}: {
  batchId: string;
  topic: TopicScheduleView;
  faculty: { uid: string; name: string }[];
  open: boolean;
  scheduling: boolean;
  onOpen: () => void;
  onSchedule: () => void;
}) {
  const meta = STATUS_META[topicBucket(topic.lessonStatus)];
  return (
    <li className="rounded-md border border-slate-200 bg-white">
      <button type="button" className="w-full px-3 py-3 text-left hover:bg-slate-50" aria-expanded={open} onClick={onOpen}>
        <span className="flex items-start justify-between gap-3">
          <span>
            <span className="block font-medium text-slate-900">{topic.topicTitle}</span>
            <span className="block text-xs text-slate-500">
              {topic.moduleTitle}
              {topic.plannedDate ? ` · Planned ${showDate(topic.plannedDate)}` : ""}
              {topic.teacherName ? ` · ${topic.teacherName}` : ""}
            </span>
          </span>
          <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-xs", meta.chip)}>{meta.label}</span>
        </span>
        {open ? (
          <span className="mt-2 block whitespace-pre-wrap text-sm text-slate-700">
            {topic.description.trim() ? topic.description : "No extra notes for this topic."}
          </span>
        ) : null}
      </button>
      <div className="border-t border-slate-100 px-3 py-2">
        <Button type="button" variant="outline" className="w-full" onClick={onSchedule}>
          {topic.plannedDate ? "Update schedule" : "Schedule topic"}
        </Button>
        <StudentNotes notes={topic.feedback ?? []} />
        {scheduling ? <ScheduleForm batchId={batchId} topic={topic} faculty={faculty} /> : null}
      </div>
    </li>
  );
}

function StudentNotes({ notes }: { notes: StudentFeedbackNote[] }) {
  return (
    <div className="mt-2 rounded-md bg-slate-50 px-2 py-1.5">
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

function ScheduleForm({
  batchId,
  topic,
  faculty,
}: {
  batchId: string;
  topic: TopicScheduleView;
  faculty: { uid: string; name: string }[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [plannedDate, setPlannedDate] = useState(topic.plannedDate);
  const [teacherUid, setTeacherUid] = useState(topic.teacherUid);
  const [error, setError] = useState("");

  useEffect(() => {
    setPlannedDate(topic.plannedDate);
    setTeacherUid(topic.teacherUid);
  }, [topic.plannedDate, topic.teacherUid]);

  const save = useMutation({
    mutationFn: () => {
      if (!plannedDate || !teacherUid) throw new Error("Choose a date and a teacher.");
      return syllabusApi.saveSchedule(batchId, {
        topicId: topic.topicId,
        moduleId: topic.moduleId,
        plannedDate,
        teacherUid,
      });
    },
    onSuccess: async () => {
      setError("");
      toast({ title: "Topic scheduled" });
      await queryClient.invalidateQueries({ queryKey: ["syllabus-batch", batchId] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <div className="mt-3 space-y-2">
      <Label>Planned date for {topic.topicTitle}</Label>
      <Input type="date" value={plannedDate} onChange={(event) => setPlannedDate(event.target.value)} />
      <Label>Teacher</Label>
      <Select value={teacherUid || undefined} onValueChange={setTeacherUid}>
        <SelectTrigger><SelectValue placeholder="Choose a teacher" /></SelectTrigger>
        <SelectContent>
          {faculty.map((person) => (
            <SelectItem key={person.uid} value={person.uid}>{person.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {topic.originalPlannedDate && topic.originalPlannedDate !== topic.plannedDate ? (
        <p className="text-sm text-slate-600">Originally planned {showDate(topic.originalPlannedDate)}</p>
      ) : null}
      {topic.scheduleHistory.length > 0 ? (
        <div className="text-sm text-slate-600 space-y-1">
          {topic.scheduleHistory.slice(-5).reverse().map((entry) => (
            <p key={entry.at}>{showDate(entry.at)} · {entry.byName} changed {showDate(entry.fromDate)} to {showDate(entry.toDate)}</p>
          ))}
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <Button type="button" className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? "Saving..." : "Save schedule"}
      </Button>
    </div>
  );
}
