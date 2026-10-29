import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { syllabusApi, errorMessage } from "@/lib/syllabusApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import Loading from "@/components/ui/loading";
import type { LessonStatus, StudentFeedbackNote, TeachAgenda, TeachTopic, Understanding } from "@shared/syllabusTypes";
import { cn } from "@/lib/utils";
import { CourseClassPicker, SyllabusEmpty, SyllabusError, SyllabusPage, showDate, useSyllabusAccess } from "./SyllabusChrome";

type TopicFilter = "all" | "covered" | "partly_covered" | "incomplete" | "not_started";

const STATUS_META = {
  covered: { label: "Covered", color: "#059669", chip: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  partly_covered: { label: "Partly covered", color: "#d97706", chip: "bg-amber-50 text-amber-800 border-amber-200" },
  incomplete: { label: "Incomplete", color: "#0284c7", chip: "bg-sky-50 text-sky-800 border-sky-200" },
  not_started: { label: "Not started", color: "#94a3b8", chip: "bg-slate-50 text-slate-700 border-slate-200" },
} as const;

function topicBucket(status: LessonStatus | null): Exclude<TopicFilter, "all"> {
  if (status === "completed") return "covered";
  if (status === "partly_covered") return "partly_covered";
  if (status === "not_covered") return "incomplete";
  return "not_started";
}

function lessonTopics(agenda: TeachAgenda): TeachTopic[] {
  if (agenda.topics?.length) return agenda.topics;
  return [...agenda.upcoming, ...agenda.completed];
}

export default function TeacherLessons() {
  const access = useSyllabusAccess();
  const agenda = useQuery({
    queryKey: ["syllabus-teach"],
    queryFn: () => syllabusApi.teach(),
    enabled: Boolean(access.data?.canTeach),
    retry: false,
  });

  return (
    <SyllabusPage
      title="My lessons"
      description="Pick a course, then a student. Only that student's topics are shown."
    >
      {access.data && !access.data.canTeach ? (
        <SyllabusEmpty title="Faculty lesson updates" detail="A coordinator assigns you as the faculty login on a batch plan. Other faculty cannot update that batch." />
      ) : null}
      {agenda.isLoading ? <Loading text="Loading your lessons..." /> : null}
      {agenda.isError ? <SyllabusError message={errorMessage(agenda.error)} onRetry={() => agenda.refetch()} /> : null}
      {agenda.data ? <LessonView agenda={agenda.data} /> : null}
    </SyllabusPage>
  );
}

interface TopicCounts {
  covered: number;
  partly: number;
  incomplete: number;
  notStarted: number;
  total: number;
  percent: number;
}

interface StudentGroup {
  id: string;
  name: string;
  topics: TeachTopic[];
  counts: TopicCounts;
}

interface CourseGroup {
  name: string;
  students: StudentGroup[];
  topicCount: number;
}

function countTopics(topics: TeachTopic[]): TopicCounts {
  const covered = topics.filter((topic) => topic.lessonStatus === "completed").length;
  const partly = topics.filter((topic) => topic.lessonStatus === "partly_covered").length;
  const incomplete = topics.filter((topic) => topic.lessonStatus === "not_covered").length;
  const notStarted = topics.filter((topic) => topicBucket(topic.lessonStatus) === "not_started").length;
  const total = topics.length;
  return {
    covered,
    partly,
    incomplete,
    notStarted,
    total,
    percent: total === 0 ? 0 : Math.round((covered / total) * 100),
  };
}

function groupByCourse(topics: TeachTopic[]): CourseGroup[] {
  const courses = new Map<string, Map<string, StudentGroup>>();
  for (const topic of topics) {
    const courseName = topic.courseName || "Course";
    const students = courses.get(courseName) ?? new Map<string, StudentGroup>();
    const existing = students.get(topic.batchId);
    if (existing) {
      existing.topics.push(topic);
    } else {
      students.set(topic.batchId, {
        id: topic.batchId,
        name: topic.batchName || "Student",
        topics: [topic],
        counts: countTopics([]),
      });
    }
    courses.set(courseName, students);
  }
  return [...courses.entries()]
    .map(([name, students]) => {
      const list = [...students.values()]
        .map((student) => ({ ...student, counts: countTopics(student.topics) }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return {
        name,
        students: list,
        topicCount: list.reduce((sum, student) => sum + student.topics.length, 0),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function LessonView({ agenda }: { agenda: TeachAgenda }) {
  const topics = lessonTopics(agenda);
  const courses = useMemo(() => groupByCourse(topics), [topics]);
  const [courseName, setCourseName] = useState("");
  const [batchId, setBatchId] = useState("");
  const [filter, setFilter] = useState<TopicFilter>("all");
  const course = courses.find((item) => item.name === courseName) ?? courses[0];
  const student = course?.students.find((item) => item.id === batchId) ?? course?.students[0];

  const chooseCourse = (name: string) => {
    const next = courses.find((item) => item.name === name);
    setCourseName(name);
    setBatchId(next?.students[0]?.id ?? "");
    setFilter("all");
  };

  const chooseStudent = (id: string) => {
    setBatchId(id);
    setFilter("all");
  };

  if (topics.length === 0) {
    return <SyllabusEmpty title="No topics assigned" detail="When a coordinator assigns you as the faculty login on a batch, its topics show up here." />;
  }

  return (
    <div className="space-y-4">
      <CourseClassPicker
        courses={courses.map((item) => ({
          name: item.name,
          topicCount: item.topicCount,
          students: item.students.map((studentItem) => ({
            id: studentItem.id,
            name: studentItem.name,
            detail: `${studentItem.counts.percent}% covered · ${studentItem.counts.total} topics`,
            covered: studentItem.counts.covered,
            partly: studentItem.counts.partly,
            incomplete: studentItem.counts.incomplete,
            notStarted: studentItem.counts.notStarted,
            total: studentItem.counts.total,
          })),
        }))}
        courseName={course?.name ?? ""}
        studentId={student?.id}
        onCourse={chooseCourse}
        onStudent={chooseStudent}
      />

      {student ? (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{student.name}</CardTitle>
              <p className="text-sm text-slate-600">{course?.name} · {student.counts.total} topics</p>
            </CardHeader>
            <CardContent>
              <CompletionChart
                percent={student.counts.percent}
                covered={student.counts.covered}
                partly={student.counts.partly}
                incomplete={student.counts.incomplete}
                notStarted={student.counts.notStarted}
                total={student.counts.total}
                filter={filter}
                onFilter={setFilter}
              />
            </CardContent>
          </Card>
          <TopicList key={student.id} title={student.name} topics={student.topics} filter={filter} onFilter={setFilter} />
        </>
      ) : null}
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

function TopicList({
  title,
  topics,
  filter,
  onFilter,
}: {
  title: string;
  topics: TeachTopic[];
  filter: TopicFilter;
  onFilter: (filter: TopicFilter) => void;
}) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState("");
  const [editId, setEditId] = useState("");
  const batches = new Set(topics.map((topic) => topic.batchId));
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return topics.filter((topic) => {
      if (filter !== "all" && topicBucket(topic.lessonStatus) !== filter) return false;
      if (!needle) return true;
      return `${topic.topicTitle} ${topic.moduleTitle} ${topic.weekLabel ?? ""} ${topic.description ?? ""} ${topic.courseName}`.toLowerCase().includes(needle);
    });
  }, [topics, filter, query]);
  const groups = useMemo(() => groupTopics(visible, batches.size > 1), [visible, batches.size]);
  const counts = {
    all: topics.length,
    covered: topics.filter((topic) => topicBucket(topic.lessonStatus) === "covered").length,
    partly_covered: topics.filter((topic) => topicBucket(topic.lessonStatus) === "partly_covered").length,
    incomplete: topics.filter((topic) => topicBucket(topic.lessonStatus) === "incomplete").length,
    not_started: topics.filter((topic) => topicBucket(topic.lessonStatus) === "not_started").length,
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this student's topics" aria-label="Search topics" />
        <div className="flex flex-wrap gap-2">
          <FilterButton active={filter === "all"} onClick={() => onFilter("all")} label={`All ${counts.all}`} />
          <FilterButton active={filter === "covered"} onClick={() => onFilter("covered")} label={`Covered ${counts.covered}`} />
          <FilterButton active={filter === "partly_covered"} onClick={() => onFilter("partly_covered")} label={`Partly covered ${counts.partly_covered}`} />
          <FilterButton active={filter === "incomplete"} onClick={() => onFilter("incomplete")} label={`Incomplete ${counts.incomplete}`} />
          <FilterButton active={filter === "not_started"} onClick={() => onFilter("not_started")} label={`Not started ${counts.not_started}`} />
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {groups.length === 0 ? <p className="text-sm text-slate-600">No topics match that search.</p> : null}
        {groups.map((group) => (
          <section key={group.label} className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-900">{group.label}</h2>
            <ul className="space-y-2">
              {group.topics.map((topic) => {
                const key = `${topic.batchId}-${topic.topicId}`;
                return (
                  <TopicRow
                    key={key}
                    topic={topic}
                    open={openId === key}
                    editing={editId === key}
                    onOpen={() => setOpenId(openId === key ? "" : key)}
                    onEdit={() => setEditId(editId === key ? "" : key)}
                  />
                );
              })}
            </ul>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}

function TopicRow({
  topic,
  open,
  editing,
  onOpen,
  onEdit,
}: {
  topic: TeachTopic;
  open: boolean;
  editing: boolean;
  onOpen: () => void;
  onEdit: () => void;
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
            </span>
          </span>
          <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-xs", meta.chip)}>{meta.label}</span>
        </span>
        {open ? (
          <span className="mt-2 block whitespace-pre-wrap text-sm text-slate-700">
            {topic.description?.trim() ? topic.description : "No extra notes for this topic."}
          </span>
        ) : null}
      </button>
      <div className="border-t border-slate-100 px-3 py-2">
        <Button type="button" variant="outline" className="w-full" onClick={onEdit}>
          {topic.lessonStatus ? "Update lesson" : "Mark lesson"}
        </Button>
        <StudentNotes notes={topic.feedback ?? []} />
        {editing ? <LessonForm topic={topic} /> : null}
      </div>
    </li>
  );
}

function LessonForm({ topic }: { topic: TeachTopic }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>(topic.lessonStatus ?? "");
  const [classDate, setClassDate] = useState(topic.classDate);
  const [minutes, setMinutes] = useState(topic.minutesSpent === null ? "" : String(topic.minutesSpent));
  const [note, setNote] = useState(topic.note);
  const [error, setError] = useState("");

  useEffect(() => {
    setStatus(topic.lessonStatus ?? "");
    setClassDate(topic.classDate);
    setMinutes(topic.minutesSpent === null ? "" : String(topic.minutesSpent));
    setNote(topic.note);
  }, [topic.lessonStatus, topic.classDate, topic.minutesSpent, topic.note, topic.topicId]);

  const save = useMutation({
    mutationFn: () => {
      if (!status) throw new Error("Choose Incomplete, Partly covered, or Covered.");
      if (!classDate) throw new Error("Enter the class date.");
      if (minutes !== "" && (!Number.isInteger(Number(minutes)) || Number(minutes) < 0)) {
        throw new Error("Time spent must be a whole number of minutes.");
      }
      return syllabusApi.saveLesson({
        batchId: topic.batchId,
        topicId: topic.topicId,
        status: status as LessonStatus,
        classDate,
        minutesSpent: minutes === "" ? null : Number(minutes),
        note,
      });
    },
    onSuccess: async () => {
      setError("");
      toast({ title: "Lesson saved" });
      await queryClient.invalidateQueries({ queryKey: ["syllabus-teach"] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <div className="mt-3 space-y-2">
      <Label>Status for {topic.topicTitle}</Label>
      <Select value={status || undefined} onValueChange={setStatus}>
        <SelectTrigger className="w-full"><SelectValue placeholder="Choose a status" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="not_covered">Incomplete</SelectItem>
          <SelectItem value="partly_covered">Partly covered</SelectItem>
          <SelectItem value="completed">Covered</SelectItem>
        </SelectContent>
      </Select>
      <Label>Class date</Label>
      <Input className="w-full" type="date" value={classDate} onChange={(event) => setClassDate(event.target.value)} />
      <Label>Minutes spent</Label>
      <Input className="w-full" inputMode="numeric" value={minutes} onChange={(event) => setMinutes(event.target.value)} placeholder="Optional" />
      <Label>Note</Label>
      <Textarea className="w-full" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional" />
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <Button type="button" className="w-full min-h-11" onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? "Saving..." : "Save lesson"}
      </Button>
    </div>
  );
}

const FEEDBACK_LABEL: Record<Understanding, string> = {
  understood: "Understood",
  partly_understood: "Partly understood",
  need_help: "Need help",
};

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

function FilterButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("rounded-full border px-3 py-1.5 text-sm", active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700")}
    >
      {label}
    </button>
  );
}

function groupTopics(topics: TeachTopic[], showBatch: boolean): { label: string; topics: TeachTopic[] }[] {
  const groups: { label: string; topics: TeachTopic[] }[] = [];
  const index = new Map<string, number>();
  for (const topic of topics) {
    const week = topic.weekLabel?.trim() || topic.moduleTitle || "Topics";
    const label = showBatch ? `${topic.batchName} · ${week}` : week;
    const existing = index.get(label);
    if (existing === undefined) {
      index.set(label, groups.length);
      groups.push({ label, topics: [topic] });
    } else {
      groups[existing].topics.push(topic);
    }
  }
  return groups;
}
