import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

export const metadata: Metadata = { title: "Maxfiylik siyosati", alternates: { canonical: "/maxfiylik" } };

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="bg-paper px-4 py-16">
        <article className="prose mx-auto max-w-2xl space-y-4 text-base leading-relaxed">
          <h1 className="font-display text-5xl">Maxfiylik siyosati</h1>
          <p>SHIFO CRM landingi klinika egasidan faqat tarif sotib olish yoki demo so&apos;rash uchun ism, telefon va email oladi.</p>
          <p>Karta raqami bu saytda kiritilmaydi va saqlanmaydi. To&apos;lov Payme yoki Click sahifasida amalga oshadi.</p>
          <p>Buyurtma, litsenziya kaliti va to&apos;lov identifikatori tarifni ochish uchun saqlanadi. Demo so&apos;rovlar aloqa uchun saqlanadi.</p>
          <p>Savol bo&apos;lsa: hello@shifo.uz.</p>
        </article>
      </main>
      <Footer />
    </>
  );
}
