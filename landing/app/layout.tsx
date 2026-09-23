import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "SHIFO CRM — stomatolog klinikasi uchun bemor, implant va to'lov tizimi",
    template: "%s · SHIFO CRM",
  },
  description:
    "Stomatologiya klinikasi uchun operatsion tizim: bemor kartasi, navbat, implant, to'lov va hisobot. 14 kunlik bepul sinov, keyin Payme yoki Click.",
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
    <html lang="uz" className={sans.variable}>
      <body className={`${sans.className} antialiased`}>{children}</body>
    </html>
  );
}
