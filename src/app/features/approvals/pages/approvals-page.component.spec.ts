import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApprovalsApiService } from '../data/approvals-api.service';
import { ApprovalsPageComponent } from './approvals-page.component';

describe('ApprovalsPageComponent', () => {
  const queryText = (fixture: { nativeElement: HTMLElement }, selector: string) =>
    fixture.nativeElement.querySelector(selector)?.textContent?.trim();

  const approvalsApi = {
    getPendingApprovalItems: vi.fn(),
  };

  beforeEach(async () => {
    approvalsApi.getPendingApprovalItems.mockReset();

    await TestBed.configureTestingModule({
      imports: [ApprovalsPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ApprovalsApiService,
          useValue: approvalsApi,
        },
      ],
    }).compileComponents();
  });

  it('describes approvals as a manager decision workspace instead of a documents routing queue', () => {
    approvalsApi.getPendingApprovalItems.mockReturnValue(
      of([
        {
          documentId: 'doc-123',
          title: 'AWS October invoice',
          requester: 'Nguyen Staff',
          department: 'Infrastructure',
          amount: 1450,
          dueDate: 'Today',
          priority: 'High',
          status: 'Pending',
        },
      ]),
    );

    const fixture = TestBed.createComponent(ApprovalsPageComponent);
    fixture.detectChanges();

    expect(queryText(fixture, '[data-testid="approvals-title"]')).toBe('Approvals');
    expect(queryText(fixture, '[data-testid="approvals-copy"]')?.toLowerCase()).toContain(
      'manager decisions',
    );
    expect(queryText(fixture, '[data-testid="approvals-queue-title"]')).toBe('Approval Queue');
    expect(fixture.nativeElement.textContent).toContain('Submitted requests awaiting manager review.');
    expect(fixture.nativeElement.textContent).not.toContain(
      'Items routed here after OCR review and policy checks.',
    );
    expect(fixture.nativeElement.textContent).not.toContain('Documents review');
  });

  it('shows a real load error and does not render fake queue items when the API fails', () => {
    approvalsApi.getPendingApprovalItems.mockReturnValue(
      throwError(() => new Error('Approvals unavailable.')),
    );

    const fixture = TestBed.createComponent(ApprovalsPageComponent);
    fixture.detectChanges();

    expect(queryText(fixture, '[data-testid="approvals-load-error"]')).toContain(
      'Approvals unavailable.',
    );
    expect(fixture.nativeElement.textContent).not.toContain('AWS October invoice');
    expect(fixture.nativeElement.textContent).not.toContain('Nguyen Staff');
    expect(fixture.nativeElement.textContent).not.toContain('Blue Ginger client lunch');
    expect(
      fixture.nativeElement.querySelector('[data-testid="approvals-kpi-grid"]'),
    ).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Waiting now');
    expect(fixture.nativeElement.textContent).not.toContain('Avg. decision time');
  });
});
