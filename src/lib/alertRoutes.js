/** Calendar and appointments screens should not toast other patients' implant gaps. */
export function isAppointmentCalendarPath(pathname) {
  const path = String(pathname || '').split('?')[0].replace(/\/+$/, '') || '/';
  return path === '/appointments'
    || path.startsWith('/appointments/')
    || path === '/calendar'
    || path.startsWith('/calendar/');
}
