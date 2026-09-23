"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { faqs } from "@/lib/content";

export function Faq() {
  return (
    <section id="savollar" className="scroll-mt-24 py-20" aria-labelledby="faq-title">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 lg:grid-cols-[0.7fr_1.3fr]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#9db7ff]">Savol-javob</p>
          <h2 id="faq-title" className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Sinov, tarif va to&apos;lov</h2>
        </div>
        <Accordion type="single" collapsible className="rounded-2xl border border-line bg-surface px-5">
          {faqs.map((item, index) => (
            <AccordionItem key={item.q} value={`item-${index}`}>
              <AccordionTrigger>{item.q}</AccordionTrigger>
              <AccordionContent>{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
