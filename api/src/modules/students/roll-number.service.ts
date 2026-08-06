import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface RollAllocationInput {
  courseId: string;
  rollPrefix: string;
  durationMonths: number;
  admissionDate: Date;
}

export interface AllocatedRoll {
  rollNo: string;
  rollYear: number;
  rollMonth: number;
  durationStartMonth: number;
  durationEndMonth: number;
  rollSeq: number;
}

type Tx = Prisma.TransactionClient;

/**
 * Allocates gapless roll numbers inside an existing DB transaction.
 * Format: {PREFIX}-{YY}{MM}-{START}-{END}-{SEQ}
 * Example: WD-2607-07-12-014
 */
@Injectable()
export class RollNumberService {
  async allocate(tx: Tx, input: RollAllocationInput): Promise<AllocatedRoll> {
    const rollYear = input.admissionDate.getUTCFullYear();
    const rollMonth = input.admissionDate.getUTCMonth() + 1;
    const durationStartMonth = rollMonth;
    const durationEndMonth = this.addMonthsClamped(
      rollMonth,
      Math.max(1, input.durationMonths) - 1,
    );

    const rows = await tx.$queryRaw<Array<{ last_seq: number }>>`
      INSERT INTO roll_number_counters (
        id,
        course_id,
        roll_year,
        roll_month,
        duration_start_month,
        duration_end_month,
        last_seq,
        updated_at
      )
      VALUES (
        gen_random_uuid(),
        ${input.courseId}::uuid,
        ${rollYear},
        ${rollMonth},
        ${durationStartMonth},
        ${durationEndMonth},
        1,
        NOW()
      )
      ON CONFLICT (course_id, roll_year, roll_month, duration_start_month, duration_end_month)
      DO UPDATE SET
        last_seq = roll_number_counters.last_seq + 1,
        updated_at = NOW()
      RETURNING last_seq
    `;

    const rollSeq = rows[0]?.last_seq;
    if (!rollSeq || rollSeq < 1) {
      throw new Error('Failed to allocate roll number sequence');
    }

    const yy = String(rollYear).slice(-2);
    const mm = String(rollMonth).padStart(2, '0');
    const start = String(durationStartMonth).padStart(2, '0');
    const end = String(durationEndMonth).padStart(2, '0');
    const seq = String(rollSeq).padStart(3, '0');
    const prefix = input.rollPrefix.trim().toUpperCase();

    return {
      rollNo: `${prefix}-${yy}${mm}-${start}-${end}-${seq}`,
      rollYear,
      rollMonth,
      durationStartMonth,
      durationEndMonth,
      rollSeq,
    };
  }

  /** Add N months to a 1–12 month, wrapping within the year cycle (m-m window). */
  private addMonthsClamped(startMonth: number, monthsToAdd: number): number {
    return ((startMonth - 1 + monthsToAdd) % 12) + 1;
  }
}
