import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const css = read('src/components/payments/paymentAddModal.css');
const indexCss = read('src/index.css');
const mobile = read('src/pages/MobilePaymentsV2.jsx');
const desktop = read('src/pages/Payments.jsx');
const alerter = read('src/components/notifications/ImplantAlerter.jsx');
const app = read('src/App.jsx');
const uz = JSON.parse(read('src/i18n/translations/uz.json'));
const ru = JSON.parse(read('src/i18n/translations/ru.json'));
const en = JSON.parse(read('src/i18n/translations/en.json'));

assert(css.includes('payment-add-teal-v1-0d9488'), 'css marker');
assert(css.includes('#0d9488'), 'teal accent');
assert(!css.includes('indigo') && !css.includes('purple'), 'no purple in payment css');
assert(css.includes('.payment-add-footer'), 'sticky footer class');
assert(css.includes('.payment-add-chips'), 'chips class');
assert(css.includes('min-height: 44px'), '44px footer actions');
assert(css.includes('@media (max-width: 767px)'), '390px mobile rules');
assert(css.includes('container-type: inline-size'), 'container query for equal footer');
assert(css.includes('@container payment-add'), 'named container footer');

assert(indexCss.includes('[data-sonner-toaster]'), 'toaster z-index park');
assert(indexCss.includes('z-index: 40 !important'), 'toasts behind dialog overlay');
assert(indexCss.includes('body:has([data-radix-dialog-content])'), 'park toasts when dialog open');

assert(mobile.includes('data-payment-add={PAYMENT_ADD_MARKER}'), 'mobile marker');
assert(mobile.includes('payment-add-footer'), 'mobile sticky footer');
assert(mobile.includes('data-payment-quick-chips'), 'mobile chips');
assert(!mobile.includes('alert(t(\'common.error\'))'), 'no alert() for amount');
assert(mobile.includes('setFormError'), 'inline form errors');
assert(mobile.includes('toast.dismiss(\'implant-incomplete-notification\')'), 'dismiss implant toast');
assert(!/bg-slate-950 hover:bg-slate-900/.test(mobile.slice(mobile.indexOf('Add Payment Modal'))), 'no black pay CTA');

assert(desktop.includes('data-payment-add={PAYMENT_ADD_MARKER}'), 'desktop marker');
assert(desktop.includes('payment-add-footer'), 'desktop sticky footer');
assert(desktop.includes('data-payment-quick-chips'), 'desktop chips');
assert(desktop.includes('setFormError(t(\'payments.formErrorFill\'))'), 'desktop inline fill error');

assert(alerter.includes('isBlockingModalOpen'), 'alerter skips open modals');
assert(app.includes('zIndex: 90'), 'toaster z-index 90');

for (const [lang, dict] of [['uz', uz], ['ru', ru], ['en', en]]) {
  assert(dict.payments.submitPay, `${lang} submitPay`);
  assert(dict.payments.formErrorFill, `${lang} formErrorFill`);
  assert(dict.payments.formErrorNoDebt, `${lang} formErrorNoDebt`);
  assert(dict.payments.formErrorOverDebt.includes('{amount}'), `${lang} overDebt interpolation`);
}

console.log('assert-payment-add-modal: ok');
