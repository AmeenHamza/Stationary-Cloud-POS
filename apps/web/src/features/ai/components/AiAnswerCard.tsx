'use client';

import { PrinterIcon } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { AiReportPrint } from './AiReportPrint';
import { AiResultView } from './AiResultView';

import type { AiResultFieldsFragment } from '@/graphql/__generated__/graphql';

/** One answer under its feature's title; business reports add Print (A4, F-29). */
export function AiAnswerCard({
  result,
  title,
  printable,
}: {
  result: AiResultFieldsFragment;
  title: string;
  printable: boolean;
}) {
  const [printCount, setPrintCount] = useState(0);
  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>{title}</CardTitle>
        {printable && (
          <Button
            variant="outline"
            onClick={() => {
              setPrintCount((count) => count + 1);
            }}
          >
            <PrinterIcon />
            Print
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <AiResultView result={result} />
      </CardContent>
      {printable && <AiReportPrint result={result} title={title} printCount={printCount} />}
    </Card>
  );
}
