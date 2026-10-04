/**
 * Landing sahifasi uchun TARIF, NARX va KONTAKT sozlamalari — yagona joy.
 *
 * Narxlar va tarif nomlari foydalanuvchi (Ibrohim) tasdiqlagan marketing ma'lumoti;
 * ilovadagi katalog (src/utils/superAdminBilling.js → LEGACY_FEES / LANDING_TARIFFS)
 * bilan bir xil: Basic 99 000, Pro 189 000, Premium 349 000 so'm / oy.
 * Narxni o'zgartirish kerak bo'lsa — faqat shu faylni tahrirlang.
 */
import { supportContacts } from '@/lib/clinicExpiry';

const support = supportContacts();

/** "Sotib olish" va bog'lanish: ilovadagi mavjud qo'llab-quvvatlash kontakti (clinicExpiry.supportContacts). */
export const LANDING_CONTACT = {
  telegramUrl: support.url,
  phone: support.phone,
  brand: 'My Clinic',
};

/** Bepul sinov kunlari (superAdminBilling.normalizeClinicBilling → 14 kun). */
export const TRIAL_DAYS = 14;

/** Yillik to'lov: 12 oy o'rniga 10 oy (2 oy bepul) — superAdminBilling.PLAN_MAPPING_NOTE. */
export const ANNUAL_PAID_MONTHS = 10;
export const ANNUAL_FREE_MONTHS = 2;

export const PRICING_HEADER = {
  titleLead: 'Klinikangiz uchun',
  titleAccent: "to'g'ri tarif",
  trialBadge: `${TRIAL_DAYS} kunlik bepul sinov`,
  annualBadge: `Yillik to'lovda ${ANNUAL_FREE_MONTHS} oy bepul`,
  cta: "Bepul sinab ko'ring",
  currency: "so'm / oyiga",
};

/** icon — lucide-react nomi (PricingSection.jsx ichidagi ICONS xaritasi). */
export const LANDING_PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    tagline: 'Yakka shifokor yoki kichik kabinet uchun.',
    priceUzs: 99000,
    popular: false,
    featuresIntro: null,
    features: [
      { icon: 'calendar', text: 'Bugungi navbat va uchrashuvlar kalendari' },
      { icon: 'users', text: 'Bemorlar bazasi va FDI tish kartasi (sut tishlari avtomatik)' },
      { icon: 'history', text: 'Tish tarixi, rentgen/RVG yuklash, rozilik shakllari' },
      { icon: 'clipboard', text: 'Davolash rejalari va bosqichlari' },
      { icon: 'wallet', text: "To'lovlar (naqd, karta, o'tkazma) va qarzlar nazorati" },
      { icon: 'tags', text: "Xizmatlar narxlari ro'yxati" },
      { icon: 'phone', text: 'Telefonda to\'liq ishlaydi' },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: '2–5 stomatologik kreslolik klinikalar uchun.',
    priceUzs: 189000,
    popular: true,
    featuresIntro: "Basic'dagi hamma narsa",
    features: [
      { icon: 'implant', text: 'Implantlar bo\'limi va PDF implant pasporti' },
      { icon: 'staff', text: 'Xodimlar, ish haqi va xarajatlar hisobi' },
      { icon: 'package', text: 'Ombor va hisobotlar' },
      { icon: 'leads', text: 'Lidlar, kelmay qolgan bemorlar va davolanishni kuzatish' },
      { icon: 'target', text: "Marketing va \"Mening keyslarim\" (portfolio)" },
      { icon: 'key', text: 'Shifokor uchun alohida cheklangan kirish' },
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    tagline: 'Katta klinikalar va filiallar uchun.',
    priceUzs: 349000,
    popular: false,
    featuresIntro: "Pro'dagi hamma narsa",
    features: [
      { icon: 'headset', text: "Shaxsiy menejer va ustuvor qo'llab-quvvatlash" },
      { icon: 'transfer', text: "Eski tizimdan ma'lumotni bepul ko'chirish" },
      { icon: 'training', text: "Xodimlarni joyida o'qitish" },
      { icon: 'sliders', text: 'Klinikaga moslashtirish' },
    ],
  },
];

/** 1 000 000 → "1 000 000" (qattiq bo'shliq bilan, qator buzilmasin). */
export function formatSoom(value) {
  const amount = Math.round(Number(value) || 0);
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
}

export function annualPrice(plan) {
  return plan.priceUzs * ANNUAL_PAID_MONTHS;
}

/** Registratsiya sahifasi: tanlangan tarifda 14 kunlik sinov ochiladi. */
export function registerPath(planId) {
  return planId ? `/register?plan=${encodeURIComponent(planId)}&from=landing` : '/register?from=landing';
}

/** "Sotib olish": Telegram orqali (oldindan yozilgan matn bilan). */
export function buyUrl(plan) {
  const text = `Salom! My Clinic ${plan.name} tarifini (${formatSoom(plan.priceUzs).replace(/\u00A0/g, ' ')} so'm/oy) sotib olmoqchiman.`;
  const sep = LANDING_CONTACT.telegramUrl.includes('?') ? '&' : '?';
  return `${LANDING_CONTACT.telegramUrl}${sep}text=${encodeURIComponent(text)}`;
}

export function phoneHref() {
  return `tel:${LANDING_CONTACT.phone}`;
}

export function phoneLabel() {
  const d = String(LANDING_CONTACT.phone || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('998')) {
    return `+998 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10, 12)}`;
  }
  return LANDING_CONTACT.phone;
}
