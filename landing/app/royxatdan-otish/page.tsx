import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth-forms";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

export const metadata: Metadata = {
  title: "Ro'yxatdan o'tish — 14 kunlik bepul sinov",
  description: "SHIFO CRM uchun 14 kunlik bepul sinov. Ism, parol va klinika yoki shifokor nomi.",
  alternates: { canonical: "/royxatdan-otish" },
};

export default function RegisterPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-lg px-4 py-16">
        <div className="rounded-3xl border border-line bg-surface p-6">
          <AuthPanel mode="register" />
        </div>
      </main>
      <Footer />
    </>
  );
}
