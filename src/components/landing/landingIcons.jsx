import {
  ArrowLeftRight, Banknote, BookOpen, CalendarDays, Check, ClipboardList, Clock, Coins,
  FileText, GraduationCap, Headset, HeartHandshake, History, KeyRound, LayoutGrid, Package,
  Rocket, Send, ShieldCheck, SlidersHorizontal, Smartphone, Tags, Target, UserCog, UserPlus,
  UserX, Users, Wallet,
} from 'lucide-react';

/** Tish — line-art ikonka (lucide'da yo'q). */
export function ToothIcon({ className = 'h-5 w-5', strokeWidth = 1.8 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M7.4 3.2C4.9 3.2 3.3 5.1 3.3 7.4c0 2 .9 3.2 1.4 5.1.5 2 .6 8.3 2.5 8.3 1.7 0 1.3-4.4 3.3-4.4h3c2 0 1.6 4.4 3.3 4.4 1.9 0 2-6.3 2.5-8.3.5-1.9 1.4-3.1 1.4-5.1 0-2.3-1.6-4.2-4.1-4.2-1.6 0-2.7.8-4.6.8s-3-.8-4.6-.8z" />
    </svg>
  );
}

/** Implant — line-art ikonka. */
export function ImplantIcon({ className = 'h-5 w-5', strokeWidth = 1.8 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M7 3h10l-1.2 5H8.2z" />
      <path d="M9 8h6l-1.3 12.2a1.7 1.7 0 0 1-3.4 0z" />
      <path d="M9.3 11.5h5.4M9.1 14.5h5.8M9.5 17.5h5" />
    </svg>
  );
}

/** Nom bo'yicha ikonka (landingContent / landingPricing'dagi `icon` maydonlari). */
export const ICONS = {
  calendar: CalendarDays,
  users: Users,
  history: History,
  clipboard: ClipboardList,
  wallet: Wallet,
  tags: Tags,
  phone: Smartphone,
  implant: ImplantIcon,
  staff: UserCog,
  package: Package,
  leads: UserPlus,
  target: Target,
  key: KeyRound,
  headset: Headset,
  transfer: ArrowLeftRight,
  training: GraduationCap,
  sliders: SlidersHorizontal,
  tooth: ToothIcon,
  send: Send,
  grid: LayoutGrid,
  file: FileText,
  book: BookOpen,
  coins: Coins,
  userx: UserX,
  rocket: Rocket,
  check: Check,
  clock: Clock,
  heart: HeartHandshake,
  shield: ShieldCheck,
  money: Banknote,
};

export function Icon({ name, className = 'h-5 w-5', strokeWidth = 1.8 }) {
  const Cmp = ICONS[name] || Check;
  return <Cmp className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
}
