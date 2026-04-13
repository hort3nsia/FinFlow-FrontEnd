import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { CurrentWorkspaceFacade } from '../data/current-workspace.facade';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPageComponent implements OnInit {
  private readonly currentWorkspaceFacade = inject(CurrentWorkspaceFacade);

  protected readonly state = this.currentWorkspaceFacade.state;

  ngOnInit(): void {
    this.currentWorkspaceFacade.refresh();
  }
}
