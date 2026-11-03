/**
 * localStorage that never throws (private mode, blocked storage, server render). Only for small
 * per-browser state: preferences and unsent drafts such as the cart (SYSTEM_DESIGN.md §3.1). It is
 * never the record of anything: bills, stock and khata live only in PostgreSQL.
 */
export const safeLocalStorage = {
  get(key: string): string | null {
    try {
      return typeof window === 'undefined' ? null : window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Not remembered: the draft simply does not survive a reload.
    }
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Nothing stored, nothing to remove.
    }
  },
};
