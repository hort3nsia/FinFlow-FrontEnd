import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-document-surface-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './document-surface-card.component.html',
  styleUrl: './document-surface-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentSurfaceCardComponent {
  readonly title = input<string | null>(null);
  readonly eyebrow = input<string | null>(null);
  readonly compact = input(false);
}
