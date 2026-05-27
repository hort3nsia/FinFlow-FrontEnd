import { describe, expect, it } from 'vitest';
import { toUserFacingError } from './user-facing-error.util';

describe('toUserFacingError', () => {
  it('translates known backend business errors to Vietnamese', () => {
    expect(
      toUserFacingError('Submitter cannot approve their own reviewed document.'),
    ).toBe('Người gửi chứng từ không thể tự phê duyệt chứng từ của mình.');
  });

  it('hides technical GraphQL and database details behind a safe message', () => {
    expect(
      toUserFacingError(
        "The LINQ expression 'DbSet<Invitation>() .Where(...)' could not be translated.",
      ),
    ).toBe('Hệ thống chưa xử lý được yêu cầu này. Vui lòng tải lại hoặc thử lại sau.');
  });

  it('keeps already friendly Vietnamese errors unchanged', () => {
    expect(toUserFacingError('Vui lòng chọn phòng ban.')).toBe('Vui lòng chọn phòng ban.');
  });
});
