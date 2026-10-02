// Saqlangan davolash rejasi qulflanadi: unga xizmat qo'shib, o'chirib yoki
// narx/tishlarini o'zgartirib bo'lmaydi. Faqat to'lov va "bajarildi / jarayonda"
// belgilari ruxsat etiladi. Yangi xizmat kerak bo'lsa - YANGI reja yaratiladi.
export const PLAN_LOCKED_TOOLTIP =
  "Qulflangan: saqlangan rejaga xizmat qo'shib, o'chirib yoki narxini o'zgartirib bo'lmaydi. Yangi xizmat uchun yangi reja yarating.";
export const PLAN_LOCKED_BADGE = 'Qulflangan';
export const PLAN_LOCKED_ADD_PROMPT = "Saqlangan rejaga qo'shib bo'lmaydi. Yangi reja yaratiladimi?";
export const PLAN_LOCKED_TOAST = "Saqlangan reja qulflangan. Yangi ish uchun \"Yangi reja\" yarating.";

const DRAFT_STATUSES = ['draft', 'qoralama'];

// Bazada mavjud (saqlangan) har bir reja qulflangan, faqat qoralama bundan mustasno.
export function isPlanLocked(plan) {
  if (!plan || !plan.id) return false;
  return !DRAFT_STATUSES.includes(String(plan.status || '').trim().toLowerCase());
}
