import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { MyClinicLogoImage } from '@/components/ui/ShifoCrmLogo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { submitDeletionRequest, DELETION_RETENTION_DAYS } from '@/lib/accountDeletion';

/** Ommaviy "Hisobni o'chirish" sahifasi (Google Play "Delete account URL"). LegalDocs bilan bir xil uslub. */
export default function AccountDeletion() {
  const [form, setForm] = useState({ clinicId: '', username: '', contact: '', scope: 'user', reason: '' });
  const [state, setState] = useState({ sending: false, done: false, url: '' });
  useEffect(() => {
    const prev = document.title;
    document.title = "Hisobni o'chirish — My Clinic";
    return () => { document.title = prev; };
  }, []);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    if (!form.clinicId.trim() || !form.username.trim() || !form.contact.trim()) return;
    setState({ sending: true, done: false, url: '' });
    const res = await submitDeletionRequest({ ...form, source: 'web' });
    setState({ sending: false, done: res.ok, url: res.ok ? '' : res.url });
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50 px-4 py-8 font-inter text-slate-900">
      <div className="mx-auto max-w-2xl">
        <Link to="/login" className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-teal-600">
          <ChevronLeft className="h-4 w-4" /> Kirish sahifasiga qaytish
        </Link>
        <div className="rounded-3xl border border-white bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-9">
          <MyClinicLogoImage variant="light" className="mb-5 h-12 w-auto" />
          <h1 className="text-2xl font-black tracking-tight">Hisobni o'chirish</h1>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">Удаление аккаунта · Delete account</p>
          <div className="mt-6 space-y-5">
            <section>
              <h2 className="text-sm font-extrabold text-teal-700">Qanday ishlaydi</h2>
              <p className="mt-1 text-sm font-medium leading-relaxed text-slate-600">
                Ilovada: Sozlamalar → "Hisobni o'chirish". Yoki quyidagi formani to'ldiring. Biz so'rovni klinika administratori orqali tasdiqlaymiz,
                hisob darhol bloklanadi va {DELETION_RETENTION_DAYS} kun ichida login, profil va (klinika o'chirilsa) barcha bemor yozuvlari, rasmlar,
                qabullar va to'lovlar serverdan butunlay o'chiriladi. Qonun bo'yicha saqlanishi shart bo'lgan moliyaviy hujjatlar bundan mustasno.
              </p>
              <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
                RU: В приложении: Настройки → «Удалить аккаунт», или заполните форму. EN: In the app: Settings → "Delete account", or use this form.
                Data is permanently deleted within {DELETION_RETENTION_DAYS} days.
              </p>
            </section>
            {state.done ? (
              <p className="text-sm font-bold text-teal-700">So'rov qabul qilindi. Request received.</p>
            ) : (
              <form onSubmit={submit} className="space-y-3">
                <div className="space-y-1"><Label className="text-xs font-bold text-slate-600">Klinika ID</Label><Input required value={form.clinicId} onChange={set('clinicId')} className="h-11 rounded-xl" /></div>
                <div className="space-y-1"><Label className="text-xs font-bold text-slate-600">Login</Label><Input required value={form.username} onChange={set('username')} className="h-11 rounded-xl" /></div>
                <div className="space-y-1"><Label className="text-xs font-bold text-slate-600">Telefon yoki email</Label><Input required value={form.contact} onChange={set('contact')} className="h-11 rounded-xl" /></div>
                <div className="flex gap-2">
                  <Button type="button" variant={form.scope === 'user' ? 'default' : 'outline'} onClick={() => setForm((f) => ({ ...f, scope: 'user' }))} className="flex-1 h-10 rounded-xl font-bold text-xs">Faqat mening hisobim</Button>
                  <Button type="button" variant={form.scope === 'clinic' ? 'default' : 'outline'} onClick={() => setForm((f) => ({ ...f, scope: 'clinic' }))} className="flex-1 h-10 rounded-xl font-bold text-xs">Butun klinika</Button>
                </div>
                <div className="space-y-1"><Label className="text-xs font-bold text-slate-600">Sabab (ixtiyoriy)</Label><Input value={form.reason} onChange={set('reason')} className="h-11 rounded-xl" /></div>
                <Button type="submit" disabled={state.sending} className="w-full h-11 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs">
                  {state.sending ? 'Yuborilmoqda...' : "O'chirish so'rovini yuborish"}
                </Button>
                {state.url && (
                  <a href={state.url} target="_blank" rel="noreferrer" className="block text-center text-sm font-bold text-teal-700 underline">
                    Telegram orqali yuborish (qo'llab-quvvatlash)
                  </a>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
