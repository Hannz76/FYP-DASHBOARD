import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GenerateReportModal from '@/components/GenerateReportModal';

vi.mock('@/lib/heuristics', () => ({
  calculateEmployability: () => 75,
}));

describe('GenerateReportModal Component', () => {
  const mockStudent = {
    id: '20201234',
    nama: 'Ali bin Abu',
    kursus: 'DFK',
    semester: '3',
    cgpa: '3.2',
    attendance: '85',
    dropoutRisk: 'Sederhana',
  };

  const mockSkillGap = {
    chart: {
      labels: ['PLO 1', 'PLO 2'],
      current: [80, 70],
    },
  };

  it('renders student data preview and form fields', () => {
    render(
      <GenerateReportModal
        isOpen={true}
        onClose={vi.fn()}
        student={mockStudent}
        skillGap={mockSkillGap}
      />
    );

    expect(screen.getByText(/Jana Laporan/i)).toBeInTheDocument();
    expect(screen.getByText(/Ali bin Abu/i)).toBeInTheDocument();
    expect(screen.getByText(/20201234/i)).toBeInTheDocument();
    expect(screen.getByText(/75%/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Cth: Laporan Prestasi Semester 3/i)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    const { container } = render(
      <GenerateReportModal
        isOpen={false}
        onClose={vi.fn()}
        student={mockStudent}
        skillGap={mockSkillGap}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});
