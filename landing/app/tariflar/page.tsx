import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Pricing } from "@/components/pricing";

export const metadata: Metadata = {
  title: "Tariflar — stomatolog klinikasi uchun SHIFO CRM",
  description: "Basic 99 000, Pro 189 000, Premium 349 000 so'm oyiga. 14 kunlik bepul sinov. Yillik to'lovda 2 oy bepul.",
  alternates: { canonical: "/tariflar" },
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#f4f7fb] text-[#102033]">
      <Header tone="light" />
      <main>
        <Pricing standalone />
      </main>
      <Footer />
    </div>
  );
}
