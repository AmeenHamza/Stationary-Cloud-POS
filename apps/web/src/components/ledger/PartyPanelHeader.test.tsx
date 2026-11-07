import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { formatRs } from '@pos/domain';

import { PartyPanelHeader } from './PartyPanelHeader';

const LABELS = { countLabel: 'Total customers', amountLabel: 'Customer dues' };

function revealValues() {
  for (const button of screen.getAllByRole('button', { name: 'Show' })) {
    fireEvent.click(button);
  }
}

afterEach(cleanup);

describe('PartyPanelHeader', () => {
  it('shows both KPI cards with their values', () => {
    const kpis = { ...LABELS, count: 12, amount: '1500.50' };
    render(<PartyPanelHeader kpis={kpis} addLabel="Add customer" onAdd={vi.fn()} />);
    revealValues();
    expect(screen.queryByText('Total customers')).not.toBeNull();
    expect(screen.queryByText('Customer dues')).not.toBeNull();
    expect(screen.queryByText('12')).not.toBeNull();
    expect(screen.queryByText(formatRs('1500.50'))).not.toBeNull();
  });

  it('reads values that have not loaded yet as zero', () => {
    const kpis = { ...LABELS, count: undefined, amount: undefined };
    render(<PartyPanelHeader kpis={kpis} addLabel="Add customer" onAdd={vi.fn()} />);
    revealValues();
    expect(screen.queryByText('0')).not.toBeNull();
    expect(screen.queryByText(formatRs('0'))).not.toBeNull();
  });

  it('leaves out the KPI cards when they are turned off', () => {
    render(<PartyPanelHeader kpis={null} addLabel="Add customer" onAdd={vi.fn()} />);
    expect(screen.queryByText('Total customers')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show' })).toBeNull();
  });

  it('calls onAdd from the Add button', () => {
    const onAdd = vi.fn();
    render(<PartyPanelHeader kpis={null} addLabel="Add vendor" onAdd={onAdd} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add vendor' }));
    expect(onAdd).toHaveBeenCalledOnce();
  });
});
