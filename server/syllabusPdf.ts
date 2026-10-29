import { randomUUID } from "crypto";
import { finishPreview, parseDurationMinutes } from "../shared/courseSetup";
import type { SyllabusModule, SyllabusPdfPreview, SyllabusPdfWarning, SyllabusTopic } from "../shared/syllabusTypes";

export class SyllabusPdfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SyllabusPdfError";
  }
}

interface TextItem {
  str?: string;
  transform?: number[];
}

interface PdfDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<{ getTextContent(): Promise<{ items: TextItem[] }> }>;
  destroy(): Promise<void>;
}

interface RawItem {
  page: number;
  x: number;
  y: number;
  text: string;
}

interface Bounds {
  weekMax: number;
  countMax: number;
  moduleMax: number;
  sessionMax: number;
  headerY: number;
  foundHeadings: boolean;
}

interface Line {
  page: number;
  y: number;
  text: string;
  week: number | null;
  weeks?: number[];
  descriptions: string[];
  minutes?: number | null;
}

interface ModuleBucket {
  title: string;
  page: number;
  y: number;
  topics: Line[];
}

const DEFAULT_BOUNDS: Bounds = {
  weekMax: 55,
  countMax: 125,
  moduleMax: 240,
  sessionMax: 370,
  headerY: 749,
  foundHeadings: false,
};

const UNREADABLE = "This PDF does not have a readable syllabus table. It needs columns for week, module, and session details.";

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function weekNumber(value: string): number | null {
  const match = /week\s*[-–:]?\s*(\d{1,2})/i.exec(value);
  if (!match) return null;
  const week = Number(match[1]);
  return week >= 1 && week <= 60 ? week : null;
}

function weekLabel(weeks: number[]): string {
  const unique = [...new Set(weeks)].sort((a, b) => a - b);
  if (unique.length === 0) return "";
  if (unique.length === 1) return `Week ${unique[0]}`;
  const contiguous = unique.every((week, index) => index === 0 || week === unique[index - 1] + 1);
  if (contiguous) return `Weeks ${unique[0]}–${unique[unique.length - 1]}`;
  return `Weeks ${unique.join(", ")}`;
}

function columnOf(x: number, bounds: Bounds): "week" | "count" | "module" | "session" | "description" {
  if (x <= bounds.weekMax) return "week";
  if (x <= bounds.countMax) return "count";
  if (x <= bounds.moduleMax) return "module";
  if (x <= bounds.sessionMax) return "session";
  return "description";
}

function headerBounds(items: RawItem[]): Bounds {
  const page1 = items.filter((item) => item.page === 1 && item.y > 730);
  const find = (pattern: RegExp) => page1.find((item) => pattern.test(item.text));
  const week = find(/^weeks?$/i);
  const count = find(/sessions/i);
  const moduleName = find(/^modules?$/i);
  const session = find(/session details/i);
  const description = find(/^description$/i);
  if (!week || !count || !moduleName || !session || !description) return DEFAULT_BOUNDS;
  return {
    weekMax: (week.x + count.x) / 2,
    countMax: (count.x + moduleName.x) / 2,
    moduleMax: (moduleName.x + session.x) / 2,
    sessionMax: (session.x + description.x) / 2,
    headerY: Math.min(week.y, count.y, moduleName.y, session.y, description.y) - 8,
    foundHeadings: true,
  };
}

function mergeLines(items: RawItem[], mode: "week" | "module" | "session"): Line[] {
  const sorted = [...items].sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  const lines: Line[] = [];
  for (const item of sorted) {
    const text = clean(item.text);
    if (!text || /^program in /i.test(text)) continue;
    const previous = lines[lines.length - 1];
    const distance = previous && previous.page === item.page ? previous.y - item.y : Number.POSITIVE_INFINITY;
    const moduleWrap = mode === "module" && distance >= 0 && distance <= 14;
    const sessionWrap = mode === "session" && distance >= 0 && (distance <= 6 || (distance <= 14 && /^[a-z("'“(]/.test(text)));
    if (previous && moduleWrap) {
      previous.text = text.startsWith("(") ? clean(`${previous.text} ${text}`) : clean(`${previous.text} · ${text}`);
      continue;
    }
    if (previous && sessionWrap) {
      previous.text = clean(`${previous.text} ${text}`);
      continue;
    }
    lines.push({ page: item.page, y: item.y, text, week: weekNumber(text), descriptions: [] });
  }
  return lines;
}

function nearest(target: Line, options: Line[], maxDistance: number): Line | null {
  let best: Line | null = null;
  let bestDistance = maxDistance;
  for (const option of options) {
    if (option.page !== target.page) continue;
    const distance = Math.abs(option.y - target.y);
    if (distance < bestDistance) {
      best = option;
      bestDistance = distance;
    }
  }
  return best;
}

function pushWarning(warnings: SyllabusPdfWarning[], warning: SyllabusPdfWarning) {
  if (warnings.length >= 30) return;
  warnings.push(warning);
}

async function readItems(data: Uint8Array): Promise<RawItem[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs") as unknown as {
    getDocument: (src: { data: Uint8Array; disableWorker: boolean; isEvalSupported: boolean }) => { promise: Promise<PdfDocument> };
  };
  const document = await pdfjs.getDocument({ data, disableWorker: true, isEvalSupported: false }).promise;
  try {
    if (document.numPages > 120) {
      throw new SyllabusPdfError("This PDF has more than 120 pages. Split it into smaller syllabus files and upload again.");
    }
    const items: RawItem[] = [];
    for (let page = 1; page <= document.numPages; page += 1) {
      const pdfPage = await document.getPage(page);
      const content = await pdfPage.getTextContent();
      for (const item of content.items) {
        const text = clean(item.str ?? "");
        const x = item.transform?.[4];
        const y = item.transform?.[5];
        if (!text || typeof x !== "number" || typeof y !== "number") continue;
        items.push({ page, x, y, text });
        if (items.length > 50_000) {
          throw new SyllabusPdfError("This PDF contains too much text to preview safely. Split it into smaller syllabus files and upload again.");
        }
      }
    }
    return items;
  } finally {
    await document.destroy();
  }
}

function buildModules(sessionLines: Line[], moduleLines: Line[], warnings: SyllabusPdfWarning[]): ModuleBucket[] {
  const buckets: ModuleBucket[] = moduleLines
    .filter((line) => !/^modules?$/i.test(line.text))
    .map((line) => ({ title: line.text, page: line.page, y: line.y, topics: [] }));
  let carried: ModuleBucket | null = null;
  const pages = [...new Set(sessionLines.map((line) => line.page))].sort((a, b) => a - b);
  for (const page of pages) {
    const pageModules = buckets.filter((bucket) => bucket.page === page).sort((a, b) => b.y - a.y);
    const pageSessions = sessionLines.filter((line) => line.page === page).sort((a, b) => b.y - a.y);
    if (pageModules.length === 0) {
      for (const session of pageSessions) {
        if (!carried) {
          pushWarning(warnings, { page, row: session.text, message: "This topic had no module name, so it was left out." });
          continue;
        }
        carried.topics.push(session);
      }
      continue;
    }
    for (const session of pageSessions) {
      const owner = pageModules.reduce((best, bucket) =>
        Math.abs(bucket.y - session.y) < Math.abs(best.y - session.y) ? bucket : best
      );
      owner.topics.push(session);
    }
    carried = pageModules[pageModules.length - 1];
  }
  return buckets.filter((bucket) => bucket.topics.length > 0);
}

function toModules(buckets: ModuleBucket[], warnings: SyllabusPdfWarning[]): SyllabusModule[] {
  if (buckets.length > 40) {
    throw new SyllabusPdfError("This PDF has more than 40 modules. Split it into a smaller syllabus and upload again.");
  }
  return buckets.map((bucket, moduleIndex) => {
    if (bucket.topics.length > 80) {
      throw new SyllabusPdfError(`"${bucket.title}" has more than 80 topics. Split that module and upload again.`);
    }
    const seen = new Map<string, number>();
    const topics: SyllabusTopic[] = bucket.topics.map((topic, topicIndex) => {
      let title = clean(topic.text).slice(0, 200);
      const key = title.toLowerCase();
      const count = (seen.get(key) ?? 0) + 1;
      seen.set(key, count);
      if (count > 1) {
        title = `${title} (${count})`.slice(0, 200);
        pushWarning(warnings, {
          page: topic.page,
          row: topic.text,
          message: "This topic title was already used in the module, so a number was added.",
        });
      }
      let description = clean(topic.descriptions.join(" "));
      if (description.length > 2000) {
        description = description.slice(0, 2000);
        pushWarning(warnings, { page: topic.page, row: title, message: "The description was shortened to 2000 characters." });
      }
      return {
        id: randomUUID(),
        title,
        description,
        displayOrder: topicIndex + 1,
        estimatedMinutes: typeof topic.minutes === "number" ? topic.minutes : null,
      };
    });
    const label = weekLabel(bucket.topics.flatMap((topic) => topic.weeks?.length ? topic.weeks : topic.week ? [topic.week] : []));
    return {
      id: randomUUID(),
      title: clean(bucket.title).slice(0, 200) || "Untitled module",
      displayOrder: moduleIndex + 1,
      ...(label ? { weekLabel: label } : {}),
      topics,
    };
  });
}

function attachDescriptions(sessions: Line[], descriptions: RawItem[], headerY: number, warnings: SyllabusPdfWarning[]) {
  const pages = [...new Set(descriptions.map((item) => item.page))];
  for (const page of pages) {
    const pageSessions = sessions.filter((line) => line.page === page).sort((a, b) => b.y - a.y);
    const pageDescriptions = descriptions.filter((item) => item.page === page).sort((a, b) => b.y - a.y);
    if (pageSessions.length === 0) {
      pushWarning(warnings, { page, row: "", message: "Descriptions on this page were not next to a topic, so they were left out." });
      continue;
    }
    for (const description of pageDescriptions) {
      let owner = pageSessions[0];
      for (let index = 0; index < pageSessions.length; index += 1) {
        const current = pageSessions[index];
        const above = pageSessions[index - 1];
        const below = pageSessions[index + 1];
        const top = above ? (above.y + current.y) / 2 : headerY;
        const bottom = below ? (current.y + below.y) / 2 : 0;
        if (description.y <= top && description.y > bottom) {
          owner = current;
          break;
        }
      }
      owner.descriptions.push(description.text);
    }
  }
}

function readingLines(items: RawItem[]): { page: number; y: number; x: number; parts: { x: number; text: string }[] }[] {
  const sorted = [...items].sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  const lines: { page: number; y: number; x: number; parts: { x: number; text: string }[] }[] = [];
  for (const item of sorted) {
    const text = clean(item.text);
    if (!text || /^program in /i.test(text)) continue;
    const previous = lines[lines.length - 1];
    if (previous && previous.page === item.page && Math.abs(previous.y - item.y) <= 3) {
      previous.parts.push({ x: item.x, text });
      previous.x = Math.min(previous.x, item.x);
      continue;
    }
    lines.push({ page: item.page, y: item.y, x: item.x, parts: [{ x: item.x, text }] });
  }
  return lines;
}

function lineText(line: { parts: { x: number; text: string }[] }): string {
  return clean([...line.parts].sort((a, b) => a.x - b.x).map((part) => part.text).join(" "))
    .replace(/^[\u2022\u2023\u25E6\u2043\u2219•·\-–—*]\s*/, "")
    .replace(/^\d{1,2}[.)]\s+/, "");
}

function tidyCourseName(value: string): string {
  return clean(value)
    .replace(/\s+(syllabus|curriculum)$/i, "")
    .replace(/\s+[|].*$/, "")
    .slice(0, 80)
    .trim();
}

/** Course title printed on a syllabus, such as "Program in Digital Marketing". */
export function courseNameFromText(value: string): string {
  const text = clean(value);
  const program = /^program in\s+(.+)$/i.exec(text);
  if (program) return tidyCourseName(program[1]);
  const labeled = /^(?:course|syllabus)(?:\s*(?:name|title))?\s*[:\-–]\s*(.+)$/i.exec(text);
  if (labeled) return tidyCourseName(labeled[1]);
  const ofCourse = /^syllabus\s+(?:for|of)\s+(.+)$/i.exec(text);
  if (ofCourse) return tidyCourseName(ofCourse[1]);
  return "";
}

export function courseNameFromFileName(fileName: string): string {
  const base = fileName.replace(/^.*[\\/]/, "").replace(/\.[a-z0-9]+$/i, "");
  const name = tidyCourseName(base.replace(/[_]+/g, " ").replace(/-/g, " "));
  if (!name || /^(syllabus|curriculum|course)$/i.test(name)) return "";
  return name;
}

function courseTitleFromItems(items: RawItem[]): string {
  const sorted = items.filter((item) => item.page === 1).sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: { y: number; parts: { x: number; text: string }[] }[] = [];
  for (const item of sorted) {
    const text = clean(item.text);
    if (!text) continue;
    const previous = lines[lines.length - 1];
    if (previous && Math.abs(previous.y - item.y) <= 3) {
      previous.parts.push({ x: item.x, text });
      continue;
    }
    lines.push({ y: item.y, parts: [{ x: item.x, text }] });
  }
  for (const line of lines.slice(0, 12)) {
    const name = courseNameFromText(lineText(line));
    if (name) return name;
  }
  return "";
}

function isNoiseLine(text: string): boolean {
  if (text.length < 2) return true;
  if (/^(page\s*)?\d{1,3}$/i.test(text)) return true;
  if (/^(zica|zima|bettercode|confidential)$/i.test(text)) return true;
  if (/curriculum\s*(\(|20\d{2})/i.test(text) && text.length < 80) return true;
  return false;
}

function looksLikeWideTable(lines: { parts: { x: number }[] }[]): boolean {
  const split = lines.filter((line) => {
    const xs = line.parts.map((part) => part.x).sort((a, b) => a - b);
    return xs.some((x, index) => index > 0 && x - xs[index - 1] > 80);
  });
  return split.length >= Math.max(3, Math.floor(lines.length * 0.35));
}

/** A syllabus written as a list of topics, without week and module columns. */
function outlinePreview(items: RawItem[]): SyllabusPdfPreview | null {
  const lines = readingLines(items).filter((line) => !isNoiseLine(lineText(line)));
  if (lines.length < 2 || looksLikeWideTable(lines)) return null;
  const topics: Line[] = [];
  for (const line of lines) {
    const text = lineText(line);
    if (isNoiseLine(text)) continue;
    const previous = topics[topics.length - 1];
    const wrapped = previous
      && previous.page === line.page
      && previous.y - line.y > 3
      && previous.y - line.y <= 16
      && /^[a-z("'“(]/.test(text);
    if (wrapped) {
      previous.text = clean(`${previous.text} ${text}`);
      previous.y = line.y;
      continue;
    }
    if (previous && previous.text.toLowerCase() === text.toLowerCase() && previous.page === line.page && Math.abs(previous.y - line.y) <= 2) continue;
    topics.push({ page: line.page, y: line.y, text, week: null, descriptions: [] });
  }
  if (topics.length === 0) return null;
  const buckets: ModuleBucket[] = [];
  for (let index = 0; index < topics.length; index += 40) {
    const slice = topics.slice(index, index + 40);
    buckets.push({
      title: buckets.length === 0 ? "Syllabus" : `Syllabus ${buckets.length + 1}`,
      page: slice[0].page,
      y: slice[0].y,
      topics: slice,
    });
  }
  return { modules: toModules(buckets, []), warnings: [], unimported: [] };
}

/** Turns an institute syllabus table into draft modules. It does not publish. */
export async function extractSyllabusPdf(data: Uint8Array): Promise<SyllabusPdfPreview> {
  let items: RawItem[];
  try {
    items = await readItems(data);
  } catch (error) {
    if (error instanceof SyllabusPdfError) throw error;
    throw new SyllabusPdfError("This PDF could not be read. Check that the file is not password protected and try again.");
  }
  if (items.length === 0) throw new SyllabusPdfError(UNREADABLE);

  const bounds = headerBounds(items);
  const warnings: SyllabusPdfWarning[] = [];
  const courseName = courseTitleFromItems(items);
  if (!bounds.foundHeadings) {
    const outline = outlinePreview(items);
    if (outline) return finishPreview({ ...outline, courseName });
    pushWarning(warnings, {
      page: 1,
      row: "",
      message: "The column headings were not found, so the rows were guessed from the usual table layout. Check the preview.",
    });
  }

  const body = items.filter((item) => item.y < bounds.headerY && !/^program in /i.test(item.text));
  const weeks = mergeLines(body.filter((item) => columnOf(item.x, bounds) === "week"), "week").filter((line) => line.week);
  const modules = mergeLines(body.filter((item) => columnOf(item.x, bounds) === "module"), "module");
  const sessions = mergeLines(body.filter((item) => columnOf(item.x, bounds) === "session"), "session")
    .filter((line) => line.text.length > 0 && !/^session details$/i.test(line.text));
  const descriptions = body
    .filter((item) => columnOf(item.x, bounds) === "description" && !/^description$/i.test(item.text))
    .sort((a, b) => a.page - b.page || b.y - a.y);

  if (sessions.length === 0) throw new SyllabusPdfError(UNREADABLE);

  for (const session of sessions) {
    const week = nearest(session, weeks, 70);
    session.week = week?.week ?? null;
    if (weeks.length > 0 && !session.week) {
      pushWarning(warnings, { page: session.page, row: session.text, message: "This topic was not next to a week number." });
    }
  }

  attachDescriptions(sessions, descriptions, bounds.headerY, warnings);

  const buckets = modules.length === 0
    ? [{ title: "Syllabus", page: sessions[0].page, y: sessions[0].y, topics: sessions }]
    : buildModules(sessions, modules, warnings);
  if (buckets.length === 0) throw new SyllabusPdfError(UNREADABLE);
  const parsed = toModules(buckets, warnings);
  if (parsed.every((module) => module.topics.length === 0)) throw new SyllabusPdfError(UNREADABLE);
  if (warnings.length >= 30) {
    warnings.push({ page: 0, row: "", message: "More rows need a look. Check the preview before saving." });
  }
  return finishPreview({ modules: parsed, warnings, courseName });
}

const TABLE_UNREADABLE = "This file does not have a readable syllabus table. Use columns for week, module, and topic.";

function weeksInCell(value: string): number[] {
  const labeled = weekNumber(value);
  if (labeled) return [labeled];
  const range = /(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})/i.exec(value);
  if (range) {
    const start = Number(range[1]);
    const end = Number(range[2]);
    if (start >= 1 && end <= 60 && end >= start && end - start <= 20) {
      return Array.from({ length: end - start + 1 }, (_, index) => start + index);
    }
  }
  const single = /^(\d{1,2})$/.exec(clean(value));
  if (!single) return [];
  const week = Number(single[1]);
  return week >= 1 && week <= 60 ? [week] : [];
}

function columnMap(header: string[]): Map<"week" | "module" | "topic" | "description" | "duration", number> | null {
  const map = new Map<"week" | "module" | "topic" | "description" | "duration", number>();
  header.forEach((cell, index) => {
    const value = clean(cell).toLowerCase();
    if (/^weeks?$/.test(value)) map.set("week", index);
    else if (/session details|^topics?$/.test(value)) map.set("topic", index);
    else if (/^modules?$/.test(value)) map.set("module", index);
    else if (/^(duration|minutes|mins|hours|time)(\s*\(.*\))?$/.test(value)) map.set("duration", index);
    else if (/^descriptions?$|^details$/.test(value)) map.set("description", index);
    else if (/^sessions?$/.test(value) && !map.has("topic")) map.set("topic", index);
  });
  return map.has("module") && map.has("topic") ? map : null;
}

function mostly(values: string[], test: (value: string) => boolean): boolean {
  const filled = values.map((value) => clean(value)).filter(Boolean);
  if (filled.length === 0) return false;
  return filled.filter(test).length * 2 >= filled.length;
}

/** Headerless sheets are usually week, module, topic, description. Module-first sheets with a duration column are detected. */
function guessFourColumns(rows: string[][]): Map<"week" | "module" | "topic" | "description" | "duration", number> {
  const column = (index: number) => rows.map((row) => row[index] ?? "");
  const weekish = (index: number) => mostly(column(index), (value) => weeksInCell(value).length > 0);
  const durationish = (index: number) => mostly(column(index), (value) => parseDurationMinutes(value) !== null);
  if (!weekish(0) && weekish(2) && durationish(3)) {
    return new Map([
      ["module", 0],
      ["topic", 1],
      ["week", 2],
      ["duration", 3],
    ]);
  }
  return new Map([
    ["week", 0],
    ["module", 1],
    ["topic", 2],
    ["description", 3],
  ]);
}

/** Turns spreadsheet or Word table rows into draft modules. It does not publish. */
export function buildPreviewFromRows(rows: string[][]): SyllabusPdfPreview {
  const warnings: SyllabusPdfWarning[] = [];
  const cleaned = rows
    .map((row) => row.map((cell) => clean(String(cell ?? ""))))
    .filter((row) => row.some(Boolean));
  if (cleaned.length === 0) throw new SyllabusPdfError(TABLE_UNREADABLE);
  if (cleaned.length > 5_000 || cleaned.some((row) => row.length > 30)) {
    throw new SyllabusPdfError("This file has too many rows or columns to preview. Keep it under 5,000 rows and 30 columns, then upload again.");
  }

  let start = 0;
  let columns = columnMap(cleaned[0]);
  if (columns) {
    start = 1;
  } else {
    const width = Math.max(...cleaned.map((row) => row.length));
    if (width >= 5) columns = new Map([["week", 0], ["module", 2], ["topic", 3], ["description", 4]]);
    else if (width === 4) columns = guessFourColumns(cleaned);
    else if (width === 3) columns = new Map([["week", 0], ["module", 1], ["topic", 2]]);
    else if (width === 2) columns = new Map([["module", 0], ["topic", 1]]);
    else throw new SyllabusPdfError(TABLE_UNREADABLE);
    pushWarning(warnings, {
      page: 1,
      row: "",
      message: "The column headings were not found, so the columns were guessed. Check the preview.",
    });
  }

  const buckets: ModuleBucket[] = [];
  let carriedWeek: number[] = [];
  let carriedModule = "";
  cleaned.slice(start).forEach((row, rowIndex) => {
    const weekCell = columns.has("week") ? row[columns.get("week") ?? -1] ?? "" : "";
    const moduleCell = row[columns.get("module") ?? -1] ?? "";
    const topicCell = row[columns.get("topic") ?? -1] ?? "";
    const description = columns.has("description") ? row[columns.get("description") ?? -1] ?? "" : "";
    const durationCell = columns.has("duration") ? row[columns.get("duration") ?? -1] ?? "" : "";
    const weeks = weeksInCell(weekCell);
    if (weeks.length > 0) carriedWeek = weeks;
    if (moduleCell) carriedModule = moduleCell;
    if (!topicCell || /^session details$/i.test(topicCell) || /^topics?$/i.test(topicCell)) {
      const leftover = [moduleCell, weekCell, durationCell, description].filter(Boolean).join(" ");
      if (leftover && !/^(modules?|weeks?|durations?|descriptions?|details)$/i.test(leftover)) {
        pushWarning(warnings, { page: 1, row: leftover, message: "This row has no topic, so it was left out." });
      }
      return;
    }
    if (!carriedModule) {
      pushWarning(warnings, { page: 1, row: topicCell, message: "This topic had no module name, so it was left out." });
      return;
    }
    const previous = buckets[buckets.length - 1];
    const bucket = previous && previous.title === carriedModule
      ? previous
      : { title: carriedModule, page: 1, y: cleaned.length - rowIndex, topics: [] };
    if (bucket !== previous) buckets.push(bucket);
    let minutes: number | null = null;
    if (durationCell) {
      minutes = parseDurationMinutes(durationCell);
      if (minutes === null) {
        pushWarning(warnings, { page: 1, row: topicCell, message: "The duration could not be read, so it was left blank." });
      }
    }
    bucket.topics.push({
      page: 1,
      y: cleaned.length - rowIndex,
      text: topicCell,
      week: carriedWeek[0] ?? null,
      weeks: carriedWeek,
      descriptions: description ? [description] : [],
      minutes,
    });
  });

  if (buckets.length === 0) throw new SyllabusPdfError(TABLE_UNREADABLE);
  const parsed = toModules(buckets, warnings);
  if (parsed.every((module) => module.topics.length === 0)) throw new SyllabusPdfError(TABLE_UNREADABLE);
  let courseName = "";
  for (const row of cleaned.slice(0, 8)) {
    courseName = courseNameFromText(row.filter(Boolean).join(" "));
    if (courseName) break;
  }
  return finishPreview({ modules: parsed, warnings, courseName });
}
