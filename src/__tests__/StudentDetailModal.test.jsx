import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import StudentDetailModal from '@/components/StudentDetailModal';

describe('StudentDetailModal shared component', () => {
  const appointment = {
    _id: 'a1',
    interventionType: 'kaunseling',
    scheduledDate: new Date(2026, 9, 15, 10, 30).toISOString(),
    status: 'scheduled',
    priority: 'urgent',
    reason: 'Kehadiran merosot',
    counselorId: 'counselor@ikmb.edu.my',
    counselorNotes: 'Sesi pertama',
    adminEmail: 'admin@ikmb.edu.my',
    filePath: '/uploads/referrals/surat.pdf',
    fileName: 'surat.pdf',
    studentId: '20201234',
    course: 'DFK',
  };

  const report = {
    _id: 'r1',
    title: 'Laporan Prestasi',
    studentName: 'Ali bin Abu',
    studentId: '20201234',
    cgpa: '3.20',
    attendance: '85',
    course: 'DFK',
    semester: '3',
    riskLevel: 'Sederhana',
    employability: 75,
    message: 'Teruskan usaha',
    authorName: 'Admin IKMB',
    authorEmail: 'admin@ikmb.edu.my',
    authorRole: 'admin',
  };

  it('renders appointment detail with real schema fields', () => {
    render(
      <StudentDetailModal kind="appointment" appointment={appointment} onClose={vi.fn()} />
    );
    expect(screen.getAllByText(/Kaunseling Kehadiran/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Kehadiran merosot/i)).toBeInTheDocument();
    expect(screen.getByText(/counselor@ikmb.edu.my/i)).toBeInTheDocument();
    expect(screen.getByText(/Sesi pertama/i)).toBeInTheDocument();
  });

  it('renders report detail with shared layout', () => {
    render(
      <StudentDetailModal
        kind="report"
        report={report}
        onClose={vi.fn()}
        onDownload={vi.fn()}
        onPrint={vi.fn()}
        onShare={vi.fn()}
      />
    );
    expect(screen.getByText(/Laporan Prestasi/i)).toBeInTheDocument();
    expect(screen.getByText(/Teruskan usaha/i)).toBeInTheDocument();
  });

  it('returns null when no data and closes on backdrop', () => {
    const onClose = vi.fn();
    const { container } = render(
      <StudentDetailModal kind="appointment" appointment={null} onClose={onClose} />
    );
    expect(container.firstChild).toBeNull();
  });
});
