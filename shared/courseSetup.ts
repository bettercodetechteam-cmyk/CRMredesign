import type {
  SyllabusModule,
  SyllabusPdfPreview,
  SyllabusPdfWarning,
  SyllabusStatus,
  SyllabusTopic,
} from "./syllabusTypes";

export const SYLLABUS_STATUS_LABEL: Record<SyllabusStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  published: "Published",
};

const STATUS_ORDER: SyllabusStatus[] = ["draft", "submitted", "approved", "published"];

export function syllabusStatuses(): SyllabusStatus[] {
  return STATUS_ORDER;
}

export function readSyllabusStatus(value: unknown): SyllabusStatus {
  if (value === "published" || value === "submitted" || value === "approved" || value === "draft") return value;
  return "draft";
}

export function isOpenSyllabusStatus(status: SyllabusStatus): boolean {
  return status !== "published";
}

/** Moves skipped rows out of the check list so the preview can flag them on their own. */
export function finishPreview(preview: Omit<SyllabusPdfPreview, "unimported"> & { unimported?: SyllabusPdfWarning[] }): SyllabusPdfPreview {
  const combined = [...(preview.unimported ?? []), ...preview.warnings];
  const unimported = combined.filter((warning) => /left out/i.test(warning.message));
  const warnings = combined.filter((warning) => !/left out/i.test(warning.message));
  return { ...preview, warnings, unimported };
}

export function parseDurationMinutes(value: string): number | null {
  const raw = value.replace(/\s+/g, " ").trim();
  if (!raw) return null;
  const hours = /^(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)$/i.exec(raw);
  if (hours) {
    const minutes = Math.round(Number(hours[1]) * 60);
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 600) return null;
    return minutes;
  }
  const mins = /^(\d+)\s*(?:m|min|mins|minute|minutes)?$/i.exec(raw);
  if (!mins) return null;
  const minutes = Number(mins[1]);
  if (minutes < 0 || minutes > 600) return null;
  return minutes;
}

export function orderModules(modules: SyllabusModule[]): SyllabusModule[] {
  return [...modules]
    .sort((a, b) => a.displayOrder - b.displayOrder || a.title.localeCompare(b.title))
    .map((module, moduleIndex) => ({
      ...module,
      displayOrder: moduleIndex + 1,
      topics: [...module.topics]
        .sort((a, b) => a.displayOrder - b.displayOrder || a.title.localeCompare(b.title))
        .map((topic, topicIndex) => ({
          ...topic,
          description: topic.description ?? "",
          estimatedMinutes: topic.estimatedMinutes ?? null,
          displayOrder: topicIndex + 1,
        })),
    }));
}

export function cloneModules(modules: SyllabusModule[]): SyllabusModule[] {
  return orderModules(
    modules.map((module) => ({
      ...module,
      id: newId(),
      topics: module.topics.map((topic) => ({
        ...topic,
        id: newId(),
        description: topic.description ?? "",
        estimatedMinutes: topic.estimatedMinutes ?? null,
      })),
    }))
  );
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `topic${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function topic(order: number, title: string, minutes: number | null = null, description = ""): SyllabusTopic {
  return { id: newId(), title, description, displayOrder: order, estimatedMinutes: minutes };
}

function module(order: number, title: string, weekLabel: string, topics: SyllabusTopic[]): SyllabusModule {
  return { id: newId(), title, displayOrder: order, weekLabel, topics };
}

export interface InstituteTemplate {
  id: string;
  name: string;
  summary: string;
  modules: SyllabusModule[];
}

/** Short starting points. Faculty replace the titles before submitting. */
export function instituteTemplates(): InstituteTemplate[] {
  return [
    {
      id: "graphic-design",
      name: "Graphic Design",
      summary: "Foundations, typography, and a small portfolio module.",
      modules: [
        module(1, "Design foundations", "Week 1", [
          topic(1, "Elements and principles", 90),
          topic(2, "Color and contrast", 90),
          topic(3, "Critique checklist", 60),
        ]),
        module(2, "Typography and layout", "Week 2", [
          topic(1, "Type families and hierarchy", 90),
          topic(2, "Grids and alignment", 90),
          topic(3, "Poster layout", 120),
        ]),
      ],
    },
    {
      id: "ui-ux",
      name: "UI & UX Design",
      summary: "Research, wireframes, and a usable interface.",
      modules: [
        module(1, "Understanding the user", "Week 1", [
          topic(1, "Goals and constraints", 60),
          topic(2, "User flows", 90),
          topic(3, "Information architecture", 90),
        ]),
        module(2, "Interface design", "Week 2", [
          topic(1, "Wireframes", 90),
          topic(2, "Visual system", 90),
          topic(3, "Prototype and test notes", 120),
        ]),
      ],
    },
    {
      id: "motion-graphics",
      name: "Motion Graphics",
      summary: "Timing, type in motion, and a short sequence.",
      modules: [
        module(1, "Motion basics", "Week 1", [
          topic(1, "Frames, timing, and easing", 90),
          topic(2, "Shape and mask animation", 90),
        ]),
        module(2, "Sequence", "Week 2", [
          topic(1, "Kinetic type", 90),
          topic(2, "Storyboard to final cut", 120),
        ]),
      ],
    },
    {
      id: "photoshop",
      name: "Adobe Photoshop",
      summary: "Selection, retouching, and a composite.",
      modules: [
        module(1, "Workspace and selection", "Week 1", [
          topic(1, "Layers and masks", 90),
          topic(2, "Selections", 90),
        ]),
        module(2, "Retouch and composite", "Week 2", [
          topic(1, "Tone and color correction", 90),
          topic(2, "Composite project", 120),
        ]),
      ],
    },
  ];
}

export interface ParsedTopicList {
  modules: SyllabusModule[];
  warnings: SyllabusPdfWarning[];
  unimported: SyllabusPdfWarning[];
}

function skipped(row: string, message: string): SyllabusPdfWarning {
  return { page: 0, row, message };
}

function normalizeWeek(value: string): string {
  const raw = value.replace(/\s+/g, " ").trim();
  if (!raw) return "";
  if (/week/i.test(raw)) return raw.slice(0, 80);
  if (/^\d{1,2}$/.test(raw)) return `Week ${raw}`;
  return raw.slice(0, 80);
}

function weekLabelFor(labels: string[]): string {
  const unique = [...new Set(labels.filter(Boolean))];
  return unique.join(", ").slice(0, 80);
}

/**
 * Turns a pasted list into modules.
 * A plain list becomes one module named Topics.
 * A table uses Module, Topic, Week, and Duration. Description is optional.
 * Order is assigned from the list. Blank duration and description stay blank.
 */
export function parseTopicPaste(raw: string): ParsedTopicList {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return {
      modules: [],
      warnings: [],
      unimported: [skipped("", "Paste at least one topic.")],
    };
  }
  const delimited = lines.filter((line) => line.includes("|") || line.includes("\t")).length * 2 >= lines.length;
  return finishPaste(delimited ? parseDelimited(lines) : parseLoose(lines));
}

function finishPaste(result: ParsedTopicList): ParsedTopicList {
  return { ...result, modules: orderModules(result.modules) };
}

function cellsOf(line: string): string[] {
  const parts = (line.includes("|") ? line.split("|") : line.split("\t")).map((cell) => cell.trim());
  while (parts.length > 0 && !parts[parts.length - 1]) parts.pop();
  return parts;
}

function headerIndexes(cells: string[]): Map<"module" | "topic" | "week" | "duration" | "description", number> | null {
  const map = new Map<"module" | "topic" | "week" | "duration" | "description", number>();
  cells.forEach((cell, index) => {
    const value = cell.toLowerCase();
    if (/^modules?$/.test(value)) map.set("module", index);
    else if (/^topics?$|^session details$/.test(value)) map.set("topic", index);
    else if (/^weeks?$/.test(value)) map.set("week", index);
    else if (/^(duration|minutes|mins|hours|time)(\s*\(.*\))?$/.test(value)) map.set("duration", index);
    else if (/^descriptions?$|^details$/.test(value)) map.set("description", index);
  });
  return map.has("module") && map.has("topic") ? map : null;
}

function positionalIndexes(width: number): Map<"module" | "topic" | "week" | "duration" | "description", number> | null {
  if (width >= 5) return new Map([["module", 0], ["topic", 1], ["week", 2], ["duration", 3], ["description", 4]]);
  if (width === 4) return new Map([["module", 0], ["topic", 1], ["week", 2], ["duration", 3]]);
  if (width === 3) return new Map([["module", 0], ["topic", 1], ["week", 2]]);
  if (width === 2) return new Map([["module", 0], ["topic", 1]]);
  return null;
}

interface LooseTopic {
  title: string;
  minutes: number | null;
  week: string;
  description: string;
}

function parseDelimited(lines: string[]): ParsedTopicList {
  const unimported: SyllabusPdfWarning[] = [];
  const warnings: SyllabusPdfWarning[] = [];
  const table = lines.map(cellsOf).filter((row) => row.some(Boolean));
  let start = 0;
  let columns = headerIndexes(table[0] ?? []);
  if (columns) start = 1;
  else {
    const width = Math.max(...table.map((row) => row.length));
    columns = positionalIndexes(width);
    if (!columns) {
      return { modules: [], warnings, unimported: [skipped(lines[0] ?? "", "Use Module and Topic columns, separated by a tab or a | character.")] };
    }
    warnings.push({ page: 0, row: "", message: "Column headings were not found, so the order Module, Topic, Week, Duration was used. Check the preview." });
  }

  const groups: { title: string; topics: LooseTopic[] }[] = [];
  let carriedModule = "";
  let carriedWeek = "";
  table.slice(start).forEach((row) => {
    const moduleCell = row[columns.get("module") ?? -1] ?? "";
    const topicCell = row[columns.get("topic") ?? -1] ?? "";
    const weekCell = columns.has("week") ? row[columns.get("week") ?? -1] ?? "" : "";
    const durationCell = columns.has("duration") ? row[columns.get("duration") ?? -1] ?? "" : "";
    const description = columns.has("description") ? row[columns.get("description") ?? -1] ?? "" : "";
    if (/^(modules?|topics?|weeks?|durations?)$/i.test(topicCell)) return;
    if (weekCell) carriedWeek = normalizeWeek(weekCell);
    if (moduleCell) carriedModule = moduleCell.slice(0, 200);
    if (!topicCell) {
      const leftover = [moduleCell, weekCell, durationCell, description].filter(Boolean).join(" ");
      if (leftover) unimported.push(skipped(leftover, "This row has no topic, so it was left out."));
      return;
    }
    if (!carriedModule) {
      unimported.push(skipped(topicCell, "This topic had no module name, so it was left out."));
      return;
    }
    let minutes: number | null = null;
    if (durationCell) {
      minutes = parseDurationMinutes(durationCell);
      if (minutes === null) {
        warnings.push({ page: 0, row: topicCell, message: "The duration could not be read, so it was left blank." });
      }
    }
    const previous = groups[groups.length - 1];
    const group = previous && previous.title === carriedModule ? previous : { title: carriedModule, topics: [] };
    if (group !== previous) groups.push(group);
    group.topics.push({
      title: topicCell.slice(0, 200),
      minutes,
      week: carriedWeek,
      description: description.slice(0, 2000),
    });
  });

  return { modules: groupsToModules(groups), warnings, unimported };
}

function splitPlainTopic(line: string): { title: string; minutes: number | null } {
  const match = /^(.*\S)\s+[-–]\s+(\d+(?:\.\d+)?(?:\s*(?:m|min|mins|minute|minutes|h|hr|hrs|hour|hours))?)$/i.exec(line);
  if (!match) return { title: line, minutes: null };
  const minutes = parseDurationMinutes(match[2]);
  if (minutes === null) return { title: line, minutes: null };
  return { title: match[1].trim(), minutes };
}

function parseLoose(lines: string[]): ParsedTopicList {
  const unimported: SyllabusPdfWarning[] = [];
  const groups: { title: string; topics: LooseTopic[] }[] = [];
  let current = "Topics";
  let started = false;
  let headingWaiting = false;
  const ensure = () => {
    const previous = groups[groups.length - 1];
    if (previous && previous.title === current) return previous;
    const group = { title: current, topics: [] as LooseTopic[] };
    groups.push(group);
    return group;
  };
  lines.forEach((line) => {
    const heading = /^(?:module|week)\s*[:.-]\s*(.+)$/i.exec(line);
    if (heading) {
      if (headingWaiting) unimported.push(skipped(current, "This module has no topics, so it was left out."));
      current = heading[1].trim().slice(0, 200);
      started = true;
      headingWaiting = true;
      return;
    }
    if (line.endsWith(":") && !line.includes("|") && line.length <= 80) {
      if (headingWaiting) unimported.push(skipped(current, "This module has no topics, so it was left out."));
      current = line.slice(0, -1).trim().slice(0, 200);
      started = true;
      headingWaiting = true;
      return;
    }
    const text = line.replace(/^[-*•]\s+/, "").trim();
    if (!text) return;
    if (!started && groups.length === 0) current = "Topics";
    const parsed = splitPlainTopic(text);
    if (!parsed.title) {
      unimported.push(skipped(line, "This line has no topic, so it was left out."));
      return;
    }
    ensure().topics.push({ title: parsed.title.slice(0, 200), minutes: parsed.minutes, week: "", description: "" });
    headingWaiting = false;
  });
  if (headingWaiting && current !== "Topics") {
    unimported.push(skipped(current, "This module has no topics, so it was left out."));
  }
  const used = groups.filter((group) => group.topics.length > 0);
  groups.filter((group) => group.topics.length === 0).forEach((group) => {
    unimported.push(skipped(group.title, "This module has no topics, so it was left out."));
  });
  return { modules: groupsToModules(used), warnings: [], unimported };
}

function groupsToModules(groups: { title: string; topics: LooseTopic[] }[]): SyllabusModule[] {
  return groups.map((group, moduleIndex) => ({
    id: newId(),
    title: group.title,
    displayOrder: moduleIndex + 1,
    ...(weekLabelFor(group.topics.map((item) => item.week))
      ? { weekLabel: weekLabelFor(group.topics.map((item) => item.week)) }
      : {}),
    topics: group.topics.map((item, topicIndex) => ({
      id: newId(),
      title: item.title,
      description: item.description,
      displayOrder: topicIndex + 1,
      estimatedMinutes: item.minutes,
    })),
  }));
}
