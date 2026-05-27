import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-document-action-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './document-action-bar.component.html',
  styleUrl: './document-action-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentActionBarComponent {
  readonly saveLabel = input('Lưu nháp');
  readonly submitLabel = input('Trình phê duyệt');
  readonly saveDisabled = input(false);
  readonly submitDisabled = input(false);
  readonly savePending = input(false);
  readonly submitPending = input(false);

  readonly saveClicked = output<void>();
  readonly submitClicked = output<void>();
}
