/**
 * SHIFO CRM tariffs sold to stomatology clinic owners.
 * Prices are monthly, in Uzbek so'm (UZS). Payme tiyin = UZS × 100.
 */
export const TARIFFS = [
  {
    id: "start",
    name: "Start",
    priceUzs: 990_000,
    period: "oy",
    recommended: false,
    audience: "Bitta shifokorli kabinet",
    features: [
      { id: "doctor", label: "1 shifokor" },
      { id: "patients", label: "Bemorlar" },
      { id: "schedule", label: "Navbat" },
      { id: "payments", label: "To'lovlar" },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceUzs: 1_990_000,
    period: "oy",
    recommended: true,
    audience: "Implant qiladigan klinika",
    features: [
      { id: "doctors", label: "Ko'p shifokor" },
      { id: "implant", label: "Implant moduli" },
      { id: "reports", label: "Hisobotlar" },
      { id: "odonto", label: "Odontogram" },
    ],
  },
  {
    id: "klinika",
    name: "Klinika",
    priceUzs: 3_490_000,
    period: "oy",
    recommended: false,
    audience: "Filialli klinika",
    features: [
      { id: "branches", label: "Filiallar" },
      { id: "stock", label: "Ombor" },
      { id: "support", label: "Prioritet support" },
    ],
  },
] as const;

export type PlanId = (typeof TARIFFS)[number]["id"];

export const LICENSE_DAYS = 30;

export function getTariff(id: string) {
  return TARIFFS.find((plan) => plan.id === id) ?? null;
}

export function formatUzs(amount: number) {
  return new Intl.NumberFormat("en-US").format(amount);
}
