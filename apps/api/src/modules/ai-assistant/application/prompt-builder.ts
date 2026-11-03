import type { ChatMessage } from '../../../infrastructure/ai/groq.client';
import type { AiFeature, AiLanguage } from '@pos/contracts';

/** Answer language (F-29: English, Urdu script, Roman Urdu). */
const LANGUAGE_RULE: Readonly<Record<AiLanguage, string>> = {
  ENGLISH: 'Write the whole answer in English.',
  URDU:
    'Write the whole answer in Urdu, in Urdu script. Keep product names, numbers and "Rs" ' +
    'exactly as they appear in the data.',
  ROMAN_URDU:
    'Write the whole answer in Roman Urdu (Urdu written in English letters, as it is typed in ' +
    'Pakistan). Keep product names and numbers exactly as they appear in the data.',
};

const TASK: Readonly<Record<AiFeature, string>> = {
  SALES_INSIGHTS:
    'Sales insights. Explain how sales went in the period compared with the previous period of ' +
    'the same length, the trend over the series, the best and slowest sellers and the payment ' +
    'methods. End with 3 to 5 practical suggestions.',
  INVENTORY_FORECAST:
    'Inventory forecast. From units sold per day over the last 30 days and the stock on hand, say ' +
    'which products will run out first and in about how many days, which are already low, and ' +
    'which are safe.',
  PURCHASE_RECOMMENDATIONS:
    'Purchase recommendations. From the 45-day sales rate, recommend what to buy, grouped by ' +
    'priority (urgent, soon, later). Use piecesFor30Days and estimatedCost as given, and give the ' +
    'total estimated cost of the urgent and soon groups. Mention products without a cost price.',
  ASK:
    "Ask Your POS. Answer the owner's question about the shop. Use the tools to get figures; " +
    'call a tool instead of guessing.',
  BUSINESS_REPORT:
    'Business report for printing, with the headings Summary, Sales, Products, Payments, Stock ' +
    'and Notes. Compare with the previous period where the data allows.',
  DISCOUNT_ADVICE:
    'Discount advice for slow-moving stock. Suggest which products to discount and by about how ' +
    'much, with reasons. These are recommendations only: no discount is applied automatically ' +
    'and the owner decides. Never say a discount has been applied, and never suggest a price ' +
    'below the cost price.',
};

const RULES = [
  'You are the assistant inside the point-of-sale system of a stationery shop in Pakistan.',
  'Use only the numbers in the data or tool results you are given. If they do not answer ' +
    'something, say so. Never invent figures, products or dates.',
  'Money is in Pakistani rupees: write amounts like "Rs 1,234.50". Stock and units are in ' +
    'pieces; piecesPerBox says how many pieces make one box.',
  'Net sales are bills minus refunds; refunds count on the day they were given.',
  'You have no information about individual customers and must not ask for any.',
  'Format the answer as Markdown: short headings, bullet lists and small tables. No HTML and no ' +
    'code blocks. Keep it concise.',
];

/** System prompt for one feature and language (SYSTEM_DESIGN.md §8 step 4). */
export function systemPrompt(feature: AiFeature, language: AiLanguage, today: string): string {
  return [
    ...RULES,
    `Today is ${today} (Asia/Karachi).`,
    `Task: ${TASK[feature]}`,
    LANGUAGE_RULE[language],
  ].join('\n');
}

/** The data message: compact JSON of bounded aggregates, product names and numbers only (Q17b). */
export function dataMessage(facts: unknown): string {
  return `Shop data (JSON):\n${JSON.stringify(facts)}`;
}

/** The two messages of a single-shot feature. */
export function featureMessages(
  feature: AiFeature,
  language: AiLanguage,
  today: string,
  facts: unknown,
): ChatMessage[] {
  return [
    { role: 'system', content: systemPrompt(feature, language, today) },
    { role: 'user', content: dataMessage(facts) },
  ];
}
