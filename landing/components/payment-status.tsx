"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function PaymentWait({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("To'lov tekshirilmoqda. Tarif webhook tasdiqlagach ochiladi.");

  useEffect(() => {
    let attempts = 0;
    let timer = 0;
    const tick = async () => {
      attempts += 1;
      const response = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
      if (response.status === 404) {
        setNote("Buyurtma topilmadi. Yangi to'lovdan boshlang.");
        return;
      }
      if (!response.ok) return;
      const data = (await response.json()) as { status?: string; token?: string };
      if (data.status === "active") {
        const token = data.token ? `&token=${encodeURIComponent(data.token)}` : "";
        router.replace(`/tolov/muvaffaqiyat?order=${orderId}${token}`);
        return;
      }
      if (data.status === "cancelled") {
        setNote("To'lov bekor qilindi. Tarif ochilmadi.");
        return;
      }
      if (attempts >= 30) setNote("Tasdiq kechikmoqda. Agar pul yechilgan bo'lsa, hello@shifo.uz ga yozing.");
      else timer = window.setTimeout(tick, 2000);
    };
    void tick();
    return () => window.clearTimeout(timer);
  }, [orderId, router]);

  return <p className="text-lg text-mute">{note}</p>;
}
