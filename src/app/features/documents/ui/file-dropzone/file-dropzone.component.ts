import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-file-dropzone',
  standalone: true,
  templateUrl: './file-dropzone.component.html',
  styleUrl: './file-dropzone.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FileDropzoneComponent {
  readonly disabled = input(false);
  readonly acceptedTypes = input('.pdf,.png,.jpg,.jpeg,.webp');
  readonly selectedFileName = input<string | null>(null);
  readonly errorMessage = input<string | null>(null);
  readonly fileSelected = output<File>();

  protected readonly isDragActive = signal(false);

  protected onInputChange(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = this.getFirstFile(input?.files);

    if (!file || this.disabled()) {
      return;
    }

    this.fileSelected.emit(file);
    if (input) {
      input.value = '';
    }
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();

    if (!this.disabled()) {
      this.isDragActive.set(true);
    }
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragActive.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragActive.set(false);

    const file = this.getFirstFile(event.dataTransfer?.files);
    if (!file || this.disabled()) {
      return;
    }

    this.fileSelected.emit(file);
  }

  private getFirstFile(files: FileList | ArrayLike<File> | null | undefined): File | null {
    if (!files) {
      return null;
    }

    if ('item' in files && typeof files.item === 'function') {
      return files.item(0);
    }

    return files[0] ?? null;
  }
}
