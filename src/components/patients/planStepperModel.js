import { displayServiceName } from '@/lib/displayText';
import { implantStepStatusLabel } from '@/lib/implantStatus';

function dateKey(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayKey(today) {
  return dateKey(today || new Date());
}

function planCreatedTime(plan) {
  const raw = plan?.created_date || plan?.created_at || plan?.start_date || plan?.date;
  const time = raw ? new Date(raw).getTime() : NaN;
  return Number.isNaN(time) ? 0 : time;
}

/** Plans in creation order (oldest first); ties keep their incoming order. */
export function sortPlansChronologically(plans) {
  return (plans || [])
    .map((plan, index) => ({ plan, index }))
    .sort((a, b) => (planCreatedTime(a.plan) - planCreatedTime(b.plan)) || (a.index - b.index))
    .map((row) => row.plan);
}

function planTeethLabel(plan) {
  const own = String(plan?.tooth_number || '').replace(/#/g, '').trim();
  if (own && own !== 'general') return own;
  const teeth = [];
  (Array.isArray(plan?.services) ? plan.services : []).forEach((service) => {
    const value = String(service?.tooth_number || service?.tooth || service?.tooth_id || '').replace(/^#/, '').trim();
    if (value && value !== 'general' && !teeth.includes(value)) teeth.push(value);
  });
  return teeth.join(', ');
}

/**
 * Title of one plan card. A real name is kept as is; a generic one ("Davolash rejasi")
 * becomes "Reja N (#teeth)" built from the plan's OWN data, N being its chronological number.
 */
export function planStepperTitle(plan, index) {
  const raw = String(plan?.name || plan?.title || '').trim();
  if (!raw || /(davolash rejasi|план лечения|treatment plan)/i.test(raw)) {
    const teeth = planTeethLabel(plan);
    return `Reja ${index + 1}${teeth ? ` (#${teeth})` : ''}`;
  }
  return raw;
}

function toothLabel(value) {
  const clean = String(value || '').replace(/^#/, '').trim();
  if (!clean || clean === 'general') return null;
  return clean;
}

function serviceState(service, plan) {
  const sst = String(service?.status || '').toLowerCase();
  const st = String(plan?.status || '').toLowerCase();
  if (service?.completed === true || sst === 'completed' || sst === 'bajarildi' || sst === 'done') return 'done';
  if (sst.includes('progress') || sst === 'jarayonda' || sst === 'active') return 'active';
  if (st === 'completed' || st === 'bajarildi' || st === 'done') return 'done';
  return 'pending';
}

function withActive(steps) {
  const next = steps.map((step) => ({ ...step }));
  if (next.length && !next.some((step) => step.state === 'active') && next.some((step) => step.state === 'pending')) {
    const first = next.find((step) => step.state === 'pending');
    if (first) first.state = 'active';
  }
  return next;
}

function pushServiceStep(steps, { id, title, tooth, state, implants, language, planName, category, planId, serviceIndex }) {
  steps.push({
    id,
    planId,
    serviceIndex,
    rawState: state,
    title,
    tooth,
    state,
    number: steps.length + 1,
    statusLabel: implantStepStatusLabel({
      name: `${title} ${planName || ''} ${category || ''}`,
      tooth,
      implants,
      language,
    }),
  });
}

/**
 * One group per treatment plan. Today's appointments stay a single "Bugungi reja" group
 * and are not mixed into the plans.
 */
export function buildPlanStepperGroups({
  appointments = [],
  plans = [],
  implants = [],
  language = 'uz',
  today = new Date(),
} = {}) {
  const key = todayKey(today);
  const appointmentSteps = [];
  (appointments || []).forEach((appointment) => {
    const raw = appointment.appointment_date || appointment.date || appointment.start_time || appointment.created_date;
    if (!raw || dateKey(raw) !== key) return;
    const st = String(appointment.status || '').toLowerCase();
    let state = 'pending';
    if (st === 'completed' || st === 'bajarildi' || st === 'done') state = 'done';
    else if (st === 'in_progress' || st === 'inprogress' || st === 'jarayonda' || st === 'waiting' || st === 'confirmed') state = 'active';
    const title = displayServiceName(appointment.service_name || appointment.notes || appointment.title || 'Uchrashuv');
    const tooth = toothLabel(appointment.tooth_number);
    pushServiceStep(appointmentSteps, {
      id: `appt-${appointment.id}`,
      title,
      tooth,
      state,
      implants,
      language,
    });
  });

  if (appointmentSteps.length) {
    const steps = withActive(appointmentSteps);
    return {
      scope: 'today',
      title: 'Bugungi reja',
      groups: [{
        id: 'today',
        title: 'Bugungi reja',
        steps,
      }],
    };
  }

  const groups = [];
  sortPlansChronologically(plans).forEach((plan) => {
    const st = String(plan.status || '').toLowerCase();
    if (st === 'cancelled' || st === 'canceled') return;
    const services = Array.isArray(plan.services) && plan.services.length
      ? plan.services
      : [{
        service_name: plan.name || plan.title,
        status: plan.status,
        tooth_number: plan.tooth_number,
        completed: st === 'completed' || st === 'bajarildi',
      }];
    const steps = [];
    services.forEach((service, idx) => {
      const tooth = toothLabel(service.tooth_number || service.tooth_id || plan.tooth_number);
      const title = displayServiceName(service.service_name || service.name || plan.name || 'Muolaja');
      pushServiceStep(steps, {
        id: `plan-${plan.id}-${idx}`,
        title,
        tooth,
        state: serviceState(service, plan),
        implants,
        language,
        planName: plan.name,
        category: service.category,
        planId: plan.id,
        serviceIndex: idx,
      });
    });
    groups.push({
      id: String(plan.id || `plan-${groups.length + 1}`),
      title: planStepperTitle(plan, groups.length),
      steps: withActive(steps),
    });
  });

  const title = groups.length > 1 ? `Davolash rejasi: ${groups.length} ta` : 'Davolash rejasi';
  return { scope: 'plan', title, groups };
}

export function groupProgress(group) {
  const steps = group?.steps || [];
  const done = steps.filter((step) => step.state === 'done').length;
  return { done, total: steps.length, pending: steps.length - done };
}

/**
 * Saved plan step that "Keyingi" should start when the visible steps come from today's
 * appointments (those carry no planId). Only waiting steps of non-cancelled plans count;
 * the one matching the appointment's tooth/service wins, otherwise the first in plan order.
 */
export function findNextSavedPlanStep({ plans = [], hint = null, implants = [], language = 'uz' } = {}) {
  const model = buildPlanStepperGroups({ appointments: [], plans, implants, language });
  const pending = [];
  (model.groups || []).forEach((group) => {
    (group.steps || []).forEach((step) => {
      if (step.planId != null && step.rawState === 'pending') pending.push(step);
    });
  });
  if (!pending.length) return null;
  const norm = (value) => String(value || '').trim().toLowerCase();
  if (hint) {
    const hintTitle = norm(hint.title);
    const hintTooth = norm(hint.tooth);
    const byBoth = pending.find((step) => hintTooth && norm(step.tooth) === hintTooth
      && hintTitle && (norm(step.title).includes(hintTitle) || hintTitle.includes(norm(step.title))));
    if (byBoth) return byBoth;
    const byTitle = pending.find((step) => hintTitle && hintTitle !== 'uchrashuv' && norm(step.title) === hintTitle);
    if (byTitle) return byTitle;
    const byTooth = pending.find((step) => hintTooth && norm(step.tooth) === hintTooth);
    if (byTooth) return byTooth;
  }
  return pending[0];
}
