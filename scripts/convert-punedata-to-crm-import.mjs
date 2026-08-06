/**
 * Convert Punedata1000.xlsx (no headers) → CRM leads import file (top N rows).
 */
import XLSX from 'xlsx';
import fs from 'fs';

const SRC = 'C:/Users/Admin/Downloads/Punedata1000.xlsx';
const OUT_DOWNLOADS = 'C:/Users/Admin/Downloads/Punedata500-CRM-import.xlsx';
const OUT_LOCAL = 'C:/Users/Admin/CRM/Zica-Zima-CRM/backups/Punedata500-CRM-import.xlsx';
const LIMIT = 500;

const buf = fs.readFileSync(SRC);
const wb = XLSX.read(buf, { type: 'buffer' });
const ws = wb.Sheets[wb.SheetNames[0]];
const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

const dataRows = raw.filter(
  (r) => Array.isArray(r) && r.some((c) => String(c).trim() !== '')
);
const top = dataRows.slice(0, LIMIT);

const today = new Date();
const enquiryDate = [
  String(today.getDate()).padStart(2, '0'),
  String(today.getMonth() + 1).padStart(2, '0'),
  String(today.getFullYear()),
].join('/');

const exportRows = top.map((r) => {
  const name = String(r[0] ?? '').trim();
  const mobile = String(r[2] ?? '').trim();
  return {
    Name: name,
    'Mobile Number': mobile,
    Course: '',
    'Counselor Name': '',
    Email: '',
    Source: 'Pune Data',
    'Enquiry Date': enquiryDate,
    Status: 'Other',
    'City/Area': 'Pune',
    Education: '',
    'Course Duration': '',
    Remark: '',
  };
});

const outWs = XLSX.utils.json_to_sheet(exportRows);
const outWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(outWb, outWs, 'Leads');
const outBuf = XLSX.write(outWb, { type: 'buffer', bookType: 'xlsx' });

let wrote = OUT_LOCAL;
try {
  fs.writeFileSync(OUT_DOWNLOADS, outBuf);
  wrote = OUT_DOWNLOADS;
} catch {
  fs.mkdirSync('C:/Users/Admin/CRM/Zica-Zima-CRM/backups', { recursive: true });
  fs.writeFileSync(OUT_LOCAL, outBuf);
  wrote = OUT_LOCAL;
}

console.log('Wrote:', wrote);
console.log('Rows:', exportRows.length);
console.log('Enquiry Date:', enquiryDate);
console.log('Sample1:', JSON.stringify(exportRows[0]));
console.log('Sample2:', JSON.stringify(exportRows[1]));
console.log('Last:', JSON.stringify(exportRows[exportRows.length - 1]));
