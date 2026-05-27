import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { CurrentWorkspaceFacade } from '../../dashboard/data/current-workspace.facade';
import { VendorsApiService } from '../data/vendors-api.service';
import { VendorsPageComponent } from './vendors-page.component';

describe('VendorsPageComponent', () => {
  const workspaceState = signal({
    workspace: { tenantId: 'tenant-1' } as any,
    loading: false,
    error: null,
  });
  const vendorsApi = {
    getMyVendors: vi.fn(),
    getVendorDetail: vi.fn(),
    createVendor: vi.fn(),
    verifyVendor: vi.fn(),
  };
  const vendors = [
    {
      vendorId: 'vendor-1',
      taxCode: '0312345678',
      name: 'BÁCH HÓA XANH',
      isVerified: true,
      verifiedByMembershipId: 'membership-manager',
      verifiedAt: '2026-05-18T10:00:00Z',
      createdAt: '2026-05-17T09:00:00Z',
      updatedAt: '2026-05-18T10:00:00Z',
      linkedDocumentsCount: 1,
    },
    {
      vendorId: 'vendor-2',
      taxCode: '0301234567',
      name: 'Highlands Coffee',
      isVerified: false,
      verifiedByMembershipId: null,
      verifiedAt: null,
      createdAt: '2026-05-20T09:00:00Z',
      updatedAt: '2026-05-20T09:00:00Z',
      linkedDocumentsCount: 0,
    },
  ];
  const vendorDetail = {
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
        documentDate: '2026-05-17T00:00:00Z',
      },
    ],
  };

  const createComponent = (): ComponentFixture<VendorsPageComponent> => {
    const fixture = TestBed.createComponent(VendorsPageComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    vendorsApi.getMyVendors.mockReset();
    vendorsApi.getVendorDetail.mockReset();
    vendorsApi.createVendor.mockReset();
    vendorsApi.verifyVendor.mockReset();
    vendorsApi.getMyVendors.mockReturnValue(of(vendors));
    vendorsApi.getVendorDetail.mockReturnValue(of(vendorDetail));
    vendorsApi.verifyVendor.mockReturnValue(of({ ...vendors[1], isVerified: true }));

    TestBed.configureTestingModule({
      imports: [VendorsPageComponent],
      providers: [
        { provide: VendorsApiService, useValue: vendorsApi },
        { provide: CurrentWorkspaceFacade, useValue: { state: workspaceState.asReadonly() } },
      ],
    });
  });

  it('renders the MagicPath vendor workspace and automatically opens the first inspector', () => {
    const fixture = createComponent();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Danh mục nhà cung cấp');
    expect(text).toContain('Tổng nhà cung cấp');
    expect(text).toContain('Đã xác thực');
    expect(text).toContain('Chưa xác thực');
    expect(text).toContain('Mã số thuế');
    expect(text).toContain('Trạng thái');
    expect(text).toContain('Tài liệu');
    expect(text).toContain('Thông tin');
    expect(text).toContain('Lịch sử');
    expect(text).toContain('Chất lượng dữ liệu');
    expect(text).toContain('BÁCH HÓA XANH');
    expect(text).toContain('1 tài liệu');
    expect(text).not.toContain('Merchant');
    expect(text).not.toContain('merchant');
    expect(text).not.toContain('Finance Manager');
    expect(vendorsApi.getMyVendors).toHaveBeenCalledWith(null);
    expect(vendorsApi.getVendorDetail).toHaveBeenCalledWith('vendor-1');
  });

  it('shows linked documents returned by vendor detail and derived lifecycle history in inspector tabs', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    component.setInspectorTab('documents');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('INV-2026-0041');
    expect(fixture.nativeElement.textContent).toContain('₫187.954');

    component.setInspectorTab('audit');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Đã tạo nhà cung cấp');
    expect(fixture.nativeElement.textContent).toContain('Đã xác thực nhà cung cấp');
  });

  it('validates tax codes using the numeric format accepted by the backend domain', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    component.openAddModal();
    component.addTaxCode.set('0102536167-001');
    fixture.detectChanges();

    expect(component.addTaxCodeValid()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('chỉ gồm 10 đến 14 chữ số');
  });

  it('reuses loaded vendor details when switching back to a previous merchant', () => {
    const secondVendorDetail = {
      vendorId: 'vendor-2',
      linkedDocumentsCount: 0,
      recentDocuments: [],
    };
    vendorsApi.getVendorDetail.mockImplementation((vendorId: string) =>
      of(vendorId === 'vendor-2' ? secondVendorDetail : vendorDetail),
    );

    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    expect(vendorsApi.getVendorDetail).toHaveBeenCalledTimes(1);

    component.selectVendor('vendor-2');
    fixture.detectChanges();

    expect(vendorsApi.getVendorDetail).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('Highlands Coffee');

    component.selectVendor('vendor-1');
    fixture.detectChanges();

    expect(vendorsApi.getVendorDetail).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('BÁCH HÓA XANH');
  });
});
