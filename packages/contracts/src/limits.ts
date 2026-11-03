/** Shared limits enforced by the API and mirrored by the web app (API.md §3, §10.1). */

/** Backend pagination: default and maximum page size (mandatory 50). */
export const PAGE_SIZE_DEFAULT = 50;
export const PAGE_SIZE_MAX = 50;

/** Lists of orders and ledger entries default to this many past days (D-12). */
export const ARCHIVE_WINDOW_DAYS = 90;

/** Bounded child collections and lookups (API.md §3 bounded exceptions). */
export const MAX_LINES_PER_SALE = 100;
export const MAX_IDS_PER_LOOKUP = 50;

export const MAX_QUANTITY_PER_LINE = 10_000;
export const MAX_STOCK_CHANGE_PIECES = 1_000_000;
export const MAX_PIECES_PER_BOX = 10_000;

/** Largest amount accepted on input: numeric(12,2). */
export const MONEY_INPUT_MAX = '9999999999.99';

export const SEARCH_MIN_CHARS = 2;
export const SEARCH_MAX_CHARS = 60;

export const IMPORT_MAX_ROWS = 5_000;
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

export const AI_HISTORY_MAX_TURNS = 10;
export const AI_HISTORY_MAX_CHARS = 4_000;
export const AI_QUESTION_MAX_CHARS = 500;
/** Sales Insights periods in days (F-29). */
export const AI_INSIGHT_DAYS = [7, 14, 30, 60, 90] as const;
/** Longest custom business report range (API.md §6.2). */
export const AI_CUSTOM_REPORT_MAX_DAYS = 92;
/** Rows any one AI data query may return, and chat tool rounds per question (SYSTEM_DESIGN.md §8). */
export const AI_MAX_ROWS = 50;
export const AI_MAX_TOOL_ROUNDS = 3;
/** Sales velocity windows: forecast 30 days, purchase recommendations 45 days. */
export const AI_FORECAST_DAYS = 30;
export const AI_PURCHASE_DAYS = 45;

/** Upper bound for one realtime event payload (NETWORK_OPTIMIZATION.md §4.3). */
export const MAX_EVENT_BYTES = 1_024;

/** Business time zone used for bill dates and reports (Q18 default). */
export const DEFAULT_BUSINESS_TIMEZONE = 'Asia/Karachi';

/** Dashboard bounds (API.md §3): daily rows, ranking size and its look-back window. */
export const DASHBOARD_MAX_DAYS = 31;
export const RANKING_MAX_LIMIT = 10;
export const RANKING_MAX_DAYS = 90;
