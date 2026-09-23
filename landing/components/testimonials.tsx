import { testimonials } from "@/lib/content";

export function Testimonials() {
  const items = testimonials.slice(0, 3);
  return (
    <section className="py-20" aria-labelledby="fikrlar-title">
      <div className="mx-auto max-w-6xl px-4">
        <h2 id="fikrlar-title" className="text-4xl font-semibold tracking-tight sm:text-5xl">Mijozlar fikri</h2>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {items.map((item) => (
            <figure key={item.name} className="rounded-2xl border border-line bg-surface p-5">
              <p className="text-[#f5c451]" aria-label="5 dan 5">★★★★★</p>
              <blockquote className="mt-4 text-[15px] leading-relaxed text-[#e7edf5]">&ldquo;{item.quote}&rdquo;</blockquote>
              <figcaption className="mt-6">
                <p className="font-semibold">{item.name}</p>
                <p className="text-sm text-mute">{item.role}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-mute">{item.city}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
