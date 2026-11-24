import type { Appointment, Patient, Payment } from '../api/types';
import { addDays, dateKey, nowHHMM } from './dates';

export type DashboardModel = {
  todayAppointments: Appointment[];
  next: Appointment | null;
  todayRevenue: number;
  weekRevenue: number;
  patientCount: number;
  debtCount: number;
  debtTotal: number;
};

function isIncome(payment: Payment): boolean {
  return String(payment.type || 'Income').toLowerCase() === 'income';
}

function isOpen(appointment: Appointment): boolean {
  const status = String(appointment.status || '').toLowerCase();
  return !['completed', 'cancelled', 'canceled', 'no-show', 'noshow', 'no_show'].includes(status);
}

export function buildDashboard(input: {
  today: string;
  appointments: Appointment[];
  payments: Payment[];
  patients: Patient[];
  now?: string;
}): DashboardModel {
  const todayAppointments = input.appointments
    .filter((item) => dateKey(item.date) === input.today)
    .sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
  const income = input.payments.filter(isIncome);
  const sum = (rows: Payment[]) => rows.reduce((total, row) => total + (Number(row.amount) || 0), 0);
  const weekStart = addDays(input.today, -6);
  const now = input.now || nowHHMM();
  const open = todayAppointments.filter(isOpen);
  const next = open.find((item) => String(item.time || '').slice(0, 5) >= now) || open[0] || null;
  const debtors = input.patients.filter((patient) => (Number(patient.total_debt) || 0) > 0);
  return {
    todayAppointments,
    next,
    todayRevenue: sum(income.filter((row) => dateKey(row.date) === input.today)),
    weekRevenue: sum(income.filter((row) => {
      const day = dateKey(row.date);
      return !!day && day >= weekStart && day <= input.today;
    })),
    patientCount: input.patients.length,
    debtCount: debtors.length,
    debtTotal: debtors.reduce((total, patient) => total + (Number(patient.total_debt) || 0), 0),
  };
}
