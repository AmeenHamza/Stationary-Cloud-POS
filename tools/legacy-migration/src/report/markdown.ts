import { failedChecks, type RunReport } from './run-report.js';

const PER_KIND = 50;

/** Text safe inside a Markdown table cell. */
export const md = (value: string | number): string =>
  String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');

const bullets = (items: readonly string[]): string[] => items.map((item) => `- ${md(item)}`);

function header(report: RunReport): string[] {
  return [
    `# Legacy migration: ${report.mode}`,
    '',
    '| | |',
    '|---|---|',
    `| Started | ${report.startedAt.toISOString()} |`,
    `| Old database (read only) | ${report.legacy} |`,
    `| New database | ${report.target} |`,
    `| Fingerprint | ${report.fingerprint ?? '—'} |`,
    `| Outcome | ${md(report.outcome)} |`,
    '',
  ];
}

function plannedSection({ planned, preflight }: RunReport): string[] {
  if (planned === null) {
    return [];
  }
  const rows = Object.entries(planned).map(
    ([table, count]) =>
      `| ${table} | ${String(count)} | ${String(preflight?.migrated[table] ?? '—')} |`,
  );
  return [
    '## Planned rows',
    '',
    '| New table | Planned | Already migrated |',
    '|---|---:|---:|',
    ...rows,
    '',
  ];
}

function oldSideSection(report: RunReport): string[] {
  const lines: string[] = [];
  if (report.schemaProblems.length > 0) {
    lines.push('## Old schema problems', '', ...bullets(report.schemaProblems), '');
  }
  if (report.read !== null) {
    const read = Object.entries(report.read).map(([table, n]) => `${table}: ${String(n)}`);
    lines.push('## Old rows read', '', ...bullets(read), '');
  }
  if (report.oldGstRate !== null) {
    lines.push(
      `Old default Bill GST rate: ${report.oldGstRate} % (not copied; the new setting is kept, Q44).`,
      '',
    );
  }
  return lines;
}

function targetSection({ preflight, steps }: RunReport): string[] {
  const lines: string[] = [];
  if (preflight !== null) {
    const problems = preflight.problems.length === 0 ? ['Ready.'] : bullets(preflight.problems);
    lines.push('## New database check', '', ...problems, '');
  }
  if (steps.length > 0) {
    const rows = steps.map((s) => `| ${s.step} | ${String(s.planned)} | ${String(s.inserted)} |`);
    lines.push('## Written', '', '| Step | Planned | Inserted |', '|---|---:|---:|', ...rows, '');
  }
  return lines;
}

function validationSection({ checks }: RunReport): string[] {
  if (checks.length === 0) {
    return [];
  }
  const result = (passed: boolean, critical: boolean) =>
    passed ? 'PASS' : critical ? '**FAIL**' : 'warning';
  const rows = checks.map(
    (c) => `| ${c.name} | ${result(c.passed, c.critical)} | ${md(c.detail)} |`,
  );
  const { critical, advisory } = failedChecks(checks);
  const details = [...critical, ...advisory].flatMap((c) => [
    '',
    `### ${c.name}`,
    '',
    ...bullets(c.samples),
  ]);
  return [
    '## Validation',
    '',
    '| Check | Result | Detail |',
    '|---|---|---|',
    ...rows,
    ...details,
    '',
  ];
}

function findingsSection({ issues }: RunReport): string[] {
  const lines = ['## Findings', '', `${String(issues.length)} in all (full list: issues.csv).`, ''];
  for (const kind of [...new Set(issues.map((issue) => issue.kind))].sort()) {
    const all = issues.filter((issue) => issue.kind === kind);
    const blocking = all.filter((issue) => issue.blocking).length;
    lines.push(
      `### ${kind}: ${String(all.length)}${blocking > 0 ? ` (${String(blocking)} blocking)` : ''}`,
      '',
    );
    lines.push(
      ...all
        .slice(0, PER_KIND)
        .map((i) => `- ${i.blocking ? '**blocks** ' : ''}${i.ref}: ${md(i.detail)}`),
    );
    if (all.length > PER_KIND) {
      lines.push(`- … and ${String(all.length - PER_KIND)} more in issues.csv`);
    }
    lines.push('');
  }
  return lines;
}

/** The run's `report.md`: at most 50 findings per kind; the CSV files hold everything. */
export function markdown(report: RunReport): string {
  return [
    ...header(report),
    ...plannedSection(report),
    ...oldSideSection(report),
    ...targetSection(report),
    ...validationSection(report),
    ...findingsSection(report),
  ].join('\n');
}
