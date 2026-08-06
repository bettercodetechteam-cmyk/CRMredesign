import React, { forwardRef } from 'react';
import zicaZimaLogo from '@/assets/Zica Zima.jpg';
import bettercodeLogo from '@/assets/abettercode logo updated.png';

export interface ReceiptData {
  studentName: string;
  course: string;
  contactNumber: string;
  receiptNumber: string;
  date: string;
  paymentMode: string;
  chequeNumber?: string;
  totalInstallments: number;
  nextInstallmentDueDate?: string;
  totalCourseFees: number;
  balanceDue: number;
  amountPaid: number;
  cgst: number;
  sgst: number;
  grossTotal: number;
  lateFeesAmount?: number;
  zicaBettercode: string;
  remarks?: string;
  feeData?: any;
  receiptType?: string;
  urlAmount?: number;
  dateOfAdmission?: string;
  parentsContactNumber?: string;
}

interface ReceiptTemplateProps {
  data: ReceiptData;
  isZica: boolean;
}

export const ReceiptTemplate = forwardRef<HTMLDivElement, ReceiptTemplateProps>(({ data, isZica }, ref) => {
  return (
    <div ref={ref} className="receipt-container">
      <style>{`
        .receipt-container {
          width: 210mm;
          min-height: 297mm;
          background: white;
          padding: 10mm;
          box-sizing: border-box;
          font-family: Arial, sans-serif;
          font-size: 12px;
          line-height: 1.4;
          box-shadow: 0 0 10px rgba(0,0,0,0.1);
          margin: 0 auto;
          display: flex;
          flex-direction: column;
        }

        .header-section {
          display: flex;
          border: 2px solid #000;
          margin-bottom: 10px;
        }

        .logo-section {
          width: 25%;
          border-right: 2px solid #000;
          padding: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .logo-section img {
          max-width: 100%;
          max-height: 140px;
          width: auto;
          height: auto;
          object-fit: contain;
          object-position: center;
        }

        .header-info {
          width: 75%;
          padding: 15px;
          text-align: center;
        }

        .receipt-title {
          font-size: 10px;
          margin-bottom: 5px;
          color: #333;
        }

        .brand-name {
          font-size: 20px;
          font-weight: 900;
          margin: 8px 0;
          color: #000;
          letter-spacing: 0.5px;
        }

        .franchise-text {
          font-size: 11px;
          margin: 3px 0;
          font-weight: 600;
        }

        .registered-name {
          font-size: 11px;
          margin: 3px 0;
          font-weight: 600;
        }

        .gst-info {
          font-size: 11px;
          margin-top: 3px;
          font-weight: 600;
        }

        .info-section {
          width: 100%;
          border: 2px solid #000;
          border-collapse: collapse;
          margin-bottom: 10px;
        }

        .info-section td {
          padding: 6px 10px;
          border: 1px solid #000;
        }

        .info-label {
          width: 40%;
          font-weight: bold;
          background-color: #f8f9fa;
        }

        .info-value {
          width: 60%;
        }

        .fee-section {
          width: 100%;
          border: 2px solid #000;
          border-collapse: collapse;
          margin-bottom: 10px;
        }

        .fee-section td {
          padding: 8px 10px;
          border: 1px solid #000;
        }

        .fee-label {
          width: 60%;
          font-weight: bold;
        }

        .fee-value {
          width: 40%;
          text-align: right;
          font-family: 'Courier New', monospace;
        }

        .total-row {
          background-color: #f8f9fa;
          font-weight: bold;
          font-size: 14px;
        }

        .total-row .fee-value {
          border-top: 2px double #000;
          padding-top: 10px;
        }

        .remarks-section {
          width: 100%;
          border: 2px solid #000;
          border-collapse: collapse;
          margin-bottom: 10px;
        }

        .remarks-section td {
          padding: 6px 10px;
          border: 1px solid #000;
        }

        .terms-section {
          width: 100%;
          border: 2px solid #000;
          padding: 10px;
          margin-bottom: 10px;
          font-size: 10px;
        }

        .terms-title {
          font-weight: bold;
          margin-bottom: 5px;
        }

        .terms-list {
          margin: 0;
          padding-left: 20px;
          list-style: none; /* Remove default numbering */
        }

        .terms-list li {
          margin-bottom: 5px;
          position: relative;
          padding-left: 15px;
        }

        .terms-list li::before {
          content: "➢"; /* Simple Arrow */
          position: absolute;
          left: -5px;
          color: #000;
          font-size: 10px;
        }

        .signature-section {
          display: flex;
          justify-content: space-between;
          margin-top: auto;
          padding-top: 20px;
        }

        .signature-box {
          width: 48%;
          text-align: center;
        }

        .signature-label {
          font-weight: bold;
          margin-bottom: 40px;
        }
      `}</style>

      {isZica ? (
        // ZICA Receipt Format
        <>
          <div className="header-section">
            <div className="logo-section">
              <img src={zicaZimaLogo} alt="ZICA ZIMA Logo" />
            </div>
            <div className="header-info">
              <div className="receipt-title">Fee Receipt - For Student Use</div>
              <div className="brand-name">ZICA ZIMA PCMC PUNE</div>
              <div className="franchise-text">A Franchise Centre of Zee Learn</div>
              <div className="registered-name">Registered Name: BETTERCODE TECHNOLOGIES PVT LTD</div>
              <div className="gst-info">GST No.: 27AANCB1981HZE</div>
            </div>
          </div>

          <table className="info-section">
            <tbody>
              <tr>
                <td className="info-label">Student Full Name:</td>
                <td className="info-value">{data.studentName}</td>
              </tr>
              <tr>
                <td className="info-label">Course/Module:</td>
                <td className="info-value">{data.course}</td>
              </tr>
              <tr>
                <td className="info-label">Contact No.:</td>
                <td className="info-value">{data.contactNumber || '-'}</td>
              </tr>
              <tr>
                <td className="info-label">Receipt No.:</td>
                <td className="info-value">{data.receiptNumber}</td>
              </tr>
              <tr>
                <td className="info-label">Date:</td>
                <td className="info-value">{data.date}</td>
              </tr>
              <tr>
                <td className="info-label">Payment Mode:</td>
                <td className="info-value">{data.paymentMode}</td>
              </tr>
              <tr>
                <td className="info-label">Cheque/DD No.:</td>
                <td className="info-value">{data.chequeNumber || 'NA'}</td>
              </tr>
              <tr>
                <td className="info-label">Total No. of Installment:</td>
                <td className="info-value">{data.totalInstallments || '-'}</td>
              </tr>
              {data.totalInstallments > 0 && (
              <tr>
                <td className="info-label">Next Installment Due Date:</td>
                <td className="info-value">{data.nextInstallmentDueDate || '-'}</td>
              </tr>
              )}
            </tbody>
          </table>

          <table className="fee-section">
            <tbody>
              <tr>
                <td className="fee-label">Total Course Fees (INR):</td>
                <td className="fee-value">{data.totalCourseFees?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td className="fee-label">Balance Due:</td>
                <td className="fee-value">{data.balanceDue?.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
              </tr>
              <tr>
                <td className="fee-label">Amount Paid:</td>
                <td className="fee-value">{data.amountPaid?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td className="fee-label">CGST ( 9.00 % )</td>
                <td className="fee-value">{data.cgst?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td className="fee-label">SGST ( 9.00 % )</td>
                <td className="fee-value">{data.sgst?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
              {typeof data.lateFeesAmount === 'number' && data.lateFeesAmount > 0 && (
                <tr>
                  <td className="fee-label">Late Fees (100 × {data.lateFeesAmount / 100} days)</td>
                  <td className="fee-value">{data.lateFeesAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              )}
              <tr className="total-row">
                <td className="fee-label">Gross Total</td>
                <td className="fee-value">{data.grossTotal?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>

          <table className="remarks-section">
            <tbody>
              <tr>
                <td className="info-label">Remarks (if any):</td>
                <td className="info-value">{data.remarks || '-'}</td>
              </tr>
            </tbody>
          </table>

          <div className="terms-section">
            <div className="terms-title">Terms and Conditions:</div>
            <ul className="terms-list">
              <li>Fees must be paid in advance as per the centre's instructions. Non-payment of fees/installments may lead to termination of candidature from the particular course/module.</li>
              <li>Cheque or DD must be drawn in favour of BETTERCODE TECHNOLOGIES PRIVATE LIMITED.</li>
              <li>Fees once paid are non-refundable/non-transferable.</li>
              <li>Students must carry their Identity cards at all times in the centre. They will not be allowed to use facilities or attend classes without it.</li>
              <li>Students are expected to regularly check the notice board for updates on rules, regulations, holidays, and other activities.</li>
              <li>Strict adherence to the centre's rules and regulations is mandatory. Non-compliance may lead to rustication or debarment.</li>
              <li>If the installment is not paid by the due date, a late fee of <strong>₹100 per day</strong> will be charged as per the applicable rules.</li>
              <li>If the payment date does not match the receipt date, please report to admissions@zicazimapcmc.com</li>
            </ul>
          </div>

          <div className="signature-section">
            <div className="signature-box">
              <div className="signature-label">Student / Parent's Signature</div>
            </div>
            <div className="signature-box">
              <div className="signature-label">Authorised Signature & Stamp</div>
            </div>
          </div>
        </>
      ) : (
        // BETTERCODE Receipt Format
        <>
          <div className="header-section">
            <div className="logo-section">
              <img src={bettercodeLogo} alt="Bettercode Logo" />
            </div>
            <div className="header-info">
              <div className="receipt-title">Fee Receipt - For Student Use</div>
              <div className="brand-name">Bettercode Technologies</div>
              <div className="registered-name">Registered Name: BETTERCODE TECHNOLOGIES PVT LTD</div>
              <div className="gst-info">GST No.: 27AANCB1981H1ZE</div>
            </div>
          </div>

          <table className="info-section">
            <tbody>
              <tr>
                <td className="info-label">Student Full Name:</td>
                <td className="info-value">{data.studentName}</td>
              </tr>
              <tr>
                <td className="info-label">Course/Module:</td>
                <td className="info-value">{data.course}</td>
              </tr>
              <tr>
                <td className="info-label">Contact No.:</td>
                <td className="info-value">{data.contactNumber || '-'}</td>
              </tr>
              <tr>
                <td className="info-label">Receipt No.:</td>
                <td className="info-value">{data.receiptNumber}</td>
              </tr>
              <tr>
                <td className="info-label">Date:</td>
                <td className="info-value">{data.date}</td>
              </tr>
              <tr>
                <td className="info-label">Payment Mode:</td>
                <td className="info-value">{data.paymentMode}</td>
              </tr>
              <tr>
                <td className="info-label">Cheque/DD No.:</td>
                <td className="info-value">{data.chequeNumber || 'NA'}</td>
              </tr>
              <tr>
                <td className="info-label">Total No. of Installment:</td>
                <td className="info-value">{data.totalInstallments || '-'}</td>
              </tr>
              {data.totalInstallments > 0 && (
              <tr>
                <td className="info-label">Next Installment Due Date:</td>
                <td className="info-value">{data.nextInstallmentDueDate || '-'}</td>
              </tr>
              )}
            </tbody>
          </table>

          <table className="fee-section">
            <tbody>
              <tr>
                <td className="fee-label">Total Course Fees (INR):</td>
                <td className="fee-value">{data.totalCourseFees?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td className="fee-label">Balance Due:</td>
                <td className="fee-value">{data.balanceDue?.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
              </tr>
              <tr>
                <td className="fee-label">Amount Paid:</td>
                <td className="fee-value">{data.amountPaid?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td className="fee-label">CGST ( 9.00 % )</td>
                <td className="fee-value">{data.cgst?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
              <tr>
                <td className="fee-label">SGST ( 9.00 % )</td>
                <td className="fee-value">{data.sgst?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
              {typeof data.lateFeesAmount === 'number' && data.lateFeesAmount > 0 && (
                <tr>
                  <td className="fee-label">Late Fees (100 × {data.lateFeesAmount / 100} days)</td>
                  <td className="fee-value">{data.lateFeesAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
              )}
              <tr className="total-row">
                <td className="fee-label">Gross Total</td>
                <td className="fee-value">{data.grossTotal?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>

          <table className="remarks-section">
            <tbody>
              <tr>
                <td className="info-label">Remarks (if any):</td>
                <td className="info-value">{data.remarks || '-'}</td>
              </tr>
            </tbody>
          </table>

          <div className="terms-section">
            <div className="terms-title">Terms and Conditions:</div>
            <ul className="terms-list">
              <li>Fees must be paid in advance as per the centre's instructions. Non-payment of fees/installments may lead to termination of candidature from the particular course/module.</li>
              <li>Cheque or DD must be drawn in favour of BETTERCODE TECHNOLOGIES PRIVATE LIMITED.</li>
              <li>Fees once paid are non-refundable/non-transferable.</li>
              <li>Students must carry their Identity cards at all times in the centre. They will not be allowed to use facilities or attend classes without it.</li>
              <li>Students are expected to regularly check the notice board for updates on rules, regulations, holidays, and other activities.</li>
              <li>Strict adherence to the centre's rules and regulations is mandatory. Non-compliance may lead to rustication or debarment.</li>
              <li>If the installment is not paid by the due date, a late fee of <strong>₹100 per day</strong> will be charged as per the applicable rules.</li>
              <li>If the payment date does not match the receipt date, please report to info@bettercode.co.in</li>
            </ul>
          </div>

          <div className="signature-section">
            <div className="signature-box">
              <div className="signature-label">Student / Parent's Signature</div>
            </div>
            <div className="signature-box">
              <div className="signature-label">Authorised Signature & Stamp</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

ReceiptTemplate.displayName = 'ReceiptTemplate';
