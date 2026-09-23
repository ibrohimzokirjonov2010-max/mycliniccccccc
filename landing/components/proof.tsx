const cities = ["Toshkent", "Samarqand", "Buxoro", "Andijon", "Farg'ona", "Namangan"];

export function Proof() {
  return (
    <section className="py-8" aria-labelledby="proof-title">
      <div className="mx-auto max-w-6xl px-4">
        <div className="rounded-3xl border border-line bg-surface px-6 py-10 sm:px-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9db7ff]">Ishonch</p>
          <h2 id="proof-title" className="mt-3 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">O&apos;zbekiston bo&apos;ylab kabinetlar shu tizimda ishlaydi</h2>
          <p className="mt-3 max-w-2xl text-mute">Bemor kartasi, navbat va to&apos;lov bir oynada. Tarif ochiq, sinov 14 kun, to&apos;lov Payme yoki Click orqali.</p>
          <ul className="mt-8 flex flex-wrap gap-2">
            {cities.map((city) => (
              <li key={city} className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-[#d5deea]">
                {city}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
