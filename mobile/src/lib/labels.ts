import type { PatientRow } from '@/lib/types';

const MONTHS = [
  'yanvar',
  'fevral',
  'mart',
  'aprel',
  'may',
  'iyun',
  'iyul',
  'avgust',
  'sentabr',
  'oktabr',
  'noyabr',
  'dekabr',
];

const STATUS_LABELS: Record<string, string> = {
  Scheduled: 'Rejalashtirilgan',
  Waiting: 'Kutilmoqda',
  'In Progress': 'Jarayonda',
  Completed: 'Yakunlangan',
  Cancelled: 'Bekor qilingan',
  'No-Show': 'Kelmadi',
  Active: 'Faol',
  New: 'Yangi',
  'In Treatment': 'Davolanmoqda',
  Inactive: 'Nofaol',
  Archived: 'Arxiv',
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Ma'mur",
  doctor: 'Shifokor',
  receptionist: 'Qabulxona',
};

export function todayISO(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function formatDate(value?: string | null): string {
  if (!value) return '';
  const match = String(value).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(value);
  const month = MONTHS[Number(match[2]) - 1];
  if (!month) return String(value).slice(0, 10);
  return `${Number(match[3])} ${month} ${match[1]}`;
}

export function greeting(name: string): string {
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Xayrli tong' : hour < 18 ? 'Xayrli kun' : 'Xayrli kech';
  return `${hello}, ${name}`;
}

export function statusLabel(status?: string | null): string {
  if (!status) return "Noma'lum";
  return STATUS_LABELS[status] || status;
}

export function roleLabel(role?: string | null): string {
  if (!role) return 'Xodim';
  return ROLE_LABELS[role] || role;
}

export function patientName(patient: PatientRow): string {
  const full = patient.full_name?.trim();
  if (full) return full;
  const joined = [patient.first_name, patient.last_name].filter(Boolean).join(' ').trim();
  return joined || 'Nomsiz bemor';
}

export function isWaiting(status?: string | null): boolean {
  return status === 'Waiting' || status === 'Scheduled' || status === 'In Progress';
}
