// Test lidlarni Supabase bazaga qo'shish skripti
const SUPABASE_URL = 'https://hkkhhnrqzjvhubkqhrhm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhra2hobnJxemp2aHVia3FocmhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMzUyMzAsImV4cCI6MjA5MDcxMTIzMH0._8btS4wMQvGplJA2yaRib9hqy33WvPkJWtexxVj9lvU';

const testLeads = [
  {
    name: "Gulzoda Salimova (Test Video)",
    phone: "+998 99 555 44 33",
    source: "Instagram Reels (Video: Vinirlar uchun Aksiya 15 sek)",
    status: "new",
    clinic_id: "ava-dent",
    notes: "Kampaniya: Qishki Aksiya 2024",
    form_data: {
      "Qaysi xizmat turiga qiziqyapsiz?": "Vinir (Braket emas)",
      "Yoshingiz?": "29",
      "Qaysi hududdansiz?": "Toshkent shahri",
      "Klinikamizga qachon kelmoqchisiz?": "Shu hafta oxirida, shanba kuni"
    },
    created_date: new Date().toISOString()
  },
  {
    name: "Sardor Karimov",
    phone: "+998 90 777 88 99",
    source: "Facebook Video Ads (Video: Premium Implantat)",
    status: "new",
    clinic_id: "ava-dent",
    notes: "Kampaniya: Implant Conversion",
    form_data: {
      "Sizga qaysi mutaxassis kerak?": "Implantolog",
      "Yoshingiz nechida?": "42",
      "Viloyatingiz?": "Xorazm viloyati",
      "Klinikaga kelishingiz maqsadi?": "Konsultatsiya va rentgen"
    },
    created_date: new Date().toISOString()
  },
  {
    name: "Madina Rahimova",
    phone: "+998 91 333 22 11",
    source: "Instagram Stories (Rasm: Tish oqartirish Bleaching)",
    status: "new",
    clinic_id: "ava-dent",
    notes: "",
    form_data: {
      "Xizmat turi?": "Tish oqartirish (Bleaching)",
      "Yoshingiz?": "19",
      "Manzil / Hudud:": "Toshkent shahri",
      "Murojaat sababi?": "Tishlarim sargaygan, tabassum chiroyli bo'lishini xohlayman"
    },
    created_date: new Date().toISOString()
  }
];

async function insertLeads() {
  console.log("📤 Test lidlar qo'shilmoqda...");
  
  const response = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(testLeads)
  });
  
  if (!response.ok) {
    const errText = await response.text();
    console.error("❌ Xato:", response.status, errText);
    return;
  }
  
  const data = await response.json();
  console.log(`✅ ${data.length} ta test lid muvaffaqiyatli qo'shildi!`);
  data.forEach(lead => {
    console.log(`   - ${lead.name} | ${lead.phone} | ${lead.source}`);
    console.log(`     form_data:`, lead.form_data);
  });
}

insertLeads().catch(console.error);
