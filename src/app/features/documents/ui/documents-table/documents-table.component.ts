import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DocumentDraftSummary, SubmittedDocumentSummary } from '../../data/documents.models';
import { DocumentStatusBadgeComponent } from '../document-status-badge/document-status-badge.component';

interface DocumentTableRow {
  id: string;
  fileName: string;
  vendor: string;
  amount: number;
  status: string;
  date: string;
}

@Component({
  selector: 'app-documents-table',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, RouterLink, DocumentStatusBadgeComponent],
  templateUrl: './documents-table.component.html',
  styleUrl: './documents-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsTableComponent {
  readonly drafts = input<DocumentDraftSummary[]>([]);
  readonly submitted = input<SubmittedDocumentSummary[]>([]);

  protected readonly rows = computed<DocumentTableRow[]>(() => {
    const draftRows = this.drafts().map((draft) => ({
      id: draft.documentId,
      fileName: draft.originalFileName,
      vendor: draft.vendorName,
      amount: draft.totalAmount,
      status: 'Draft',
      date: draft.uploadedAt,
    }));
    const submittedRows = this.submitted().map((document) => ({
      id: document.documentId,
      fileName: document.originalFileName,
      vendor: document.vendorName,
      amount: document.totalAmount,
      status: document.status,
      date: document.submittedAt,
    }));

    return [...draftRows, ...submittedRows].sort(
      (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime(),
    );
  });
}
