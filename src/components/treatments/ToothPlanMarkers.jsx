import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

// Yangi reja yaratishda tishlarga biriktirilgan xizmatlarni odontogrammada ko'rsatish uchun
// yordamchi funksiyalar va overlay. Faqat ko'rinish (UI) - saqlash payload'iga tegmaydi.

export const CATEGORY_DOT_COLORS = {
  terapiya: '#2563eb',
  xirurgiya: '#e11d48',
  ortopediya: '#7c3aed',
  ortodontiya: '#059669',
  implant: '#d97706',
  default: '#0891b2',
};

export const CATEGORY_DOT_LABELS = {
  terapiya: 'Terapiya',
  xirurgiya: 'Xirurgiya',
  ortopediya: 'Ortopediya',
  ortodontiya: 'Ortodontiya',
  implant: 'Implantatsiya',
  default: 'Boshqa',
};

export function categoryKeyOf(category, name = '') {
  const text = `${category || ''} ${name || ''}`.toLowerCase();
  if (/terapiya|endo|plomba/.test(text)) return 'terapiya';
  if (/xirurg|sug['‘’`]?urish|olish/.test(text)) return 'xirurgiya';
  if (/ortoped|protez|karonka|koronka|toj/.test(text)) return 'ortopediya';
  if (/ortodon|breket|braket/.test(text)) return 'ortodontiya';
  if (/implant/.test(text)) return 'implant';
  return 'default';
}

export function categoryColorOf(category, name) {
  return CATEGORY_DOT_COLORS[categoryKeyOf(category, name)] || CATEGORY_DOT_COLORS.default;
}

/**
 * toothData ({ [toothId]: { services: [...] } }) dan har bir tish uchun marker ma'lumoti:
 * { count, names, color, categories: [{ key, color, label, count }] }
 * Jag' (jaw) kalitlari tishga tegishli emas - o'tkazib yuboriladi.
 */
export function buildToothPlanMarkers(toothData, isJawKey = () => false) {
  const markers = {};
  Object.entries(toothData || {}).forEach(([toothId, data]) => {
    if (isJawKey(toothId)) return;
    const list = data?.services || [];
    if (!list.length) return;
    const byCategory = new Map();
    const names = [];
    list.forEach((svc) => {
      const name = svc.service_name || svc.name || 'Xizmat';
      names.push(name);
      const key = categoryKeyOf(svc.category, name);
      byCategory.set(key, (byCategory.get(key) || 0) + 1);
    });
    const categories = [...byCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({
        key,
        count,
        color: CATEGORY_DOT_COLORS[key] || CATEGORY_DOT_COLORS.default,
        label: CATEGORY_DOT_LABELS[key] || CATEGORY_DOT_LABELS.default,
      }));
    markers[toothId] = { count: list.length, names, color: categories[0].color, categories };
  });
  return markers;
}

export function markerTitle(fdi, marker) {
  if (!marker) return `${fdi}-tish: xizmat biriktirilmagan`;
  return `${fdi}-tish · ${marker.count} ta xizmat:\n${marker.names.map((n) => `• ${n}`).join('\n')}`;
}

/** Kichik doira-badge (soni bilan). Mobil tugmalarda ham ishlatiladi. */
export function ToothCountBadge({ marker, size = 16, className = '' }) {
  if (!marker) return null;
  return (
    <span
      data-testid="tooth-plan-badge"
      data-count={marker.count}
      className={`inline-flex items-center justify-center rounded-full border border-white text-white font-black leading-none shadow-sm ${className}`}
      style={{ background: marker.color, width: size, height: size, fontSize: Math.max(8, size - 8) }}
    >
      {marker.count}
    </span>
  );
}

/**
 * Odontogramma ustiga overlay: xizmat biriktirilgan tishlarda kategoriya rangidagi badge (soni bilan)
 * va tooltip, tanlangan lekin xizmat biriktirilmagan tishlarda sariq punktir ramka.
 * Odontogramma komponentining o'ziga tegmaydi - tish elementlari [data-tooth-id] orqali topiladi.
 */
export function ToothMarkerOverlay({ children, markers, selectedTeeth = [], activeTooth = null, fdiOf = (id) => id, onPickTooth }) {
  const wrapRef = useRef(null);
  const [rects, setRects] = useState({});

  const measure = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const base = wrap.getBoundingClientRect();
    const next = {};
    wrap.querySelectorAll('[data-tooth-id]').forEach((el) => {
      const id = el.getAttribute('data-tooth-id');
      const r = el.getBoundingClientRect();
      if (!id || !r.width || !r.height) return;
      next[id] = {
        left: Math.round(r.left - base.left),
        top: Math.round(r.top - base.top),
        width: Math.round(r.width),
        height: Math.round(r.height),
      };
    });
    setRects((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, []);

  const depsKey = useMemo(
    () => `${Object.keys(markers || {}).map((k) => `${k}:${markers[k].count}`).join('|')}#${selectedTeeth.join(',')}#${activeTooth || ''}`,
    [markers, selectedTeeth, activeTooth],
  );

  useLayoutEffect(() => {
    measure();
    const raf = requestAnimationFrame(measure);
    const timer = setTimeout(measure, 250);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
  }, [depsKey, measure]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (observer) observer.observe(wrap);
    window.addEventListener('resize', measure);
    wrap.addEventListener('scroll', measure, true);
    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('resize', measure);
      wrap.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  const unassigned = selectedTeeth.filter((id) => !markers?.[id]);

  return (
    <div ref={wrapRef} className="relative w-full" data-testid="tooth-marker-overlay-host">
      {children}
      <div className="absolute inset-0 pointer-events-none z-30" aria-hidden={false}>
        {unassigned.map((id) => {
          const r = rects[id];
          if (!r) return null;
          return (
            <div
              key={`un-${id}`}
              data-testid="tooth-unassigned-ring"
              data-tooth-ring={id}
              className="absolute rounded-lg border-2 border-dashed border-amber-400 bg-amber-300/15"
              style={{ left: r.left - 1, top: r.top - 1, width: r.width + 2, height: r.height + 2 }}
            />
          );
        })}
        {Object.entries(markers || {}).map(([id, marker]) => {
          const r = rects[id];
          if (!r) return null;
          const extra = marker.categories.slice(1, 3);
          return (
            <div
              key={`mk-${id}`}
              data-tooth-marker={id}
              className="absolute pointer-events-auto flex items-center gap-0.5 cursor-pointer"
              style={{ left: r.left + 1, top: r.top + 1 }}
              title={markerTitle(fdiOf(id), marker)}
              onClick={() => onPickTooth && onPickTooth(id)}
            >
              <ToothCountBadge marker={marker} size={16} />
              {extra.map((c) => (
                <i key={c.key} className="block w-1.5 h-1.5 rounded-full border border-white" style={{ background: c.color }} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
