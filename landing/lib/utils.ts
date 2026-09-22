import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function appUrl() {
  const value = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return value || "https://app-shahobidin-4.vercel.app";
}

export function appLabel() {
  return process.env.NEXT_PUBLIC_APP_LABEL?.trim() || "app.shifo.uz";
}

export function requestOrigin(request: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "http";
  return `${proto}://${host}`;
}
