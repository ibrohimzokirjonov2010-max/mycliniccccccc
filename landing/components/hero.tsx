import { CalendarDays } from "lucide-react";
import { CountUp } from "@/components/count-up";
import { LaptopMock } from "@/components/product-views";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-paper pb-8 pt-6 sm:pt-10">
      <div className="pointer-events-none absolute left-0 top-0 h-48 w-72 bg-[radial-gradient(circle_at_0_0,rgba(16,24,26,0.45),transparent_68%)]" />
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="relative z-10 max-w-xl">
          <p className="animate-fade-up text-sm font-semibold uppercase tracking-[0.18em] text-teal-ink">Stomatologiya klinikalari uchun</p>
          <h1 className="mt-4 font-display text-[2.7rem] font-medium leading-[0.98] text-ink sm:text-6xl lg:text-[4.35rem]">
            <span className="animate-fade-up block">Klinika chalkashligi</span>
            <span className="animate-fade-up d2 block">
              <span className="text-teal">tugadi</span> — stomatolog
            </span>
            <span className="animate-fade-up d3 block">CRM bir joyda</span>
          </h1>
          <p className="animate-fade-up d3 mt-5 max-w-md text-lg text-mute sm:text-xl">
            bemor, implant, to&apos;lov, navbat — bitta tizim.
          </p>
          <div className="animate-fade-up d4 mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a href="#modullar">Demo ko&apos;rish <span aria-hidden>→</span></a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#tariflar"><CalendarDays className="h-4 w-4" /> Narx so&apos;rash</a>
            </Button>
          </div>
          <dl className="animate-fade-up d5 mt-10 flex flex-wrap items-center gap-x-5 gap-y-4">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-teal text-white" aria-hidden>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="8" cy="9" r="2"/><circle cx="16" cy="9" r="2"/><path d="M4 18c.6-2 2.2-3 4-3s3.4 1 4 3M12 18c.6-2 2.2-3 4-3s3.4 1 4 3"/></svg>
              </span>
              <div>
                <dt className="font-display text-2xl leading-none"><CountUp value={50} suffix="+" /></dt>
                <dd className="text-sm text-mute">klinika</dd>
              </div>
            </div>
            <span className="hidden h-10 w-px bg-line sm:block" />
            <div className="flex items-center gap-3">
              <span className="text-teal" aria-hidden>★</span>
              <div>
                <dt className="font-display text-2xl leading-none"><CountUp value={4.9} decimals={1} /> ★</dt>
                <dd className="text-sm text-mute">stomatologlar bahosi</dd>
              </div>
            </div>
            <span className="hidden h-10 w-px bg-line sm:block" />
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-teal text-white" aria-hidden>
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M12 3c-2.2 3.2-3.4 5.4-3.4 8.2a3.4 3.4 0 0 0 6.8 0C15.4 8.4 14.2 6.2 12 3z"/></svg>
              </span>
              <div>
                <dt className="sr-only">Modul</dt>
                <dd className="max-w-[8rem] text-sm font-semibold leading-tight">implant moduli</dd>
              </div>
            </div>
          </dl>
        </div>
        <div className="relative lg:translate-x-6">
          <div className="origin-top scale-[0.86] sm:scale-100">
            <LaptopMock />
          </div>
        </div>
      </div>
    </section>
  );
}
