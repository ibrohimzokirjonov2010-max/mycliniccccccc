import { NextResponse } from "next/server";
import { BillingError, saveDemoLead } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { name?: string; phone?: string; clinic?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "So'rov noto'g'ri." }, { status: 400 });
  }
  try {
    await saveDemoLead({ name: body.name ?? "", phone: body.phone ?? "", clinic: body.clinic ?? "" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof BillingError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error(error);
    return NextResponse.json({ error: "So'rov saqlanmadi." }, { status: 500 });
  }
}
