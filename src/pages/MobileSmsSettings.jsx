import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronLeft, MessageSquare, Zap, Clock, Calendar,
  Gift, RefreshCw, CreditCard, Save, CheckCircle2, AlertCircle
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

const STORAGE_KEY = 'sms_settings_v1';

const DEFAULT_SETTINGS = {
  sms_enabled: true,
  on_appointment_created: true,
  on_appointment_day: true,
  on_appointment_day_time: '08:00',
  on_day_before: true,
  on_day_before_time: '08:00',
  birthday_greetings: true,
  recall_reminder: true,
  debt_reminder: true,
};

function SectionLabel({ text }) {
  return (
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 mb-2 mt-5">
      {text}
    </p>
  );
}

function ToggleRow({ icon: Icon, iconBg, iconColor, title, subtitle, checked, onChange, children }) {
  return (
    <div className="bg-white rounded-2xl px-4 py-4 mb-2 shadow-sm">
      <div 
        onClick={() => onChange(!checked)}
        className="flex items-center gap-3 cursor-pointer active:opacity-80 transition-opacity"
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div className="flex-1 min-w-0 pr-2">
          <p className="text-[13px] font-bold text-slate-800 leading-snug">{title}</p>
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{subtitle}</p>}
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={checked}
            onCheckedChange={onChange}
            className="shrink-0 data-[state=checked]:bg-purple-600"
          />
        </div>
      </div>
      {children && checked && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden"
        >
          <div className="mt-3 pt-3 border-t border-slate-100">
            {children}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function TimeRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] font-semibold text-slate-500">{label}</span>
      <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 cursor-pointer">
        <Clock className="w-3.5 h-3.5 text-slate-400" />
        <input
          type="time"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="text-[13px] font-bold text-slate-700 bg-transparent outline-none w-20"
        />
      </label>
    </div>
  );
}

export default function MobileSmsSettings() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setSettings(prev => ({ ...prev, ...JSON.parse(stored) }));
    } catch { /* ignore */ }
  }, []);

  const update = (key, val) => {
    setSettings(prev => ({ ...prev, [key]: val }));
    setSaved(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      // Backend sync (optional)
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      try {
        await fetch(`${backendUrl}/notifications/sms-settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings),
        });
      } catch { /* backend bo'lmasa ham saqlanadi */ }

      setSaved(true);
      toast.success('SMS sozlamalari saqlandi! ✅');
      setTimeout(() => setSaved(false), 3000);
    } catch {
      toast.error('Saqlashda xato yuz berdi');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F5FA]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-2 pb-4">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white shadow-sm border border-slate-100 active:scale-90 transition-transform"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h1 className="text-[17px] font-black text-slate-800 tracking-tight">Sms Sozlamalari</h1>
        <div className="w-9" />
      </div>

      <div className="px-4 pb-36">
        {/* ── Master Toggle ── */}
        <div 
          onClick={() => update('sms_enabled', !settings.sms_enabled)}
          className="bg-white rounded-2xl px-4 py-4 shadow-sm cursor-pointer active:opacity-80 transition-opacity"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-100 shrink-0">
              <MessageSquare className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1 pr-2">
              <p className="text-[13px] font-black text-slate-800">
                Klinika uchun SMS funksiyasini yoqish{' '}
                <span className="text-red-500">*</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Sms bildirishnoma</p>
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <Switch
                checked={settings.sms_enabled}
                onCheckedChange={v => update('sms_enabled', v)}
                className="shrink-0 data-[state=checked]:bg-purple-600"
              />
            </div>
          </div>
        </div>

        {settings.sms_enabled && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* ── Navbat yaratilgan vaqtda ── */}
            <SectionLabel text="NAVBAT YARATILGAN VAQTDA" />
            <ToggleRow
              icon={Zap}
              iconBg="bg-purple-100"
              iconColor="text-purple-600"
              title="Elektron navbatga bemor qo'shilgandan so'ng, SMS xabari darhol avtomatik tarzda yuboriladi."
              subtitle="Navbat yaratilgan vaqtda"
              checked={settings.on_appointment_created}
              onChange={v => update('on_appointment_created', v)}
            />

            {/* ── Bemor keladigan kun ── */}
            <SectionLabel text="BEMOR KELADIGAN KUN SMS JO'NATISH" />
            <ToggleRow
              icon={Clock}
              iconBg="bg-blue-50"
              iconColor="text-blue-500"
              title="Bemor kelishi belgilangan kun va soatda (masalan, 08:30 yoki 09:00) SMS xabari avtomatik tarzda yuboriladi."
              subtitle="Bemor keladigan kun sms jo'natish"
              checked={settings.on_appointment_day}
              onChange={v => update('on_appointment_day', v)}
            >
              <TimeRow
                label="Yuborish vaqti"
                value={settings.on_appointment_day_time}
                onChange={v => update('on_appointment_day_time', v)}
              />
            </ToggleRow>

            {/* ── 1 kun oldin ── */}
            <SectionLabel text="NAVBATDAN BIR KUN OLDIN YUBORISH" />
            <ToggleRow
              icon={Calendar}
              iconBg="bg-orange-50"
              iconColor="text-orange-400"
              title="Kun oldin eslatma"
              subtitle="Bemor kelishidan bir kun oldin avtomatik xabar"
              checked={settings.on_day_before}
              onChange={v => update('on_day_before', v)}
            >
              <TimeRow
                label="Yuborish vaqti"
                value={settings.on_day_before_time}
                onChange={v => update('on_day_before_time', v)}
              />
            </ToggleRow>

            {/* ── Boshqa bildirishnomalar ── */}
            <SectionLabel text="BOSHQA BILDIRISHNOMALAR" />
            <ToggleRow
              icon={Gift}
              iconBg="bg-pink-50"
              iconColor="text-pink-500"
              title="Bemor tug'ilgan kuni avtomatik tarzda tabrik SMS yuboriladi."
              subtitle="Tug'ilgan kunga tabriklash"
              checked={settings.birthday_greetings}
              onChange={v => update('birthday_greetings', v)}
            />
            <ToggleRow
              icon={RefreshCw}
              iconBg="bg-teal-50"
              iconColor="text-teal-500"
              title="Bemorni qayta ko'rikka chaqirish uchun eslatma SMS xabari avtomatik yuboriladi."
              subtitle="Qayta ko'rik uchun xabar yuborish"
              checked={settings.recall_reminder}
              onChange={v => update('recall_reminder', v)}
            />
            <ToggleRow
              icon={CreditCard}
              iconBg="bg-red-50"
              iconColor="text-red-400"
              title="Qarzdor bemorlar to'lovni eslatuvchi SMS xabari avtomatik tarzda jo'natiladi."
              subtitle="Qarzdor bemorlarga xabar jo'natish"
              checked={settings.debt_reminder}
              onChange={v => update('debt_reminder', v)}
            />

            {/* Eskiz.com Info */}
            <div className="mt-4 bg-purple-50 border border-purple-100 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-purple-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[12px] font-bold text-purple-700">Eskiz.com orqali yuboriladi</p>
                  <p className="text-[11px] text-purple-500 mt-0.5 leading-relaxed">
                    SMS xabarlar O'zbekiston raqamlariga Eskiz.com servisi orqali yuboriladi.
                    API sozlamalari backend .env faylida (ESKIZ_EMAIL, ESKIZ_PASSWORD).
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Save Button ── */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-8 pt-3 bg-gradient-to-t from-[#F4F5FA] via-[#F4F5FA]/95 to-transparent">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          disabled={isSaving}
          className={`w-full py-4 rounded-2xl text-white font-black text-[15px] tracking-tight transition-colors flex items-center justify-center gap-2 shadow-lg ${
            saved
              ? 'bg-emerald-500 shadow-emerald-200'
              : 'bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] shadow-purple-300'
          }`}
        >
          {isSaving ? (
            <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : saved ? (
            <><CheckCircle2 className="w-5 h-5" /> Saqlandi!</>
          ) : (
            <><Save className="w-4 h-4" /> Saqlamoq</>
          )}
        </motion.button>
      </div>
    </div>
  );
}
