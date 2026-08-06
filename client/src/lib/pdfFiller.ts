import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

import certificateTemplate from "@/assets/certifiacte of zica zima.pdf";

export interface CertificateData {
  studentName: string;
  successfullyCompleting: string;
  startDate: string;
  completionDate: string;
  duration: string;
  location: string;
  grade: string;
  [key: string]: any;
}

export const fillCertificatePdf = async (data: CertificateData, templateUrl: string = certificateTemplate) => {
  try {
    // Fetch the PDF template
    const response = await fetch(templateUrl);
    const existingPdfBytes = await response.arrayBuffer();

    // Load the PDF document
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    pdfDoc.registerFontkit(fontkit);

    // Get the first page
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();

    // Set font
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Configuration for text positioning (normalized to 1.0 or absolute)
    // Adjust these values to match the PDF template layout
    const config = {
      name: { y: height * 0.61, size: 22},
      successfullyCompleting: { y: height * 0.52, size: 18 },
      course: { y: height * 0.47, x: width * 0.36, size: 18 },
      // Row with Start Date, Date of Completion, Duration
      startDate: { x: width * 0.20, y: height * 0.42, size: 9 },
      completionDate: { x: width * 0.54, y: height * 0.42, size: 9 },
      duration: { x: width * 0.80, y: height * 0.42, size: 9 },
      // Row with Location and Grade
      location: { x: width * 0.20, y: height * 0.39, size: 9 },
      grade: { x: width * 0.80, y: height * 0.39, size: 9 },
    };

    // Add Name
    const nameWidth = font.widthOfTextAtSize(data.studentName, config.name.size);
    firstPage.drawText(data.studentName, {
      x: (width - nameWidth) / 2,
      y: config.name.y,
      size: config.name.size,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Add Successfully Completing Text
    const scWidth = font.widthOfTextAtSize(data.successfullyCompleting, config.successfullyCompleting.size);
    firstPage.drawText(data.successfullyCompleting, {
      x: (width - scWidth) / 2,
      y: config.successfullyCompleting.y,
      size: config.successfullyCompleting.size,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Add Course
    const courseWidth = font.widthOfTextAtSize(data.courseName, config.course.size);
    firstPage.drawText(data.courseName, {
      x: (config.course as any).x || ((width - courseWidth) / 2 + 50), 
      y: config.course.y,
      size: config.course.size,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Add Start Date
    firstPage.drawText(data.startDate, {
      x: config.startDate.x,
      y: config.startDate.y,
      size: config.startDate.size,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Add Date of Completion
    firstPage.drawText(data.completionDate, {
      x: config.completionDate.x,
      y: config.completionDate.y,
      size: config.completionDate.size,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Add Duration
    firstPage.drawText(`${data.duration} Months`, {
      x: config.duration.x,
      y: config.duration.y,
      size: config.duration.size,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Add Location
    firstPage.drawText(data.location, {
      x: config.location.x,
      y: config.location.y,
      size: config.location.size,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Add Grade
    firstPage.drawText(data.grade, {
      x: config.grade.x,
      y: config.grade.y,
      size: config.grade.size,
      font: font,
      color: rgb(0, 0, 0),
    });

    // Serialize the PDF document to bytes (Uint8Array)
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
  } catch (error) {
    console.error("Error filling PDF:", error);
    throw error;
  }
};
