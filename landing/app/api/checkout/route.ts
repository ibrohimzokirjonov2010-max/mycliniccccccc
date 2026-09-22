import { NextResponse } from "next/server";
import { BillingError, createOrder } from "@/lib/billing";
import { clickCheckoutUrl } from "@/lib/payments/click";
import { providerLive } from "@/lib/payments/config";
import { paymeCheckoutUrl } from "@/lib/payments/payme";
import { requestOrigin } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { planId?: string; name?: string; phone?: string; email?: string; provider?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "So'rov noto'g'ri." }, { status: 400 });
  }

  const provider = body.provider === "click" ? "click" : body.provider === "payme" ? "payme" : null;
  if (!provider) return NextResponse.json({ error: "To'lov usulini tanlang." }, { status: 400 });

  try {
    const order = await createOrder({
      planId: body.planId ?? "",
      name: body.name ?? "",
      phone: body.phone ?? "",
      email: body.email ?? "",
      provider,
    });
    const returnUrl = `${requestOrigin(request)}/tolov/kutilmoqda?order=${order.id}`;
    if (!providerLive(provider)) {
      return NextResponse.json({
        orderId: order.id,
        mode: "mock",
        amountUzs: order.amountUzs,
        planName: order.planName,
      });
    }
    const paymentUrl =
      provider === "payme"
        ? paymeCheckoutUrl(order.id, order.amountUzs, returnUrl)
        : clickCheckoutUrl(order.id, order.amountUzs, returnUrl);
    return NextResponse.json({
      orderId: order.id,
      mode: "live",
      paymentUrl,
      amountUzs: order.amountUzs,
      planName: order.planName,
    });
  } catch (error) {
    if (error instanceof BillingError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: "Buyurtma yaratilmadi." }, { status: 500 });
  }
}
