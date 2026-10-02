import { base44 } from '@/api/base44Client';

const DONE = new Set(['completed', 'bajarildi', 'done']);

/**
 * Marks one step (service) of a saved treatment plan as "Jarayonda" (In Progress).
 * Same status vocabulary as PatientTreatments / the plan stepper ("In Progress").
 * Never downgrades a finished plan and never touches amounts.
 */
export async function setPlanStepInProgress(plan, serviceIndex) {
  if (!plan?.id) throw new Error('Reja topilmadi');
  const payload = {};
  if (Array.isArray(plan.services) && plan.services.length && plan.services[serviceIndex]) {
    const services = plan.services.map((service) => ({ ...service }));
    services[serviceIndex] = { ...services[serviceIndex], status: 'In Progress' };
    payload.services = services;
  }
  if (!DONE.has(String(plan.status || '').toLowerCase())) payload.status = 'In Progress';
  return base44.entities.TreatmentPlan.update(plan.id, payload);
}
