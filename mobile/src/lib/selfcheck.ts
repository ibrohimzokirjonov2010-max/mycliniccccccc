import { visibleToDoctor } from './access';
import { addDays, dateKey, tashkentToday } from './dates';
import { decodeNotes, encodeNotes } from './notes';
import { buildDashboard } from './stats';

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const encoded = encodeNotes({ notes: 'allergiya', full_name: 'Ali Vali', phone: '998901112233' }, ['full_name', 'phone']);
assert(encoded.notes?.startsWith('[TECH_DATA]'), 'encode prefix');
const decoded = decodeNotes(encoded);
assert(decoded.full_name === 'Ali Vali', 'decode name');
assert(decoded.phone === '998901112233', 'decode phone');
assert(decoded.notes === 'allergiya', 'user notes preserved');

const columnWins = decodeNotes({ notes: encoded.notes, full_name: 'Column Name', phone: '' });
assert(columnWins.full_name === 'Column Name', 'column wins over notes');
assert(columnWins.phone === '998901112233', 'empty column filled from notes');

assert(dateKey('2026-11-24T10:00:00Z') === '2026-11-24', 'iso date');
assert(dateKey('24.11.2026') === '2026-11-24', 'dotted date');
assert(addDays('2026-11-24', -6) === '2026-11-18', 'add days');
assert(/^\d{4}-\d{2}-\d{2}$/.test(tashkentToday(new Date('2026-11-24T20:00:00Z'))), 'tashkent day');

const doctor = { id: 'doc-1', username: 'a', name: 'Doctor A', full_name: 'Doctor A', role: 'doctor', clinic_id: 'qa' };
const patients = visibleToDoctor(
  [
    { id: '1', main_treatment_provider: 'doc-1' },
    { id: '2', main_treatment_provider: 'other', created_by_id: 'doc-1' },
    { id: '3', main_treatment_provider: 'other' },
  ],
  doctor,
  'patient',
);
assert(patients.length === 2, 'doctor patient filter');

const dash = buildDashboard({
  today: '2026-11-24',
  now: '10:30',
  appointments: [
    { id: 'a1', patient_name: 'A', date: '2026-11-24', time: '09:00', status: 'Completed' },
    { id: 'a2', patient_name: 'B', date: '2026-11-24', time: '11:00', status: 'Scheduled' },
    { id: 'a3', patient_name: 'C', date: '2026-11-23', time: '11:00', status: 'Scheduled' },
  ],
  payments: [
    { id: 'p1', patient_name: 'A', amount: 1000, type: 'Income', date: '2026-11-24' },
    { id: 'p2', patient_name: 'A', amount: 500, type: 'Debt', date: '2026-11-24' },
    { id: 'p3', patient_name: 'A', amount: 2000, type: 'Income', date: '2026-11-20' },
  ],
  patients: [
    { id: '1', full_name: 'A', phone: '', status: 'New', total_debt: 400, total_paid: 0 },
    { id: '2', full_name: 'B', phone: '', status: 'Active', total_debt: 0, total_paid: 10 },
  ],
});
assert(dash.todayAppointments.length === 2, 'today appointments');
assert(dash.next?.id === 'a2', 'next open appointment');
assert(dash.todayRevenue === 1000, 'today income only');
assert(dash.weekRevenue === 3000, 'week income');
assert(dash.debtCount === 1 && dash.debtTotal === 400, 'debt');

console.log('selfcheck ok');
