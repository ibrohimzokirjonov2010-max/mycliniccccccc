/**
 * Prefetch lazy route JS chunks before navigation (hover/focus).
 * Complements data prefetch in prefetcher.js — reduces Patients ChunkLoadError on first click.
 */

const inflight = new Map();

const ROUTE_CHUNK_LOADERS = {
  '/': () => Promise.all([
    import('../pages/Dashboard'),
    import('../pages/MobileDashboardV2'),
  ]),
  '/patients': () => Promise.all([
    import('../pages/Patients'),
    import('../pages/MobilePatientsV2'),
  ]),
  '/chairside': () => import('../pages/ChairsideToday'),
  '/today': () => import('../pages/ChairsideToday'),
  '/appointments': () => Promise.all([
    import('../pages/Appointments'),
    import('../pages/MobileAppointmentsV2'),
  ]),
  '/payments': () => Promise.all([
    import('../pages/Payments'),
    import('../pages/MobilePaymentsV2'),
  ]),
  '/leads': () => Promise.all([
    import('../pages/Leads'),
    import('../pages/MobileLeadsV6'),
  ]),
  '/settings': () => Promise.all([
    import('../pages/Settings'),
    import('../pages/MobileSettings'),
  ]),
};

/** Prefetch PatientProfile when hovering a patient row / opening profile soon. */
export function prefetchPatientProfileChunk() {
  const key = 'patient-profile';
  if (inflight.has(key)) return inflight.get(key);
  const p = Promise.all([
    import('../pages/PatientProfile'),
    import('../pages/MobilePatientProfile'),
  ]).catch(() => {}).finally(() => { inflight.delete(key); });
  inflight.set(key, p);
  return p;
}

export function prefetchRouteChunk(path) {
  if (!path) return Promise.resolve();
  const normalized = path.split('?')[0].replace(/\/$/, '') || '/';
  if (/^\/patients\/[^/]+$/.test(normalized)) {
    return prefetchPatientProfileChunk();
  }
  const loader = ROUTE_CHUNK_LOADERS[normalized];
  if (!loader) return Promise.resolve();
  if (inflight.has(normalized)) return inflight.get(normalized);
  const p = loader().catch(() => {}).finally(() => { inflight.delete(normalized); });
  inflight.set(normalized, p);
  return p;
}

export default prefetchRouteChunk;
