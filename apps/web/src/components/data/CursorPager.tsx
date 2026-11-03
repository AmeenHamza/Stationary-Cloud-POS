import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';

import type { CursorPages } from '@/hooks/useCursorPages';

/** The part of a connection the pager needs (API.md §3). */
export interface PagedConnection {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  totalCount?: number | null;
}

/**
 * Previous/next controls for a keyset-paged list, with the total when the query selected
 * `totalCount`. "Previous" reuses the cursor already visited (`useCursorPages`).
 */
export function CursorPager({
  pages,
  connection,
}: {
  pages: CursorPages;
  connection: PagedConnection;
}) {
  const total = connection.totalCount;
  return (
    <div className="flex items-center justify-between gap-3 pt-4 text-sm text-muted-foreground">
      <span>
        Page {pages.page}
        {total != null && ` · ${String(total)} in total`}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={!pages.hasPrevious} onClick={pages.previous}>
          <ChevronLeftIcon /> Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!connection.pageInfo.hasNextPage}
          onClick={() => {
            pages.next(connection.pageInfo.endCursor);
          }}
        >
          Next <ChevronRightIcon />
        </Button>
      </div>
    </div>
  );
}
