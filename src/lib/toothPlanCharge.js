/**
 * Group treatments on the tooth chart.
 * A braces system or one bridge is a single fee. Fillings, implants and
 * "the same treatment" are priced per selected tooth.
 */
export function toothGroupBilling(kind) {
  if (kind === 'breket' || kind === 'bridge') return 'once';
  return 'each';
}

export function toothGroupCharge(unitPrice, toothCount, billing = 'each') {
  const price = Math.max(0, Number(unitPrice) || 0);
  const count = Math.max(0, Number(toothCount) || 0);
  if (billing === 'once') {
    return {
      billing: 'once',
      total: count > 0 ? price : 0,
      linePrices: Array.from({ length: count }, (_, index) => (index === 0 ? price : 0)),
    };
  }
  return {
    billing: 'each',
    total: price * count,
    linePrices: Array.from({ length: count }, () => price),
  };
}
