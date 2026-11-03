import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { normalizeNameKey } from '@pos/domain';

import { createDatabaseClient } from '../src/client.js';

/**
 * Small fake development catalogue (DEPLOYMENT.md §3: `pnpm db:seed`). Generic stationery only, no
 * real customer or shop data. Runs after `scripts/guard-local.ts` (local databases only) and does
 * nothing when categories already exist, so it is safe to run twice.
 */
type Item = [name: string, price: string, stock: number, piecesPerBox?: number, boxPrice?: string];

const CATALOGUE: readonly { name: string; emoji: string; items: readonly Item[] }[] = [
  {
    name: 'Pens',
    emoji: '🖊️',
    items: [
      ['Ball pen blue', '25.00', 120, 10, '230.00'],
      ['Ball pen black', '25.00', 4, 10, '230.00'],
      ['Gel pen red', '40.00', 30],
      ['Fountain pen', '350.00', 6],
      ['Highlighter yellow', '60.00', 2],
    ],
  },
  {
    name: 'Pencils',
    emoji: '✏️',
    items: [
      ['Pencil HB', '15.00', 200, 12, '170.00'],
      ['Pencil 2B', '18.00', 8, 12, '200.00'],
      ['Colour pencils 12', '220.00', 15],
      ['Mechanical pencil 0.5', '90.00', 0],
    ],
  },
  {
    name: 'Notebooks',
    emoji: '📓',
    items: [
      ['Notebook A5 ruled 100 pages', '120.00', 45],
      ['Register 200 pages', '450.00', 3],
      ['Drawing copy A4', '160.00', 25],
      ['Spiral notebook A4', '280.00', 12],
    ],
  },
  {
    name: 'Art supplies',
    emoji: '🎨',
    items: [
      ['Water colours 12', '320.00', 10],
      ['Paint brush set', '250.00', 7],
      ['Crayons 24', '180.00', 1],
    ],
  },
  {
    name: 'Office',
    emoji: '📎',
    items: [
      ['Stapler medium', '450.00', 9],
      ['Staples box', '60.00', 50, 20, '1100.00'],
      ['Paper clips box', '45.00', 40],
      ['Glue stick', '70.00', 5],
      ['Sticky notes', '110.00', 22],
    ],
  },
  {
    name: 'Geometry',
    emoji: '📐',
    items: [
      ['Geometry box', '380.00', 14],
      ['Scale 30 cm', '50.00', 60],
      ['Eraser', '20.00', 3, 20, '360.00'],
      ['Sharpener', '25.00', 80],
    ],
  },
];

const LOW_STOCK_THRESHOLD = 5;

async function main(): Promise<void> {
  const envFile = path.join(import.meta.dirname, '..', '.env');
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile); // local development only (ADR-032)
  }
  const url = process.env['DATABASE_URL'];
  if (url === undefined) {
    throw new Error('DATABASE_URL is not set');
  }
  const prisma = createDatabaseClient({ connectionString: url, maxConnections: 2 });
  try {
    if ((await prisma.category.count()) > 0) {
      process.stdout.write('seed-dev: categories already exist; nothing to do.\n');
      return;
    }
    let barcode = 0;
    const products = CATALOGUE.flatMap((category) => {
      const categoryId = randomUUID();
      return category.items.map(([name, price, stock, piecesPerBox = 1, boxPrice]) => ({
        categoryId,
        category,
        product: {
          id: randomUUID(),
          barcode: `SEED-${String((barcode += 1)).padStart(4, '0')}`,
          name,
          nameKey: normalizeNameKey(name),
          categoryId,
          piecesPerBox,
          salePrice: price,
          boxPrice: boxPrice ?? null,
          lowStockThresholdPieces: LOW_STOCK_THRESHOLD,
          stockPieces: stock,
        },
      }));
    });
    const categories = new Map(products.map((row) => [row.categoryId, row.category]));
    await prisma.$transaction([
      prisma.category.createMany({
        data: [...categories].map(([id, category]) => ({
          id,
          name: category.name,
          iconEmoji: category.emoji,
        })),
      }),
      prisma.product.createMany({ data: products.map((row) => row.product) }),
      prisma.stockMovement.createMany({
        data: products
          .filter((row) => row.product.stockPieces > 0)
          .map(({ product }) => ({
            productId: product.id,
            type: 'OPENING' as const,
            quantityPieces: product.stockPieces,
            balanceAfter: product.stockPieces,
          })),
      }),
    ]);
    process.stdout.write(
      `seed-dev: ${String(categories.size)} categories, ${String(products.length)} products.\n`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

await main();
