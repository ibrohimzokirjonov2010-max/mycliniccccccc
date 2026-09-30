import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const desktop = readFileSync(join(root, 'src/pages/Payments.jsx'), 'utf8');
assert(!desktop.includes('Hozirgi qarz'), 'desktop payments table must not render Hozirgi qarz');
assert(desktop.includes("✓ To'liq"), 'full-payment mark stays');
assert(desktop.includes('formatCurrency(debtVal)'), 'main remainder stays');
assert(desktop.includes('unionPayments(balancePayments, payments)'), 'balance union stays');
assert(desktop.includes("To'langan sana va vaqt"), 'desktop detail shows the payment time');
assert(desktop.includes('paymentStamp(sp)'), 'desktop time comes from the payment');

const mobile = readFileSync(join(root, 'src/pages/MobilePaymentsV2.jsx'), 'utf8');
const cardStart = mobile.indexOf('Row 3: date');
const cardEnd = mobile.indexOf('SkeletonCard');
assert(cardStart > 0 && cardEnd > cardStart, 'phone payment card markup is present');
const card = mobile.slice(cardStart, cardEnd);
assert(!card.includes('Hozirgi qarz'), 'phone payment cards have no Hozirgi qarz sub-line');
assert(card.includes('To‘lovdan keyin qoldiq') || card.includes("To'lovdan keyin qoldiq"), 'phone cards keep the remainder line');
assert(card.includes("To\\'liq") || card.includes("To'liq"), 'phone cards keep the full-payment mark');
assert(!mobile.includes('Hozirgi qarz'), 'phone detail no longer shows current debt');
assert(mobile.includes("To'langan sana va vaqt"), 'phone detail shows the payment time');
assert(mobile.includes('paymentStamp(sp)'), 'phone time comes from the payment');

console.log('payment remainder line ok');
