import React from 'react';
import { ShieldAlert, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { FEATURE_LABELS, planRequiredFor, PRO_EXTRA_LABELS } from '@/lib/clinicPlan';
import { catalogAmount, formatMoney } from '@/utils/superAdminBilling';

const SUPPORT_URL = 'https://t.me/dentist_shaxin';

export default function Paywall({ featureName }) {
  const label = FEATURE_LABELS[featureName] || featureName;
  const required = planRequiredFor(featureName);
  const planName = required === 'premium' ? 'PREMIUM' : 'PRO';
  const price = formatMoney(catalogAmount(required)).replace(/,/g, ' ');

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-md w-full bg-white rounded-[2rem] border border-teal-100 shadow-xl shadow-slate-900/5 p-8 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#0b3550] to-[#0f766e]" />

        <div className="w-20 h-20 bg-teal-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-10 h-10 text-[#0f766e]" />
        </div>

        <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
          {planName} tarifiga o&apos;ting
        </h2>
        <p className="text-sm text-slate-500 font-medium mb-8">
          <span className="font-bold text-slate-700">{label}</span> joriy tarifda yopiq. Bu bo&apos;lim {planName} tarifda ochiladi.
        </p>

        <div className="mb-8 space-y-3 text-left">
          {PRO_EXTRA_LABELS.map((item) => (
            <div key={item} className="flex items-center gap-3 text-sm font-semibold text-slate-700">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              {item}
            </div>
          ))}
        </div>

        <div className="bg-slate-50 p-4 rounded-xl mb-6">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{planName} ta&apos;rif narxi</p>
          <div className="flex items-end justify-center gap-1">
            <span className="text-3xl font-black text-[#0f766e]">{price}</span>
            <span className="text-sm font-bold text-slate-500 mb-1">so&apos;m / oy</span>
          </div>
        </div>

        <Button asChild className="w-full h-14 bg-[#0b3550] hover:bg-[#0e4c62] text-white rounded-xl font-bold tracking-wide text-sm shadow-xl shadow-slate-900/10 group">
          <a href={SUPPORT_URL} target="_blank" rel="noreferrer">
            Tarifni yangilash
            <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
          </a>
        </Button>
      </motion.div>
    </div>
  );
}
