/**
 * Sort/search key for names (`products.name_key`, `customers.name_key`, DATABASE.md §4.5, §4.7):
 * trimmed, lower-case, runs of whitespace collapsed to one space.
 */
export function normalizeNameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Digits of a phone number for search (`phone_digits`); null when there are none. */
export function phoneDigits(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits === '' ? null : digits;
}
