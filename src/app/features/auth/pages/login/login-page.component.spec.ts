import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../../../core/auth/auth.service';
import { LoginPageComponent } from './login-page.component';

describe('LoginPageComponent', () => {
  const authService = {
    login: vi.fn(),
    goToWorkspaceSelection: vi.fn(),
  };

  beforeEach(() => {
    authService.login.mockReset();
    authService.goToWorkspaceSelection.mockReset();

    TestBed.configureTestingModule({
      imports: [LoginPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    });
  });

  it('renders the split-auth structure with the required Vietnamese content', () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const shell = host.querySelector('.login-page__shell');
    const rail = host.querySelector('.login-page__rail');
    const panel = host.querySelector('.login-page__panel');
    const form = host.querySelector('form.login-form');
    const railPoints = host.querySelectorAll('.login-page__points li');
    const panelHeading = panel?.querySelector('h2');
    const panelCopy = panel?.querySelector('.login-page__copy');
    const footerLink = host.querySelector('.login-page__footer a');
    const emailInput = host.querySelector('input[formcontrolname="email"]');
    const passwordInput = host.querySelector('input[formcontrolname="password"]');

    expect(shell).not.toBeNull();
    expect(rail).not.toBeNull();
    expect(panel).not.toBeNull();
    expect(form).not.toBeNull();
    expect(rail?.textContent).toContain('Quay lại trang chủ');
    expect(rail?.textContent).toContain('FinFlow');
    expect(rail?.textContent).toContain('Đăng nhập để tiếp tục làm việc trong đúng workspace.');
    expect(rail?.textContent).toContain(
      'Xử lý chứng từ, theo dõi phê duyệt và tra cứu nhanh trên cùng một nền tảng tài chính.',
    );
    expect(railPoints).toHaveLength(3);
    expect(Array.from(railPoints, (point) => point.textContent?.trim())).toEqual([
      'AI OCR cho chứng từ đầu vào',
      'Workflow phê duyệt rõ ràng',
      'Dữ liệu luôn đi cùng đúng workspace',
    ]);
    expect(panelHeading?.textContent?.trim()).toBe('Đăng nhập');
    expect(panelCopy?.textContent?.trim()).toBe(
      'Sử dụng email và mật khẩu để truy cập tài khoản của bạn.',
    );
    expect(emailInput?.getAttribute('placeholder')).toBe('Email address (required)');
    expect(passwordInput?.getAttribute('placeholder')).toBe('Nhập mật khẩu');
    expect(footerLink?.textContent?.trim()).toBe('Tạo tài khoản');
  });

  it('shows Vietnamese validation copy and accessible error semantics when submitting an empty form', () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();

    fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit', {});
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const text = host.textContent;
    const emailInput = host.querySelector('input[formcontrolname="email"]');
    const passwordInput = host.querySelector('input[formcontrolname="password"]');
    const emailError = host.querySelector('#login-email-error');
    const passwordError = host.querySelector('#login-password-error');

    expect(authService.login).not.toHaveBeenCalled();
    expect(text).toContain('Email là bắt buộc.');
    expect(text).toContain('Mật khẩu là bắt buộc.');
    expect(text).toContain('Đăng nhập');
    expect(emailInput?.getAttribute('aria-invalid')).toBe('true');
    expect(passwordInput?.getAttribute('aria-invalid')).toBe('true');
    expect(emailInput?.getAttribute('aria-describedby')).toBe('login-email-error');
    expect(passwordInput?.getAttribute('aria-describedby')).toBe('login-password-error');
    expect(emailError?.textContent).toContain('Email là bắt buộc.');
    expect(passwordError?.textContent).toContain('Mật khẩu là bắt buộc.');
  });

  it('navigates to the workspace hub after a successful account login', () => {
    authService.login.mockReturnValue(
      of({
        accessToken: 'access-123',
        refreshToken: 'refresh-123',
        id: 'account-1',
        email: 'demo@finflow.local',
        sessionKind: 'account',
      }),
    );

    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance as LoginPageComponent & {
      form: {
        setValue(value: { email: string; password: string }): void;
      };
    };

    component.form.setValue({
      email: 'demo@finflow.local',
      password: 'Pass@word1',
    });

    fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit', {});

    expect(authService.login).toHaveBeenCalledWith({
      email: 'demo@finflow.local',
      password: 'Pass@word1',
    });
    expect(authService.goToWorkspaceSelection).toHaveBeenCalledTimes(1);
  });

  it('shows a backend error when login fails', () => {
    authService.login.mockReturnValue(
      throwError(() => new Error('Invalid credentials')),
    );

    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance as LoginPageComponent & {
      form: {
        setValue(value: { email: string; password: string }): void;
      };
    };

    component.form.setValue({
      email: 'demo@finflow.local',
      password: 'Pass@word1',
    });

    fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit', {});
    fixture.detectChanges();

    expect(authService.goToWorkspaceSelection).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Invalid credentials');
  });

  it('shows the loading submit label while login is in progress', () => {
    authService.login.mockReturnValue(of(null));

    const fixture = TestBed.createComponent(LoginPageComponent);
    (
      fixture.componentInstance as LoginPageComponent & {
        isSubmitting: { set(value: boolean): void };
      }
    ).isSubmitting.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Đang đăng nhập...');
  });

  it('toggles password visibility from hidden to visible and back', () => {
    const fixture = TestBed.createComponent(LoginPageComponent);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const passwordInput = host.querySelector(
      'input[formcontrolname="password"]',
    ) as HTMLInputElement;
    const toggle = host.querySelector(
      '.login-form__password-toggle',
    ) as HTMLButtonElement;
    const initialIcon = toggle.querySelector('svg');

    expect(passwordInput.type).toBe('password');
    expect(initialIcon).not.toBeNull();
    expect(toggle.getAttribute('aria-label')).toBe('Hiện mật khẩu');

    toggle.click();
    fixture.detectChanges();

    expect(passwordInput.type).toBe('text');
    expect(toggle.getAttribute('aria-label')).toBe('Ẩn mật khẩu');

    toggle.click();
    fixture.detectChanges();

    expect(passwordInput.type).toBe('password');
    expect(toggle.getAttribute('aria-label')).toBe('Hiện mật khẩu');
  });
});
