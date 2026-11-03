export interface Finding {
  file: string;
  line?: number;
  rule: string;
  detail: string;
}

function format(finding: Finding): string {
  const location =
    finding.line === undefined ? finding.file : `${finding.file}:${String(finding.line)}`;
  return `  ${location}  [${finding.rule}] ${finding.detail}`;
}

/**
 * Prints findings and returns the process exit code: 1 when any error exists.
 * Output is bounded (first 200 of each kind) so a broken tree never floods the terminal.
 */
export function finish(name: string, errors: Finding[], warnings: Finding[] = []): number {
  const limit = 200;
  if (warnings.length > 0) {
    console.log(`${name}: ${String(warnings.length)} warning(s)`);
    warnings.slice(0, limit).forEach((w) => {
      console.log(format(w));
    });
  }
  if (errors.length > 0) {
    console.error(`${name}: FAILED with ${String(errors.length)} error(s)`);
    errors.slice(0, limit).forEach((e) => {
      console.error(format(e));
    });
    return 1;
  }
  console.log(`${name}: PASS`);
  return 0;
}
