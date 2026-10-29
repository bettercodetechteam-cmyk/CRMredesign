import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { syllabusApi, errorMessage } from "@/lib/syllabusApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Loading from "@/components/ui/loading";
import { formatCalendarDate } from "@shared/syllabusLogic";
import type { ProgressSummary } from "@shared/syllabusLogic";
import type { DashboardTopicRow, SyllabusAccess } from "@shared/syllabusTypes";
import { cn } from "@/lib/utils";

export function useSyllabusAccess() {
  return useQuery({
    queryKey: ["syllabus-access"],
    queryFn: () => syllabusApi.access(),
    retry: false,
    staleTime: 60_000,
  });
}

export function SyllabusPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const access = useSyllabusAccess();
  return (
    <div className="w-full min-w-0 max-w-6xl mx-auto p-3 sm:p-6 space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
      {access.isLoading ? <Loading text="Checking access..." /> : null}
      {access.isError ? <SyllabusError message={errorMessage(access.error)} onRetry={() => access.refetch()} /> : null}
      {access.data ? <SyllabusNav access={access.data} /> : null}
      {access.data ? children : null}
    </div>
  );
}

function SyllabusNav({ access }: { access: SyllabusAccess }) {
  const location = useLocation();
  const links = [
    access.canAuthor || access.canCoordinate || access.canEditSyllabus ? { href: "/syllabus", label: "Setup" } : null,
    access.canCoordinate ? { href: "/syllabus/batches", label: "Batch plans" } : null,
    access.canCoordinate ? { href: "/syllabus/dashboard", label: "Dashboard" } : null,
    access.canTeach ? { href: "/syllabus/teach", label: "My lessons" } : null,
    access.canSubmitFeedback ? { href: "/syllabus/my-class", label: "My class" } : null,
    access.canViewParentProgress ? { href: "/syllabus/progress", label: "Progress" } : null,
  ].filter((link): link is { href: string; label: string } => Boolean(link));

  if (links.length <= 1) return null;
  return (
    <nav className="flex flex-wrap gap-2">
      {links.map((link) => {
        const active = location.pathname === link.href || (link.href !== "/syllabus" && location.pathname.startsWith(link.href));
        return (
          <Link
            key={link.href}
            to={link.href}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm border",
              active ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SyllabusError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="border-red-200">
      <CardContent className="p-4 sm:p-6 space-y-3">
        <p className="text-sm text-red-700">{message}</p>
        {onRetry ? (
          <Button type="button" variant="outline" onClick={onRetry}>
            Try again
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function SyllabusEmpty({ title, detail }: { title: string; detail: string }) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-6 space-y-1">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <p className="text-sm text-slate-600">{detail}</p>
      </CardContent>
    </Card>
  );
}

export interface ClassStudent {
  id: string;
  name: string;
  detail: string;
  covered?: number;
  partly?: number;
  incomplete?: number;
  notStarted?: number;
  total?: number;
  rows?: DashboardTopicRow[];
}

export interface ClassCourse {
  name: string;
  students: ClassStudent[];
  topicCount?: number;
}

export function CourseClassPicker({
  courses,
  courseName,
  studentId,
  onCourse,
  onStudent,
  studentHref,
  hint = "Choose a student to see only that class.",
}: {
  courses: ClassCourse[];
  courseName: string;
  studentId?: string;
  onCourse?: (name: string) => void;
  onStudent?: (id: string) => void;
  studentHref?: (id: string) => string;
  hint?: string;
}) {
  const course = courses.find((item) => item.name === courseName) ?? courses[0];
  if (!course) return null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {courses.map((item) => {
          const selected = course.name === item.name;
          const enrolled = item.students.length;
          return (
            <button
              key={item.name}
              type="button"
              onClick={() => onCourse?.(item.name)}
              className={cn(
                "rounded-lg border px-4 py-3 text-left",
                selected ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-900"
              )}
            >
              <span className="block text-sm font-semibold">{item.name}</span>
              <span className={cn("block text-xs", selected ? "text-slate-200" : "text-slate-500")}>
                {enrolled} {enrolled === 1 ? "student" : "students"}
              </span>
            </button>
          );
        })}
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{course.name}</CardTitle>
          <p className="text-sm text-slate-600">{hint}</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {course.students.map((student) => (
              <StudentPick
                key={student.id}
                student={student}
                selected={student.id === studentId}
                href={studentHref?.(student.id)}
                onClick={onStudent ? () => onStudent(student.id) : undefined}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StudentPick({
  student,
  selected,
  href,
  onClick,
}: {
  student: ClassStudent;
  selected: boolean;
  href?: string;
  onClick?: () => void;
}) {
  const total = student.total ?? 0;
  const className = cn(
    "block rounded-lg border px-3 py-3 text-left",
    selected ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white hover:border-slate-400"
  );
  const body = (
    <>
      <span className="block font-semibold text-slate-900">{student.name}</span>
      <span className="mt-1 block text-xs text-slate-500">{student.detail}</span>
      {total > 0 ? (
        <span className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
          <span className="h-full bg-emerald-600" style={{ width: `${((student.covered ?? 0) / total) * 100}%` }} />
          <span className="h-full bg-amber-500" style={{ width: `${((student.partly ?? 0) / total) * 100}%` }} />
          <span className="h-full bg-sky-600" style={{ width: `${((student.incomplete ?? 0) / total) * 100}%` }} />
          <span className="h-full bg-slate-300" style={{ width: `${((student.notStarted ?? 0) / total) * 100}%` }} />
        </span>
      ) : null}
    </>
  );
  if (href) return <Link to={href} className={className}>{body}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={className}>{body}</button>;
  return <div className={className}>{body}</div>;
}

export function ProgressReadout({ progress }: { progress: ProgressSummary }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-slate-900">
        {progress.completed} of {progress.total} topics completed
      </p>
      {progress.total === 0 ? (
        <p className="text-sm text-slate-500">This version has no topics yet.</p>
      ) : progress.percent !== null ? (
        <p className="text-sm text-slate-700">{progress.percent}%</p>
      ) : !progress.scheduleComplete ? (
        <p className="text-sm text-amber-700">Schedule incomplete</p>
      ) : (
        <p className="text-sm text-amber-700">Some topics have no lesson status yet.</p>
      )}
    </div>
  );
}

export function showDate(value?: string | null): string {
  return formatCalendarDate(value);
}
