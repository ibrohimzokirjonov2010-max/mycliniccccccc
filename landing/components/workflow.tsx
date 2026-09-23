const steps = [
  {
    n: "01",
    title: "Qabul",
    text: "Bemor yoziladi, navbat va eslatma avtomatik ochiladi.",
  },
  {
    n: "02",
    title: "Kabinet",
    text: "Tish kartasi, implant va davolash rejasi bitta ekranda yuritiladi.",
  },
  {
    n: "03",
    title: "Kassa",
    text: "To'lov, qarzdorlik va Payme/Click tarixi bog'lanadi.",
  },
  {
    n: "04",
    title: "Rahbar",
    text: "Bandlik, tushum va shifokor kesimi dashboardda ko'rinadi.",
  },
];

export function Workflow() {
  return (
    <section id="imkoniyatlar" className="scroll-mt-24 py-20" aria-labelledby="flow-title">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#1760ff]/40 bg-[#1760ff]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9db7ff]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#1760ff]" />
            Imkoniyatlar
          </p>
          <h2 id="flow-title" className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">Klinika ichidagi oqim uzilmaydi</h2>
          <p className="mt-4 text-lg text-mute">Har bir bo&apos;lim bir xil ma&apos;lumot bilan ishlaydi, rahbar esa holatni real vaqtda ko&apos;radi.</p>
        </div>
        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <li key={step.n} className="rounded-2xl border border-line bg-surface p-5">
              <p className="text-xs font-semibold text-[#1760ff]">{step.n}</p>
              <h3 className="mt-4 text-2xl font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mute">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
