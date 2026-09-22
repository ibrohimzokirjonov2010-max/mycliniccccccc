/**
 * SHIFO CRM tariffs sold to stomatology clinic owners.
 * Prices, CRM plan ids, and the legacy portal fees live in shifo-tariffs.json.
 * Payme tiyin = UZS × 100.
 */
import catalog from "./shifo-tariffs.json";

const COPY: Record<string, { audience: string; features: { id: string; label: string }[] }> = {
  start: {
    audience: "Bitta shifokorli kabinet",
    features: [
      { id: "doctor", label: "1 shifokor" },
      { id: "patients", label: "Bemorlar" },
      { id: "schedule", label: "Navbat" },
      { id: "payments", label: "To'lovlar" },
    ],
  },
  pro: {
    audience: "Implant qiladigan klinika",
    features: [
      { id: "doctors", label: "Ko'p shifokor" },
      { id: "implant", label: "Implant moduli" },
      { id: "reports", label: "Hisobotlar" },
      { id: "odonto", label: "Odontogram" },
    ],
  },
  klinika: {
    audience: "Filialli klinika",
    features: [
      { id: "branches", label: "Filiallar" },
      { id: "stock", label: "Ombor" },
      { id: "support", label: "Prioritet support" },
    ],
  },
};

export const TARIFF_CATALOG = catalog;

function asPlanId(id: string): PlanId {
  if (id === "start" || id === "pro" || id === "klinika") return id;
  throw new Error(`Unknown landing tariff: ${id}`);
}

export const TARIFFS: Array<{
  id: PlanId;
  name: string;
  priceUzs: number;
  period: string;
  recommended: boolean;
  crmPlan: "basic" | "pro";
  audience: string;
  features: { id: string; label: string }[];
}> = catalog.tariffs
  .filter((plan) => plan.id !== "trial")
  .map((plan) => ({
    id: asPlanId(plan.id),
    name: plan.name,
    priceUzs: plan.priceUzs,
    period: plan.period,
    recommended: plan.recommended,
    crmPlan: plan.crmPlan === "basic" ? "basic" : "pro",
    audience: COPY[plan.id]?.audience ?? "",
    features: COPY[plan.id]?.features ?? [],
  }));

export type PlanId = "start" | "pro" | "klinika";

export const LICENSE_DAYS = catalog.licenseDays;
export const TRIAL_DAYS = catalog.trialDays;

export function crmPlanForTariff(planId: string): "basic" | "pro" {
  const row = catalog.tariffs.find((plan) => plan.id === planId);
  return row?.crmPlan === "basic" ? "basic" : "pro";
}

export function getTariff(id: string) {
  return TARIFFS.find((plan) => plan.id === id) ?? null;
}

export function formatUzs(amount: number) {
  return new Intl.NumberFormat("en-US").format(amount);
}
