import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { DocumentsApiService } from '../../data/documents.api.service';
import { DocumentDraftSummary, SubmittedDocumentSummary } from '../../data/documents.models';
import { DocumentsTableComponent } from '../../ui/documents-table/documents-table.component';

interface DocumentsQueueResult<TItem> {
  items: TItem[];
  totalCount: number;
  error: string | null;
}

@Component({
  selector: 'app-documents-list-page',
  standalone: true,
  imports: [RouterLink, DocumentsTableComponent],
  templateUrl: './documents-list-page.component.html',
  styleUrl: './documents-list-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsListPageComponent implements OnInit {
  private readonly documentsApiService = inject(DocumentsApiService);

  protected readonly state = signal<{
    drafts: DocumentDraftSummary[];
    draftTotalCount: number;
    draftsError: string | null;
    submitted: SubmittedDocumentSummary[];
    submittedTotalCount: number;
    submittedError: string | null;
    isLoading: boolean;
    error: string | null;
  }>({
    drafts: [],
    draftTotalCount: 0,
    draftsError: null,
    submitted: [],
    submittedTotalCount: 0,
    submittedError: null,
    isLoading: true,
    error: null,
  });

  ngOnInit(): void {
    forkJoin({
      drafts: this.documentsApiService.getDrafts(0, 10).pipe(
        map((drafts) => ({
          items: drafts.items,
          totalCount: drafts.totalCount,
          error: null,
        })),
        catchError((error: unknown) =>
          of({
            items: [],
            totalCount: 0,
            error: this.toErrorMessage(error),
          }),
        ),
      ),
      submitted: this.documentsApiService.getSubmitted(0, 10).pipe(
        map((submitted) => ({
          items: submitted.items,
          totalCount: submitted.totalCount,
          error: null,
        })),
        catchError((error: unknown) =>
          of({
            items: [],
            totalCount: 0,
            error: this.toErrorMessage(error),
          }),
        ),
      ),
    }).subscribe({
      next: ({ drafts, submitted }) => {
        const bothFailed = drafts.error !== null && submitted.error !== null;

        this.state.set({
          drafts: drafts.items,
          draftTotalCount: drafts.totalCount,
          draftsError: bothFailed ? null : drafts.error,
          submitted: submitted.items,
          submittedTotalCount: submitted.totalCount,
          submittedError: bothFailed ? null : submitted.error,
          isLoading: false,
          error: bothFailed ? [drafts.error, submitted.error].filter(Boolean).join(' ') : null,
        });
      },
    });
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unable to load documents.';
  }
}
