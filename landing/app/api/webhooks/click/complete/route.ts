import { NextResponse } from "next/server";
import { handleClick } from "@/lib/payments/click";
import { ingestClick, ingestSafely } from "@/lib/tenants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readParams(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    const json = (await request.json()) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(json).map(([key, value]) => [key, value == null ? "" : String(value)]));
  }
  const form = await request.formData();
  return Object.fromEntries(Array.from(form.entries()).map(([key, value]) => [key, String(value)]));
}

export async function POST(request: Request) {
  try {
    const params = await readParams(request);
    if (!params.action) params.action = "1";
    const result = await handleClick(params);
    await ingestSafely(() => ingestClick(params));
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: -8, error_note: "Bad request" });
  }
}
