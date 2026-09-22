export function About() {
  return (
    <section id="biz-haqimizda" className="scroll-mt-24 bg-[#efeae0] py-20">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-[1.1fr_.9fr] md:items-center">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-teal">Biz haqimizda</p>
          <h2 className="mt-2 font-display text-4xl leading-tight sm:text-5xl">Klinika egasi uchun yozilgan, bemor sayti emas</h2>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-mute">
            SHIFO CRM O&apos;zbekistondagi stomatologiya kabineti va klinikasi uchun. Bemor kartochkasi, implant hisobi, navbat va to&apos;lov bir ish stolida turadi.
          </p>
        </div>
        <ul className="grid gap-3">
          {[
            ["O'zbek tilida", "Interfeys va qo'llab-quvvatlash shu tilda."],
            ["Implant moduli tayyor", "Reja, zaxira va hisobot alohida jadval emas."],
            ["Oylik litsenziya", "To'lovdan keyin 30 kunlik tarif avtomatik ochiladi."],
          ].map(([title, text]) => (
            <li key={title} className="rounded-2xl bg-white px-5 py-4">
              <p className="font-semibold">{title}</p>
              <p className="text-sm text-mute">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
