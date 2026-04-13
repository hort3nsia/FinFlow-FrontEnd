import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { LandingPageComponent } from './landing-page.component';

describe('LandingPageComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LandingPageComponent],
      providers: [provideRouter([])],
    });
  });

  it('renders the Vietnamese hero and localized pricing labels', () => {
    const fixture = TestBed.createComponent(LandingPageComponent);
    fixture.detectChanges();

    const content = fixture.nativeElement.textContent;

    expect(content).toContain('Một nền tảng rõ ràng hơn cho đội ngũ tài chính');
    expect(content).toContain('Miễn phí');
    expect(content).toContain('Chuyên nghiệp');
    expect(content).toContain('Doanh nghiệp');
  });

  it('toggles the mobile navigation menu', () => {
    const fixture = TestBed.createComponent(LandingPageComponent);
    fixture.detectChanges();

    expect(
      fixture.debugElement.query(By.css('[data-testid="landing-mobile-nav"]')),
    ).toBeNull();

    fixture.debugElement
      .query(By.css('[data-testid="landing-menu-toggle"]'))
      .triggerEventHandler('click', {});
    fixture.detectChanges();

    expect(
      fixture.debugElement.query(By.css('[data-testid="landing-mobile-nav"]')),
    ).not.toBeNull();
  });

  it('renders the Vietnamese workflow-stage headline', () => {
    const fixture = TestBed.createComponent(LandingPageComponent);
    fixture.detectChanges();

    expect(
      fixture.debugElement.query(By.css('[data-testid="active-scenario-title"]')).nativeElement
        .textContent,
    ).toContain('Từ đăng nhập đến xử lý tài chính trong đúng workspace');
  });
});
