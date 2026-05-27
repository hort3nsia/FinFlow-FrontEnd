import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-documents-upload-review-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './documents-upload-review-preview.component.html',
  styleUrl: './documents-upload-review-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsUploadReviewPreviewComponent {
  readonly fileName = input<string | null>(null);
  readonly fileMeta = input('1 page · 0 KB');
  readonly imagePreviewUrl = input<string | null>(null);
  readonly pdfPreviewUrl = input<SafeResourceUrl | null>(null);
  readonly hasImagePreview = input(false);
  readonly hasPdfPreview = input(false);
  readonly fieldCount = input(0);
  readonly confidenceLabel = input('OCR draft');
  readonly needsReviewCount = input(0);
  readonly draftId = input<string | null>(null);

  protected get confidenceToneClass(): string {
    const normalized = this.confidenceLabel().toLowerCase();

    if (normalized.includes('low')) {
      return 'documents-upload-review-preview__summary-low';
    }

    if (normalized.includes('medium')) {
      return 'documents-upload-review-preview__summary-warn';
    }

    return 'documents-upload-review-preview__summary-good';
  }
}
