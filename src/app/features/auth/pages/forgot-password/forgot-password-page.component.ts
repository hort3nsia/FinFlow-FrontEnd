import { finalize } from 'rxjs';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { BrandMarkComponent } from '../../../../shared/ui/brand-mark/brand-mark.component';

@Component({
  selector: 'app-forgot-password-page',
  imports: [ReactiveFormsModule, RouterLink, BrandMarkComponent],
  templateUrl: './forgot-password-page.component.html',
  styleUrl: './forgot-password-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly form = this.formBuilder.nonNullable.group({
    email: [this.route.snapshot.queryParamMap.get('email') ?? '', [Validators.required, Validators.email]],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.isSubmitting.set(true);
    const email = this.form.controls.email.getRawValue();

    this.authService
      .forgotPassword(email)
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => {
          void this.router.navigate(['/reset-password'], {
            queryParams: {
              email,
              sent: '1',
            },
          });
        },
        error: (error: Error) => {
          this.errorMessage.set(error.message);
        },
      });
  }
}
