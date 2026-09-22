"use client";

import { FormEvent, useState } from "react";
import { formatUzs, getTariff } from "@/config/tariffs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "form" | "mock" | "live";

export function CheckoutForm({ planId }: { planId: string }) {
  const plan = getTariff(planId);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [clinic, setClinic] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<"payme" | "click" | "mock" | null>(null);
  const [mockOrder, setMockOrder] = useState<{ orderId: string; provider: "payme" | "click" } | null>(null);
  const [mode, setMode] = useState<Mode>("form");

  if (!plan) return <p>Tarif topilmadi.</p>;
  const selected = plan;

  async function start(provider: "payme" | "click") {
    setError("");
    setPending(provider);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selected.id, name, phone, email, clinic, provider }),
      });
      const data = (await response.json()) as { error?: string; mode?: string; paymentUrl?: string; orderId?: string };
      if (!response.ok) {
        setError(data.error || "Buyurtma yaratilmadi.");
        return;
      }
      if (data.mode === "live" && data.paymentUrl) {
        setMode("live");
        window.location.assign(data.paymentUrl);
        return;
      }
      setMockOrder({ orderId: data.orderId || "", provider });
      setMode("mock");
    } catch {
      setError("Tarmoq xatosi. Qayta urinib ko'ring.");
    } finally {
      setPending(null);
    }
  }

  async function confirmMock() {
    if (!mockOrder) return;
    setError("");
    setPending("mock");
    try {
      const response = await fetch("/api/checkout/mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: mockOrder.orderId }),
      });
      const data = (await response.json()) as { error?: string; redirect?: string };
      if (!response.ok || !data.redirect) {
        setError(data.error || "Tarif ochilmadi.");
        return;
      }
      window.location.assign(data.redirect);
    } catch {
      setError("Tarmoq xatosi. Qayta urinib ko'ring.");
    } finally {
      setPending(null);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-2xl bg-white px-4 py-3">
        <p className="text-sm text-mute">{selected.name} tarifi</p>
        <p className="font-display text-3xl text-teal-ink">{formatUzs(selected.priceUzs)} <span className="font-body text-base text-mute">so&apos;m/oy</span></p>
      </div>
      {mode === "mock" && mockOrder ? (
        <div className="space-y-3 rounded-2xl border border-teal/30 bg-teal-soft/60 p-4">
          <p className="font-semibold">Demo to&apos;lov</p>
          <p className="text-sm leading-relaxed text-ink/80">
            {mockOrder.provider === "payme" ? "Payme" : "Click"} merchant kaliti yo&apos;q. Demo to&apos;lov haqiqiy pul yechmaydi va shu tarifni webhookdagi kabi ochadi.
          </p>
          <Button type="button" className="w-full" disabled={pending !== null} onClick={confirmMock}>
            {pending === "mock" ? "Ochilmoqda..." : "Demo to'lovni tasdiqlash"}
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="buyer-name">Ism</Label>
            <Input id="buyer-name" name="name" autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Akmal Karimov" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="buyer-phone">Telefon</Label>
            <Input id="buyer-phone" name="phone" inputMode="tel" autoComplete="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+998 90 123 45 67" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="buyer-clinic">Klinika</Label>
            <Input id="buyer-clinic" name="clinic" autoComplete="organization" value={clinic} onChange={(event) => setClinic(event.target.value)} placeholder="Klinika nomi" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="buyer-email">Email</Label>
            <Input id="buyer-email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="klinika@example.uz" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" disabled={pending !== null} onClick={() => start("payme")}>
              {pending === "payme" ? "Payme..." : "Payme"}
            </Button>
            <Button type="button" variant="dark" disabled={pending !== null} onClick={() => start("click")}>
              {pending === "click" ? "Click..." : "Click"}
            </Button>
          </div>
        </>
      )}
      {error ? <p className="text-sm font-semibold text-red-700" role="alert">{error}</p> : null}
    </form>
  );
}
