import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import {
  AbstractControl,
  FormGroup,
  ReactiveFormsModule,
  UntypedFormArray,
  UntypedFormBuilder,
  Validators,
} from '@angular/forms';

@Component({
  selector: 'app-document-line-items-editor',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './document-line-items-editor.component.html',
  styleUrl: './document-line-items-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentLineItemsEditorComponent {
  private readonly formBuilder = inject(UntypedFormBuilder);

  readonly lineItems = input.required<UntypedFormArray>();
  readonly disabled = input(false);

  protected addLineItem(): void {
    this.lineItems().push(
      this.formBuilder.group({
        itemName: ['', Validators.required],
        quantity: [1, [Validators.required, Validators.min(0.01)]],
        unitPrice: [0, [Validators.required, Validators.min(0)]],
        total: [0, [Validators.required, Validators.min(0)]],
      }),
    );
  }

  protected removeLineItem(index: number): void {
    if (this.lineItems().length <= 1) {
      return;
    }

    this.lineItems().removeAt(index);
  }

  protected trackByIndex(index: number): number {
    return index;
  }

  protected asFormGroup(control: unknown): FormGroup {
    return control as FormGroup;
  }

  protected hasError(control: AbstractControl | null): boolean {
    return !!control && control.invalid && control.touched;
  }

  protected getErrorMessage(control: AbstractControl | null, fieldName: string): string | null {
    if (!control || !control.touched || !control.errors) {
      return null;
    }

    if (control.errors['required']) {
      return `Line item ${fieldName} is required.`;
    }

    if (control.errors['min']) {
      if (fieldName === 'quantity') {
        return 'Line item quantity must be greater than 0.';
      }

      return `Line item ${fieldName} must be 0 or more.`;
    }

    return 'Please review this line item field.';
  }
}
