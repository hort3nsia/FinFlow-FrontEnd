import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { CurrentWorkspaceFacade } from '../../dashboard/data/current-workspace.facade';
import { DepartmentsApiService } from '../data/departments-api.service';
import { DepartmentsPageComponent } from './departments-page.component';

describe('DepartmentsPageComponent', () => {
  const workspaceState = signal({
    workspace: {
      tenantId: 'tenant-1',
      tenantName: 'Meridian Corp',
    } as any,
    loading: false,
    error: null,
  });
  const departmentsApi = {
    getDepartmentWorkspace: vi.fn(),
    createDepartment: vi.fn(),
    renameDepartment: vi.fn(),
    deactivateDepartment: vi.fn(),
    activateDepartment: vi.fn(),
  };

  const workspace = {
    summary: {
      totalDepartments: 3,
      totalMembers: 42,
      activeDepartments: 3,
      selectedDepartmentId: 'department-engineering',
    },
    tree: [
      {
        id: 'department-root',
        name: 'Meridian Corp',
        parentId: null,
        isActive: true,
        memberCount: 42,
        childCount: 1,
        budgetUtilizationPct: 77,
        children: [
          {
            id: 'department-engineering',
            name: 'Kỹ thuật',
            parentId: 'department-root',
            isActive: true,
            memberCount: 38,
            childCount: 0,
            budgetUtilizationPct: 85,
            children: [],
          },
        ],
      },
    ],
    selectedDepartment: {
      id: 'department-engineering',
      name: 'Kỹ thuật',
      parentName: 'Meridian Corp',
      departmentCode: 'DEPT-202',
      status: 'Active',
      createdAt: '2026-01-15T00:00:00Z',
      memberCount: 38,
      subDepartmentCount: 2,
      expenseVolumeAmount: 142800,
      expenseCount: 84,
      manager: {
        membershipId: 'membership-manager',
        fullName: 'Sarah Kimani',
        email: 'sarah.kimani@meridian.com',
        role: 'Manager',
        initials: 'SK',
      },
      budgetSnapshot: {
        periodLabel: 'Tháng 5/2026',
        allocatedAmount: 50000000,
        spentAmount: 38200000,
        remainingAmount: 11800000,
        utilizationPct: 76.4,
      },
      subDepartments: [
        {
          id: 'department-platform',
          name: 'Nền tảng',
          memberCount: 12,
          budgetUtilizationPct: 64,
        },
      ],
      membersPreview: [
        {
          membershipId: 'membership-manager',
          fullName: 'Sarah Kimani',
          email: 'sarah.kimani@meridian.com',
          role: 'Manager',
          initials: 'SK',
          isActive: true,
        },
        {
          membershipId: 'membership-engineer',
          fullName: 'Alex Park',
          email: 'alex.park@meridian.com',
          role: 'Staff',
          initials: 'AP',
          isActive: true,
        },
      ],
      recentActivity: [
        {
          id: 'activity-1',
          title: 'INV-2026-0041 đã gửi',
          description: 'BÁCH HÓA XANH',
          actorName: 'Alex Park',
          tone: 'info',
          amount: 187954,
        },
      ],
    },
  };

  const createComponent = (): ComponentFixture<DepartmentsPageComponent> => {
    const fixture = TestBed.createComponent(DepartmentsPageComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    departmentsApi.getDepartmentWorkspace.mockReset();
    departmentsApi.createDepartment.mockReset();
    departmentsApi.renameDepartment.mockReset();
    departmentsApi.deactivateDepartment.mockReset();
    departmentsApi.activateDepartment.mockReset();
    departmentsApi.getDepartmentWorkspace.mockReturnValue(of(workspace));
    departmentsApi.renameDepartment.mockReturnValue(
      of({
        id: 'department-engineering',
        name: 'Kỹ thuật nền tảng',
        parentId: 'department-root',
        isActive: true,
      }),
    );
    departmentsApi.deactivateDepartment.mockReturnValue(of(true));
    departmentsApi.activateDepartment.mockReturnValue(
      of({
        id: 'department-engineering',
        name: 'Kỹ thuật',
        parentId: 'department-root',
        isActive: true,
      }),
    );

    TestBed.configureTestingModule({
      imports: [DepartmentsPageComponent],
      providers: [
        { provide: DepartmentsApiService, useValue: departmentsApi },
        { provide: CurrentWorkspaceFacade, useValue: { state: workspaceState.asReadonly() } },
      ],
    });
  });

  it('renders the MagicPath department workspace hierarchy and detail panels', () => {
    const fixture = createComponent();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Phòng ban');
    expect(text).toContain('Cấu trúc tổ chức');
    expect(
      fixture.nativeElement.querySelector('input[type="search"]').getAttribute('placeholder'),
    ).toContain('Tìm phòng ban');
    expect(text).toContain('Tạo phòng ban con');
    expect(text).toContain('Tổng quan ngân sách');
    expect(text).toContain('Thông tin phòng ban');
    expect(text).toContain('Bối cảnh phòng ban');
    expect(text).toContain('Hoạt động gần đây');
    expect(text).toContain('Kỹ thuật');
    expect(text).toContain('Sarah Kimani');
    expect(text).toContain('Nền tảng');
    expect(departmentsApi.getDepartmentWorkspace).toHaveBeenCalledWith(null);
  });

  it('does not switch back to full-page loading while selected department details are refreshing', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as any;
    const pendingSelection = new Subject<typeof workspace>();

    expect(component.isLoading()).toBe(false);

    departmentsApi.getDepartmentWorkspace.mockReturnValue(pendingSelection.asObservable());
    component.selectDepartment('department-root');
    fixture.detectChanges();

    expect(component.isLoading()).toBe(false);
    expect(departmentsApi.getDepartmentWorkspace).toHaveBeenCalledWith(null);
  });

  it('updates the selected department name immediately after rename succeeds', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    component.openRenameDepartmentModal();
    component.updateDepartmentModalName('Kỹ thuật nền tảng');
    component.submitDepartmentModal();
    fixture.detectChanges();

    expect(departmentsApi.renameDepartment).toHaveBeenCalledWith(
      'department-engineering',
      'Kỹ thuật nền tảng',
    );
    expect(fixture.nativeElement.textContent).toContain('Kỹ thuật nền tảng');
  });

  it('keeps an inactive department selected and exposes reactivate action after deactivation', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    component.openDeactivateDepartmentModal();
    component.submitDepartmentModal();
    fixture.detectChanges();

    expect(departmentsApi.deactivateDepartment).toHaveBeenCalledWith('department-engineering');
    expect(fixture.nativeElement.textContent).toContain('Vô hiệu');
    expect(fixture.nativeElement.textContent).toContain('Kích hoạt lại');
  });

  it('reactivates the selected inactive department', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    component.openDeactivateDepartmentModal();
    component.submitDepartmentModal();
    fixture.detectChanges();

    component.openActivateDepartmentModal();
    component.submitDepartmentModal();
    fixture.detectChanges();

    expect(departmentsApi.activateDepartment).toHaveBeenCalledWith('department-engineering');
    expect(fixture.nativeElement.textContent).toContain('Hoạt động');
  });
});
