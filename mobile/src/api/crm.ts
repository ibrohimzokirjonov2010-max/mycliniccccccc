import { visibleToDoctor } from '@/lib/access';
import { dateKey } from '@/lib/dates';
import { rid } from '@/lib/format';
import { decodeNotes, encodeNotes } from '@/lib/notes';
import { ApiError } from '@/api/errors';
import { readSnapshot } from '@/api/session';
import { getSupabase } from '@/api/supabase';
import type { Appointment, CrmUser, Doctor, Patient, Payment, ServiceItem } from '@/api/types';

/**
 * Clinic data access. Isolated from screens.
 * Row shape follows the web HybridEntityLoader: real columns plus [TECH_DATA] notes.
 * Every query is scoped by the signed-in clinic id. RLS is the server-side guarantee.
 */

const PATIENT_TECH = ['full_name', 'phone', 'email', 'birth_date', 'gender', 'address', 'status', 'first_name', 'last_name', 'total_paid', 'total_debt', 'main_treatment_provider', 'created_by_id', 'comment'] as const;
const APPOINTMENT_TECH = ['patient_name', 'patient_phone', 'doctor_name', 'service_name', 'price', 'duration', 'status', 'date', 'time', 'doctor_id', 'patient_id'] as const;
const PAYMENT_TECH = ['doctor_id', 'doctor_name', 'patient_name', 'category', 'method', 'patient_id'] as const;
type Row = Record<string, unknown>;

function num(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function str(value: unknown): string {
  return value == null ? '' : String(value);
}

function missingColumn(error: { message?: string } | null): string | null {
  const message = error?.message || '';
  const quoted = message.match(/column "([^"]+)"/i) || message.match(/'([^']+)' column/i);
  if (quoted?.[1]) return quoted[1];
  const qualified = message.match(/column\s+(?:[\w"]+\.)?(\w+)\s+does not exist/i);
  return qualified?.[1] || null;
}

async function clinicUser(): Promise<{ clinicId: string; user: CrmUser }> {
  const snapshot = await readSnapshot();
  if (!snapshot?.clinic.id || !snapshot.user) throw new ApiError('unauthorized', 401);
  return { clinicId: snapshot.clinic.id, user: snapshot.user };
}

type QueryError = { message?: string; code?: string } | null;
type QueryResult = { data: Row[] | null; error: QueryError };
type QueryBuilder = {
  eq: (column: string, value: string) => QueryBuilder;
  order: (column: string, options: { ascending: boolean }) => QueryBuilder;
  limit: (count: number) => Promise<QueryResult>;
};

async function selectRows(table: string, columns: string[], clinicId: string, order: string): Promise<Row[]> {
  const supabase = getSupabase();
  let fields = [...columns];
  let orderBy = order;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const query = supabase.from(table).select(fields.join(',')) as unknown as QueryBuilder;
    const filtered = query.eq('clinic_id', clinicId);
    const ordered = orderBy ? filtered.order(orderBy, { ascending: false }) : filtered;
    const result = await ordered.limit(500);
    if (!result.error) return result.data || [];
    const missing = missingColumn(result.error);
    if (missing && fields.includes(missing)) {
      fields = fields.filter((field) => field !== missing);
      continue;
    }
    if (orderBy && /column/i.test(result.error.message || '')) {
      orderBy = '';
      continue;
    }
    throw new ApiError('db_error', 500);
  }
  throw new ApiError('db_error', 500);
}

async function insertRow(table: string, row: Row): Promise<Row> {
  const supabase = getSupabase();
  const payload: Row = {};
  Object.entries(row).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') payload[key] = value;
  });
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const result = await supabase.from(table).insert(payload as never).select('*').maybeSingle();
    if (!result.error) return (result.data || payload) as Row;
    const missing = missingColumn(result.error);
    if (missing && Object.prototype.hasOwnProperty.call(payload, missing)) {
      delete payload[missing];
      continue;
    }
    throw new ApiError('db_error', 500);
  }
  throw new ApiError('db_error', 500);
}

async function updateRow(table: string, id: string, clinicId: string, patch: Row): Promise<void> {
  const supabase = getSupabase();
  const payload = { ...patch };
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const result = await supabase.from(table).update(payload as never).eq('id', id).eq('clinic_id', clinicId);
    if (!result.error) return;
    const missing = missingColumn(result.error);
    if (missing && Object.prototype.hasOwnProperty.call(payload, missing)) {
      delete payload[missing];
      continue;
    }
    throw new ApiError('db_error', 500);
  }
}

function toPatient(row: Row): Patient {
  const decoded = decodeNotes(row as Patient);
  return {
    id: str(decoded.id),
    full_name: str(decoded.full_name),
    phone: str(decoded.phone),
    status: str(decoded.status || 'Active'),
    total_debt: num(decoded.total_debt),
    total_paid: num(decoded.total_paid),
    notes: str(decoded.notes),
    created_date: str(decoded.created_date) || null,
    first_name: str(decoded.first_name),
    last_name: str(decoded.last_name),
    main_treatment_provider: str(decoded.main_treatment_provider) || null,
    created_by_id: str(decoded.created_by_id) || null,
  };
}

function toAppointment(row: Row): Appointment {
  const decoded = decodeNotes(row as Appointment);
  return {
    id: str(decoded.id),
    patient_id: str(decoded.patient_id) || null,
    patient_name: str(decoded.patient_name),
    patient_phone: str(decoded.patient_phone) || null,
    doctor_id: str(decoded.doctor_id) || null,
    doctor_name: str(decoded.doctor_name) || null,
    date: dateKey(decoded.date),
    time: str(decoded.time).slice(0, 5),
    status: str(decoded.status || 'Scheduled'),
    service_name: str(decoded.service_name) || null,
    price: num(decoded.price),
    duration: num(decoded.duration) || 30,
    notes: str(decoded.notes),
  };
}

function toPayment(row: Row): Payment {
  const decoded = decodeNotes(row as Payment);
  return {
    id: str(decoded.id),
    patient_id: str(decoded.patient_id) || null,
    patient_name: str(decoded.patient_name),
    amount: num(decoded.amount),
    type: str(decoded.type || 'Income'),
    method: str(decoded.method) || null,
    date: dateKey(decoded.date) || null,
    category: str(decoded.category) || null,
    doctor_id: str(decoded.doctor_id) || null,
    doctor_name: str(decoded.doctor_name) || null,
    notes: str(decoded.notes),
  };
}

function toDoctor(row: Row): Doctor {
  const decoded = decodeNotes(row as Doctor & { notes?: string | null });
  return {
    id: str(decoded.id),
    name: str(decoded.name || decoded.full_name),
    full_name: str(decoded.full_name || decoded.name),
    role: str(decoded.role || 'staff').toLowerCase(),
    phone: str(decoded.phone) || null,
    specialty: str(decoded.specialty) || null,
  };
}

export async function listPatients(): Promise<Patient[]> {
  const { clinicId, user } = await clinicUser();
  const rows = await selectRows(
    'patients',
    ['id', 'clinic_id', 'full_name', 'phone', 'status', 'total_debt', 'total_paid', 'notes', 'created_date', 'first_name', 'last_name'],
    clinicId,
    'created_date',
  );
  return visibleToDoctor(rows.map(toPatient), user, 'patient');
}

export async function getPatient(id: string): Promise<Patient | null> {
  const patients = await listPatients();
  return patients.find((patient) => patient.id === id) || null;
}

export async function createPatient(input: {
  firstName: string;
  lastName: string;
  phone: string;
  doctorId?: string | null;
}): Promise<Patient> {
  const { clinicId, user } = await clinicUser();
  const fullName = `${input.lastName} ${input.firstName}`.trim();
  const doctorId = input.doctorId || (user.role === 'doctor' ? user.id : null);
  const row = encodeNotes({
    id: rid('patient'),
    clinic_id: clinicId,
    full_name: fullName,
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    phone: input.phone,
    status: 'New',
    total_debt: 0,
    total_paid: 0,
    main_treatment_provider: doctorId,
    created_by_id: user.id,
    created_date: new Date().toISOString(),
    notes: '',
  }, PATIENT_TECH);
  const created = await insertRow('patients', row);
  return toPatient(created);
}

export async function listAppointments(): Promise<Appointment[]> {
  const { clinicId, user } = await clinicUser();
  const rows = await selectRows(
    'appointments',
    ['id', 'clinic_id', 'patient_id', 'patient_name', 'patient_phone', 'doctor_id', 'doctor_name', 'date', 'time', 'status', 'service_name', 'price', 'duration', 'notes', 'created_date'],
    clinicId,
    'date',
  );
  return visibleToDoctor(rows.map(toAppointment), user, 'visit').sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
}

export async function createAppointment(input: {
  patient: Patient;
  doctor: Doctor | null;
  date: string;
  time: string;
  serviceName: string;
  price: number;
}): Promise<Appointment> {
  const { clinicId, user } = await clinicUser();
  const doctorId = input.doctor?.id || (user.role === 'doctor' ? user.id : null);
  const doctorName = input.doctor?.full_name || input.doctor?.name || (user.role === 'doctor' ? user.full_name || user.name : '');
  const row = encodeNotes({
    id: rid('appointment'),
    clinic_id: clinicId,
    patient_id: input.patient.id,
    patient_name: input.patient.full_name,
    patient_phone: input.patient.phone,
    doctor_id: doctorId,
    doctor_name: doctorName,
    date: input.date,
    time: input.time,
    duration: 30,
    service_name: input.serviceName || null,
    price: input.price || 0,
    status: 'Scheduled',
    created_date: new Date().toISOString(),
    notes: '',
  }, APPOINTMENT_TECH);
  const created = await insertRow('appointments', row);
  return toAppointment(created);
}

export async function setAppointmentStatus(id: string, status: 'Completed' | 'Cancelled'): Promise<void> {
  const { clinicId } = await clinicUser();
  await updateRow('appointments', id, clinicId, { status });
}

export async function listPayments(): Promise<Payment[]> {
  const { clinicId, user } = await clinicUser();
  const rows = await selectRows(
    'payments',
    ['id', 'clinic_id', 'patient_id', 'patient_name', 'amount', 'type', 'method', 'date', 'category', 'doctor_id', 'notes', 'created_date'],
    clinicId,
    'date',
  );
  return visibleToDoctor(rows.map(toPayment), user, 'visit');
}

async function recomputeBalance(patientId: string, clinicId: string): Promise<void> {
  const rows = await selectRows(
    'payments',
    ['id', 'clinic_id', 'patient_id', 'amount', 'type', 'date', 'notes'],
    clinicId,
    'date',
  );
  const mine = rows.map(toPayment).filter((payment) => payment.patient_id === patientId);
  let debt = 0;
  let paid = 0;
  let discount = 0;
  let refund = 0;
  mine.forEach((payment) => {
    const type = payment.type.toLowerCase();
    const amount = Math.abs(payment.amount);
    if (type === 'debt') debt += amount;
    else if (type === 'income') paid += amount;
    else if (type === 'discount') discount += amount;
    else if (type === 'refund') refund += amount;
  });
  await updateRow('patients', patientId, clinicId, {
    total_paid: paid,
    total_debt: Math.max(0, debt - paid + refund - discount),
  });
}

export async function createPayment(input: {
  patient: Patient;
  amount: number;
  method: 'Cash' | 'Card' | 'Transfer';
  doctor: Doctor | null;
}): Promise<Payment> {
  const { clinicId, user } = await clinicUser();
  const today = new Date();
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' }).format(today);
  const doctorId = input.doctor?.id || (user.role === 'doctor' ? user.id : null);
  const doctorName = input.doctor?.full_name || input.doctor?.name || '';
  const row = encodeNotes({
    id: rid('payment'),
    clinic_id: clinicId,
    patient_id: input.patient.id,
    patient_name: input.patient.full_name,
    type: 'Income',
    category: 'Treatment',
    amount: input.amount,
    method: input.method,
    date,
    doctor_id: doctorId,
    doctor_name: doctorName,
    created_date: today.toISOString(),
    notes: '',
  }, PAYMENT_TECH);
  const created = await insertRow('payments', row);
  try {
    await recomputeBalance(input.patient.id, clinicId);
  } catch {
    /* payment is saved; balance refresh can fail independently */
  }
  return toPayment(created);
}

export async function listDoctors(): Promise<Doctor[]> {
  const { clinicId } = await clinicUser();
  const rows = await selectRows(
    'users',
    ['id', 'clinic_id', 'name', 'full_name', 'role', 'phone', 'specialty', 'notes'],
    clinicId,
    'name',
  );
  return rows.map(toDoctor).filter((doctor) => doctor.role === 'doctor' || doctor.role === 'admin');
}

export async function listServices(): Promise<ServiceItem[]> {
  const { clinicId } = await clinicUser();
  try {
    const rows = await selectRows('services', ['id', 'clinic_id', 'name', 'price'], clinicId, 'name');
    return rows
      .map((row) => ({ id: str(row.id), name: str(row.name), price: num(row.price) }))
      .filter((service) => service.name);
  } catch {
    return [];
  }
}
