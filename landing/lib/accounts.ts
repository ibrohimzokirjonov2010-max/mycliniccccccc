import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { canonicalPlanId, catalogMonthly, chargeAmount, getTariff, TRIAL_DAYS, type BillingCycle } from "../config/tariffs";
import { clinicNameFor } from "./billing";
import { hashPassword, isPasswordHash, verifyPassword } from "./password";
import { clickConfigured, paymeConfigured, providerLive } from "./payments/config";
import { clickCheckoutUrl } from "./payments/click";
import { paymeCheckoutUrl } from "./payments/payme";
import { readStore, updateStore, type DemoLead, type PendingOrder, type Subscription } from "./store";
import { crmConfig, crmPlanColumn, publishStagedTrial, readCrmClinic, stagePending, SUPPORT_URL, writeClinicAccess, type FetchLike } from "./tenants";
import { appUrl, requestOrigin } from "./utils";
import { normalizeClinic, normalizeEmail, normalizeName, normalizePassword, normalizePhone } from "./validators";

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export type AuthResult = {
  ok: true;
  message: string;
  clinicId: string;
  username: string;
  name: string;
  clinicName: string;
  doctorName: string;
  expiresAt: string;
  trialDays: number;
  handoffUrl: string;
  crmUrl: string;
  step?: "choose" | "payment" | "crm";
  resumeToken?: string;
  plan?: string;
  cycle?: BillingCycle;
  amountUzs?: number;
  paymeLive?: boolean;
  clickLive?: boolean;
  orderId?: string;
  supportUrl?: string;
  paymentUrl?: string;
  pending?: boolean;
};

type Account = {
  clinicId: string;
  userId: string;
  username: string;
  name: string;
  doctorName: string;
  clinicName: string;
  phone: string;
  email: string;
  role: "admin";
  plan: string;
  passwordHash: string;
  open: boolean;
  expiresAt: string;
  lockReason: string;
};

type RegisterInput = {
  name?: string;
  password?: string;
  clinic?: string;
  doctor?: string;
  phone?: string;
  email?: string;
  plan?: string;
  cycle?: string;
};

function loginName(email: string, phone: string, id: string) {
  const local = email.split("@")[0]?.replace(/[^a-z0-9._-]/gi, "").slice(0, 24) ?? "";
  if (local.length >= 2) return local.toLowerCase();
  const digits = phone.replace(/\D/g, "").slice(-6);
  if (digits.length >= 4) return `dr${digits}`;
  return `dr${id.slice(-4)}`;
}

function uniqueUsername(taken: Set<string>, base: string, id: string) {
  if (!taken.has(base)) return base;
  const next = `${base.slice(0, 16)}${id.slice(-4)}`.toLowerCase();
  if (!taken.has(next)) return next;
  return `${next}${id.slice(0, 2)}`;
}

function identityTaken(subscriptions: Subscription[], phone: string, email: string) {
  return subscriptions.some((sub) => {
    if (phone && sub.phone === phone) return true;
    if (email && sub.email.toLowerCase() === email.toLowerCase()) return true;
    return false;
  });
}

function quote(value: string) {
  return `"${value.replace(/["\\]/g, "")}"`;
}

export function parseRegistration(input: RegisterInput) {
  const name = normalizeName(input.name ?? "");
  const password = normalizePassword(input.password ?? "");
  const clinicRaw = (input.clinic ?? "").trim();
  const doctorRaw = (input.doctor ?? "").trim();
  const clinic = clinicRaw ? normalizeClinic(clinicRaw) : "";
  const doctor = doctorRaw ? normalizeName(doctorRaw) : "";
  const phoneRaw = (input.phone ?? "").trim();
  const emailRaw = (input.email ?? "").trim();
  const phone = phoneRaw ? normalizePhone(phoneRaw) : "";
  const email = emailRaw ? normalizeEmail(emailRaw) : "";

  if (!name) throw new AuthError("Ismingizni to'liq kiriting.", 400);
  if (!password) throw new AuthError("Parol kamida 8 ta belgidan iborat bo'lsin.", 400);
  if (!clinicRaw || !clinic) throw new AuthError("Klinika nomini kiriting.", 400);
  if (doctorRaw && !doctor) throw new AuthError("Shifokor ismini to'g'ri kiriting.", 400);
  if (!phoneRaw || !phone) throw new AuthError("Telefon raqamini +998 bilan kiriting.", 400);
  if (emailRaw && !email) throw new AuthError("Email manzilini to'g'ri kiriting.", 400);

  const doctorName = doctor || name;
  let clinicName = clinic;
  if (!clinicName) {
    try {
      clinicName = clinicNameFor(doctorName);
    } catch {
      throw new AuthError("Klinika nomini kiriting.", 400);
    }
  }
  const plan = canonicalPlanId(String(input.plan || "")) || "pro";
  const cycle: BillingCycle = input.cycle === "year" ? "year" : "month";
  return { name, password, clinicName, doctorName, phone: phone || "", email: email || "", plan, cycle };
}

function accountFromSubscription(sub: Subscription): Account {
  const open = sub.accessUnlocked && Date.parse(sub.expiresAt) > Date.now() && sub.subscriptionStatus !== "pending";
  const lockReason = sub.subscriptionStatus === "pending"
    ? "Hisob ochilgan. Avval 14 kunlik sinovni boshlang yoki to'lovni tasdiqlang."
    : sub.paymentMethod === "trial" || sub.planId === "trial"
      ? "14 kunlik sinov muddati tugagan. Tarifni sotib oling."
      : "Kirish muddati tugagan. Tarifni yangilang.";
  return {
    clinicId: sub.id,
    userId: `user-${sub.id}`,
    username: (sub.username || loginName(sub.email, sub.phone, sub.id)).toLowerCase(),
    name: sub.ownerName || sub.doctorName,
    doctorName: sub.doctorName,
    clinicName: sub.clinicName,
    phone: sub.phone,
    email: sub.email,
    role: "admin",
    plan: crmPlanColumn(sub.planId),
    passwordHash: sub.temporaryPassword,
    open,
    expiresAt: sub.expiresAt,
    lockReason,
  };
}

function matchesLocal(sub: Subscription, identifier: string) {
  const raw = identifier.trim().toLowerCase();
  const username = (sub.username || loginName(sub.email, sub.phone, sub.id)).toLowerCase();
  if (username === raw) return true;
  if (sub.email && sub.email.toLowerCase() === raw) return true;
  const phone = normalizePhone(identifier);
  if (phone && sub.phone === phone) return true;
  return false;
}

async function findLocal(identifier: string) {
  const db = await readStore();
  return Object.values(db.subscriptions).filter((sub) => matchesLocal(sub, identifier)).map(accountFromSubscription);
}

type RemoteUser = {
  id?: string;
  clinic_id?: string;
  username?: string;
  password?: string;
  name?: string;
  full_name?: string;
  phone?: string;
  notes?: string;
  role?: string;
};

type RemoteClinic = {
  id?: string;
  name?: string;
  status?: string;
  expires_at?: string;
  plan?: string;
};

async function findRemote(identifier: string, fetchImpl: FetchLike): Promise<Account[]> {
  const config = crmConfig();
  if (!config) return [];
  const parts: string[] = [];
  const email = identifier.includes("@") ? normalizeEmail(identifier) : null;
  const phone = normalizePhone(identifier);
  const username = identifier.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
  if (email) {
    parts.push(`notes.eq.${quote(email)}`);
    const local = email.split("@")[0]?.replace(/[^a-z0-9._-]/gi, "") ?? "";
    if (local.length >= 2) parts.push(`username.eq.${quote(local.toLowerCase())}`);
  }
  if (phone) parts.push(`phone.eq.${quote(phone)}`);
  if (username.length >= 2) parts.push(`username.eq.${quote(username)}`);
  if (!parts.length) return [];

  const userResponse = await fetchImpl(
    `${config.url}/rest/v1/users?select=id,clinic_id,username,password,name,full_name,phone,notes,role&or=${encodeURIComponent(`(${parts.join(",")})`)}`,
    { headers: { apikey: config.key, Authorization: `Bearer ${config.key}` }, cache: "no-store" },
  );
  if (!userResponse.ok) return [];
  const users = (await userResponse.json()) as RemoteUser[];
  const clinicIds = [...new Set(users.map((user) => user.clinic_id).filter((id): id is string => Boolean(id)))];
  if (!clinicIds.length) return [];
  const clinicResponse = await fetchImpl(
    `${config.url}/rest/v1/clinics?select=id,name,status,expires_at,plan&id=in.(${clinicIds.map(quote).join(",")})`,
    { headers: { apikey: config.key, Authorization: `Bearer ${config.key}` }, cache: "no-store" },
  );
  const clinics = clinicResponse.ok ? ((await clinicResponse.json()) as RemoteClinic[]) : [];
  const byId = new Map(clinics.map((clinic) => [clinic.id, clinic]));

  return users.flatMap((user) => {
    if (!user.clinic_id || !user.username || !user.password) return [];
    const clinic = byId.get(user.clinic_id);
    let open = false;
    let lockReason = "Klinika topilmadi.";
    if (clinic) {
      const active = String(clinic.status || "").toLowerCase() === "active";
      let expired = false;
      if (clinic.expires_at) {
        const end = new Date(clinic.expires_at);
        if (!Number.isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          expired = Date.now() > end.getTime();
        }
      }
      open = active && !expired;
      if (!active) lockReason = "Klinika faol emas.";
      else if (expired) lockReason = "Sinov yoki to'lov muddati tugagan.";
    }
    return [
      {
        clinicId: user.clinic_id,
        userId: user.id || `user-${user.clinic_id}`,
        username: user.username.toLowerCase(),
        name: user.full_name || user.name || user.username,
        doctorName: user.full_name || user.name || user.username,
        clinicName: clinic?.name || user.clinic_id,
        phone: user.phone || "",
        email: user.notes || "",
        role: "admin" as const,
        plan: (clinic?.plan || "basic").toLowerCase(),
        passwordHash: user.password,
        open,
        expiresAt: clinic?.expires_at || "",
        lockReason,
      },
    ];
  });
}

const HANDOFF_MS = 2 * 60 * 1000;
const RESUME_MS = 12 * 60 * 60 * 1000;

export type HandoffClaims = {
  clinicId: string;
  userId: string;
  username: string;
  name: string;
  role: "admin";
  plan: string;
  clinicName: string;
  expiresAt: string;
  exp: number;
};

function handoffSecret() {
  const configured = process.env.LICENSE_SIGNING_SECRET?.trim();
  if (configured) return configured;
  const merchant = process.env.PAYME_SECRET_KEY?.trim() || process.env.CLICK_SECRET_KEY?.trim();
  if (merchant) return merchant;
  if (process.env.NODE_ENV === "production") {
    throw new Error("LICENSE_SIGNING_SECRET is required for trial login handoff.");
  }
  return "shifo-demo-signing-secret";
}

function signBody(body: string) {
  return createHmac("sha256", handoffSecret()).update(body).digest("base64url");
}

export function issueHandoff(account: Pick<Account, "clinicId" | "userId" | "username" | "name" | "role" | "plan" | "clinicName" | "expiresAt">, origin: string) {
  const claims: HandoffClaims = {
    clinicId: account.clinicId,
    userId: account.userId,
    username: account.username,
    name: account.name,
    role: "admin",
    plan: account.plan,
    clinicName: account.clinicName,
    expiresAt: account.expiresAt,
    exp: Date.now() + HANDOFF_MS,
  };
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const token = `${body}.${signBody(body)}`;
  const from = encodeURIComponent(origin.replace(/\/$/, ""));
  return {
    token,
    url: `${appUrl()}/login#handoff=${token}&from=${from}`,
  };
}

type ResumeClaims = HandoffClaims & { kind: "resume"; cycle: BillingCycle };

export function issueResume(account: Pick<Account, "clinicId" | "userId" | "username" | "name" | "role" | "plan" | "clinicName"> & { cycle: BillingCycle }) {
  const claims: ResumeClaims = {
    kind: "resume",
    clinicId: account.clinicId,
    userId: account.userId,
    username: account.username,
    name: account.name,
    role: "admin",
    plan: account.plan,
    cycle: account.cycle,
    clinicName: account.clinicName,
    expiresAt: "",
    exp: Date.now() + RESUME_MS,
  };
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${body}.${signBody(body)}`;
}

export function redeemResume(token: string): ResumeClaims | null {
  const row = redeemHandoff(token) as ResumeClaims | null;
  if (!row || row.kind !== "resume" || (row.cycle !== "year" && row.cycle !== "month")) return null;
  return row;
}

export function redeemHandoff(token: string): HandoffClaims | null {
  const clean = token.trim();
  const [body, signature] = clean.split(".");
  if (!body || !signature || clean.split(".").length !== 2) return null;
  const expected = signBody(body);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as HandoffClaims;
    if (!parsed.userId || !parsed.clinicId || !parsed.username || !parsed.exp) return null;
    if (parsed.exp <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function resultFor(account: Account, handoffUrl: string, message: string): AuthResult {
  return {
    ok: true,
    message,
    clinicId: account.clinicId,
    username: account.username,
    name: account.name,
    clinicName: account.clinicName,
    doctorName: account.doctorName,
    expiresAt: account.expiresAt,
    trialDays: TRIAL_DAYS,
    handoffUrl,
    crmUrl: `${appUrl()}/login`,
  };
}

function chooseResult(account: Account, resumeToken: string, cycle: BillingCycle): AuthResult {
  const base = resultFor(account, "", "Klinika ochildi. Sinov yoki to'lovni tanlang.");
  return {
    ...base,
    step: "choose",
    resumeToken,
    plan: account.plan,
    cycle,
    amountUzs: chargeAmount(account.plan, cycle),
    paymeLive: paymeConfigured(),
    clickLive: clickConfigured(),
    supportUrl: SUPPORT_URL,
  };
}

async function persistAccess(sub: Subscription | null, fetchImpl: FetchLike) {
  if (sub) {
    try {
      await publishStagedTrial(sub, fetchImpl);
    } catch (error) {
      console.error("CRM ingest failed", error);
      throw new AuthError("Klinika CRM ga yozilmadi. Qayta urinib ko'ring.", 502);
    }
    return;
  }
}

export async function registerAccount(input: RegisterInput, request: Request, fetchImpl: FetchLike = fetch): Promise<AuthResult> {
  const fields = parseRegistration(input);
  const passwordHash = await hashPassword(fields.password);
  if (!isPasswordHash(passwordHash)) throw new AuthError("Parol saqlanmadi.", 500);

  const leadId = randomBytes(8).toString("hex");
  const saved = await updateStore((db) => {
    if (identityTaken(Object.values(db.subscriptions), fields.phone, fields.email)) {
      throw new AuthError("Bu telefon yoki email allaqachon ro'yxatdan o'tgan. Kirishdan foydalaning.", 409);
    }
    const taken = new Set(Object.values(db.subscriptions).map((sub) => (sub.username || "").toLowerCase()).filter(Boolean));
    const username = uniqueUsername(taken, loginName(fields.email, fields.phone, leadId), leadId);
    const lead: DemoLead = {
      id: leadId,
      name: fields.doctorName,
      phone: fields.phone,
      clinic: fields.clinicName,
      email: fields.email,
      planId: fields.plan,
      billingCycle: fields.cycle,
      createdAt: new Date().toISOString(),
    };
    return stagePending(db, lead, { passwordHash, username, ownerName: fields.name });
  });

  await persistAccess(saved, fetchImpl);
  if (crmConfig() && process.env.CRM_SUPABASE_DISABLED !== "1") {
    const remote = await readCrmClinic(saved.id, fetchImpl);
    if (!remote) throw new AuthError("Klinika CRM ga yozilmadi. Qayta urinib ko'ring.", 502);
  }

  const account = accountFromSubscription(saved);
  const resumeToken = issueResume({ ...account, cycle: fields.cycle });
  return chooseResult(account, resumeToken, fields.cycle);
}

function openTrial(sub: Subscription) {
  const started = new Date();
  const expires = new Date(started.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
  sub.status = "trial";
  sub.subscriptionStatus = "trialing";
  sub.paymentMethod = "trial";
  sub.accessUnlocked = true;
  sub.startedAt = started.toISOString();
  sub.expiresAt = expires.toISOString();
  sub.amountUzs = 0;
  sub.pendingOrder = null;
  sub.updatedAt = started.toISOString();
  return sub;
}

export async function startTrial(token: string, request: Request, fetchImpl: FetchLike = fetch): Promise<AuthResult> {
  const claims = redeemResume(token);
  if (!claims) throw new AuthError("Sessiya tugagan. Qayta ro'yxatdan o'ting.", 401);
  const saved = await updateStore((db) => {
    const sub = db.subscriptions[claims.clinicId];
    if (!sub) return null;
    if (sub.subscriptionStatus === "trialing" && sub.accessUnlocked) return sub;
    return openTrial(sub);
  });
  if (saved) await persistAccess(saved, fetchImpl);
  else {
    const expires = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const written = await writeClinicAccess(claims.clinicId, {
      status: "Active",
      expiresAt: expires,
      plan: claims.plan,
      monthlyFee: catalogMonthly(claims.plan),
      removeLogoKeys: ["pending_order"],
      logoExtra: {
        tariff: claims.plan,
        billing_cycle: claims.cycle,
        billing_status: "trial",
        subscription_status: "trialing",
        payment_method: "trial",
        access_unlocked: true,
        trial_ends_at: expires.slice(0, 10),
        period_ends_at: expires.slice(0, 10),
      },
    }, fetchImpl);
    if (written.missing) throw new AuthError("Klinika topilmadi.", 404);
  }
  const account = saved
    ? accountFromSubscription(saved)
    : {
      ...claims,
      doctorName: claims.name,
      phone: "",
      email: "",
      passwordHash: "",
      open: true,
      expiresAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      lockReason: "",
      cycle: claims.cycle,
    };
  const handoff = issueHandoff(account, requestOrigin(request));
  return { ...resultFor(account, handoff.url, "14 kunlik bepul sinov ochildi"), step: "crm", plan: claims.plan, cycle: claims.cycle };
}

export async function startPayment(
  token: string,
  request: Request,
  providerInput?: string,
  fetchImpl: FetchLike = fetch,
): Promise<AuthResult> {
  const claims = redeemResume(token);
  if (!claims) throw new AuthError("Sessiya tugagan. Qayta ro'yxatdan o'ting.", 401);
  const amount = chargeAmount(claims.plan, claims.cycle);
  const planName = getTariff(claims.plan)?.name || claims.plan;
  const orderId = randomBytes(16).toString("hex");
  const pending: PendingOrder = {
    id: orderId,
    amountUzs: amount,
    cycle: claims.cycle,
    planId: claims.plan,
    createdAt: new Date().toISOString(),
    status: "pending",
  };
  const saved = await updateStore((db) => {
    const sub = db.subscriptions[claims.clinicId];
    if (!sub) return null;
    sub.pendingOrder = pending;
    sub.orderId = orderId;
    sub.amountUzs = amount;
    sub.updatedAt = new Date().toISOString();
    db.orders[orderId] = {
      id: orderId,
      planId: claims.plan,
      planName,
      amountUzs: amount,
      name: claims.name,
      phone: sub.phone,
      email: sub.email,
      clinic: claims.clinicName,
      clinicId: claims.clinicId,
      billingCycle: claims.cycle,
      provider: providerInput === "click" ? "click" : "payme",
      status: "pending",
      createdAt: pending.createdAt,
    };
    return sub;
  });
  const written = await writeClinicAccess(claims.clinicId, {
    status: "Inactive",
    expiresAt: new Date().toISOString(),
    plan: claims.plan,
    monthlyFee: catalogMonthly(claims.plan),
    logoExtra: {
      tariff: claims.plan,
      billing_cycle: claims.cycle,
      billing_status: "pending",
      subscription_status: "pending",
      access_unlocked: false,
      pending_order: pending,
    },
  }, fetchImpl);
  if (!saved && written.missing) throw new AuthError("Klinika topilmadi.", 404);

  const provider = providerInput === "click" ? "click" : providerInput === "payme" ? "payme" : null;
  if (provider && providerLive(provider)) {
    const returnUrl = `${requestOrigin(request)}/royxatdan-otish?resume=${encodeURIComponent(token)}`;
    const paymentUrl = provider === "payme"
      ? paymeCheckoutUrl(orderId, amount, returnUrl)
      : clickCheckoutUrl(orderId, amount, returnUrl);
    return {
      ...resultFor({
        clinicId: claims.clinicId,
        userId: claims.userId,
        username: claims.username,
        name: claims.name,
        doctorName: claims.name,
        clinicName: claims.clinicName,
        phone: "",
        email: "",
        role: "admin",
        plan: claims.plan,
        passwordHash: "",
        open: false,
        expiresAt: "",
        lockReason: "",
      }, "", "To'lov oynasi ochildi"),
      step: "payment",
      resumeToken: token,
      plan: claims.plan,
      cycle: claims.cycle,
      amountUzs: amount,
      orderId,
      paymentUrl,
      supportUrl: SUPPORT_URL,
    };
  }

  return {
    ...resultFor({
      clinicId: claims.clinicId,
      userId: claims.userId,
      username: claims.username,
      name: claims.name,
      doctorName: claims.name,
      clinicName: claims.clinicName,
      phone: saved?.phone || "",
      email: "",
      role: "admin",
      plan: claims.plan,
      passwordHash: "",
      open: false,
      expiresAt: "",
      lockReason: "",
    }, "", "To'lov kutilmoqda"),
    step: "payment",
    pending: true,
    resumeToken: token,
    plan: claims.plan,
    cycle: claims.cycle,
    amountUzs: amount,
    orderId,
    supportUrl: SUPPORT_URL,
    paymeLive: paymeConfigured(),
    clickLive: clickConfigured(),
  };
}

export async function sessionStatus(token: string, request: Request, fetchImpl: FetchLike = fetch): Promise<AuthResult> {
  const claims = redeemResume(token);
  if (!claims) throw new AuthError("Sessiya tugagan. Qayta ro'yxatdan o'ting.", 401);
  const db = await readStore();
  const local = db.subscriptions[claims.clinicId];
  const remote = await readCrmClinic(claims.clinicId, fetchImpl);
  const remoteExpiry = remote?.expires_at ? Date.parse(`${remote.expires_at.slice(0, 10)}T23:59:59+05:00`) : 0;
  const remoteOpen = Boolean(
    remote
    && remote.status === "Active"
    && remote.subscription_status !== "pending"
    && remoteExpiry > Date.now(),
  );
  const localOpen = Boolean(local && local.accessUnlocked && local.subscriptionStatus !== "pending" && Date.parse(local.expiresAt) > Date.now());
  const open = remote ? remoteOpen : localOpen;
  if (!open) {
    return {
      ...resultFor({
        clinicId: claims.clinicId,
        userId: claims.userId,
        username: claims.username,
        name: claims.name,
        doctorName: claims.name,
        clinicName: claims.clinicName,
        phone: local?.phone || "",
        email: "",
        role: "admin",
        plan: claims.plan,
        passwordHash: "",
        open: false,
        expiresAt: local?.expiresAt || "",
        lockReason: "",
      }, "", "To'lov kutilmoqda"),
      step: "payment",
      pending: true,
      plan: claims.plan,
      cycle: claims.cycle,
      amountUzs: local?.pendingOrder?.amountUzs || remote?.pending_order?.amountUzs || chargeAmount(claims.plan, claims.cycle),
      supportUrl: SUPPORT_URL,
    };
  }
  const expiresAt = remoteOpen && remote?.expires_at ? remote.expires_at : (local?.expiresAt || "");
  const account = {
    clinicId: claims.clinicId,
    userId: claims.userId,
    username: claims.username,
    name: claims.name,
    doctorName: claims.name,
    clinicName: remote?.name || claims.clinicName,
    phone: local?.phone || "",
    email: "",
    role: "admin" as const,
    plan: remote?.plan || claims.plan,
    passwordHash: "",
    open: true,
    expiresAt,
    lockReason: "",
  };
  const handoff = issueHandoff(account, requestOrigin(request));
  return { ...resultFor(account, handoff.url, "CRM ochildi"), step: "crm", pending: false, plan: account.plan, cycle: claims.cycle };
}

export async function loginAccount(identifier: string, password: string, request: Request, fetchImpl: FetchLike = fetch): Promise<AuthResult> {
  const ident = identifier.trim();
  const secret = password.trim();
  if (!ident || !secret) throw new AuthError("Login va parolni kiriting.", 400);
  if (secret.length > 72) throw new AuthError("Login yoki parol noto'g'ri.", 401);

  const remote = await findRemote(ident, fetchImpl);
  const pool = remote.length ? remote : await findLocal(ident);
  let locked: string | null = null;
  for (const account of pool) {
    if (!(await verifyPassword(secret, account.passwordHash))) continue;
    if (!account.open) {
      locked = account.lockReason;
      continue;
    }
    const handoff = issueHandoff(account, requestOrigin(request));
    return resultFor(account, handoff.url, "Hisob topildi");
  }
  if (locked) throw new AuthError(locked, 403);
  throw new AuthError("Login yoki parol noto'g'ri.", 401);
}

export function handoffPayload(row: HandoffClaims) {
  const exp = Date.now() + 24 * 60 * 60 * 1000;
  const token = Buffer.from(JSON.stringify({ sub: row.userId, role: row.role, exp })).toString("base64url");
  return {
    token,
    user: {
      id: row.userId,
      username: row.username,
      name: row.name,
      role: row.role,
      clinic_id: row.clinicId,
      plan: row.plan || "basic",
    },
  };
}

export const TRIAL_LENGTH_DAYS = TRIAL_DAYS;
