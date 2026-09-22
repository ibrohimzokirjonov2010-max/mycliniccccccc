import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "SHIFO CRM — stomatolog klinikasi uchun bemor, implant va to'lov tizimi",
    template: "%s · SHIFO CRM",
  },
  description:
    "Stomatologiya klinikasi egalari uchun CRM: bemor kartochkasi, implant moduli, navbat va to'lov bir joyda. Payme va Click orqali oylik tarif.",
  keywords: [
    "stomatolog CRM",
    "klinika CRM",
    "implant moduli",
    "bemor navbat",
    "stomatologiya dasturi",
    "Payme",
    "Click",
    "SHIFO CRM",
  ],
  openGraph: {
    title: "SHIFO CRM — klinika chalkashligi tugadi",
    description: "Bemor, implant, to'lov va navbat bitta stomatolog CRM da.",
    locale: "uz_UZ",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uz">
      <body className="antialiased">{children}</body>
    </html>
  );
}
