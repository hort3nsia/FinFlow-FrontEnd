import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface OcrReviewLineItem {
  itemName: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  total: number;
  kind: OcrLineItemKind;
}

export type OcrLineItemKind = 'standard' | 'adjustment' | 'discount';

@Component({
  selector: 'app-documents-ocr-line-item-row',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './documents-ocr-line-item-row.component.html',
  styleUrl: './documents-ocr-line-item-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsOcrLineItemRowComponent {
  readonly item = input.required<OcrReviewLineItem>();
  readonly index = input.required<number>();
  readonly rowCount = input.required<number>();
  readonly dragging = input(false);

  readonly fieldChange = output<{ field: keyof OcrReviewLineItem; value: string }>();
  readonly moveUp = output<void>();
  readonly moveDown = output<void>();
  readonly remove = output<void>();
  readonly dragStarted = output<void>();
  readonly dragEnded = output<void>();
  readonly rowDropped = output<void>();
  readonly rowDragOver = output<DragEvent>();

  protected get rowNumber(): number {
    return this.index() + 1;
  }

  protected get kindLabel(): string | null {
    if (this.item().kind === 'discount') {
      return 'Discount line';
    }

    if (this.item().kind === 'adjustment') {
      return 'Order-level Adjustment';
    }

    return null;
  }

  protected get isFirstRow(): boolean {
    return this.index() === 0;
  }

  protected get isSingleRow(): boolean {
    return this.rowCount() === 1;
  }

  protected get isLastRow(): boolean {
    return this.index() === this.rowCount() - 1;
  }

  protected emitFieldChange(field: keyof OcrReviewLineItem, value: string): void {
    this.fieldChange.emit({ field, value });
  }

  protected normalizeDiscountInput(value: string): string {
    return value.replace(/^-/, '');
  }

  protected allowDrop(event: DragEvent): void {
    this.rowDragOver.emit(event);
  }

  protected netAmount(item: OcrReviewLineItem): number {
    return item.quantity * item.unitPrice - item.discountAmount;
  }

  protected formatMoney(value: number): string {
    return value.toFixed(2);
  }
}
