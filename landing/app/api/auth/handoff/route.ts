import { NextResponse } from "next/server";
import { handoffPayload, redeemHandoff } from "@/lib/accounts";
import { corsHeaders } from "@/lib/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const headers = corsHeaders(request);
  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "So'rov noto'g'ri." }, { status: 400, headers });
  }
  const row = await redeemHandoff(body.token ?? "");
  if (!row) return NextResponse.json({ error: "Sessiya yaroqsiz yoki muddati tugagan." }, { status: 401, headers });
  return NextResponse.json(handoffPayload(row), { headers });
}

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) });
}
