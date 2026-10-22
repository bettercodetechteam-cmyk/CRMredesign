import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { buildPreviewFromRows, extractSyllabusPdf, SyllabusPdfError } from "./syllabusPdf";
import type { SyllabusPdfPreview } from "../shared/syllabusTypes";

const UNREADABLE = "This file does not have a readable syllabus table. Use columns for week, module, and topic.";

function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function htmlRows(html: string): string[][] {
  const table = html.match(/<table[\s\S]*?<\/table>/i)?.[0] ?? "";
  if (!table) return [];
  return [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((row) =>
    [...row[0].matchAll(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi)].map((cell) => decodeHtml(cell[0]))
  );
}

function textRows(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.includes("\t")) return line.split("\t").map((cell) => cell.trim());
      if (line.includes("|")) return line.split("|").map((cell) => cell.trim()).filter(Boolean);
      return [line];
    });
}

async function rowsFromWord(file: Buffer, extension: string): Promise<string[][]> {
  if (extension === "docx") {
    const result = await mammoth.convertToHtml({ buffer: file });
    const table = htmlRows(result.value);
    if (table.length > 0) return table;
    const paragraphs = [...result.value.matchAll(/<p[\s\S]*?<\/p>/gi)].map((paragraph) => decodeHtml(paragraph[0]));
    return textRows(paragraphs.join("\n"));
  }
  const wordExtractor = (await import("word-extractor")).default;
  const extracted = await new wordExtractor().extract(file);
  return textRows(extracted.getBody() || "");
}

function rowsFromExcel(file: Buffer): string[][] {
  const workbook = XLSX.read(file, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, raw: false, defval: "" });
  return rows.map((row) => row.map((cell) => String(cell ?? "").trim()));
}

function extensionOf(fileName: string, file: Buffer): string {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  if (match) return match[1].toLowerCase();
  const start = file.subarray(0, 5).toString("utf8");
  if (start === "%PDF-") return "pdf";
  if (file[0] === 0x50 && file[1] === 0x4b) return "docx";
  if (file[0] === 0xd0 && file[1] === 0xcf) return "xls";
  return "";
}

/** Reads a PDF, Word, or Excel syllabus table into draft modules. It does not publish. */
export async function extractSyllabusFile(file: Buffer, fileName: string): Promise<SyllabusPdfPreview> {
  const extension = extensionOf(fileName, file);
  if (!["pdf", "doc", "docx", "xls", "xlsx"].includes(extension)) {
    throw new SyllabusPdfError("Choose a PDF, Word, or Excel file.");
  }
  if (extension === "pdf") return extractSyllabusPdf(new Uint8Array(file));
  try {
    const rows = extension === "xls" || extension === "xlsx" ? rowsFromExcel(file) : await rowsFromWord(file, extension);
    return buildPreviewFromRows(rows);
  } catch (error) {
    if (error instanceof SyllabusPdfError) throw error;
    throw new SyllabusPdfError(UNREADABLE);
  }
}
