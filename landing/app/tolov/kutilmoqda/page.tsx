import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { PaymentWait } from "@/components/payment-status";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "To'lov tekshirilmoqda",
  robots: { index: false, follow: false },
};

export default async function WaitingPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order = "" } = await searchParams;
  return (
    <>
      <Header />
      <main className="bg-paper px-4 py-20">
        <div className="mx-auto max-w-lg rounded-3xl border border-line bg-surface p-8 shadow-card">
          <h1 className="font-display text-4xl">To&apos;lov tekshirilmoqda</h1>
          {order ? <div className="mt-4"><PaymentWait orderId={order} /></div> : <p className="mt-4 text-mute">Buyurtma raqami yo&apos;q.</p>}
        </div>
      </main>
      <Footer />
    </>
  );
}
