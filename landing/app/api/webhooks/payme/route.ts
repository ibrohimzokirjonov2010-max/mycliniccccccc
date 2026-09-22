import { NextResponse } from "next/server";
import { handlePaymeRpc } from "@/lib/payments/payme";
import { ingestPayme, ingestSafely } from "@/lib/tenants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const result = await handlePaymeRpc(body, request.headers.get("authorization"));
  await ingestSafely(() => ingestPayme(body));
  return NextResponse.json(result);
}
