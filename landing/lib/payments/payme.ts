import { createHash, timingSafeEqual } from "crypto";
import { activateInDb, BillingError, revokeLicenseInDb } from "../billing";
import { paymeConfigured } from "./config";
import { paymeTimedOut, readStore, updateStore, type Database, type PaymeTransaction } from "../store";

const PAYME_TIMEOUT_REASON = 4;

type Rpc = {
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
};

function message(uz: string, ru: string, en: string) {
  return { uz, ru, en };
}

function error(id: Rpc["id"], code: number, msg: { uz: string; ru: string; en: string }, data?: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message: msg, data } };
}

function ok(id: Rpc["id"], result: Record<string, unknown>) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function authorized(header: string | null) {
  const secret = process.env.PAYME_SECRET_KEY?.trim() ?? "";
  const login = process.env.PAYME_LOGIN?.trim() || "Paycom";
  if (!secret || !header?.startsWith("Basic ")) return false;
  let decoded = "";
  try {
    decoded = Buffer.from(header.slice(6).trim(), "base64").toString("utf8");
  } catch {
    return false;
  }
  const expected = `${login}:${secret}`;
  const left = createHash("sha256").update(decoded).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

function accountOrderId(params: Record<string, unknown> | undefined) {
  const account = params?.account;
  if (!account || typeof account !== "object") return "";
  const orderId = (account as Record<string, unknown>).order_id;
  return typeof orderId === "string" ? orderId : "";
}

function txnResult(txn: PaymeTransaction, extra: Record<string, unknown> = {}) {
  return {
    transaction: txn.merchantTxId,
    state: txn.state,
    create_time: txn.createTime,
    perform_time: txn.performTime,
    cancel_time: txn.cancelTime,
    reason: txn.reason,
    ...extra,
  };
}

export function paymeCheckoutUrl(orderId: string, amountUzs: number, returnUrl: string) {
  const merchant = process.env.PAYME_MERCHANT_ID!.trim();
  const amountTiyin = amountUzs * 100;
  const params = `m=${merchant};ac.order_id=${orderId};a=${amountTiyin};l=uz;c=${returnUrl}`;
  return `https://checkout.paycom.uz/${Buffer.from(params).toString("base64")}`;
}

export async function handlePaymeRpc(body: unknown, authorization: string | null) {
  const rpc = (body ?? {}) as Rpc;
  const id = rpc.id ?? null;
  if (!rpc || typeof body !== "object") {
    return error(id, -32700, message("JSON xato", "Ошибка JSON", "Parse error"));
  }
  if (!paymeConfigured() || !authorized(authorization)) {
    return error(id, -32504, message("Avtorizatsiya xatosi", "Ошибка авторизации", "Authorization error"));
  }

  const params = rpc.params ?? {};
  try {
    switch (rpc.method) {
      case "CheckPerformTransaction":
        return await checkPerform(id, params);
      case "CreateTransaction":
        return await createTransaction(id, params);
      case "PerformTransaction":
        return await performTransaction(id, params);
      case "CancelTransaction":
        return await cancelTransaction(id, params);
      case "CheckTransaction":
        return await checkTransaction(id, params);
      case "GetStatement":
        return await getStatement(id, params);
      default:
        return error(id, -32601, message("Metod topilmadi", "Метод не найден", "Method not found"));
    }
  } catch (caught) {
    if (caught instanceof BillingError && caught.code === "already_paid") {
      return error(id, -31060, message("To'lov amalga oshirilgan", "Оплата выполнена", "Already paid"));
    }
    console.error("Payme handler failed", caught);
    return error(id, -32400, message("Tizim xatosi", "Системная ошибка", "System error"));
  }
}

async function checkPerform(id: Rpc["id"], params: Record<string, unknown>) {
  const orderId = accountOrderId(params);
  const amount = Number(params.amount);
  const gate = await orderGate(orderId, amount);
  if (gate.error) return error(id, gate.error.code, gate.error.message, "order_id");
  return ok(id, { allow: true });
}

async function createTransaction(id: Rpc["id"], params: Record<string, unknown>) {
  const paymeId = String(params.id ?? "");
  const time = Number(params.time);
  const amount = Number(params.amount);
  const orderId = accountOrderId(params);
  if (!paymeId || !Number.isFinite(time)) {
    return error(id, -31008, message("Operatsiyani bajarib bo'lmaydi", "Невозможно выполнить операцию", "Can't perform operation"));
  }

  return updateStore((db) => {
    const existing = db.payme[paymeId];
    if (existing) {
      if (existing.amountTiyin !== amount || existing.orderId !== orderId) {
        return error(id, -31008, message("Operatsiyani bajarib bo'lmaydi", "Невозможно выполнить операцию", "Can't perform operation"));
      }
      return ok(id, {
        create_time: existing.createTime,
        transaction: existing.merchantTxId,
        state: existing.state,
      });
    }

    const gate = orderGateSync(db, orderId, amount);
    if (gate) return error(id, gate.code, gate.message, "order_id");

    const pending = Object.values(db.payme).find((txn) => txn.orderId === orderId && txn.state === 1);
    if (pending) {
      if (paymeTimedOut(pending)) {
        pending.state = -1;
        pending.cancelTime = Date.now();
        pending.reason = PAYME_TIMEOUT_REASON;
      } else {
        return error(id, -31008, message("Kutilayotgan to'lov bor", "Есть ожидающая транзакция", "Pending transaction exists"));
      }
    }

    const txn: PaymeTransaction = {
      id: paymeId,
      merchantTxId: `mtx_${paymeId.slice(0, 12)}`,
      orderId,
      amountTiyin: amount,
      state: 1,
      createTime: time,
      performTime: 0,
      cancelTime: 0,
      reason: null,
    };
    db.payme[paymeId] = txn;
    db.orders[orderId].provider = "payme";
    return ok(id, { create_time: txn.createTime, transaction: txn.merchantTxId, state: txn.state });
  });
}

async function performTransaction(id: Rpc["id"], params: Record<string, unknown>) {
  const paymeId = String(params.id ?? "");
  try {
    return await updateStore((db) => {
      const txn = db.payme[paymeId];
      if (!txn) return error(id, -31003, message("Tranzaksiya topilmadi", "Транзакция не найдена", "Transaction not found"));
      if (txn.state === 2) return ok(id, { transaction: txn.merchantTxId, perform_time: txn.performTime, state: 2 });
      if (txn.state < 0) {
        return error(id, -31008, message("Operatsiyani bajarib bo'lmaydi", "Невозможно выполнить операцию", "Can't perform operation"));
      }
      if (paymeTimedOut(txn)) {
        txn.state = -1;
        txn.cancelTime = Date.now();
        txn.reason = PAYME_TIMEOUT_REASON;
        return error(id, -31008, message("To'lov muddati o'tgan", "Время транзакции истекло", "Transaction timed out"));
      }
      activateInDb(db, { orderId: txn.orderId, provider: "payme", providerTransactionId: paymeId });
      txn.state = 2;
      txn.performTime = Date.now();
      return ok(id, { transaction: txn.merchantTxId, perform_time: txn.performTime, state: 2 });
    });
  } catch (caught) {
    if (caught instanceof BillingError && caught.code === "already_paid") {
      return error(id, -31060, message("To'lov amalga oshirilgan", "Оплата выполнена", "Already paid"));
    }
    throw caught;
  }
}

async function cancelTransaction(id: Rpc["id"], params: Record<string, unknown>) {
  const paymeId = String(params.id ?? "");
  const reason = Number(params.reason ?? 10);
  return updateStore((db) => {
    const txn = db.payme[paymeId];
    if (!txn) return error(id, -31003, message("Tranzaksiya topilmadi", "Транзакция не найдена", "Transaction not found"));
    if (txn.state < 0) return ok(id, { transaction: txn.merchantTxId, cancel_time: txn.cancelTime, state: txn.state });
    if (txn.state === 2) revokeLicenseInDb(db, txn.orderId);
    txn.state = txn.state === 2 ? -2 : -1;
    txn.reason = Number.isFinite(reason) ? reason : 10;
    txn.cancelTime = Date.now();
    return ok(id, { transaction: txn.merchantTxId, cancel_time: txn.cancelTime, state: txn.state });
  });
}

async function checkTransaction(id: Rpc["id"], params: Record<string, unknown>) {
  const paymeId = String(params.id ?? "");
  const db = await readStore();
  const txn = db.payme[paymeId];
  if (!txn) return error(id, -31003, message("Tranzaksiya topilmadi", "Транзакция не найдена", "Transaction not found"));
  return ok(id, txnResult(txn));
}

async function getStatement(id: Rpc["id"], params: Record<string, unknown>) {
  const from = Number(params.from ?? 0);
  const to = Number(params.to ?? Date.now());
  const db = await readStore();
  const transactions = Object.values(db.payme)
    .filter((txn) => txn.createTime >= from && txn.createTime <= to)
    .map((txn) => ({
      id: txn.id,
      time: txn.createTime,
      amount: txn.amountTiyin,
      account: { order_id: txn.orderId },
      ...txnResult(txn),
    }));
  return ok(id, { transactions });
}

async function orderGate(orderId: string, amountTiyin: number) {
  const db = await readStore();
  return { error: orderGateSync(db, orderId, amountTiyin) };
}

function orderGateSync(db: Database, orderId: string, amountTiyin: number) {
  const order = db.orders[orderId];
  if (!order) {
    return { code: -31050, message: message("Buyurtma topilmadi", "Заказ не найден", "Order not found") };
  }
  if (order.amountUzs * 100 !== amountTiyin) {
    return { code: -31001, message: message("Noto'g'ri summa", "Недопустимая сумма", "Invalid amount") };
  }
  if (order.status === "active") {
    return { code: -31060, message: message("To'lov amalga oshirilgan", "Оплата выполнена", "Already paid") };
  }
  if (order.status === "cancelled") {
    return { code: -31008, message: message("Buyurtma bekor qilingan", "Заказ отменен", "Order cancelled") };
  }
  return null;
}
