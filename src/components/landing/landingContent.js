/**
 * Landing matnlari (o'zbekcha). Faqat ilovada HAQIQATAN mavjud imkoniyatlar.
 * Hech qanday to'qilgan statistika, mijoz fikri yoki raqam yo'q.
 * icon — lucide-react nomi (Landing.jsx ICONS xaritasi).
 */
import { TRIAL_DAYS } from '@/config/landingPricing';

export const NAV_LINKS = [
  { id: 'imkoniyatlar', label: 'Imkoniyatlar' },
  { id: 'tariflar', label: 'Tariflar' },
  { id: 'faq', label: 'FAQ' },
];

export const HERO = {
  badge: 'Stomatologik klinikalar uchun CRM',
  titleLead: "Qog'oz daftarni unuting —",
  titleAccent: 'klinikangiz bir joyda, nazoratda',
  text:
    "Bemorlar, FDI tish xaritasi, davolash rejalari, uchrashuvlar setkasi, to'lovlar va qarzlar — hammasi telefon va kompyuteringizda. Telegram orqali bemorga avtomatik eslatma ketadi.",
  primaryCta: `${TRIAL_DAYS} kun bepul boshlash`,
  secondaryCta: "Imkoniyatlarni ko'rish",
  perks: ["Kredit karta shart emas", "Telefonda to'liq ishlaydi", "O'zbek tilida"],
};

export const QUICK_FACTS = [
  { icon: 'tooth', title: 'FDI tish xaritasi', text: 'Kattalar va sut tishlari' },
  { icon: 'send', title: 'Telegram eslatmalar', text: 'Bemor kelishni unutmaydi' },
  { icon: 'wallet', title: "Qarzlar nazorati", text: "Hech bir so'm yo'qolmaydi" },
  { icon: 'staff', title: 'Xodimlar va ish haqi', text: 'Hisob-kitob avtomatik' },
];

export const PROBLEMS = {
  eyebrow: 'Tanish holatlarmi?',
  title: "Har bir stomatolog duch keladigan muammolar",
  text: "Daftar, Excel va telefon eslatmalari bilan klinikani boshqarish qimmatga tushadi. SHIFO CRM har birini hal qiladi.",
  items: [
    {
      icon: 'book',
      pain: "Qog'oz daftar va kartalar",
      detail: "Bemor kartasi yo'qoladi, qidirish uzoq, davolash tarixini topib bo'lmaydi.",
      fix: "Barcha bemorlar bazada: ism, telefon, tarix, rentgen — bir qidiruvda.",
    },
    {
      icon: 'coins',
      pain: "Qarzlar yo'qolib ketadi",
      detail: "Kim qancha qarz — esda yoki daftarda. Eslatmasangiz, pul qaytmaydi.",
      fix: "Qarzdorlar ro'yxati va har bir bemorning qoldig'i doim ko'z oldingizda.",
    },
    {
      icon: 'userx',
      pain: "Bemor kelmay qoladi",
      detail: "Kreslo bo'sh, vaqt va daromad yo'qoladi, kunlik reja buziladi.",
      fix: "Telegram orqali avtomatik eslatma, kelmaganlar ro'yxati va qayta chaqirish.",
    },
    {
      icon: 'tags',
      pain: "Narxlar chalkashadi",
      detail: "Har bir shifokor boshqacha narx aytadi, bemor bilan tushunmovchilik chiqadi.",
      fix: "Yagona xizmatlar narxlari ro'yxati — reja va to'lov shundan hisoblanadi.",
    },
    {
      icon: 'tooth',
      pain: "Tish xaritasi va davolash rejasi",
      detail: "Qaysi tish davolangan, keyingi bosqich nima — qog'ozda yo'qoladi.",
      fix: "FDI tish xaritasi, tish tarixi va bosqichma-bosqich davolash rejalari.",
    },
    {
      icon: 'wallet',
      pain: "To'lovlar nazoratsiz",
      detail: "Kassada qancha, kim qancha to'ladi — oy oxirida hisob mos kelmaydi.",
      fix: "Naqd, karta va o'tkazma to'lovlari bemor va reja bo'yicha aniq yoziladi.",
    },
  ],
};

/** plan: faqat tarif ro'yxatlariga mos belgi (Basic / Pro), aniq bo'lmasa yo'q. */
export const FEATURES = {
  eyebrow: 'Imkoniyatlar',
  title: 'Klinikangiz uchun kerak bo\'lgan hamma narsa',
  text: "Quyidagi barcha bo'limlar SHIFO CRM ichida tayyor — alohida dastur o'rnatish shart emas.",
  items: [
    {
      icon: 'users', title: 'Bemorlar bazasi', plan: 'Basic',
      points: ["Bemor kartasi: telefon, manzil, izohlar", "Tez qidiruv va Excel'ga eksport", "Davolash va to'lov tarixi bir joyda", "Telegram profilini bog'lash"],
    },
    {
      icon: 'tooth', title: 'Tish xaritasi (FDI)', plan: 'Basic',
      points: ["Kattalar tishlari FDI raqamlari bilan", "Sut tishlari yoshga qarab avtomatik chiqadi", "Har bir tishning tarixi va holati", "Tishga davolash va xizmat biriktirish"],
    },
    {
      icon: 'clipboard', title: 'Davolash rejalari', plan: 'Basic',
      points: ["Bosqichma-bosqich reja va narx", "Bosqichlar bajarilishi kuzatiladi", "Reja bo'yicha to'lov va qoldiq", "Bemorga aniq tushuntirish uchun"],
    },
    {
      icon: 'implant', title: 'Implantlar', plan: 'Pro',
      points: ["Alohida implantlar bo'limi", "Jag sxemasi FDI raqamlari bilan", "Klinik pasport: tizim, lot, torque, ISQ", "PDF implant pasporti"],
    },
    {
      icon: 'grid', title: 'Uchrashuvlar setkasi', plan: 'Basic',
      points: ["Shifokorlar bo'yicha kunlik setka", "Bugungi navbat — kreslo yonida", "Qabulni tez qo'shish va tasdiqlash holati", "Telefon va kompyuterda qulay"],
    },
    {
      icon: 'wallet', title: "To'lovlar va qarzlar", plan: 'Basic',
      points: ["Naqd, karta, o'tkazma to'lovlari", "Qarzdorlar ro'yxati va qoldiq", "Reja va xizmat bo'yicha taqsimlash", "Xizmatlar narxlari ro'yxati"],
    },
    {
      icon: 'send', title: 'Telegram eslatmalar',
      points: ["Qabuldan 2 soat oldin tasdiqlash xabari", "Ertalab 07:00 da bugungi qabul eslatmasi", "Qayta chaqirish (recall) tizimi", "SMS sozlamalari va yuborilgan xabarlar"],
    },
    {
      icon: 'staff', title: 'Xodimlar, ish haqi, xarajatlar', plan: 'Pro',
      points: ["Shifokor va xodimlar ro'yxati", "Ish haqi hisobi (ulush asosida)", "Klinika xarajatlari hisobi", "Lab / texniklar bilan ishlar"],
    },
    {
      icon: 'package', title: 'Ombor va hisobotlar', plan: 'Pro',
      points: ["Materiallar ombori va qoldiq", "Daromad va xarajat hisobotlari", "Kelgan / kelmagan bemorlar statistikasi", "Dashboard: bugungi ko'rsatkichlar"],
    },
    {
      icon: 'leads', title: 'Lidlar, kelmaganlar, kuzatuv', plan: 'Pro',
      points: ["Yangi murojaatlar (lidlar) voronkasi", "Kelmay qolgan bemorlar ro'yxati", "Davolanishni kuzatish", "Bemorni qaytarish eslatmalari"],
    },
    {
      icon: 'target', title: 'Marketing va "Mening keyslarim"', plan: 'Pro',
      points: ["Marketing bo'limi", "Davolash natijalari portfoliosi (keyslar)", "Klinikaning ochiq sahifasi", "Telegram / Instagram havolalari"],
    },
    {
      icon: 'key', title: 'Kirish huquqlari', plan: 'Pro',
      points: ["Xodimga sahifa bo'yicha ruxsat berish", "Shifokor uchun alohida cheklangan kirish", "Admin va shifokor rollari", "Ma'lumotlar o'z klinikangiz doirasida"],
    },
    {
      icon: 'file', title: 'Rentgen, rozilik, imzo', plan: 'Basic',
      points: ["Bemor rentgenlarini yuklash va ko'rish", "Rozilik shakli va elektron imzo", "Davolash fotolari (keyslar)", "Hammasi bemor kartasida"],
    },
  ],
  extras: [
    "Telefon, planshet va kompyuterda ishlaydi",
    "Ilova kabi o'rnatiladi (PWA)",
    "O'zbek va rus tillari",
    "Bulutda saqlanadi — kerakli joydan kirasiz",
  ],
};

export const SHOWCASE = {
  eyebrow: 'Ilova ichida',
  title: 'Mana shunday ko\'rinadi',
  text: "Tushunarli, toza interfeys: shifokor ham, administrator ham birinchi kundan ishlay oladi.",
  note: "Quyidagi ekranlar namunaviy ma'lumotlar bilan ko'rsatilgan.",
};

export const STEPS = {
  eyebrow: 'Qanday ishlaydi',
  title: "3 qadamda ishga tushing",
  items: [
    {
      icon: 'rocket',
      title: "Ro'yxatdan o'ting",
      text: `Klinika nomi, ID, login va parol — bir necha daqiqa. ${TRIAL_DAYS} kunlik bepul sinov darrov boshlanadi.`,
    },
    {
      icon: 'sliders',
      title: 'Klinikani sozlang',
      text: "Xizmatlar narxlarini kiriting, shifokor va xodimlarni qo'shing, bemorlaringizni kiriting.",
    },
    {
      icon: 'check',
      title: 'Ishlashni boshlang',
      text: "Qabul oling, tish xaritasiga yozing, to'lovni qayd eting — eslatmalar o'zi ketadi.",
    },
  ],
};

export const BENEFITS = {
  eyebrow: 'Sizga nima beradi',
  title: 'Natija — tartib, vaqt va nazorat',
  text: "Bu raqamlar emas, ilovaning amaldagi imkoniyatlaridan keladigan foyda.",
  items: [
    { icon: 'clock', title: "Vaqt tejaladi", text: "Kartani qidirish, qayta yozish va qo'ng'iroq qilish o'rniga — bir bosish." },
    { icon: 'coins', title: "Pul nazoratda", text: "To'lov va qarzlar aniq, kassa va hisobotlar doim mos keladi." },
    { icon: 'heart', title: "Bemor qaytadi", text: "Eslatma, davolash rejasi va tartibli muomala bemorda ishonch uyg'otadi." },
    { icon: 'shield', title: "Jamoa tartibda", text: "Har kim o'z vazifasini ko'radi: kirish huquqlari xodim bo'yicha belgilanadi." },
  ],
};

export const FAQ = {
  eyebrow: 'FAQ',
  title: "Ko'p so'raladigan savollar",
  items: [
    {
      q: `${TRIAL_DAYS} kunlik bepul sinov qanday ishlaydi?`,
      a: `"Ro'yxatdan o'tish" tugmasini bosing, klinika nomi, ID, login va parolni kiriting — tizimga kirasiz va ${TRIAL_DAYS} kun davomida sinab ko'rasiz. Kredit karta so'ralmaydi. Sinov tanlangan tarifda ochiladi.`,
    },
    {
      q: "Sinov tugagach nima bo'ladi?",
      a: "Davom etish uchun tarif tanlab to'lov qilasiz. To'lov qilinmaguncha tizimga kirish yopiladi va to'lov qilish uchun bog'lanish oynasi ko'rsatiladi.",
    },
    {
      q: "Telefonda ishlaydimi?",
      a: "Ha. SHIFO CRM brauzerda ishlaydi va telefon yoki planshetga ilova kabi o'rnatiladi. Interfeys kichik ekranlar uchun moslashtirilgan.",
    },
    {
      q: "Telegram eslatma qanday ishlaydi?",
      a: "Bemor Telegram-botga ulangach, qabuldan 2 soat oldin tasdiqlash xabari va ertalab 07:00 da bugungi qabul eslatmasi yuboriladi. Bemor kelmay qolishi kamayadi.",
    },
    {
      q: "Eski daftar yoki tizimdagi ma'lumotlarni ko'chirsa bo'ladimi?",
      a: "Premium tarifda eski tizimdan ma'lumotni bepul ko'chirib beramiz. Boshqa tariflar bo'yicha Telegram orqali yozing — yordam beramiz.",
    },
    {
      q: "Bir nechta shifokor va xodim ishlay oladimi?",
      a: "Ha. Pro tarifida 2–5 kreslolik klinika uchun xodimlar, ish haqi va shifokorga alohida cheklangan kirish bor. Katta klinikalar va filiallar uchun Premium tarif.",
    },
    {
      q: "To'lov qanday amalga oshiriladi?",
      a: "Oylik yoki yillik. Yillik to'lovda 2 oy bepul (10 oy narxi). Hozircha to'lov Telegram yoki telefon orqali biz bilan kelishib amalga oshiriladi.",
    },
    {
      q: "Tarifni keyin o'zgartirsam bo'ladimi?",
      a: "Ha, klinika o'sgan sari Basic dan Pro yoki Premium ga o'tishingiz mumkin — biz bilan bog'laning.",
    },
  ],
};

export const FINAL_CTA = {
  title: "Klinikangizni bugun tartibga soling",
  text: `${TRIAL_DAYS} kun bepul sinab ko'ring: daftar, Excel va eslatma qog'ozlarisiz ishlashni his qiling.`,
  primary: `${TRIAL_DAYS} kun bepul boshlash`,
  secondary: 'Telegram orqali savol berish',
};
