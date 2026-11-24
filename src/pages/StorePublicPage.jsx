import { useEffect, useState } from 'react';
import { MyClinicLogoImage } from '@/components/ui/ShifoCrmLogo';

/**
 * Public store pages. /maxfiylik stays the short card-binding notice.
 * /privacy and /delete-account are the URLs required by the app stores.
 */
const COPY = {
  uz: {
    privacyTitle: 'Maxfiylik siyosati',
    deleteTitle: 'Hisobni o‘chirish',
    privacy: [
      ['Ilova', 'My Clinic — stomatologiya klinikalari xodimlari uchun CRM. Hisobni klinika administratori veb-ilovada ochadi. Mobil ilova yangi hisob yaratmaydi.'],
      ['Qanday ma’lumot', 'Klinika ID, login va sessiya; xodimning ismi va telefoni; bemor ismi, telefoni, qabul va to‘lov yozuvlari. Parol qurilmada saqlanmaydi. Sessiya qurilmaning himoyalangan xotirasida turadi.'],
      ['Maqsad', 'Ma’lumot faqat klinika ishini yuritish uchun ishlatiladi. Reklama uchun yig‘ilmaydi va sotilmaydi.'],
      ['Karta', 'Mobil ilova karta raqami va CVV ni so‘ramaydi. Obuna to‘lovi veb-ilova va to‘lov provayderi orqali o‘tadi.'],
      ['Saqlash', 'Ma’lumot klinikaning server hisobida saqlanadi va uzatishda HTTPS bilan himoyalanadi.'],
      ['Aloqa', 'Savollar: https://t.me/dentist_shaxin'],
    ],
    deletion: [
      ['Ilovaning ichida', 'Hisob bo‘limida «Hisobni o‘chirish» ni bosing va tasdiqlash oynasida «O‘chirish» ni tanlang. Parol so‘ralmaydi.'],
      ['Nima o‘chadi', 'Xodim logini yopiladi. Bemorlar, qabullar va to‘lovlar o‘chirilmaydi. Oxirgi administrator bo‘lsa, login yopiladi va klinika saqlanadi.'],
      ['Agar server hali tayyor bo‘lmasa', 'Ilova so‘rovni qayd etadi va qo‘llab-quvvatlash havolasini ko‘rsatadi.'],
      ['Hisobsiz so‘rov', 'Ilovaga kira olmasangiz, klinika ID va loginni https://t.me/dentist_shaxin ga yozing. Parolni yozmang.'],
    ],
  },
  ru: {
    privacyTitle: 'Политика конфиденциальности',
    deleteTitle: 'Удаление аккаунта',
    privacy: [
      ['Приложение', 'My Clinic — CRM для сотрудников стоматологических клиник. Учётную запись создаёт администратор в веб-версии. Мобильное приложение новые аккаунты не регистрирует.'],
      ['Какие данные', 'ID клиники, логин и сессия; имя и телефон сотрудника; имя и телефон пациента, записи о приёмах и оплатах. Пароль на устройстве не хранится. Сессия лежит в защищённом хранилище устройства.'],
      ['Цель', 'Данные используются только для работы клиники. Они не собираются для рекламы и не продаются.'],
      ['Карта', 'Мобильное приложение не запрашивает номер карты и CVV. Оплата подписки проходит через веб-приложение и платёжного провайдера.'],
      ['Хранение', 'Данные хранятся на сервере клиники и передаются по HTTPS.'],
      ['Контакт', 'Вопросы: https://t.me/dentist_shaxin'],
    ],
    deletion: [
      ['В приложении', 'Откройте «Аккаунт» → «Удалить аккаунт» и подтвердите в окне. Пароль не запрашивается.'],
      ['Что удаляется', 'Закрывается логин сотрудника. Пациенты, приёмы и оплаты не удаляются. Если это последний администратор, вход закрывается, а клиника сохраняется.'],
      ['Если сервер ещё не готов', 'Приложение сохраняет запрос и показывает ссылку на поддержку.'],
      ['Без входа', 'Если войти не получается, напишите ID клиники и логин на https://t.me/dentist_shaxin. Пароль не отправляйте.'],
    ],
  },
  en: {
    privacyTitle: 'Privacy policy',
    deleteTitle: 'Delete your account',
    privacy: [
      ['The app', 'My Clinic is a CRM for dental clinic staff. An administrator creates the account in the web app. The mobile app does not register new accounts.'],
      ['Data', 'Clinic ID, username, and session; staff name and phone; patient name, phone, visits, and payments. The password is not stored on the device. The session stays in the device secure store.'],
      ['Purpose', 'Data is used only to run the clinic. It is not collected for advertising and it is not sold.'],
      ['Cards', 'The mobile app does not ask for a card number or CVV. Subscription billing goes through the web app and the payment provider.'],
      ['Storage', 'Data is stored on the clinic server and sent over HTTPS.'],
      ['Contact', 'Questions: https://t.me/dentist_shaxin'],
    ],
    deletion: [
      ['In the app', 'Open Account, tap Delete account, and confirm in the dialog. No password is asked.'],
      ['What is removed', 'The staff login is closed. Patients, visits, and payments are not deleted. If this is the last administrator, sign-in closes and the clinic is kept.'],
      ['If the server is not ready', 'The app records the request and shows the support link.'],
      ['Without signing in', 'If you cannot sign in, send the clinic ID and username to https://t.me/dentist_shaxin. Do not send the password.'],
    ],
  },
};

const LANGS = [
  ['uz', 'O‘zbek'],
  ['ru', 'Русский'],
  ['en', 'English'],
];

export default function StorePublicPage({ page = 'privacy' }) {
  const [lang, setLang] = useState('uz');
  const copy = COPY[lang] || COPY.uz;
  const isDelete = page === 'delete';
  const title = isDelete ? copy.deleteTitle : copy.privacyTitle;
  const sections = isDelete ? copy.deletion : copy.privacy;

  useEffect(() => {
    const prev = document.title;
    document.title = `${title} — My Clinic`;
    return () => { document.title = prev; };
  }, [title]);

  return (
    <div className="min-h-full overflow-y-auto bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-2xl">
        <div className="mb-4 flex gap-2">
          {LANGS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setLang(id)}
              className={`rounded-full px-3 py-1 text-xs font-bold ${lang === id ? 'bg-[#1499AD] text-white' : 'bg-white text-slate-600'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="rounded-3xl border border-white bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-9">
          <MyClinicLogoImage variant="light" className="mb-5 h-12 w-auto" />
          <h1 className="text-2xl font-black tracking-tight">{title}</h1>
          <div className="mt-6 space-y-5">
            {sections.map(([heading, body]) => (
              <section key={heading}>
                <h2 className="text-sm font-extrabold text-[#0E7484]">{heading}</h2>
                <p className="mt-1 text-sm font-medium leading-relaxed text-slate-600">{body}</p>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
