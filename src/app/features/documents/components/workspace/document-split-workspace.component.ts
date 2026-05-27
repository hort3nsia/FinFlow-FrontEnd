import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-document-split-workspace',
  standalone: true,
  templateUrl: './document-split-workspace.component.html',
  styleUrl: './document-split-workspace.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentSplitWorkspaceComponent {}
