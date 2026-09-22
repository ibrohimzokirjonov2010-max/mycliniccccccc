import { NextResponse } from "next/server";
import { activateOrder, BillingError, getOrder } from "@/lib/billing";
import { providerLive } from "@/lib/payments/config";
import { signLicense } from "@/lib/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { orderId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "So'rov noto'g'ri." }, { status: 400 });
  }
  const orderId = body.orderId?.trim() ?? "";
  const order = orderId ? await getOrder(orderId) : null;
  if (!order) return NextResponse.json({ error: "Buyurtma topilmadi." }, { status: 404 });
  if ((order.provider === "payme" || order.provider === "click") && providerLive(order.provider)) {
    return NextResponse.json({ error: "Haqiqiy to'lov yoqilgan. Demo to'lov yopiq." }, { status: 403 });
  }

  try {
    const license = await activateOrder({
      orderId: order.id,
      provider: "mock",
      providerTransactionId: `mock_${order.id}`,
    });
    const token = signLicense({
      orderId: order.id,
      licenseId: license.id,
      key: license.key,
      planId: license.planId,
      planName: license.planName,
      name: license.name,
      email: license.email,
      amountUzs: license.amountUzs,
      expiresAt: license.expiresAt,
      activatedAt: license.activatedAt,
      provider: "mock",
    });
    return NextResponse.json({
      ok: true,
      redirect: `/tolov/muvaffaqiyat?order=${order.id}&token=${encodeURIComponent(token)}`,
    });
  } catch (error) {
    if (error instanceof BillingError) {
      const status = error.code === "already_paid" ? 409 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    console.error(error);
    return NextResponse.json({ error: "Tarif ochilmadi." }, { status: 500 });
  }
}
