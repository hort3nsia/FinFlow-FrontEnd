import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApprovalsApiService, PendingApprovalItemResponse } from '../data/approvals-api.service';

interface ApprovalKpi {
  label: string;
  value: string;
  accent?: string;
}

interface ApprovalItem {
  id: string;
  title: string;
  requester: string;
  department: string;
  amount: string;
  due: string;
  priority: 'High' | 'Medium' | 'Low';
}

@Component({
  selector: 'app-approvals-page',
  standalone: true,
  templateUrl: './approvals-page.component.html',
  styleUrl: './approvals-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApprovalsPageComponent {
  private readonly approvalsApi = inject(ApprovalsApiService);

  protected readonly pageCopy =
    'Manager decisions for submitted spending requests that are waiting for approval.';

  protected readonly isLoading = signal(true);
  private readonly apiApprovals = signal<ApprovalItem[] | null>(null);
  private readonly apiError = signal<string | null>(null);

  protected readonly loadError = computed(() => this.apiError());
  protected readonly approvals = computed(() => this.apiApprovals() ?? []);
  protected readonly kpis = computed<ApprovalKpi[]>(() => {
    const approvals = this.apiApprovals();
    if (approvals === null) {
      return [];
    }

    const dueToday = approvals.filter((item) => item.due.trim().toLowerCase() === 'today').length;
    const highPriority = approvals.filter((item) => item.priority === 'High').length;
    const departments = new Set(approvals.map((item) => item.department)).size;

    return [
      { label: 'Waiting now', value: String(approvals.length) },
      {
        label: 'Due today',
        value: String(dueToday),
        accent: dueToday > 0 ? 'Needs same-day sign-off' : 'Nothing due today',
      },
      { label: 'High priority', value: String(highPriority) },
      {
        label: 'Departments',
        value: String(departments),
        accent: departments > 0 ? 'Active request owners' : 'No active routing yet',
      },
    ];
  });

  constructor() {
    this.approvalsApi
      .getPendingApprovalItems()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (items) => {
          this.apiApprovals.set(items.map((item) => this.toApprovalItem(item)));
          this.apiError.set(null);
          this.isLoading.set(false);
        },
        error: (error: Error) => {
          this.apiApprovals.set(null);
          this.apiError.set(error.message);
          this.isLoading.set(false);
        },
      });
  }

  private toApprovalItem(item: PendingApprovalItemResponse): ApprovalItem {
    return {
      id: item.documentId,
      title: item.title,
      requester: item.requester,
      department: item.department,
      amount: this.formatCurrency(item.amount),
      due: item.dueDate,
      priority: this.normalizePriority(item.priority),
    };
  }

  private normalizePriority(priority: string): 'High' | 'Medium' | 'Low' {
    const normalized = priority.trim().toLowerCase();
    if (normalized === 'high') {
      return 'High';
    }

    if (normalized === 'low') {
      return 'Low';
    }

    return 'Medium';
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  }
}
