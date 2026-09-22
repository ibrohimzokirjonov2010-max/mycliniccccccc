import { AlertTriangle, CheckCircle2, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  PLAN_CATALOG,
  PLAN_MAPPING_NOTE,
  METHOD_LABELS,
  WEBHOOK_LABELS,
  catalogAmount,
  formatMoney,
  isCustomMonthly,
  resolveLifecycle,
} from '@/utils/superAdminBilling';

const chip = (active, tone) =>
  `px-2.5 py-1 rounded-lg text-xs font-medium ${active ? tone : 'text-slate-400 hover:text-slate-200'}`;

function PlanCard({ planKey, count, customCount, billed }) {
  const plan = PLAN_CATALOG[planKey];
  const featured = planKey === 'pro';
  return (
    <div className={`rounded-2xl border p-5 ${featured ? 'bg-[#10211f] border-teal-400/25' : 'bg-[#0e141c] border-white/[0.07]'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-teal-200/80">{plan.landing.join(' / ')} → {plan.label}</p>
          <h3 className="text-lg font-semibold text-white mt-1">{plan.label} ta'rifi</h3>
        </div>
        {featured && (
          <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-md bg-teal-400 text-[#04221e]">Asosiy</span>
        )}
      </div>
      <div className="mt-3 space-y-1">
        {plan.landingPrices.map((tariff) => (
          <p key={tariff.id} className="text-lg font-semibold text-white tabular-nums">
            {tariff.name} · {formatMoney(tariff.priceUzs)} <span className="text-xs font-normal text-slate-400">UZS / oy</span>
          </p>
        ))}
        <p className="text-xs text-slate-400 tabular-nums">Qo'lda: {formatMoney(plan.catalogPrice)} UZS</p>
      </div>
      <p className="mt-2 text-xs text-slate-400 leading-relaxed">{plan.summary}</p>
      <div className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
        <div className="rounded-xl bg-black/20 px-2.5 py-2">
          <p className="text-slate-500">Klinikalar</p>
          <p className="text-white font-semibold tabular-nums">{count}</p>
        </div>
        <div className="rounded-xl bg-black/20 px-2.5 py-2">
          <p className="text-slate-500">Maxsus narx</p>
          <p className="text-teal-200 font-semibold tabular-nums">{customCount}</p>
        </div>
        <div className="rounded-xl bg-black/20 px-2.5 py-2">
          <p className="text-slate-500">Hisoblangan</p>
          <p className="text-white font-semibold tabular-nums">{formatMoney(billed)}</p>
        </div>
      </div>
    </div>
  );
}

export default function BillingPanel({
  clinics,
  catalogClinics,
  stats,
  ledger,
  billingSearch,
  setBillingSearch,
  billingPlan,
  setBillingPlan,
  billingLife,
  setBillingLife,
  ledgerMethod,
  setLedgerMethod,
  ledgerStatus,
  setLedgerStatus,
  onAcceptPayment,
}) {
  const attention = clinics.filter((c) => {
    const key = resolveLifecycle(c).key;
    return key === 'past_due' || key === 'expiring' || key === 'expired';
  });

  const source = catalogClinics || clinics;
  const basicBilled = source
    .filter((c) => c.plan === 'basic')
    .reduce((sum, c) => sum + Number(c.monthly_fee || 0), 0);
  const proBilled = source
    .filter((c) => c.plan !== 'basic')
    .reduce((sum, c) => sum + Number(c.monthly_fee || 0), 0);
  const basicCustom = source.filter((c) => c.plan === 'basic' && isCustomMonthly(c)).length;
  const proCustom = source.filter((c) => c.plan !== 'basic' && isCustomMonthly(c)).length;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-teal-400/20 bg-teal-400/[0.06] px-4 py-3 text-xs text-teal-50/90 leading-relaxed">
        {PLAN_MAPPING_NOTE}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <PlanCard planKey="basic" count={stats.basicCount} customCount={basicCustom} billed={basicBilled} />
        <PlanCard planKey="pro" count={stats.proCount} customCount={proCustom} billed={proBilled} />
      </div>

      <div className="bg-[#0e141c] border border-white/[0.07] rounded-2xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-300" />
            Nazoratdagi klinikalar
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={billingSearch}
              onChange={(e) => setBillingSearch(e.target.value)}
              placeholder="Klinika, ID, merchant..."
              className="h-9 w-full sm:w-56 bg-white/[0.04] border-white/10 rounded-xl text-white text-xs"
            />
            <div className="flex bg-black/20 p-1 rounded-xl border border-white/5">
              {[
                ['all', 'Ta\'rif'],
                ['pro', 'PRO'],
                ['basic', 'BASIC'],
              ].map(([id, label]) => (
                <button key={id} type="button" onClick={() => setBillingPlan(id)} className={chip(billingPlan === id, 'bg-white/10 text-white')}>
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap bg-black/20 p-1 rounded-xl border border-white/5">
              {[
                ['all', 'Holat'],
                ['trialing', 'Sinov'],
                ['active', 'Faol'],
                ['expiring', 'Tugayapti'],
                ['past_due', 'Qarzdor'],
                ['expired', 'Tugagan'],
              ].map(([id, label]) => (
                <button key={id} type="button" onClick={() => setBillingLife(id)} className={chip(billingLife === id, 'bg-teal-500/20 text-teal-100')}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {attention.length === 0 ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="w-7 h-7 mx-auto text-teal-400 mb-2" />
            <p className="text-sm text-slate-200">Bu filtrda nazoratdagi klinika yo'q</p>
            <p className="text-xs text-slate-500 mt-1">Qarzdor, tugayotgan va tugagan obunalar shu yerda chiqadi.</p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[360px] rounded-xl border border-white/[0.05]">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="sticky top-0 bg-[#121920] text-[10px] uppercase tracking-wide text-slate-400">
                  <th className="py-2.5 px-3 font-medium">Klinika</th>
                  <th className="py-2.5 px-3 font-medium">Holat</th>
                  <th className="py-2.5 px-3 font-medium">Provayder</th>
                  <th className="py-2.5 px-3 font-medium">Webhook</th>
                  <th className="py-2.5 px-3 font-medium text-right">Amal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {attention.map((c) => {
                  const life = resolveLifecycle(c);
                  const webhook = c.webhook_status || (
                    c.payment_method === 'payme' || c.payment_method === 'click'
                      ? 'received'
                      : (c.payme_merchant_id || c.click_service_id ? 'waiting' : 'not_configured')
                  );
                  const provider = c.payment_provider || c.payment_method || 'manual';
                  return (
                    <tr key={c.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-3">
                        <p className="font-medium text-white">{c.name}</p>
                        <p className="text-[11px] text-slate-500 font-mono">{c.id} · {formatMoney(c.monthly_fee)} UZS{isCustomMonthly(c) ? ` · katalog ${formatMoney(catalogAmount(c.plan))}` : ''}</p>
                      </td>
                      <td className="py-3 px-3 text-slate-300">{life.label}</td>
                      <td className="py-3 px-3 text-slate-300">
                        <p>{METHOD_LABELS[provider] || provider}</p>
                        <p className="text-[10px] text-slate-500">
                          Payme: {c.payme_merchant_id || '—'} · Click: {c.click_service_id || c.click_merchant_id || '—'}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-slate-300">{WEBHOOK_LABELS[webhook] || webhook}</td>
                      <td className="py-3 px-3 text-right">
                        <Button
                          size="sm"
                          onClick={() => onAcceptPayment(c.id)}
                          className="h-8 bg-teal-500 hover:bg-teal-400 text-[#04221e] text-xs font-semibold"
                        >
                          To'lovni qabul qilish
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-[#0e141c] border border-white/[0.07] rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-teal-300" />
            To'lov daftari
          </h3>
          <div className="flex flex-wrap gap-2">
            <div className="flex bg-black/20 p-1 rounded-xl border border-white/5">
              {[['all', 'Usul'], ['manual', 'Qo\'lda'], ['payme', 'Payme'], ['click', 'Click'], ['mock', 'Mock'], ['trial', 'Sinov']].map(([id, label]) => (
                <button key={id} type="button" onClick={() => setLedgerMethod(id)} className={chip(ledgerMethod === id, 'bg-white/10 text-white')}>
                  {label}
                </button>
              ))}
            </div>
            <div className="flex bg-black/20 p-1 rounded-xl border border-white/5">
              {[['all', 'Status'], ['paid', 'To\'langan'], ['pending', 'Kutilmoqda'], ['failed', 'Rad']].map(([id, label]) => (
                <button key={id} type="button" onClick={() => setLedgerStatus(id)} className={chip(ledgerStatus === id, 'bg-white/10 text-white')}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {ledger.length === 0 ? (
          <div className="py-10 text-center">
            <CreditCard className="w-7 h-7 mx-auto text-teal-800 mb-2" />
            <p className="text-sm text-slate-200">Daftar bo'sh</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Tasdiqlangan to'lovlar shu yerda qoladi: sana, klinika, summa, usul, holat va uzaytirilgan davr.
            </p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[420px] rounded-xl border border-white/[0.05]">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="sticky top-0 bg-[#121920] text-[10px] uppercase tracking-wide text-slate-400">
                  <th className="py-2.5 px-3 font-medium">Sana</th>
                  <th className="py-2.5 px-3 font-medium">Klinika</th>
                  <th className="py-2.5 px-3 font-medium">Summa</th>
                  <th className="py-2.5 px-3 font-medium">Usul</th>
                  <th className="py-2.5 px-3 font-medium">Holat</th>
                  <th className="py-2.5 px-3 font-medium">Davr</th>
                  <th className="py-2.5 px-3 font-medium">Webhook</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {ledger.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.02]">
                    <td className="py-3 px-3 text-slate-300 tabular-nums">{row.date}</td>
                    <td className="py-3 px-3">
                      <p className="text-white font-medium">{row.clinic_name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{row.clinic_id}</p>
                    </td>
                    <td className="py-3 px-3 text-white tabular-nums">{formatMoney(row.amount)} UZS</td>
                    <td className="py-3 px-3 text-slate-300">{METHOD_LABELS[row.method] || row.method}</td>
                    <td className="py-3 px-3 text-slate-300">{row.status === 'paid' ? 'To\'langan' : row.status === 'failed' ? 'Rad' : row.status === 'trial' ? 'Sinov' : 'Kutilmoqda'}</td>
                    <td className="py-3 px-3 text-teal-200">{row.period_label || (row.period_days ? `+${row.period_days} kun` : '—')}</td>
                    <td className="py-3 px-3 text-slate-400">{WEBHOOK_LABELS[row.webhook_status] || row.webhook_status || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
