import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SubscriptionApiService } from './subscription-api.service';

describe('SubscriptionApiService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('translates duplicate tenant subscription database errors into a safe billing message', () => {
    const service = TestBed.inject(SubscriptionApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let resultMessage: string | null = null;

    service.changePlan('Pro').subscribe({
      error: (error: Error) => {
        resultMessage = error.message;
      },
    });

    const request = httpTesting.expectOne('/graphql');
    request.flush({
      errors: [
        {
          message:
            '23505: duplicate key value violates unique constraint "IX_tenant_subscription_id_tenant"',
        },
      ],
    });

    expect(resultMessage).toBe(
      'Dữ liệu gói của workspace đang bị trùng ở backend nên chưa thể đổi gói. Vui lòng tải lại trang; nếu vẫn lỗi, cần đồng bộ lại bản ghi subscription của workspace.',
    );
    httpTesting.verify();
  });
});
