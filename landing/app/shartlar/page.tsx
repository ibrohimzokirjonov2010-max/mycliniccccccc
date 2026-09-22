import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { formatUzs, TARIFFS } from "@/config/tariffs";

export const metadata: Metadata = { title: "Ommaviy oferta", alternates: { canonical: "/shartlar" } };

export default function TermsPage() {
  return (
    <>
      <Header />
      <main className="bg-paper px-4 py-16">
        <article className="mx-auto max-w-2xl space-y-4 text-base leading-relaxed">
          <h1 className="font-display text-5xl">Ommaviy oferta</h1>
          <p>SHIFO CRM oylik litsenziyasi stomatologiya klinikasi uchun dasturiy ta&apos;minotdir. Narxlar so&apos;mda, oyiga:</p>
          <ul className="list-disc pl-5">
            {TARIFFS.map((plan) => (
              <li key={plan.id}>{plan.name} — {formatUzs(plan.priceUzs)} so&apos;m</li>
            ))}
          </ul>
          <p>Litsenziya Payme yoki Click to&apos;lovi tasdiqlangandan keyin 30 kunga ochiladi. Merchant kalitlari ulanmagan demo to&apos;lov haqiqiy pul yechmaydi.</p>
          <p>To&apos;lov tizimi tranzaksiyani bekor qilsa, ochilgan litsenziya yopiladi. Aloqa: hello@shifo.uz.</p>
        </article>
      </main>
      <Footer />
    </>
  );
}
