/** Maximum number of installments supported (e.g. 29, 36). UI and Firestore fields use this limit. */
export const MAX_INSTALLMENTS = 36;

function pad(i: number): string {
  return String(i).padStart(2, "0");
}

export const INSTALLMENT_AMOUNT_FIELDS = Array.from(
  { length: MAX_INSTALLMENTS },
  (_, i) => `installment${pad(i + 1)}`
);

export const INSTALLMENT_RECEIPT_FIELDS = Array.from(
  { length: MAX_INSTALLMENTS },
  (_, i) => `installment${pad(i + 1)}ReceiptNumber`
);

export const INSTALLMENT_DUE_DATE_FIELDS = Array.from(
  { length: MAX_INSTALLMENTS },
  (_, i) => `installment${pad(i + 1)}DueDate`
);

export const INSTALLMENT_LATE_FEES_FIELDS = Array.from(
  { length: MAX_INSTALLMENTS },
  (_, i) => `installment${pad(i + 1)}LateFees`
);

/** Per-installment payment mode (from Mark Payment dialog). e.g. installment01PaymentMode */
export const INSTALLMENT_PAYMENT_MODE_FIELDS = Array.from(
  { length: MAX_INSTALLMENTS },
  (_, i) => `installment${pad(i + 1)}PaymentMode`
);
