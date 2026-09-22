import { IconDoc, IconFolder, IconPhone, IconTooth } from "@/components/icons";
import { SolutionBoards } from "@/components/product-views";

const problems = [
  {
    icon: <IconFolder />,
    title: "Bemor kartochkalari chalkash",
    text: "Ma'lumotlar izdan chiqadi, tarix topilmaydi, takroriy so'rovlar ko'payadi.",
  },
  {
    icon: <IconTooth />,
    title: "Implant hisobi yo'qoladi",
    text: "Qaysi implant, qancha, qayerda — aniq hisob yo'q, nazorat qiyin.",
  },
  {
    icon: <IconDoc />,
    title: "To'lovlar Excelda",
    text: "Ma'lumotlar parchalangan, xatolar ko'p, tahlil qilish qiyin.",
  },
  {
    icon: <IconPhone />,
    title: "Navbat telefoncha",
    text: "Qo'ng'iroqlar, eslatmalar, bekor bo'lgan vaqtlar — barchasi qo'lda.",
  },
];

export function ProblemSolution() {
  return (
    <section id="modullar" className="scroll-mt-24 bg-cream">
      <div className="grid lg:grid-cols-[minmax(280px,0.78fr)_1.22fr]">
        <div className="bg-deep px-6 py-14 text-white sm:px-10 lg:px-12">
          <p className="text-sm font-bold tracking-wide text-[#9ee8e0]">SHIFO CRM</p>
          <h2 className="mt-4 max-w-sm font-display text-4xl leading-[1.05] sm:text-5xl">Stomatologlar nima uchun charchaydi</h2>
          <p className="mt-4 max-w-sm text-lg text-[#d5ebe7]">Klinikangizdagi kundalik muammolar vaqt va daromadni yo&apos;qotadi.</p>
          <ul className="mt-10 space-y-6">
            {problems.map((item) => (
              <li key={item.title} className="flex gap-4">
                {item.icon}
                <div>
                  <p className="font-semibold">{item.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-[#c5ddd8]">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-[#f6f1e7] px-4 py-12 sm:px-8 lg:px-10">
          <h2 className="mb-6 text-center font-display text-3xl text-teal-ink sm:text-4xl">SHIFO CRM qanday yechadi</h2>
          <SolutionBoards />
        </div>
      </div>
    </section>
  );
}
