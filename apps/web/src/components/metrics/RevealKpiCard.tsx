'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

/** KPI card with hidden value until the user clicks Show. */
export function RevealKpiCard({
  label,
  value,
  placeholder = '••••',
}: {
  label: string;
  value: string;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Card className="grid gap-2 p-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tracking-tight tabular-nums">
        {visible ? value : placeholder}
      </span>
      <div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setVisible((state) => !state);
          }}
        >
          {visible ? 'Hide' : 'Show'}
        </Button>
      </div>
    </Card>
  );
}
