import { describe, expect, it } from 'vitest';

import { discountLabel } from './order-labels';

const order = (fields: Partial<Parameters<typeof discountLabel>[0]>) => ({
  discountType: 'NONE' as const,
  discountValue: '0.00',
  discountTotal: '0.00',
  itemDiscountTotal: '0.00',
  ...fields,
});

describe('discountLabel (the order history column)', () => {
  it('shows a dash for no discount', () => {
    expect(discountLabel(order({}))).toBe('—');
  });

  it('keeps the overall discount as it was', () => {
    const flat = order({ discountType: 'FLAT', discountValue: '400.00', discountTotal: '400.00' });
    expect(discountLabel(flat)).toBe('−Rs 400.00 (Flat)');
    const percent = order({
      discountType: 'PERCENT',
      discountValue: '10.00',
      discountTotal: '24.00',
    });
    expect(discountLabel(percent)).toBe('−Rs 24.00 (10.00%)');
  });

  it('says when items were discounted, alone or with an overall discount (D-27)', () => {
    expect(discountLabel(order({ discountTotal: '50.00', itemDiscountTotal: '50.00' }))).toBe(
      '−Rs 50.00 (Items)',
    );
    expect(
      discountLabel(
        order({
          discountType: 'PERCENT',
          discountValue: '10.00',
          discountTotal: '90.00',
          itemDiscountTotal: '50.00',
        }),
      ),
    ).toBe('−Rs 90.00 (10.00% + items)');
  });
});
