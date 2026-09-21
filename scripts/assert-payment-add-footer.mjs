import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'src/components/payments/paymentAddModal.css'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Hostile fixture: Radix-like transform + overflow + long form inside 390×844.
const inner = `<!DOCTYPE html>
<html lang="uz">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=390, initial-scale=1" />
<style>${css}
html, body { margin: 0; height: 100%; background: #64748b; }
</style>
</head>
<body>
  <div data-radix-dialog-overlay style="position:fixed;inset:0;background:rgba(15,23,42,.4);z-index:100"></div>
  <div
    role="dialog"
    data-radix-dialog-content
    data-state="open"
    data-payment-add="payment-add-teal-v3-footer-pin"
    class="payment-add-dialog"
    style="
      position:fixed;
      left:50%;
      top:50%;
      transform:translate(-50%,-50%);
      z-index:100;
      display:flex;
      flex-direction:column;
      gap:0;
      padding:0;
      overflow:hidden;
      width:95vw;
      max-width:36rem;
    "
  >
    <div class="payment-add-header">
      <div class="payment-add-header-titles">
        <h2 class="payment-add-header-title">Yangi to'lov qo'shish</h2>
        <p class="payment-add-header-sub">Mablag' qabul qilish</p>
      </div>
    </div>
    <div class="payment-add-body" id="body">
      <label class="payment-add-label">Bemor</label>
      <input style="width:100%;height:44px;border-radius:12px;border:1px solid #e2e8f0;box-sizing:border-box;padding:0 12px" />
      <div class="payment-add-chips" data-payment-quick-chips="true">
        <button class="payment-add-chip" type="button">+50 000</button>
        <button class="payment-add-chip" type="button">+100 000</button>
        <button class="payment-add-chip" type="button">+500 000</button>
        <button class="payment-add-chip" type="button">+1 000 000</button>
        <button class="payment-add-chip is-clear" type="button">Tozalash</button>
      </div>
      <div class="payment-add-methods" style="margin-top:16px">
        <button class="payment-add-method is-active" type="button">Naqd</button>
        <button class="payment-add-method" type="button">Karta</button>
        <button class="payment-add-method" type="button">Click</button>
        <button class="payment-add-method" type="button">Payme</button>
      </div>
      <div style="height:1600px;color:#94a3b8;padding-top:24px">Long form spacer — date, notes, extra fields</div>
    </div>
    <div class="payment-add-footer" data-payment-footer="true">
      <button class="payment-add-footer-cancel" type="button">Bekor qilish</button>
      <button class="payment-add-footer-cta" type="button">To'lash</button>
    </div>
  </div>
  <pre id="out"></pre>
  <script>
    function box(sel) {
      const el = document.querySelector(sel);
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        top: r.top, bottom: r.bottom, height: r.height, width: r.width,
        position: cs.position, transform: cs.transform
      };
    }
    function measure() {
      const dialog = box('[data-radix-dialog-content]');
      const fr = box('[data-payment-footer]');
      const cancel = box('.payment-add-footer-cancel');
      const cta = box('.payment-add-footer-cta');
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      return {
        footer: fr,
        cancel,
        cta,
        dialog,
        bodyScroll: document.getElementById('body').scrollTop,
        innerHeight: vh,
        innerWidth: vw,
        footerVisible: fr.top >= 0 && fr.bottom <= vh + 1 && fr.height > 40,
        cancelVisible: cancel.top >= 0 && cancel.bottom <= vh + 1 && cancel.height >= 40,
        ctaVisible: cta.top >= 0 && cta.bottom <= vh + 1 && cta.height >= 40,
        dialogFits: dialog.top >= -1 && dialog.bottom <= vh + 1
      };
    }
    const before = measure();
    document.getElementById('body').scrollTop = 1400;
    const after = measure();
    document.getElementById('out').textContent = JSON.stringify({ before, after });
  </script>
</body>
</html>`;

const srcdoc = inner
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;');

const outer = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0">
<iframe id="phone" width="390" height="844" style="width:390px;height:844px;border:0" srcdoc="${srcdoc}"></iframe>
<pre id="parent-out"></pre>
<script>
  const f = document.getElementById('phone');
  f.addEventListener('load', () => {
    const raw = f.contentDocument.getElementById('out').textContent;
    document.getElementById('parent-out').textContent = raw;
  });
</script>
</body>
</html>`;

const htmlPath = '/tmp/payment-add-footer-390.html';
writeFileSync(htmlPath, outer);

const chrome = spawnSync(
  'google-chrome-stable',
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--virtual-time-budget=5000',
    `--screenshot=/tmp/payment-add-footer-390.png`,
    '--dump-dom',
    `file://${htmlPath}`,
  ],
  { encoding: 'utf8', timeout: 25000, maxBuffer: 12 * 1024 * 1024 }
);

if (chrome.status !== 0) {
  throw new Error(`chrome failed ${chrome.status}: ${chrome.stderr}`);
}

const match = chrome.stdout.match(/<pre id="parent-out">([^<]*)<\/pre>/);
assert(match && match[1].trim(), `metrics missing: ${chrome.stdout.slice(-800)}`);
const metrics = JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));

assert(metrics.before.innerWidth === 390, `iframe width ${metrics.before.innerWidth}`);
assert(metrics.before.innerHeight === 844, `iframe height ${metrics.before.innerHeight}`);
assert(metrics.before.dialogFits, `dialog overflows viewport before scroll ${JSON.stringify(metrics.before.dialog)}`);
assert(metrics.before.footerVisible, `footer hidden before scroll ${JSON.stringify(metrics.before.footer)}`);
assert(metrics.before.cancelVisible, `cancel hidden before scroll ${JSON.stringify(metrics.before.cancel)}`);
assert(metrics.before.ctaVisible, `cta hidden before scroll ${JSON.stringify(metrics.before.cta)}`);
assert(metrics.before.cancel.bottom <= 844 + 1, `cancel below fold before scroll ${metrics.before.cancel.bottom}`);
assert(metrics.after.bodyScroll >= 800, `body did not scroll ${metrics.after.bodyScroll}`);
assert(metrics.after.dialogFits, `dialog overflows viewport after scroll ${JSON.stringify(metrics.after.dialog)}`);
assert(metrics.after.footerVisible, `footer hidden after long-form scroll ${JSON.stringify(metrics.after.footer)}`);
assert(metrics.after.cancelVisible, `cancel hidden after scroll ${JSON.stringify(metrics.after.cancel)}`);
assert(metrics.after.ctaVisible, `cta hidden after scroll ${JSON.stringify(metrics.after.cta)}`);
assert(
  Math.abs(metrics.after.footer.top - metrics.before.footer.top) < 2,
  `footer moved with scroll ${metrics.before.footer.top} -> ${metrics.after.footer.top}`
);
assert(
  metrics.after.footer.position === 'absolute' || metrics.after.footer.position === 'fixed' || metrics.after.footer.position === 'sticky',
  `footer not pinned ${metrics.after.footer.position}`
);
assert(metrics.after.dialog.transform === 'none', `dialog still transformed ${metrics.after.dialog.transform}`);

console.log('assert-payment-add-footer: ok', {
  before: metrics.before.footer,
  after: metrics.after.footer,
  scrolled: metrics.after.bodyScroll,
  dialog: metrics.before.dialog,
});
