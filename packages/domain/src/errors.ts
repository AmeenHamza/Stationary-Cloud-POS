import type { ErrorCode } from '@pos/contracts';

/**
 * A violated business rule. The API maps it to a GraphQL error with the same code; the web app
 * shows it next to `field` when given (API.md §4).
 */
export class DomainRuleError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = 'DomainRuleError';
  }
}
