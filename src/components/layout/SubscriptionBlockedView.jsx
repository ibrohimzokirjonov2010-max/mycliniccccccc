import { motion } from 'framer-motion';
import { Lock, AlertCircle, Phone, CreditCard, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/AuthContext';

/**
 * SubscriptionBlockedView - Full screen blocking UI for expired clinics
 */
export default function SubscriptionBlockedView() {
  const { logout } = useAuth();
  
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-[500px] bg-white rounded-[3rem] p-10 shadow-2xl shadow-rose-200/50 border border-rose-100 text-center relative overflow-hidden"
      >
        {/* Background Decoration */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-rose-50 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-rose-50 rounded-full blur-3xl" />
        
        <div className="relative z-10">
          <div className="w-24 h-24 bg-rose-600 rounded-[2rem] shadow-xl shadow-rose-200 flex items-center justify-center mx-auto mb-8 animate-bounce">
            <Lock className="w-12 h-12 text-white" />
          </div>
          
          <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">
            Xizmat muddati tugagan
          </h2>
          
          <div className="p-4 bg-rose-50 rounded-2xl mb-8 border border-rose-100">
            <p className="text-rose-700 font-bold text-sm leading-relaxed">
              Tizimdan foydalanishni davom ettirish uchun obunani yangilashingiz lozim. Barcha ma'lumotlaringiz xavfsiz saqlanmoqda.
            </p>
          </div>
          
          <div className="grid gap-4">
            <Button 
              onClick={() => window.open('https://t.me/dentist_shaxin', '_blank')}
              className="w-full h-15 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 shadow-xl active:scale-[0.98] transition-all"
            >
              <CreditCard className="w-5 h-5" />
              Obunani yangilash
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => window.open('tel:+998901234567', '_self')}
              className="w-full h-15 border-2 border-slate-100 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:bg-slate-50 transition-all"
            >
              <Phone className="w-5 h-5 text-[#1499AD]" />
              Texnik yordam (Admin)
            </Button>

            <button 
              onClick={logout}
              className="mt-4 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-rose-600 transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Tizimdan chiqish
            </button>
          </div>
        </div>
        
        <div className="mt-10 pt-8 border-t border-slate-100 flex items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Access Restricted</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-slate-200" />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data Safe</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
