import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { MyClinicLogoImage } from '@/components/ui/ShifoCrmLogo';
import { CONSENT_VERSION } from '@/config/cardBinding';
import { LANDING_PLANS, LANDING_CONTACT, TRIAL_DAYS, formatSoom } from '@/config/landingPricing';

/**
 * Oferta va Maxfiylik siyosati — ro'yxatdan o'tishdagi "avtomatik yechish" roziligi uchun.
 * DIQQAT: bu matn loyiha asosida yozilgan; ommaga ochishdan oldin yurist tekshiruvidan o'tkazing.
 * Matn o'zgarsa CONSENT_VERSION (src/config/cardBinding.js) ni ham oshiring.
 */
const DOCS = {
  offer: {
    title: 'Ommaviy oferta (xizmat ko\'rsatish shartlari)',
    sections: () => [
      ['Xizmat', `My Clinic — stomatologik klinikalar uchun bulutli CRM. Tariflar: ${LANDING_PLANS.map((p) => `${p.name} — ${formatSoom(p.priceUzs)} so'm/oy`).join(', ')}.`],
      ['Bepul sinov', `Ro'yxatdan o'tgach ${TRIAL_DAYS} kunlik bepul sinov ochiladi. Sinov davrida pul yechilmaydi.`],
      ['Avtomatik yechish', `Karta biriktirilgan bo'lsa, sinov tugagan kuni tanlangan tarifning oylik narxi Click orqali shu kartadan avtomatik yechiladi va obuna 1 oyga uzaytiriladi. Keyingi oylar uchun to'lov shartlari to'lov paytida alohida ma'lum qilinadi.`],
      ['Muvaffaqiyatsiz to\'lov', `Pul yechilmasa, hisob "qarzdor" holatiga o'tadi va muddat tugagach kirish yopiladi. Qayta urinishlar qisqa muddat ichida amalga oshirilishi mumkin.`],
      ['Bekor qilish', `Avtomatik yechishni sinov tugashidan oldin qo'llab-quvvatlash xizmatiga (${LANDING_CONTACT.telegramUrl}) yozib bekor qilish mumkin.`],
    ],
  },
  privacy: {
    title: 'Maxfiylik siyosati',
    sections: () => [
      ['Kim uchun', 'My Clinic — stomatologik klinika xodimlari (administrator, shifokor, qabulxona) uchun ish vositasi. Bemorlar ilovadan foydalanmaydi; ularning ma\'lumotlarini klinika kiritadi va klinika ushbu ma\'lumotlar egasi (operatori) hisoblanadi, My Clinic esa ularni klinika topshirig\'i bilan qayta ishlaydi.'],
      ['Bemor ma\'lumotlari (sog\'liq)', 'Klinika kiritadigan: F.I.Sh., telefon, tug\'ilgan sana, jins, manzil, tish formulasi, tashxis va davolash yozuvlari, davolash rejalari, implant pasportlari, rentgen/foto rasmlar, qabullar, to\'lovlar va qarzdorlik. Bu ma\'lumotlar faqat klinika ichida xizmat ko\'rsatish uchun ishlatiladi; reklama uchun ishlatilmaydi, sotilmaydi va uchinchi shaxslarga berilmaydi.'],
      ['Xodim ma\'lumotlari', 'Ism, login, parol (xeshlangan holda), telefon, rol, ish jadvali, profil rasmi.'],
      ['Saqlash va himoya', 'Ma\'lumotlar Supabase (PostgreSQL) bulut bazasida saqlanadi va faqat HTTPS (TLS) orqali uzatiladi. Har bir klinika ma\'lumotlari clinic_id bo\'yicha ajratilgan. Sayt Vercel orqali joylashtirilgan.'],
      ['Uchinchi tomon xizmatlar', 'Supabase (ma\'lumotlar bazasi va fayllar), Vercel (hosting), Click (obuna to\'lovi), Telegram (klinika yoqsa — bemorga eslatma xabarlari). Reklama yoki kuzatuv (tracking) SDK lari ishlatilmaydi.'],
      ['Saqlash muddati va o\'chirish', 'Ma\'lumotlar klinika hisobi faol bo\'lguncha saqlanadi. Ilovada Sozlamalar → "Hisobni o\'chirish" yoki /hisobni-ochirish sahifasi orqali so\'rov yuborilsa, hisob bloklanadi va 30 kun ichida ma\'lumotlar butunlay o\'chiriladi (qonun bo\'yicha saqlanishi shart moliyaviy yozuvlardan tashqari). Bemor o\'z ma\'lumotini o\'chirish uchun o\'z klinikasiga murojaat qiladi.'],
      ['Bolalar', 'Ilova 18 yoshdan katta mutaxassislar uchun mo\'ljallangan.'],
      ['Karta ma\'lumotlari', 'Karta raqami va amal qilish muddati faqat to\'lov provayderi Click ga uzatiladi. My Clinic karta raqamini va CVV ni saqlamaydi va jurnalga yozmaydi.'],
      ['Nimalar saqlanadi', 'Click bergan karta tokeni (faqat server tomonda, yopiq jadvalda), maskalangan karta raqami (oxirgi 4 raqam), amal qilish muddati, rozilik vaqti va rozilik matni versiyasi.'],
      ['Foydalanish maqsadi', 'Saqlangan token faqat tanlangan tarif uchun obuna to\'lovini yechishda ishlatiladi.'],
      ['Aloqa', `Savollar uchun: ${LANDING_CONTACT.telegramUrl}`],
    ],
  },
};

export default function LegalDocs({ doc = 'offer' }) {
  const data = DOCS[doc] || DOCS.offer;
  useEffect(() => {
    const prev = document.title;
    document.title = `${data.title} — My Clinic`;
    return () => { document.title = prev; };
  }, [data.title]);

  return (
    <div className="h-full overflow-y-auto bg-slate-50 px-4 py-8 font-inter text-slate-900">
      <div className="mx-auto max-w-2xl">
        <Link to="/register" className="mb-4 inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-teal-600">
          <ChevronLeft className="h-4 w-4" /> Ro'yxatdan o'tishga qaytish
        </Link>
        <div className="rounded-3xl border border-white bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-9">
          <MyClinicLogoImage variant="light" className="mb-5 h-12 w-auto" />
          <h1 className="text-2xl font-black tracking-tight">{data.title}</h1>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-slate-400">Versiya: {CONSENT_VERSION}</p>
          <div className="mt-6 space-y-5">
            {data.sections().map(([h, t]) => (
              <section key={h}>
                <h2 className="text-sm font-extrabold text-teal-700">{h}</h2>
                <p className="mt-1 text-sm font-medium leading-relaxed text-slate-600">{t}</p>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
