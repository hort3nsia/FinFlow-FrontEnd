import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LineItem, LineItemType } from '../pages/documents-manual-page.models';

@Component({
  selector: 'app-documents-manual-line-item-row',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './documents-manual-line-item-row.component.html',
  styleUrl: './documents-manual-line-item-row.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsManualLineItemRowComponent {
  readonly item = input.required<LineItem>();
  readonly index = input.required<number>();
  readonly rowCount = input.required<number>();
  readonly dragging = input(false);

  readonly fieldChange = output<{ field: keyof LineItem; value: string }>();
  readonly moveUp = output<void>();
  readonly moveDown = output<void>();
  readonly remove = output<void>();
  readonly dragStarted = output<void>();
  readonly dragEnded = output<void>();
  readonly rowDropped = output<void>();
  readonly rowDragOver = output<DragEvent>();

  protected readonly lineItemTypeOptions: Array<{ value: LineItemType; label: string }> = [
    { value: 'standard', label: 'Standard line' },
    { value: 'adjustment', label: 'Order-level Adjustment' },
    { value: 'discount', label: 'Discount line' },
  ];

  protected get isFirstRow(): boolean {
    return this.index() === 0;
  }

  protected get isSingleRow(): boolean {
    return this.rowCount() === 1;
  }

  protected get isLastRow(): boolean {
    return this.index() === this.rowCount() - 1;
  }

  protected get rowNumber(): number {
    return this.index() + 1;
  }

  protected emitFieldChange(field: keyof LineItem, value: string): void {
    this.fieldChange.emit({ field, value });
  }

  protected allowDrop(event: DragEvent): void {
    this.rowDragOver.emit(event);
  }

  protected formatMoney(value: number): string {
    return value.toFixed(2);
  }

  protected lineItemTotalValue(item: LineItem): number {
    return item.grossAmount - item.discountAmount;
  }

  protected formatSignedDiscount(value: number): string {
    return value === 0 ? '-0.00' : `-${Math.abs(value).toFixed(2)}`;
  }

  protected normalizeDiscountInput(value: string): string {
    return value.replace(/^-/, '');
  }
}
