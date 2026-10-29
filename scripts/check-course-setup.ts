import assert from "node:assert/strict";
import { parseDurationMinutes, parseTopicPaste, readSyllabusStatus, orderModules } from "../shared/courseSetup";
import { buildPreviewFromRows } from "../server/syllabusPdf";

assert.equal(readSyllabusStatus("submitted"), "submitted");
assert.equal(readSyllabusStatus("approved"), "approved");
assert.equal(readSyllabusStatus("published"), "published");
assert.equal(readSyllabusStatus("legacy"), "draft");
assert.equal(parseDurationMinutes(""), null);
assert.equal(parseDurationMinutes("90"), 90);
assert.equal(parseDurationMinutes("45 min"), 45);
assert.equal(parseDurationMinutes("1.5 hours"), 90);
assert.equal(parseDurationMinutes("notes"), null);

const pasted = parseTopicPaste("Contrast - 90 min\nPalette\n");
assert.equal(pasted.modules.length, 1);
assert.equal(pasted.modules[0].title, "Topics");
assert.equal(pasted.modules[0].topics[0].title, "Contrast");
assert.equal(pasted.modules[0].topics[0].estimatedMinutes, 90);
assert.equal(pasted.modules[0].topics[0].displayOrder, 1);
assert.equal(pasted.modules[0].topics[1].estimatedMinutes, null);
assert.equal(pasted.modules[0].topics[1].description, "");

const table = parseTopicPaste([
  "Module | Topic | Week | Duration | Description",
  "Design | Contrast | 1 | 90 | ",
  "Design | | 1 | 30 | skipped",
  "| Orphan | 2 | 10 | ",
  "Type | Kerning | 2 | later | Optional note",
].join("\n"));
assert.equal(table.modules.length, 2);
assert.deepEqual(table.modules[0].topics.map((topic) => topic.title), ["Contrast", "Orphan"]);
assert.equal(table.modules[0].topics[0].estimatedMinutes, 90);
assert.equal(table.modules[0].weekLabel, "Week 1, Week 2");
assert.equal(table.modules[1].topics[0].title, "Kerning");
assert.equal(table.modules[1].topics[0].estimatedMinutes, null);
assert.equal(table.modules[1].topics[0].description, "Optional note");
assert.ok(table.unimported.some((row) => row.message.includes("no topic")));
const leading = parseTopicPaste("| Orphan topic | 1 | 10");
assert.equal(leading.modules.length, 0);
assert.ok(leading.unimported.some((row) => row.row === "Orphan topic"));
assert.ok(table.warnings.some((row) => row.message.includes("duration")));
assert.throws(() => buildPreviewFromRows(Array.from({ length: 5_001 }, () => ["Module", "Topic"])), /too many rows or columns/);

const sheet = buildPreviewFromRows([
  ["Module", "Topic", "Week", "Duration"],
  ["Colour", "Contrast", "1", "90"],
  ["Colour", "", "1", "15"],
  ["Type", "Kerning", "2", "45 min"],
]);
assert.equal(sheet.modules[0].title, "Colour");
assert.equal(sheet.modules[0].topics[0].estimatedMinutes, 90);
assert.equal(sheet.modules[0].topics[0].description, "");
assert.equal(sheet.modules[1].topics[0].estimatedMinutes, 45);
assert.ok(sheet.unimported.some((row) => /left out/i.test(row.message)));
assert.equal(sheet.modules[0].displayOrder, 1);
assert.equal(sheet.modules[0].topics[0].displayOrder, 1);

const ordered = orderModules([{
  id: "moduleone1",
  title: "B",
  displayOrder: 2,
  topics: [
    { id: "topictwo01", title: "Second", description: "", displayOrder: 2, estimatedMinutes: null },
    { id: "topicone001", title: "First", description: "", displayOrder: 1, estimatedMinutes: null },
  ],
}]);
assert.equal(ordered[0].displayOrder, 1);
assert.equal(ordered[0].topics[0].title, "First");
assert.equal(ordered[0].topics[1].displayOrder, 2);

console.log("course setup checks passed");
