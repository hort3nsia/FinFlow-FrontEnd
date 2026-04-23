import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

type DocumentListStatus =
  | 'Draft'
  | 'Submitted'
  | 'Approved'
  | 'Rejected'
  | 'ReadyForApproval'
  | 'Unknown';

@Component({
  selector: 'app-document-status-badge',
  standalone: true,
  template: `
    <span [class]="'document-status-badge ' + badgeClass()">
      {{ label() }}
    </span>
  `,
  styles: `
    .document-status-badge {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 0.3rem 0.7rem;
      font-size: 0.875rem;
      font-weight: 700;
      line-height: 1;
      letter-spacing: 0.01em;
    }

    .document-status-badge--draft {
      background: #eef2ff;
      color: #3730a3;
    }

    .document-status-badge--submitted {
      background: #ecfeff;
      color: #155e75;
    }

    .document-status-badge--approved {
      background: #ecfdf5;
      color: #166534;
    }

    .document-status-badge--rejected {
      background: #fef2f2;
      color: #b91c1c;
    }

    .document-status-badge--ready-for-approval {
      background: #fff7ed;
      color: #c2410c;
    }

    .document-status-badge--unknown {
      background: #f1f5f9;
      color: #475569;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentStatusBadgeComponent {
  readonly status = input.required<string>();

  protected readonly normalizedStatus = computed<DocumentListStatus>(() => {
    const value = this.status().trim().toLowerCase();

    switch (value) {
      case 'draft':
        return 'Draft';
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      case 'readyforapproval':
        return 'ReadyForApproval';
      case 'submitted':
        return 'Submitted';
      default:
        return 'Unknown';
    }
  });

  protected readonly label = computed(() => {
    if (this.normalizedStatus() === 'ReadyForApproval') {
      return 'Ready for approval';
    }

    return this.normalizedStatus();
  });

  protected readonly badgeClass = computed(
    () =>
      `document-status-badge--${this.normalizedStatus()
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .toLowerCase()}`,
  );
}
