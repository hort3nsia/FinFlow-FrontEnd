import { finalize } from 'rxjs';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-create-workspace-page',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './create-workspace-page.component.html',
  styleUrl: './create-workspace-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateWorkspacePageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  protected readonly errorMessage = signal<string | null>(null);
  protected readonly isSubmitting = signal(false);
  protected readonly form = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    tenantCode: ['', [Validators.required, Validators.pattern(/^[a-z0-9-]+$/)]],
    currency: ['VND', [Validators.required]],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.isSubmitting.set(true);

    const { name, tenantCode, currency } = this.form.getRawValue();

    this.authService
      .createWorkspace({ name, tenantCode, currency })
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => {
          this.authService.goToDashboard();
        },
        error: (error: Error) => {
          this.errorMessage.set(error.message);
        },
      });
  }
}
