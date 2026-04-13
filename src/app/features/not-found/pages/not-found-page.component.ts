import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BrandMarkComponent } from '../../../shared/ui/brand-mark/brand-mark.component';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink, BrandMarkComponent],
  templateUrl: './not-found-page.component.html',
  styleUrl: './not-found-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundPageComponent {}
