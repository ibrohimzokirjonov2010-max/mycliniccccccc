import { NextResponse } from "next/server";
import { AuthError, startPayment, startTrial } from "@/lib/accounts";
import { corsHeaders } from "@/lib/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const headers = corsHeaders(request);
  let body: { token?: string; action?: string; provider?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "So'rov noto'g'ri." }, { status: 400, headers });
  }
  try {
    const result = body.action === "pay"
      ? await startPayment(body.token ?? "", request, body.provider)
      : await startTrial(body.token ?? "", request);
    return NextResponse.json(result, { headers });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status, headers });
    console.error(error);
    return NextResponse.json({ error: "Davom etib bo'lmadi." }, { status: 500, headers });
  }
}

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}
