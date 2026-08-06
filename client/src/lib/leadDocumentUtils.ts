import { doc, type DocumentReference, type Firestore } from 'firebase/firestore';
import { isWebsiteEnquiryLead, type LeadRecord } from './centreDataStore';

export type LeadFirestoreTarget = {
  collectionName: 'leads' | 'enquiries';
  documentId: string;
  isWebsiteEnquiry: boolean;
};

export function getEnquiryDocumentId(leadOrId: string | LeadRecord): string {
  if (typeof leadOrId === 'string') {
    return leadOrId.replace(/^enquiry_/, '');
  }
  return String(leadOrId._enquiryId ?? String(leadOrId.id).replace(/^enquiry_/, ''));
}

export function resolveLeadFirestoreTarget(
  leadOrId: string | LeadRecord,
  leadRecord?: Partial<LeadRecord> | null
): LeadFirestoreTarget {
  const id = typeof leadOrId === 'string' ? leadOrId : String(leadOrId.id);
  const lead = (typeof leadOrId === 'object' ? leadOrId : leadRecord) as LeadRecord | undefined;
  const isEnquiry = lead ? isWebsiteEnquiryLead(lead) : id.startsWith('enquiry_');

  if (isEnquiry) {
    return {
      collectionName: 'enquiries',
      documentId: getEnquiryDocumentId(id),
      isWebsiteEnquiry: true,
    };
  }

  return {
    collectionName: 'leads',
    documentId: id,
    isWebsiteEnquiry: false,
  };
}

export function getLeadDocRef(
  firestore: Firestore,
  leadOrId: string | LeadRecord,
  leadRecord?: Partial<LeadRecord> | null
): DocumentReference {
  const target = resolveLeadFirestoreTarget(leadOrId, leadRecord);
  return doc(firestore, target.collectionName, target.documentId);
}

/** Map CRM lead field names to website `enquiries` collection fields. */
export function mapLeadFieldsToEnquiryUpdate(
  leadData: Record<string, unknown>
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};

  if (leadData.leadName !== undefined) updates.name = leadData.leadName;
  if (leadData.contact !== undefined) updates.phone = leadData.contact;
  if (leadData.emailId !== undefined) updates.email = leadData.emailId;
  if (leadData.course !== undefined) updates.course = leadData.course;
  if (leadData.status !== undefined) updates.status = leadData.status;
  if (leadData.remark !== undefined) updates.message = leadData.remark;
  if (leadData.enquiryDate !== undefined) updates.submittedAt = leadData.enquiryDate;

  return updates;
}
