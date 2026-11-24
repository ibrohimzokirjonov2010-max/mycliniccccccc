/** Doctor pay from completed appointments and the payments that belong to them. */

function dayKey(value) {
  const raw = String(value || '');
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const dmy = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return raw.slice(0, 10);
}

function inRange(value, start, end) {
  if (!start && !end) return true;
  const key = dayKey(value);
  if (!key) return false;
  if (start && key < start) return false;
  if (end && key > end) return false;
  return true;
}

function isCompleted(status) {
  const value = String(status || '').toLowerCase().replace(/\s+/g, ' ').trim();
  return value === 'completed' || value === 'done' || value === 'bajarilgan' || value === 'bajarildi' || value === 'выполнено';
}

function isIncome(row) {
  const type = String(row?.type || '').trim().toLowerCase();
  return type === 'income' || type === '';
}

export function sameDoctor(record, doctor) {
  if (!record || !doctor) return false;
  const ids = [doctor.id, doctor.username].filter((value) => value != null && value !== '').map(String);
  const recordIds = [record.doctor_id, record.user_id].filter((value) => value != null && value !== '').map(String);
  if (recordIds.some((value) => ids.includes(value))) return true;
  const left = String(record.doctor_name || record.name || '').trim().toLowerCase();
  const right = String(doctor.name || doctor.full_name || '').trim().toLowerCase();
  if (!left || !right || right.length < 2) return false;
  return left === right || left.includes(right) || right.includes(left);
}

function commissionOf(amount, row, doctor) {
  const rate = Number(row?.commission_rate ?? doctor?.commission_rate ?? doctor?.commission ?? 0) || 0;
  return (Number(amount) || 0) * (rate / 100);
}

/**
 * Income is the doctor's paid work in the period.
 * A completed appointment counts when no payment already covers that visit,
 * so a paid appointment is not dropped just because doctor_id was stored on the visit only.
 */
export function doctorEarnings({ doctor, payments = [], appointments = [], start = '', end = '' } = {}) {
  const payRows = (payments || []).filter((row) => {
    if (!isIncome(row) || !sameDoctor(row, doctor)) return false;
    return inRange(row.date || row.created_date || row.created_at, start, end);
  });
  const coveredAppointments = new Set(payRows.map((row) => row.appointment_id).filter(Boolean).map(String));
  const coveredVisits = new Set(payRows.map((row) => `${row.patient_id || ''}|${dayKey(row.date || row.created_date)}|${Math.round(Number(row.amount) || 0)}`));

  const visitRows = (appointments || []).filter((row) => {
    if (!isCompleted(row?.status) || !sameDoctor(row, doctor)) return false;
    const price = Number(row.price ?? row.paid_amount ?? row.amount) || 0;
    if (price <= 0) return false;
    if (!inRange(row.date || row.appointment_date, start, end)) return false;
    if (row.id && coveredAppointments.has(String(row.id))) return false;
    const key = `${row.patient_id || ''}|${dayKey(row.date || row.appointment_date)}|${Math.round(price)}`;
    if (coveredVisits.has(key)) return false;
    return true;
  });

  let income = 0;
  let commission = 0;
  const patients = new Set();
  for (const row of payRows) {
    const amount = Math.abs(Number(row.amount) || 0);
    income += amount;
    commission += commissionOf(amount, row, doctor);
    if (row.patient_id || row.patient_name) patients.add(String(row.patient_id || row.patient_name));
  }
  for (const row of visitRows) {
    const amount = Number(row.price ?? row.paid_amount ?? row.amount) || 0;
    income += amount;
    commission += commissionOf(amount, row, doctor);
    if (row.patient_id || row.patient_name) patients.add(String(row.patient_id || row.patient_name));
  }

  return {
    income: Math.round(income),
    commission: Math.round(commission),
    patients: patients.size,
    payments: payRows.length,
    visits: visitRows.length,
  };
}
