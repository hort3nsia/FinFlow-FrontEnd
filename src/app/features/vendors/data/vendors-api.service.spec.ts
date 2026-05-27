import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { VendorsApiService } from './vendors-api.service';

describe('VendorsApiService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('returns linked document counts with the vendor catalog', () => {
    const service = TestBed.inject(VendorsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service.getMyVendors(null).subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('linkedDocumentsCount');
    request.flush({
      data: {
        myVendors: [
          {
            vendorId: 'vendor-1',
            taxCode: '0312345678',
            name: 'BÁCH HÓA XANH',
            isVerified: true,
            verifiedByMembershipId: null,
            verifiedAt: null,
            createdAt: '2026-05-17T09:00:00Z',
            updatedAt: '2026-05-17T09:00:00Z',
            linkedDocumentsCount: 1,
          },
        ],
      },
    });

    expect((result as { linkedDocumentsCount: number }[])[0].linkedDocumentsCount).toBe(1);
    httpTesting.verify();
  });

  it('returns vendor detail with linked documents from GraphQL', () => {
    const service = TestBed.inject(VendorsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service.getVendorDetail('vendor-1').subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('vendorDetail');
    expect(request.request.body.variables).toEqual({ vendorId: 'vendor-1' });
    request.flush({
      data: {
        vendorDetail: {
          vendorId: 'vendor-1',
          linkedDocumentsCount: 1,
          recentDocuments: [
            {
              documentId: 'document-1',
              reference: 'INV-2026-0041',
              category: 'Thực phẩm',
              status: 'Approved',
              totalAmount: 187954,
              currencyCode: 'VND',
              documentDate: '2026-05-17',
            },
          ],
        },
      },
    });

    expect(result).toEqual({
      vendorId: 'vendor-1',
      linkedDocumentsCount: 1,
      recentDocuments: [
        {
          documentId: 'document-1',
          reference: 'INV-2026-0041',
          category: 'Thực phẩm',
          status: 'Approved',
          totalAmount: 187954,
          currencyCode: 'VND',
          documentDate: '2026-05-17',
        },
      ],
    });
    httpTesting.verify();
  });
});
