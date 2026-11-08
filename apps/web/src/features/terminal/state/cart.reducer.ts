import { MAX_LINES_PER_SALE, MAX_QUANTITY_PER_LINE } from '@pos/contracts';

import { EMPTY_CART, type CartAction, type CartLine, type CartState } from './cart.types';

const same = (line: CartLine, productId: string, unit: string): boolean =>
  line.productId === productId && line.unit === unit;

const clamp = (quantity: number): number => Math.min(Math.max(quantity, 0), MAX_QUANTITY_PER_LINE);

/** Adds `quantity` to a (product, unit) line, merging instead of duplicating (API.md §10.1). */
function addTo(lines: CartLine[], line: CartLine): CartLine[] {
  const existing = lines.find((candidate) => same(candidate, line.productId, line.unit));
  if (existing !== undefined) {
    return lines.map((candidate) =>
      candidate === existing
        ? { ...candidate, quantity: clamp(candidate.quantity + line.quantity) }
        : candidate,
    );
  }
  return lines.length >= MAX_LINES_PER_SALE ? lines : [...lines, line];
}

/** The cart (SYSTEM_DESIGN.md §3.1): at most 100 lines (Q34), 1–10,000 per line. */
export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add':
      return {
        ...state,
        lines: addTo(state.lines, { productId: action.productId, unit: action.unit, quantity: 1 }),
      };
    case 'addMany':
      return {
        ...state,
        lines: addTo(state.lines, {
          productId: action.productId,
          unit: action.unit,
          quantity: clamp(action.quantity),
        }),
      };
    case 'setQuantity': {
      const quantity = clamp(action.quantity);
      return {
        ...state,
        lines:
          quantity === 0
            ? state.lines.filter((line) => !same(line, action.productId, action.unit))
            : state.lines.map((line) =>
                same(line, action.productId, action.unit) ? { ...line, quantity } : line,
              ),
      };
    }
    case 'addCustom':
      return { ...state, customLines: [...state.customLines, action.line] };
    case 'updateCustom':
      return {
        ...state,
        customLines: state.customLines.map((line) =>
          line.id === action.id ? { ...line, ...action.patch } : line,
        ),
      };
    case 'removeCustom':
      return { ...state, customLines: state.customLines.filter((line) => line.id !== action.id) };
    case 'changeUnit': {
      const moved = state.lines.find((line) => same(line, action.productId, action.from));
      if (moved === undefined || action.from === action.to) {
        return state;
      }
      const rest = state.lines.filter((line) => line !== moved);
      return { ...state, lines: addTo(rest, { ...moved, unit: action.to }) };
    }
    case 'remove':
      return {
        ...state,
        lines: state.lines.filter((line) => !same(line, action.productId, action.unit)),
      };
    case 'removeProducts':
      return {
        ...state,
        lines: state.lines.filter((line) => !action.productIds.includes(line.productId)),
      };
    case 'setDiscount':
      return { ...state, discount: action.discount };
    case 'setLineDiscount':
      return {
        ...state,
        lines: state.lines.map((line) =>
          same(line, action.productId, action.unit) ? { ...line, discount: action.discount } : line,
        ),
      };
    case 'setBillGst':
      return { ...state, billGst: action.billGst };
    case 'setPaymentMethod':
      return {
        ...state,
        paymentMethod: action.paymentMethod,
        customer: action.paymentMethod === 'UDHAAR' ? state.customer : null,
      };
    case 'setCustomer':
      return { ...state, customer: action.customer };
    case 'clear':
      return EMPTY_CART;
  }
}
