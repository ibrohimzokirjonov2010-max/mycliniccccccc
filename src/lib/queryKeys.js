/**
 * Centralized React Query key factory
 *
 * Usage:
 *   useQuery({ queryKey: QUERY_KEYS.appointments, ... })
 *   queryClient.invalidateQueries({ queryKey: QUERY_KEYS.appointments })
 *
 * Hierarchy (array format) lets React Query invalidate whole families:
 *   invalidateQueries(['patient', id]) → also invalidates ['patient-appointments', id], etc.
 */
export const QUERY_KEYS = {
  // ── Global entities ──────────────────────────────────────────────────────
  appointments:     ['appointments'],
  patients:         ['patients'],
  services:         ['services'],
  doctors:          ['doctors'],

  // ── Payments ─────────────────────────────────────────────────────────────
  payments:         (search = '', page = 0) => ['payments', search, page],
  paymentStats:     ['payment-stats'],

  // ── Treatment Plans ───────────────────────────────────────────────────────
  treatmentPlans:   ['treatment-plans'],

  // ── Patient Profile (per-patient) ─────────────────────────────────────────
  patient:               (id) => ['patient', id],
  patientPlans:          (id) => ['patient', id, 'plans'],
  patientToothRecords:   (id) => ['patient', id, 'tooth-records'],
  patientImplants:       (id) => ['patient', id, 'implants'],
  patientAppointments:   (id) => ['patient', id, 'appointments'],
  patientPayments:       (id) => ['patient', id, 'payments'],
  patientXrays:          (id) => ['patient', id, 'xrays'],
};

export default QUERY_KEYS;
