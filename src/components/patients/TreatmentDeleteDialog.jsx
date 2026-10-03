import { formatCurrency } from '@/lib/utils';
import { useBackClose } from '@/hooks/useBackClose';

export default function TreatmentDeleteDialog({ row, busy, onCancel, onConfirm }) {
  useBackClose(!!row, () => { if (!busy && onCancel) onCancel(); });
  if (!row) return null;
  const paid = Number(row.paidAmount) > 0;
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" data-testid="treatment-delete-dialog">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <h3 className="text-base font-black text-slate-900">Muolajani o‘chirish</h3>
        <p className="mt-2 text-sm font-semibold text-slate-700">
          {row.serviceName} · #{row.toothNumber || '—'} · {formatCurrency(row.price)}
        </p>
        {paid ? (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
            Bu rejaga {formatCurrency(row.paidAmount)} to‘lov biriktirilgan. O‘chirish reja summasini va qarzni yangilaydi. Qabul qilingan to‘lov yozuvi o‘chmaydi.
          </p>
        ) : (
          <p className="mt-3 text-sm text-slate-600">
            Reja jami va to‘lanmagan qarz {formatCurrency(row.price)} ga kamayadi. Bu amal saqlanadi.
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-700">
            Bekor
          </button>
          <button
            type="button"
            data-testid="treatment-delete-confirm"
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-black text-white disabled:opacity-60"
          >
            {busy ? 'O‘chirilmoqda…' : (paid ? 'Ogohlantirish bilan o‘chirish' : 'O‘chirish')}
          </button>
        </div>
      </div>
    </div>
  );
}
