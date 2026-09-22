import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'src/components/payments/paymentAddModal.css'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function dialogMarkup({ vw, longForm }) {
  return `<!DOCTYPE html>
<html lang="uz">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=${vw}, initial-scale=1" />
<style>${css}
html, body { margin: 0; min-height: 2000px; background: #64748b; }
</style>
</head>
<body>
  <div data-radix-dialog-overlay style="position:fixed;inset:0;background:rgba(15,23,42,.4);z-index:100"></div>
  <div
    role="dialog"
    data-radix-dialog-content
    data-state="open"
    data-payment-add="payment-add-teal-v5-single-center"
    class="payment-add-dialog"
    style="
      position:fixed;
      left:50%;
      top:50%;
      transform:translate(-50%,-50%);
      translate:-50% -50%;
      z-index:100;
      display:flex;
      flex-direction:column;
      gap:0;
      padding:0;
      overflow:hidden;
      width:min(42rem, 95vw);
      max-width:42rem;
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
      ${longForm ? '<div style="height:1600px;color:#94a3b8;padding-top:24px">Long form spacer</div>' : ''}
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
        top: r.top, bottom: r.bottom, left: r.left, right: r.right,
        height: r.height, width: r.width,
        position: cs.position, transform: cs.transform,
        cssTranslate: cs.translate,
        centerX: (r.left + r.right) / 2,
        centerY: (r.top + r.bottom) / 2
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
        pageScroll: window.scrollY,
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
    window.scrollTo(0, 420);
    const after = measure();
    document.getElementById('out').textContent = JSON.stringify({ before, after });
  </script>
</body>
</html>`;
}

function runIframe({ width, height, longForm, screenshot }) {
  const inner = dialogMarkup({ vw: width, longForm });
  const srcdoc = inner.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const outer = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0">
<iframe id="phone" width="${width}" height="${height}" style="width:${width}px;height:${height}px;border:0" srcdoc="${srcdoc}"></iframe>
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
  const htmlPath = `/tmp/payment-add-${width}.html`;
  writeFileSync(htmlPath, outer);
  const chrome = spawnSync(
    'google-chrome-stable',
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--virtual-time-budget=5000',
      `--screenshot=${screenshot}`,
      '--dump-dom',
      `file://${htmlPath}`,
    ],
    { encoding: 'utf8', timeout: 25000, maxBuffer: 12 * 1024 * 1024 }
  );
  if (chrome.status !== 0) {
    throw new Error(`chrome ${width} failed ${chrome.status}: ${chrome.stderr}`);
  }
  const match = chrome.stdout.match(/<pre id="parent-out">([^<]*)<\/pre>/);
  assert(match && match[1].trim(), `metrics missing at ${width}: ${chrome.stdout.slice(-800)}`);
  return JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
}

const mobile = runIframe({
  width: 390,
  height: 844,
  longForm: true,
  screenshot: '/tmp/payment-add-footer-390.png',
});

assert(mobile.before.innerWidth === 390, `iframe width ${mobile.before.innerWidth}`);
assert(mobile.before.innerHeight === 844, `iframe height ${mobile.before.innerHeight}`);
assert(mobile.before.dialogFits, `dialog overflows viewport before scroll ${JSON.stringify(mobile.before.dialog)}`);
assert(mobile.before.footerVisible, `footer hidden before scroll ${JSON.stringify(mobile.before.footer)}`);
assert(mobile.before.cancelVisible, `cancel hidden before scroll ${JSON.stringify(mobile.before.cancel)}`);
assert(mobile.before.ctaVisible, `cta hidden before scroll ${JSON.stringify(mobile.before.cta)}`);
assert(mobile.after.bodyScroll >= 800, `body did not scroll ${mobile.after.bodyScroll}`);
assert(mobile.after.footerVisible, `footer hidden after long-form scroll ${JSON.stringify(mobile.after.footer)}`);
assert(
  Math.abs(mobile.after.footer.top - mobile.before.footer.top) < 2,
  `footer moved with scroll ${mobile.before.footer.top} -> ${mobile.after.footer.top}`
);
assert(
  mobile.after.footer.position === 'relative' || mobile.after.footer.position === 'static',
  `mobile footer must be in-flow (not absolute overlay) ${mobile.after.footer.position}`
);
assert(mobile.after.dialog.transform === 'none', `mobile dialog still transformed ${mobile.after.dialog.transform}`);
// Footer sits below body — after long-form scroll, body moves but footer stays pinned in flex layout
assert(
  mobile.after.footer.bottom <= mobile.after.innerHeight + 1,
  `footer below viewport after scroll ${JSON.stringify(mobile.after.footer)}`
);

const desktop = runIframe({
  width: 1280,
  height: 800,
  longForm: true,
  screenshot: '/tmp/payment-add-desktop-1280.png',
});

assert(desktop.before.innerWidth === 1280, `desktop width ${desktop.before.innerWidth}`);
assert(desktop.before.innerHeight === 800, `desktop height ${desktop.before.innerHeight}`);
assert(desktop.before.dialog.transform !== 'none', `desktop lost transform ${desktop.before.dialog.transform}`);
assert(
  desktop.before.dialog.cssTranslate === 'none',
  `desktop still has independent translate ${desktop.before.dialog.cssTranslate}`
);
assert(desktop.before.dialog.left > 8, `desktop off-screen left ${desktop.before.dialog.left}`);
assert(desktop.before.dialog.top > 8, `desktop off-screen top ${desktop.before.dialog.top}`);
assert(desktop.before.dialog.right < 1280 - 8, `desktop overflow right ${desktop.before.dialog.right}`);
assert(desktop.before.dialog.bottom < 800 + 1, `desktop overflow bottom ${desktop.before.dialog.bottom}`);
assert(
  Math.abs(desktop.before.dialog.centerX - 640) < 24,
  `desktop not centered ${desktop.before.dialog.centerX}`
);
assert(desktop.before.dialogFits, `desktop dialog overflows ${JSON.stringify(desktop.before.dialog)}`);
assert(desktop.before.footerVisible, `desktop footer hidden ${JSON.stringify(desktop.before.footer)}`);
assert(
  desktop.before.footer.position === 'relative' || desktop.before.footer.position === 'static',
  `desktop footer must be in-flow ${desktop.before.footer.position}`
);
assert(desktop.after.pageScroll >= 300, `page did not scroll ${desktop.after.pageScroll}`);
assert(
  Math.abs(desktop.after.dialog.top - desktop.before.dialog.top) < 2,
  `desktop dialog drifted on page scroll ${desktop.before.dialog.top} -> ${desktop.after.dialog.top}`
);
assert(
  Math.abs(desktop.after.dialog.centerX - 640) < 24,
  `desktop center drifted ${desktop.after.dialog.centerX}`
);
assert(desktop.after.dialog.transform !== 'none', `desktop transform lost after scroll ${desktop.after.dialog.transform}`);

console.log('assert-payment-add-footer: ok', {
  mobile: {
    footer: mobile.before.footer,
    after: mobile.after.footer,
    scrolled: mobile.after.bodyScroll,
    dialog: mobile.before.dialog,
  },
  desktop: {
    dialog: desktop.before.dialog,
    afterTop: desktop.after.dialog.top,
    pageScroll: desktop.after.pageScroll,
    footerPos: desktop.before.footer.position,
  },
});
