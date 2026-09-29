import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReportFormModal from '@/components/ReportFormModal';

describe('ReportFormModal Component', () => {
  const mockStudent = {
    id: '20201234',
    nama: 'Ali bin Abu',
    kursus: 'DFK',
    cgpa: '2.1',
    attendance: '65',
    dropoutRisk: 'Tinggi',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn((url) => {
      if (url === '/api/auth/users') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              { email: 'counselor@ikmb.edu.my', role: 'counselor', displayName: 'Kaunselor IKMB' },
              { email: 'admin@ikmb.edu.my', role: 'admin', displayName: 'Admin IKMB' },
            ]),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
  });

  it('renders referral form with student info and counselor dropdown', async () => {
    render(
      <ReportFormModal
        isOpen={true}
        onClose={vi.fn()}
        student={mockStudent}
        interventionType="kaunseling"
      />
    );

    expect(screen.getByText(/Set Temujanji/i)).toBeInTheDocument();
    expect(screen.getByText(/Kaunseling Kehadiran/i)).toBeInTheDocument();
    expect(screen.getByText(/Ali bin Abu/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Terangkan sebab pelajar dirujuk/i)).toBeInTheDocument();
    expect(screen.getByText(/Tarikh & Masa Temujanji/i)).toBeInTheDocument();
    expect(screen.getByText(/^Kaunselor/i)).toBeInTheDocument();
    expect(screen.getByText(/Lampiran/i)).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByText(/Kaunselor IKMB/i)).toBeInTheDocument()
    );
    expect(screen.queryByRole('option', { name: /Admin IKMB/i })).not.toBeInTheDocument();
  });

  it('shows validation error when submitting without date and counselor', async () => {
    const user = userEvent.setup();
    render(
      <ReportFormModal
        isOpen={true}
        onClose={vi.fn()}
        student={mockStudent}
        interventionType="kaunseling"
      />
    );

    await user.type(
      screen.getByPlaceholderText(/Terangkan sebab pelajar dirujuk/i),
      'Kehadiran merosot'
    );
    await user.click(screen.getByText(/Hantar Rujukan/i));

    expect(
      await screen.findByText(/Sila lengkapkan sebab, tarikh temujanji dan kaunselor/i)
    ).toBeInTheDocument();
  });

  it('submits FormData including file when complete', async () => {
    const user = userEvent.setup();
    render(
      <ReportFormModal
        isOpen={true}
        onClose={vi.fn()}
        student={mockStudent}
        interventionType="kaunseling"
      />
    );

    await waitFor(() =>
      expect(screen.getByText(/Kaunselor IKMB/i)).toBeInTheDocument()
    );

    await user.type(
      screen.getByPlaceholderText(/Terangkan sebab pelajar dirujuk/i),
      'Kehadiran merosot'
    );
    await user.selectOptions(
      screen.getByRole('combobox'),
      'counselor@ikmb.edu.my'
    );

    const dateInput = document.querySelector('input[type="datetime-local"]');
    await userEvent.type(dateInput, '2026-10-01T10:00');

    const file = new File(['dummy'], 'surat.pdf', { type: 'application/pdf' });
    await user.upload(document.querySelector('input[type="file"]'), file);

    await user.click(screen.getByText(/Hantar Rujukan/i));

    await waitFor(() => {
      const reportCall = global.fetch.mock.calls.find((c) => c[0] === '/api/reports');
      expect(reportCall).toBeTruthy();
      const body = reportCall[1].body;
      expect(body).toBeInstanceOf(FormData);
      expect(body.get('counselorId')).toBe('counselor@ikmb.edu.my');
      expect(body.get('scheduledDate')).toBe('2026-10-01T10:00');
      expect(body.get('file').name).toBe('surat.pdf');
    });
  });

  it('does not render when closed', () => {
    const { container } = render(
      <ReportFormModal
        isOpen={false}
        onClose={vi.fn()}
        student={mockStudent}
        interventionType="klinik"
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
