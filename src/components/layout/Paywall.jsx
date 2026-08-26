import React from 'react';
import { ShieldAlert, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

export default function Paywall({ featureName }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-md w-full bg-white rounded-[2rem] border border-blue-100 shadow-xl shadow-blue-900/5 p-8 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-600" />
        
        <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-10 h-10 text-blue-600" />
        </div>
        
        <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
          PRO Ta'rifiga O'ting
        </h2>
        <p className="text-sm text-slate-500 font-medium mb-8">
          Siz qidirayotgan <span className="font-bold text-slate-700">{featureName}</span> orqali qo'shimcha imkoniyatlarni faqat PRO ta'rifida ochish mumkin.
        </p>

        <div className="mb-8 space-y-3 text-left">
          <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            Cheksiz Shifokorlar Qo'shish
          </div>
          <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            Implantlar Moduli To'liq Ochiq
          </div>
          <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            24/7 Premium Yordam
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl mb-6">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">PRO Ta'rif Narxi</p>
          <div className="flex items-end justify-center gap-1">
            <span className="text-3xl font-black text-blue-600">189.000</span>
            <span className="text-sm font-bold text-slate-500 mb-1">UZS / oy</span>
          </div>
        </div>

        <Button className="w-full h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold uppercase tracking-widest text-sm shadow-xl shadow-blue-500/20 group">
          Super Admin Bilan Bog'lanish
          <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
        </Button>
      </motion.div>
    </div>
  );
}
