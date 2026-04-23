import { gql } from 'apollo-angular';

export const MY_DOCUMENT_DRAFTS_QUERY = gql`
  query MyDocumentDrafts($skip: Int!, $take: Int!) {
    myDocumentDrafts(skip: $skip, take: $take) {
      items {
        documentId
        originalFileName
        vendorName
        reference
        totalAmount
        confidenceLabel
        ownerEmail
        uploadedAt
      }
      totalCount
      skip
      take
    }
  }
`;

export const MY_DOCUMENT_DRAFT_QUERY = gql`
  query MyDocumentDraft($documentId: UUID!) {
    myDocumentDraft(documentId: $documentId) {
      documentId
      originalFileName
      contentType
      vendorName
      reference
      documentDate
      dueDate
      category
      vendorTaxId
      subtotal
      vat
      totalAmount
      source
      reviewedByStaff
      confidenceLabel
      hasImage
      lineItems {
        itemName
        quantity
        unitPrice
        total
      }
    }
  }
`;

export const MY_SUBMITTED_DOCUMENTS_QUERY = gql`
  query MySubmittedDocuments($skip: Int!, $take: Int!) {
    mySubmittedDocuments(skip: $skip, take: $take) {
      items {
        documentId
        originalFileName
        vendorName
        reference
        totalAmount
        status
        submittedByEmail
        submittedAt
        lastUpdatedAt
        rejectionReason
      }
      totalCount
      skip
      take
    }
  }
`;

const DOCUMENT_DRAFT_DETAIL_SELECTION = `
  documentId
  originalFileName
  contentType
  vendorName
  reference
  documentDate
  dueDate
  category
  vendorTaxId
  subtotal
  vat
  totalAmount
  source
  reviewedByStaff
  confidenceLabel
  hasImage
  lineItems {
    itemName
    quantity
    unitPrice
    total
  }
`;

export const UPLOAD_DOCUMENT_FOR_REVIEW_MUTATION = gql`
  mutation UploadDocumentForReview($input: UploadDocumentForReviewInput!) {
    uploadDocumentForReview(input: $input) {
      ${DOCUMENT_DRAFT_DETAIL_SELECTION}
    }
  }
`;

export const CREATE_MANUAL_DOCUMENT_DRAFT_MUTATION = gql`
  mutation CreateManualDocumentDraft($input: CreateManualDocumentDraftInput!) {
    createManualDocumentDraft(input: $input) {
      ${DOCUMENT_DRAFT_DETAIL_SELECTION}
    }
  }
`;

export const SUBMIT_REVIEWED_DOCUMENT_MUTATION = gql`
  mutation SubmitReviewedDocument($input: SubmitReviewedDocumentInput!) {
    submitReviewedDocument(input: $input) {
      documentId
      status
      submittedAt
      vendorName
      reference
      totalAmount
      dueDate
      reviewedByStaff
    }
  }
`;

export const DELETE_DOCUMENT_DRAFT_MUTATION = gql`
  mutation DeleteDocumentDraft($input: DeleteDocumentDraftInput!) {
    deleteDocumentDraft(input: $input)
  }
`;
