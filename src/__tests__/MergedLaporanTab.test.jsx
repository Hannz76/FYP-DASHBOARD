import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MergedLaporanTab, {
  normalizeLaporanItems,
  formatLaporanDate,
} from '@/components/dashboard/MergedLaporanTab';

describe('normalizeLaporanItems', () => {
  it('maps real schema fields and sorts newest first', () => {
    const reports = [
      { _id: 'r1', title: 'Laporan Lama', createdAt: '2026-01-01T00:00:00.000Z' },
    ];
    const appointments = [
      {
        _id: 'a1',
        interventionType: 'kaunseling',
        scheduledDate: '2026-09-01T10:00:00.000Z',
        status: 'scheduled',
      },
    ];
    const merged = normalizeLaporanItems(reports, appointments);
    expect(merged).toHaveLength(2);
    expect(merged[0].itemType).toBe('appointment');
    expect(merged[0].displayTitle).toMatch(/Kaunseling/i);
    expect(merged[1].itemType).toBe('report');
  });

  it('pushes missing dates to the bottom', () => {
    const merged = normalizeLaporanItems(
      [{ _id: 'r1', title: 'No date' }],
      [{ _id: 'a1', interventionType: 'klinik', scheduledDate: '2026-09-01T00:00:00.000Z' }]
    );
    expect(merged[merged.length - 1]._id).toBe('r1');
  });

  it('formats missing dates as dash', () => {
    expect(formatLaporanDate(null)).toBe('-');
    expect(formatLaporanDate('not-a-date')).toBe('-');
  });
});

describe('MergedLaporanTab component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn((url) => {
      if (url === '/api/student-reports') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                _id: 'r1',
                title: 'Laporan Prestasi',
                createdAt: '2026-09-10T00:00:00.000Z',
                readByStudent: false,
                message: 'Teruskan usaha',
              },
            ]),
        });
      }
      if (url === '/api/reports/mine') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                _id: 'a1',
                interventionType: 'kaunseling',
                scheduledDate: '2026-09-12T10:00:00.000Z',
                status: 'scheduled',
                reason: 'Kehadiran merosot',
              },
            ]),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it('renders merged badges and unread dot', async () => {
    render(<MergedLaporanTab />);
    expect(await screen.findByText(/Laporan Prestasi/i)).toBeInTheDocument();
    expect(screen.getAllByText('Temujanji').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Laporan').length).toBeGreaterThan(0);
    expect(screen.getByText(/Kaunseling Kehadiran/i)).toBeInTheDocument();
  });

  it('opens shared modal on Lihat Butiran', async () => {
    render(<MergedLaporanTab />);
    const buttons = await screen.findAllByText(/Lihat Butiran/i);
    fireEvent.click(buttons[0]);
    await waitFor(() =>
      expect(screen.getByLabelText(/Tutup/i)).toBeInTheDocument()
    );
  });
});
