import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { formatUzs } from "@/config/tariffs";
import { getLicense, getOrder } from "@/lib/billing";
import { verifyLicense, type LicenseToken } from "@/lib/token";
import { appUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tarif ochildi",
  robots: { index: false, follow: false },
};

function readToken(token: string): LicenseToken | null {
  if (!token) return null;
  try {
    return verifyLicense(token);
  } catch {
    return null;
  }
}

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; token?: string }>;
}) {
  const { order: orderId = "", token = "" } = await searchParams;
  const order = orderId ? await getOrder(orderId) : null;
  const stored = order?.licenseId ? await getLicense(order.licenseId) : null;
  const signed = readToken(token);
  const active = stored?.status === "active" ? stored : signed;
  const cancelled = stored?.status === "cancelled" || order?.status === "cancelled";

  return (
    <>
      <Header />
      <main className="bg-paper px-4 py-16">
        <div className="mx-auto max-w-lg rounded-3xl border border-line bg-surface p-8 shadow-card">
          {active && !cancelled ? (
            <>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-teal">Tarif ochildi</p>
              <h1 className="mt-2 font-display text-5xl">{active.planName}</h1>
              <p className="mt-3 text-lg text-mute">{active.name}, 30 kunlik litsenziya faol.</p>
              <p className="mt-6 rounded-2xl bg-paper px-4 py-3 font-semibold tracking-wide">{active.key}</p>
              <p className="mt-3 text-sm text-mute">Amal qiladi: {new Date(active.expiresAt).toLocaleDateString("uz-UZ")}</p>
              {"amountUzs" in active ? <p className="text-sm text-mute">{formatUzs(active.amountUzs)} so&apos;m</p> : null}
              <Button asChild size="lg" className="mt-8">
                <a href={appUrl()}>Tizimga kirish →</a>
              </Button>
            </>
          ) : cancelled ? (
            <>
              <h1 className="font-display text-4xl">To&apos;lov bekor qilindi</h1>
              <p className="mt-3 text-mute">Tarif ochilmadi. Qayta xarid qilishingiz mumkin.</p>
              <Button asChild className="mt-6" variant="outline"><a href="/tariflar">Tariflarga qaytish</a></Button>
            </>
          ) : (
            <>
              <h1 className="font-display text-4xl">To&apos;lov topilmadi</h1>
              <p className="mt-3 text-mute">Agar hozirgina to&apos;lagan bo&apos;lsangiz, tasdiq sahifasini oching.</p>
              {orderId ? <Button asChild className="mt-6"><a href={`/tolov/kutilmoqda?order=${orderId}`}>Tasdiqni kutish</a></Button> : null}
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
