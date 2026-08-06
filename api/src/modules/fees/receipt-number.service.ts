import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface ReceiptAllocationInput {
  centreId: string;
  centreCode: string;
  paidAt: Date;
}

export interface AllocatedReceipt {
  receiptNo: string;
  yearMonth: number;
  seq: number;
}

type Tx = Prisma.TransactionClient;

/**
 * Allocates gapless receipt numbers per centre per calendar month.
 * Format: RCP-{CENTRE}-{YY}{MM}-{SEQ}
 * Example: RCP-PUNE-2607-000128
 */
@Injectable()
export class ReceiptNumberService {
  async allocate(
    tx: Tx,
    input: ReceiptAllocationInput,
  ): Promise<AllocatedReceipt> {
    const year = input.paidAt.getUTCFullYear();
    const month = input.paidAt.getUTCMonth() + 1;
    const yearMonth = year * 100 + month;

    const rows = await tx.$queryRaw<Array<{ last_seq: number }>>`
      INSERT INTO receipt_counters (
        id,
        centre_id,
        year_month,
        last_seq,
        updated_at
      )
      VALUES (
        gen_random_uuid(),
        ${input.centreId}::uuid,
        ${yearMonth},
        1,
        NOW()
      )
      ON CONFLICT (centre_id, year_month)
      DO UPDATE SET
        last_seq = receipt_counters.last_seq + 1,
        updated_at = NOW()
      RETURNING last_seq
    `;

    const seq = rows[0]?.last_seq;
    if (!seq || seq < 1) {
      throw new Error('Failed to allocate receipt number sequence');
    }

    const yy = String(year).slice(-2);
    const mm = String(month).padStart(2, '0');
    const padded = String(seq).padStart(6, '0');
    const code = input.centreCode.trim().toUpperCase();

    return {
      receiptNo: `RCP-${code}-${yy}${mm}-${padded}`,
      yearMonth,
      seq,
    };
  }
}
