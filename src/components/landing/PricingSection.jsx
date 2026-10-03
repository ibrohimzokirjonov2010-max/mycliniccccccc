import { Link } from 'react-router-dom';
import { ArrowRight, CalendarCheck, Check, Gift, Send, Star } from 'lucide-react';
import { ShifoCrmLogoEmblem } from '@/components/ui/ShifoCrmLogo';
import {
  LANDING_PLANS, PRICING_HEADER, annualPrice, buyUrl, formatSoom, registerPath, ANNUAL_PAID_MONTHS, TRIAL_DAYS,
} from '@/config/landingPricing';
import ToothArch from './ToothArch';
import { Icon } from './landingIcons';

const GRID_BG = {
  backgroundColor: '#f5f7fa',
  backgroundImage:
    'linear-gradient(to right, rgba(148,163,184,0.20) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.20) 1px, transparent 1px)',
  backgroundSize: '34px 34px',
};

const PRO_BG = {
  background: 'linear-gradient(160deg, #0e6f86 0%, #0b4a6e 48%, #0a2a4d 100%)',
};

function Badge({ icon: IconCmp, children }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-700 shadow-[0_6px_18px_-8px_rgba(15,42,74,0.25)]">
      <IconCmp className="h-4 w-4 text-teal-600" strokeWidth={1.9} />
      {children}
    </span>
  );
}

function PlanCard({ plan }) {
  const dark = plan.popular;
  return (
    <article
      className={[
        'relative flex flex-col overflow-hidden rounded-[28px] p-6 sm:p-7',
        dark
          ? 'text-white shadow-[0_30px_70px_-20px_rgba(10,42,77,0.65)] lg:-my-4 lg:py-10'
          : 'bg-white text-slate-900 shadow-[0_20px_55px_-22px_rgba(15,42,74,0.28)] ring-1 ring-slate-100',
      ].join(' ')}
      style={dark ? PRO_BG : undefined}
      aria-label={`${plan.name} tarifi`}
    >
      {dark ? (
        <span className="absolute right-5 top-5 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-900 shadow-md">
          <Star className="h-3.5 w-3.5 fill-teal-500 text-teal-500" /> Eng ommabop
        </span>
      ) : null}

      <h3 className="text-[26px] font-extrabold leading-tight tracking-tight">{plan.name}</h3>
      <p className={`mt-1 max-w-[16rem] text-sm font-medium ${dark ? 'text-white/80' : 'text-slate-500'}`}>{plan.tagline}</p>

      <p className="mt-6 flex flex-wrap items-baseline gap-x-2">
        <span className="text-[44px] font-black leading-none tracking-tight sm:text-5xl">{formatSoom(plan.priceUzs)}</span>
        <span className={`text-sm font-medium ${dark ? 'text-white/80' : 'text-slate-500'}`}>{PRICING_HEADER.currency}</span>
      </p>
      <p className={`mt-2 text-xs font-medium ${dark ? 'text-teal-200' : 'text-teal-700'}`}>
        Yillik to'lovda: {formatSoom(annualPrice(plan))} so'm ({ANNUAL_PAID_MONTHS} oy narxi)
      </p>

      <div className="mt-6 grid gap-2.5">
        <Link
          to={registerPath(plan.id)}
          className={[
            'inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold transition active:scale-[0.98]',
            dark ? 'bg-white text-[#0b2a4a] hover:bg-teal-50' : 'bg-[#0b2a4a] text-white hover:bg-[#10375f]',
          ].join(' ')}
        >
          {TRIAL_DAYS} kun bepul boshlash <ArrowRight className="h-4 w-4" />
        </Link>
        <a
          href={buyUrl(plan)}
          target="_blank"
          rel="noopener noreferrer"
          className={[
            'inline-flex h-11 items-center justify-center gap-2 rounded-full border px-5 text-sm font-bold transition active:scale-[0.98]',
            dark ? 'border-white/35 text-white hover:bg-white/10' : 'border-slate-200 text-slate-700 hover:border-teal-400 hover:text-teal-700',
          ].join(' ')}
        >
          <Send className="h-4 w-4" /> Sotib olish
        </a>
      </div>

      <div className={`my-6 h-px ${dark ? 'bg-white/20' : 'bg-slate-100'}`} />

      {plan.featuresIntro ? (
        <p className="mb-3.5 flex items-center gap-2 text-[15px] font-extrabold">
          <Check className={`h-4 w-4 ${dark ? 'text-teal-300' : 'text-teal-600'}`} strokeWidth={2.6} />
          {plan.featuresIntro}
        </p>
      ) : null}

      <ul className="space-y-3.5 pb-28">
        {plan.features.map((f) => (
          <li key={f.text} className="flex items-start gap-3">
            <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${dark ? 'bg-white/10 text-teal-300' : 'bg-teal-50 text-teal-600'}`}>
              <Icon name={f.icon} className="h-[18px] w-[18px]" strokeWidth={1.7} />
            </span>
            <span className={`pt-1 text-[14.5px] font-medium leading-snug ${dark ? 'text-white/95' : 'text-slate-700'}`}>{f.text}</span>
          </li>
        ))}
      </ul>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 overflow-hidden" aria-hidden="true">
        <ToothArch
          jaw="upper"
          showNumbers
          stroke={dark ? '#5eead4' : '#14a3b8'}
          fill={dark ? 'rgba(255,255,255,0.04)' : '#ffffff'}
          numberColor={dark ? '#99f6e4' : '#0f766e'}
          className="absolute -bottom-20 left-1/2 w-[120%] max-w-none -translate-x-1/2 opacity-30"
        />
      </div>
    </article>
  );
}

export default function PricingSection() {
  return (
    <section id="tariflar" className="relative scroll-mt-20 overflow-hidden py-16 sm:py-24" style={GRID_BG}>
      {/* yuqoridagi tish qatori bezagi */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center" aria-hidden="true">
        <ToothArch jaw="lower" className="-mt-12 w-[760px] max-w-none opacity-25" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <ShifoCrmLogoEmblem className="h-10 w-10" size={40} hasGlow={false} />
            <span className="text-lg font-black tracking-tight text-slate-900">
              SHIFO <span className="text-teal-600">CRM</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Badge icon={CalendarCheck}>{PRICING_HEADER.trialBadge}</Badge>
            <Badge icon={Gift}>{PRICING_HEADER.annualBadge}</Badge>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-6 sm:mt-14 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="max-w-2xl text-[34px] font-black leading-[1.08] tracking-tight text-slate-950 sm:text-5xl lg:text-[56px]">
            {PRICING_HEADER.titleLead} <span className="text-teal-500">{PRICING_HEADER.titleAccent}</span>
          </h2>
          <Link
            to={registerPath()}
            className="group inline-flex h-14 w-full shrink-0 items-center justify-between gap-5 rounded-full bg-[#0b2a4a] py-2 pl-7 pr-2 text-base font-bold text-white shadow-[0_18px_40px_-14px_rgba(11,42,74,0.7)] transition hover:bg-[#10375f] sm:w-auto"
          >
            {PRICING_HEADER.cta}
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-teal-500 transition group-hover:translate-x-0.5">
              <ArrowRight className="h-5 w-5" strokeWidth={2.4} />
            </span>
          </Link>
        </div>

        <div className="mt-12 grid items-stretch gap-6 sm:mt-16 lg:grid-cols-3 lg:gap-7">
          {LANDING_PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-sm font-medium text-slate-500">
          Narxlar so'mda, oyiga. Tarifni tanlang — {PRICING_HEADER.trialBadge.toLowerCase()} darrov boshlanadi, to'lov esa
          Telegram yoki telefon orqali kelishiladi.
        </p>
      </div>
    </section>
  );
}
