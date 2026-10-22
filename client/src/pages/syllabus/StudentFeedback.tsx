import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { syllabusApi, errorMessage } from "@/lib/syllabusApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import Loading from "@/components/ui/loading";
import type { LessonStatus, MyClass, MyClassTopic, Understanding } from "@shared/syllabusTypes";
import { displayLessonStatus, feedbackAllowed } from "@shared/syllabusLogic";
import { cn } from "@/lib/utils";
import { SyllabusEmpty, SyllabusError, SyllabusPage, showDate, useSyllabusAccess } from "./SyllabusChrome";

type TopicFilter = "all" | "covered" | "partly_covered" | "incomplete" | "not_started";

const CHOICES: { value: Understanding; label: string }[] = [
  { value: "understood", label: "Understood" },
  { value: "partly_understood", label: "Partly understood" },
  { value: "need_help", label: "Need help" },
];

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

export default function StudentFeedback() {
  const access = useSyllabusAccess();
  const myClass = useQuery({
    queryKey: ["syllabus-my-class"],
    queryFn: () => syllabusApi.myClass(),
    enabled: Boolean(access.data?.canSubmitFeedback),
    retry: false,
  });

  return (
    <SyllabusPage
      title="My class"
      description="See your course progress, then give feedback after your teacher marks a topic."
    >
      {access.data && !access.data.canSubmitFeedback ? (
        <SyllabusEmpty title="Student class" detail="This page is for a student login linked to one student record." />
      ) : null}
      {myClass.isLoading ? <Loading text="Loading your class..." /> : null}
      {myClass.isError ? <SyllabusError message={errorMessage(myClass.error)} onRetry={() => myClass.refetch()} /> : null}
      {myClass.data ? <ClassView myClass={myClass.data} /> : null}
    </SyllabusPage>
  );
}

function courseCounts(topics: MyClassTopic[]) {
  const covered = topics.filter((topic) => topic.lessonStatus === "completed").length;
  const partly = topics.filter((topic) => topic.lessonStatus === "partly_covered").length;
  const incomplete = topics.filter((topic) => topic.lessonStatus === "not_covered").length;
  const notStarted = topics.filter((topic) => !feedbackAllowed(topic.lessonStatus)).length;
  const percent = topics.length === 0 ? 0 : Math.round((covered / topics.length) * 100);
  return { covered, partly, incomplete, notStarted, percent };
}

function ClassView({ myClass }: { myClass: MyClass }) {
  const courses = myClass.courses?.length
    ? myClass.courses
    : [{
      courseName: myClass.courseName || "Your course",
      batchId: myClass.batchId,
      batchName: myClass.batchName,
      topics: myClass.topics,
    }];
  const [courseName, setCourseName] = useState(courses[0]?.courseName ?? "");
  const selected = courses.find((course) => course.courseName === courseName) ?? courses[0];
  const topics = selected?.topics ?? [];
  const [filter, setFilter] = useState<TopicFilter>("all");
  const counts = courseCounts(topics);

  return (
    <div className="space-y-4">
      {courses.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {courses.map((course) => {
            const active = course.courseName === selected?.courseName;
            const courseCount = courseCounts(course.topics);
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
                  {courseCount.percent}% covered · {course.topics.length} topics
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{selected?.courseName || "Your course"}</CardTitle>
          <p className="text-sm text-slate-600">{selected?.batchName}</p>
        </CardHeader>
        <CardContent>
          {topics.length === 0 ? (
            <SyllabusEmpty title="No topics yet" detail="Topics appear here after your course is created." />
          ) : (
            <CompletionChart
              percent={counts.percent}
              covered={counts.covered}
              partly={counts.partly}
              incomplete={counts.incomplete}
              notStarted={counts.notStarted}
              total={topics.length}
              filter={filter}
              onFilter={setFilter}
            />
          )}
        </CardContent>
      </Card>
      {topics.length > 0 ? (
        <TopicList key={selected?.batchId || selected?.courseName} topics={topics} batchId={selected?.batchId || ""} filter={filter} onFilter={setFilter} />
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
  topics,
  batchId,
  filter,
  onFilter,
}: {
  topics: MyClassTopic[];
  batchId: string;
  filter: TopicFilter;
  onFilter: (filter: TopicFilter) => void;
}) {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState("");
  const [feedbackId, setFeedbackId] = useState("");
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return topics.filter((topic) => {
      if (filter !== "all" && topicBucket(topic.lessonStatus) !== filter) return false;
      if (!needle) return true;
      return `${topic.topicTitle} ${topic.moduleTitle} ${topic.weekLabel} ${topic.description ?? ""}`.toLowerCase().includes(needle);
    });
  }, [topics, filter, query]);
  const groups = useMemo(() => groupTopics(visible), [visible]);
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
        <CardTitle className="text-base">Topics</CardTitle>
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a topic name" aria-label="Search topics" />
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
              {group.topics.map((topic) => (
                <TopicRow
                  key={topic.topicId}
                  topic={topic}
                  batchId={batchId}
                  open={openId === topic.topicId}
                  feedbackOpen={feedbackId === topic.topicId}
                  onOpen={() => setOpenId(openId === topic.topicId ? "" : topic.topicId)}
                  onFeedback={() => setFeedbackId(feedbackId === topic.topicId ? "" : topic.topicId)}
                />
              ))}
            </ul>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}

function TopicRow({
  topic,
  batchId,
  open,
  feedbackOpen,
  onOpen,
  onFeedback,
}: {
  topic: MyClassTopic;
  batchId: string;
  open: boolean;
  feedbackOpen: boolean;
  onOpen: () => void;
  onFeedback: () => void;
}) {
  const bucket = topicBucket(topic.lessonStatus);
  const meta = STATUS_META[bucket];
  const canRespond = feedbackAllowed(topic.lessonStatus);

  return (
    <li className="rounded-md border border-slate-200 bg-white">
      <button type="button" className="w-full px-3 py-3 text-left hover:bg-slate-50" aria-expanded={open} onClick={onOpen}>
        <span className="flex items-start justify-between gap-3">
          <span>
            <span className="block font-medium text-slate-900">{topic.topicTitle}</span>
            <span className="block text-xs text-slate-500">
              {topic.moduleTitle}
              {topic.classDate ? ` · ${showDate(topic.classDate)}` : ""}
            </span>
          </span>
          <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-xs", meta.chip)}>{meta.label}</span>
        </span>
        {open ? (
          <span className="mt-2 block text-sm text-slate-700 whitespace-pre-wrap">
            {topic.description?.trim() ? topic.description : "No extra notes for this topic."}
          </span>
        ) : null}
      </button>
      <div className="border-t border-slate-100 px-3 py-2">
        {canRespond ? (
          <Button type="button" variant="outline" className="w-full" onClick={onFeedback}>
            {topic.understanding ? "Update feedback" : "Give feedback"}
          </Button>
        ) : (
          <Button type="button" variant="outline" className="w-full" disabled>
            Give feedback
          </Button>
        )}
        {!canRespond ? (
          <p className="mt-2 text-xs text-slate-500">This topic has not started. Feedback opens after your teacher marks it.</p>
        ) : null}
        {canRespond && topic.understanding && !feedbackOpen ? (
          <p className="mt-2 text-xs text-slate-600">Your feedback: {choiceLabel(topic.understanding)}</p>
        ) : null}
        {canRespond && feedbackOpen ? <FeedbackForm topic={topic} batchId={batchId} /> : null}
      </div>
    </li>
  );
}

function FeedbackForm({ topic, batchId }: { topic: MyClassTopic; batchId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [understanding, setUnderstanding] = useState<Understanding | "">(topic.understanding ?? "");
  const [comment, setComment] = useState(topic.comment);
  const [error, setError] = useState("");

  useEffect(() => {
    setUnderstanding(topic.understanding ?? "");
    setComment(topic.comment);
  }, [topic.understanding, topic.comment, topic.topicId]);

  const save = useMutation({
    mutationFn: () => {
      if (!understanding) throw new Error("Choose Understood, Partly understood, or Need help.");
      return syllabusApi.saveFeedback({ topicId: topic.topicId, batchId, understanding, comment });
    },
    onSuccess: async () => {
      setError("");
      toast({ title: "Feedback saved" });
      await queryClient.invalidateQueries({ queryKey: ["syllabus-my-class"] });
    },
    onError: (err) => setError(errorMessage(err)),
  });

  return (
    <div className="mt-3 space-y-2">
      <Label>How well did you follow {topic.topicTitle}?</Label>
      <p className="text-xs text-slate-500">Teacher status: {displayLessonStatus(topic.lessonStatus)}</p>
      <div className="grid gap-2">
        {CHOICES.map((choice) => (
          <button
            key={choice.value}
            type="button"
            className={cn(
              "w-full min-h-11 rounded-md border px-3 text-sm text-left",
              understanding === choice.value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-800"
            )}
            onClick={() => setUnderstanding(choice.value)}
          >
            {choice.label}
          </button>
        ))}
      </div>
      <Label>Comment</Label>
      <Textarea className="w-full" value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Optional" />
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <Button type="button" className="w-full min-h-11" onClick={() => save.mutate()} disabled={save.isPending}>
        {save.isPending ? "Saving..." : "Save feedback"}
      </Button>
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

function choiceLabel(value: Understanding): string {
  return CHOICES.find((choice) => choice.value === value)?.label ?? value;
}

function groupTopics(topics: MyClassTopic[]): { label: string; topics: MyClassTopic[] }[] {
  const groups: { label: string; topics: MyClassTopic[] }[] = [];
  const index = new Map<string, number>();
  for (const topic of topics) {
    const label = topic.weekLabel?.trim() || topic.moduleTitle || "Topics";
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
