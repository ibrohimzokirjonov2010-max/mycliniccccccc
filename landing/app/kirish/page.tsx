import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth-forms";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";

export const metadata: Metadata = {
  title: "Kirish",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-3xl border border-line bg-surface p-6">
          <AuthPanel mode="login" />
        </div>
      </main>
      <Footer />
    </>
  );
}
