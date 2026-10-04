import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, CheckCircle2, CreditCard, Loader2, Lock, ShieldCheck, ArrowLeft, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CONSENT_TEXT, CONSENT_VERSION, LEGAL_LINKS, MOCK_SMS_CODE } from '@/config/cardBinding';
import { requestCard, verifyCard, luhnValid } from '@/api/cardBindingClient';
import { formatSoom } from '@/config/landingPricing';

const NAVY = 'bg-[#0b2a4a] hover:bg-[#10375f]';

function formatCard(v) {
  return v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
}
function formatExpiry(v) {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}
function formatDate(date) {
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
}

/**
 * Ro'yxatdan o'tishning 2-qadami: "14 kunlik bepul sinov uchun kartangizni kiriting".
 * Karta raqami faqat shu komponentning xotirasida (React state) turadi va Click'ga ketadi;
 * tasdiqlangach darhol tozalanadi. CVV so'ralmaydi.
 */
export default function CardBindingStep({ plan, mode, trialDays, submitting, submitError, onBack, onComplete }) {
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [phase, setPhase] = useState('card'); // card | sms | verified
  const [cardToken, setCardToken] = useState('');
  const [phoneMask, setPhoneMask] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [proof, setProof] = useState('');
  const [maskedPan, setMaskedPan] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const isMock = mode !== 'live';
  const firstCharge = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + trialDays);
    return d;
  }, [trialDays]);

  useEffect(() => () => { setCardNumber(''); }, []);

  const sendSms = async (e) => {
    e?.preventDefault();
    setError('');
    const digits = cardNumber.replace(/\D/g, '');
    if (digits.length !== 16) return setError("Karta raqamini to'liq kiriting (16 raqam)");
    if (!isMock && !luhnValid(digits)) return setError("Karta raqami noto'g'ri");
    const m = Number(expiry.slice(0, 2));
    if (!/^\d{2}\/\d{2}$/.test(expiry) || m < 1 || m > 12) return setError("Amal qilish muddatini OO/YY ko'rinishida kiriting");
    setBusy(true);
    try {
      const r = await requestCard(mode, { cardNumber: digits, expiry });
      setCardToken(r.card_token);
      setPhoneMask(r.phone_mask || '');
      setPhase('sms');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmSms = async (e) => {
    e?.preventDefault();
    setError('');
    if (!/^\d{4,8}$/.test(smsCode)) return setError("SMS-kodni kiriting");
    setBusy(true);
    try {
      const r = await verifyCard(mode, { cardToken, smsCode, expiry });
      setProof(r.proof);
      setMaskedPan(r.masked_pan || '');
      setCardNumber(''); // karta raqamini xotiradan olib tashlaymiz
      setSmsCode('');
      setPhase('verified');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const canContinue = phase === 'verified' && consent && !busy && !submitting;
  const shownError = error || submitError;

  return (
    <div className="space-y-3.5">
      {isMock && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] font-bold leading-snug text-amber-800" data-testid="test-mode-banner">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" />
          <span>TEST REJIM — Click ulanmagan. Haqiqiy karta tekshirilmaydi va pul yechilmaydi. SMS-kod: <b>{MOCK_SMS_CODE}</b></span>
        </div>
      )}

      {/* Qadamlar */}
      <div className="flex items-center justify-center gap-2 text-[10px] font-extrabold uppercase tracking-wider">
        <span className="flex items-center gap-1 text-teal-700"><CheckCircle2 className="h-3.5 w-3.5" /> Ma'lumotlar</span>
        <span className="h-px w-6 bg-slate-300" />
        <span className="rounded-full bg-[#0b2a4a] px-2.5 py-1 text-white">2 · Karta</span>
      </div>

      {/* Xulosa */}
      <div className="rounded-2xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #0b2a4a 0%, #0b4a6e 55%, #0e7490 100%)' }} data-testid="plan-summary">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-teal-200">Tanlangan tarif</p>
            <p className="text-lg font-black leading-tight">{plan.name}</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-black leading-tight">{formatSoom(plan.priceUzs)}</p>
            <p className="text-[10px] font-semibold text-white/70">so'm / oyiga</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-[12px] font-semibold">
          <CalendarClock className="h-4 w-4 shrink-0 text-teal-200" />
          <span>Birinchi yechilish: <b data-testid="first-charge-date">{formatDate(firstCharge)}</b> · bugun pul yechilmaydi</span>
        </div>
      </div>

      <h3 className="text-center text-[15px] font-black leading-snug text-slate-900">
        {trialDays} kunlik bepul sinov uchun kartangizni kiriting
      </h3>

      {phase === 'card' && (
        <form onSubmit={sendSms} className="space-y-3" autoComplete="on">
          <div className="space-y-1">
            <Label className="ml-1 text-[9px] font-black uppercase tracking-widest text-slate-400">Karta raqami (Uzcard / Humo)</Label>
            <div className="relative">
              <CreditCard className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
              <Input
                inputMode="numeric" autoComplete="cc-number" placeholder="8600 0000 0000 0000" maxLength={19}
                value={cardNumber} onChange={(e) => setCardNumber(formatCard(e.target.value))}
                className="h-11 rounded-xl border-none bg-slate-50 pl-10 text-sm font-bold tracking-wider" data-testid="card-number"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="ml-1 text-[9px] font-black uppercase tracking-widest text-slate-400">Amal qilish muddati</Label>
            <Input
              inputMode="numeric" autoComplete="cc-exp" placeholder="OO/YY" maxLength={5}
              value={expiry} onChange={(e) => setExpiry(formatExpiry(e.target.value))}
              className="h-11 w-32 rounded-xl border-none bg-slate-50 text-sm font-bold tracking-wider" data-testid="card-expiry"
            />
          </div>
          <Button type="submit" disabled={busy} className={`h-11 w-full rounded-xl text-xs font-black uppercase tracking-widest text-white ${NAVY}`} data-testid="send-sms">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'SMS-kod yuborish'}
          </Button>
        </form>
      )}

      {phase === 'sms' && (
        <form onSubmit={confirmSms} className="space-y-3">
          <p className="text-center text-[12px] font-semibold text-slate-500">
            Click SMS-kodni {phoneMask ? <b className="text-slate-800">{phoneMask}</b> : 'karta telefoniga'} raqamiga yubordi
          </p>
          <Input
            inputMode="numeric" autoComplete="one-time-code" placeholder="SMS-kod" maxLength={8}
            value={smsCode} onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, ''))}
            className="h-12 rounded-xl border-none bg-slate-50 text-center text-lg font-black tracking-[0.4em]" data-testid="sms-code"
          />
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => { setPhase('card'); setSmsCode(''); setError(''); }} className="h-11 rounded-xl text-xs font-bold text-slate-500">
              Kartani o'zgartirish
            </Button>
            <Button type="submit" disabled={busy} className={`h-11 flex-1 rounded-xl text-xs font-black uppercase tracking-widest text-white ${NAVY}`} data-testid="verify-sms">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Tasdiqlash'}
            </Button>
          </div>
        </form>
      )}

      {phase === 'verified' && (
        <div className="flex items-center gap-2.5 rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-3" data-testid="card-verified">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-teal-600" />
          <div className="min-w-0 text-[12px] font-bold text-teal-900">
            Karta tasdiqlandi{maskedPan ? <span className="ml-1 font-black tracking-wide">· {maskedPan}</span> : null}
          </div>
        </div>
      )}

      {shownError && (
        <p className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-600" role="alert">{shownError}</p>
      )}

      {/* Majburiy rozilik */}
      <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3">
        <input
          type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-teal-600" data-testid="consent-checkbox"
        />
        <span className="text-[12px] font-semibold leading-snug text-slate-700">
          {CONSENT_TEXT}.{' '}
          <Link to={LEGAL_LINKS.offer} target="_blank" className="font-bold text-teal-700 underline">Oferta</Link>
          {' · '}
          <Link to={LEGAL_LINKS.privacy} target="_blank" className="font-bold text-teal-700 underline">Maxfiylik siyosati</Link>
        </span>
      </label>

      <Button
        type="button" disabled={!canContinue} onClick={() => onComplete({ proof, consentVersion: CONSENT_VERSION, maskedPan })}
        className={`h-12 w-full rounded-xl text-xs font-black uppercase tracking-widest text-white disabled:opacity-40 ${NAVY}`} data-testid="finish-button"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "CRM'ga kirish"}
      </Button>

      <button type="button" onClick={onBack} disabled={submitting} className="mx-auto flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-teal-600">
        <ArrowLeft className="h-3.5 w-3.5" /> Ma'lumotlarga qaytish
      </button>

      <p className="flex items-center justify-center gap-1.5 text-center text-[10px] font-semibold leading-snug text-slate-400">
        <Lock className="h-3 w-3 shrink-0" /> Karta ma'lumoti Click'ga uzatiladi, bizda saqlanmaydi (faqat token va oxirgi 4 raqam).
        <ShieldCheck className="h-3 w-3 shrink-0" />
      </p>
    </div>
  );
}
