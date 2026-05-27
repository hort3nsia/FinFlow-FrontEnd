import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DepartmentsApiService } from './departments-api.service';

describe('DepartmentsApiService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('returns the department workspace payload from the graphql endpoint', () => {
    const service = TestBed.inject(DepartmentsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service.getDepartmentWorkspace('department-engineering').subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('departmentWorkspace');
    expect(request.request.body.variables).toEqual({
      selectedDepartmentId: 'department-engineering',
    });

    request.flush({
      data: {
        departmentWorkspace: {
          summary: {
            totalDepartments: 3,
            totalMembers: 38,
            activeDepartments: 3,
            selectedDepartmentId: 'department-engineering',
          },
          tree: [
            {
              id: 'department-root',
              name: 'Meridian Corp',
              parentId: null,
              isActive: true,
              memberCount: 4,
              childCount: 1,
              budgetUtilizationPct: 77,
              children: [],
            },
          ],
          selectedDepartment: {
            id: 'department-engineering',
            name: 'Engineering',
            parentName: 'Meridian Corp',
            departmentCode: 'DEPT-202',
            status: 'Active',
            createdAt: '2026-01-15T00:00:00Z',
            memberCount: 38,
            subDepartmentCount: 2,
            expenseVolumeAmount: 142800,
            expenseCount: 84,
            manager: {
              membershipId: 'membership-1',
              fullName: 'Sarah Kimani',
              email: 'sarah.kimani@meridian.com',
              role: 'MANAGER',
              initials: 'SK',
            },
            budgetSnapshot: {
              periodLabel: 'Nov 2024',
              allocatedAmount: 45000,
              spentAmount: 38200,
              remainingAmount: 6800,
              utilizationPct: 85,
            },
            subDepartments: [],
            membersPreview: [],
            recentActivity: [],
          },
        },
      },
    });

    expect(result).toEqual({
      summary: {
        totalDepartments: 3,
        totalMembers: 38,
        activeDepartments: 3,
        selectedDepartmentId: 'department-engineering',
      },
      tree: [
        {
          id: 'department-root',
          name: 'Meridian Corp',
          parentId: null,
          isActive: true,
          memberCount: 4,
          childCount: 1,
          budgetUtilizationPct: 77,
          children: [],
        },
      ],
      selectedDepartment: {
        id: 'department-engineering',
        name: 'Engineering',
        parentName: 'Meridian Corp',
        departmentCode: 'DEPT-202',
        status: 'Active',
        createdAt: '2026-01-15T00:00:00Z',
        memberCount: 38,
        subDepartmentCount: 2,
        expenseVolumeAmount: 142800,
        expenseCount: 84,
        manager: {
          membershipId: 'membership-1',
          fullName: 'Sarah Kimani',
          email: 'sarah.kimani@meridian.com',
          role: 'MANAGER',
          initials: 'SK',
        },
        budgetSnapshot: {
          periodLabel: 'Nov 2024',
          allocatedAmount: 45000,
          spentAmount: 38200,
          remainingAmount: 6800,
          utilizationPct: 85,
        },
        subDepartments: [],
        membersPreview: [],
        recentActivity: [],
      },
    });
    httpTesting.verify();
  });

  it('loads department tree options through departmentWorkspace because getDepartmentTree is not in the backend schema', () => {
    const service = TestBed.inject(DepartmentsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service.getDepartmentTree().subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('departmentWorkspace');
    expect(request.request.body.query).not.toContain('getDepartmentTree');
    expect(request.request.body.variables).toEqual({ selectedDepartmentId: null });

    request.flush({
      data: {
        departmentWorkspace: {
          summary: {
            totalDepartments: 1,
            totalMembers: 2,
            activeDepartments: 1,
            selectedDepartmentId: null,
          },
          tree: [
            {
              id: 'department-finance',
              name: 'Finance',
              parentId: null,
              isActive: true,
              memberCount: 2,
              childCount: 0,
              budgetUtilizationPct: 42,
              children: [],
            },
          ],
          selectedDepartment: null,
        },
      },
    });

    expect(result).toEqual([
      {
        id: 'department-finance',
        name: 'Finance',
        parentId: null,
        isActive: true,
        memberCount: 2,
        childCount: 0,
        budgetUtilizationPct: 42,
        children: [],
      },
    ]);
    httpTesting.verify();
  });

  it('creates a department through the graphql endpoint', () => {
    const service = TestBed.inject(DepartmentsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service.createDepartment('Legal', 'department-root').subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('createDepartment');
    expect(request.request.body.variables).toEqual({
      input: {
        name: 'Legal',
        parentId: 'department-root',
      },
    });

    request.flush({
      data: {
        createDepartment: {
          id: 'department-legal',
          name: 'Legal',
          parentId: 'department-root',
          isActive: true,
        },
      },
    });

    expect(result).toEqual({
      id: 'department-legal',
      name: 'Legal',
      parentId: 'department-root',
      isActive: true,
    });
    httpTesting.verify();
  });

  it('renames a department through the graphql endpoint', () => {
    const service = TestBed.inject(DepartmentsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service.renameDepartment('department-platform', 'Core Platform').subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('renameDepartment');
    expect(request.request.body.variables).toEqual({
      input: {
        id: 'department-platform',
        name: 'Core Platform',
      },
    });

    request.flush({
      data: {
        renameDepartment: {
          id: 'department-platform',
          name: 'Core Platform',
          parentId: 'department-engineering',
          isActive: true,
        },
      },
    });

    expect(result).toEqual({
      id: 'department-platform',
      name: 'Core Platform',
      parentId: 'department-engineering',
      isActive: true,
    });
    httpTesting.verify();
  });

  it('deactivates a department through the graphql endpoint', () => {
    const service = TestBed.inject(DepartmentsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service.deactivateDepartment('department-platform').subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('deactivateDepartment');
    expect(request.request.body.variables).toEqual({
      input: {
        id: 'department-platform',
      },
    });

    request.flush({
      data: {
        deactivateDepartment: true,
      },
    });

    expect(result).toBe(true);
    httpTesting.verify();
  });

  it('activates a department through the graphql endpoint', () => {
    const service = TestBed.inject(DepartmentsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service.activateDepartment('department-platform').subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('activateDepartment');
    expect(request.request.body.variables).toEqual({
      input: {
        id: 'department-platform',
      },
    });

    request.flush({
      data: {
        activateDepartment: {
          id: 'department-platform',
          name: 'Platform',
          parentId: 'department-engineering',
          isActive: true,
        },
      },
    });

    expect(result).toEqual({
      id: 'department-platform',
      name: 'Platform',
      parentId: 'department-engineering',
      isActive: true,
    });
    httpTesting.verify();
  });
});
