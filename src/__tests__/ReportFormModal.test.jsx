import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
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

  it('renders referral form with student info', () => {
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
    expect(screen.getByText(/CGPA/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Terangkan sebab pelajar dirujuk/i)).toBeInTheDocument();
    expect(screen.getByText(/Segera/i)).toBeInTheDocument();
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
