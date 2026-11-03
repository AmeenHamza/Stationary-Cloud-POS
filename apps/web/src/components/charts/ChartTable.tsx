/** The chart's numbers as a table for screen readers (dataviz: a table view always exists). */
export function ChartTable({
  title,
  labels,
  series,
  format,
}: {
  title: string;
  labels: readonly string[];
  series: readonly { name: string; values: readonly string[] }[];
  format: (value: string) => string;
}) {
  return (
    <table className="sr-only">
      <caption>{title}</caption>
      <thead>
        <tr>
          <th scope="col">Period</th>
          {series.map((entry) => (
            <th key={entry.name} scope="col">
              {entry.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {labels.map((label, index) => (
          <tr key={label}>
            <th scope="row">{label}</th>
            {series.map((entry) => (
              <td key={entry.name}>{format(entry.values[index] ?? '0')}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
