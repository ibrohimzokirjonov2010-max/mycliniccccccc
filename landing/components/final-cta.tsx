import { TrialButton } from "@/components/auth-forms";

const chips = ["SHIFO CRM", "Stomatologiya klinikalari", "14 kun bepul"];

export function FinalCta() {
  return (
    <section id="aloqa" className="scroll-mt-24 py-20" aria-labelledby="final-cta-title">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid items-center gap-10 rounded-[2rem] border border-[#1760ff]/30 bg-[radial-gradient(circle_at_0%_0%,rgba(23,96,255,0.28),transparent_42%),#10151f] p-6 sm:p-10 lg:grid-cols-2">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[#1760ff]/40 bg-[#1760ff]/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#c5d4ff]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#1760ff]" />
              Biz bilan boshlang
            </p>
            <h2 id="final-cta-title" className="mt-5 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Klinikangiz uchun SHIFO ni 14 kunga oching
            </h2>
            <p className="mt-4 max-w-xl text-lg text-[#c5d0e0]">
              Ro&apos;yxatdan o&apos;ting, parolni o&apos;zingiz qo&apos;ying va shu zahoti CRM ga kiring. Sinov tugasa, tarifni Payme yoki Click orqali uzaytirasiz.
            </p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {chips.map((chip) => (
                <li key={chip} className="rounded-full border border-white/15 px-3 py-1 text-sm text-[#d5deea]">
                  {chip}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <TrialButton size="lg">Ro&apos;yxatdan o&apos;tish</TrialButton>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0c121c]/80 p-6">
            <p className="text-sm font-semibold text-[#9db7ff]">Aloqa</p>
            <ul className="mt-4 space-y-3 text-sm">
              <li><a className="font-semibold hover:text-[#9db7ff]" href="mailto:hello@shifo.uz">hello@shifo.uz</a></li>
              <li><a className="font-semibold hover:text-[#9db7ff]" href="https://t.me/shifocrm">Telegram @shifocrm</a></li>
              <li><a className="font-semibold hover:text-[#9db7ff]" href="/tariflar">Ochiq tariflar</a></li>
            </ul>
            <p className="mt-6 text-sm leading-relaxed text-mute">Savol bo&apos;lsa yozing. Sinov uchun ariza kutib o&apos;tirmaysiz — hisob o&apos;zi ochiladi.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
