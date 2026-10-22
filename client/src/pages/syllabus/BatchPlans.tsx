import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { syllabusApi, errorMessage } from "@/lib/syllabusApi";
import Loading from "@/components/ui/loading";
import type { BatchSummary, DashboardTopicRow } from "@shared/syllabusTypes";
import { CourseClassPicker, type ClassCourse, SyllabusEmpty, SyllabusError, SyllabusPage, useSyllabusAccess } from "./SyllabusChrome";

export default function BatchPlansPage() {
  const access = useSyllabusAccess();
  const batches = useQuery({
    queryKey: ["syllabus-batches"],
    queryFn: () => syllabusApi.batches(),
    enabled: Boolean(access.data?.canCoordinate),
  });
  const report = useQuery({
    queryKey: ["syllabus-dashboard", {}],
    queryFn: () => syllabusApi.dashboard({}),
    enabled: Boolean(access.data?.canCoordinate),
  });

  return (
    <SyllabusPage title="Batch plans" description="Pick a course, then a student, to open that class plan.">
      {access.data && !access.data.canCoordinate ? (
        <SyllabusEmpty title="Coordinators plan batches" detail="Directors, academic heads, and centre heads assign syllabi to batches." />
      ) : null}
      {batches.isLoading ? <Loading text="Loading batches..." /> : null}
      {batches.isError ? <SyllabusError message={errorMessage(batches.error)} onRetry={() => batches.refetch()} /> : null}
      {batches.data && batches.data.length === 0 ? (
        <SyllabusEmpty title="No batches yet" detail="Batches come from the existing Batches page. Add one there, then return here to pin a syllabus." />
      ) : null}
      {batches.data && batches.data.length > 0 ? (
        <BatchCourseList batches={batches.data} topics={report.data?.byTopic ?? []} />
      ) : null}
    </SyllabusPage>
  );
}

function BatchCourseList({ batches, topics }: { batches: BatchSummary[]; topics: DashboardTopicRow[] }) {
  const courses = useMemo(() => groupBatches(batches, topics), [batches, topics]);
  const [courseName, setCourseName] = useState("");
  const course = courses.find((item) => item.name === courseName) ?? courses[0];
  return (
    <CourseClassPicker
      courses={courses}
      courseName={course?.name ?? ""}
      onCourse={setCourseName}
      studentHref={(id) => `/syllabus/batches/${id}`}
      hint="Choose a student to open that class plan."
    />
  );
}

function groupBatches(batches: BatchSummary[], topics: DashboardTopicRow[]): ClassCourse[] {
  const grouped = new Map<string, ClassCourse>();
  for (const batch of [...batches].sort((a, b) => (a.name || "").localeCompare(b.name || ""))) {
    const name = batch.course || "No course";
    const rows = topics.filter((topic) => topic.batchId === batch.id);
    const covered = rows.filter((topic) => topic.statusLabel === "Covered").length;
    const partly = rows.filter((topic) => topic.statusLabel === "Partly covered").length;
    const incomplete = rows.filter((topic) => topic.statusLabel === "Incomplete").length;
    const notStarted = Math.max(0, rows.length - covered - partly - incomplete);
    const percent = rows.length === 0 ? 0 : Math.round((covered / rows.length) * 100);
    const version = batch.plan ? `Version ${batch.plan.syllabusVersion}` : "No plan";
    const course = grouped.get(name) ?? { name, students: [], topicCount: 0 };
    course.students.push({
      id: batch.id,
      name: batch.name || "Untitled batch",
      detail: rows.length > 0 ? `${percent}% covered · ${version}` : version,
      covered,
      partly,
      incomplete,
      notStarted,
      total: rows.length,
    });
    course.topicCount = (course.topicCount ?? 0) + rows.length;
    grouped.set(name, course);
  }
  return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name));
}
