import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AppointmentCalendar from '@/components/dashboard/AppointmentCalendar';

describe('AppointmentCalendar Component', () => {
  const now = new Date();
  const appointmentThisMonth = {
    _id: 'r1',
    studentName: 'Ali bin Abu',
    studentId: '20201234',
    interventionType: 'kaunseling',
    priority: 'urgent',
    status: 'scheduled',
    scheduledDate: new Date(now.getFullYear(), now.getMonth(), 15, 10, 30).toISOString(),
  };

  it('renders current month and places appointment chip on the right day', () => {
    render(
      <AppointmentCalendar reports={[appointmentThisMonth]} onComplete={vi.fn()} />
    );

    const monthLabel = now.toLocaleDateString('ms-MY', {
      month: 'long',
      year: 'numeric',
    });
    expect(screen.getByText(monthLabel)).toBeInTheDocument();
    expect(screen.getByText(/Ali bin Abu/i)).toBeInTheDocument();
  });

  it('navigates to next month and hides out-of-month appointments', () => {
    render(
      <AppointmentCalendar reports={[appointmentThisMonth]} onComplete={vi.fn()} />
    );

    fireEvent.click(screen.getByLabelText(/Bulan seterusnya/i));

    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    expect(
      screen.getByText(
        nextMonth.toLocaleDateString('ms-MY', { month: 'long', year: 'numeric' })
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/Ali bin Abu/i)).not.toBeInTheDocument();
  });

  it('shows day detail panel with Selesai button when a day is clicked', () => {
    render(
      <AppointmentCalendar reports={[appointmentThisMonth]} onComplete={vi.fn()} />
    );

    // Click the day cell containing the 15th
    fireEvent.click(screen.getByText('15'));

    expect(screen.getByText(/Temujanji pada/i)).toBeInTheDocument();
    expect(screen.getByText(/Kaunseling Kehadiran/i)).toBeInTheDocument();
    expect(screen.getByText(/Selesai/i)).toBeInTheDocument();
  });
});
