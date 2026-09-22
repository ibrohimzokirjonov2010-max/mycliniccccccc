import { NextResponse } from "next/server";
import { getLicense, getOrder } from "@/lib/billing";
import { signLicense } from "@/lib/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const order = await getOrder(id);
  if (!order) return NextResponse.json({ error: "Buyurtma topilmadi." }, { status: 404 });
  const license = order.licenseId ? await getLicense(order.licenseId) : null;
  const token =
    license && license.status === "active"
      ? signLicense({
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
          provider: license.provider,
        })
      : null;
  return NextResponse.json({
    id: order.id,
    status: order.status,
    planId: order.planId,
    planName: order.planName,
    amountUzs: order.amountUzs,
    name: order.name,
    email: order.email,
    provider: order.provider,
    license: license
      ? { key: license.key, status: license.status, expiresAt: license.expiresAt, activatedAt: license.activatedAt }
      : null,
    token,
  });
}
