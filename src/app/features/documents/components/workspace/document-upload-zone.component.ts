import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-document-upload-zone',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './document-upload-zone.component.html',
  styleUrl: './document-upload-zone.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentUploadZoneComponent {
  readonly inputId = input.required<string>();
  readonly title = input.required<string>();
  readonly hint = input.required<string>();
  readonly note = input<string | null>(null);
  readonly fileName = input<string | null>(null);
  readonly dragActive = input(false);
  readonly imagePreviewUrl = input<string | null>(null);
  readonly pdfPreviewUrl = input<SafeResourceUrl | null>(null);
  readonly hasImagePreview = input(false);
  readonly hasPdfPreview = input(false);
  readonly previewPlaceholder = input('Chưa có bản xem trước');
  readonly chooseLabel = input('Chọn tệp');
  readonly emptyIconLabel = input('Tải tệp lên');

  readonly fileSelected = output<Event>();
  readonly dragOverEvent = output<DragEvent>();
  readonly dragLeaveEvent = output<DragEvent>();
  readonly dropEvent = output<DragEvent>();
}
