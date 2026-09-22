import assert from "node:assert/strict";
import { createHash } from "crypto";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { beforeEach, describe, test } from "node:test";
import { TARIFFS } from "../config/tariffs";
import { activateOrder, createOrder, getLicense, getOrder } from "./billing";
import { handleClick } from "./payments/click";
import { handlePaymeRpc, paymeCheckoutUrl } from "./payments/payme";
import { resetStoreForTests } from "./store";
import { signLicense, verifyLicense } from "./token";

process.env.LANDING_DATA_DIR = mkdtempSync(path.join(tmpdir(), "shifo-landing-"));
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
process.env.CRM_SUPABASE_DISABLED = "1";
process.env.LICENSE_SIGNING_SECRET = "test-secret";

function clearMerchants() {
  delete process.env.PAYME_MERCHANT_ID;
  delete process.env.PAYME_SECRET_KEY;
  delete process.env.PAYME_LOGIN;
  delete process.env.CLICK_MERCHANT_ID;
  delete process.env.CLICK_SERVICE_ID;
  delete process.env.CLICK_SECRET_KEY;
}

function basicAuth(secret: string, login = "Paycom") {
  return `Basic ${Buffer.from(`${login}:${secret}`).toString("base64")}`;
}

function clickBody(action: 0 | 1, extra: Record<string, string> = {}) {
  const secret = process.env.CLICK_SECRET_KEY ?? "";
  const fields: Record<string, string> = {
    click_trans_id: "9001",
    service_id: process.env.CLICK_SERVICE_ID ?? "",
    merchant_trans_id: "",
    amount: "",
    action: String(action),
    error: "0",
    error_note: "Success",
    sign_time: "2026-09-22 12:00:00",
    ...extra,
  };
  const parts = [fields.click_trans_id, fields.service_id, secret, fields.merchant_trans_id];
  if (action === 1) parts.push(fields.merchant_prepare_id ?? "");
  parts.push(fields.amount, fields.action, fields.sign_time);
  fields.sign_string = createHash("md5").update(parts.join("")).digest("hex");
  return fields;
}

describe("SHIFO billing", { concurrency: 1 }, () => {
  beforeEach(async () => {
    clearMerchants();
    await resetStoreForTests();
  });

  test("tariffs match the published prices", () => {
    assert.deepEqual(
      TARIFFS.map((plan) => [plan.id, plan.priceUzs, plan.recommended]),
      [
        ["start", 990_000, false],
        ["pro", 1_990_000, true],
        ["klinika", 3_490_000, false],
      ],
    );
  });

  test("mock pay uses the same activation path as a verified webhook", async () => {
    const order = await createOrder({
      planId: "pro",
      name: "Akmal Karimov",
      phone: "90 123 45 67",
      email: "akmal@smile.uz",
      provider: "payme",
    });
    const license = await activateOrder({
      orderId: order.id,
      provider: "mock",
      providerTransactionId: `mock_${order.id}`,
    });
    const again = await activateOrder({
      orderId: order.id,
      provider: "mock",
      providerTransactionId: `mock_${order.id}`,
    });
    assert.equal(license.status, "active");
    assert.equal(license.planId, "pro");
    assert.equal(license.key, again.key);
    assert.equal((await getOrder(order.id))?.status, "active");
    const token = signLicense({
      orderId: order.id,
      licenseId: license.id,
      key: license.key,
      planId: license.planId,
      planName: license.planName,
      name: license.name,
      email: license.email,
      amountUzs: license.amountUzs,
      expiresAt: license.expiresAt,
      activatedAt: license.activatedAt,
      provider: "mock",
    });
    assert.equal(verifyLicense(token)?.key, license.key);
    assert.equal(verifyLicense(`${token}x`), null);
  });

  test("Payme webhook verifies auth, amount, and opens the license", async () => {
    process.env.PAYME_MERCHANT_ID = "merchant-1";
    process.env.PAYME_SECRET_KEY = "payme-secret";
    const order = await createOrder({
      planId: "start",
      name: "Dilnoza Rahimova",
      phone: "+998901112233",
      email: "dilnoza@clinic.uz",
      provider: "payme",
    });
    const auth = basicAuth("payme-secret");
    const denied = await handlePaymeRpc({ method: "CheckPerformTransaction", id: 1, params: {} }, "Basic bm8=");
    assert.equal((denied as { error: { code: number } }).error.code, -32504);

    const wrongAmount = await handlePaymeRpc(
      { method: "CheckPerformTransaction", id: 2, params: { amount: 100, account: { order_id: order.id } } },
      auth,
    );
    assert.equal((wrongAmount as { error: { code: number } }).error.code, -31001);

    const allowed = (await handlePaymeRpc(
      {
        method: "CheckPerformTransaction",
        id: 3,
        params: { amount: 990_000 * 100, account: { order_id: order.id } },
      },
      auth,
    )) as { result: Record<string, unknown> };
    assert.equal(allowed.result.allow, true);

    const created = (await handlePaymeRpc(
      {
        method: "CreateTransaction",
        id: 4,
        params: { id: "payme-tx-1", time: Date.now(), amount: 990_000 * 100, account: { order_id: order.id } },
      },
      auth,
    )) as { result: Record<string, unknown> };
    assert.equal(created.result.state, 1);

    const performed = (await handlePaymeRpc({ method: "PerformTransaction", id: 5, params: { id: "payme-tx-1" } }, auth)) as {
      result: Record<string, unknown>;
    };
    assert.equal(performed.result.state, 2);
    const repeated = (await handlePaymeRpc({ method: "PerformTransaction", id: 6, params: { id: "payme-tx-1" } }, auth)) as {
      result: Record<string, unknown>;
    };
    assert.equal(repeated.result.state, 2);

    const saved = await getOrder(order.id);
    assert.equal(saved?.status, "active");
    const license = await getLicense(saved!.licenseId!);
    assert.equal(license?.provider, "payme");
    assert.equal(license?.planId, "start");
    assert.ok(paymeCheckoutUrl(order.id, order.amountUzs, "https://landing.test/tolov/kutilmoqda?order=1").includes("checkout.paycom.uz"));

    const cancelled = (await handlePaymeRpc(
      { method: "CancelTransaction", id: 7, params: { id: "payme-tx-1", reason: 5 } },
      auth,
    )) as { result: Record<string, unknown> };
    assert.equal(cancelled.result.state, -2);
    assert.equal((await getLicense(saved!.licenseId!))?.status, "cancelled");
  });

  test("Click prepare and complete verify the signature and open the license", async () => {
    process.env.CLICK_MERCHANT_ID = "10";
    process.env.CLICK_SERVICE_ID = "20";
    process.env.CLICK_SECRET_KEY = "click-secret";
    const order = await createOrder({
      planId: "klinika",
      name: "Jasur Tursunov",
      phone: "998933445566",
      email: "jasur@nur.uz",
      provider: "click",
    });
    const bad = await handleClick({ ...clickBody(0, { merchant_trans_id: order.id, amount: "3490000" }), sign_string: "deadbeef" });
    assert.equal(bad.error, -1);

    const prepared = await handleClick(clickBody(0, { merchant_trans_id: order.id, amount: "3490000.00" }));
    assert.equal(prepared.error, 0);
    const prepareId = "merchant_prepare_id" in prepared ? prepared.merchant_prepare_id : null;
    assert.equal(typeof prepareId, "number");

    const again = await handleClick(clickBody(0, { merchant_trans_id: order.id, amount: "3490000.00" }));
    assert.equal("merchant_prepare_id" in again ? again.merchant_prepare_id : null, prepareId);

    const wrong = await handleClick(
      clickBody(1, {
        merchant_trans_id: order.id,
        merchant_prepare_id: String(prepareId),
        amount: "1000",
      }),
    );
    assert.equal(wrong.error, -2);

    const done = await handleClick(
      clickBody(1, {
        merchant_trans_id: order.id,
        merchant_prepare_id: String(prepareId),
        amount: "3490000.00",
      }),
    );
    assert.equal(done.error, 0);
    const saved = await getOrder(order.id);
    assert.equal(saved?.status, "active");
    assert.equal((await getLicense(saved!.licenseId!))?.provider, "click");

    const replay = await handleClick(
      clickBody(1, {
        merchant_trans_id: order.id,
        merchant_prepare_id: String(prepareId),
        amount: "3490000.00",
      }),
    );
    assert.equal(replay.error, 0);
  });
});
