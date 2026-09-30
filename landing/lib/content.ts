export const testimonials = [
  {
    name: "Nilufar Karimova",
    role: "Bosh shifokor, Smile Dental",
    city: "Toshkent",
    quote: "Bemor kartochkasi, navbat va to'lov endi bitta ekranda. Registratura ikki marta so'ramaydi.",
    initials: "NK",
  },
  {
    name: "Jasur Tursunov",
    role: "Implantolog, Nur Stomatologiya",
    city: "Samarqand",
    quote: "Qaysi implant, qaysi tishda, qancha dona — wizarda yoziladi. Exceldagi chalkashlik tugadi.",
    initials: "JT",
  },
  {
    name: "Madina Ergasheva",
    role: "Klinika rahbari, Oila",
    city: "Buxoro",
    quote: "Odontogrammani bemorga bir qarashda ko'rsataman. Davolash rejasi tushunarli bo'ldi.",
    initials: "ME",
  },
  {
    name: "Akmal Karimov",
    role: "Shifokor, Smile Dental Clinic",
    city: "Toshkent",
    quote: "Navbat telefon daftarchasidan chiqdi. Eslatmalar va bekor bo'lgan vaqtlar ko'rinib turadi.",
    initials: "AK",
  },
  {
    name: "Dilnoza Rahimova",
    role: "Menejer, White Line",
    city: "Andijon",
    quote: "Oylik tushum va bandlik hisoboti ertaga qoldirilmaydi. Rahbar qarori raqam bilan chiqadi.",
    initials: "DR",
  },
] as const;

export const faqs = [
  {
    q: "14 kunlik bepul sinov qanday ochiladi?",
    a: "Ro'yxatdan o'tishda ism, parol va klinika yoki shifokor nomini qoldirasiz. Telefon yoki email bilan keyin kirasiz. Sinov darhol ochiladi va 14 kun CRM ishlaydi. Parol ochiq holda saqlanmaydi.",
  },
  {
    q: "Sinov tugagach nima bo'ladi?",
    a: "14 kun o'tgach kirish yopiladi. Basic, Pro yoki Premium tarifini Payme yoki Click orqali olsangiz, 30 kunlik litsenziya ochiladi.",
  },
  {
    q: "Bu bemorlar uchun saytmi?",
    a: "Yo'q. SHIFO CRM stomatologiya klinikasi egalari va shifokorlar uchun boshqaruv tizimi. Bemor bu yerdan navbat olmaydi.",
  },
  {
    q: "To'lovdan keyin tarif qachon ochiladi?",
    a: "Payme yoki Click to'lovi webhook orqali tasdiqlangach, tanlangan tarif avtomatik ochiladi. Muvaffaqiyat sahifasida litsenziya kaliti va klinikalar tizimiga kirish havolasi chiqadi.",
  },
  {
    q: "Payme va Click qanday ulanadi?",
    a: "Sotib olish formasida ism, telefon va email qoldirasiz, so'ng Payme yoki Clickni tanlaysiz. Kartani to'lov tizimi o'zi qabul qiladi — karta raqami bu saytda saqlanmaydi.",
  },
  {
    q: "Merchant kalitlari yo'q bo'lsa nima bo'ladi?",
    a: "Demo to'lov yoqiladi. U haqiqiy pul yechmaydi, lekin tarifni xuddi tasdiqlangan to'lovdek ochadi. Kalitlar qo'yilsa, demo yopiladi va haqiqiy webhook ishlaydi.",
  },
  {
    q: "Qaysi tarifda implant moduli bor?",
    a: "Basic: navbat, bemorlar, tish kartasi, davolash rejasi, to'lov va qarz. Pro: implant, xodim, ombor, hisobot, lid va shifokor hisobi. Premium: Pro dagi hamma narsa, ustuvor yordam va moslashtirish.",
  },
  {
    q: "Interfeys o'zbek tilidami?",
    a: "Ha. Landing va klinikalar tizimi o'zbek tilida. Qo'llab-quvvatlash ham shu tilda.",
  },
  {
    q: "Obuna qancha muddatga ochiladi?",
    a: "Har bir to'lov 30 kunlik litsenziya ochadi. Oylik narxlar, so'mda: Basic 99 000, Pro 189 000, Premium 349 000. Yillik to'lov 10 oy — 2 oy bepul.",
  },
  {
    q: "Ma'lumot va to'lov xavfsizmi?",
    a: "Payme Basic auth va Click MD5 imzosi tekshirilmaguncha tarif ochilmaydi. Noto'g'ri summa yoki yaroqsiz imzo rad etiladi. To'lov bekor qilinsa, litsenziya ham yopiladi.",
  },
] as const;

export const benefits = [
  { icon: "clock", title: "Vaqtni tejang", text: "Qidiruvlar va takroriy ishlar yo'qoladi" },
  { icon: "shield", title: "Xatolarni kamaytiring", text: "Aniq ma'lumotlar bilan ishonchli qarorlar" },
  { icon: "chart", title: "Daromadni oshiring", text: "Nazorat va hisobotlar bilan o'sishni boshqaring" },
  { icon: "smile", title: "Bemorlar mamnun", text: "Tez navbat, ravon aloqa, yuqori xizmat sifati" },
] as const;
