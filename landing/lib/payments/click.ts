import { createHash, timingSafeEqual } from "crypto";
import { activateInDb, BillingError } from "../billing";
import { clickConfigured } from "./config";
import { updateStore } from "../store";

export const ClickError = {
  Success: 0,
  SignFailed: -1,
  InvalidAmount: -2,
  ActionNotFound: -3,
  AlreadyPaid: -4,
  UserNotFound: -5,
  TransactionNotFound: -6,
  FailedToUpdate: -7,
  BadRequest: -8,
  TransactionCanceled: -9,
} as const;

function clickResponse(input: {
  clickTransId: string;
  merchantTransId: string;
  prepareId?: number | null;
  error: number;
  note: string;
  confirm?: boolean;
}) {
  return {
    click_trans_id: input.clickTransId,
    merchant_trans_id: input.merchantTransId,
    ...(input.confirm ? { merchant_confirm_id: input.prepareId ?? null } : { merchant_prepare_id: input.prepareId ?? null }),
    error: input.error,
    error_note: input.note,
  };
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a.toLowerCase());
  const right = Buffer.from(b.toLowerCase());
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function expectedSign(params: Record<string, string>, action: number) {
  const secret = process.env.CLICK_SECRET_KEY?.trim() ?? "";
  const parts = [
    params.click_trans_id ?? "",
    params.service_id ?? "",
    secret,
    params.merchant_trans_id ?? "",
  ];
  if (action === 1) parts.push(params.merchant_prepare_id ?? "");
  parts.push(params.amount ?? "", String(action), params.sign_time ?? "");
  return createHash("md5").update(parts.join("")).digest("hex");
}

function amountsMatch(raw: string, amountUzs: number) {
  const paid = Math.round(Number.parseFloat(raw) * 100);
  return Number.isFinite(paid) && paid === amountUzs * 100;
}

export function clickCheckoutUrl(orderId: string, amountUzs: number, returnUrl: string) {
  const serviceId = process.env.CLICK_SERVICE_ID!.trim();
  const merchantId = process.env.CLICK_MERCHANT_ID!.trim();
  const url = new URL("https://my.click.uz/services/pay");
  url.searchParams.set("service_id", serviceId);
  url.searchParams.set("merchant_id", merchantId);
  url.searchParams.set("amount", String(amountUzs));
  url.searchParams.set("transaction_param", orderId);
  url.searchParams.set("return_url", returnUrl);
  return url.toString();
}

export async function handleClick(input: Record<string, string>) {
  const action = Number(input.action);
  const clickTransId = input.click_trans_id ?? "";
  const merchantTransId = input.merchant_trans_id ?? "";
  if (!clickConfigured()) {
    return clickResponse({
      clickTransId,
      merchantTransId,
      error: ClickError.BadRequest,
      note: "Click merchant keys are not configured",
    });
  }
  if (action !== 0 && action !== 1) {
    return clickResponse({
      clickTransId,
      merchantTransId,
      error: ClickError.ActionNotFound,
      note: "Action not found",
    });
  }
  const sign = input.sign_string ?? "";
  if (!sign || !safeEqual(sign, expectedSign(input, action))) {
    return clickResponse({
      clickTransId,
      merchantTransId,
      error: ClickError.SignFailed,
      note: "SIGN CHECK FAILED",
    });
  }
  if (input.service_id !== process.env.CLICK_SERVICE_ID?.trim()) {
    return clickResponse({
      clickTransId,
      merchantTransId,
      error: ClickError.BadRequest,
      note: "Incorrect service_id",
    });
  }
  if (!merchantTransId) {
    return clickResponse({
      clickTransId,
      merchantTransId,
      error: ClickError.BadRequest,
      note: "merchant_trans_id is required",
    });
  }

  try {
    if (action === 0) return await prepare(input);
    return await complete(input);
  } catch (caught) {
    if (caught instanceof BillingError && caught.code === "already_paid") {
      return clickResponse({
        clickTransId,
        merchantTransId,
        error: ClickError.AlreadyPaid,
        note: "Already paid",
        confirm: action === 1,
      });
    }
    console.error("Click handler failed", caught);
    return clickResponse({
      clickTransId,
      merchantTransId,
      error: ClickError.FailedToUpdate,
      note: "Failed to update order",
      confirm: action === 1,
    });
  }
}

async function prepare(input: Record<string, string>) {
  const clickTransId = input.click_trans_id;
  const merchantTransId = input.merchant_trans_id;
  return updateStore((db) => {
    const order = db.orders[merchantTransId];
    if (!order) {
      return clickResponse({
        clickTransId,
        merchantTransId,
        error: ClickError.UserNotFound,
        note: "Order not found",
      });
    }
    if (!amountsMatch(input.amount ?? "", order.amountUzs)) {
      return clickResponse({
        clickTransId,
        merchantTransId,
        error: ClickError.InvalidAmount,
        note: "Incorrect amount",
      });
    }
    if (order.status === "active" && order.clickTransId && order.clickTransId !== clickTransId) {
      return clickResponse({
        clickTransId,
        merchantTransId,
        prepareId: order.clickPrepareId,
        error: ClickError.AlreadyPaid,
        note: "Already paid",
      });
    }
    if (order.status === "cancelled") {
      return clickResponse({
        clickTransId,
        merchantTransId,
        error: ClickError.TransactionCanceled,
        note: "Order cancelled",
      });
    }
    if (order.clickTransId === clickTransId && order.clickPrepareId) {
      return clickResponse({
        clickTransId,
        merchantTransId,
        prepareId: order.clickPrepareId,
        error: ClickError.Success,
        note: "Success",
      });
    }
    if (order.status === "active" && order.clickTransId === clickTransId) {
      return clickResponse({
        clickTransId,
        merchantTransId,
        prepareId: order.clickPrepareId,
        error: ClickError.AlreadyPaid,
        note: "Already paid",
      });
    }
    db.nextPrepareId += 1;
    order.clickTransId = clickTransId;
    order.clickPrepareId = db.nextPrepareId;
    order.provider = "click";
    return clickResponse({
      clickTransId,
      merchantTransId,
      prepareId: order.clickPrepareId,
      error: ClickError.Success,
      note: "Success",
    });
  });
}

async function complete(input: Record<string, string>) {
  const clickTransId = input.click_trans_id;
  const merchantTransId = input.merchant_trans_id;
  const prepareId = Number(input.merchant_prepare_id);
  const clickError = Number(input.error ?? 0);

  return updateStore((db) => {
    const order = db.orders[merchantTransId];
    if (!order || order.clickPrepareId !== prepareId || order.clickTransId !== clickTransId) {
      return clickResponse({
        clickTransId,
        merchantTransId,
        prepareId,
        error: ClickError.TransactionNotFound,
        note: "Transaction not found",
        confirm: true,
      });
    }
    if (order.status === "active" && order.providerTransactionId === clickTransId) {
      return clickResponse({
        clickTransId,
        merchantTransId,
        prepareId,
        error: ClickError.Success,
        note: "Success",
        confirm: true,
      });
    }
    if (order.status === "cancelled") {
      return clickResponse({
        clickTransId,
        merchantTransId,
        prepareId,
        error: ClickError.TransactionCanceled,
        note: "Transaction cancelled",
        confirm: true,
      });
    }
    if (!amountsMatch(input.amount ?? "", order.amountUzs)) {
      return clickResponse({
        clickTransId,
        merchantTransId,
        prepareId,
        error: ClickError.InvalidAmount,
        note: "Incorrect amount",
        confirm: true,
      });
    }
    if (Number.isFinite(clickError) && clickError !== 0) {
      order.status = "cancelled";
      return clickResponse({
        clickTransId,
        merchantTransId,
        prepareId,
        error: ClickError.Success,
        note: "Cancelled",
        confirm: true,
      });
    }
    activateInDb(db, {
      orderId: merchantTransId,
      provider: "click",
      providerTransactionId: clickTransId,
    });
    return clickResponse({
      clickTransId,
      merchantTransId,
      prepareId,
      error: ClickError.Success,
      note: "Success",
      confirm: true,
    });
  });
}
