const patients = [
  ["Aliyeva Sardor", "+998 90 123 45 67", "12.05.2024", "Aktiv", "bg-emerald-50 text-emerald-700"],
  ["Karimova Dilnoza", "+998 91 234 56 78", "08.05.2024", "Aktiv", "bg-emerald-50 text-emerald-700"],
  ["Tursunov Jasur", "+998 93 345 67 89", "03.05.2024", "Navbatda", "bg-amber-50 text-amber-700"],
  ["Ismoilova Nigora", "+998 94 456 78 90", "01.05.2024", "Aktiv", "bg-emerald-50 text-emerald-700"],
  ["Rahmonov Farrux", "+998 97 567 89 01", "28.04.2024", "Yakunlangan", "bg-stone-100 text-stone-500"],
] as const;

export function LaptopMock() {
  return (
    <div className="relative mx-auto w-full max-w-[680px] animate-float [perspective:1600px]">
      <div className="relative rounded-[1.6rem] border border-[#1c1c1c] bg-[#1a1d1c] p-2 shadow-lift [transform:rotateX(8deg)_rotateY(-14deg)]">
        <div className="absolute left-1/2 top-1.5 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#3a3a3a]" />
        <div className="overflow-hidden rounded-[1.15rem] bg-[#f7f8f6]">
          <div className="flex items-center justify-between border-b border-[#e7ebe8] px-3 py-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-ink">
              <span className="grid h-5 w-5 place-items-center rounded-md bg-teal text-[10px] text-white">S</span>
              SHIFO <span className="text-teal">CRM</span>
            </div>
            <div className="text-[11px] font-semibold text-ink">Bemorlar</div>
            <div className="flex items-center gap-1.5 text-[10px] text-mute">
              <span className="rounded-md border border-line px-1.5 py-0.5">Filtrlash</span>
              <span className="rounded-md bg-teal px-1.5 py-0.5 font-semibold text-white">+ Yangi bemor</span>
              <span className="font-semibold text-ink">Akmal K.</span>
            </div>
          </div>
          <div className="grid grid-cols-[46px_1fr_168px] text-[10px]">
            <aside className="space-y-2 border-r border-[#e7ebe8] px-2 py-3 text-teal">
              {["Bemorlar", "Implantlar", "Navbat", "To'lovlar", "Klinika", "Hisobotlar"].map((item, index) => (
                <div key={item} className={`rounded-lg px-1 py-1 ${index === 0 ? "bg-teal-soft font-semibold" : ""}`}>
                  {item}
                </div>
              ))}
            </aside>
            <div className="px-2 py-2">
              <div className="mb-2 rounded-lg border border-line bg-white px-2 py-1 text-mute">Qidirish...</div>
              <div className="grid grid-cols-[1.2fr_.9fr_.7fr_.6fr] px-1 pb-1 text-[9px] uppercase tracking-wide text-mute">
                <span>Ism familiya</span><span>Telefon</span><span>Oxirgi tashrif</span><span>Holati</span>
              </div>
              {patients.map((row) => (
                <div key={row[0]} className="grid grid-cols-[1.2fr_.9fr_.7fr_.6fr] items-center border-t border-[#eef1ef] px-1 py-1.5 text-ink">
                  <span className="truncate font-semibold">{row[0]}</span>
                  <span className="truncate text-mute">{row[1]}</span>
                  <span>{row[2]}</span>
                  <span className={`w-fit rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${row[4]}`}>{row[3]}</span>
                </div>
              ))}
              <p className="mt-2 text-[9px] text-mute">Smile Dental Clinic · Dr. Akmal Karimov</p>
            </div>
            <aside className="border-l border-[#e7ebe8] bg-white p-2">
              <p className="text-[10px] font-bold text-ink">Implant rejalash (Yangi)</p>
              <p className="text-right text-[9px] text-mute">1/4</p>
              <svg viewBox="0 0 120 90" className="mx-auto my-1 h-16 w-full" aria-hidden="true">
                <path d="M60 8c-14 8-22 22-18 40 3 14 10 24 18 28 8-4 15-14 18-28 4-18-4-32-18-40z" fill="#d9f4f0" stroke="#0d9488" />
                <path d="M60 28v42M52 48h16" stroke="#0f766e" strokeWidth="3" />
                <rect x="54" y="46" width="12" height="22" rx="2" fill="#0d9488" />
              </svg>
              <p className="mb-1 text-[10px] font-semibold">Implant tanlash</p>
              {[
                ["Straumann BLT", "4.1mm · L 10mm", true],
                ["Nobel Biocare", "4.3mm · L 10mm", false],
                ["BioHorizons", "4.0mm · L 11.5mm", false],
              ].map((item) => (
                <div key={item[0] as string} className="mb-1 flex items-start gap-1 rounded-md border border-line px-1.5 py-1">
                  <span className={`mt-0.5 h-2.5 w-2.5 rounded-full border ${item[2] ? "border-teal bg-teal" : "border-mute"}`} />
                  <span>
                    <span className="block font-semibold text-ink">{item[0]}</span>
                    <span className="text-mute">{item[1]}</span>
                  </span>
                </div>
              ))}
              <div className="mt-1 rounded-lg bg-teal py-1 text-center text-[10px] font-semibold text-white">Keyingi qadam</div>
            </aside>
          </div>
        </div>
      </div>
      <div className="mx-auto h-3 w-[92%] rounded-b-xl bg-gradient-to-b from-[#c5c8c6] to-[#9aa09c]" />
      <div className="mx-auto h-1.5 w-[46%] rounded-b-md bg-[#8d938f]" />
    </div>
  );
}

const teeth = ["18", "17", "16", "15", "14", "13", "12", "11", "21", "22", "23", "24", "25", "26", "27", "28"];
const tone = ["bg-teal text-white", "bg-[#b7e4df]", "bg-teal-deep text-white", "bg-[#e7c98a]", "bg-white text-mute"];

export function SolutionBoards() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <article className="rise rounded-3xl border border-line bg-white p-4 shadow-card">
        <p className="font-display text-xl"><span className="mr-2 text-teal">1</span>Odontogramma</p>
        <p className="mb-3 text-sm text-mute">Bemor holatini bir qarashda ko'ring</p>
        <div className="rounded-2xl border border-line bg-paper p-3">
          <div className="grid grid-cols-8 gap-1">
            {teeth.map((tooth, index) => (
              <span key={tooth} className={`grid h-7 place-items-center rounded-md text-[10px] font-bold ${tone[index % tone.length]}`}>{tooth.slice(1)}</span>
            ))}
          </div>
          <ul className="mt-3 flex flex-wrap gap-2 text-[10px] text-mute">
            <li className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-teal" />Karies</li>
            <li className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-[#b7e4df]" />Plomba</li>
            <li className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-teal-deep" />Implant</li>
            <li className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-[#e7c98a]" />Krona</li>
          </ul>
        </div>
      </article>
      <article className="rise rounded-3xl border border-line bg-white p-4 shadow-card">
        <p className="font-display text-xl"><span className="mr-2 text-teal">2</span>Implant hisoboti wizardi</p>
        <p className="mb-3 text-sm text-mute">Bosqichma-bosqich hisob va nazorat</p>
        <div className="mb-3 flex flex-wrap items-center gap-1 text-[10px] font-semibold text-teal-ink">
          {["Implant tanlash", "Miqdor va joy", "Yetkazib berish", "Hisobot"].map((step, index) => (
            <span key={step} className="flex items-center gap-1">
              <span className={`rounded-full px-2 py-1 ${index === 0 ? "bg-teal text-white" : "bg-paper"}`}>{step}</span>
              {index < 3 ? <span aria-hidden>→</span> : null}
            </span>
          ))}
        </div>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-paper px-3 py-2"><dt className="text-mute">Implant turi</dt><dd className="font-semibold">Straumann BLT</dd></div>
          <div className="rounded-xl bg-paper px-3 py-2"><dt className="text-mute">Soni</dt><dd className="font-semibold">4 dona</dd></div>
          <div className="rounded-xl bg-paper px-3 py-2"><dt className="text-mute">Joylashuvi</dt><dd className="font-semibold">1.1, 2.2, 3.6, 4.6</dd></div>
          <div className="rounded-xl bg-teal px-3 py-2 text-white"><dt>Holati</dt><dd className="font-semibold">Jarayonda</dd></div>
        </dl>
      </article>
      <article className="rise rounded-3xl border border-line bg-white p-4 shadow-card">
        <p className="font-display text-xl"><span className="mr-2 text-teal">3</span>To'lovlar</p>
        <p className="mb-3 text-sm text-mute">Endi hammasi CRMda, Excel kerak emas</p>
        <div className="overflow-hidden rounded-2xl border border-line text-xs">
          <div className="grid grid-cols-4 bg-paper px-2 py-1.5 font-semibold text-mute"><span>Sana</span><span>Bemor</span><span>Summa</span><span>Status</span></div>
          {[
            ["12.05", "A. Karimova", "4 500 000", "To'langan"],
            ["11.05", "B. Tursunov", "2 300 000", "Qisman"],
            ["10.05", "S. Abdullaeva", "1 200 000", "Kutilmoqda"],
          ].map((row) => (
            <div key={row[1]} className="grid grid-cols-4 border-t border-line px-2 py-1.5">
              <span>{row[0]}</span><span>{row[1]}</span><span>{row[2]}</span>
              <span className={row[3] === "To'langan" ? "text-emerald-700" : row[3] === "Qisman" ? "text-amber-700" : "text-mute"}>{row[3]}</span>
            </div>
          ))}
        </div>
      </article>
      <article className="rise rounded-3xl border border-line bg-white p-4 shadow-card">
        <p className="font-display text-xl"><span className="mr-2 text-teal">4</span>Hisobotlar</p>
        <p className="mb-3 text-sm text-mute">Daromad, yuklama, navbat — aniq va tezkor</p>
        <div className="grid grid-cols-[1.3fr_.7fr] gap-3">
          <div className="rounded-2xl bg-paper p-3">
            <p className="text-[11px] text-mute">Daromad (so'nggi 30 kun)</p>
            <p className="font-display text-2xl text-teal-ink">25 600 000 so'm</p>
            <svg viewBox="0 0 160 48" className="mt-2 h-12 w-full" aria-hidden="true">
              <polyline fill="none" stroke="#0d9488" strokeWidth="3" points="0,36 20,30 40,34 60,18 80,26 100,14 120,22 140,10 160,16" />
            </svg>
          </div>
          <div className="grid place-items-center rounded-2xl bg-paper">
            <svg viewBox="0 0 42 42" className="h-16 w-16" aria-hidden="true">
              <circle cx="21" cy="21" r="14" fill="none" stroke="#d9efe9" strokeWidth="6" />
              <circle cx="21" cy="21" r="14" fill="none" stroke="#0d9488" strokeWidth="6" strokeDasharray="66 88" strokeLinecap="round" transform="rotate(-90 21 21)" />
              <text x="21" y="24" textAnchor="middle" fontSize="8" fontWeight="700" fill="#142421">76%</text>
            </svg>
            <p className="text-[11px] text-mute">Navbat bandligi</p>
          </div>
        </div>
      </article>
    </div>
  );
}
