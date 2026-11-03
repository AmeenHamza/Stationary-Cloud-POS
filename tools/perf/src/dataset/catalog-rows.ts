import { DATASET } from '../config.js';
import { seededRandom } from '../random.js';

/** One item type per category, with an Urdu name (sizes like the screenshots, no real data). */
const ITEMS: readonly (readonly [string, string])[] = [
  ['Ball pen', 'بال پین'],
  ['Gel pen', 'جیل پین'],
  ['Marker', 'مارکر'],
  ['Highlighter', 'ہائی لائٹر'],
  ['Pencil', 'پنسل'],
  ['Eraser', 'ربڑ'],
  ['Sharpener', 'شارپنر'],
  ['Notebook', 'کاپی'],
  ['Register', 'رجسٹر'],
  ['A4 paper', 'اے فور کاغذ'],
  ['Glue stick', 'گلو اسٹک'],
  ['Stapler', 'اسٹیپلر'],
  ['File cover', 'فائل کور'],
  ['Geometry box', 'جیومیٹری باکس'],
  ['Colour pencils', 'رنگین پنسلیں'],
  ['Scale', 'اسکیل'],
  ['Calculator', 'کیلکولیٹر'],
  ['Envelope', 'لفافہ'],
  ['Sticky notes', 'اسٹکی نوٹس'],
  ['Whiteboard marker', 'وائٹ بورڈ مارکر'],
  ['Chart paper', 'چارٹ پیپر'],
  ['Crayons', 'کریون'],
];
const BRANDS = [
  'Dollar',
  'Piano',
  'Deer',
  'Oxford',
  'Faber',
  'Staedtler',
  'Pelikan',
  'Pilot',
  'Casio',
  'Shan',
];
const VARIANTS = [
  'Blue',
  'Black',
  'Red',
  'Green',
  'Small',
  'Large',
  '200 pages',
  '100 pages',
  'Pack of 10',
  'Premium',
  'Fine 0.5 mm',
  'Medium 0.7 mm',
];

export interface ProductRow {
  barcode: string;
  name: string;
  nameUrdu: string | null;
  categoryIndex: number;
  piecesPerBox: number;
  salePrice: string;
  boxPrice: string | null;
  costPrice: string;
  taxRate: string;
  lowStockThresholdPieces: number;
  stockPieces: number;
}

export const CATEGORY_NAMES = ITEMS.slice(0, DATASET.categories).map(([name]) => name);

const money = (value: number): string => value.toFixed(2);

/** The catalogue, the same on every run (seeded). Every 17th product is sold by the box as well. */
export function productRows(): ProductRow[] {
  const random = seededRandom(DATASET.seed);
  return Array.from({ length: DATASET.products }, (_, index) => {
    const categoryIndex = index % CATEGORY_NAMES.length;
    const [item, urdu] = ITEMS[categoryIndex] ?? ['Item', 'آئٹم'];
    const price = random.int(10, 1_500);
    const boxed = index % 17 === 0;
    const piecesPerBox = boxed ? random.pick([10, 12, 24]) : 1;
    const low = random.chance(DATASET.lowStockShare);
    return {
      barcode: `89${String(index + 1).padStart(11, '0')}`,
      name: `${random.pick(BRANDS)} ${item} ${random.pick(VARIANTS)} ${String(index + 1)}`,
      nameUrdu: random.chance(DATASET.urduNameShare) ? urdu : null,
      categoryIndex,
      piecesPerBox,
      salePrice: money(price),
      boxPrice: boxed ? money(price * piecesPerBox * 0.9) : null,
      costPrice: money(price * 0.7),
      taxRate: random.chance(0.2) ? '5.00' : '0.00',
      lowStockThresholdPieces: 10,
      stockPieces: low ? random.int(0, 10) : random.int(20, 500),
    };
  });
}

const FIRST = [
  'Ahmed',
  'Sara',
  'Bilal',
  'Ayesha',
  'Usman',
  'Fatima',
  'Hamza',
  'Zainab',
  'Ali',
  'Maryam',
];
const LAST = [
  'Khan',
  'Malik',
  'Butt',
  'Qureshi',
  'Sheikh',
  'Raza',
  'Iqbal',
  'Hussain',
  'Chaudhry',
  'Mirza',
];

/** Made-up parties: generated names and 0300-style numbers, never real people (rule 10). */
export function partyRows(count: number, prefix: string): { name: string; phone: string }[] {
  const random = seededRandom(DATASET.seed + count);
  return Array.from({ length: count }, (_, index) => ({
    name: `${prefix} ${random.pick(FIRST)} ${random.pick(LAST)} ${String(index + 1)}`,
    phone: `0300 ${String(1_000_000 + index).padStart(7, '0')}`,
  }));
}
