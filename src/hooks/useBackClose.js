import { useEffect, useRef } from 'react';

/**
 * Modal/Sheet ochilganda brauzer/telefon "Orqaga" tugmasi avval modalni yopishi uchun.
 *  - ochilganda history'ga marker yozuv qo'shiladi (URL o'zgarmaydi)
 *  - Orqaga bosilsa — marker olib tashlanadi va modal yopiladi (sahifa o'z joyida qoladi)
 *  - modal tugma/overlay bilan yopilsa — marker yozuvi history.back() bilan tozalanadi
 *  - modal ichidan boshqa sahifaga o'tilsa — qolib ketgan marker keyingi Orqaga'da o'zi o'tkazib yuboriladi
 */
const MARK = '__shifoModal';
let uid = 0;
const openStack = []; // {id, close}
let listening = false;
// Modal yopilganda chaqirilgan history.back() asinxron. Shu oraliqda foydalanuvchi menyudan
// boshqa sahifaga o'tsa (pushState), kechikkan back() yangi sahifani bekor qilardi va menyuni
// ikki marta bosish kerak bo'lardi. Shu holatda tanlangan sahifani qayta tiklaymiz.
const pendingBacks = []; // tokenlar
let pushedWhilePending = null; // { state, url } — back() kutilayotganda qilingan oxirgi pushState
let origPushState = null;
let replaying = false;

function onPop() {
  if (replaying) return;
  const cur = window.history.state && window.history.state[MARK];

  if (pendingBacks.length > 0) {
    pendingBacks.shift();
    if (pushedWhilePending && origPushState) {
      const target = pushedWhilePending;
      pushedWhilePending = null;
      // back() navigatsiyadan keyin bajarildi — foydalanuvchi tanlagan sahifaga qaytamiz
      // va routerga popstate orqali xabar beramiz.
      replaying = true;
      try {
        origPushState(target.state, '', target.url);
        // Yangi modal markeri bo'lsa routerga xabar shart emas (URL o'zgarmaydi).
        if (!target.isModalMarker) window.dispatchEvent(new PopStateEvent('popstate', { state: target.state }));
      } finally {
        replaying = false;
      }
      return;
    }
  }

  // Qolib ketgan (egasi yo'q) marker yozuviga tushib qolsak — yana bir qadam orqaga
  if (cur != null && !openStack.some((m) => m.id === cur)) {
    window.history.back();
    return;
  }

  // Joriy yozuvdan "yuqorida" turgan hamma ochiq modallarni yopamiz
  const idx = cur == null ? -1 : openStack.findIndex((m) => m.id === cur);
  for (let i = openStack.length - 1; i > idx; i -= 1) {
    const m = openStack[i];
    openStack.splice(i, 1);
    m.pushed = false;
    try { m.close(); } catch { /* ignore */ }
  }
}

function ensureListener() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('popstate', onPop);
  try {
    origPushState = window.history.pushState.bind(window.history);
    window.history.pushState = function patchedPushState(...args) {
      if (pendingBacks.length > 0) {
        const isModalMarker = !!(args[0] && typeof args[0] === 'object' && args[0][MARK] != null);
        pushedWhilePending = { state: args[0], url: args[2], isModalMarker };
      }
      return origPushState(...args);
    };
  } catch { /* ignore */ }
}

export function useBackClose(isOpen, onClose) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return undefined;
    ensureListener();

    const entry = { id: ++uid, pushed: false, close: () => closeRef.current && closeRef.current() };
    let timer = window.setTimeout(() => {
      timer = 0;
      try {
        const base = window.history.state && typeof window.history.state === 'object' ? window.history.state : {};
        window.history.pushState({ ...base, [MARK]: entry.id }, '');
        entry.pushed = true;
        openStack.push(entry);
      } catch { /* history API mavjud emas */ }
    }, 0);

    return () => {
      if (timer) { window.clearTimeout(timer); return; }
      const at = openStack.indexOf(entry);
      if (at >= 0) openStack.splice(at, 1);
      // Marker hali eng tepada bo'lsa (modal tugma bilan yopildi) — tozalaymiz
      if (entry.pushed && window.history.state && window.history.state[MARK] === entry.id) {
        const token = {};
        pendingBacks.push(token);
        window.history.back();
        // Xavfsizlik: popstate kelmasa ham navbat qotib qolmasin.
        window.setTimeout(() => {
          const i = pendingBacks.indexOf(token);
          if (i >= 0) pendingBacks.splice(i, 1);
          if (pendingBacks.length === 0) pushedWhilePending = null;
        }, 1500);
      }
    };
  }, [isOpen]);
}

/**
 * JSX ichida (shartli render qilingan modal yonida) ishlatish uchun: hech narsa chizmaydi,
 * faqat `open` true bo'lganda Orqaga tugmasi `onClose`ni chaqiradi.
 */
export function BackClose({ open, onClose }) {
  useBackClose(!!open, onClose);
  return null;
}

export default useBackClose;
