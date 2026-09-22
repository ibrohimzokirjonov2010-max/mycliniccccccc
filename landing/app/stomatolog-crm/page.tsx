import type { Metadata } from "next";
import { LandingPage } from "@/components/landing-page";

export const metadata: Metadata = {
  title: "Stomatolog CRM — bemor, implant, navbat va to'lov",
  description: "SHIFO stomatolog CRM: klinika egasi uchun bemor kartochkasi, implant hisobi, navbat va to'lovlar bir tizimda.",
  alternates: { canonical: "/stomatolog-crm" },
};

export default function KeywordLandingPage() {
  return <LandingPage />;
}
