/**
 * Standard expense categories used across the platform.
 * Both manual entry and OCR review pages use this list.
 * OCR output is matched against these names; unmatched values
 * fall back to "Khác" (Other).
 */
export const EXPENSE_CATEGORIES: readonly string[] = [
  'Văn phòng phẩm',
  'Đi lại & Vận chuyển',
  'Ăn uống & Tiếp khách',
  'Công nghệ & Phần mềm',
  'Thiết bị & Dụng cụ',
  'Thuê mặt bằng & Tiện ích',
  'Marketing & Quảng cáo',
  'Đào tạo & Phát triển',
  'Bảo hiểm',
  'Dịch vụ chuyên môn',
  'Nguyên vật liệu',
  'Bảo trì & Sửa chữa',
  'Vận hành sản xuất',
  'Phúc lợi nhân viên',
  'Thuế & Phí',
  'Khác',
];

/**
 * Matches an OCR-extracted category string to the closest known category.
 * Returns the matched category name, or "Khác" if no reasonable match found.
 */
export function matchOcrCategory(ocrValue: string | null | undefined): string {
  if (!ocrValue || !ocrValue.trim()) return 'Khác';

  const normalized = ocrValue.trim().toLowerCase();

  // Exact match first
  const exact = EXPENSE_CATEGORIES.find(
    (cat) => cat.toLowerCase() === normalized,
  );
  if (exact) return exact;

  // Keyword-based matching
  const keywordMap: Record<string, string[]> = {
    'Văn phòng phẩm': ['office', 'supplies', 'văn phòng', 'giấy', 'mực', 'bút'],
    'Đi lại & Vận chuyển': ['travel', 'transport', 'đi lại', 'vận chuyển', 'taxi', 'grab', 'xăng', 'vé máy bay', 'flight'],
    'Ăn uống & Tiếp khách': ['food', 'meal', 'dining', 'ăn', 'uống', 'tiếp khách', 'restaurant', 'nhà hàng', 'groceries'],
    'Công nghệ & Phần mềm': ['tech', 'software', 'saas', 'cloud', 'phần mềm', 'công nghệ', 'hosting', 'domain'],
    'Thiết bị & Dụng cụ': ['equipment', 'hardware', 'thiết bị', 'dụng cụ', 'máy', 'laptop', 'phone'],
    'Thuê mặt bằng & Tiện ích': ['rent', 'utility', 'thuê', 'điện', 'nước', 'internet', 'mặt bằng'],
    'Marketing & Quảng cáo': ['marketing', 'ads', 'advertising', 'quảng cáo', 'pr', 'truyền thông'],
    'Đào tạo & Phát triển': ['training', 'education', 'đào tạo', 'hội thảo', 'course', 'workshop'],
    'Bảo hiểm': ['insurance', 'bảo hiểm'],
    'Dịch vụ chuyên môn': ['consulting', 'legal', 'audit', 'tư vấn', 'luật', 'kiểm toán', 'dịch vụ'],
    'Nguyên vật liệu': ['material', 'raw', 'nguyên vật liệu', 'vật tư'],
    'Bảo trì & Sửa chữa': ['maintenance', 'repair', 'bảo trì', 'sửa chữa'],
    'Vận hành sản xuất': ['production', 'manufacturing', 'sản xuất', 'vận hành'],
    'Phúc lợi nhân viên': ['benefit', 'welfare', 'phúc lợi', 'nhân viên', 'team building'],
    'Thuế & Phí': ['tax', 'fee', 'thuế', 'phí', 'lệ phí'],
  };

  for (const [category, keywords] of Object.entries(keywordMap)) {
    if (keywords.some((kw) => normalized.includes(kw))) {
      return category;
    }
  }

  return 'Khác';
}
