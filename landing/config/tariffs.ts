/**
 * SHIFO CRM tariffs sold to stomatology clinic owners.
 * Prices and CRM plan ids live in shifo-tariffs.json.
 * Payme tiyin = UZS × 100. Yearly checkout is 10 months (2 months free).
 */
import catalog from "./shifo-tariffs.json";

export type PlanId = "basic" | "pro" | "premium";
export type CrmPlan = "basic" | "pro" | "premium";
export type BillingCycle = "month" | "year";

const ALIASES: Record<string, PlanId> = {
  start: "basic",
  klinika: "premium",
};

const COPY: Record<PlanId, { audience: string; features: { id: string; label: string }[] }> = {
  basic: {
    audience: "Yakka shifokor yoki kichik kabinet uchun.",
    features: [
      { id: "calendar", label: "Bugungi navbat va uchrashuvlar kalendari" },
      { id: "patients", label: "Bemorlar bazasi va FDI tish kartasi (sut tishlari avtomatik)" },
      { id: "history", label: "Tish tarixi, rentgen/RVG yuklash, rozilik" },
      { id: "plans", label: "Davolash rejalari va bosqichlari" },
      { id: "payments", label: "To'lovlar (naqd, karta, o'tkazma) va qarzlar" },
      { id: "services", label: "Xizmatlar narxlari ro'yxati" },
      { id: "phone", label: "Telefonda to'liq ishlaydi" },
    ],
  },
  pro: {
    audience: "2–5 kreslolik klinikalar uchun.",
    features: [
      { id: "all", label: "Basic'dagi hamma narsa" },
      { id: "implant", label: "Implantlar bo'limi va PDF implant pasporti" },
      { id: "staff", label: "Xodimlar, ish haqi va xarajatlar hisobi" },
      { id: "stock", label: "Ombor va hisobotlar" },
      { id: "leads", label: "Lidlar, kelmagan bemorlar va davolash kuzatuvi" },
      { id: "marketing", label: "Marketing va \"Mening keyslarim\" (portfolio)" },
      { id: "doctor", label: "Shifokor uchun alohida cheklangan kirish" },
    ],
  },
  premium: {
    audience: "Katta klinikalar va filiallar uchun.",
    features: [
      { id: "all", label: "Pro'dagi hamma narsa" },
      { id: "manager", label: "Shaxsiy menejer va ustuvor qo'llab-quvvatlash" },
      { id: "migrate", label: "Ma'lumotlarni eski tizimdan bepul ko'chirish" },
      { id: "train", label: "Xodimlarni joyida o'qitish" },
      { id: "setup", label: "Klinikaga moslab sozlash" },
    ],
  },
};

export const TARIFF_CATALOG = catalog;

export function canonicalPlanId(id: string): PlanId | null {
  const raw = String(id || "").trim().toLowerCase();
  if (raw === "basic" || raw === "pro" || raw === "premium") return raw;
  return ALIASES[raw] ?? null;
}

export const TARIFFS: Array<{
  id: PlanId;
  name: string;
  priceUzs: number;
  period: string;
  recommended: boolean;
  crmPlan: CrmPlan;
  audience: string;
  features: { id: string; label: string }[];
}> = catalog.tariffs
  .filter((plan) => plan.id !== "trial")
  .map((plan) => {
    const id = canonicalPlanId(plan.id);
    if (!id) throw new Error(`Unknown landing tariff: ${plan.id}`);
    const crm = plan.crmPlan === "premium" || plan.crmPlan === "pro" || plan.crmPlan === "basic" ? plan.crmPlan : "basic";
    return {
      id,
      name: plan.name,
      priceUzs: plan.priceUzs,
      period: plan.period,
      recommended: plan.recommended,
      crmPlan: crm,
      audience: COPY[id].audience,
      features: COPY[id].features,
    };
  });

export const LICENSE_DAYS = catalog.licenseDays;
export const TRIAL_DAYS = catalog.trialDays;
export const YEARLY_MONTHS = catalog.yearlyMonthsCharged || 10;

export function crmPlanForTariff(planId: string): CrmPlan {
  const id = canonicalPlanId(planId);
  const row = id ? catalog.tariffs.find((plan) => plan.id === id) : catalog.tariffs.find((plan) => plan.id === planId);
  if (row?.crmPlan === "premium" || row?.crmPlan === "pro" || row?.crmPlan === "basic") return row.crmPlan;
  if (planId === "trial") return "basic";
  return "basic";
}

export function getTariff(id: string) {
  const canonical = canonicalPlanId(id);
  if (!canonical) return null;
  return TARIFFS.find((plan) => plan.id === canonical) ?? null;
}

export function catalogMonthly(planId: string) {
  return getTariff(planId)?.priceUzs ?? catalog.legacyPortalMonthlyFee.basic;
}

export function chargeAmount(planId: string, cycle: BillingCycle = "month") {
  const monthly = catalogMonthly(planId);
  return cycle === "year" ? monthly * YEARLY_MONTHS : monthly;
}

export function formatUzs(amount: number) {
  return new Intl.NumberFormat("fr-FR").format(amount).replace(/\u202f/g, " ").replace(/\u00a0/g, " ");
}
