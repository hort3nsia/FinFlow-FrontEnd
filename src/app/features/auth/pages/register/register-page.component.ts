import { finalize } from 'rxjs';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { BrandMarkComponent } from '../../../../shared/ui/brand-mark/brand-mark.component';

@Component({
  selector: 'app-register-page',
  imports: [ReactiveFormsModule, RouterLink, BrandMarkComponent],
  templateUrl: './register-page.component.html',
  styleUrl: './register-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly errorMessage = signal<string | null>(null);
  protected readonly isSubmitting = signal(false);
  protected readonly isPasswordVisible = signal(false);
  protected readonly isConfirmPasswordVisible = signal(false);
  protected readonly form = this.formBuilder.nonNullable.group(
    {
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: this.matchPasswordValidator },
  );

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.isSubmitting.set(true);

    this.authService
      .register({
        name: this.form.controls.name.getRawValue(),
        email: this.form.controls.email.getRawValue(),
        password: this.form.controls.password.getRawValue(),
      })
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => {
          // After register, go to create workspace
          this.authService.goToCreateWorkspace();
        },
        error: (error: Error) => {
          this.errorMessage.set(error.message);
        },
      });
  }

  protected togglePasswordVisibility(): void {
    this.isPasswordVisible.update((value) => !value);
  }

  protected toggleConfirmPasswordVisibility(): void {
    this.isConfirmPasswordVisible.update((value) => !value);
  }

  private matchPasswordValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('password')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;

    if (!password || !confirmPassword) {
      return null;
    }

    return password === confirmPassword ? null : { passwordMismatch: true };
  }
}
