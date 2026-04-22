export interface ReviewedLineItem {
  name: string;
  qty: string;
  unitPrice: string;
  total: string;
}

export interface ReviewedDocumentDraft {
  documentId: string;
  vendor: string;
  reference: string;
  documentDate: string;
  dueDate: string;
  category: string;
  vendorTaxId: string;
  subtotal: string;
  vat: string;
  totalAmount: string;
  source: string;
  originalFileName: string;
  contentType: string;
  ocrPrecision: string;
  lineItems: ReviewedLineItem[];
  reviewedByStaffEmail: string;
}
