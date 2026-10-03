import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, Menu, Phone, Send, X } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { ShifoCrmLogoEmblem } from '@/components/ui/ShifoCrmLogo';
import {
  LANDING_CONTACT, TRIAL_DAYS, phoneHref, phoneLabel, registerPath,
} from '@/config/landingPricing';
import {
  BENEFITS, FAQ, FEATURES, FINAL_CTA, HERO, NAV_LINKS, PROBLEMS, QUICK_FACTS, SHOWCASE, STEPS,
} from '@/components/landing/landingContent';
import { Icon } from '@/components/landing/landingIcons';
import PricingSection from '@/components/landing/PricingSection';
import ToothArch from '@/components/landing/ToothArch';
import {
  AppointmentsMock, ImplantMock, PatientChartMock, PatientsListMock, PaymentsMock, PlanMock, TelegramMock,
} from '@/components/landing/Mockups';

const NAVY = 'bg-[#0b2a4a] hover:bg-[#10375f]';

function Brand({ light = false }) {
  return (
    <span className="flex items-center gap-2.5">
      <ShifoCrmLogoEmblem className="h-9 w-9" size={36} hasGlow={false} />
      <span className={`text-[17px] font-black tracking-tight ${light ? 'text-white' : 'text-slate-900'}`}>
        SHIFO <span className={light ? 'text-teal-300' : 'text-teal-600'}>CRM</span>
      </span>
    </span>
  );
}

function SectionHead({ eyebrow, title, text, center = true, light = false }) {
  return (
    <div className={`${center ? 'mx-auto text-center' : ''} max-w-2xl`}>
      <p className={`text-xs font-bold uppercase tracking-[0.22em] ${light ? 'text-teal-300' : 'text-teal-600'}`}>{eyebrow}</p>
      <h2 className={`mt-3 text-3xl font-black leading-tight tracking-tight sm:text-4xl ${light ? 'text-white' : 'text-slate-950'}`}>{title}</h2>
      {text ? <p className={`mt-4 text-base font-medium leading-relaxed ${light ? 'text-white/75' : 'text-slate-600'}`}>{text}</p> : null}
    </div>
  );
}

function Navbar({ authed }) {
  const [open, setOpen] = useState(false);

  const go = useCallback((e, id) => {
    e.preventDefault();
    setOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <a href="#top" onClick={(e) => go(e, 'top')} aria-label="SHIFO CRM — bosh sahifa"><Brand /></a>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Asosiy menyu">
          {NAV_LINKS.map((l) => (
            <a key={l.id} href={`#${l.id}`} onClick={(e) => go(e, l.id)} className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950">
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {authed ? (
            <Link to="/" className={`inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-bold text-white ${NAVY}`}>
              CRM'ga o'tish <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <>
              <Link to="/login?from=landing" className="inline-flex h-10 items-center rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-teal-400 hover:text-teal-700 sm:px-5">
                Kirish
              </Link>
              <Link to={registerPath()} className={`hidden h-10 items-center gap-2 rounded-full px-5 text-sm font-bold text-white sm:inline-flex ${NAVY}`}>
                Ro'yxatdan o'tish
                <span className="rounded-full bg-teal-400/25 px-2 py-0.5 text-[11px] font-bold text-teal-100">{TRIAL_DAYS} kun bepul</span>
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-700 md:hidden"
            aria-label={open ? 'Menyuni yopish' : 'Menyuni ochish'}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-slate-100 bg-white px-4 pb-5 pt-3 md:hidden">
          <nav className="grid gap-1" aria-label="Mobil menyu">
            {NAV_LINKS.map((l) => (
              <a key={l.id} href={`#${l.id}`} onClick={(e) => go(e, l.id)} className="rounded-xl px-3 py-3 text-base font-bold text-slate-700 hover:bg-slate-50">
                {l.label}
              </a>
            ))}
          </nav>
          {!authed ? (
            <div className="mt-3 grid gap-2">
              <Link to="/login?from=landing" className="inline-flex h-12 items-center justify-center rounded-full border border-slate-200 text-sm font-bold text-slate-800">Kirish</Link>
              <Link to={registerPath()} className={`inline-flex h-12 items-center justify-center gap-2 rounded-full text-sm font-bold text-white ${NAVY}`}>
                Ro'yxatdan o'tish · {TRIAL_DAYS} kun bepul
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}

function Hero({ authed }) {
  return (
    <section id="top" className="relative overflow-hidden bg-gradient-to-b from-white via-teal-50/40 to-white">
      <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden="true"
        style={{ backgroundImage: 'radial-gradient(circle at 15% 10%, rgba(20,153,173,0.12), transparent 42%), radial-gradient(circle at 90% 30%, rgba(14,116,144,0.10), transparent 40%)' }} />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:py-24">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white px-3.5 py-1.5 text-xs font-bold text-teal-700 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500" /> {HERO.badge}
          </span>
          <h1 className="mt-5 text-[34px] font-black leading-[1.08] tracking-tight text-slate-950 sm:text-5xl lg:text-[56px]">
            {HERO.titleLead} <span className="bg-gradient-to-r from-teal-500 to-sky-600 bg-clip-text text-transparent">{HERO.titleAccent}</span>
          </h1>
          <p className="mt-5 max-w-xl text-base font-medium leading-relaxed text-slate-600 sm:text-lg">{HERO.text}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              to={authed ? '/' : registerPath()}
              className={`group inline-flex h-14 items-center justify-center gap-3 rounded-full py-2 pl-7 pr-2 text-base font-bold text-white shadow-[0_18px_40px_-14px_rgba(11,42,74,0.7)] ${NAVY}`}
            >
              {authed ? "CRM'ga o'tish" : HERO.primaryCta}
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-teal-500 transition group-hover:translate-x-0.5"><ArrowRight className="h-5 w-5" strokeWidth={2.4} /></span>
            </Link>
            <a
              href="#imkoniyatlar"
              onClick={(e) => { e.preventDefault(); document.getElementById('imkoniyatlar')?.scrollIntoView({ behavior: 'smooth' }); }}
              className="inline-flex h-14 items-center justify-center rounded-full border border-slate-200 bg-white px-7 text-base font-bold text-slate-800 transition hover:border-teal-400 hover:text-teal-700"
            >
              {HERO.secondaryCta}
            </a>
          </div>
          <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2">
            {HERO.perks.map((p) => (
              <li key={p} className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                <Check className="h-4 w-4 text-teal-600" strokeWidth={2.6} /> {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-[520px]">
          <div className="absolute -inset-4 -z-0 rounded-[2.5rem] bg-gradient-to-br from-teal-200/40 to-sky-200/30 blur-2xl" aria-hidden="true" />
          <div className="relative"><PatientChartMock /></div>
          <div className="absolute -bottom-6 -left-3 hidden w-52 sm:block"><TelegramChip /></div>
          <div className="absolute -right-3 -top-5 hidden rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-xl sm:block">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bugungi navbat</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-extrabold text-slate-900"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Kreslo band</p>
          </div>
        </div>
      </div>

      <div className="relative mx-auto max-w-6xl px-4 pb-14 sm:px-6">
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {QUICK_FACTS.map((f) => (
            <li key={f.title} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-[0_10px_30px_-18px_rgba(15,42,74,0.25)]">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600"><Icon name={f.icon} className="h-5 w-5" /></span>
              <span className="min-w-0">
                <span className="block text-[13px] font-extrabold leading-tight text-slate-900">{f.title}</span>
                <span className="mt-0.5 block text-xs font-medium leading-snug text-slate-500">{f.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function TelegramChip() {
  return (
    <div className="rounded-2xl rounded-bl-md border border-slate-100 bg-white p-3 shadow-xl">
      <p className="flex items-center gap-1.5 text-[11px] font-bold text-teal-700"><Send className="h-3.5 w-3.5" /> Telegram eslatma</p>
      <p className="mt-1 text-xs font-medium leading-snug text-slate-600">Qabulingizga 2 soat qoldi. Kelasizmi?</p>
    </div>
  );
}

function Problems() {
  return (
    <section className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHead {...PROBLEMS} />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PROBLEMS.items.map((p) => (
            <article key={p.pain} className="flex flex-col rounded-3xl border border-slate-100 bg-white p-6 shadow-[0_16px_45px_-24px_rgba(15,42,74,0.3)]">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-500"><Icon name={p.icon} className="h-5 w-5" /></span>
              <h3 className="mt-4 text-lg font-extrabold text-slate-900">{p.pain}</h3>
              <p className="mt-1.5 text-sm font-medium leading-relaxed text-slate-500">{p.detail}</p>
              <div className="mt-auto pt-4">
                <div className="flex items-start gap-2.5 rounded-2xl bg-teal-50/70 p-3.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" strokeWidth={2.8} />
                  <p className="text-[13.5px] font-semibold leading-snug text-teal-900"><span className="font-extrabold">SHIFO CRM'da: </span>{p.fix}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="imkoniyatlar" className="scroll-mt-16 bg-slate-50 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHead {...FEATURES} />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.items.map((f) => (
            <article key={f.title} className="rounded-3xl border border-slate-100 bg-white p-6 shadow-[0_16px_45px_-26px_rgba(15,42,74,0.28)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_55px_-24px_rgba(15,42,74,0.35)]">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-600"><Icon name={f.icon} className="h-[22px] w-[22px]" /></span>
                {f.plan ? (
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${f.plan === 'Pro' ? 'bg-[#0b2a4a] text-white' : 'bg-teal-50 text-teal-700'}`}>{f.plan}</span>
                ) : null}
              </div>
              <h3 className="mt-4 text-lg font-extrabold text-slate-900">{f.title}</h3>
              <ul className="mt-3 space-y-2">
                {f.points.map((pt) => (
                  <li key={pt} className="flex items-start gap-2 text-[14px] font-medium leading-snug text-slate-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" strokeWidth={2.6} /> {pt}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <ul className="mt-8 flex flex-wrap justify-center gap-2.5">
          {FEATURES.extras.map((x) => (
            <li key={x} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-[13px] font-bold text-slate-600">{x}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Showcase() {
  return (
    <section className="relative overflow-hidden bg-white py-16 sm:py-24">
      <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center opacity-[0.18]" aria-hidden="true">
        <ToothArch jaw="upper" className="w-[820px] max-w-none" />
      </div>
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHead {...SHOWCASE} />
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-6">
            <PatientsListMock />
            <ImplantMock />
          </div>
          <div className="space-y-6">
            <AppointmentsMock />
            <TelegramMock />
          </div>
          <div className="space-y-6 md:col-span-2 lg:col-span-1">
            <PaymentsMock />
            <PlanMock />
          </div>
        </div>
        <p className="mt-8 text-center text-xs font-semibold text-slate-400">{SHOWCASE.note}</p>
      </div>
    </section>
  );
}

function Steps() {
  return (
    <section className="bg-slate-50 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHead {...STEPS} />
        <ol className="mt-12 grid gap-5 md:grid-cols-3">
          {STEPS.items.map((s, i) => (
            <li key={s.title} className="relative rounded-3xl border border-slate-100 bg-white p-6 shadow-[0_16px_45px_-26px_rgba(15,42,74,0.28)]">
              <span className="absolute right-5 top-4 text-5xl font-black text-slate-100" aria-hidden="true">{i + 1}</span>
              <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-sky-600 text-white shadow-lg shadow-teal-200"><Icon name={s.icon} className="h-6 w-6" /></span>
              <h3 className="relative mt-4 text-lg font-extrabold text-slate-900">{i + 1}. {s.title}</h3>
              <p className="relative mt-2 text-sm font-medium leading-relaxed text-slate-600">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Benefits() {
  return (
    <section className="relative overflow-hidden py-16 sm:py-24" style={{ background: 'linear-gradient(160deg, #0b2a4a 0%, #0b4a6e 55%, #0e7490 100%)' }}>
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHead {...BENEFITS} light />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.items.map((b) => (
            <div key={b.title} className="rounded-3xl border border-white/10 bg-white/[0.07] p-6 backdrop-blur">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-teal-300"><Icon name={b.icon} className="h-5 w-5" /></span>
              <h3 className="mt-4 text-lg font-extrabold text-white">{b.title}</h3>
              <p className="mt-1.5 text-sm font-medium leading-relaxed text-white/75">{b.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  const [openIdx, setOpenIdx] = useState(0);
  return (
    <section id="faq" className="scroll-mt-16 bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHead eyebrow={FAQ.eyebrow} title={FAQ.title} />
        <div className="mt-10 space-y-3">
          {FAQ.items.map((item, i) => {
            const open = openIdx === i;
            return (
              <div key={item.q} className={`rounded-2xl border transition ${open ? 'border-teal-300 bg-teal-50/40' : 'border-slate-200 bg-white'}`}>
                <h3>
                  <button
                    type="button"
                    onClick={() => setOpenIdx(open ? -1 : i)}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-extrabold text-slate-900"
                  >
                    {item.q}
                    <ChevronDown className={`h-5 w-5 shrink-0 text-teal-600 transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                </h3>
                {open ? <p className="px-5 pb-5 text-sm font-medium leading-relaxed text-slate-600">{item.a}</p> : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FinalCta({ authed }) {
  return (
    <section className="bg-white px-4 pb-16 sm:px-6 sm:pb-24">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] px-6 py-14 text-center sm:px-12 sm:py-20" style={{ background: 'linear-gradient(150deg, #0b2a4a 0%, #0b4a6e 50%, #0e7490 100%)' }}>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center opacity-25" aria-hidden="true">
          <ToothArch jaw="upper" stroke="#5eead4" fill="rgba(255,255,255,0.04)" numberColor="#99f6e4" className="-mb-24 w-[760px] max-w-none" />
        </div>
        <div className="relative">
          <h2 className="mx-auto max-w-2xl text-3xl font-black leading-tight tracking-tight text-white sm:text-5xl">{FINAL_CTA.title}</h2>
          <p className="mx-auto mt-4 max-w-xl text-base font-medium leading-relaxed text-white/80 sm:text-lg">{FINAL_CTA.text}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to={authed ? '/' : registerPath()} className="group inline-flex h-14 w-full items-center justify-center gap-3 rounded-full bg-white py-2 pl-7 pr-2 text-base font-bold text-[#0b2a4a] shadow-xl transition hover:bg-teal-50 sm:w-auto">
              {authed ? "CRM'ga o'tish" : FINAL_CTA.primary}
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0b2a4a] text-white"><ArrowRight className="h-5 w-5" /></span>
            </Link>
            <a href={LANDING_CONTACT.telegramUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-full border border-white/35 px-7 text-base font-bold text-white transition hover:bg-white/10 sm:w-auto">
              <Send className="h-5 w-5" /> {FINAL_CTA.secondary}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer({ authed }) {
  const scrollTo = (e, id) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); };
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <Brand />
          <p className="mt-4 max-w-xs text-sm font-medium leading-relaxed text-slate-500">
            Stomatologik klinikalar uchun CRM: bemorlar, FDI tish xaritasi, davolash rejalari, to'lovlar va eslatmalar bir joyda.
          </p>
        </div>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Bo'limlar</p>
          <ul className="mt-4 space-y-2.5 text-sm font-semibold text-slate-600">
            {NAV_LINKS.map((l) => (
              <li key={l.id}><a href={`#${l.id}`} onClick={(e) => scrollTo(e, l.id)} className="hover:text-teal-700">{l.label}</a></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Hisob</p>
          <ul className="mt-4 space-y-2.5 text-sm font-semibold text-slate-600">
            {authed ? (
              <li><Link to="/" className="hover:text-teal-700">CRM'ga o'tish</Link></li>
            ) : (
              <>
                <li><Link to="/login?from=landing" className="hover:text-teal-700">Kirish</Link></li>
                <li><Link to={registerPath()} className="hover:text-teal-700">Ro'yxatdan o'tish ({TRIAL_DAYS} kun bepul)</Link></li>
              </>
            )}
          </ul>
        </div>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Bog'lanish</p>
          <ul className="mt-4 space-y-2.5 text-sm font-semibold text-slate-600">
            <li><a href={LANDING_CONTACT.telegramUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-teal-700"><Send className="h-4 w-4 text-teal-600" /> Telegram</a></li>
            <li><a href={phoneHref()} className="flex items-center gap-2 hover:text-teal-700"><Phone className="h-4 w-4 text-teal-600" /> {phoneLabel()}</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-200 py-5 text-center text-xs font-semibold text-slate-400">
        © {new Date().getFullYear()} {LANDING_CONTACT.brand}. Barcha huquqlar himoyalangan.
      </div>
    </footer>
  );
}

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const authed = !!isAuthenticated;

  useEffect(() => {
    const prev = document.title;
    document.title = "SHIFO CRM — stomatologik klinikalar uchun CRM";
    return () => { document.title = prev; };
  }, []);

  // #root `overflow: hidden` — shu sababli landing o'z scroll konteyneriga ega.
  return (
    <div className="h-full overflow-y-auto overflow-x-hidden bg-white font-inter text-slate-900 antialiased" style={{ WebkitOverflowScrolling: 'touch' }}>
      <Navbar authed={authed} />
      <main>
        <Hero authed={authed} />
        <Problems />
        <Features />
        <Showcase />
        <Steps />
        <Benefits />
        <PricingSection />
        <FaqSection />
        <FinalCta authed={authed} />
      </main>
      <Footer authed={authed} />
    </div>
  );
}
