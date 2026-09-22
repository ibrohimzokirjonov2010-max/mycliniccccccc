export function paymeConfigured() {
  return Boolean(process.env.PAYME_MERCHANT_ID?.trim() && process.env.PAYME_SECRET_KEY?.trim());
}

export function clickConfigured() {
  return Boolean(
    process.env.CLICK_MERCHANT_ID?.trim() &&
      process.env.CLICK_SERVICE_ID?.trim() &&
      process.env.CLICK_SECRET_KEY?.trim(),
  );
}

export function providerLive(provider: "payme" | "click") {
  return provider === "payme" ? paymeConfigured() : clickConfigured();
}

export function demoPayments() {
  return !paymeConfigured() && !clickConfigured();
}
