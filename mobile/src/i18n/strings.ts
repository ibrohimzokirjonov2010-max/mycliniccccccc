export type Lang = 'uz' | 'ru' | 'en';

export type Dict = {
  brand: string;
  tagline: string;
  locale: string;
  login: {
    title: string;
    subtitle: string;
    clinicId: string;
    username: string;
    password: string;
    show: string;
    hide: string;
    remember: string;
    submit: string;
    noAccount: string;
    privacy: string;
  };
  errors: {
    required: string;
    network: string;
    invalid_credentials: string;
    clinic_not_found: string;
    clinic_inactive: string;
    subscription_expired: string;
    session: string;
    missing_config: string;
    weak_password: string;
    generic: string;
    offline: string;
    phone: string;
    time: string;
    amount: string;
  };
  tabs: { home: string; patients: string; appointments: string; payments: string; account: string };
  common: {
    retry: string;
    save: string;
    cancel: string;
    loading: string;
    empty: string;
    back: string;
    search: string;
    call: string;
    currency: string;
    add: string;
    offline: string;
    doctor: string;
    patient: string;
    status: string;
  };
  home: {
    hello: string;
    today: string;
    appointments: string;
    revenue: string;
    week: string;
    patients: string;
    debt: string;
    next: string;
    noNext: string;
    schedule: string;
    empty: string;
    doctors: string;
  };
  patients: {
    title: string;
    search: string;
    empty: string;
    add: string;
    newTitle: string;
    firstName: string;
    lastName: string;
    phone: string;
    debt: string;
    paid: string;
    none: string;
    visits: string;
    pay: string;
    book: string;
  };
  appointments: {
    title: string;
    empty: string;
    add: string;
    newTitle: string;
    service: string;
    time: string;
    price: string;
    complete: string;
    cancelVisit: string;
    pickPatient: string;
    pickDoctor: string;
  };
  payments: {
    title: string;
    empty: string;
    add: string;
    newTitle: string;
    today: string;
    income: string;
    method: string;
    cash: string;
    card: string;
    transfer: string;
    amount: string;
  };
  doctors: { title: string; empty: string; specialty: string };
  account: {
    title: string;
    clinic: string;
    language: string;
    privacy: string;
    password: string;
    delete: string;
    logout: string;
    version: string;
    roleAdmin: string;
    roleDoctor: string;
    roleStaff: string;
  };
  privacy: { title: string; open: string; sections: { title: string; body: string }[] };
  password: { title: string; next: string; confirm: string; current: string; hint: string; saved: string };
  deleteAccount: {
    title: string;
    body: string;
    typeName: string;
    current: string;
    submit: string;
    doneTitle: string;
    doneBody: string;
    pendingTitle: string;
    pendingBody: string;
    support: string;
    signOut: string;
  };
  status: Record<string, string>;
};

export const uz: Dict = {
  brand: 'My Clinic',
  tagline: 'DENTAL CRM',
  locale: 'uz-UZ',
  login: {
    title: 'Kirish',
    subtitle: 'Klinika ID, login va parol bilan kiring',
    clinicId: 'Klinika ID',
    username: 'Login',
    password: 'Parol',
    show: 'Parolni ko‘rsatish',
    hide: 'Parolni yashirish',
    remember: 'Shu qurilmada eslab qolish',
    submit: 'Kirish',
    noAccount: 'Hisob klinika administratori tomonidan ochiladi. Ilova yangi hisob yaratmaydi.',
    privacy: 'Maxfiylik siyosati',
  },
  errors: {
    required: 'Barcha maydonlarni to‘ldiring',
    network: 'Server bilan aloqa uzildi. Qayta urinib ko‘ring.',
    invalid_credentials: 'Klinika ID, login yoki parol noto‘g‘ri',
    clinic_not_found: 'Klinika topilmadi',
    clinic_inactive: 'Klinika faol emas. Administrator bilan bog‘laning.',
    subscription_expired: 'Obuna muddati tugagan. To‘lovni veb-ilovada yangilang.',
    session: 'Sessiya ochilmadi. Qayta urinib ko‘ring.',
    missing_config: 'Ilova sozlanmagan: EXPO_PUBLIC_SUPABASE_ANON_KEY kerak.',
    weak_password: 'Parol kamida 8 ta belgidan iborat bo‘lsin',
    generic: 'Xatolik yuz berdi. Qayta urinib ko‘ring.',
    offline: 'Internet yo‘q. Ulangach qayta urinib ko‘ring.',
    phone: 'Telefon raqamini to‘liq kiriting',
    time: 'Vaqtni HH:MM ko‘rinishida kiriting',
    amount: 'Summani kiriting',
  },
  tabs: { home: 'Bosh sahifa', patients: 'Bemorlar', appointments: 'Uchrashuvlar', payments: 'To‘lovlar', account: 'Hisob' },
  common: {
    retry: 'Qayta urinish',
    save: 'Saqlash',
    cancel: 'Bekor qilish',
    loading: 'Yuklanmoqda…',
    empty: 'Hozircha ma’lumot yo‘q',
    back: 'Orqaga',
    search: 'Qidirish',
    call: 'Qo‘ng‘iroq',
    currency: 'so‘m',
    add: 'Qo‘shish',
    offline: 'Internet aloqasi yo‘q',
    doctor: 'Shifokor',
    patient: 'Bemor',
    status: 'Holat',
  },
  home: {
    hello: 'Xush kelibsiz',
    today: 'Bugun',
    appointments: 'Bugungi qabullar',
    revenue: 'Bugungi tushum',
    week: '7 kunlik tushum',
    patients: 'Bemorlar',
    debt: 'Qarz',
    next: 'Keyingi bemor',
    noNext: 'Bugun ochiq qabul qolmadi',
    schedule: 'Bugungi jadval',
    empty: 'Bugun uchrashuv yo‘q',
    doctors: 'Shifokorlar',
  },
  patients: {
    title: 'Bemorlar',
    search: 'Ism yoki telefon',
    empty: 'Bemor topilmadi',
    add: 'Yangi bemor',
    newTitle: 'Yangi bemor',
    firstName: 'Ism',
    lastName: 'Familiya',
    phone: 'Telefon',
    debt: 'Qarz',
    paid: 'To‘langan',
    none: 'Raqam yo‘q',
    visits: 'Uchrashuvlar',
    pay: 'To‘lov',
    book: 'Qabul',
  },
  appointments: {
    title: 'Uchrashuvlar',
    empty: 'Bu kunga uchrashuv yo‘q',
    add: 'Yangi uchrashuv',
    newTitle: 'Yangi uchrashuv',
    service: 'Xizmat',
    time: 'Vaqt',
    price: 'Narx',
    complete: 'Yakunlandi',
    cancelVisit: 'Bekor',
    pickPatient: 'Bemorni tanlang',
    pickDoctor: 'Shifokorni tanlang',
  },
  payments: {
    title: 'To‘lovlar',
    empty: 'To‘lovlar yo‘q',
    add: 'To‘lov qabul qilish',
    newTitle: 'Yangi to‘lov',
    today: 'Bugungi tushum',
    income: 'Tushum',
    method: 'Usul',
    cash: 'Naqd',
    card: 'Karta',
    transfer: 'O‘tkazma',
    amount: 'Summa',
  },
  doctors: { title: 'Shifokorlar', empty: 'Shifokor topilmadi', specialty: 'Mutaxassislik' },
  account: {
    title: 'Hisob',
    clinic: 'Klinika',
    language: 'Til',
    privacy: 'Maxfiylik siyosati',
    password: 'Parolni almashtirish',
    delete: 'Hisobni o‘chirish',
    logout: 'Chiqish',
    version: 'Versiya',
    roleAdmin: 'Administrator',
    roleDoctor: 'Shifokor',
    roleStaff: 'Xodim',
  },
  privacy: {
    title: 'Maxfiylik siyosati',
    open: 'To‘liq matnni ochish',
    sections: [
      { title: 'Ilova', body: 'My Clinic — stomatologik klinika CRM. Ilova klinika xodimlari uchun. Hisobni klinika administratori veb-ilovada ochadi.' },
      { title: 'Qanday ma’lumot', body: 'Bemor ismi, telefoni, qabullar va to‘lovlar klinika hisobida saqlanadi. Sessiya shu qurilmaning himoyalangan xotirasida turadi. Supabase service kaliti ilovaga kiritilmaydi.' },
      { title: 'Karta', body: 'Ilova karta raqami va CVV ni so‘ramaydi va saqlamaydi. Obuna to‘lovi veb-ilova va to‘lov provayderi orqali amalga oshiriladi.' },
      { title: 'Hisobni o‘chirish', body: 'Hisob bo‘limida hisobni o‘chirish so‘rovi bor. Server amalni qo‘llasa, hisob o‘chiriladi. Aks holda so‘rov qayd etiladi va klinika administratori yoki qo‘llab-quvvatlash xizmati yakunlaydi.' },
    ],
  },
  password: {
    title: 'Parolni almashtirish',
    current: 'Joriy parol',
    next: 'Yangi parol',
    confirm: 'Yangi parolni tasdiqlang',
    hint: 'Kamida 8 ta belgi',
    saved: 'Parol yangilandi',
  },
  deleteAccount: {
    title: 'Hisobni o‘chirish',
    body: 'Bu amal shu klinika hisobingizga kirishni yopadi. Bemor yozuvlari klinika ma’lumoti bo‘lib qolishi mumkin. Davom etish uchun loginni va joriy parolni kiriting.',
    typeName: 'Loginni tasdiqlang',
    current: 'Joriy parol',
    submit: 'Hisobni o‘chirishni so‘rash',
    doneTitle: 'Hisob o‘chirildi',
    doneBody: 'Hisobingiz o‘chirildi va bu qurilmadagi sessiya yopildi.',
    pendingTitle: 'So‘rov qabul qilindi',
    pendingBody: 'Server hozircha hisobni o‘zi o‘chirmaydi. So‘rov ilovada qayd etildi. Klinika administratori yoki qo‘llab-quvvatlash xizmati uni yakunlashi kerak.',
    support: 'Qo‘llab-quvvatlashga yozish',
    signOut: 'Chiqish',
  },
  status: {
    Scheduled: 'Rejalashtirilgan',
    Waiting: 'Kutilmoqda',
    'In Progress': 'Jarayonda',
    Completed: 'Yakunlandi',
    Cancelled: 'Bekor',
    'No-Show': 'Kelmadi',
    New: 'Yangi',
    Active: 'Faol',
    Inactive: 'Nofaol',
    Income: 'Tushum',
    Debt: 'Qarz',
  },
};

export const ru: Dict = {
  brand: 'My Clinic',
  tagline: 'DENTAL CRM',
  locale: 'ru-RU',
  login: {
    title: 'Вход',
    subtitle: 'Войдите с ID клиники, логином и паролем',
    clinicId: 'ID клиники',
    username: 'Логин',
    password: 'Пароль',
    show: 'Показать пароль',
    hide: 'Скрыть пароль',
    remember: 'Запомнить на этом устройстве',
    submit: 'Войти',
    noAccount: 'Учётную запись создаёт администратор клиники. Приложение не регистрирует новые аккаунты.',
    privacy: 'Политика конфиденциальности',
  },
  errors: {
    required: 'Заполните все поля',
    network: 'Нет связи с сервером. Попробуйте ещё раз.',
    invalid_credentials: 'Неверный ID клиники, логин или пароль',
    clinic_not_found: 'Клиника не найдена',
    clinic_inactive: 'Клиника неактивна. Обратитесь к администратору.',
    subscription_expired: 'Срок подписки истёк. Продлите оплату в веб-приложении.',
    session: 'Не удалось открыть сессию. Попробуйте ещё раз.',
    missing_config: 'Приложение не настроено: нужен EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    weak_password: 'Пароль должен содержать не меньше 8 символов',
    generic: 'Произошла ошибка. Попробуйте ещё раз.',
    offline: 'Нет интернета. Повторите, когда связь появится.',
    phone: 'Введите полный номер телефона',
    time: 'Введите время в формате ЧЧ:ММ',
    amount: 'Введите сумму',
  },
  tabs: { home: 'Главная', patients: 'Пациенты', appointments: 'Приёмы', payments: 'Оплаты', account: 'Аккаунт' },
  common: {
    retry: 'Повторить',
    save: 'Сохранить',
    cancel: 'Отмена',
    loading: 'Загрузка…',
    empty: 'Пока нет данных',
    back: 'Назад',
    search: 'Поиск',
    call: 'Позвонить',
    currency: 'сум',
    add: 'Добавить',
    offline: 'Нет подключения к интернету',
    doctor: 'Врач',
    patient: 'Пациент',
    status: 'Статус',
  },
  home: {
    hello: 'Здравствуйте',
    today: 'Сегодня',
    appointments: 'Приёмы сегодня',
    revenue: 'Выручка сегодня',
    week: 'Выручка за 7 дней',
    patients: 'Пациенты',
    debt: 'Долг',
    next: 'Следующий пациент',
    noNext: 'На сегодня открытых приёмов нет',
    schedule: 'Расписание на сегодня',
    empty: 'На сегодня приёмов нет',
    doctors: 'Врачи',
  },
  patients: {
    title: 'Пациенты',
    search: 'Имя или телефон',
    empty: 'Пациенты не найдены',
    add: 'Новый пациент',
    newTitle: 'Новый пациент',
    firstName: 'Имя',
    lastName: 'Фамилия',
    phone: 'Телефон',
    debt: 'Долг',
    paid: 'Оплачено',
    none: 'Нет номера',
    visits: 'Приёмы',
    pay: 'Оплата',
    book: 'Запись',
  },
  appointments: {
    title: 'Приёмы',
    empty: 'На этот день приёмов нет',
    add: 'Новый приём',
    newTitle: 'Новый приём',
    service: 'Услуга',
    time: 'Время',
    price: 'Цена',
    complete: 'Завершён',
    cancelVisit: 'Отмена',
    pickPatient: 'Выберите пациента',
    pickDoctor: 'Выберите врача',
  },
  payments: {
    title: 'Оплаты',
    empty: 'Оплат нет',
    add: 'Принять оплату',
    newTitle: 'Новая оплата',
    today: 'Выручка сегодня',
    income: 'Приход',
    method: 'Способ',
    cash: 'Наличные',
    card: 'Карта',
    transfer: 'Перевод',
    amount: 'Сумма',
  },
  doctors: { title: 'Врачи', empty: 'Врачи не найдены', specialty: 'Специальность' },
  account: {
    title: 'Аккаунт',
    clinic: 'Клиника',
    language: 'Язык',
    privacy: 'Политика конфиденциальности',
    password: 'Сменить пароль',
    delete: 'Удалить аккаунт',
    logout: 'Выйти',
    version: 'Версия',
    roleAdmin: 'Администратор',
    roleDoctor: 'Врач',
    roleStaff: 'Сотрудник',
  },
  privacy: {
    title: 'Политика конфиденциальности',
    open: 'Открыть полный текст',
    sections: [
      { title: 'Приложение', body: 'My Clinic — CRM для стоматологических клиник. Приложение предназначено для сотрудников. Учётную запись создаёт администратор в веб-версии.' },
      { title: 'Какие данные', body: 'Имя и телефон пациента, приёмы и оплаты хранятся в аккаунте клиники. Сессия хранится в защищённом хранилище устройства. Сервисный ключ Supabase в приложение не встраивается.' },
      { title: 'Карта', body: 'Приложение не запрашивает и не хранит номер карты и CVV. Оплата подписки проходит через веб-приложение и платёжного провайдера.' },
      { title: 'Удаление аккаунта', body: 'В разделе аккаунта есть запрос на удаление. Если сервер поддерживает действие, аккаунт удаляется. Иначе запрос фиксируется, а завершает его администратор клиники или поддержка.' },
    ],
  },
  password: {
    title: 'Сменить пароль',
    current: 'Текущий пароль',
    next: 'Новый пароль',
    confirm: 'Повторите новый пароль',
    hint: 'Не меньше 8 символов',
    saved: 'Пароль обновлён',
  },
  deleteAccount: {
    title: 'Удаление аккаунта',
    body: 'Это закроет доступ этой учётной записи к клинике. Карточки пациентов могут остаться данными клиники. Для продолжения введите логин и текущий пароль.',
    typeName: 'Подтвердите логин',
    current: 'Текущий пароль',
    submit: 'Запросить удаление',
    doneTitle: 'Аккаунт удалён',
    doneBody: 'Учётная запись удалена, сессия на этом устройстве закрыта.',
    pendingTitle: 'Запрос принят',
    pendingBody: 'Сервер пока не удаляет аккаунт сам. Запрос сохранён в приложении. Его должен завершить администратор клиники или поддержка.',
    support: 'Написать в поддержку',
    signOut: 'Выйти',
  },
  status: {
    Scheduled: 'Запланирован',
    Waiting: 'Ожидание',
    'In Progress': 'Идёт приём',
    Completed: 'Завершён',
    Cancelled: 'Отменён',
    'No-Show': 'Не пришёл',
    New: 'Новый',
    Active: 'Активный',
    Inactive: 'Неактивный',
    Income: 'Приход',
    Debt: 'Долг',
  },
};

export const en: Dict = {
  brand: 'My Clinic',
  tagline: 'DENTAL CRM',
  locale: 'en-US',
  login: {
    title: 'Sign in',
    subtitle: 'Use your clinic ID, username, and password',
    clinicId: 'Clinic ID',
    username: 'Username',
    password: 'Password',
    show: 'Show password',
    hide: 'Hide password',
    remember: 'Remember this device',
    submit: 'Sign in',
    noAccount: 'A clinic administrator creates accounts. This app does not register new accounts.',
    privacy: 'Privacy policy',
  },
  errors: {
    required: 'Fill in every field',
    network: 'The server could not be reached. Try again.',
    invalid_credentials: 'Clinic ID, username, or password is incorrect',
    clinic_not_found: 'Clinic was not found',
    clinic_inactive: 'This clinic is inactive. Contact an administrator.',
    subscription_expired: 'The subscription has expired. Renew it in the web app.',
    session: 'The session could not be opened. Try again.',
    missing_config: 'The app is not configured: EXPO_PUBLIC_SUPABASE_ANON_KEY is required.',
    weak_password: 'Use at least 8 characters',
    generic: 'Something went wrong. Try again.',
    offline: 'You are offline. Try again when you are back online.',
    phone: 'Enter the full phone number',
    time: 'Enter a time as HH:MM',
    amount: 'Enter an amount',
  },
  tabs: { home: 'Home', patients: 'Patients', appointments: 'Visits', payments: 'Payments', account: 'Account' },
  account: {
    title: 'Account',
    clinic: 'Clinic',
    language: 'Language',
    privacy: 'Privacy policy',
    password: 'Change password',
    delete: 'Delete account',
    logout: 'Sign out',
    version: 'Version',
    roleAdmin: 'Administrator',
    roleDoctor: 'Doctor',
    roleStaff: 'Staff',
  },
  common: {
    retry: 'Try again',
    save: 'Save',
    cancel: 'Cancel',
    loading: 'Loading…',
    empty: 'Nothing here yet',
    back: 'Back',
    search: 'Search',
    call: 'Call',
    currency: 'UZS',
    add: 'Add',
    offline: 'No internet connection',
    doctor: 'Doctor',
    patient: 'Patient',
    status: 'Status',
  },
  home: {
    hello: 'Welcome',
    today: 'Today',
    appointments: 'Visits today',
    revenue: 'Revenue today',
    week: '7-day revenue',
    patients: 'Patients',
    debt: 'Debt',
    next: 'Next patient',
    noNext: 'No open visits left today',
    schedule: 'Today’s schedule',
    empty: 'No visits today',
    doctors: 'Doctors',
  },
  patients: {
    title: 'Patients',
    search: 'Name or phone',
    empty: 'No patients found',
    add: 'New patient',
    newTitle: 'New patient',
    firstName: 'First name',
    lastName: 'Last name',
    phone: 'Phone',
    debt: 'Debt',
    paid: 'Paid',
    none: 'No number',
    visits: 'Visits',
    pay: 'Payment',
    book: 'Book',
  },
  appointments: {
    title: 'Visits',
    empty: 'No visits on this day',
    add: 'New visit',
    newTitle: 'New visit',
    service: 'Service',
    time: 'Time',
    price: 'Price',
    complete: 'Completed',
    cancelVisit: 'Cancel',
    pickPatient: 'Choose a patient',
    pickDoctor: 'Choose a doctor',
  },
  payments: {
    title: 'Payments',
    empty: 'No payments yet',
    add: 'Take a payment',
    newTitle: 'New payment',
    today: 'Revenue today',
    income: 'Income',
    method: 'Method',
    cash: 'Cash',
    card: 'Card',
    transfer: 'Transfer',
    amount: 'Amount',
  },
  doctors: { title: 'Doctors', empty: 'No doctors found', specialty: 'Specialty' },
  privacy: {
    title: 'Privacy policy',
    open: 'Open the full policy',
    sections: [
      { title: 'The app', body: 'My Clinic is a dental clinic CRM for staff. An administrator creates accounts in the web app. This app does not sign people up.' },
      { title: 'Data', body: 'Patient names, phone numbers, visits, and payments stay in the clinic account. The session is stored in the device secure store. A Supabase service key is never embedded in the app.' },
      { title: 'Cards', body: 'The app does not ask for or store a card number or CVV. Subscription billing happens in the web app through the payment provider.' },
      { title: 'Account deletion', body: 'The account screen includes a deletion request. If the server supports the action, the account is deleted. Otherwise the request is recorded and a clinic administrator or support completes it.' },
    ],
  },
  password: {
    title: 'Change password',
    current: 'Current password',
    next: 'New password',
    confirm: 'Confirm new password',
    hint: 'At least 8 characters',
    saved: 'Password updated',
  },
  deleteAccount: {
    title: 'Delete account',
    body: 'This closes this account’s access to the clinic. Patient records may remain as clinic data. Enter your username and current password to continue.',
    typeName: 'Confirm username',
    current: 'Current password',
    submit: 'Request account deletion',
    doneTitle: 'Account deleted',
    doneBody: 'Your account was deleted and the session on this device was closed.',
    pendingTitle: 'Request recorded',
    pendingBody: 'The server does not delete the account by itself yet. The request is saved in the app. A clinic administrator or support must finish it.',
    support: 'Contact support',
    signOut: 'Sign out',
  },
  status: {
    Scheduled: 'Scheduled',
    Waiting: 'Waiting',
    'In Progress': 'In progress',
    Completed: 'Completed',
    Cancelled: 'Cancelled',
    'No-Show': 'No-show',
    New: 'New',
    Active: 'Active',
    Inactive: 'Inactive',
    Income: 'Income',
    Debt: 'Debt',
  },
};

export const dictionaries: Record<Lang, Dict> = { uz, ru, en };
