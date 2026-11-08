import { toMoneyString, type BillResult } from '@pos/domain';

import type { BillLineInput, LineDiscount, PricedLine } from './sale-pricing';
import type { CreateSaleInput } from '@pos/validation';

export interface CustomPricedLine {
  name: string;
  unit: 'PIECE' | 'BOX';
  quantity: number;
  unitPrice: string;
  taxRate: string;
  discount: LineDiscount;
}

export function customLinesOf(input: CreateSaleInput): CustomPricedLine[] {
  return (input.customLines ?? []).map((line) => ({
    name: line.name,
    unit: line.unit,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    taxRate: line.taxRate,
    discount: line.discount,
  }));
}

/** Whether the bill gives any discount, overall or on an item (`sales:discount`, D-11, D-27). */
export function givesDiscount(input: CreateSaleInput): boolean {
  const onItem = (line: { discount?: LineDiscount }): boolean =>
    (line.discount?.type ?? 'NONE') !== 'NONE';
  return (
    input.discount.type !== 'NONE' ||
    input.lines.some(onItem) ||
    (input.customLines ?? []).some(onItem)
  );
}

export function outOfStockNames(priced: readonly PricedLine[]): string[] {
  return [
    ...new Set(
      priced.filter((line) => line.product.stockPieces <= 0).map((line) => line.product.name),
    ),
  ];
}

export function billLineInputs(
  products: readonly PricedLine[],
  custom: readonly CustomPricedLine[],
): BillLineInput[] {
  return [
    ...products.map((line) => ({
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      taxRate: line.product.taxRate,
      discount: line.discount,
    })),
    ...custom.map((line) => ({
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      taxRate: line.taxRate,
      discount: line.discount,
    })),
  ];
}

export function orderLinesData(
  priced: readonly PricedLine[],
  custom: readonly CustomPricedLine[],
  bill: BillResult,
) {
  const all = [
    ...priced.map((line) => ({
      productId: line.product.id,
      productName: line.product.name,
      productNameUrdu: line.product.nameUrdu,
      barcode: line.product.barcode,
      saleUnit: line.unit,
      piecesPerUnit: line.piecesPerUnit,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxRate: line.product.taxRate,
    })),
    ...custom.map((line) => ({
      productId: null,
      productName: line.name,
      productNameUrdu: null,
      barcode: null,
      saleUnit: line.unit,
      piecesPerUnit: 1,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxRate: line.taxRate,
    })),
  ];
  return all.map((line, index) => {
    const amounts = bill.lines[index];
    if (amounts === undefined) throw new Error('bill line missing');
    return {
      lineNo: index + 1,
      ...line,
      lineGross: toMoneyString(amounts.lineGross),
      itemDiscount: toMoneyString(amounts.itemDiscount),
      lineDiscount: toMoneyString(amounts.lineDiscount),
      lineNet: toMoneyString(amounts.lineNet),
      lineTax: toMoneyString(amounts.lineTax),
    };
  });
}
