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

export interface VendorResponse {
  vendorId: string;
  taxCode: string;
  name: string;
  isVerified: boolean;
  verifiedByMembershipId: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  linkedDocumentsCount?: number;
}

export interface CreateVendorInput {
  taxCode: string;
  name: string;
}

export interface VerifyVendorInput {
  vendorId: string;
}

export interface VendorLinkedDocumentResponse {
  documentId: string;
  reference: string;
  category: string;
  status: string;
  totalAmount: number;
  currencyCode: string;
  documentDate: string;
}

export interface VendorDetailResponse {
  vendorId: string;
  linkedDocumentsCount: number;
  recentDocuments: VendorLinkedDocumentResponse[];
}

interface MyVendorsQueryResponse {
  myVendors: VendorResponse[];
}

interface VendorDetailQueryResponse {
  vendorDetail: VendorDetailResponse;
}

interface CreateVendorMutationResponse {
  createVendor: VendorResponse;
}

interface VerifyVendorMutationResponse {
  verifyVendor: VendorResponse;
}

const VENDOR_FIELDS = `
  vendorId
  taxCode
  name
  isVerified
  verifiedByMembershipId
  verifiedAt
  createdAt
  updatedAt
`;

const MY_VENDORS_QUERY = `
  query MyVendors($isVerified: Boolean) {
    myVendors(isVerified: $isVerified) {${VENDOR_FIELDS}
      linkedDocumentsCount
    }
  }
`;

const CREATE_VENDOR_MUTATION = `
  mutation CreateVendor($input: CreateVendorInput!) {
    createVendor(input: $input) {${VENDOR_FIELDS}}
  }
`;

const VERIFY_VENDOR_MUTATION = `
  mutation VerifyVendor($input: VerifyVendorInput!) {
    verifyVendor(input: $input) {${VENDOR_FIELDS}}
  }
`;

const VENDOR_DETAIL_QUERY = `
  query VendorDetail($vendorId: UUID!) {
    vendorDetail(vendorId: $vendorId) {
      vendorId
      linkedDocumentsCount
      recentDocuments {
        documentId
        reference
        category
        status
        totalAmount
        currencyCode
        documentDate
      }
    }
  }
`;

const extractGraphQlMessage = (errors?: GraphQlError[]): string | null =>
  errors?.[0]?.message ?? null;

@Injectable({ providedIn: 'root' })
export class VendorsApiService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = inject(API_BASE_URL);

  /**
   * Fetch all vendors visible to the current tenant. Filter by verification
   * state via `isVerified` (omit for "all").
   */
  getMyVendors(isVerified: boolean | null = null): Observable<VendorResponse[]> {
    return this.http
      .post<GraphQlResponse<MyVendorsQueryResponse>>(this.endpoint, {
        query: MY_VENDORS_QUERY,
        variables: { isVerified },
      })
      .pipe(
        map((response) =>
          this.extractData(response, 'MyVendors query did not include vendor data.').myVendors,
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  getVendorDetail(vendorId: string): Observable<VendorDetailResponse> {
    return this.http
      .post<GraphQlResponse<VendorDetailQueryResponse>>(this.endpoint, {
        query: VENDOR_DETAIL_QUERY,
        variables: { vendorId },
      })
      .pipe(
        map((response) =>
          this.extractData(response, 'VendorDetail query did not return data.').vendorDetail,
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  createVendor(input: CreateVendorInput): Observable<VendorResponse> {
    return this.http
      .post<GraphQlResponse<CreateVendorMutationResponse>>(this.endpoint, {
        query: CREATE_VENDOR_MUTATION,
        variables: { input },
      })
      .pipe(
        map((response) =>
          this.extractData(response, 'CreateVendor mutation did not return data.').createVendor,
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  verifyVendor(input: VerifyVendorInput): Observable<VendorResponse> {
    return this.http
      .post<GraphQlResponse<VerifyVendorMutationResponse>>(this.endpoint, {
        query: VERIFY_VENDOR_MUTATION,
        variables: { input },
      })
      .pipe(
        map((response) =>
          this.extractData(response, 'VerifyVendor mutation did not return data.').verifyVendor,
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  private extractData<TData>(
    response: GraphQlResponse<TData>,
    missingMessage: string,
  ): TData {
    const message = extractGraphQlMessage(response.errors);
    if (message) {
      throw new Error(message);
    }
    if (!response.data) {
      throw new Error(missingMessage);
    }
    return response.data;
  }

  private mapTransportError(error: unknown): Observable<never> {
    if (error instanceof HttpErrorResponse) {
      const message = extractGraphQlMessage(error.error?.errors);
      return throwError(
        () => new Error(message ?? error.message ?? 'Unable to complete the request.'),
      );
    }
    if (error instanceof Error) {
      return throwError(() => error);
    }
    return throwError(() => new Error('Unable to complete the request.'));
  }
}
