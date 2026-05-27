import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-document-workspace-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './document-workspace-header.component.html',
  styleUrl: './document-workspace-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentWorkspaceHeaderComponent {
  readonly title = input.required<string>();
  readonly description = input<string | null>(null);
  readonly statusText = input<string | null>(null);
}
