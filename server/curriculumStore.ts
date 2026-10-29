import fs from "fs";
import path from "path";

const root = path.resolve(process.cwd(), "data", "curriculum");

export interface StoredCurriculumFile {
  name: string;
  filePath: string;
  path: string;
  url: string;
  fileId: string;
  size: number;
}

export function imageKitReady(): boolean {
  const pub = process.env.IMAGEKIT_PUBLIC_KEY || "";
  const priv = process.env.IMAGEKIT_PRIVATE_KEY || "";
  const url = process.env.IMAGEKIT_URL_ENDPOINT || "";
  if (!pub || !priv || !url) return false;
  return !/your_imagekit|your_private_key|your_id/i.test(`${pub} ${url}`);
}

function safeName(value: string): string {
  const base = path.basename(value).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "").trim();
  if (!base || base === "." || base === "..") throw new Error("Invalid file name.");
  return base.slice(0, 180);
}

function folderParts(folder: string): string[] {
  return folder
    .split(/[\\/]+/)
    .map((part) => part.replace(/[<>:"|?*\u0000-\u001f]/g, "").trim())
    .filter((part) => part && part !== "." && part !== "..");
}

function insideRoot(full: string): string {
  const resolved = path.resolve(full);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) throw new Error("Invalid path.");
  return resolved;
}

function recordFor(full: string): StoredCurriculumFile {
  const rel = path.relative(root, full).replace(/\\/g, "/");
  return {
    name: path.basename(full),
    filePath: rel,
    path: rel,
    url: `/api/curriculum/file?path=${encodeURIComponent(rel)}`,
    fileId: `local:${rel}`,
    size: fs.statSync(full).size,
  };
}

export function saveCurriculumFile(folder: string, fileName: string, data: Buffer): StoredCurriculumFile {
  const name = safeName(fileName);
  const dir = insideRoot(path.join(root, ...folderParts(folder)));
  fs.mkdirSync(dir, { recursive: true });
  const full = insideRoot(path.join(dir, name));
  fs.writeFileSync(full, data);
  return recordFor(full);
}

export function listCurriculumFiles(): StoredCurriculumFile[] {
  if (!fs.existsSync(root)) return [];
  const files: StoredCurriculumFile[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else files.push(recordFor(full));
    }
  };
  walk(root);
  return files;
}

export function curriculumFilePath(rel: string): string | null {
  const clean = rel.replace(/^\/+/, "");
  if (!clean || clean.includes("..")) return null;
  const full = insideRoot(path.join(root, ...folderParts(path.dirname(clean)), safeName(path.basename(clean))));
  return fs.existsSync(full) ? full : null;
}

export function deleteCurriculumFile(fileId: string): boolean {
  if (!fileId.startsWith("local:")) return false;
  const full = curriculumFilePath(fileId.slice("local:".length));
  if (!full) return false;
  fs.unlinkSync(full);
  return true;
}
