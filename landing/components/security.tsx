export function Security() {
  const items = [
    ["Imzo tekshiriladi", "Payme Basic auth va Click MD5 imzosi mos kelmasa, tarif ochilmaydi."],
    ["Karta bu yerda emas", "Karta ma'lumoti Payme yoki Clickda qoladi. Bizga faqat tasdiqlangan to'lov keladi."],
    ["Summa qulflangan", "Webhookdagi summa tarif narxiga teng bo'lmasa, litsenziya berilmaydi."],
  ];
  return (
    <section id="xavfsizlik" className="scroll-mt-24 bg-cream py-20">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-teal">Xavfsizlik</p>
          <h2 className="mt-2 font-display text-4xl leading-tight sm:text-5xl">To&apos;lov tasdiqlanmaguncha tarif yopiq</h2>
        </div>
        <ul className="grid gap-4 sm:grid-cols-3">
          {items.map(([title, text]) => (
            <li key={title} className="rise rounded-3xl border border-line bg-white p-5">
              <p className="font-display text-2xl">{title}</p>
              <p className="mt-2 text-sm leading-relaxed text-mute">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
