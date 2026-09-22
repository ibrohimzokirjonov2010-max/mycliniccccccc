import { LandingPage } from "@/components/landing-page";
import { TARIFFS } from "@/config/tariffs";

export default function HomePage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "SHIFO CRM",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    inLanguage: "uz",
    description: "Stomatologiya klinikasi uchun bemor, implant, navbat va to'lov tizimi.",
    offers: TARIFFS.map((plan) => ({
      "@type": "Offer",
      name: plan.name,
      price: plan.priceUzs,
      priceCurrency: "UZS",
    })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <LandingPage />
    </>
  );
}
