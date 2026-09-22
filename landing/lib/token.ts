import { createHmac, timingSafeEqual } from "crypto";
import { demoPayments } from "./payments/config";

export type LicenseToken = {
  orderId: string;
  licenseId: string;
  key: string;
  planId: string;
  planName: string;
  name: string;
  email: string;
  amountUzs: number;
  expiresAt: string;
  activatedAt: string;
  provider: "payme" | "click" | "mock";
};

function secret() {
  const configured = process.env.LICENSE_SIGNING_SECRET?.trim();
  if (configured) return configured;
  if (demoPayments()) return "shifo-demo-signing-secret";
  const fallback = process.env.PAYME_SECRET_KEY?.trim() || process.env.CLICK_SECRET_KEY?.trim();
  if (fallback) return fallback;
  throw new Error("LICENSE_SIGNING_SECRET is required when merchant keys are set.");
}

function sign(body: string) {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function signLicense(payload: LicenseToken) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyLicense(token: string): LicenseToken | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as LicenseToken;
    if (!parsed.orderId || !parsed.key || !parsed.planId) return null;
    return parsed;
  } catch {
    return null;
  }
}
