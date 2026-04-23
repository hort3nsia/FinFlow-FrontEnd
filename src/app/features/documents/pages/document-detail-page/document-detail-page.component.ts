import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { DocumentsApiService } from '../../data/documents.api.service';
import { DocumentDraftDetail, SubmitReviewedDocumentInput } from '../../data/documents.models';

interface DocumentDetailPageState {
  isLoading: boolean;
  draftId: string | null;
  draft: DocumentDraftDetail | null;
  error: string | null;
  pendingAction: 'delete' | 'submit' | null;
}

@Component({
  selector: 'app-document-detail-page',
  standalone: true,
  imports: [RouterLink, CurrencyPipe, DatePipe],
  templateUrl: './document-detail-page.component.html',
  styleUrl: './document-detail-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly documentsApiService = inject(DocumentsApiService);

  protected readonly state = signal<DocumentDetailPageState>({
    isLoading: true,
    draftId: null,
    draft: null,
    error: null,
    pendingAction: null,
  });

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((paramMap) => {
        const draftId = paramMap.get('id');

        if (!draftId) {
          this.state.set({
            isLoading: false,
            draftId: null,
            draft: null,
            error: 'Document id is missing from the route.',
            pendingAction: null,
          });
          return;
        }

        this.loadDraft(draftId);
      });
  }

  protected deleteDraft(): void {
    const draftId = this.state().draftId;
    if (!draftId || this.state().pendingAction) {
      return;
    }

    this.patchState({
      error: null,
      pendingAction: 'delete',
    });

    this.documentsApiService
      .deleteDraft(draftId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.patchState({ pendingAction: null })),
      )
      .subscribe({
        next: (wasDeleted) => {
          if (!wasDeleted) {
            this.patchState({
              error: 'The draft could not be deleted.',
            });
            return;
          }

          void this.router.navigateByUrl('/app/documents/list');
        },
        error: (error: unknown) => {
          this.patchState({
            error: this.toErrorMessage(error),
          });
        },
      });
  }

  protected submit(): void {
    const draft = this.state().draft;
    if (!draft || this.state().pendingAction) {
      return;
    }

    this.patchState({
      error: null,
      pendingAction: 'submit',
    });

    this.documentsApiService
      .submitReviewedDocument(this.mapDraftToSubmitInput(draft))
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.patchState({ pendingAction: null })),
      )
      .subscribe({
        next: () => {
          void this.router.navigateByUrl('/app/documents/list');
        },
        error: (error: unknown) => {
          this.patchState({
            error: this.toErrorMessage(error),
          });
        },
      });
  }

  protected trackLineItem(index: number, lineItem: DocumentDraftDetail['lineItems'][number]): string {
    return `${index}-${lineItem.itemName}`;
  }

  private loadDraft(draftId: string): void {
    this.state.set({
      isLoading: true,
      draftId,
      draft: null,
      error: null,
      pendingAction: null,
    });

    this.documentsApiService
      .getDraft(draftId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (draft) => {
          this.state.set({
            isLoading: false,
            draftId,
            draft,
            error: null,
            pendingAction: null,
          });
        },
        error: (error: unknown) => {
          this.state.set({
            isLoading: false,
            draftId,
            draft: null,
            error: this.toErrorMessage(error),
            pendingAction: null,
          });
        },
      });
  }

  private mapDraftToSubmitInput(draft: DocumentDraftDetail): SubmitReviewedDocumentInput {
    return {
      documentId: draft.documentId,
      originalFileName: draft.originalFileName,
      contentType: draft.contentType,
      vendorName: draft.vendorName,
      reference: draft.reference,
      documentDate: draft.documentDate,
      dueDate: draft.dueDate,
      category: draft.category,
      vendorTaxId: draft.vendorTaxId,
      subtotal: draft.subtotal,
      vat: draft.vat,
      totalAmount: draft.totalAmount,
      source: draft.source,
      confidenceLabel: draft.confidenceLabel,
      lineItems: draft.lineItems,
    };
  }

  private patchState(partialState: Partial<DocumentDetailPageState>): void {
    this.state.update((currentState) => ({
      ...currentState,
      ...partialState,
    }));
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unable to load this document.';
  }
}
