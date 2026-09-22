"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { faqs } from "@/lib/content";

export function Faq() {
  return (
    <section id="savollar" className="scroll-mt-24 bg-paper py-20" aria-labelledby="faq-title">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 lg:grid-cols-[0.7fr_1.3fr]">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-teal">Savollar</p>
          <h2 id="faq-title" className="mt-2 font-display text-4xl leading-tight sm:text-5xl">Tarif va to&apos;lov haqida</h2>
        </div>
        <Accordion type="single" collapsible className="rounded-3xl border border-line bg-white px-5">
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
