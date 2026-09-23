import { CountUp } from "@/components/count-up";
import { TrialButton } from "@/components/auth-forms";
import { Button } from "@/components/ui/button";

const visits = [
  ["09:30", "Sardor Aliyev", "Implant", "Tugadi"],
  ["10:15", "Gulnora Nazarova", "Og'riq", "Davomida"],
  ["11:00", "Jasur Tursunov", "Kanal", "Kutilmoqda"],
];

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-16 pt-10 sm:pt-16">
      <div className="hero-grid pointer-events-none absolute inset-0" aria-hidden />
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#1760ff]/20 blur-3xl" aria-hidden />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-[#1760ff]/40 bg-[#1760ff]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9db7ff]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#1760ff]" />
            Stomatologiya klinikalari uchun
          </p>
          <h1 className="mt-6 max-w-xl text-5xl font-semibold leading-[0.96] tracking-tight sm:text-6xl lg:text-[4.4rem]">
            Stomatologiya klinikangiz uchun
            <span className="mt-1 block text-[#1760ff]">bitta operatsion tizim</span>
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-mute">
            Tish kartasi, davolash rejasi, qabul, to&apos;lov va hisobotlar bir joyda ishlaydi.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <TrialButton size="lg" className="w-full sm:w-auto">14 kun bepul sinov</TrialButton>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <a href="#tariflar">Tariflarni ko&apos;rish</a>
            </Button>
          </div>
          <dl className="mt-10 grid max-w-lg grid-cols-3 overflow-hidden rounded-2xl border border-white/10">
            <div className="px-3 py-3 sm:px-4">
              <dt className="text-2xl font-semibold tracking-tight"><CountUp value={50} suffix="+" /></dt>
              <dd className="text-xs text-mute">klinikalar</dd>
            </div>
            <div className="border-l border-white/10 px-3 py-3 sm:px-4">
              <dt className="text-2xl font-semibold tracking-tight"><CountUp value={14} /></dt>
              <dd className="text-xs text-mute">kun bepul</dd>
            </div>
            <div className="border-l border-white/10 px-3 py-3 sm:px-4">
              <dt className="text-2xl font-semibold tracking-tight"><CountUp value={4.9} decimals={1} /></dt>
              <dd className="text-xs text-mute">baho</dd>
            </div>
          </dl>
        </div>
        <DashboardMock />
      </div>
    </section>
  );
}

function DashboardMock() {
  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-[#1760ff]/10 blur-2xl" aria-hidden />
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#10151f] shadow-lift">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-[11px] text-mute">
          <span className="flex gap-1.5" aria-hidden>
            <i className="h-2 w-2 rounded-full bg-white/20" />
            <i className="h-2 w-2 rounded-full bg-white/20" />
            <i className="h-2 w-2 rounded-full bg-white/20" />
          </span>
          <span>shifo.uz/panel</span>
          <span className="font-semibold text-emerald-300">LIVE</span>
        </div>
        <div className="grid gap-0 md:grid-cols-[148px_1fr]">
          <aside className="hidden border-r border-white/10 p-3 md:block">
            {["Tish kartasi", "Modullar", "Imkoniyatlar", "Hamkorlar"].map((item, index) => (
              <div key={item} className={`mb-1 rounded-lg px-3 py-2 text-sm ${index === 0 ? "bg-[#1760ff] font-semibold text-white" : "text-mute"}`}>
                {item}
              </div>
            ))}
          </aside>
          <div className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-mute">Bugungi qabullar</p>
                <p className="text-4xl font-semibold tracking-tight">12 / 14</p>
              </div>
              <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-semibold text-emerald-300">+18%</span>
            </div>
            <ul className="mt-4 space-y-2">
              {visits.map((row) => (
                <li key={row[1]} className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0c121c] px-3 py-2.5 text-sm">
                  <span className="w-12 text-mute">{row[0]}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{row[1]}</span>
                  <span className="hidden text-mute sm:inline">{row[2]}</span>
                  <span className="rounded-full bg-[#1760ff]/15 px-2 py-0.5 text-xs font-semibold text-[#9db7ff]">{row[3]}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 grid grid-cols-[1fr_128px] gap-3">
              <div className="flex h-24 items-end gap-1.5 rounded-xl border border-white/10 bg-[#0c121c] px-3 pb-3" aria-hidden>
                {[40, 62, 48, 80, 56, 90, 70].map((height) => (
                  <span key={height} className="flex-1 rounded-sm bg-[#1760ff]" style={{ height: `${height}%` }} />
                ))}
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0c121c] p-3">
                <p className="text-xs font-semibold">Davolash rejasi</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {["Tashxis", "Rentgen", "Retsept", "Keyingi"].map((item) => (
                    <span key={item} className="rounded-md bg-[#1760ff]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#9db7ff]">{item}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
