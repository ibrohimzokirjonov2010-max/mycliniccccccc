import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";

export type Provider = "payme" | "click" | "mock";
export type OrderStatus = "pending" | "active" | "cancelled";

export type Order = {
  id: string;
  planId: string;
  planName: string;
  amountUzs: number;
  name: string;
  phone: string;
  email: string;
  clinic?: string;
  provider: Provider;
  status: OrderStatus;
  createdAt: string;
  licenseId?: string;
  providerTransactionId?: string;
  clickTransId?: string;
  clickPrepareId?: number;
};

export type License = {
  id: string;
  key: string;
  orderId: string;
  planId: string;
  planName: string;
  name: string;
  phone: string;
  email: string;
  provider: Provider;
  providerTransactionId: string;
  amountUzs: number;
  status: "active" | "cancelled";
  activatedAt: string;
  expiresAt: string;
  cancelledAt?: string;
};

export type PaymeTransaction = {
  id: string;
  merchantTxId: string;
  orderId: string;
  amountTiyin: number;
  state: 1 | 2 | -1 | -2;
  createTime: number;
  performTime: number;
  cancelTime: number;
  reason: number | null;
};

export type DemoLead = {
  id: string;
  name: string;
  phone: string;
  clinic: string;
  email: string;
  createdAt: string;
};

export type BillingStatus = "trial" | "paid" | "expired";
export type PaymentMethod = Provider | "trial";

export type Subscription = {
  id: string;
  doctorName: string;
  clinicName: string;
  phone: string;
  email: string;
  planId: string;
  planName: string;
  status: BillingStatus;
  amountUzs: number;
  paymentMethod: PaymentMethod;
  accessUnlocked: boolean;
  startedAt: string;
  expiresAt: string;
  paidAt: string | null;
  licenseKey: string;
  orderId: string | null;
  leadId: string | null;
  temporaryPassword: string;
  updatedAt: string;
};

export type Database = {
  orders: Record<string, Order>;
  licenses: Record<string, License>;
  payme: Record<string, PaymeTransaction>;
  nextPrepareId: number;
  demoLeads: DemoLead[];
  subscriptions: Record<string, Subscription>;
};

const TIMEOUT_MS = 12 * 60 * 60 * 1000;

export function emptyDatabase(): Database {
  return { orders: {}, licenses: {}, payme: {}, nextPrepareId: 1000, demoLeads: [], subscriptions: {} };
}

function patchDatabase(parsed: Database) {
  parsed.demoLeads ??= [];
  parsed.nextPrepareId ??= 1000;
  parsed.subscriptions ??= {};
  return parsed;
}

export function paymeTimedOut(txn: PaymeTransaction, now = Date.now()) {
  return txn.state === 1 && now - txn.createTime > TIMEOUT_MS;
}

function dataDir() {
  if (process.env.LANDING_DATA_DIR?.trim()) return process.env.LANDING_DATA_DIR.trim();
  if (process.env.VERCEL) return path.join("/tmp", "shifo-landing");
  return path.join(process.cwd(), ".data");
}

function dataFile() {
  return path.join(dataDir(), "store.json");
}

function supabaseEnabled() {
  return Boolean(process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

let queue: Promise<unknown> = Promise.resolve();
let memory: Database | null = null;
let memoryOnly = false;

function clone(db: Database): Database {
  return structuredClone(db);
}

async function readFileDb(): Promise<Database> {
  if (memoryOnly && memory) return clone(memory);
  try {
    const raw = await readFile(dataFile(), "utf8");
    const parsed = JSON.parse(raw) as Database;
    if (!parsed.orders || !parsed.licenses || !parsed.payme) return emptyDatabase();
    return patchDatabase(parsed);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return memory ? clone(memory) : emptyDatabase();
    throw error;
  }
}

async function writeFileDb(db: Database) {
  memory = clone(db);
  if (memoryOnly) return;
  const dir = dataDir();
  await mkdir(dir, { recursive: true });
  const target = dataFile();
  const temp = `${target}.${process.pid}.tmp`;
  try {
    await writeFile(temp, JSON.stringify(db), "utf8");
    await rename(temp, target);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EROFS" || code === "EACCES" || code === "EPERM") {
      memoryOnly = true;
      console.warn("Landing store is in-memory only. Set Supabase env vars for a durable store.");
      return;
    }
    throw error;
  }
}

function supabaseHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

function supabaseBase() {
  return process.env.SUPABASE_URL!.trim().replace(/\/$/, "");
}

async function readSupabase(): Promise<{ data: Database; version: number } | null> {
  const response = await fetch(
    `${supabaseBase()}/rest/v1/landing_store?id=eq.main&select=data,version`,
    { headers: supabaseHeaders(), cache: "no-store" },
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase read failed (${response.status}). Run landing/supabase/landing_store.sql. ${detail}`);
  }
  const rows = (await response.json()) as Array<{ data: Database; version: number }>;
  if (!rows.length) return null;
  const data = rows[0].data;
  patchDatabase(data);
  return { data, version: rows[0].version };
}

async function writeSupabase(db: Database, version: number | null) {
  if (version === null) {
    const response = await fetch(`${supabaseBase()}/rest/v1/landing_store`, {
      method: "POST",
      headers: { ...supabaseHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({ id: "main", data: db, version: 1 }),
    });
    if (response.status === 409) return false;
    if (!response.ok) throw new Error(`Supabase insert failed (${response.status}). ${await response.text()}`);
    return true;
  }
  const response = await fetch(
    `${supabaseBase()}/rest/v1/landing_store?id=eq.main&version=eq.${version}`,
    {
      method: "PATCH",
      headers: { ...supabaseHeaders(), Prefer: "return=representation" },
      body: JSON.stringify({ data: db, version: version + 1, updated_at: new Date().toISOString() }),
    },
  );
  if (!response.ok) throw new Error(`Supabase update failed (${response.status}). ${await response.text()}`);
  const rows = (await response.json()) as unknown[];
  return rows.length > 0;
}

async function updateSupabase<T>(fn: (db: Database) => T): Promise<T> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const current = await readSupabase();
    const db = clone(current?.data ?? emptyDatabase());
    const result = fn(db);
    const saved = await writeSupabase(db, current ? current.version : null);
    if (saved) return result;
  }
  throw new Error("Could not save the landing store. Retry the payment callback.");
}

export async function updateStore<T>(fn: (db: Database) => T): Promise<T> {
  const run = queue.then(async () => {
    if (supabaseEnabled()) return updateSupabase(fn);
    const db = clone(await readFileDb());
    const result = fn(db);
    await writeFileDb(db);
    return result;
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function readStore() {
  if (supabaseEnabled()) {
    const current = await readSupabase();
    return clone(current?.data ?? emptyDatabase());
  }
  return clone(await readFileDb());
}

export async function resetStoreForTests() {
  memory = null;
  memoryOnly = false;
  queue = Promise.resolve();
  const { rm } = await import("fs/promises");
  await rm(dataDir(), { recursive: true, force: true });
}
