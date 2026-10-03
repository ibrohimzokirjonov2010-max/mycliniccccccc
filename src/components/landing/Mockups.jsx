import { memo } from 'react';
import { Check, CalendarDays, Wallet, Send, Bell, ShieldCheck, Search } from 'lucide-react';
import ToothArch from './ToothArch';

/**
 * Ilova ekranlarining yengil mockup'lari (HTML/CSS, rasm yo'q).
 * Hamma ma'lumot NAMUNAVIY — haqiqiy mijoz yoki statistika emas.
 */

export function MockWindow({ title, children, className = '' }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_18px_50px_-18px_rgba(15,42,74,0.25)] ${className}`}>
      <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50/80 px-3.5 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
        <span className="ml-2 truncate text-[11px] font-semibold text-slate-400">{title}</span>
      </div>
      {children}
    </div>
  );
}

const LEGEND = [
  ['bg-rose-400', 'Karies'],
  ['bg-sky-500', 'Plomba'],
  ['bg-teal-500', 'Implant'],
  ['bg-amber-500', 'Koronka'],
];

export const PatientChartMock = memo(function PatientChartMock({ compact = false }) {
  return (
    <MockWindow title="Bemor kartasi · Tish xaritasi (FDI)">
      <div className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-sm font-black text-teal-700">NB</span>
            <div>
              <p className="text-sm font-extrabold leading-tight text-slate-900">Namuna bemor</p>
              <p className="text-[11px] font-medium text-slate-400">+998 •• ••• •• ••</p>
            </div>
          </div>
          <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-bold text-teal-700">Kattalar tishlari</span>
        </div>
        <div className="rounded-xl bg-slate-50/70 p-1.5 sm:p-2">
          <ToothArch jaw="upper" className="mx-auto w-full max-w-[400px]" marks={{ 16: 'caries', 21: 'crown', 24: 'filling', 26: 'filling' }} />
          <ToothArch jaw="lower" className="mx-auto -mt-3 w-full max-w-[400px]" marks={{ 36: 'implant', 46: 'caries', 33: 'plan' }} />
        </div>
        {!compact && (
          <div className="mt-3 flex flex-wrap gap-x-3.5 gap-y-1.5">
            {LEGEND.map(([c, l]) => (
              <span key={l} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                <span className={`h-2.5 w-2.5 rounded-full ${c}`} />
                {l}
              </span>
            ))}
          </div>
        )}
      </div>
    </MockWindow>
  );
});

const GRID_ROWS = ['09:00', '10:00', '11:00', '12:00', '13:00'];
const GRID_COLS = [
  { name: 'Shifokor 1', cls: 'bg-teal-50 border-teal-400 text-teal-800', slots: { 0: ['Konsultatsiya', 1], 2: ['Davolash', 2] } },
  { name: 'Shifokor 2', cls: 'bg-sky-50 border-sky-400 text-sky-800', slots: { 1: ['Implant', 2], 4: ['Tozalash', 1] } },
  { name: 'Shifokor 3', cls: 'bg-amber-50 border-amber-400 text-amber-800', slots: { 0: ['Plomba', 1], 3: ['Koronka', 2] } },
];

export const AppointmentsMock = memo(function AppointmentsMock() {
  return (
    <MockWindow title="Uchrashuvlar · Setka">
      <div className="p-3 sm:p-4">
        <div className="mb-2.5 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900"><CalendarDays className="h-4 w-4 text-teal-600" /> Bugun</p>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">Setka</span>
        </div>
        <div className="grid grid-cols-[34px_repeat(3,1fr)] gap-x-1.5 text-[10px]">
          <span />
          {GRID_COLS.map((c) => (
            <span key={c.name} className="truncate pb-1.5 text-center font-bold text-slate-500">{c.name}</span>
          ))}
          <div>
            {GRID_ROWS.map((time) => (
              <span key={time} className="block h-10 pt-0.5 font-semibold text-slate-400">{time}</span>
            ))}
          </div>
          {GRID_COLS.map((c) => (
            <div
              key={c.name}
              className="relative"
              style={{
                height: GRID_ROWS.length * 40,
                backgroundImage: 'repeating-linear-gradient(to bottom, #e2e8f0 0, #e2e8f0 1px, transparent 1px, transparent 40px)',
              }}
            >
              {Object.entries(c.slots).map(([r, [label, span]]) => (
                <div
                  key={label}
                  style={{ top: Number(r) * 40 + 2, height: span * 40 - 4 }}
                  className={`absolute inset-x-0 overflow-hidden rounded-lg border-l-[3px] px-1.5 py-1 font-bold leading-tight ${c.cls}`}
                >
                  {label}
                  <span className="mt-0.5 block truncate text-[9px] font-medium opacity-70">Namuna bemor</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </MockWindow>
  );
});

export const PaymentsMock = memo(function PaymentsMock() {
  const rows = [
    ['Naqd', 'bg-emerald-50 text-emerald-700', "To'landi"],
    ['Karta', 'bg-sky-50 text-sky-700', "To'landi"],
    ["O'tkazma", 'bg-violet-50 text-violet-700', "To'landi"],
    ['Qarz', 'bg-rose-50 text-rose-600', 'Qoldiq bor'],
  ];
  return (
    <MockWindow title="To'lovlar va qarzlar">
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-3 gap-2">
          {[["To'langan", 'text-emerald-600'], ['Qarz', 'text-rose-500'], ['Jami', 'text-slate-900']].map(([l, c]) => (
            <div key={l} className="rounded-xl bg-slate-50 p-2.5">
              <p className="text-[10px] font-semibold text-slate-400">{l}</p>
              <p className={`mt-1 text-sm font-black ${c}`}>• • • •</p>
            </div>
          ))}
        </div>
        <div className="space-y-1.5">
          {rows.map(([m, cls, st]) => (
            <div key={m} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2">
              <span className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <Wallet className="h-3.5 w-3.5 text-teal-600" /> {m}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{st}</span>
            </div>
          ))}
        </div>
      </div>
    </MockWindow>
  );
});

export const TelegramMock = memo(function TelegramMock() {
  return (
    <MockWindow title="Telegram · Avtomatik eslatma">
      <div className="space-y-2.5 bg-[#eaf3f6] p-4">
        <div className="max-w-[88%] rounded-2xl rounded-tl-md bg-white p-3 shadow-sm">
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-teal-700"><Bell className="h-3.5 w-3.5" /> 07:00 · Ertalabki eslatma</p>
          <p className="mt-1 text-xs font-medium leading-relaxed text-slate-700">Bugun sizda qabul bor. Klinikamizda kutib qolamiz!</p>
        </div>
        <div className="max-w-[88%] rounded-2xl rounded-tl-md bg-white p-3 shadow-sm">
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-teal-700"><Send className="h-3.5 w-3.5" /> 2 soat oldin</p>
          <p className="mt-1 text-xs font-medium leading-relaxed text-slate-700">Qabulingizga 2 soat qoldi. Kelasizmi?</p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <span className="rounded-lg bg-teal-600 py-1.5 text-center text-[11px] font-bold text-white">Tasdiqlayman</span>
            <span className="rounded-lg bg-slate-100 py-1.5 text-center text-[11px] font-bold text-slate-500">Kela olmayman</span>
          </div>
        </div>
      </div>
    </MockWindow>
  );
});

export const PlanMock = memo(function PlanMock() {
  const steps = [
    ['Tekshiruv va tozalash', 'done'],
    ['Karies davolash (16)', 'done'],
    ['Implant o\'rnatish (36)', 'now'],
    ['Koronka (36)', 'todo'],
  ];
  return (
    <MockWindow title="Davolash rejasi">
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-extrabold text-slate-900">Namuna reja</p>
          <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-bold text-teal-700">2 / 4 bosqich</span>
        </div>
        <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-teal-500 to-sky-500" />
        </div>
        <ol className="space-y-1.5">
          {steps.map(([t, s]) => (
            <li key={t} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-xs font-bold ${s === 'now' ? 'border-teal-300 bg-teal-50/60 text-teal-800' : 'border-slate-100 text-slate-600'}`}>
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${s === 'done' ? 'bg-teal-600 text-white' : s === 'now' ? 'border-2 border-teal-500 bg-white' : 'border border-slate-300'}`}>
                {s === 'done' ? <Check className="h-3 w-3" /> : null}
              </span>
              <span className="truncate">{t}</span>
            </li>
          ))}
        </ol>
      </div>
    </MockWindow>
  );
});

export const ImplantMock = memo(function ImplantMock() {
  const specs = [['Tizim', '••••••'], ['Lot', '••••••'], ['Torque', '•• Ncm'], ['ISQ', '••']];
  return (
    <MockWindow title="Implant · Klinik pasport">
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900"><ShieldCheck className="h-4 w-4 text-teal-600" /> Klinik pasport</p>
          <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-bold text-white">PDF</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {specs.map(([l, v]) => (
            <div key={l} className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
              <p className="text-[10px] font-semibold text-slate-400">{l}</p>
              <p className="mt-0.5 text-sm font-black text-slate-800">{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-teal-50 px-3 py-2 text-[11px] font-bold text-teal-800">
          <Check className="h-3.5 w-3.5" /> Tish: 36 · Pastki jag
        </div>
      </div>
    </MockWindow>
  );
});

export const PatientsListMock = memo(function PatientsListMock() {
  return (
    <MockWindow title="Bemorlar">
      <div className="p-4">
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-400">
          <Search className="h-3.5 w-3.5" /> Ism yoki telefon bo'yicha qidirish
        </div>
        {['Namuna bemor 1', 'Namuna bemor 2', 'Namuna bemor 3'].map((n, i) => (
          <div key={n} className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">
            <span className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-[11px] font-black text-teal-700">{i + 1}</span>
              <span className="text-xs font-bold text-slate-700">{n}</span>
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${i === 1 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-700'}`}>{i === 1 ? 'Qarz' : 'Faol'}</span>
          </div>
        ))}
      </div>
    </MockWindow>
  );
});
