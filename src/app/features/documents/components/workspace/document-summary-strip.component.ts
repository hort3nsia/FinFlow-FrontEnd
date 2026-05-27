import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface DocumentSummaryItem {
  label: string;
  value: string;
}

export interface DocumentSummaryBadge {
  label: string;
  tone: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
}

@Component({
  selector: 'app-document-summary-strip',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './document-summary-strip.component.html',
  styleUrl: './document-summary-strip.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentSummaryStripComponent {
  readonly leadingTitle = input<string | null>(null);
  readonly leadingSubtitle = input<string | null>(null);
  readonly items = input<DocumentSummaryItem[]>([]);
  readonly badges = input<DocumentSummaryBadge[]>([]);
  readonly totalLabel = input('Tổng cộng');
  readonly totalValue = input('');

  protected badgeClass(tone: DocumentSummaryBadge['tone']): string {
    switch (tone) {
      case 'primary':
        return 'bg-indigo-50 text-indigo-700 ring-indigo-100';
      case 'success':
        return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
      case 'warning':
        return 'bg-amber-50 text-amber-700 ring-amber-100';
      case 'danger':
        return 'bg-rose-50 text-rose-700 ring-rose-100';
      default:
        return 'bg-slate-100 text-slate-700 ring-slate-200';
    }
  }
}
