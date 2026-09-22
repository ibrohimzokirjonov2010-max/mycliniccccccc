import { Card } from "@/components/ui/card";
import { testimonials } from "@/lib/content";

export function Testimonials() {
  return (
    <section className="bg-paper py-20" aria-labelledby="fikrlar-title">
      <div className="mx-auto max-w-6xl px-4">
        <p className="text-sm font-bold uppercase tracking-[0.16em] text-teal">Klinikalar</p>
        <h2 id="fikrlar-title" className="mt-2 max-w-xl font-display text-4xl leading-tight sm:text-5xl">Stomatologlar tizimni ishlatib ko&apos;rgan</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {testimonials.map((item, index) => (
            <Card key={item.name} className={`rise border-transparent bg-white p-5 ${index < 2 ? "xl:col-span-3" : "xl:col-span-2"}`}>
              <div className="mb-4 flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-teal-deep font-display text-lg text-white ring-4 ring-teal-soft">{item.initials}</span>
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-mute">{item.role}</p>
                </div>
              </div>
              <p className="text-teal" aria-label="5 dan 5">★★★★★</p>
              <blockquote className="mt-3 text-[15px] leading-relaxed text-ink/90">&ldquo;{item.quote}&rdquo;</blockquote>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-mute">{item.city}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
