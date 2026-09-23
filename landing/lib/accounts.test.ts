import assert from "node:assert/strict";
import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { beforeEach, describe, test } from "node:test";
import { loginAccount, parseRegistration, redeemHandoff, registerAccount } from "./accounts";
import { isPasswordHash, verifyPassword } from "./password";
import { resetStoreForTests } from "./store";
import { buildCrmRows } from "./tenants";

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

  test("requires a clinic or a doctor, and a phone or email", () => {
    assert.throws(() => parseRegistration({ name: "Akmal Karimov", password: "parol1234", phone: "901112233" }), /Klinika nomi yoki shifokor/);
    assert.throws(() => parseRegistration({ name: "Akmal Karimov", password: "parol1234", clinic: "Smile" }), /Telefon yoki email/);
    assert.throws(() => parseRegistration({ name: "Akmal Karimov", password: "short", clinic: "Smile", email: "a@b.uz" }), /8 ta/);
  });

  test("register hashes the password, opens 14 days, and login issues a one-time handoff", async () => {
    const created = await registerAccount(
      {
        name: "Dilnoza Rahimova",
        doctor: "Akmal Karimov",
        clinic: "Smile Dental",
        email: "dilnoza@smile.uz",
        phone: "901112233",
        password: "parol1234",
      },
      request(),
    );
    assert.equal(created.message, "14 kunlik bepul sinov ochildi");
    assert.equal(created.clinicName, "Smile Dental");
    assert.equal(created.username, "dilnoza");
    assert.equal(created.trialDays, 14);
    assert.match(created.handoffUrl, /\/login#handoff=/);
    const ends = Date.parse(created.expiresAt) - Date.now();
    assert.ok(ends > 13 * 24 * 60 * 60 * 1000);
    assert.ok(ends < 15 * 24 * 60 * 60 * 1000);

    const { listSubscriptions } = await import("./tenants");
    const [saved] = await listSubscriptions();
    assert.equal(isPasswordHash(saved.temporaryPassword), true);
    assert.equal(saved.temporaryPassword.includes("parol1234"), false);
    assert.equal(await verifyPassword("parol1234", saved.temporaryPassword), true);
    assert.equal(saved.subscriptionStatus, "trialing");
    assert.equal(saved.ownerName, "Dilnoza Rahimova");
    assert.equal(saved.doctorName, "Akmal Karimov");
    const { user, clinic } = buildCrmRows(saved);
    assert.equal(user.password, saved.temporaryPassword);
    assert.equal(user.username, "dilnoza");
    assert.equal(user.name, "Dilnoza Rahimova");
    assert.equal(clinic.monthly_fee, 0);
    assert.equal(clinic.status, "Active");

    const logged = await loginAccount("dilnoza@smile.uz", "parol1234", request());
    assert.equal(logged.clinicId, created.clinicId);
    const byPhone = await loginAccount("+998901112233", "parol1234", request());
    assert.equal(byPhone.username, "dilnoza");

    const token = decodeURIComponent(logged.handoffUrl.split("handoff=")[1]?.split("&")[0] ?? "");
    const row = redeemHandoff(token);
    assert.equal(row?.clinicId, created.clinicId);
    assert.equal(row?.username, "dilnoza");
    assert.equal(redeemHandoff(`${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`), null);

    await assert.rejects(() => loginAccount("dilnoza@smile.uz", "boshqa-parol", request()), /noto'g'ri/);
    await assert.rejects(
      () =>
        registerAccount(
          { name: "Dilnoza Rahimova", clinic: "Smile Dental", email: "dilnoza@smile.uz", password: "parol1234" },
          request(),
        ),
      /allaqachon/,
    );
  });

  test("email-only registration still creates a login", async () => {
    const created = await registerAccount(
      { name: "Jasur Aliyev", doctor: "Jasur Aliyev", email: "jasur@nur.uz", password: "sinovparol" },
      request(),
    );
    assert.equal(created.clinicName, "Jasur Aliyev klinikasi");
    assert.equal(created.username, "jasur");
    const logged = await loginAccount("jasur", "sinovparol", request());
    assert.equal(logged.clinicId, created.clinicId);
  });
});
