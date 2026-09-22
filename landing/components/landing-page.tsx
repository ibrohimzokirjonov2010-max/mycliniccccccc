import { About } from "@/components/about";
import { Benefits } from "@/components/benefits";
import { Faq } from "@/components/faq";
import { FinalCta } from "@/components/final-cta";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Hero } from "@/components/hero";
import { Pricing } from "@/components/pricing";
import { ProblemSolution } from "@/components/problem-solution";
import { Security } from "@/components/security";
import { Testimonials } from "@/components/testimonials";

/**
 * Aesthetic: editorial clinic paper.
 * Display Fraunces, body Manrope. Teal #0d9488, deep #0c3c38, cream #f3efe6.
 * Asymmetric hero, split problem/solution, serif headlines. Not a centered template.
 */
export function LandingPage({ showPricing = true }: { showPricing?: boolean }) {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <ProblemSolution />
        <Benefits />
        <Testimonials />
        {showPricing ? <Pricing /> : null}
        <Security />
        <About />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
