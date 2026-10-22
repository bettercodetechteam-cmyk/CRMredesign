import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { syllabusApi, errorMessage } from "@/lib/syllabusApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Loading from "@/components/ui/loading";
import type { DashboardFilters, DashboardReport, DashboardTopicRow } from "@shared/syllabusTypes";
import { cn } from "@/lib/utils";
import { CourseClassPicker, type ClassCourse, SyllabusEmpty, SyllabusError, SyllabusPage, showDate, useSyllabusAccess } from "./SyllabusChrome";

export default function CoordinatorDashboard() {
  const access = useSyllabusAccess();
  const meta = useQuery({
    queryKey: ["syllabus-meta"],
    queryFn: () => syllabusApi.meta(),
    enabled: Boolean(access.data?.canCoordinate),
  });
  const [filters, setFilters] = useState<DashboardFilters>({});
  const [draft, setDraft] = useState<DashboardFilters>({});
  const [filterError, setFilterError] = useState("");
  const report = useQuery({
    queryKey: ["syllabus-dashboard", filters],
    queryFn: () => syllabusApi.dashboard(filters),
    enabled: Boolean(access.data?.canCoordinate),
  });

  const apply = () => {
    if (draft.from && draft.to && draft.to < draft.from) {
      setFilterError("The end date must be on or after the start date.");
      return;
    }
    setFilterError("");
    setFilters(draft);
  };

  return (
    <SyllabusPage title="Syllabus dashboard" description="See how much of each course is covered, then open a topic to check the batch.">
      {access.data && !access.data.canCoordinate ? (
        <SyllabusEmpty title="Coordinator dashboard" detail="Directors, academic heads, and centre heads can open this report." />
      ) : null}
      {access.data?.canCoordinate ? (
        <Card>
          <CardContent className="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label>Faculty</Label>
              <Select value={draft.facultyUid || "_all"} onValueChange={(value) => setDraft((current) => ({ ...current, facultyUid: value === "_all" ? undefined : value }))}>
                <SelectTrigger><SelectValue placeholder="All faculty" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All faculty</SelectItem>
                  {(meta.data?.faculty ?? []).map((faculty) => (
                    <SelectItem key={faculty.uid} value={faculty.uid}>{faculty.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>From</Label>
              <Input type="date" value={draft.from || ""} onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value || undefined }))} />
            </div>
            <div>
              <Label>To</Label>
              <Input type="date" value={draft.to || ""} onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value || undefined }))} />
            </div>
            <div className="flex items-end">
              <Button type="button" className="w-full" onClick={apply}>Apply filters</Button>
            </div>
            {filterError ? <p className="text-sm text-red-700 sm:col-span-2">{filterError}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {report.isLoading ? <Loading text="Building the report..." /> : null}
      {report.isError ? <SyllabusError message={errorMessage(report.error)} onRetry={() => report.refetch()} /> : null}
      {report.data ? <ReportView report={report.data} /> : null}
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

function topicBucket(label: string): Exclude<TopicFilter, "all"> {
  if (label === "Covered") return "covered";
  if (label === "Partly covered") return "partly_covered";
  if (label === "Incomplete") return "incomplete";
  return "not_started";
}

function ReportView({ report }: { report: DashboardReport }) {
  const courses = useMemo(() => groupReport(report.byTopic), [report.byTopic]);
  const [courseName, setCourseName] = useState("");
  const [batchId, setBatchId] = useState("");
  const [filter, setFilter] = useState<TopicFilter>("all");
  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState("");
  const course = courses.find((item) => item.name === courseName) ?? courses[0];
  const student = course?.students.find((item) => item.id === batchId) ?? course?.students[0];
  const topics = student?.rows ?? [];
  const covered = topics.filter((topic) => topicBucket(topic.statusLabel) === "covered").length;
  const partly = topics.filter((topic) => topicBucket(topic.statusLabel) === "partly_covered").length;
  const incomplete = topics.filter((topic) => topicBucket(topic.statusLabel) === "incomplete").length;
  const notStarted = topics.filter((topic) => topicBucket(topic.statusLabel) === "not_started").length;
  const percent = topics.length === 0 ? 0 : Math.round((covered / topics.length) * 100);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return topics.filter((topic) => {
      if (filter !== "all" && topicBucket(topic.statusLabel) !== filter) return false;
      if (!needle) return true;
      return `${topic.topicTitle} ${topic.moduleTitle} ${topic.batchName} ${topic.courseName} ${topic.facultyName}`.toLowerCase().includes(needle);
    });
  }, [topics, filter, query]);
  const groups = useMemo(() => {
    const rows: { label: string; topics: DashboardTopicRow[] }[] = [];
    const index = new Map<string, number>();
    visible.forEach((topic) => {
      const label = topic.moduleTitle || "Topics";
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

  if (courses.length === 0) {
    return <SyllabusEmpty title="No topics match" detail="Assign a syllabus to a batch, or widen the filters." />;
  }

  return (
    <div className="space-y-4">
      <CourseClassPicker
        courses={courses}
        courseName={course?.name ?? ""}
        studentId={student?.id}
        onCourse={(name) => {
          const next = courses.find((item) => item.name === name);
          setCourseName(name);
          setBatchId(next?.students[0]?.id ?? "");
          setFilter("all");
          setQuery("");
        }}
        onStudent={(id) => {
          setBatchId(id);
          setFilter("all");
          setQuery("");
        }}
      />
      {topics.length === 0 ? (
        <SyllabusEmpty title="No topics for this student" detail="Assign a syllabus to this class, or widen the filters." />
      ) : (
      <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{student?.name}</CardTitle>
          <p className="text-sm text-slate-600">{course?.name} · {topics.length} topics</p>
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
          <CardTitle className="text-base">{student?.name}</CardTitle>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this student's topics" aria-label="Search topics" />
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
                {group.topics.map((topic) => {
                  const key = `${topic.batchId}-${topic.topicTitle}-${topic.plannedDate}`;
                  const meta = STATUS_META[topicBucket(topic.statusLabel)];
                  return (
                    <li key={key} className="rounded-md border border-slate-200 bg-white">
                      <button type="button" className="w-full px-3 py-3 text-left hover:bg-slate-50" aria-expanded={openKey === key} onClick={() => setOpenKey(openKey === key ? "" : key)}>
                        <span className="flex items-start justify-between gap-3">
                          <span>
                            <span className="block font-medium text-slate-900">{topic.topicTitle}</span>
                            <span className="block text-xs text-slate-500">
                              {topic.plannedDate ? `Planned ${showDate(topic.plannedDate)}` : "No planned date"}
                              {topic.facultyName ? ` · ${topic.facultyName}` : ""}
                            </span>
                          </span>
                          <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-xs", meta.chip)}>{meta.label}</span>
                        </span>
                        {openKey === key ? (
                          <span className="mt-2 block text-sm text-slate-700">
                            {topic.moduleTitle} · {topic.statusLabel}
                            {topic.facultyName ? ` · ${topic.facultyName}` : ""}
                          </span>
                        ) : null}
                      </button>
                      <div className="border-t border-slate-100 px-3 py-2">
                        <Button type="button" variant="outline" className="w-full" asChild>
                          <Link to={`/syllabus/batches/${topic.batchId}`}>Open batch plan</Link>
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </CardContent>
      </Card>
      </>
      )}
    </div>
  );
}

function groupReport(topics: DashboardTopicRow[]): (ClassCourse & { students: (ClassCourse["students"][number] & { rows: DashboardTopicRow[] })[] })[] {
  const grouped = new Map<string, { name: string; topicCount: number; students: Map<string, DashboardTopicRow[]> }>();
  for (const topic of topics) {
    const courseName = topic.courseName || "No course";
    const course = grouped.get(courseName) ?? { name: courseName, topicCount: 0, students: new Map<string, DashboardTopicRow[]>() };
    const rows = course.students.get(topic.batchId) ?? [];
    rows.push(topic);
    course.students.set(topic.batchId, rows);
    course.topicCount += 1;
    grouped.set(courseName, course);
  }
  return [...grouped.values()]
    .map((course) => ({
      name: course.name,
      topicCount: course.topicCount,
      students: [...course.students.entries()]
        .map(([id, rows]) => {
          const covered = rows.filter((topic) => topic.statusLabel === "Covered").length;
          const partly = rows.filter((topic) => topic.statusLabel === "Partly covered").length;
          const incomplete = rows.filter((topic) => topic.statusLabel === "Incomplete").length;
          const notStarted = Math.max(0, rows.length - covered - partly - incomplete);
          const percent = rows.length === 0 ? 0 : Math.round((covered / rows.length) * 100);
          return {
            id,
            name: rows[0]?.batchName || "Student",
            detail: `${percent}% covered · ${rows.length} topics`,
            covered,
            partly,
            incomplete,
            notStarted,
            total: rows.length,
            rows,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
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
