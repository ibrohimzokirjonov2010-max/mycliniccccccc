import { CalendarDays, ChartColumn, FileImage, Shield, Smile, UserRound } from "lucide-react";

const features = [
  {
    icon: UserRound,
    title: "Bemor profili",
    text: "Aloqa, tibbiy tarix, fayllar va tashriflar bir joyda.",
  },
  {
    icon: CalendarDays,
    title: "Qabul jadvali",
    text: "Shifokor bo'yicha vaqtlar, no-show nazorati va eslatmalar.",
  },
  {
    icon: Smile,
    title: "Implant moduli",
    text: "Qaysi tish, qaysi model, qancha dona — reja saqlanadi.",
  },
  {
    icon: FileImage,
    title: "Fayl arxivi",
    text: "Tashxis, rentgen va protokol bemor kartasiga yopishadi.",
  },
  {
    icon: ChartColumn,
    title: "Hisobotlar",
    text: "Tushum, bandlik va shifokor kesimi raqam bilan chiqadi.",
  },
  {
    icon: Shield,
    title: "Ruxsatlar",
    text: "Admin va shifokor alohida kiradi, kassa alohida ko'rinadi.",
  },
];

export function Features() {
  return (
    <section className="py-8" aria-labelledby="features-title">
      <div className="mx-auto max-w-6xl px-4">
        <p className="inline-flex items-center gap-2 rounded-full border border-[#1760ff]/40 bg-[#1760ff]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9db7ff]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#1760ff]" />
          Asosiy imkoniyatlar
        </p>
        <h2 id="features-title" className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          Marketing sahifa emas, real klinika ishida kerak bo&apos;ladigan modullar.
        </h2>
        <ul className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
            <li key={feature.title} className="rounded-2xl border border-line bg-surface p-5">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#1760ff]/15 text-[#8eb4ff]">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-xl font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mute">{feature.text}</p>
            </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
