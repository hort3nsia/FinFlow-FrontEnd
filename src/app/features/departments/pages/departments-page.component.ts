import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Observable } from 'rxjs';
import { CurrentWorkspaceFacade } from '../../dashboard/data/current-workspace.facade';
import {
  DepartmentMutationPayloadResponse,
  DepartmentWorkspaceResponse,
  DepartmentWorkspaceSelectedDepartmentResponse,
  DepartmentWorkspaceTreeNodeResponse,
  DepartmentsApiService,
} from '../data/departments-api.service';

interface DepartmentTreeRow {
  id: string;
  name: string;
  parentId: string | null;
  memberCount: number;
  childCount: number;
  budgetUtilizationPct: number | null;
  depth: number;
  isActive: boolean;
  isExpanded: boolean;
}

interface DepartmentParentOption {
  id: string;
  label: string;
}

type DepartmentModalMode = 'create' | 'child' | 'rename' | 'deactivate' | 'activate' | null;

const WORKSPACE_ROOT_ID = 'workspace-root';

@Component({
  selector: 'app-departments-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './departments-page.component.html',
  styleUrl: './departments-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DepartmentsPageComponent {
  private readonly departmentsApi = inject(DepartmentsApiService);
  private readonly currentWorkspaceFacade = inject(CurrentWorkspaceFacade);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly pageCopy =
    'Organizational structure — hierarchy, members, and budget overview.';
  protected readonly workspaceState = this.currentWorkspaceFacade.state;
  protected readonly isLoading = signal(true);
  private readonly hasLoadedTenantId = signal<string | null>(null);
  private readonly workspaceSignal = signal<DepartmentWorkspaceResponse | null>(null);
  private readonly loadErrorSignal = signal<string | null>(null);
  protected readonly searchQuery = signal('');
  protected readonly expandedDepartmentIds = signal<Set<string>>(new Set());
  private readonly requestedDepartmentId = signal<string | null>(null);
  protected readonly hasExplicitSelection = signal(false);
  protected readonly departmentModalMode = signal<DepartmentModalMode>(null);
  protected readonly departmentModalName = signal('');
  protected readonly departmentModalParentId = signal<string | null>(null);
  protected readonly isSubmittingDepartmentModal = signal(false);
  protected readonly departmentModalError = signal<string | null>(null);

  protected readonly workspace = computed(() => this.workspaceSignal());
  private readonly sourceTree = computed(() => {
    const workspace = this.workspace();
    if (!workspace) {
      return [];
    }

    return workspace.tree?.length ? workspace.tree : [this.workspaceRootTreeNode(workspace)];
  });
  protected readonly workspaceCompanyName = computed(
    () => this.workspaceState().workspace?.tenantName?.trim() || 'Workspace root',
  );
  protected readonly loadError = computed(() => this.loadErrorSignal());
  protected readonly selectedDepartment = computed(
    () => this.workspace()?.selectedDepartment ?? this.workspaceRootDepartment(),
  );
  protected readonly selectedTreeNodeId = computed(() => {
    const workspace = this.workspace();
    if (!workspace || !this.hasExplicitSelection()) {
      return null;
    }

    return workspace.selectedDepartment?.id ?? WORKSPACE_ROOT_ID;
  });
  protected readonly visibleMembersPreview = computed(() => {
    const selectedDepartment = this.selectedDepartment();
    if (!selectedDepartment) {
      return [];
    }

    return selectedDepartment.membersPreview
      .filter((member) => member.membershipId !== selectedDepartment.manager?.membershipId)
      .slice(0, 2);
  });
  protected readonly treeRows = computed(() => {
    const tree = this.sourceTree();
    const query = this.searchQuery().trim().toLowerCase();
    const filteredTree = this.filterTree(tree, query);
    return this.flattenTree(filteredTree, 0, query.length > 0, this.expandedDepartmentIds());
  });
  protected readonly createDepartmentParentOptions = computed(() =>
    this.flattenParentOptions(this.sourceTree()),
  );
  protected readonly isDepartmentModalOpen = computed(() => this.departmentModalMode() !== null);
  protected readonly isChildDepartmentModal = computed(
    () => this.departmentModalMode() === 'child',
  );
  protected readonly isRenameDepartmentModal = computed(
    () => this.departmentModalMode() === 'rename',
  );
  protected readonly isDeactivateDepartmentModal = computed(
    () => this.departmentModalMode() === 'deactivate',
  );
  protected readonly isActivateDepartmentModal = computed(
    () => this.departmentModalMode() === 'activate',
  );
  protected readonly departmentModalTitle = computed(() =>
    this.isDeactivateDepartmentModal()
      ? 'Vô hiệu hóa phòng ban'
      : this.isActivateDepartmentModal()
      ? 'Kích hoạt lại phòng ban'
      : this.isRenameDepartmentModal()
      ? 'Đổi tên phòng ban'
      : this.isChildDepartmentModal()
        ? 'Tạo phòng ban con'
        : 'Tạo phòng ban mới',
  );
  protected readonly departmentModalSubtitle = computed(() =>
    this.isDeactivateDepartmentModal() ||
    this.isActivateDepartmentModal() ||
    this.isRenameDepartmentModal() ||
    this.isChildDepartmentModal()
      ? this.selectedDepartmentDisplayName()
      : 'Thêm một phòng ban vào cấu trúc tổ chức',
  );
  protected readonly departmentModalNameLabel = computed(() =>
    this.isDeactivateDepartmentModal() || this.isActivateDepartmentModal()
      ? ''
      : this.isRenameDepartmentModal()
      ? 'Tên mới'
      : this.isChildDepartmentModal()
        ? 'Tên phòng ban con'
        : 'Tên phòng ban',
  );
  protected readonly departmentModalNamePlaceholder = computed(() =>
    this.isRenameDepartmentModal()
      ? ''
      : this.isChildDepartmentModal()
      ? 'e.g. Frontend, Infra, Data...'
      : 'e.g. Data Science, Legal, HR...',
  );
  protected readonly departmentModalSubmitLabel = computed(() =>
    this.isDeactivateDepartmentModal()
      ? 'Vô hiệu hóa'
      : this.isActivateDepartmentModal()
      ? 'Kích hoạt lại'
      : this.isRenameDepartmentModal()
        ? 'Lưu tên mới'
        : 'Tạo phòng ban',
  );
  protected readonly departmentModalWarning = computed(() => {
    const name = this.selectedDepartmentDisplayName();
    if (this.isActivateDepartmentModal()) {
      return `Kích hoạt lại ${name} để phòng ban xuất hiện trong workflow, danh sách chọn ngân sách và các màn hình đang hoạt động.`;
    }

    return `Vô hiệu hóa ${name} sẽ ẩn phòng ban khỏi các màn hình đang hoạt động. Thành viên vẫn được giữ lại nhưng phòng ban sẽ được đánh dấu vô hiệu.`;
  });
  protected readonly departmentModalParentLabel = computed(() => {
    const parentId = this.departmentModalParentId();
    if (!parentId) {
      return '--';
    }

    return (
      this.createDepartmentParentOptions().find((option) => option.id === parentId)?.label.trim() ??
      '--'
    );
  });
  protected readonly remainingMemberCount = computed(() => {
    const selectedDepartment = this.selectedDepartment();
    if (!selectedDepartment) {
      return 0;
    }

    return Math.max(0, selectedDepartment.memberCount - this.visibleMembersPreview().length);
  });
  protected readonly budgetUtilizationLabel = computed(() => {
    const utilization = this.selectedDepartment()?.budgetSnapshot?.utilizationPct;
    if (utilization === null || utilization === undefined) {
      return '--';
    }

    return `${Math.round(utilization)}%`;
  });

  constructor() {
    effect(() => {
      const workspace = this.workspaceState().workspace;
      if (!workspace?.tenantId || this.hasLoadedTenantId() === workspace.tenantId) {
        return;
      }

      this.hasLoadedTenantId.set(workspace.tenantId);
      this.loadWorkspace(null);
    });

    effect(() => {
      const workspace = this.workspace();
      if (!workspace) {
        this.expandedDepartmentIds.set(new Set());
        return;
      }

      this.expandedDepartmentIds.set(
        this.buildDefaultExpandedIds(
          this.sourceTree(),
          workspace.selectedDepartment?.id ?? WORKSPACE_ROOT_ID,
        ),
      );
    });
  }

  protected updateSearchQuery(value: string): void {
    this.searchQuery.set(value);
  }

  protected selectDepartment(departmentId: string): void {
    this.hasExplicitSelection.set(true);
    if (departmentId === WORKSPACE_ROOT_ID) {
      this.loadWorkspace(null);
      return;
    }

    if (this.selectedDepartment()?.id === departmentId) {
      return;
    }

    this.loadWorkspace(departmentId);
  }

  protected toggleDepartmentExpansion(departmentId: string): void {
    this.expandedDepartmentIds.update((current) => {
      const next = new Set(current);
      if (next.has(departmentId)) {
        next.delete(departmentId);
      } else {
        next.add(departmentId);
      }
      return next;
    });
  }

  protected exportWorkspace(): void {
    const workspace = this.workspace();
    if (!workspace || typeof document === 'undefined' || !window.URL?.createObjectURL) {
      return;
    }

    const selectedId = workspace.summary.selectedDepartmentId ?? 'department-workspace';
    const blob = new Blob([JSON.stringify(workspace, null, 2)], {
      type: 'application/json',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedId}-workspace.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  protected openCreateDepartmentModal(): void {
    const options = this.createDepartmentParentOptions();
    this.departmentModalError.set(null);
    this.departmentModalMode.set('create');
    this.departmentModalName.set('');
    this.departmentModalParentId.set(
      this.selectedTreeNodeId() ?? options[0]?.id ?? null,
    );
  }

  protected openCreateChildDepartmentModal(): void {
    if (!this.hasExplicitSelection() || !this.selectedDepartment()) {
      return;
    }

    this.departmentModalError.set(null);
    this.departmentModalMode.set('child');
    this.departmentModalName.set('');
    this.departmentModalParentId.set(this.selectedTreeNodeId());
  }

  protected openRenameDepartmentModal(): void {
    if (!this.hasExplicitSelection() || !this.selectedDepartment()) {
      return;
    }

    this.departmentModalError.set(null);
    this.departmentModalMode.set('rename');
    this.departmentModalName.set(this.selectedDepartmentDisplayName());
    this.departmentModalParentId.set(this.selectedTreeNodeId());
  }

  protected openDeactivateDepartmentModal(): void {
    if (!this.hasExplicitSelection() || !this.selectedDepartment()) {
      return;
    }

    this.departmentModalError.set(null);
    this.departmentModalMode.set('deactivate');
    this.departmentModalName.set(this.selectedDepartmentDisplayName());
    this.departmentModalParentId.set(this.selectedTreeNodeId());
  }

  protected openActivateDepartmentModal(): void {
    if (!this.hasExplicitSelection() || !this.selectedDepartment()) {
      return;
    }

    this.departmentModalError.set(null);
    this.departmentModalMode.set('activate');
    this.departmentModalName.set(this.selectedDepartmentDisplayName());
    this.departmentModalParentId.set(this.selectedTreeNodeId());
  }

  protected closeDepartmentModal(): void {
    this.departmentModalError.set(null);
    this.isSubmittingDepartmentModal.set(false);
    this.departmentModalMode.set(null);
  }

  protected updateDepartmentModalName(value: string): void {
    this.departmentModalName.set(value);
  }

  protected updateDepartmentModalParent(value: string): void {
    this.departmentModalParentId.set(value);
  }

  protected submitDepartmentModal(): void {
    if (this.isSubmittingDepartmentModal()) {
      return;
    }

    const mode = this.departmentModalMode();
    if (!mode) {
      return;
    }

    const trimmedName = this.departmentModalName().trim();
    if (mode !== 'deactivate' && mode !== 'activate' && !trimmedName) {
      return;
    }

    let request$: Observable<DepartmentMutationPayloadResponse | boolean>;
    let nextSelectionId: string | null;

    switch (mode) {
      case 'create':
      case 'child': {
        request$ = this.departmentsApi.createDepartment(
          trimmedName,
          this.normalizeDepartmentParentId(this.departmentModalParentId()),
        );
        nextSelectionId = null;
        break;
      }
      case 'rename': {
        const targetId = this.currentDepartmentMutationTargetId();
        if (!targetId) {
          this.departmentModalError.set('Không thể đổi tên phòng ban từ góc nhìn hiện tại.');
          return;
        }

        request$ = this.departmentsApi.renameDepartment(targetId, trimmedName);
        nextSelectionId = targetId;
        break;
      }
      case 'deactivate': {
        const targetId = this.currentDepartmentMutationTargetId();
        if (!targetId) {
          this.departmentModalError.set(
            'Không thể vô hiệu hóa phòng ban từ góc nhìn hiện tại.',
          );
          return;
        }

        request$ = this.departmentsApi.deactivateDepartment(targetId);
        nextSelectionId = targetId;
        break;
      }
      case 'activate': {
        const targetId = this.currentDepartmentMutationTargetId();
        if (!targetId) {
          this.departmentModalError.set(
            'Không thể kích hoạt lại phòng ban từ góc nhìn hiện tại.',
          );
          return;
        }

        request$ = this.departmentsApi.activateDepartment(targetId);
        nextSelectionId = targetId;
        break;
      }
      default:
        return;
    }

    this.isSubmittingDepartmentModal.set(true);
    this.departmentModalError.set(null);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.isSubmittingDepartmentModal.set(false);
        this.closeDepartmentModal();

        const selectedDepartmentId =
          typeof result === 'boolean' ? nextSelectionId : result.id;
        this.hasExplicitSelection.set(selectedDepartmentId !== null);
        if (typeof result === 'boolean') {
          const targetId = nextSelectionId;
          if (targetId) {
            this.applyDepartmentPatch({
              id: targetId,
              name: this.selectedDepartmentDisplayName(),
              parentId: this.findParentDepartmentId(targetId),
              isActive: false,
            });
          }
          return;
        }

        this.applyDepartmentPatch(result);
      },
      error: (error: Error) => {
        this.isSubmittingDepartmentModal.set(false);
        this.departmentModalError.set(error.message);
      },
    });
  }

  protected formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return '--';
    }

    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(value);
  }

  protected formatDate(value: string | null | undefined): string {
    if (!value) {
      return '--';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return '--';
    }

    return parsed.toLocaleDateString('vi-VN', {
      month: '2-digit',
      day: 'numeric',
      year: 'numeric',
    });
  }

  protected formatRole(value: string | null | undefined): string {
    if (!value) {
      return '--';
    }

    return value
      .toLowerCase()
      .split(/[_\s]+/)
      .filter((part) => part.length > 0)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  protected isTreeRowSelected(departmentId: string): boolean {
    return this.selectedTreeNodeId() === departmentId;
  }

  protected treeRowLabel(row: DepartmentTreeRow): string {
    return row.parentId === null ? this.workspaceCompanyName() : row.name;
  }

  protected selectedDepartmentDisplayName(): string {
    const selectedDepartment = this.selectedDepartment();
    if (!selectedDepartment) {
      return this.workspaceCompanyName();
    }

    return this.isWorkspaceRootDepartment(selectedDepartment)
      ? this.workspaceCompanyName()
      : selectedDepartment.name;
  }

  protected selectedDepartmentSubtitle(): string | null {
    const selectedDepartment = this.selectedDepartment();
    if (!selectedDepartment) {
      return null;
    }

    return this.isWorkspaceRootDepartment(selectedDepartment)
      ? null
      : `Thuộc ${selectedDepartment.parentName}`;
  }

  protected selectedDepartmentParentLabel(): string {
    const selectedDepartment = this.selectedDepartment();
    if (!selectedDepartment || this.isWorkspaceRootDepartment(selectedDepartment)) {
      return 'Gốc';
    }

    return selectedDepartment.parentName || 'Gốc';
  }

  protected utilizationTone(utilization: number | null | undefined): string {
    if (utilization === null || utilization === undefined) {
      return 'neutral';
    }

    if (utilization >= 85) {
      return 'warning';
    }

    return 'healthy';
  }

  protected activityTone(tone: string | null | undefined): string {
    const normalizedTone = tone?.trim().toLowerCase();
    if (normalizedTone === 'warning') {
      return 'warning';
    }

    if (normalizedTone === 'success') {
      return 'success';
    }

    return 'info';
  }

  protected activityMeta(
    activity: DepartmentWorkspaceSelectedDepartmentResponse['recentActivity'][number],
  ): string {
    return activity.description || activity.actorName || '';
  }

  protected activityHeadline(
    activity: DepartmentWorkspaceSelectedDepartmentResponse['recentActivity'][number],
  ): string {
    if (activity.amount === null || activity.amount === undefined) {
      return activity.title;
    }

    const formattedAmount = this.formatCurrency(activity.amount);
    if (activity.title.toLowerCase().includes('submitted')) {
      return `${activity.title} (${formattedAmount})`;
    }

    return `${activity.title} ${formattedAmount}`;
  }

  private loadWorkspace(selectedDepartmentId: string | null): void {
    const showFullPageLoading = this.workspaceSignal() === null;
    this.isLoading.set(showFullPageLoading);
    this.loadErrorSignal.set(null);
    this.requestedDepartmentId.set(selectedDepartmentId);

    this.departmentsApi
      .getDepartmentWorkspace(selectedDepartmentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (workspace) => {
          if (this.requestedDepartmentId() !== selectedDepartmentId) {
            return;
          }

          this.workspaceSignal.set(workspace);
          if (workspace.selectedDepartment?.id) {
            this.hasExplicitSelection.set(true);
          }
          this.isLoading.set(false);
        },
        error: (error: Error) => {
          if (this.requestedDepartmentId() !== selectedDepartmentId) {
            return;
          }

          if (showFullPageLoading) {
            this.workspaceSignal.set(null);
          }
          this.loadErrorSignal.set(error.message);
          this.isLoading.set(false);
        },
      });
  }

  private applyDepartmentPatch(patch: DepartmentMutationPayloadResponse): void {
    this.workspaceSignal.update((workspace) => {
      if (!workspace) {
        return workspace;
      }

      return {
        ...workspace,
        tree: this.patchDepartmentTree(workspace.tree, patch),
        selectedDepartment:
          workspace.selectedDepartment?.id === patch.id
            ? {
                ...workspace.selectedDepartment,
                name: patch.name,
                status: patch.isActive ? 'Active' : 'Inactive',
              }
            : workspace.selectedDepartment,
      };
    });
  }

  private patchDepartmentTree(
    nodes: DepartmentWorkspaceTreeNodeResponse[],
    patch: DepartmentMutationPayloadResponse,
  ): DepartmentWorkspaceTreeNodeResponse[] {
    return nodes.map((node) => {
      const patchedNode =
        node.id === patch.id
          ? {
              ...node,
              name: patch.name,
              parentId: patch.parentId,
              isActive: patch.isActive,
            }
          : node;

      return {
        ...patchedNode,
        children: this.patchDepartmentTree(patchedNode.children, patch),
      };
    });
  }

  private filterTree(
    nodes: DepartmentWorkspaceTreeNodeResponse[],
    query: string,
  ): DepartmentWorkspaceTreeNodeResponse[] {
    if (!query) {
      return nodes;
    }

    return nodes
      .map((node) => ({
        ...node,
        children: this.filterTree(node.children, query),
      }))
      .filter(
        (node) =>
          node.name.toLowerCase().includes(query) ||
          node.children.length > 0,
      );
  }

  private flattenTree(
    nodes: DepartmentWorkspaceTreeNodeResponse[],
    depth = 0,
    forceExpand = false,
    expandedIds = new Set<string>(),
  ): DepartmentTreeRow[] {
    return nodes.flatMap((node) => {
      const isExpanded = forceExpand || expandedIds.has(node.id);
      return [
        {
          id: node.id,
          name: node.name,
          parentId: node.parentId,
          memberCount: node.memberCount,
          childCount: node.childCount,
          budgetUtilizationPct: node.budgetUtilizationPct,
          depth,
          isActive: node.isActive,
          isExpanded,
        },
        ...(node.children.length > 0 && isExpanded
          ? this.flattenTree(node.children, depth + 1, forceExpand, expandedIds)
          : []),
      ];
    });
  }

  private flattenParentOptions(
    nodes: DepartmentWorkspaceTreeNodeResponse[],
    depth = 0,
  ): DepartmentParentOption[] {
    return nodes.flatMap((node) => [
      {
        id: node.id,
        label: `${depth > 0 ? `${'  '.repeat(depth)}` : ''}${node.parentId === null ? this.workspaceCompanyName() : node.name}`,
      },
      ...this.flattenParentOptions(node.children, depth + 1),
    ]);
  }

  private normalizeDepartmentParentId(parentId: string | null): string | null {
    return parentId === WORKSPACE_ROOT_ID ? null : parentId;
  }

  private currentDepartmentMutationTargetId(): string | null {
    const id = this.selectedTreeNodeId();
    if (!id || id === WORKSPACE_ROOT_ID) {
      return null;
    }

    return id;
  }

  private findParentDepartmentId(departmentId: string): string | null {
    return this.findDepartmentNode(this.sourceTree(), departmentId)?.parentId ?? null;
  }

  private findDepartmentNode(
    nodes: DepartmentWorkspaceTreeNodeResponse[],
    departmentId: string,
  ): DepartmentWorkspaceTreeNodeResponse | null {
    for (const node of nodes) {
      if (node.id === departmentId) {
        return node;
      }

      const match = this.findDepartmentNode(node.children, departmentId);
      if (match) {
        return match;
      }
    }

    return null;
  }

  private buildDefaultExpandedIds(
    nodes: DepartmentWorkspaceTreeNodeResponse[],
    selectedDepartmentId: string,
  ): Set<string> {
    const expandedIds = new Set<string>();
    const parentMap = new Map<string, string | null>();

    const visit = (treeNodes: DepartmentWorkspaceTreeNodeResponse[]): void => {
      treeNodes.forEach((node) => {
        parentMap.set(node.id, node.parentId);
        if (node.parentId === null && node.childCount > 0) {
          expandedIds.add(node.id);
        }
        visit(node.children);
      });
    };

    visit(nodes);

    let currentId: string | null | undefined = selectedDepartmentId;
    while (currentId) {
      expandedIds.add(currentId);
      currentId = parentMap.get(currentId);
    }

    return expandedIds;
  }

  private workspaceRootDepartment(): DepartmentWorkspaceSelectedDepartmentResponse | null {
    const workspace = this.workspace();
    if (!workspace) {
      return null;
    }

    return {
      id: WORKSPACE_ROOT_ID,
      name: this.workspaceCompanyName(),
      parentName: null,
      departmentCode: 'ROOT',
      status: 'Active',
      createdAt: new Date().toISOString(),
      memberCount: workspace.summary.totalMembers,
      subDepartmentCount: workspace.summary.totalDepartments,
      expenseVolumeAmount: null,
      expenseCount: null,
      manager: null,
      budgetSnapshot: null,
      subDepartments: [],
      membersPreview: [],
      recentActivity: [],
    };
  }

  private workspaceRootTreeNode(
    workspace: DepartmentWorkspaceResponse,
  ): DepartmentWorkspaceTreeNodeResponse {
    return {
      id: workspace.selectedDepartment?.id ?? WORKSPACE_ROOT_ID,
      name: this.workspaceCompanyName(),
      parentId: null,
      isActive: true,
      memberCount: workspace.selectedDepartment?.memberCount ?? workspace.summary.totalMembers,
      childCount: 0,
      budgetUtilizationPct: workspace.selectedDepartment?.budgetSnapshot?.utilizationPct ?? null,
      children: [],
    } satisfies DepartmentWorkspaceTreeNodeResponse;
  }

  private isWorkspaceRootDepartment(
    selectedDepartment: DepartmentWorkspaceSelectedDepartmentResponse,
  ): boolean {
    return selectedDepartment.id === WORKSPACE_ROOT_ID || selectedDepartment.parentName === null;
  }
}
