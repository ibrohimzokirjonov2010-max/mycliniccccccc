import assert from "node:assert/strict";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { beforeEach, describe, test } from "node:test";
import { loginAccount, parseRegistration, redeemHandoff, registerAccount, sessionStatus, startPayment, startTrial } from "./accounts";
import { isPasswordHash, verifyPassword } from "./password";
import { resetStoreForTests } from "./store";
import { buildCrmRows, writeClinicAccess } from "./tenants";

process.env.LANDING_DATA_DIR = mkdtempSync(path.join(tmpdir(), "shifo-accounts-"));
process.env.CRM_SUPABASE_DISABLED = "1";
process.env.BCRYPT_ROUNDS = "4";
process.env.NEXT_PUBLIC_APP_URL = "https://app-shahobidin-4.vercel.app";
process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

function request() {
  return new Request("http://localhost:3000/api/auth/register");
}

describe("trial registration", { concurrency: 1 }, () => {
  beforeEach(async () => {
    process.env.CRM_SUPABASE_DISABLED = "1";
    process.env.BCRYPT_ROUNDS = "4";
    await resetStoreForTests();
  });

  test("requires a clinic name, a phone, and a password", () => {
    assert.throws(() => parseRegistration({ name: "Akmal Karimov", password: "parol1234", phone: "901112233" }), /Klinika nomini/);
    assert.throws(() => parseRegistration({ name: "Akmal Karimov", password: "parol1234", clinic: "Smile" }), /Telefon/);
    assert.throws(() => parseRegistration({ name: "Akmal Karimov", password: "short", clinic: "Smile", phone: "901112233" }), /8 ta/);
  });

  test("register stores the chosen plan, then trial or a pending order", async () => {
    const created = await registerAccount(
      {
        name: "Dilnoza Rahimova",
        clinic: "Smile Dental",
        email: "dilnoza@smile.uz",
        phone: "901112233",
        password: "parol1234",
        plan: "basic",
        cycle: "year",
      },
      request(),
    );
    assert.equal(created.step, "choose");
    assert.equal(created.clinicName, "Smile Dental");
    assert.equal(created.username, "dilnoza");
    assert.equal(created.plan, "basic");
    assert.equal(created.amountUzs, 990_000);
    assert.equal(created.handoffUrl, "");
    assert.ok(created.resumeToken);

    const { listSubscriptions } = await import("./tenants");
    const [saved] = await listSubscriptions();
    assert.equal(isPasswordHash(saved.temporaryPassword), true);
    assert.equal(await verifyPassword("parol1234", saved.temporaryPassword), true);
    assert.equal(saved.subscriptionStatus, "pending");
    assert.equal(saved.ownerName, "Dilnoza Rahimova");
    const { user, clinic } = buildCrmRows(saved);
    assert.equal(user.username, "dilnoza");
    assert.equal(clinic.monthly_fee, 99_000);
    assert.equal(clinic.plan, "basic");
    assert.equal(clinic.status, "Inactive");

    await assert.rejects(() => loginAccount("dilnoza@smile.uz", "parol1234", request()), /sinovni boshlang|to'lovni tasdiqlang/);

    const waiting = await sessionStatus(created.resumeToken || "", request());
    assert.equal(waiting.pending, true);

    const bought = await startPayment(created.resumeToken || "", request());
    assert.equal(bought.pending, true);
    assert.equal(bought.amountUzs, 990_000);
    assert.equal(bought.supportUrl, "https://t.me/dentist_shaxin");
    const [withOrder] = await listSubscriptions();
    assert.equal(withOrder.pendingOrder?.status, "pending");
    assert.equal(withOrder.pendingOrder?.amountUzs, 990_000);

    const started = await startTrial(created.resumeToken || "", request());
    assert.match(started.handoffUrl, /\/login#handoff=/);
    const ends = Date.parse(started.expiresAt) - Date.now();
    assert.ok(ends > 13 * 24 * 60 * 60 * 1000);
    assert.ok(ends < 15 * 24 * 60 * 60 * 1000);
    const open = await sessionStatus(created.resumeToken || "", request());
    assert.equal(open.pending, false);
    assert.match(open.handoffUrl, /\/login#handoff=/);

    const logged = await loginAccount("dilnoza@smile.uz", "parol1234", request());
    assert.equal(logged.clinicId, created.clinicId);
    const token = decodeURIComponent(logged.handoffUrl.split("handoff=")[1]?.split("&")[0] ?? "");
    const row = redeemHandoff(token);
    assert.equal(row?.username, "dilnoza");

    await assert.rejects(
      () => registerAccount(
        { name: "Dilnoza Rahimova", clinic: "Smile Dental", phone: "901112233", password: "parol1234" },
        request(),
      ),
      /allaqachon/,
    );
  });

  test("phone registration creates a login from the phone", async () => {
    const created = await registerAccount(
      { name: "Jasur Aliyev", clinic: "Nur Dent", phone: "939998877", password: "sinovparol", plan: "premium" },
      request(),
    );
    assert.equal(created.username, "dr998877");
    assert.equal(created.plan, "premium");
    assert.equal(created.amountUzs, 349_000);
    const started = await startTrial(created.resumeToken || "", request());
    const logged = await loginAccount("dr998877", "sinovparol", request());
    assert.equal(logged.clinicId, started.clinicId);
  });

  test("clinic access update keeps the existing password", async () => {
    const previous = process.env.CRM_SUPABASE_DISABLED;
    delete process.env.CRM_SUPABASE_DISABLED;
    const bodies: string[] = [];
    const fetchImpl = async (url: string, init?: RequestInit) => {
      if (typeof init?.body === "string") bodies.push(init.body);
      if (url.includes("select=password")) return new Response(JSON.stringify([{ password: "hash-keep" }]));
      if (url.includes("select=id,name")) {
        return new Response(JSON.stringify([{
          id: "t1",
          name: "QA",
          status: "Inactive",
          expires_at: "2026-09-30",
          plan: "pro",
          logo: "",
          monthly_fee: 189000,
        }]));
      }
      return new Response("", { status: 201 });
    };
    try {
      await writeClinicAccess("t1", {
        status: "Inactive",
        expiresAt: new Date().toISOString(),
        plan: "pro",
        monthlyFee: 189000,
        logoExtra: { pending_order: { id: "ord", amountUzs: 189000, cycle: "month", planId: "pro", createdAt: "2026-09-30", status: "pending" } },
      }, fetchImpl as typeof fetch);
      const saved = JSON.parse(bodies[0] || "{}") as { password?: string; pending_order?: unknown };
      assert.equal(saved.password, "hash-keep");
      assert.equal(bodies.some((body) => body.includes("pending_order")), true);
    } finally {
      process.env.CRM_SUPABASE_DISABLED = previous;
    }
  });
});
