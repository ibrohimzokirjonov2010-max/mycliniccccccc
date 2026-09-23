import { Faq } from "@/components/faq";
import { Features } from "@/components/features";
import { FinalCta } from "@/components/final-cta";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { Modules } from "@/components/modules";
import { Pricing } from "@/components/pricing";
import { Proof } from "@/components/proof";
import { Testimonials } from "@/components/testimonials";
import { Workflow } from "@/components/workflow";

export function LandingPage({ showPricing = true }: { showPricing?: boolean }) {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Workflow />
        <Features />
        <Modules />
        <Proof />
        <Testimonials />
        <Faq />
        {showPricing ? <Pricing /> : null}
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
