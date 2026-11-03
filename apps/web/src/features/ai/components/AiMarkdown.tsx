import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Plain elements only: headings, paragraphs, lists, tables and emphasis, styled for the app. */
const COMPONENTS: Components = {
  h1: ({ children }) => <h2 className="mt-4 mb-2 text-xl font-semibold">{children}</h2>,
  h2: ({ children }) => <h3 className="mt-4 mb-2 text-lg font-semibold">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-3 mb-1 font-semibold">{children}</h4>,
  h4: ({ children }) => <h5 className="mt-3 mb-1 font-medium">{children}</h5>,
  p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="my-2 list-disc space-y-1 ps-6">{children}</ul>,
  ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 ps-6">{children}</ol>,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b px-2 py-1.5 text-start font-medium text-muted-foreground">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border-b px-2 py-1.5 tabular-nums">{children}</td>,
  code: ({ children }) => <span className="font-mono text-sm">{children}</span>,
  hr: () => <hr className="my-4" />,
};

/**
 * Renders the model's Markdown safely (SYSTEM_DESIGN.md §8 step 7): raw HTML is dropped, links and
 * images are not rendered (their text stays), so a reply can never inject markup or load anything.
 */
export function AiMarkdown({ text }: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={COMPONENTS}
      skipHtml
      disallowedElements={['a', 'img']}
      unwrapDisallowed
    >
      {text}
    </ReactMarkdown>
  );
}
