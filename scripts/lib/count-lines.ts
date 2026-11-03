/**
 * Physical line count used by the 200-line rule (CODING_STANDARDS.md §2):
 * the number of LF characters, plus one when the file is non-empty and does
 * not end with LF. Blank lines and comments count.
 */
export function countLines(content: string): number {
  if (content.length === 0) {
    return 0;
  }
  const newlines = content.split('\n').length - 1;
  return content.endsWith('\n') ? newlines : newlines + 1;
}
