export type LineItemType = 'standard' | 'adjustment' | 'discount';

export interface LineItem {
  type: LineItemType;
  description: string;
  quantity: number;
  grossAmount: number;
  discountAmount: number;
}
