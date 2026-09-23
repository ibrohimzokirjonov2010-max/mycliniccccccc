import { randomBytes } from "crypto";
import { crmPlanForTariff, LICENSE_DAYS, TRIAL_DAYS } from "../config/tariffs";
import { clinicNameFor } from "./billing";
import {
  readStore,
  updateStore,
  type DemoLead,
  type LedgerEntry,
  type License,
  type Order,
  type Subscription,
  type SubscriptionStatus,
} from "./store";
const CRM_FALLBACK_URL = "https://zvyggjldzkxwufpnaatr.supabase.co";
const CRM_FALLBACK_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2eWdnamxkemt4d3VmcG5hYXRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTg3NTAsImV4cCI6MjEwMjk5NDc1MH0.v4IyrtyJR8a9bQ7tAapDQxe2VHZHiH_IVuHfeC6MeN4";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type CrmConfig = { url: string; key: string };

export function crmConfig(): CrmConfig | null {
  if (process.env.CRM_SUPABASE_DISABLED === "1") return null;
  const url = (process.env.CRM_SUPABASE_URL || CRM_FALLBACK_URL).trim().replace(/\/$/, "");
  const key = (process.env.CRM_SUPABASE_KEY || CRM_FALLBACK_KEY).trim();
  if (!url || !key) return null;
  return { url, key };
}

export function crmPlanColumn(planId: string): "basic" | "pro" {
  return crmPlanForTariff(planId);
}

export function subscriptionStatusFor(kind: "trial" | "paid", expired: boolean): SubscriptionStatus {
  if (expired) return "expired";
  return kind === "trial" ? "trialing" : "active";
}

export function clinicIdForOrder(orderId: string) {
  return `c${orderId.slice(0, 10)}`;
}

export function clinicIdForLead(leadId: string) {
  return `t${leadId.slice(0, 10)}`;
}

function makePassword() {
  return `Shifo${randomBytes(3).toString("hex")}`;
}

function usernameFor(sub: Pick<Subscription, "email" | "phone" | "id" | "username">) {
  if (sub.username) return sub.username.toLowerCase();
  const local = sub.email.split("@")[0]?.replace(/[^a-z0-9._-]/gi, "").slice(0, 24) ?? "";
  if (local.length >= 2) return local.toLowerCase();
  const digits = sub.phone.replace(/\D/g, "").slice(-6);
  return `dr${digits || sub.id.slice(-4)}`;
}

export function encodeClinicLogo(extra: Record<string, unknown>) {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(extra)) {
    if (value === undefined || value === null || value === "") continue;
    clean[key] = value;
  }
  if (!Object.keys(clean).length) return "";
  return `[EXT]${JSON.stringify(clean)}[/EXT]`;
}

export function buildCrmRows(sub: Subscription) {
  const clinic: Record<string, unknown> = {
    id: sub.id,
    name: sub.clinicName,
    password: sub.temporaryPassword,
    logo: encodeClinicLogo({
      phone: sub.phone,
      email: sub.email,
      doctor_name: sub.doctorName,
      payment_method: sub.paymentMethod,
      tariff: sub.planId,
      billing_status: sub.status,
      subscription_status: sub.subscriptionStatus,
      trial_ends_at: sub.planId === "trial" ? sub.expiresAt.slice(0, 10) : "",
      period_ends_at: sub.expiresAt.slice(0, 10),
      access_unlocked: sub.accessUnlocked,
      license_key: sub.licenseKey,
      payment_ledger: sub.paymentLedger ?? [],
    }),
    expires_at: sub.expiresAt.slice(0, 10),
    status: sub.accessUnlocked ? "Active" : "Expired",
    monthly_fee: Math.round(sub.amountUzs),
    plan: crmPlanColumn(sub.planId),
  };
  if (sub.paidAt) clinic.last_payment_date = sub.paidAt.slice(0, 10);
  const user: Record<string, unknown> = {
    id: `user-${sub.id}`,
    clinic_id: sub.id,
    username: usernameFor(sub),
    password: sub.temporaryPassword,
    name: sub.ownerName || sub.doctorName,
    full_name: sub.ownerName || sub.doctorName,
    phone: sub.phone,
    role: "admin",
    commission_rate: 0,
  };
  if (sub.email) user.notes = sub.email;
  return { clinic, user };
}

function paidSubscription(order: Order, license: License, expired: boolean): Subscription {
  return {
    id: clinicIdForOrder(order.id),
    doctorName: order.name,
    clinicName: order.clinic?.trim() || clinicNameFor(order.name),
    phone: order.phone,
    email: order.email,
    planId: order.planId,
    planName: order.planName,
    status: expired ? "expired" : "paid",
    subscriptionStatus: subscriptionStatusFor("paid", expired),
    amountUzs: license.amountUzs,
    paymentMethod: license.provider,
    accessUnlocked: !expired && license.status === "active",
    startedAt: license.activatedAt,
    expiresAt: license.expiresAt,
    paidAt: license.activatedAt,
    licenseKey: license.key,
    orderId: order.id,
    leadId: null,
    paymentLedger: [],
    username: "",
    temporaryPassword: "",
    updatedAt: new Date().toISOString(),
  };
}

function trialSubscription(lead: DemoLead): Subscription {
  const started = new Date(lead.createdAt);
  const expires = new Date(started.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  const expired = expires.getTime() <= Date.now();
  return {
    id: clinicIdForLead(lead.id),
    doctorName: lead.name,
    clinicName: lead.clinic,
    phone: lead.phone,
    email: lead.email || "",
    planId: "trial",
    planName: "Sinov",
    status: expired ? "expired" : "trial",
    subscriptionStatus: subscriptionStatusFor("trial", expired),
    amountUzs: 0,
    paymentMethod: "trial",
    accessUnlocked: !expired,
    startedAt: started.toISOString(),
    expiresAt: expires.toISOString(),
    paidAt: null,
    licenseKey: "",
    orderId: null,
    leadId: lead.id,
    paymentLedger: [],
    username: "",
    temporaryPassword: "",
    updatedAt: new Date().toISOString(),
  };
}

function ledgerId(sub: Subscription) {
  if (sub.orderId) return `pay-${sub.orderId}`;
  if (sub.leadId) return `trial-${sub.leadId}`;
  return `sub-${sub.id}`;
}

export function mergeLedger(previous: LedgerEntry[] | undefined, sub: Subscription): LedgerEntry[] {
  const prior = previous ?? [];
  const id = ledgerId(sub);
  if (prior.some((entry) => entry.id === id)) return prior;
  if (sub.subscriptionStatus === "expired") return prior;
  const note = sub.subscriptionStatus === "trialing" ? "Bepul sinov" : `${sub.planName} to'lovi`;
  return [
    ...prior,
    {
      id,
      amountUzs: sub.amountUzs,
      method: sub.paymentMethod,
      paidAt: (sub.paidAt || sub.startedAt).slice(0, 10),
      subscriptionStatus: sub.subscriptionStatus,
      orderId: sub.orderId,
      note,
    },
  ];
}

async function remember(sub: Subscription, password?: string) {
  return updateStore((db) => {
    const previous = db.subscriptions[sub.id];
    const next: Subscription = {
      ...sub,
      username: previous?.username || sub.username || usernameFor(sub),
      paymentLedger: mergeLedger(previous?.paymentLedger, sub),
      temporaryPassword: previous?.temporaryPassword || password || makePassword(),
      updatedAt: new Date().toISOString(),
    };
    db.subscriptions[sub.id] = next;
    return next;
  });
}

export function stageTrial(
  db: { demoLeads: DemoLead[]; subscriptions: Record<string, Subscription> },
  lead: DemoLead,
  options: { passwordHash: string; username: string; ownerName?: string },
) {
  db.demoLeads.push(lead);
  const sub = trialSubscription(lead);
  sub.username = options.username;
  sub.ownerName = options.ownerName || lead.name;
  sub.temporaryPassword = options.passwordHash;
  sub.paymentLedger = mergeLedger(undefined, sub);
  sub.updatedAt = new Date().toISOString();
  db.subscriptions[sub.id] = sub;
  return sub;
}

function columnFromPostgrest(body: string) {
  let text = body;
  try {
    const parsed = JSON.parse(body) as { message?: string };
    if (parsed.message) text = `${body}\n${parsed.message}`;
  } catch {
    text = body.replace(/\\"/g, '"');
  }
  return (
    text.match(/column "(\w+)"/)?.[1] ||
    text.match(/column [a-z0-9_]+\.(\w+)/i)?.[1] ||
    text.match(/the '(\w+)' column/)?.[1] ||
    null
  );
}

export async function upsertRow(table: "clinics" | "users", row: Record<string, unknown>, fetchImpl: FetchLike = fetch) {
  const config = crmConfig();
  if (!config) return { skipped: true as const };
  const payload = { ...row };
  let lastDetail = "";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const response = await fetchImpl(`${config.url}/rest/v1/${table}?on_conflict=id`, {
      method: "POST",
      headers: {
        apikey: config.key,
        Authorization: `Bearer ${config.key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(payload),
    });
    if (response.ok) return { skipped: false as const, ok: true as const };
    lastDetail = await response.text();
    if ((lastDetail.includes("23514") || lastDetail.includes("check constraint")) && payload.plan && payload.plan !== "pro") {
      payload.plan = "pro";
      continue;
    }
    const unknown = lastDetail.includes("42703") || lastDetail.includes("PGRST204");
    const column = columnFromPostgrest(lastDetail);
    if (unknown && column && column !== "id" && column in payload) {
      delete payload[column];
      continue;
    }
    if ((response.status === 409 || lastDetail.includes("23505")) && table === "users" && typeof payload.username === "string") {
      payload.username = `${String(payload.username).slice(0, 16)}${String(payload.id ?? "").slice(-4)}`;
      continue;
    }
    break;
  }
  throw new Error(`CRM ${table} upsert failed. ${lastDetail.slice(0, 280)}`);
}

export async function writeCrm(sub: Subscription, fetchImpl: FetchLike = fetch) {
  if (!crmConfig()) return { skipped: true as const };
  const { clinic, user } = buildCrmRows(sub);
  await upsertRow("clinics", clinic, fetchImpl);
  await upsertRow("users", user, fetchImpl);
  return { skipped: false as const };
}

export async function syncOrderToAdmin(orderId: string, fetchImpl: FetchLike = fetch) {
  const db = await readStore();
  const order = db.orders[orderId];
  if (!order?.licenseId) return null;
  const license = db.licenses[order.licenseId];
  if (!license) return null;
  const past = Date.parse(license.expiresAt) <= Date.now();
  const expired = license.status === "cancelled" || order.status === "cancelled" || past;
  const saved = await remember(paidSubscription(order, license, expired));
  await writeCrm(saved, fetchImpl);
  return saved;
}

export async function publishTrial(lead: DemoLead, fetchImpl: FetchLike = fetch) {
  const saved = await remember(trialSubscription(lead));
  await writeCrm(saved, fetchImpl);
  return saved;
}

export async function publishStagedTrial(sub: Subscription, fetchImpl: FetchLike = fetch) {
  await writeCrm(sub, fetchImpl);
  return sub;
}

export async function listSubscriptions() {
  const db = await readStore();
  return Object.values(db.subscriptions).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function ingestPayme(body: unknown, fetchImpl?: FetchLike) {
  if (!body || typeof body !== "object") return;
  const method = (body as { method?: string }).method;
  if (method !== "PerformTransaction" && method !== "CancelTransaction") return;
  const paymeId = String((body as { params?: { id?: unknown } }).params?.id ?? "");
  if (!paymeId) return;
  const db = await readStore();
  const orderId = db.payme[paymeId]?.orderId;
  if (!orderId) return;
  await syncOrderToAdmin(orderId, fetchImpl);
}

export async function ingestClick(params: Record<string, string>, fetchImpl?: FetchLike) {
  if (params.action !== "1") return;
  const orderId = params.merchant_trans_id?.trim();
  if (!orderId) return;
  await syncOrderToAdmin(orderId, fetchImpl);
}

export async function ingestSafely(task: () => Promise<unknown>, timeoutMs = 8000) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      task(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("CRM ingest timed out")), timeoutMs);
      }),
    ]);
  } catch (error) {
    console.error("CRM ingest failed", error);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export const TRIAL_LENGTH_DAYS = TRIAL_DAYS;
export const PAID_LENGTH_DAYS = LICENSE_DAYS;
