# 💎 Dental CRM: Professional Marketing Integratsiyasi

Ushbu hujjat Facebook va Instagram reklama kampaniyalaridan kelayotgan arizalarni (Leads) **Dental CRM** tizimiga avtomatik integratsiya qilish bo'yicha professional yo'riqnomadir.

---

## 🛠 Texnologik Arxitektura

Integratsiya quyidagi zanjir bo'yicha ishlaydi:
1. **Source**: Facebook/Instagram Lead Ads
2. **Bridge**: [Make.com](https://make.com) (Automation platform)
3. **Destination**: Dental CRM API (Supabase REST)

---

## 🏗 Integratsiya Bosqichlari

### 1-Bosqich: Bridge (Make.com) Sozlamalari
*   **Make.com** platformasida yangi ssenariy (Scenario) yarating.
*   **Trigger** moduli sifatida `Facebook Lead Ads` ni qo'shing.
*   Klinika sahifasini va reklama ketayotgan shaklni (Form) tanlang.

### 2-Bosqich: HTTP Connect (Ma'lumotlarni yuborish)
Ikkinchi modul sifatida `HTTP > Make a Request` modulini qo'shing va quyidagi mezonlar asosida sozlang:

#### 📡 Tarmoq Sozlamalari (API Credentials):
Mobil ilovangizning **Marketing** bo'limidagi kodlarni quyidagi tartibda kiriting:

*   **URL (Endpoint)**: `[Sizning_API_URL]/rest/v1/leads`
*   **Method**: `POST`
*   **Headers**:
    *   `apikey`: `[API_ANON_KEY]`
    *   `Authorization`: `Bearer [API_ANON_KEY]`
    *   `Content-Type`: `application/json`
    *   `Prefer`: `return=representation`

#### 📦 Ma'lumotlar Paketi (JSON Body):
`Request content` qismiga quyidagi tuzilmani kiriting:

```json
{
  "clinic_id": "ava-dent",
  "name": "{{1.full_name}}",
  "phone": "{{1.phone_number}}",
  "source": "Facebook Ads Professional",
  "status": "new",
  "notes": "Kelgan vaqti: {{1.created_time}}"
}
```

---

## 🛡 Xavfsizlik va Barqarorlik
*   **End-to-End Encryption**: Ma'lumotlar HTTPS protokoli orqali shifrlangan holda yuboriladi.
*   **Real-time Monitoring**: Arizalar tushishi bilan tizimda "Yangi Lid" statusi bilan ko'rinadi.
*   **Auto-scaling**: Bir vaqtning o'zida yuzlab arizalarni qabul qilish quvvatiga ega.

---

## 🆘 Yordam va Qo'llab-quvvatlash
Agar integratsiya jarayonida muammo yuzaga kelsa, quyidagilarni tekshiring:
1. **API Key**: Kalit nusxalashda bo'sh joylar qolib ketmaganiga ishonch hosil qiling.
2. **Clinic ID**: Faqat sizga tegishli bo'lgan identifikatorni kiriting.
3. **Facebook Token**: Make.com ichida Facebook sahifangizga ruxsat muddati tugamaganligini tekshiring.

---
*Professional Dental Clinic Management Solution*
*Versiya: 4.0.0*
