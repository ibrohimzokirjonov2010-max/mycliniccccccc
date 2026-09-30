"use client";

import { useState, type ReactElement } from "react";
import { chargeAmount, formatUzs, TARIFFS, type BillingCycle, type PlanId } from "@/config/tariffs";

const NAVY = "#0b2f45";
const TEAL = "#0f766e";

function ToothMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M24 4c-4.8 0-8.2 2.6-9.8 6.4-1.3 3-2.2 5.2-4.2 6.8C7.2 19.4 5 21.6 5 26.2 5 32.2 8.4 37.6 12 43c1.6 2.4 3.2 4 5.6 4 2.2 0 3.2-2.2 4.6-5.6.6-1.6 1.2-1.6 1.8 0C25.4 44.8 26.4 47 28.6 47c2.4 0 4-1.6 5.6-4 3.6-5.4 7-10.8 7-16.8 0-4.6-2.2-6.8-5-9-2-1.6-2.9-3.8-4.2-6.8C32.4 6.6 29 4 24 4z"
      />
    </svg>
  );
}

function ToothArc({ light = false }: { light?: boolean }) {
  const teeth = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
  return (
    <svg viewBox="0 0 360 78" className="h-16 w-full max-w-[280px]" aria-hidden="true">
      {teeth.map((num, index) => {
        const t = index / (teeth.length - 1);
        const x = 16 + t * 328;
        const y = 8 + Math.sin(t * Math.PI) * 28;
        return (
          <g key={num} transform={`translate(${x} ${y})`}>
            <path
              d="M0 4c-2.2 0-3.6 1.6-4 3.2-.4 1.6-.8 2.6-1.6 3.2-1.2 1-2 2-2 4.2 0 2.8 1.4 5.2 2.8 7.6.6 1 1.2 1.6 2 1.6.8 0 1.2-.8 1.6-2 .2-.6.4-.6.6 0 .4 1.2.8 2 1.6 2s1.2-.6 1.6-1.6c.6-2.4 1.4-4.8 2.8-7.6 0-2.2-.8-3.2-2-4.2-.8-.6-1.2-1.6-1.6-3.2C3.6 5.6 2.2 4 0 4z"
              fill="none"
              stroke={light ? "rgba(255,255,255,0.55)" : TEAL}
              strokeWidth="1.1"
            />
            <text
              x="0"
              y="22"
              textAnchor="middle"
              fontSize="6.5"
              fill={light ? "rgba(255,255,255,0.7)" : TEAL}
              fontFamily="ui-sans-serif, system-ui, sans-serif"
            >
              {num}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function RowIcon({ id, light = false }: { id: string; light?: boolean }) {
  const stroke = light ? "#d7f5f1" : TEAL;
  const common = { fill: "none", stroke, strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, ReactElement> = {
    calendar: <svg viewBox="0 0 24 24" className="h-4 w-4" {...{}}>
      <rect {...common} x="4" y="5" width="16" height="15" rx="2" />
      <path {...common} d="M8 3.5v3M16 3.5v3M4 10h16" />
    </svg>,
    patients: <svg viewBox="0 0 24 24" className="h-4 w-4"><path {...common} d="M12 12a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm-6 7.5a6 6 0 0 1 12 0" /></svg>,
    history: <svg viewBox="0 0 24 24" className="h-4 w-4"><path {...common} d="M8 4h6l4 4v12H8zM14 4v4h4M10 13h6M10 17h4" /></svg>,
    plans: <svg viewBox="0 0 24 24" className="h-4 w-4"><path {...common} d="M8 6h8M8 12h8M8 18h5M5 6h.01M5 12h.01M5 18h.01" /></svg>,
    payments: <svg viewBox="0 0 24 24" className="h-4 w-4"><rect {...common} x="3" y="6" width="18" height="12" rx="2" /><path {...common} d="M3 10h18" /></svg>,
    services: <svg viewBox="0 0 24 24" className="h-4 w-4"><path {...common} d="M8 6h11M8 12h11M8 18h11M5 6h.01M5 12h.01M5 18h.01" /></svg>,
    phone: <svg viewBox="0 0 24 24" className="h-4 w-4"><rect {...common} x="8" y="3" width="8" height="18" rx="2" /><path {...common} d="M11 18h2" /></svg>,
    all: <svg viewBox="0 0 24 24" className="h-4 w-4"><path {...common} d="M6 12.5 10 16l8-8" /></svg>,
    implant: <svg viewBox="0 0 24 24" className="h-4 w-4"><path {...common} d="M12 3v4M9 7h6M10 7c0 4-1 6-1 9h6c0-3-1-5-1-9M11 16v5M13 16v5" /></svg>,
    staff: <svg viewBox="0 0 24 24" className="h-4 w-4"><path {...common} d="M8 11a2.5 2.5 0 1 0-2.5-2.5A2.5 2.5 0 0 0 8 11zm8 1a2.2 2.2 0 1 0-2.2-2.2A2.2 2.2 0 0 0 16 12zM3.5 18.5a4.5 4.5 0 0 1 9 0M13 18.5a4 4 0 0 1 7.5 0" /></svg>,
    stock: <svg viewBox="0 0 24 24" className="h-4 w-4"><path {...common} d="M4 8h16v11H4zM8 8V5h8v3M4 13h16" /></svg>,
    leads: <svg viewBox="0 0 24 24" className="h-4 w-4"><path {...common} d="M12 20a8 8 0 1 0-8-8M12 12l4-4M12 8v4h4" /></svg>,
    marketing: <svg viewBox="0 0 24 24" className="h-4 w-4"><path {...common} d="M5 12V7l12-3v14L5 15v-3M5 12h2" /></svg>,
    doctor: <svg viewBox="0 0 24 24" className="h-4 w-4"><path {...common} d="M12 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm-6 8a6 6 0 0 1 12 0M16 6h4M18 4v4" /></svg>,
    manager: <svg viewBox="0 0 24 24" className="h-4 w-4"><path {...common} d="M12 3l2 4 4.5.6-3.3 3.1.8 4.5L12 13.2 7.9 15.2l.8-4.5L5.5 7.6 10 7z" /></svg>,
    migrate: <svg viewBox="0 0 24 24" className="h-4 w-4"><path {...common} d="M7 7h10v4H7zM7 13h6v4H7zM16 15h3M17.5 13.5v3" /></svg>,
    train: <svg viewBox="0 0 24 24" className="h-4 w-4"><path {...common} d="M4 18h16M7 18V8l5-3 5 3v10M10 18v-4h4v4" /></svg>,
    setup: <svg viewBox="0 0 24 24" className="h-4 w-4"><circle {...common} cx="12" cy="12" r="3" /><path {...common} d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" /></svg>,
  };
  return (
    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${light ? "bg-white/10" : "bg-teal-50"}`}>
      {paths[id] || paths.all}
    </span>
  );
}

function registerHref(plan: PlanId, cycle: BillingCycle) {
  return `/royxatdan-otish?plan=${plan}&cycle=${cycle}`;
}

export function Pricing({ standalone = false }: { standalone?: boolean }) {
  const [cycle, setCycle] = useState<BillingCycle>("month");
  const yearly = cycle === "year";

  return (
    <section id="tariflar" className="scroll-mt-24 bg-[#f4f7fb] text-[#102033]" style={{ backgroundImage: "linear-gradient(to right, rgba(15,42,68,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,42,68,0.045) 1px, transparent 1px)", backgroundSize: "32px 32px" }}>
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <a href={standalone ? "/" : "#tariflar"} className="inline-flex items-center gap-2.5 text-[#0b3a4a]">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-[#0f766e] shadow-sm ring-1 ring-slate-200">
              <ToothMark />
            </span>
            <span className="text-lg font-semibold tracking-tight">My Clinic</span>
          </a>
          <div className="hidden flex-1 justify-center pt-1 lg:flex">
            <ToothArc />
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
                <span className="text-[#0f766e]" aria-hidden>◷</span> 14 kunlik bepul sinov
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
                <span className="text-[#0f766e]" aria-hidden>▣</span> Yillik to&apos;lovda 2 oy bepul
              </span>
            </div>
            <a
              href={registerHref("pro", cycle)}
              className="inline-flex items-center gap-3 rounded-full bg-[#0b3550] py-1.5 pl-5 pr-1.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/10"
            >
              Bepul sinab ko&apos;ring
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#14b8a6] text-lg text-white">→</span>
            </a>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-5 lg:mt-6 lg:flex-row lg:items-end lg:justify-between">
          <h2 className="max-w-xl text-4xl font-semibold tracking-tight text-[#102033] sm:text-5xl">
            Klinikangiz uchun <span className="text-[#0f766e]">to&apos;g&apos;ri tarif</span>
          </h2>
          <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm" role="group" aria-label="To'lov davri">
            <button
              type="button"
              aria-pressed={!yearly}
              onClick={() => setCycle("month")}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${!yearly ? "bg-[#0b3550] text-white" : "text-slate-600"}`}
            >
              Oylik
            </button>
            <button
              type="button"
              aria-pressed={yearly}
              onClick={() => setCycle("year")}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${yearly ? "bg-[#0b3550] text-white" : "text-slate-600"}`}
            >
              Yillik · 2 oy bepul
            </button>
          </div>
        </div>

        <div className="mt-10 grid items-stretch gap-5 lg:grid-cols-3">
          {TARIFFS.map((item) => {
            const featured = item.recommended;
            const amount = chargeAmount(item.id, cycle);
            return (
              <article
                key={item.id}
                className={`relative flex flex-col overflow-hidden rounded-[28px] p-6 shadow-[0_18px_50px_-28px_rgba(15,42,68,0.45)] sm:p-7 ${
                  featured
                    ? "order-first bg-gradient-to-b from-[#0b2c44] via-[#0e4c62] to-[#0f766e] text-white lg:order-none"
                    : "order-none border border-white bg-white text-[#102033]"
                }`}
              >
                {featured ? (
                  <span className="absolute right-5 top-5 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#0b3550] shadow-sm">
                    ★ Eng ommabop
                  </span>
                ) : null}
                <h3 className={`font-display text-3xl font-semibold ${featured ? "text-white" : "text-[#102033]"}`}>{item.name}</h3>
                <p className={`mt-1 max-w-[16rem] text-sm ${featured ? "text-white/80" : "text-slate-500"}`}>{item.audience}</p>
                <p className="mt-5 flex items-end gap-2">
                  <span className="text-4xl font-semibold tracking-tight sm:text-5xl">{formatUzs(amount)}</span>
                  <span className={`mb-1 text-sm font-medium ${featured ? "text-white/75" : "text-slate-500"}`}>
                    so&apos;m/{yearly ? "yiliga" : "oyiga"}
                  </span>
                </p>
                {yearly ? <p className={`mt-1 text-xs font-semibold ${featured ? "text-teal-100" : "text-[#0f766e]"}`}>10 oy narxi · 2 oy bepul</p> : null}
                <ul className="mt-6 flex-1 space-y-3">
                  {item.features.map((feature) => (
                    <li key={feature.label} className="flex items-start gap-2.5 text-sm leading-snug">
                      <RowIcon id={feature.id} light={featured} />
                      <span className={featured ? "text-white/95" : "text-slate-700"}>{feature.label}</span>
                    </li>
                  ))}
                </ul>
                <div className={`pointer-events-none mt-4 ${featured ? "opacity-80" : "opacity-70"}`}>
                  <ToothArc light={featured} />
                </div>
                <a
                  href={registerHref(item.id, cycle)}
                  className={`mt-2 inline-flex h-12 items-center justify-center rounded-2xl text-sm font-semibold ${
                    featured
                      ? "bg-white text-[#0b3550]"
                      : "border border-[#0b3550]/20 bg-white text-[#0b3550] hover:bg-slate-50"
                  }`}
                >
                  Bepul sinab ko&apos;ring
                </a>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
