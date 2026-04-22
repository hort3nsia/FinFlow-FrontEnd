import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { vi } from 'vitest';
import { AuthService } from '../../core/auth/auth.service';
import { AppShellComponent } from './app-shell.component';

describe('AppShellComponent', () => {
  const authService = {
    userEmail: () => 'demo@finflow.local',
    logout: vi.fn(),
  };

  beforeEach(async () => {
    authService.logout.mockReset();

    await TestBed.configureTestingModule({
      imports: [RouterTestingModule, AppShellComponent],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compileComponents();
  });

  it('renders the signed-in account trigger in the shell header', () => {
    const fixture = TestBed.createComponent(AppShellComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('FinFlow Systems');
    expect(fixture.nativeElement.textContent).toContain('Finance Workspace');
    expect(fixture.nativeElement.textContent).toContain('Workspace Overview');
    expect(fixture.nativeElement.textContent).toContain('Documents');
    expect(fixture.nativeElement.textContent).toContain('Approvals');
    expect(fixture.nativeElement.textContent).toContain('Expenses');
    expect(fixture.nativeElement.textContent).toContain('Search workspace...');
    expect(fixture.nativeElement.textContent).toContain('demo@finflow.local');
  });

  it('renders stable shell layout hooks for sidebar and content framing', () => {
    const fixture = TestBed.createComponent(AppShellComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.shell__sidebar-pane')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.shell__main-frame')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.shell__content-shell')).toBeTruthy();
  });

  it('opens the account dropdown and logs out from the shell menu', () => {
    const fixture = TestBed.createComponent(AppShellComponent);
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.shell__account-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Đăng xuất');

    const logoutButton = fixture.nativeElement.querySelector('.shell__account-item--danger') as HTMLButtonElement;
    logoutButton.click();

    expect(authService.logout).toHaveBeenCalledTimes(1);
  });
});
