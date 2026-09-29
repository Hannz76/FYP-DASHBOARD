import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  PillTabs,
  Badge,
  SectionCard,
  EmptyState,
  formatMsDate,
} from '@/components/ui/dashboard-kit';

describe('dashboard-kit', () => {
  it('marks the active tab with aria-selected', () => {
    render(
      <PillTabs
        ariaLabel="Mod paparan kaunselor"
        active="calendar"
        onChange={vi.fn()}
        tabs={[
          { id: 'pending', label: 'Menunggu' },
          { id: 'calendar', label: 'Kalendar' },
        ]}
      />
    );
    expect(screen.getByRole('tab', { name: /Kalendar/i })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('tab', { name: /Menunggu/i })).toHaveAttribute(
      'aria-selected',
      'false'
    );
  });

  it('emits tab changes on click', () => {
    const onChange = vi.fn();
    render(
      <PillTabs
        active="all"
        onChange={onChange}
        tabs={[{ id: 'report', label: 'Laporan' }]}
      />
    );
    fireEvent.click(screen.getByRole('tab', { name: /Laporan/i }));
    expect(onChange).toHaveBeenCalledWith('report');
  });

  it('renders section header and empty state', () => {
    render(
      <SectionCard icon="ph-folder-open" title="Laporan Saya" subtitle="Sub">
        <EmptyState icon="ph-folder-open" title="Tiada rekod" message="Kosong" />
      </SectionCard>
    );
    expect(screen.getByText('Laporan Saya')).toBeInTheDocument();
    expect(screen.getByText('Tiada rekod')).toBeInTheDocument();
  });

  it('guards invalid dates', () => {
    expect(formatMsDate(null)).toBe('-');
    expect(formatMsDate('nope')).toBe('-');
    expect(formatMsDate('2026-09-12T10:00:00.000Z')).not.toBe('-');
  });

  it('renders badge tones', () => {
    render(<Badge tone="rose">Baharu</Badge>);
    expect(screen.getByText('Baharu')).toBeInTheDocument();
  });
});
