"use client";

import { useState } from "react";
import { formatUzs, TARIFFS, type PlanId } from "@/config/tariffs";
import { CheckoutForm } from "@/components/checkout-form";
import { FeatureIcon, Logo } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function Pricing({ standalone = false }: { standalone?: boolean }) {
  const [plan, setPlan] = useState<PlanId | null>(null);
  return (
    <section id="tariflar" className="scroll-mt-24 py-20">
      <div className="mx-auto max-w-6xl px-4">
        {standalone ? (
          <div className="mb-8 flex items-center justify-between">
            <div>
              <Logo />
              <p className="mt-1 text-sm text-mute">Klinikangiz uchun to&apos;liq boshqaruv tizimi.</p>
            </div>
            <span className="hidden h-8 w-24 rounded-full bg-[radial-gradient(circle,#0d9488_1.2px,transparent_1.4px)] bg-[length:10px_10px] sm:block" aria-hidden />
          </div>
        ) : null}
        <div className="mx-auto max-w-2xl text-center">
          {standalone ? (
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Tariflar — klinikangizga mos</h1>
          ) : (
            <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">Tariflar — klinikangizga mos</h2>
          )}
          <p className="mt-3 text-lg text-mute">14 kunlik sinovdan keyin oylik tarif. Payme yoki Click.</p>
        </div>
        <div className="mt-12 grid items-stretch gap-5 lg:grid-cols-3">
          {TARIFFS.map((item) => (
            <article
              key={item.id}
              className={`relative flex flex-col rounded-2xl border bg-surface p-6 ${item.recommended ? "border-[#1760ff] shadow-lift lg:-translate-y-3" : "border-line"}`}
            >
              {item.recommended ? <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#1760ff]">Tavsiya</Badge> : null}
              <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-teal-soft text-teal">
                <FeatureIcon id={item.id === "start" ? "doctor" : item.id === "pro" ? "payments" : "branches"} />
              </div>
              <h3 className="text-center font-display text-3xl">{item.name}</h3>
              <p className="mt-2 text-center">
                <span className="font-display text-4xl text-teal-ink">{formatUzs(item.priceUzs)}</span>
                <span className="ml-1 text-sm text-mute">so&apos;m/oy</span>
              </p>
              <ul className="mt-6 flex-1 space-y-3">
                {item.features.map((feature) => (
                  <li key={feature.id} className="flex items-center gap-3 text-sm font-medium">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-teal-soft">
                      <FeatureIcon id={feature.id} />
                    </span>
                    {feature.label}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-6 w-full"
                variant={item.recommended ? "default" : "outline"}
                onClick={() => setPlan(item.id)}
              >
                Sotib olish
              </Button>
              <p className="mt-3 text-center text-xs text-mute">Payme / Click orqali</p>
            </article>
          ))}
        </div>
        <p className="mt-8 flex items-center justify-center gap-2 text-sm text-mute">
          <span aria-hidden className="text-teal">▣</span>
          To&apos;lovdan keyin tarif avtomatik ochiladi.
        </p>
      </div>
      <Dialog open={plan !== null} onOpenChange={(open) => { if (!open) setPlan(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sotib olish</DialogTitle>
          </DialogHeader>
          {plan ? <CheckoutForm planId={plan} /> : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
