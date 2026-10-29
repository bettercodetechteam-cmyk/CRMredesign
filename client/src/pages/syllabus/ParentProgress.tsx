import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { syllabusApi, errorMessage } from "@/lib/syllabusApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Loading from "@/components/ui/loading";
import type { ParentProgress as ParentProgressData, ParentStudentCard, ParentTopic, ParentTopicStatus } from "@shared/syllabusTypes";
import { cn } from "@/lib/utils";
import { CourseClassPicker, type ClassCourse, SyllabusEmpty, SyllabusError, SyllabusPage, showDate, useSyllabusAccess } from "./SyllabusChrome";

type TopicFilter = "all" | ParentTopicStatus;

const STATUS_META: Record<ParentTopicStatus, { label: string; color: string; chip: string }> = {
  covered: { label: "Covered", color: "#059669", chip: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  partly_covered: { label: "Partly covered", color: "#d97706", chip: "bg-amber-50 text-amber-800 border-amber-200" },
  incomplete: { label: "Incomplete", color: "#0284c7", chip: "bg-sky-50 text-sky-800 border-sky-200" },
  not_started: { label: "Not started", color: "#94a3b8", chip: "bg-slate-50 text-slate-700 border-slate-200" },
};

export default function ParentProgress() {
  const { studentId } = useParams();
  const access = useSyllabusAccess();
  const home = useQuery({
    queryKey: ["syllabus-parent-home"],
    queryFn: () => syllabusApi.parentHome(),
    enabled: Boolean(access.data?.canViewParentProgress && !studentId),
    retry: false,
  });
  const onlyChildId = useMemo(() => {
    const ids = [...new Set((home.data ?? []).map((student) => student.studentId))];
    return ids.length === 1 ? ids[0] : "";
  }, [home.data]);
  const openId = studentId || onlyChildId;
  const progress = useQuery({
    queryKey: ["syllabus-parent", openId],
    queryFn: () => syllabusApi.parentProgress(openId),
    enabled: Boolean(access.data?.canViewParentProgress && openId),
    retry: false,
  });

  return (
    <SyllabusPage
      title="Progress"
      description={openId ? "See your child's course progress." : "Pick a course, then your child, to see that class."}
    >
      {access.data && !access.data.canViewParentProgress ? (
        <SyllabusEmpty title="Parent progress" detail="This page is for a parent login linked to a student." />
      ) : null}
      {!studentId && home.isLoading ? <Loading text="Loading linked students..." /> : null}
      {!studentId && home.isError ? <SyllabusError message={errorMessage(home.error)} onRetry={() => home.refetch()} /> : null}
      {!studentId && home.data && home.data.length === 0 ? (
        <SyllabusEmpty title="No students linked" detail="A director or academic head links your login to a student. Until then there is nothing to show." />
      ) : null}
      {!openId && home.data && home.data.length > 0 ? <ParentCourseList students={home.data} /> : null}

      {openId && progress.isLoading ? <Loading text="Loading progress..." /> : null}
      {openId && progress.isError ? (
        <SyllabusError message={errorMessage(progress.error)} onRetry={() => progress.refetch()} />
      ) : null}
      {progress.data ? <ProgressDetail progress={progress.data} /> : null}
    </SyllabusPage>
  );
}

function ParentCourseList({ students }: { students: ParentStudentCard[] }) {
  const courses = useMemo(() => groupParents(students), [students]);
  const [courseName, setCourseName] = useState("");
  const course = courses.find((item) => item.name === courseName) ?? courses[0];
  return (
    <CourseClassPicker
      courses={courses}
      courseName={course?.name ?? ""}
      onCourse={setCourseName}
      studentHref={(id) => `/syllabus/progress/${id}?course=${encodeURIComponent(course?.name || "")}`}
      hint="Choose your child to see that class."
    />
  );
}

function groupParents(students: ParentStudentCard[]): ClassCourse[] {
  const grouped = new Map<string, ClassCourse>();
  for (const student of [...students].sort((a, b) => a.studentName.localeCompare(b.studentName))) {
    const name = student.courseName || "No course";
    const course = grouped.get(name) ?? { name, students: [], topicCount: 0 };
    course.students.push({
      id: student.studentId,
      name: student.studentName,
      detail: student.batchName || "Open to see topics",
    });
    grouped.set(name, course);
  }
  return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function ProgressDetail({ progress }: { progress: ParentProgressData }) {
  const [searchParams] = useSearchParams();
  const courses = progress.courses?.length
    ? progress.courses
    : [{
      courseName: progress.courseName || "Course",
      batchId: progress.batchId,
      batchName: progress.batchName,
      topics: progress.topics ?? [],
      completionPercent: progress.completionPercent,
      hasPlan: progress.hasPlan,
    }];
  const requested = searchParams.get("course") || "";
  const [courseName, setCourseName] = useState(
    courses.find((course) => course.courseName === requested)?.courseName || courses[0]?.courseName || ""
  );
  const selected = courses.find((course) => course.courseName === courseName) ?? courses[0];
  const topics = selected?.topics ?? [];
  const [filter, setFilter] = useState<TopicFilter>("all");
  const covered = topics.filter((topic) => topic.status === "covered").length;
  const partly = topics.filter((topic) => topic.status === "partly_covered").length;
  const incomplete = topics.filter((topic) => topic.status === "incomplete").length;
  const notStarted = topics.filter((topic) => topic.status === "not_started").length;
  const percent = topics.length === 0 ? 0 : Math.round((covered / topics.length) * 100);

  return (
    <div className="space-y-4">
      {courses.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {courses.map((course) => {
            const active = course.courseName === selected?.courseName;
            const courseCovered = course.topics.filter((topic) => topic.status === "covered").length;
            const coursePercent = course.topics.length === 0 ? 0 : Math.round((courseCovered / course.topics.length) * 100);
            return (
              <button
                key={course.batchId || course.courseName}
                type="button"
                onClick={() => {
                  setCourseName(course.courseName);
                  setFilter("all");
                }}
                className={cn(
                  "rounded-lg border px-4 py-3 text-left",
                  active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"
                )}
              >
                <span className="block text-sm font-semibold">{course.courseName}</span>
                <span className={cn("block text-xs", active ? "text-slate-200" : "text-slate-500")}>
                  {coursePercent}% covered · {course.topics.length} topics
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{selected?.courseName || "Course"}</CardTitle>
          <p className="text-sm text-slate-600">{progress.studentName}</p>
        </CardHeader>
        <CardContent>
          {!selected?.hasPlan || topics.length === 0 ? (
            <SyllabusEmpty title="No topics yet" detail="Topics appear here after the course syllabus is added to this class." />
          ) : (
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
          )}
        </CardContent>
      </Card>

      {topics.length > 0 ? (
        <TopicBrowser key={selected?.batchId || selected?.courseName} topics={topics} filter={filter} onFilter={setFilter} />
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

function TopicBrowser({
  topics,
  filter,
  onFilter,
}: {
  topics: ParentTopic[];
  filter: TopicFilter;
  onFilter: (filter: TopicFilter) => void;
}) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState("");
  const counts = useMemo(() => ({
    all: topics.length,
    covered: topics.filter((topic) => topic.status === "covered").length,
    partly_covered: topics.filter((topic) => topic.status === "partly_covered").length,
    incomplete: topics.filter((topic) => topic.status === "incomplete").length,
    not_started: topics.filter((topic) => topic.status === "not_started").length,
  }), [topics]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return topics.filter((topic) => {
      if (filter !== "all" && topic.status !== filter) return false;
      if (!needle) return true;
      return `${topic.topicTitle} ${topic.moduleTitle} ${topic.weekLabel} ${topic.description}`.toLowerCase().includes(needle);
    });
  }, [topics, filter, query]);
  const groups = useMemo(() => groupTopics(visible), [visible]);

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle className="text-base">Topics</CardTitle>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search a topic name"
          aria-label="Search topics"
        />
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
                const meta = STATUS_META[topic.status];
                const open = openId === topic.topicId;
                return (
                  <li key={topic.topicId}>
                    <button
                      type="button"
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-3 text-left hover:border-slate-400"
                      aria-expanded={open}
                      onClick={() => setOpenId(open ? "" : topic.topicId)}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span>
                          <span className="block font-medium text-slate-900">{topic.topicTitle}</span>
                          <span className="block text-xs text-slate-500">{topic.moduleTitle}</span>
                        </span>
                        <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-xs", meta.chip)}>{meta.label}</span>
                      </span>
                      {open ? (
                        <span className="mt-2 block space-y-1 text-sm text-slate-700">
                          {topic.description ? <span className="block whitespace-pre-wrap">{topic.description}</span> : <span className="block text-slate-500">No extra notes for this topic.</span>}
                          <span className="block text-slate-500">
                            {topic.plannedDate ? `Planned for ${showDate(topic.plannedDate)}` : "Class date not set yet"}
                          </span>
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}

function FilterButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm",
        active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700"
      )}
    >
      {label}
    </button>
  );
}

function groupTopics(topics: ParentTopic[]): { label: string; topics: ParentTopic[] }[] {
  const groups: { label: string; topics: ParentTopic[] }[] = [];
  const index = new Map<string, number>();
  for (const topic of topics) {
    const label = topic.weekLabel.trim() || topic.moduleTitle || "Topics";
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
