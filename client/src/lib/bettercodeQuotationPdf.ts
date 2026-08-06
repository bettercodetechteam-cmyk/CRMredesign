import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 50;
const LINE_HEIGHT = 14;
const TITLE_SIZE = 14;
const BODY_SIZE = 10;
const HEADING_SIZE = 11;

export interface QuotationPdfData {
  quotationNumber: string;
  quotationDate: string;
  validTillDate: string;
  status: string;
  clientCompanyName: string;
  clientAddress: string;
  clientContactPerson: string;
  clientEmail: string;
  clientPhone: string;
  fromCompanyName: string;
  fromCompanyAddress: string;
  fromCompanyWebsite: string;
  projectTitle: string;
  projectOverview: string;
  industry: string;
  location: string;
  mainObjective: string;
  scopes: { scope_title: string; scope_description: string }[];
  modules: {
    module_name: string;
    module_description: string;
    features: { feature_name: string; feature_description: string }[];
  }[];
  costs: { service_name: string; cost_amount: string; cost_type: string; remarks: string }[];
  terms: { term_text: string }[];
  totalAmount: string;
  gstPercentage: string;
  gstAmount: string;
  grandTotal: string;
  amountInWords: string;
  signatoryName: string;
  signatoryEmail: string;
  signatoryPhone: string;
  designation: string;
  benefits: { benefit_text: string }[];
}

function wrapText(
  font: any,
  text: string,
  fontSize: number,
  maxWidth: number
): string[] {
  const lines: string[] = [];
  const paragraphs = text.split(/\n/);
  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push("");
      continue;
    }
    const words = para.split(/\s+/);
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, fontSize) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function drawLines(
  page: any,
  font: any,
  lines: string[],
  x: number,
  y: number,
  size: number,
  color: ReturnType<typeof rgb>
): number {
  let currentY = y;
  for (const line of lines) {
    if (currentY < MARGIN + 20) break;
    page.drawText(line, { x, y: currentY, size, font, color });
    currentY -= LINE_HEIGHT;
  }
  return currentY;
}

export async function generateQuotationPdf(data: QuotationPdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const black = rgb(0, 0, 0);
  const darkGray = rgb(0.2, 0.2, 0.2);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const drawHeading = (text: string) => {
    if (y < MARGIN + 40) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
    page.drawText(text, {
      x: MARGIN,
      y,
      size: HEADING_SIZE,
      font: fontBold,
      color: black,
    });
    y -= LINE_HEIGHT + 4;
  };

  const drawBody = (text: string, indent = 0) => {
    const maxW = PAGE_WIDTH - 2 * MARGIN - indent;
    const lines = wrapText(font, text || "", BODY_SIZE, maxW);
    for (const line of lines) {
      if (y < MARGIN + 20) {
        page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = PAGE_HEIGHT - MARGIN;
      }
      page.drawText(line, {
        x: MARGIN + indent,
        y,
        size: BODY_SIZE,
        font,
        color: darkGray,
      });
      y -= LINE_HEIGHT;
    }
  };

  const drawBullet = (text: string) => {
    drawBody("• " + text, 0);
  };

  // Header: From company + address + website
  page.drawText(data.fromCompanyName, {
    x: MARGIN,
    y,
    size: TITLE_SIZE,
    font: fontBold,
    color: black,
  });
  y -= LINE_HEIGHT;
  if (data.fromCompanyAddress) {
    drawBody(data.fromCompanyAddress);
  }
  if (data.fromCompanyWebsite) {
    drawBody(data.fromCompanyWebsite);
  }
  y -= LINE_HEIGHT;

  // Title
  const title = `Quotation for ${data.clientCompanyName || "Client"} for ${data.projectTitle || "Project"}.`;
  drawHeading(title);
  drawBody(`Date: ${data.quotationDate || ""}`);
  if (data.quotationNumber) {
    drawBody(`Quotation No: ${data.quotationNumber}`);
  }
  y -= LINE_HEIGHT;

  drawBody(`To: ${data.clientCompanyName || ""}`);
  if (data.clientAddress) drawBody(data.clientAddress);
  drawBody(
    `From: ${data.fromCompanyName || ""}${data.fromCompanyWebsite ? ` (${data.fromCompanyWebsite})` : ""}`
  );
  y -= LINE_HEIGHT;

  drawHeading("Project Overview");
  drawBody(data.projectOverview || "");
  y -= LINE_HEIGHT;

  drawHeading("Scope of Work");
  for (const s of data.scopes || []) {
    if (s.scope_title) drawBody(s.scope_title);
    if (s.scope_description) drawBody(s.scope_description);
  }
  y -= LINE_HEIGHT;

  drawHeading("Company Details");
  drawBody(
    `Company Name: ${data.clientCompanyName || ""}. Industry: ${data.industry || ""}, Location: ${data.location || ""}`
  );
  y -= LINE_HEIGHT;

  drawHeading("Main Objective");
  drawBody(data.mainObjective || "");
  y -= LINE_HEIGHT;

  drawHeading("Required Features");
  for (const mod of data.modules || []) {
    if (mod.module_name) {
      page.drawText(mod.module_name, {
        x: MARGIN,
        y,
        size: BODY_SIZE,
        font: fontBold,
        color: black,
      });
      y -= LINE_HEIGHT;
    }
    if (mod.module_description) drawBody(mod.module_description, 8);
    for (const f of mod.features || []) {
      const featText = f.feature_name + (f.feature_description ? ` - ${f.feature_description}` : "");
      if (featText.trim()) drawBullet(featText);
    }
    y -= 4;
  }
  y -= LINE_HEIGHT;

  if (data.benefits && data.benefits.some((b) => b.benefit_text?.trim())) {
    drawHeading("Expected Benefits");
    for (const b of data.benefits) {
      if (b.benefit_text?.trim()) drawBullet(b.benefit_text);
    }
    y -= LINE_HEIGHT;
  }

  drawHeading("Estimated Quotation (in INR)");
  for (const c of data.costs || []) {
    if (c.service_name || c.cost_amount) {
      const line = `${c.service_name || ""} ${c.cost_amount ? c.cost_type !== "Fixed" ? ` ${c.cost_type} ${c.cost_amount}` : ` ${c.cost_amount}` : ""}`;
      drawBody(line.trim());
    }
  }
  drawBody(`Total Cost (Excl GST ${data.gstPercentage || ""}%): ${data.totalAmount || ""}`);
  if (data.amountInWords) drawBody(data.amountInWords);
  y -= LINE_HEIGHT;

  drawHeading("Terms & Conditions");
  (data.terms || []).forEach((t, i) => {
    if (t.term_text?.trim()) drawBody(`${i + 1}. ${t.term_text}`);
  });
  y -= LINE_HEIGHT;

  drawBody("Looking forward to work with you. Thanking you,");
  y -= LINE_HEIGHT;
  if (data.signatoryName) drawBody(data.signatoryName);
  if (data.signatoryEmail) drawBody(data.signatoryEmail);
  if (data.signatoryPhone) drawBody(`Contact: ${data.signatoryPhone}`);
  if (data.designation) drawBody(data.designation);

  const pdfBytes = await doc.save();
  return pdfBytes;
}
