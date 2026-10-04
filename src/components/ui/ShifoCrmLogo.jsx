import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Brend logotipi: "My Clinic" + "DENTAL CRM" (public/logo-*.png, shaffof fon).
 * Fayl/eksport nomlari avvalgidek qoldirilgan (import yo'llari buzilmasligi uchun).
 *  - light: oq/och fon uchun (To'q ko'k "Clinic")
 *  - dark : to'q fon uchun (Oq "Clinic")
 */
export const BRAND_NAME = 'My Clinic';
export const BRAND_TAGLINE = 'DENTAL CRM';

const ALT = `${BRAND_NAME} — ${BRAND_TAGLINE}`;

/** Faqat tish ikonkasi (kichik joylar uchun). */
export const ShifoCrmLogoEmblem = ({ className = 'w-10 h-10', size = 44, variant = 'light' }) => (
  <img
    src={variant === 'dark' ? '/logo-icon-dark.png' : '/logo-icon.png'}
    alt={BRAND_NAME}
    width={size}
    height={size}
    draggable={false}
    className={cn('select-none object-contain', className)}
  />
);

/** To'liq logo (ikonka + "My Clinic" + "DENTAL CRM"). */
export const MyClinicLogoImage = ({ className = 'h-10 w-auto', variant = 'light' }) => (
  <img
    src={variant === 'dark' ? '/logo-full-dark.png' : '/logo-full.png'}
    alt={ALT}
    draggable={false}
    className={cn('select-none object-contain', className)}
  />
);

/**
 * Sidebar logotipi: mobil (oq fon) — light, lg+ (to'q sidebar) — dark variant.
 */
export default function ShifoCrmLogo({
  collapsed = false,
  size = 'md', // "sm" | "md" | "lg"
  className = '',
}) {
  const heights = { sm: 'h-8', md: 'h-11', lg: 'h-14' };
  const h = heights[size] || heights.md;

  if (collapsed) {
    return (
      <div className={cn('flex items-center justify-center select-none', className)}>
        <ShifoCrmLogoEmblem className={cn(h, 'w-auto lg:hidden')} size={32} variant="light" />
        <ShifoCrmLogoEmblem className={cn(h, 'w-auto hidden lg:block')} size={32} variant="dark" />
      </div>
    );
  }

  return (
    <div className={cn('flex items-center select-none', className)}>
      <MyClinicLogoImage variant="light" className={cn(h, 'w-auto max-w-full lg:hidden')} />
      <MyClinicLogoImage variant="dark" className={cn(h, 'w-auto max-w-full hidden lg:block')} />
    </div>
  );
}
