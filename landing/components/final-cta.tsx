import { DemoDialog } from "@/components/demo-dialog";
import { appLabel, appUrl } from "@/lib/utils";

const points = [
  { title: "Sozlash yordam", text: "Tez sozlash va ishga tushirish bo'yicha yordam", mark: "⚙" },
  { title: "O'zbek tilida", text: "To'liq o'zbek tilida interfeys va qo'llab-quvvatlash", mark: "UZ" },
  { title: "Implant moduli tayyor", text: "Implant rejalari, zaxira va hisobotlar modulini darhol ishlating.", mark: "⌁" },
];

export function FinalCta() {
  return (
    <section className="bg-deep text-white" aria-labelledby="final-cta-title">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 lg:grid-cols-2">
        <div>
          <h2 id="final-cta-title" className="font-display text-5xl leading-[1.02] sm:text-6xl">Klinikangizni bugun raqamlashtiring</h2>
          <p className="mt-5 max-w-xl text-lg text-[#d7ebe7]">
            SHIFO CRM bilan bemor boshqaruvi, implant moduli va klinika jarayonlarini bir platformada soddalashtiring.
          </p>
          <div className="mt-8">
            <DemoDialog label="Bepul demo olish" size="xl" />
          </div>
        </div>
        <ul className="space-y-6">
          {points.map((item) => (
            <li key={item.title} className="flex gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-white/25 text-sm font-bold">{item.mark}</span>
              <div>
                <p className="font-display text-2xl">{item.title}</p>
                <p className="text-[#d5e4e0]">{item.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="border-t border-white/10">
        <ul className="mx-auto grid max-w-6xl gap-4 px-4 py-6 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <li><a className="block rounded-2xl px-2 py-2 hover:bg-white/5" href="mailto:hello@shifo.uz"><span className="block text-[#b7d4cf]">Savollaringiz uchun</span><span className="font-semibold">hello@shifo.uz</span></a></li>
          <li><a className="block rounded-2xl px-2 py-2 hover:bg-white/5" href="https://t.me/shifocrm"><span className="block text-[#b7d4cf]">Telegram orqali yozing</span><span className="font-semibold">@shifocrm</span></a></li>
          <li><a className="block rounded-2xl px-2 py-2 hover:bg-white/5" href={appUrl()}><span className="block text-[#b7d4cf]">Vercel app&apos;da sinab ko&apos;ring</span><span className="font-semibold">{appLabel()}</span></a></li>
          <li className="px-2 py-2"><span className="block text-[#b7d4cf]">Ishonchli. Xavfsiz.</span><span className="font-semibold">Sizning klinikangiz uchun yaratilgan.</span></li>
        </ul>
      </div>
    </section>
  );
}
