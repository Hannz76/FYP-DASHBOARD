import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import AttachmentPreview from '@/components/ui/AttachmentPreview';
import ReportFormModal from '@/components/ReportFormModal';
import GenerateReportModal from '@/components/GenerateReportModal';

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => 'blob:mock');
  URL.revokeObjectURL = vi.fn();
});

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn((url) => {
    if (url === '/api/auth/users') {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            { email: 'counselor@ikmb.edu.my', role: 'counselor', displayName: 'Kaunselor IKMB' },
          ]),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
});

const mockStudent = {
  id: '20201234',
  nama: 'Ali bin Abu',
  kursus: 'DFK',
  cgpa: '2.1',
  attendance: '65',
  dropoutRisk: 'Tinggi',
};

describe('AttachmentPreview shared component', () => {
  it('renders PDF iframe preview', () => {
    const file = new File(['x'], 'surat.pdf', { type: 'application/pdf' });
    render(<AttachmentPreview file={file} previewUrl="blob:mock" onRemove={vi.fn()} />);
    expect(screen.getByTitle('Pratonton lampiran PDF')).toBeInTheDocument();
  });

  it('renders image preview for PNG', () => {
    const file = new File(['x'], 'img.png', { type: 'image/png' });
    render(<AttachmentPreview file={file} previewUrl="blob:mock" onRemove={vi.fn()} />);
    expect(screen.getByRole('img', { name: /Pratonton/ })).toBeInTheDocument();
  });

  it('returns null when missing file or url', () => {
    const { container } = render(
      <AttachmentPreview file={null} previewUrl={null} onRemove={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('Set Temujanji attachment preview', () => {
  it('shows PDF iframe preview', () => {
    render(
      <ReportFormModal isOpen={true} onClose={vi.fn()} student={mockStudent} interventionType="kaunseling" />
    );
    const input = screen.getByLabelText(/Lampiran/i);
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'surat.pdf', { type: 'application/pdf' })] },
    });
    expect(screen.getByTitle('Pratonton lampiran PDF')).toBeInTheDocument();
  });

  it('shows image preview for PNG', () => {
    render(
      <ReportFormModal isOpen={true} onClose={vi.fn()} student={mockStudent} interventionType="kaunseling" />
    );
    const input = screen.getByLabelText(/Lampiran/i);
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'img.png', { type: 'image/png' })] },
    });
    expect(screen.getByRole('img', { name: /Pratonton/ })).toBeInTheDocument();
  });

  it('rejects oversized files with Malay error', () => {
    render(
      <ReportFormModal isOpen={true} onClose={vi.fn()} student={mockStudent} interventionType="kaunseling" />
    );
    const input = screen.getByLabelText(/Lampiran/i);
    const big = new File([new Uint8Array(6 * 1024 * 1024)], 'big.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(input, { target: { files: [big] } });
    expect(screen.getByText(/melebihi had 5MB/i)).toBeInTheDocument();
    expect(screen.queryByTitle('Pratonton lampiran PDF')).not.toBeInTheDocument();
  });
});

describe('Jana Laporan PDF preview', () => {
  it('shows PDF preview via shared component', () => {
    render(
      <GenerateReportModal
        isOpen={true}
        onClose={vi.fn()}
        student={mockStudent}
        skillGap={{ chart: { labels: [], current: [] } }}
      />
    );
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'surat.pdf', { type: 'application/pdf' })] },
    });
    expect(screen.getByTitle('Pratonton lampiran PDF')).toBeInTheDocument();
  });
});

describe('Set Temujanji scroll regression', () => {
  it('uses static banner classes and a scrollable panel', () => {
    const { container } = render(
      <ReportFormModal isOpen={true} onClose={vi.fn()} student={mockStudent} interventionType="kaunseling" />
    );
    expect(container.querySelector('.bg-red-50')).not.toBeNull();
    const panel = container.querySelector('.max-w-lg');
    expect(panel?.className).toMatch(/max-h-\[90vh\]/);
    expect(panel?.querySelector('.overflow-y-auto')).not.toBeNull();
    expect(panel?.querySelector('.overscroll-contain')).not.toBeNull();
  });
});
