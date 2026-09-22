import { randomBytes } from "crypto";
import { LICENSE_DAYS, getTariff, type PlanId } from "../config/tariffs";
import { updateStore, readStore, type Database, type License, type Order, type Provider } from "./store";
import { normalizeClinic, normalizeEmail, normalizeName, normalizePhone } from "./validators";

const KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export class BillingError extends Error {
  constructor(
    message: string,
    readonly code: "not_found" | "already_paid" | "cancelled" | "invalid" | "forbidden",
  ) {
    super(message);
  }
}

function chunkKey(planId: string) {
  const bytes = randomBytes(8);
  let raw = "";
  for (const byte of bytes) raw += KEY_ALPHABET[byte % KEY_ALPHABET.length];
  const prefix = planId.slice(0, 3).toUpperCase();
  return `SHIFO-${prefix}-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

export function clinicNameFor(name: string, clinic?: string | null) {
  const provided = (clinic ?? "").trim();
  if (!provided) {
    const fallback = `${name} klinikasi`.slice(0, 80).trim();
    return fallback.length >= 2 ? fallback : name;
  }
  const normalized = normalizeClinic(provided);
  if (!normalized) throw new BillingError("Klinika nomini kiriting.", "invalid");
  return normalized;
}

export async function createOrder(input: {
  planId: string;
  name: string;
  phone: string;
  email: string;
  clinic?: string;
  provider: "payme" | "click";
}) {
  const plan = getTariff(input.planId);
  const name = normalizeName(input.name);
  const phone = normalizePhone(input.phone);
  const email = normalizeEmail(input.email);
  if (!plan) throw new BillingError("Tarif topilmadi.", "invalid");
  if (!name) throw new BillingError("Ismingizni to'liq kiriting.", "invalid");
  if (!phone) throw new BillingError("Telefon raqamini +998 bilan kiriting.", "invalid");
  if (!email) throw new BillingError("Email manzilini to'g'ri kiriting.", "invalid");
  const clinic = clinicNameFor(name, input.clinic);

  const order: Order = {
    id: randomBytes(16).toString("hex"),
    planId: plan.id,
    planName: plan.name,
    amountUzs: plan.priceUzs,
    name,
    phone,
    email,
    clinic,
    provider: input.provider,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  await updateStore((db) => {
    db.orders[order.id] = order;
  });
  return order;
}

export function activateInDb(
  db: Database,
  input: { orderId: string; provider: Provider; providerTransactionId: string },
) {
  const order = db.orders[input.orderId];
  if (!order) throw new BillingError("Buyurtma topilmadi.", "not_found");
  if (order.status === "cancelled") throw new BillingError("Buyurtma bekor qilingan.", "cancelled");

  if (order.status === "active" && order.licenseId) {
    const existing = db.licenses[order.licenseId];
    if (existing && order.providerTransactionId === input.providerTransactionId) return existing;
    throw new BillingError("Bu tarif allaqachon to'langan.", "already_paid");
  }

  const now = new Date();
  const expires = new Date(now.getTime() + LICENSE_DAYS * 24 * 60 * 60 * 1000);
  const license: License = {
    id: randomBytes(12).toString("hex"),
    key: chunkKey(order.planId),
    orderId: order.id,
    planId: order.planId,
    planName: order.planName,
    name: order.name,
    phone: order.phone,
    email: order.email,
    provider: input.provider,
    providerTransactionId: input.providerTransactionId,
    amountUzs: order.amountUzs,
    status: "active",
    activatedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };
  order.status = "active";
  order.licenseId = license.id;
  order.provider = input.provider;
  order.providerTransactionId = input.providerTransactionId;
  db.licenses[license.id] = license;
  return license;
}

export async function activateOrder(input: {
  orderId: string;
  provider: Provider;
  providerTransactionId: string;
}) {
  return updateStore((db) => activateInDb(db, input));
}

export function revokeLicenseInDb(db: Database, orderId: string) {
  const order = db.orders[orderId];
  if (!order?.licenseId) return null;
  const license = db.licenses[order.licenseId];
  if (!license) return null;
  order.status = "cancelled";
  license.status = "cancelled";
  license.cancelledAt = new Date().toISOString();
  return license;
}

export async function getOrder(orderId: string) {
  const db = await readStore();
  return db.orders[orderId] ?? null;
}

export async function getLicense(licenseId: string) {
  const db = await readStore();
  return db.licenses[licenseId] ?? null;
}

export function isPlanId(value: string): value is PlanId {
  return getTariff(value) !== null;
}

export async function saveDemoLead(input: { name: string; phone: string; clinic: string; email?: string }) {
  const name = normalizeName(input.name);
  const phone = normalizePhone(input.phone);
  const clinic = normalizeName(input.clinic);
  const emailRaw = (input.email ?? "").trim();
  const email = emailRaw ? normalizeEmail(emailRaw) : "";
  if (!name) throw new BillingError("Ismingizni to'liq kiriting.", "invalid");
  if (!phone) throw new BillingError("Telefon raqamini +998 bilan kiriting.", "invalid");
  if (!clinic) throw new BillingError("Klinika nomini kiriting.", "invalid");
  if (emailRaw && !email) throw new BillingError("Email manzilini to'g'ri kiriting.", "invalid");
  const lead = { id: randomBytes(8).toString("hex"), name, phone, clinic, email: email || "", createdAt: new Date().toISOString() };
  await updateStore((db) => {
    db.demoLeads.push(lead);
  });
  return lead;
}
