export interface DocumentLineItem {
  itemName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface DocumentDraftSummary {
  documentId: string;
  originalFileName: string;
  vendorName: string;
  reference: string;
  totalAmount: number;
  confidenceLabel: string;
  ownerEmail: string;
  uploadedAt: string;
}

export interface SubmittedDocumentSummary {
  documentId: string;
  originalFileName: string;
  vendorName: string;
  reference: string;
  totalAmount: number;
  status: string;
  submittedByEmail: string;
  submittedAt: string;
  lastUpdatedAt: string;
  rejectionReason: string | null;
}

export interface PaginatedDocuments<TItem> {
  items: TItem[];
  totalCount: number;
  skip: number;
  take: number;
}

export interface DocumentDraftDetail {
  documentId: string;
  originalFileName: string;
  contentType: string;
  vendorName: string;
  reference: string;
  documentDate: string;
  dueDate: string;
  category: string;
  vendorTaxId: string | null;
  subtotal: number;
  vat: number;
  totalAmount: number;
  source: string;
  reviewedByStaff: string;
  confidenceLabel: string;
  hasImage: boolean;
  lineItems: DocumentLineItem[];
}

export interface UploadDocumentForReviewInput {
  fileName: string;
  contentType: string;
  base64Content: string;
}

export interface CreateManualDocumentDraftInput {
  vendorName: string;
  reference: string;
  documentDate: string;
  dueDate: string;
  category: string;
  vendorTaxId?: string | null;
  subtotal: number;
  vat: number;
  totalAmount: number;
  lineItems: DocumentLineItem[];
  imageFileName?: string | null;
  imageContentType?: string | null;
  base64ImageContent?: string | null;
}

export interface SubmitReviewedDocumentInput {
  documentId: string;
  originalFileName: string;
  contentType: string;
  vendorName: string;
  reference: string;
  documentDate: string;
  dueDate: string;
  category: string;
  vendorTaxId?: string | null;
  subtotal: number;
  vat: number;
  totalAmount: number;
  source?: string | null;
  confidenceLabel?: string | null;
  lineItems: DocumentLineItem[];
}

export interface DeleteDocumentDraftInput {
  documentId: string;
}

export interface SubmitReviewedDocumentPayload {
  documentId: string;
  status: string;
  submittedAt: string;
  vendorName: string;
  reference: string;
  totalAmount: number;
  dueDate: string;
  reviewedByStaff: string;
}
