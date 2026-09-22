import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="bg-paper px-4 py-24 text-center">
        <h1 className="font-display text-5xl">Sahifa topilmadi</h1>
        <Button asChild className="mt-6"><a href="/">Bosh sahifa</a></Button>
      </main>
      <Footer />
    </>
  );
}
