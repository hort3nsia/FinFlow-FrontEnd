import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api-base-url.token';

interface GraphQlError {
  message: string;
}

interface GraphQlResponse<TData> {
  data?: TData;
  errors?: GraphQlError[];
}

export interface OcrLineItem {
  itemName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface DocumentTaxLine {
  taxType: string;
  rate: number | null;
  taxableAmount: number;
  taxAmount: number;
}

export interface DocumentCategoryOption {
  id: string;
  name: string;
  categoryType: string;
  isActive: boolean;
  displayOrder: number;
}

export interface DocumentReviewDraftResponse {
  documentId: string;
  originalFileName: string;
  contentType: string;
  hasPreviewImage?: boolean;
  previewImageDataUrl?: string | null;
  vendorName: string;
  reference: string;
  documentDate: string;
  category: string;
  vendorTaxId: string;
  subtotal: number;
  vat: number;
  totalAmount: number;
  currencyCode?: string;
  exchangeRate?: number;
  baseCurrencyCode?: string;
  totalAmountInBaseCurrency?: number;
  source: string;
  reviewedByStaff: string;
  confidenceLabel: string;
  processedPageCount?: number | null;
  lineItems: OcrLineItem[];
  taxLines?: DocumentTaxLine[];
}

export interface MyDocumentDraftResponse {
  documentId: string;
  originalFileName: string;
  vendorName: string;
  reference: string;
  totalAmount: number;
  category: string;
  source: string;
  confidenceLabel: string;
  ownerEmail: string;
  uploadedAt: string;
}

export interface MySubmittedDocumentResponse {
  documentId: string;
  originalFileName: string;
  vendorName: string;
  reference: string;
  totalAmount: number;
  category: string;
  source: string;
  status: string;
  submittedByEmail: string;
  submittedAt: string;
  lastUpdatedAt: string;
  rejectionReason: string | null;
}

export interface SubmittedDocumentDetailResponse {
  documentId: string;
  originalFileName: string;
  contentType: string;
  hasPreviewImage?: boolean;
  previewImageDataUrl?: string | null;
  vendorName: string;
  reference: string;
  documentDate: string;
  category: string;
  vendorTaxId: string;
  subtotal: number;
  vat: number;
  totalAmount: number;
  currencyCode?: string;
  exchangeRate?: number;
  baseCurrencyCode?: string;
  totalAmountInBaseCurrency?: number;
  source: string;
  status: string;
  submittedByEmail: string;
  submittedAt: string;
  lastUpdatedAt: string;
  rejectionReason: string | null;
  lineItems: OcrLineItem[];
  taxLines?: DocumentTaxLine[];
}

export interface SaveManualDraftInput {
  originalFileName: string;
  vendorName: string;
  reference: string;
  documentDate: string;
  category: string;
  vendorTaxId: string | null;
  subtotal: number;
  vat: number;
  totalAmount: number;
  lineItems: OcrLineItem[];
  taxLines?: DocumentTaxLine[];
}

export interface SaveReviewedOcrDraftInput {
  draftId: string;
  vendorName: string;
  reference: string;
  documentDate: string;
  category: string;
  vendorTaxId: string | null;
  subtotal: number;
  vat: number;
  totalAmount: number;
  confidenceLabel: string;
  lineItems: OcrLineItem[];
  taxLines?: DocumentTaxLine[];
}

export interface SubmitReviewedDocumentInput {
  draftId: string | null;
  originalFileName: string;
  vendorName: string;
  reference: string;
  documentDate: string;
  category: string;
  vendorTaxId: string | null;
  subtotal: number;
  vat: number;
  totalAmount: number;
  source: string | null;
  confidenceLabel: string | null;
  lineItems: OcrLineItem[];
  taxLines?: DocumentTaxLine[];
}

export interface SubmittedReviewedDocumentResponse {
  documentId: string;
  status: string;
  submittedAt: string;
  vendorName: string;
  reference: string;
  totalAmount: number;
  reviewedByStaff: string;
}

interface UploadDocumentForReviewMutationResponse {
  uploadDocumentForReview: DocumentReviewDraftResponse;
}

interface UploadManualAttachmentDraftMutationResponse {
  uploadManualAttachmentDraft: DocumentReviewDraftResponse;
}

interface MyDocumentDraftsQueryResponse {
  myDocumentDrafts: MyDocumentDraftResponse[];
}

interface MyDocumentDraftQueryResponse {
  myDocumentDraft: DocumentReviewDraftResponse;
}

interface MySubmittedDocumentsQueryResponse {
  mySubmittedDocuments: MySubmittedDocumentResponse[];
}

interface MySubmittedDocumentQueryResponse {
  mySubmittedDocument: SubmittedDocumentDetailResponse;
}

interface SubmitReviewedDocumentMutationResponse {
  submitReviewedDocument: SubmittedReviewedDocumentResponse;
}

interface SaveManualDraftMutationResponse {
  saveManualDraft: {
    draftId: string;
  };
}

interface SaveReviewedOcrDraftMutationResponse {
  saveReviewedOcrDraft: {
    draftId: string;
  };
}

interface MyCategoriesQueryResponse {
  myCategories: DocumentCategoryOption[];
}

const UPLOAD_DOCUMENT_FOR_REVIEW_MUTATION = `
  mutation UploadDocumentForReview($input: UploadDocumentForReviewInput!) {
    uploadDocumentForReview(input: $input) {
      documentId
      originalFileName
      contentType
      hasPreviewImage
      previewImageDataUrl
      vendorName
      reference
      documentDate
      category
      vendorTaxId
      subtotal
      vat
      totalAmount
      currencyCode
      exchangeRate
      baseCurrencyCode
      totalAmountInBaseCurrency
      source
      reviewedByStaff
      confidenceLabel
      processedPageCount
      lineItems {
        itemName
        quantity
        unitPrice
        total
      }
      taxLines {
        taxType
        rate
        taxableAmount
        taxAmount
      }
    }
  }
`;

const UPLOAD_MANUAL_ATTACHMENT_DRAFT_MUTATION = `
  mutation UploadManualAttachmentDraft($input: UploadManualAttachmentDraftInput!) {
    uploadManualAttachmentDraft(input: $input) {
      documentId
      originalFileName
      contentType
      hasPreviewImage
      previewImageDataUrl
      vendorName
      reference
      documentDate
      category
      vendorTaxId
      subtotal
      vat
      totalAmount
      currencyCode
      exchangeRate
      baseCurrencyCode
      totalAmountInBaseCurrency
      source
      reviewedByStaff
      confidenceLabel
      processedPageCount
      lineItems {
        itemName
        quantity
        unitPrice
        total
      }
      taxLines {
        taxType
        rate
        taxableAmount
        taxAmount
      }
    }
  }
`;

const MY_DOCUMENT_DRAFTS_QUERY = `
  query MyDocumentDrafts {
    myDocumentDrafts {
      documentId
      originalFileName
      vendorName
      reference
      totalAmount
      category
      source
      confidenceLabel
      ownerEmail
      uploadedAt
    }
  }
`;

const MY_DOCUMENT_DRAFT_QUERY = `
  query MyDocumentDraft($documentId: UUID!) {
    myDocumentDraft(documentId: $documentId) {
      documentId
      originalFileName
      contentType
      hasPreviewImage
      previewImageDataUrl
      vendorName
      reference
      documentDate
      category
      vendorTaxId
      subtotal
      vat
      totalAmount
      currencyCode
      exchangeRate
      baseCurrencyCode
      totalAmountInBaseCurrency
      source
      reviewedByStaff
      confidenceLabel
      processedPageCount
      lineItems {
        itemName
        quantity
        unitPrice
        total
      }
      taxLines {
        taxType
        rate
        taxableAmount
        taxAmount
      }
    }
  }
`;

const MY_SUBMITTED_DOCUMENTS_QUERY = `
  query MySubmittedDocuments {
    mySubmittedDocuments {
      documentId
      originalFileName
      vendorName
      reference
      totalAmount
      category
      source
      status
      submittedByEmail
      submittedAt
      lastUpdatedAt
      rejectionReason
    }
  }
`;

const SUBMIT_REVIEWED_DOCUMENT_MUTATION = `
  mutation SubmitReviewedDocument($input: SubmitReviewedDocumentInput!) {
    submitReviewedDocument(input: $input) {
      documentId
      status
      submittedAt
      vendorName
      reference
      totalAmount
      reviewedByStaff
    }
  }
`;

const MY_SUBMITTED_DOCUMENT_QUERY = `
  query MySubmittedDocument($documentId: UUID!) {
    mySubmittedDocument(documentId: $documentId) {
      documentId
      originalFileName
      contentType
      hasPreviewImage
      previewImageDataUrl
      vendorName
      reference
      documentDate
      category
      vendorTaxId
      subtotal
      vat
      totalAmount
      currencyCode
      exchangeRate
      baseCurrencyCode
      totalAmountInBaseCurrency
      source
      status
      submittedByEmail
      submittedAt
      lastUpdatedAt
      rejectionReason
      lineItems {
        itemName
        quantity
        unitPrice
        total
      }
      taxLines {
        taxType
        rate
        taxableAmount
        taxAmount
      }
    }
  }
`;

const SAVE_MANUAL_DRAFT_MUTATION = `
  mutation SaveManualDraft($input: SaveManualDraftInput!) {
    saveManualDraft(input: $input) {
      draftId
    }
  }
`;

const SAVE_REVIEWED_OCR_DRAFT_MUTATION = `
  mutation SaveReviewedOcrDraft($input: SaveReviewedOcrDraftInput!) {
    saveReviewedOcrDraft(input: $input) {
      draftId
    }
  }
`;

const MY_CATEGORIES_QUERY = `
  query MyCategories($includeInactive: Boolean!) {
    myCategories(includeInactive: $includeInactive) {
      id
      name
      categoryType
      isActive
      displayOrder
    }
  }
`;

const extractGraphQlMessage = (errors?: GraphQlError[]): string | null => errors?.[0]?.message ?? null;

@Injectable({
  providedIn: 'root',
})
export class DocumentsApiService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = inject(API_BASE_URL);
  private readonly utf8Decoder = new TextDecoder('utf-8', { fatal: true });

  private extractData<TData>(response: GraphQlResponse<TData>, missingMessage: string): TData {
    const graphQlMessage = extractGraphQlMessage(response.errors);
    if (graphQlMessage) {
      throw new Error(graphQlMessage);
    }

    if (!response.data) {
      throw new Error(missingMessage);
    }

    return response.data;
  }

  private mapTransportError(error: unknown): Observable<never> {
    if (error instanceof HttpErrorResponse) {
      const graphQlMessage = extractGraphQlMessage(error.error?.errors);
      return throwError(
        () => new Error(graphQlMessage ?? error.message ?? 'Unable to complete the request.'),
      );
    }

    if (error instanceof Error) {
      return throwError(() => error);
    }

    return throwError(() => new Error('Unable to complete the request.'));
  }

  private normalizeDocumentDraft(draft: DocumentReviewDraftResponse): DocumentReviewDraftResponse {
    return {
      ...draft,
      vendorName: this.normalizePossiblyMisencodedText(draft.vendorName),
      category: this.normalizePossiblyMisencodedText(draft.category),
      confidenceLabel: this.normalizePossiblyMisencodedText(draft.confidenceLabel),
      lineItems: draft.lineItems.map((item) => ({
        ...item,
        itemName: this.normalizePossiblyMisencodedText(item.itemName),
      })),
    };
  }

  private normalizeMyDocumentDraft(draft: MyDocumentDraftResponse): MyDocumentDraftResponse {
    return {
      ...draft,
      vendorName: this.normalizePossiblyMisencodedText(draft.vendorName),
      category: this.normalizePossiblyMisencodedText(draft.category),
      confidenceLabel: this.normalizePossiblyMisencodedText(draft.confidenceLabel),
    };
  }

  private normalizeSubmittedDocument(
    document: MySubmittedDocumentResponse,
  ): MySubmittedDocumentResponse {
    return {
      ...document,
      vendorName: this.normalizePossiblyMisencodedText(document.vendorName),
      category: this.normalizePossiblyMisencodedText(document.category),
      rejectionReason: document.rejectionReason
        ? this.normalizePossiblyMisencodedText(document.rejectionReason)
        : null,
    };
  }

  private normalizeSubmittedDocumentDetail(
    document: SubmittedDocumentDetailResponse,
  ): SubmittedDocumentDetailResponse {
    return {
      ...document,
      vendorName: this.normalizePossiblyMisencodedText(document.vendorName),
      category: this.normalizePossiblyMisencodedText(document.category),
      rejectionReason: document.rejectionReason
        ? this.normalizePossiblyMisencodedText(document.rejectionReason)
        : null,
      lineItems: document.lineItems.map((item) => ({
        ...item,
        itemName: this.normalizePossiblyMisencodedText(item.itemName),
      })),
    };
  }

  private normalizeSubmittedReview(
    document: SubmittedReviewedDocumentResponse,
  ): SubmittedReviewedDocumentResponse {
    return {
      ...document,
      vendorName: this.normalizePossiblyMisencodedText(document.vendorName),
    };
  }

  private normalizePossiblyMisencodedText(value: string | null | undefined): string {
    if (!value) {
      return value ?? '';
    }

    if (!this.looksMisencoded(value)) {
      return value;
    }

    try {
      const bytes = Uint8Array.from(value, (char) => char.charCodeAt(0) & 0xff);
      const repaired = this.utf8Decoder.decode(bytes);

      return this.encodingNoiseScore(repaired) < this.encodingNoiseScore(value) ? repaired : value;
    } catch {
      return value;
    }
  }

  private looksMisencoded(value: string): boolean {
    return /[\u0080-\u009f]|(?:Ã.|Â.|Æ.|Ä.|áº.|á».)/.test(value);
  }

  private encodingNoiseScore(value: string): number {
    const controlChars = value.match(/[\u0080-\u009f]/g)?.length ?? 0;
    const mojibakePairs = value.match(/(?:Ã.|Â.|Æ.|Ä.|áº.|á».)/g)?.length ?? 0;
    const replacementChars = value.match(/�/g)?.length ?? 0;

    return controlChars * 3 + mojibakePairs * 2 + replacementChars * 5;
  }

  uploadDocumentForReview(
    fileName: string,
    contentType: string,
    base64Content: string,
  ): Observable<DocumentReviewDraftResponse> {
    return this.http
      .post<GraphQlResponse<UploadDocumentForReviewMutationResponse>>(this.endpoint, {
        query: UPLOAD_DOCUMENT_FOR_REVIEW_MUTATION,
        variables: {
          input: {
            fileName,
            contentType,
            base64Content,
          },
        },
      })
      .pipe(
        map((response) => {
          const draft = this.extractData(
            response,
            'UploadDocumentForReview response did not include draft data.',
          ).uploadDocumentForReview;

          if (!draft) {
            throw new Error('UploadDocumentForReview response did not include draft data.');
          }

          return this.normalizeDocumentDraft(draft);
        }),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  getMyDocumentDrafts(): Observable<MyDocumentDraftResponse[]> {
    return this.http
      .post<GraphQlResponse<MyDocumentDraftsQueryResponse>>(this.endpoint, {
        query: MY_DOCUMENT_DRAFTS_QUERY,
      })
      .pipe(
        map((response) =>
          this.extractData(
            response,
            'MyDocumentDrafts response did not include draft data.',
          ).myDocumentDrafts.map((draft) => this.normalizeMyDocumentDraft(draft)),
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  getMyDocumentDraft(documentId: string): Observable<DocumentReviewDraftResponse> {
    return this.http
      .post<GraphQlResponse<MyDocumentDraftQueryResponse>>(this.endpoint, {
        query: MY_DOCUMENT_DRAFT_QUERY,
        variables: {
          documentId,
        },
      })
      .pipe(
        map((response) => {
          const draft = this.extractData(
            response,
            'MyDocumentDraft response did not include draft data.',
          ).myDocumentDraft;

          if (!draft) {
            throw new Error('MyDocumentDraft response did not include draft data.');
          }

          return this.normalizeDocumentDraft(draft);
        }),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  getMySubmittedDocuments(): Observable<MySubmittedDocumentResponse[]> {
    return this.http
      .post<GraphQlResponse<MySubmittedDocumentsQueryResponse>>(this.endpoint, {
        query: MY_SUBMITTED_DOCUMENTS_QUERY,
      })
      .pipe(
        map((response) =>
          this.extractData(
            response,
            'MySubmittedDocuments response did not include submission history.',
          ).mySubmittedDocuments.map((item) => this.normalizeSubmittedDocument(item)),
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  uploadManualAttachmentDraft(
    fileName: string,
    contentType: string,
    base64Content: string,
  ): Observable<DocumentReviewDraftResponse> {
    return this.http
      .post<GraphQlResponse<UploadManualAttachmentDraftMutationResponse>>(this.endpoint, {
        query: UPLOAD_MANUAL_ATTACHMENT_DRAFT_MUTATION,
        variables: {
          input: {
            fileName,
            contentType,
            base64Content,
          },
        },
      })
      .pipe(
        map((response) => {
          const draft = this.extractData(
            response,
            'UploadManualAttachmentDraft response did not include draft data.',
          ).uploadManualAttachmentDraft;

          if (!draft) {
            throw new Error('UploadManualAttachmentDraft response did not include draft data.');
          }

          return this.normalizeDocumentDraft(draft);
        }),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  getMySubmittedDocument(documentId: string): Observable<SubmittedDocumentDetailResponse> {
    return this.http
      .post<GraphQlResponse<MySubmittedDocumentQueryResponse>>(this.endpoint, {
        query: MY_SUBMITTED_DOCUMENT_QUERY,
        variables: {
          documentId,
        },
      })
      .pipe(
        map((response) => {
          const submitted = this.extractData(
            response,
            'MySubmittedDocument response did not include submitted document data.',
          ).mySubmittedDocument;

          if (!submitted) {
            throw new Error('MySubmittedDocument response did not include submitted document data.');
          }

          return this.normalizeSubmittedDocumentDetail(submitted);
        }),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  getMyCategories(includeInactive = false): Observable<DocumentCategoryOption[]> {
    return this.http
      .post<GraphQlResponse<MyCategoriesQueryResponse>>(this.endpoint, {
        query: MY_CATEGORIES_QUERY,
        variables: {
          includeInactive,
        },
      })
      .pipe(
        map((response) =>
          this.extractData(
            response,
            'MyCategories response did not include category data.',
          ).myCategories.map((category) => ({
            ...category,
            name: this.normalizePossiblyMisencodedText(category.name),
          })),
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  saveManualDraft(input: SaveManualDraftInput): Observable<string> {
    return this.http
      .post<GraphQlResponse<SaveManualDraftMutationResponse>>(this.endpoint, {
        query: SAVE_MANUAL_DRAFT_MUTATION,
        variables: {
          input,
        },
      })
      .pipe(
        map((response) => {
          const savedDraft = this.extractData(
            response,
            'SaveManualDraft response did not include draft data.',
          ).saveManualDraft;

          if (!savedDraft?.draftId) {
            throw new Error('SaveManualDraft response did not include draft data.');
          }

          return savedDraft.draftId;
        }),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  saveReviewedOcrDraft(input: SaveReviewedOcrDraftInput): Observable<string> {
    return this.http
      .post<GraphQlResponse<SaveReviewedOcrDraftMutationResponse>>(this.endpoint, {
        query: SAVE_REVIEWED_OCR_DRAFT_MUTATION,
        variables: {
          input,
        },
      })
      .pipe(
        map((response) => {
          const savedDraft = this.extractData(
            response,
            'SaveReviewedOcrDraft response did not include draft data.',
          ).saveReviewedOcrDraft;

          if (!savedDraft?.draftId) {
            throw new Error('SaveReviewedOcrDraft response did not include draft data.');
          }

          return savedDraft.draftId;
        }),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  submitReviewedDocument(
    draft: SubmitReviewedDocumentInput,
  ): Observable<SubmittedReviewedDocumentResponse> {
    return this.http
      .post<GraphQlResponse<SubmitReviewedDocumentMutationResponse>>(this.endpoint, {
        query: SUBMIT_REVIEWED_DOCUMENT_MUTATION,
        variables: {
          input: draft,
        },
      })
      .pipe(
        map((response) => {
          const submitted = this.extractData(
            response,
            'SubmitReviewedDocument response did not include submission data.',
          ).submitReviewedDocument;

          if (!submitted) {
            throw new Error('SubmitReviewedDocument response did not include submission data.');
          }

          return this.normalizeSubmittedReview(submitted);
        }),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }
}
