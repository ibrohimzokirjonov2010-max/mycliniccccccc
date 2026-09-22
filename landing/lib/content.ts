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
    a: "Implant moduli, hisobotlar va odontogram Pro tarifida. Klinika tarifida filial, ombor va prioritet qo'llab-quvvatlash qo'shiladi. Start — bitta shifokor, bemor, navbat va to'lov.",
  },
  {
    q: "Interfeys o'zbek tilidami?",
    a: "Ha. Landing va klinikalar tizimi o'zbek tilida. Qo'llab-quvvatlash ham shu tilda.",
  },
  {
    q: "Obuna qancha muddatga ochiladi?",
    a: "Har bir to'lov 30 kunlik litsenziya ochadi. Narxlar oylik, so'mda: Start 990 000, Pro 1 990 000, Klinika 3 490 000.",
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
