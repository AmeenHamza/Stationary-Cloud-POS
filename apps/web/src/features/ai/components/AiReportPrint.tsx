'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

import { AiMarkdown } from './AiMarkdown';
import { directionOf } from './AiResultView';

import type { AiResultFieldsFragment } from '@/graphql/__generated__/graphql';

const noSubscribe = (): (() => void) => () => undefined;

/**
 * Prints a business report on A4 (F-29 "Print"): the answer goes into a print-only portal on its
 * own named page (`styles/print-receipt.css`), then the browser prints. Each `printCount` prints again.
 */
export function AiReportPrint({
  result,
  title,
  printCount,
}: {
  result: AiResultFieldsFragment;
  title: string;
  printCount: number;
}) {
  const mounted = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  useEffect(() => {
    if (printCount === 0) {
      return undefined;
    }
    let cancelled = false;
    void document.fonts.ready.then(() => {
      if (!cancelled) {
        window.print();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [printCount]);
  if (!mounted || printCount === 0) {
    return null;
  }
  return createPortal(
    <div className="report-print" aria-hidden dir={directionOf(result.language)}>
      <h1>{title}</h1>
      <AiMarkdown text={result.text} />
    </div>,
    document.body,
  );
}
