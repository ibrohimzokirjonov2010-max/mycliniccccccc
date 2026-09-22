import { NextResponse } from "next/server";
import { clickConfigured, paymeConfigured } from "@/lib/payments/config";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    paymeLive: paymeConfigured(),
    clickLive: clickConfigured(),
  });
}
