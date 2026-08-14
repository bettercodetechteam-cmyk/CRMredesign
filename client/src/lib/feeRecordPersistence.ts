import { db } from '@/lib/firebase';
import { updateFeeRecord, usePostgresCrmRecords } from '@/lib/crmRecordsStore';

export async function patchFeeRecord(
  feeId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  if (usePostgresCrmRecords()) {
    await updateFeeRecord(feeId, patch);
    return;
  }
  const { updateDoc, doc } = await import('firebase/firestore');
  await updateDoc(doc(db, 'fees', feeId), patch);
}
