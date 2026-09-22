import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Pricing } from "@/components/pricing";

export const metadata: Metadata = {
  title: "Tariflar — stomatolog klinikasi uchun SHIFO CRM",
  description: "Start 990 000, Pro 1 990 000, Klinika 3 490 000 so'm. Payme yoki Click orqali oylik obuna.",
  alternates: { canonical: "/tariflar" },
};

export default function PricingPage() {
  return (
    <>
      <Header />
      <main>
        <Pricing standalone />
      </main>
      <Footer />
    </>
  );
}
