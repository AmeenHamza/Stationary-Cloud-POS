import { Injectable } from '@nestjs/common';

import { aiToolArgsSchemas, type AiToolName } from '@pos/validation';

import { DashboardService, InsightsService } from '../../reporting';

import { namesAndNumbers } from './ai-facts.service';

import type { ChatTool } from '../../../infrastructure/ai/groq.client';
import type { z } from 'zod';

const days = { type: 'integer', minimum: 1, maximum: 90, description: 'Days ending today' };
const limit = (maximum: number) => ({ type: 'integer', minimum: 1, maximum });

const tool = (name: AiToolName, description: string, properties: object, required: string[] = []) =>
  ({
    type: 'function',
    function: { name, description, parameters: { type: 'object', properties, required } },
  }) satisfies ChatTool;

/** The whitelisted read-only tools of "Ask Your POS" (SYSTEM_DESIGN.md §8 step 6). */
export const AI_TOOLS: ChatTool[] = [
  tool(
    'get_sales_summary',
    'Net sales, bills, discount, tax, refunds and payment methods between two dates (at most 92 days).',
    {
      from: { type: 'string', description: 'First day, YYYY-MM-DD' },
      to: { type: 'string', description: 'Last day, YYYY-MM-DD' },
    },
    ['from', 'to'],
  ),
  tool('get_top_products', 'Best-selling products by units sold.', { days, limit: limit(20) }),
  tool('get_slow_movers', 'Products in stock that sold least.', { days, limit: limit(20) }),
  tool('get_low_stock', 'Products at or below their low-stock level.', { limit: limit(50) }),
  tool(
    'get_product_sales',
    'Units and amount sold for products whose name contains the given text.',
    { product: { type: 'string', description: 'Product name or part of it' }, days },
    ['product'],
  ),
];

const PRODUCT_MATCHES = 10;

const isToolName = (name: string): name is AiToolName => Object.hasOwn(aiToolArgsSchemas, name);

/**
 * Runs the model's tool calls. Unknown tools and out-of-bounds arguments are answered with an error
 * the model can read, never executed; every result is bounded (≤ 50 rows) and holds no customer data.
 */
@Injectable()
export class AiTools {
  constructor(
    private readonly insights: InsightsService,
    private readonly dashboard: DashboardService,
  ) {}

  async run(name: string, rawArguments: string, today: string): Promise<string> {
    if (!isToolName(name)) {
      return JSON.stringify({ error: `Unknown tool "${name}"` });
    }
    let json: unknown;
    try {
      json = rawArguments.trim() === '' ? {} : JSON.parse(rawArguments);
    } catch {
      return JSON.stringify({ error: 'Arguments must be a JSON object' });
    }
    return JSON.stringify(await this.execute(name, json, today));
  }

  private execute(name: AiToolName, json: unknown, today: string): Promise<unknown> {
    const s = aiToolArgsSchemas;
    switch (name) {
      case 'get_sales_summary':
        return this.checked(s.get_sales_summary, json, async ({ from, to }) => ({
          from,
          to,
          totals: await this.insights.totals(from, to),
          paymentMethods: await this.dashboard.methodsBetween(from, to),
        }));
      case 'get_top_products':
        return this.checked(s.get_top_products, json, async (args) =>
          namesAndNumbers(await this.dashboard.ranking(today, { direction: 'HIGHEST', ...args })),
        );
      case 'get_slow_movers':
        return this.checked(s.get_slow_movers, json, (args) =>
          this.insights.slowStock(today, args.days, args.limit),
        );
      case 'get_low_stock':
        return this.checked(s.get_low_stock, json, (args) => this.insights.lowStock(args.limit));
      case 'get_product_sales':
        return this.checked(s.get_product_sales, json, (args) =>
          this.insights.productSales(args.product, today, args.days, PRODUCT_MATCHES),
        );
    }
  }

  private async checked<T>(
    schema: z.ZodType<T>,
    json: unknown,
    use: (args: T) => Promise<unknown>,
  ): Promise<unknown> {
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return {
        error: 'Invalid arguments',
        issues: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
      };
    }
    return use(parsed.data);
  }
}
