import { NextResponse } from "next/server";
import { listSubscriptions } from "@/lib/tenants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = process.env.LANDING_ADMIN_TOKEN?.trim();
  if (!token) {
    return NextResponse.json({ error: "LANDING_ADMIN_TOKEN is not set." }, { status: 503 });
  }
  const header = request.headers.get("authorization") ?? "";
  if (header !== `Bearer ${token}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const subscriptions = await listSubscriptions();
  return NextResponse.json({
    subscriptions,
    contract: {
      crmTables: ["public.clinics", "public.users"],
      statuses: ["trial", "paid", "expired"],
      paymentMethods: ["payme", "click", "mock", "trial"],
    },
  });
}
