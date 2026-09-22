import assert from "node:assert/strict";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { beforeEach, describe, test } from "node:test";
import { activateOrder, createOrder, revokeLicenseInDb, saveDemoLead } from "./billing";
import { resetStoreForTests, updateStore } from "./store";
import { buildCrmRows, crmPlanColumn, encodeClinicLogo, ingestSafely, listSubscriptions, publishTrial, syncOrderToAdmin, upsertRow } from "./tenants";

process.env.LANDING_DATA_DIR = mkdtempSync(path.join(tmpdir(), "shifo-tenants-"));
process.env.CRM_SUPABASE_DISABLED = "1";
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.CRM_SUPABASE_URL;
delete process.env.CRM_SUPABASE_KEY;

function decodeLogo(logo: string) {
  assert.equal(logo.startsWith("[EXT]"), true);
  const end = logo.indexOf("[/EXT]");
  return JSON.parse(logo.slice(5, end)) as Record<string, unknown>;
}

describe("super admin ingest", { concurrency: 1 }, () => {
  beforeEach(async () => {
    process.env.CRM_SUPABASE_DISABLED = "1";
    delete process.env.CRM_SUPABASE_URL;
    delete process.env.CRM_SUPABASE_KEY;
    await resetStoreForTests();
  });

  test("paid activation records the clinic the portal can read", async () => {
    const order = await createOrder({
      planId: "pro",
      name: "Akmal Karimov",
      phone: "901234567",
      email: "akmal@smile.uz",
      clinic: "Smile Stomatologiya",
      provider: "payme",
    });
    await activateOrder({ orderId: order.id, provider: "mock", providerTransactionId: `mock_${order.id}` });
    const saved = await syncOrderToAdmin(order.id);
    assert.ok(saved);
    assert.equal(saved.status, "paid");
    assert.equal(saved.accessUnlocked, true);
    assert.equal(saved.paymentMethod, "mock");
    assert.equal(saved.amountUzs, 1_990_000);
    assert.equal(saved.clinicName, "Smile Stomatologiya");
    const again = await syncOrderToAdmin(order.id);
    assert.equal(again?.temporaryPassword, saved.temporaryPassword);

    const { clinic, user } = buildCrmRows(saved);
    assert.equal(clinic.plan, "pro");
    assert.equal(clinic.status, "Active");
    assert.equal(clinic.monthly_fee, 1_990_000);
    assert.equal(user.role, "admin");
    assert.equal(user.commission_rate, 0);
    assert.equal(user.name, "Akmal Karimov");
    assert.equal(user.notes, "akmal@smile.uz");
    const extra = decodeLogo(String(clinic.logo));
    assert.equal(saved.subscriptionStatus, "active");
    assert.equal(saved.paymentLedger.length, 1);
    assert.equal(saved.paymentLedger[0]?.amountUzs, 1_990_000);
    assert.equal(again?.paymentLedger.length, 1);
    assert.equal(extra.tariff, "pro");
    assert.equal(extra.subscription_status, "active");
    assert.equal(extra.billing_status, "paid");
    assert.equal(Array.isArray(extra.payment_ledger), true);
    assert.equal(extra.access_unlocked, true);
    assert.equal(extra.payment_method, "mock");
    assert.equal(extra.doctor_name, "Akmal Karimov");
  });

  test("start maps to basic and a revoked license locks access", async () => {
    const order = await createOrder({
      planId: "start",
      name: "Dilnoza Rahimova",
      phone: "+998901112233",
      email: "dilnoza@clinic.uz",
      provider: "click",
    });
    assert.equal(order.clinic, "Dilnoza Rahimova klinikasi");
    await activateOrder({ orderId: order.id, provider: "click", providerTransactionId: "click-1" });
    const active = await syncOrderToAdmin(order.id);
    assert.equal(active?.subscriptionStatus, "active");
    assert.equal(active?.paymentLedger.length, 1);
    await updateStore((db) => {
      revokeLicenseInDb(db, order.id);
    });
    const saved = await syncOrderToAdmin(order.id);
    assert.equal(saved?.status, "expired");
    assert.equal(saved?.subscriptionStatus, "expired");
    assert.equal(saved?.paymentLedger.length, 1);
    assert.equal(saved?.paymentLedger[0]?.amountUzs, 990_000);
    assert.equal(saved?.accessUnlocked, false);
    const { clinic } = buildCrmRows(saved!);
    assert.equal(clinic.plan, "basic");
    assert.equal(clinic.status, "Expired");
    assert.equal(decodeLogo(String(clinic.logo)).tariff, "start");
    assert.equal(crmPlanColumn("klinika"), "pro");
  });

  test("free trial is a zero-amount unlocked tenant", async () => {
    const lead = await saveDemoLead({
      name: "Jasur Aliyev",
      phone: "998901234567",
      clinic: "Nur Shifo",
      email: "jasur@nur.uz",
    });
    const saved = await publishTrial(lead);
    assert.equal(saved.status, "trial");
    assert.equal(saved.subscriptionStatus, "trialing");
    assert.equal(saved.paymentLedger[0]?.note, "Bepul sinov");
    assert.equal(saved.amountUzs, 0);
    assert.equal(saved.paymentMethod, "trial");
    assert.equal(saved.accessUnlocked, true);
    assert.equal(saved.paidAt, null);
    const { clinic } = buildCrmRows(saved);
    assert.equal(clinic.plan, "basic");
    assert.equal(clinic.monthly_fee, 0);
    assert.equal(clinic.last_payment_date, undefined);
    assert.equal(decodeLogo(String(clinic.logo)).subscription_status, "trialing");
    const listed = await listSubscriptions();
    assert.equal(listed[0]?.id, saved.id);
  });

  test("a failed CRM write still keeps the landing subscription", async () => {
    process.env.CRM_SUPABASE_DISABLED = "0";
    process.env.CRM_SUPABASE_URL = "https://crm.example.test";
    process.env.CRM_SUPABASE_KEY = "test-key";
    const order = await createOrder({
      planId: "klinika",
      name: "Malika Tosheva",
      phone: "909998877",
      email: "malika@klinika.uz",
      provider: "payme",
    });
    await activateOrder({ orderId: order.id, provider: "payme", providerTransactionId: "payme-1" });
    let calls = 0;
    await ingestSafely(() =>
      syncOrderToAdmin(order.id, async () => {
        calls += 1;
        throw new Error("network down");
      }),
    );
    assert.equal(calls, 1);
    const [saved] = await listSubscriptions();
    assert.equal(saved?.planId, "klinika");
    assert.equal(saved?.status, "paid");
    assert.equal(buildCrmRows(saved!).clinic.plan, "pro");
  });

  test("upsert drops an unknown column and retries a rejected plan", async () => {
    process.env.CRM_SUPABASE_DISABLED = "0";
    process.env.CRM_SUPABASE_URL = "https://crm.example.test";
    process.env.CRM_SUPABASE_KEY = "test-key";
    const bodies: string[] = [];
    const response = await upsertRow(
      "clinics",
      { id: "c1", name: "Nur", plan: "basic", logo: encodeClinicLogo({ phone: "+998901112233" }) },
      async (_url, init) => {
        bodies.push(String(init?.body));
        if (bodies.length === 1) {
          return new Response(JSON.stringify({ code: "42703", message: 'column "logo" of relation "clinics" does not exist' }), { status: 400 });
        }
        if (bodies.length === 2) {
          return new Response(JSON.stringify({ code: "23514", message: 'new row violates check constraint "clinics_plan_check"' }), { status: 400 });
        }
        return new Response("", { status: 201 });
      },
    );
    assert.equal(response.skipped, false);
    assert.equal(JSON.parse(bodies[1]).logo, undefined);
    assert.equal(JSON.parse(bodies[2]).plan, "pro");
    assert.equal(JSON.parse(bodies[0]).plan, "basic");
  });

  test("disabled CRM ingest does not call the network", async () => {
    const order = await createOrder({
      planId: "pro",
      name: "Akmal Karimov",
      phone: "901234567",
      email: "akmal@smile.uz",
      provider: "payme",
    });
    await activateOrder({ orderId: order.id, provider: "mock", providerTransactionId: "m1" });
    await syncOrderToAdmin(order.id, async () => {
      throw new Error("fetch should not run");
    });
    assert.equal((await listSubscriptions()).length, 1);
  });
});
