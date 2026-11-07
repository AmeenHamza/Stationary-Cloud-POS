import { PlusIcon } from 'lucide-react';

import { formatRs } from '@pos/domain';

import { RevealKpiCard } from '@/components/metrics/RevealKpiCard';
import { Button } from '@/components/ui/button';

export interface PartyKpis {
  countLabel: string;
  count: number | undefined;
  amountLabel: string;
  amount: string | undefined;
}

/** The optional KPI cards and the Add button above the customer and vendor lists (F-25, F-26). */
export function PartyPanelHeader({
  kpis,
  addLabel,
  onAdd,
}: {
  kpis: PartyKpis | null;
  addLabel: string;
  onAdd: () => void;
}) {
  return (
    <>
      {kpis && (
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <RevealKpiCard label={kpis.countLabel} value={String(kpis.count ?? 0)} />
          <RevealKpiCard label={kpis.amountLabel} value={formatRs(kpis.amount ?? '0')} />
        </div>
      )}
      <div className="mb-4 flex justify-end">
        <Button variant="brand" onClick={onAdd}>
          <PlusIcon /> {addLabel}
        </Button>
      </div>
    </>
  );
}
