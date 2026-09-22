import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckoutForm } from "@/components/checkout-form";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { getTariff, TARIFFS } from "@/config/tariffs";

export function generateStaticParams() {
  return TARIFFS.map((plan) => ({ plan: plan.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ plan: string }> }): Promise<Metadata> {
  const { plan } = await params;
  const tariff = getTariff(plan);
  if (!tariff) return { title: "Tarif" };
  return { title: `${tariff.name} tarifini sotib olish` };
}

export default async function BuyPage({ params }: { params: Promise<{ plan: string }> }) {
  const { plan } = await params;
  if (!getTariff(plan)) notFound();
  return (
    <>
      <Header />
      <main className="bg-paper px-4 py-16">
        <div className="mx-auto max-w-md rounded-[1.7rem] border border-line bg-white p-6 shadow-card">
          <h1 className="mb-4 font-display text-4xl">Sotib olish</h1>
          <CheckoutForm planId={plan} />
        </div>
      </main>
      <Footer />
    </>
  );
}
