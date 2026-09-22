"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DemoDialog({ label, size = "lg" }: { label: string; size?: "lg" | "xl" }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: String(form.get("name") || ""),
          phone: String(form.get("phone") || ""),
          clinic: String(form.get("clinic") || ""),
          email: String(form.get("email") || ""),
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "So'rov saqlanmadi.");
        return;
      }
      setDone(true);
    } catch {
      setError("Tarmoq xatosi. Qayta urinib ko'ring.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="cream" size={size}>{label} <span aria-hidden>→</span></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bepul demo</DialogTitle>
        </DialogHeader>
        {done ? (
          <p className="text-base leading-relaxed">So&apos;rovingiz qabul qilindi. Tez orada klinikangiz bilan bog&apos;lanamiz.</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="demo-name">Ism</Label>
              <Input id="demo-name" name="name" required placeholder="Ismingiz" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="demo-phone">Telefon</Label>
              <Input id="demo-phone" name="phone" required inputMode="tel" placeholder="+998 90 123 45 67" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="demo-email">Email</Label>
              <Input id="demo-email" name="email" type="email" placeholder="klinika@example.uz" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="demo-clinic">Klinika</Label>
              <Input id="demo-clinic" name="clinic" required placeholder="Klinika nomi" />
            </div>
            {error ? <p className="text-sm font-semibold text-red-700" role="alert">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={pending}>{pending ? "Yuborilmoqda..." : "So'rov yuborish"}</Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
