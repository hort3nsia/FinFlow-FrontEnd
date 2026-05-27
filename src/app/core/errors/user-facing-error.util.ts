const DEFAULT_ERROR = 'Không thể hoàn tất thao tác. Vui lòng thử lại.';
const TECHNICAL_ERROR =
  'Hệ thống chưa xử lý được yêu cầu này. Vui lòng tải lại hoặc thử lại sau.';

const KNOWN_MESSAGES: Record<string, string> = {
  'Submitter cannot approve their own reviewed document.':
    'Người gửi chứng từ không thể tự phê duyệt chứng từ của mình.',
  'Cannot convert string value \'Guest\' from the database to any value in the mapped \'RoleType\' enum.':
    'Dữ liệu vai trò không hợp lệ. Workspace này không hỗ trợ vai trò Guest.',
};

const TECHNICAL_PATTERNS = [
  /The LINQ expression/i,
  /could not be translated/i,
  /DbSet</i,
  /CommandType='Text'/i,
  /Failed executing DbCommand/i,
  /Cannot convert string value/i,
  /GraphQL.*did not return data/i,
  /Unable to complete the request/i,
];

const looksVietnamese = (value: string): boolean =>
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(value);

export const toUserFacingError = (message: string | null | undefined): string => {
  const trimmed = message?.trim();
  if (!trimmed) return DEFAULT_ERROR;

  const known = KNOWN_MESSAGES[trimmed];
  if (known) return known;

  if (looksVietnamese(trimmed)) return trimmed;

  if (TECHNICAL_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return TECHNICAL_ERROR;
  }

  return trimmed;
};
