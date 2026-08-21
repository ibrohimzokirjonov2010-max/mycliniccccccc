import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

/**
 * Barcha kategoriyalar uchun to'liq test ma'lumotlari
 */
export const runSeeder = async () => {
  toast.loading("Test ma'lumotlari kiritilmoqda... Bu biroz vaqt olishi mumkin.");
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  
  try {
    // ==================== 1. XIZMATLAR (Services) ====================
    const services = [
      // Terapiya
      { name: 'Karies davolash (oddiy)', category: 'Therapy', duration: 45, price: 250000, is_active: true },
      { name: 'Karies davolash (murakkab)', category: 'Therapy', duration: 60, price: 350000, is_active: true },
      { name: 'Pulpotomiya', category: 'Therapy', duration: 90, price: 450000, is_active: true },
      { name: 'Kanal davolash (1 ta)', category: 'Therapy', duration: 120, price: 600000, is_active: true },
      // Xirurgiya
      { name: 'Tish olish (oddiy)', category: 'Surgery', duration: 30, price: 150000, is_active: true },
      { name: 'Tish olish (murakkab)', category: 'Surgery', duration: 60, price: 300000, is_active: true },
      { name: '8-raqamli tish olish', category: 'Surgery', duration: 90, price: 500000, is_active: true },
      // Gigiena
      { name: 'Tish tozalash (AirFlow)', category: 'Hygiene', duration: 60, price: 300000, is_active: true },
      { name: 'Professional gigiena', category: 'Hygiene', duration: 90, price: 450000, is_active: true },
      { name: 'Chotka va pastani o\'rgatish', category: 'Hygiene', duration: 30, price: 50000, is_active: true },
      // Implantologiya
      { name: 'Implant o\'rnatish (S. Korea)', category: 'Implantology', duration: 90, price: 3500000, is_active: true },
      { name: 'Implant o\'rnatish (USA)', category: 'Implantology', duration: 90, price: 5500000, is_active: true },
      { name: 'Sinus lift', category: 'Implantology', duration: 120, price: 2500000, is_active: true },
      { name: 'Suyak bloki', category: 'Implantology', duration: 150, price: 3000000, is_active: true },
      // Ortopediya
      { name: 'Metallokeramika koronka', category: 'Orthopedics', duration: 60, price: 800000, is_active: true },
      { name: 'Zirkoniy koronka', category: 'Orthopedics', duration: 60, price: 1500000, is_active: true },
      { name: 'E-max koronka', category: 'Orthopedics', duration: 60, price: 1800000, is_active: true },
      { name: 'Breketlar (metall)', category: 'Orthopedics', duration: 120, price: 4500000, is_active: true },
      { name: 'Breketlar (keramika)', category: 'Orthopedics', duration: 120, price: 6500000, is_active: true },
      { name: 'Protez (to\'liq)', category: 'Orthopedics', duration: 180, price: 2500000, is_active: true },
      // Estetika
      { name: 'Viniyr (1 ta)', category: 'Esthetics', duration: 60, price: 1200000, is_active: true },
      { name: 'Tishlarni oqartirish', category: 'Esthetics', duration: 90, price: 1500000, is_active: true },
      { name: 'Restavratsiya (1 ta)', category: 'Esthetics', duration: 45, price: 400000, is_active: true },
      // Pediatriya
      { name: 'Bolalar konsultatsiyasi', category: 'Pediatrics', duration: 30, price: 50000, is_active: true },
      { name: 'Salyant seali', category: 'Pediatrics', duration: 30, price: 100000, is_active: true },
      { name: 'Bolalar plombasi', category: 'Pediatrics', duration: 45, price: 200000, is_active: true },
    ];
    for (const s of services) await base44.entities.Service.create(s);
    const createdServices = await base44.entities.Service.list('-created_date', 100);
    toast.success(`${services.length} ta xizmat yaratildi.`);

    // ==================== 2. BEMORLAR (Patients) ====================
    const patients = [
      { full_name: 'Rustamov Alisher Karimovich', phone: '+998 90 123 45 67', birth_date: '1985-04-12', address: 'Toshkent sh., Yunusobod tumani, 12-mavze', gender: 'Male', status: 'Active', source: 'Google', last_visit: today, total_debt: 150000, total_paid: 400000, notes: 'Allergiya: lidokain' },
      { full_name: 'Karimova Nargiza Baxtiyorovna', phone: '+998 93 987 65 43', birth_date: '1992-08-25', address: 'Toshkent sh., Chilonzor tumani, 5-mavze', gender: 'Female', status: 'New', source: 'Instagram', last_visit: today, total_debt: 0, total_paid: 300000, notes: '' },
      { full_name: 'Voxidov Sardor Murodovich', phone: '+998 97 111 22 33', birth_date: '1978-11-05', address: 'Toshkent sh., Mirzo Ulug\'bek tumani', gender: 'Male', status: 'Inactive', source: 'Tavsiya', last_visit: '2022-05-20', total_debt: 0, total_paid: 0, notes: 'Konservativ davolanishni xohlamaydi' },
      { full_name: 'Ahmedova Malika Shavkatovna', phone: '+998 99 444 55 66', birth_date: '2001-02-18', address: 'Toshkent sh., Sergeli tumani', gender: 'Female', status: 'Active', source: 'Telegram', last_visit: '2023-09-01', total_debt: 50000, total_paid: 150000, notes: 'Bemor juda qo\'rqo\'q' },
      { full_name: 'Nazarov Dilshod Akramovich', phone: '+998 91 777 88 99', birth_date: '1990-06-15', address: 'Toshkent sh., Yashnobod tumani', gender: 'Male', status: 'Active', source: 'Website', last_visit: yesterday, total_debt: 1200000, total_paid: 200000, notes: 'Implant rejalashtirilgan' },
      { full_name: 'Saidova Zulfiya Rahimovna', phone: '+998 94 222 33 44', birth_date: '1988-12-03', address: 'Toshkent sh., Bektemir tumani', gender: 'Female', status: 'New', source: 'Call', last_visit: today, total_debt: 0, total_paid: 0, notes: 'Breketlar haqida maslahat' },
      { full_name: 'Ismoilov Bekzod Toxirovich', phone: '+998 95 666 77 88', birth_date: '1975-09-20', address: 'Toshkent sh., Uchtepa tumani', gender: 'Male', status: 'Active', source: 'Google', last_visit: lastWeek, total_debt: 800000, total_paid: 500000, notes: 'Diabet (2-turi)' },
      { full_name: 'Yusupova Madina Alisherovna', phone: '+998 88 999 00 11', birth_date: '1995-03-08', address: 'Toshkent sh., Shayxontohur tumani', gender: 'Female', status: 'Active', source: 'Instagram', last_visit: today, total_debt: 0, total_paid: 1200000, notes: 'Viniyr qilindi' },
    ];
    let createdPatients = [];
    for (const p of patients) {
      const resp = await base44.entities.Patient.create(p);
      createdPatients.push(resp);
    }
    toast.success(`${patients.length} ta bemor yaratildi.`);

    // ==================== 3. UCHRASHUVLAR (Appointments) ====================
    const appointments = [
      { patient_id: createdPatients[0]?.id, patient_name: 'Rustamov Alisher', date: today, time: '09:00', duration: 60, status: 'Completed', type: 'Treatment', service_name: 'Karies davolash', price: 250000, notes: '16-tish plomba qilindi' },
      { patient_id: createdPatients[1]?.id, patient_name: 'Karimova Nargiza', date: today, time: '10:30', duration: 60, status: 'Completed', type: 'Hygiene', service_name: 'Tish tozalash (AirFlow)', price: 300000, notes: '' },
      { patient_id: createdPatients[4]?.id, patient_name: 'Nazarov Dilshod', date: today, time: '12:00', duration: 90, status: 'Waiting', type: 'Consultation', service_name: 'Implant o\'rnatish (S. Korea)', price: 3500000, notes: 'Konsultatsiya' },
      { patient_id: createdPatients[5]?.id, patient_name: 'Saidova Zulfiya', date: today, time: '14:00', duration: 45, status: 'In Progress', type: 'Consultation', service_name: 'Breketlar (keramika)', price: 6500000, notes: '' },
      { patient_id: createdPatients[7]?.id, patient_name: 'Yusupova Madina', date: today, time: '15:30', duration: 60, status: 'Waiting', type: 'Esthetics', service_name: 'Viniyr (1 ta)', price: 1200000, notes: '2-tish viniyr' },
      { patient_id: createdPatients[2]?.id, patient_name: 'Voxidov Sardor', date: yesterday, time: '11:00', duration: 30, status: 'No-Show', type: 'Checkup', service_name: 'Konsultatsiya', price: 0, notes: 'Kelmedi' },
      { patient_id: createdPatients[6]?.id, patient_name: 'Ismoilov Bekzod', date: lastWeek, time: '10:00', duration: 120, status: 'Completed', type: 'Surgery', service_name: '8-raqamli tish olish', price: 500000, notes: '48-tish olingan' },
    ];
    for (const a of appointments) await base44.entities.Appointment.create(a);
    toast.success(`${appointments.length} ta uchrashuv yaratildi.`);

    // ==================== 4. TO'LOVLAR (Payments) ====================
    const payments = [
      // Daromadlar
      { patient_id: createdPatients[0]?.id, patient_name: 'Rustamov Alisher', date: today, amount: 250000, method: 'Card', type: 'Income', category: 'Treatment', notes: '16-tish plomba' },
      { patient_id: createdPatients[1]?.id, patient_name: 'Karimova Nargiza', date: today, amount: 300000, method: 'Card', type: 'Income', category: 'Hygiene', notes: 'AirFlow' },
      { patient_id: createdPatients[0]?.id, patient_name: 'Rustamov Alisher', date: '2023-10-15', amount: 100000, method: 'Cash', type: 'Income', category: 'Treatment', notes: 'Oldindan to\'lov' },
      { patient_id: createdPatients[6]?.id, patient_name: 'Ismoilov Bekzod', date: lastWeek, amount: 500000, method: 'Transfer', type: 'Income', category: 'Surgery', notes: 'Tish olish' },
      { patient_id: createdPatients[7]?.id, patient_name: 'Yusupova Madina', date: today, amount: 1200000, method: 'Card', type: 'Income', category: 'Esthetics', notes: 'Viniyr' },
      // Qarzlar
      { patient_id: createdPatients[0]?.id, patient_name: 'Rustamov Alisher', date: today, amount: 150000, method: '—', type: 'Debt', category: 'Qoldiq qarz', notes: 'Qarz' },
      { patient_id: createdPatients[4]?.id, patient_name: 'Nazarov Dilshod', date: today, amount: 1200000, method: '—', type: 'Debt', category: 'Implant', notes: 'Reja' },
      { patient_id: createdPatients[6]?.id, patient_name: 'Ismoilov Bekzod', date: lastWeek, amount: 800000, method: '—', type: 'Debt', category: 'Davolanish', notes: 'Qarz' },
      // Xarajatlar
      { patient_id: null, patient_name: '', date: today, amount: 500000, method: 'Cash', type: 'Expense', category: 'Materials', notes: 'Plomba materiali' },
      { patient_id: null, patient_name: '', date: yesterday, amount: 1200000, method: 'Transfer', type: 'Expense', category: 'Equipment', notes: 'Yangi apparat' },
      { patient_id: null, patient_name: '', date: lastWeek, amount: 300000, method: 'Cash', type: 'Expense', category: 'Rent', notes: 'Ofis ijara' },
    ];
    for (const p of payments) await base44.entities.Payment.create(p);
    toast.success(`${payments.length} ta to'lov yaratildi.`);

    // ==================== 5. OMBOR (Inventory) ====================
    const inventory = [
      // Dori-darmonlar
      { name: 'Anesteziya (Artikain 4%)', sku: 'AN-001', category: 'Medications', unit: 'O\'ram', quantity: 25, min_quantity: 10, price_per_unit: 120000, supplier: 'MedFarma', last_restock: '2023-10-01', status: 'In Stock' },
      { name: 'Anesteziya (Lidokain 2%)', sku: 'AN-002', category: 'Medications', unit: 'O\'ram', quantity: 8, min_quantity: 10, price_per_unit: 85000, supplier: 'MedFarma', last_restock: '2023-09-15', status: 'Low Stock' },
      { name: 'Antiseptik (Xlorgeksidin)', sku: 'ANT-001', category: 'Medications', unit: 'Butilka', quantity: 5, min_quantity: 3, price_per_unit: 45000, supplier: 'DentalSupply', last_restock: '2023-10-05', status: 'In Stock' },
      // Materiallar
      { name: 'Plomba (Filtek Z250)', sku: 'PL-001', category: 'Materials', unit: 'O\'ram', quantity: 12, min_quantity: 5, price_per_unit: 450000, supplier: '3M Official', last_restock: '2023-10-10', status: 'In Stock' },
      { name: 'Plomba (Estelite)', sku: 'PL-002', category: 'Materials', unit: 'O\'ram', quantity: 2, min_quantity: 5, price_per_unit: 380000, supplier: 'DentalSupply', last_restock: '2023-08-20', status: 'Low Stock' },
      { name: 'Kanal tozalash (K-file)', sku: 'KF-001', category: 'Materials', unit: 'To\'plam', quantity: 15, min_quantity: 5, price_per_unit: 180000, supplier: 'MedFarma', last_restock: '2023-09-25', status: 'In Stock' },
      { name: 'Implant (S. Korea)', sku: 'IMP-001', category: 'Materials', unit: 'Dona', quantity: 8, min_quantity: 3, price_per_unit: 2800000, supplier: 'Dentium', last_restock: '2023-10-15', status: 'In Stock' },
      { name: 'Implant (USA - Zimmer)', sku: 'IMP-002', category: 'Materials', unit: 'Dona', quantity: 1, min_quantity: 2, price_per_unit: 4800000, supplier: 'Zimmer Biomet', last_restock: '2023-09-01', status: 'Low Stock' },
      // Bir martalik
      { name: 'Bir martalik qo\'lqoplar (L)', sku: 'GL-001', category: 'Disposables', unit: 'Quti (100 ta)', quantity: 3, min_quantity: 5, price_per_unit: 45000, supplier: 'MedFarma', last_restock: '2023-10-01', status: 'In Stock' },
      { name: 'Bir martalik qo\'lqoplar (M)', sku: 'GL-002', category: 'Disposables', unit: 'Quti (100 ta)', quantity: 0, min_quantity: 5, price_per_unit: 45000, supplier: 'MedFarma', last_restock: '2023-08-15', status: 'Out of Stock' },
      { name: 'Maska (3 qatlamli)', sku: 'MSK-001', category: 'Disposables', unit: 'Quti (50 ta)', quantity: 2, min_quantity: 5, price_per_unit: 35000, supplier: 'DentalSupply', last_restock: '2023-09-20', status: 'Low Stock' },
      { name: 'Salyafan (yupqa)', sku: 'SL-001', category: 'Disposables', unit: 'Rulon', quantity: 8, min_quantity: 3, price_per_unit: 65000, supplier: 'MedFarma', last_restock: '2023-10-08', status: 'In Stock' },
      // Asbob-uskunalar
      { name: 'Bur (tungsten karbid)', sku: 'BR-001', category: 'Instruments', unit: 'To\'plam', quantity: 20, min_quantity: 10, price_per_unit: 150000, supplier: 'Komet', last_restock: '2023-10-12', status: 'In Stock' },
      { name: 'Bur (almaz)', sku: 'BR-002', category: 'Instruments', unit: 'To\'plam', quantity: 5, min_quantity: 5, price_per_unit: 220000, supplier: 'Komet', last_restock: '2023-09-30', status: 'Low Stock' },
    ];
    for (const i of inventory) await base44.entities.Inventory.create(i);
    toast.success(`${inventory.length} ta ombor mahsuloti yaratildi.`);

    // ==================== 6. LIDDLAR (Leads) ====================
    const leads = [
      { name: 'Murodov Anvar Qodirovich', phone: '+998 90 555 66 77', source: 'Instagram', status: 'New', interest: 'Implant', date: today, notes: 'Ertaga aloqaga chiqish kerak. 3 ta implant qilmoqchi.' },
      { name: 'Olimova Sevara Baxtiyorovna', phone: '+998 94 333 22 11', source: 'Telegram', status: 'Contacted', interest: 'Breketlar', date: yesterday, notes: 'Narxlarini so\'radi. Keramika breketlar qiziqtiradi.' },
      { name: 'Toshpulatov Jamshid', phone: '+998 97 444 55 66', source: 'Google', status: 'Converted', interest: 'Karies davolash', date: lastWeek, notes: 'Bemorga aylantirildi', patient_id: createdPatients[0]?.id },
      { name: 'Rahimova Nodira', phone: '+998 99 777 88 99', source: 'Tavsiya', status: 'New', interest: 'Tish olish', date: today, notes: '8-raqamli tish og\'riq qilyapti' },
      { name: 'Xolmatov Sherzod', phone: '+998 91 222 33 44', source: 'Website', status: 'Contacted', interest: 'Otdelka', date: yesterday, notes: 'Tishlarni oqartirish narxi qiziqtiradi' },
      { name: 'G\'aniyeva Dilnoza', phone: '+998 95 888 99 00', source: 'Call', status: 'Lost', interest: 'Protez', date: lastWeek, notes: 'Narx qimmat deb ketdi' },
    ];
    for (const l of leads) await base44.entities.Lead.create(l);
    toast.success(`${leads.length} ta lead yaratildi.`);

    // ==================== 7. DAVOLASH REJALARI (Treatment Plans) ====================
    const treatmentPlans = [
      { name: 'Rustamov Alisher — Tish #16', patient_id: createdPatients[0]?.id, patient_name: 'Rustamov Alisher', status: 'Completed', priority: 'High', tooth_number: '16', services: [{name: 'Karies davolash', price: 250000}], total_price: 250000, notes: 'Plomba qilindi', created_date: today },
      { name: 'Nazarov Dilshod — Implant reja', patient_id: createdPatients[4]?.id, patient_name: 'Nazarov Dilshod', status: 'Planned', priority: 'High', tooth_number: '36', services: [{name: 'Implant o\'rnatish (S. Korea)', price: 3500000}, {name: 'Koronka', price: 800000}], total_price: 4300000, notes: '1-oqtda implant, 2-oqtda koronka', created_date: today },
      { name: 'Ismoilov Bekzod — Kompleks davolash', patient_id: createdPatients[6]?.id, patient_name: 'Ismoilov Bekzod', status: 'In Progress', priority: 'Medium', tooth_number: '', services: [{name: 'Karies davolash (3 ta)', price: 750000}, {name: 'Kanal davolash', price: 600000}], total_price: 1350000, notes: '3 ta karies + 1 ta kanal', created_date: lastWeek },
      { name: 'Saidova Zulfiya — Breketlar', patient_id: createdPatients[5]?.id, patient_name: 'Saidova Zulfiya', status: 'Planned', priority: 'Low', tooth_number: '', services: [{name: 'Breketlar (keramika)', price: 6500000}], total_price: 6500000, notes: 'Yuqori jag\' breketlar', created_date: today },
    ];
    for (const tp of treatmentPlans) await base44.entities.TreatmentPlan.create(tp);
    toast.success(`${treatmentPlans.length} ta davolash rejasi yaratildi.`);

    // ==================== 8. TISH YOZUVLARI (Tooth Records) ====================
    const toothRecords = [
      { patient_id: createdPatients[0]?.id, tooth_number: 16, status: 'Plomba', condition: 'Davolangan', notes: 'Kompozit plomba', date: today },
      { patient_id: createdPatients[0]?.id, tooth_number: 26, status: 'Karies', condition: 'Jarayonda', notes: 'O\'rta karies', date: today },
      { patient_id: createdPatients[6]?.id, tooth_number: 48, status: 'Olib tashlangan', condition: 'Olingan', notes: 'Retinatsiya qilgan', date: lastWeek },
      { patient_id: createdPatients[7]?.id, tooth_number: 11, status: 'Viniyr', condition: 'Davolangan', notes: 'E-max viniyr', date: today },
      { patient_id: createdPatients[7]?.id, tooth_number: 21, status: 'Viniyr', condition: 'Davolangan', notes: 'E-max viniyr', date: today },
    ];
    for (const tr of toothRecords) await base44.entities.ToothRecord.create(tr);
    toast.success(`${toothRecords.length} ta tish yozuvi yaratildi.`);

    // ==================== 9. ESLATMALAR (Recalls) ====================
    const recalls = [
      { patient_id: createdPatients[0]?.id, patient_name: 'Rustamov Alisher', type: 'Follow-up', date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0], time: '10:00', status: 'Scheduled', notes: 'Plomba tekshiruvi', send_sms: true, send_telegram: false },
      { patient_id: createdPatients[6]?.id, patient_name: 'Ismoilov Bekzod', type: 'Treatment', date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0], time: '14:00', status: 'Scheduled', notes: 'Kanal davolashni davom ettirish', send_sms: true, send_telegram: true },
      { patient_id: createdPatients[4]?.id, patient_name: 'Nazarov Dilshod', type: 'Consultation', date: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0], time: '11:00', status: 'Pending', notes: 'Implant konsultatsiyasi', send_sms: false, send_telegram: true },
    ];
    for (const r of recalls) await base44.entities.Recall.create(r);
    toast.success(`${recalls.length} ta eslatma yaratildi.`);

    // ==================== 10. XARAJATLAR (Expenses) ====================
    const expenses = [
      { category: 'Materials', amount: 500000, date: today, description: 'Plomba materiali (Filtek)', payment_method: 'Cash', vendor: 'DentalSupply', receipt_number: 'REC-001' },
      { category: 'Equipment', amount: 1200000, date: yesterday, description: 'Yangi diod lazeri', payment_method: 'Transfer', vendor: 'MedTech', receipt_number: 'REC-002' },
      { category: 'Rent', amount: 3000000, date: '2023-10-01', description: 'Ofis ijara (oktyabr)', payment_method: 'Transfer', vendor: 'Uy egasi', receipt_number: 'REC-003' },
      { category: 'Salary', amount: 8500000, date: '2023-10-01', description: 'Xodimlar oyligi', payment_method: 'Transfer', vendor: 'Bank', receipt_number: 'REC-004' },
      { category: 'Utilities', amount: 450000, date: yesterday, description: 'Elektr va suv', payment_method: 'Cash', vendor: 'Kommunallar', receipt_number: 'REC-005' },
      { category: 'Other', amount: 150000, date: today, description: 'Choy va kofe', payment_method: 'Cash', vendor: 'Market', receipt_number: 'REC-006' },
    ];
    for (const e of expenses) await base44.entities.Expense.create(e);
    toast.success(`${expenses.length} ta xarajat yaratildi.`);

    // ==================== 11. XODIMLAR (Users) ====================
    const users = [
      { full_name: 'Dr. Karimov Sanjar', email: 'sanjar@dental.uz', role: 'doctor', specialization: 'Terapevt', phone: '+998 90 111 11 11', is_active: true },
      { full_name: 'Dr. Rahimova Laylo', email: 'laylo@dental.uz', role: 'doctor', specialization: 'Xirurg', phone: '+998 90 222 22 22', is_active: true },
      { full_name: 'Admin', email: 'admin@dental.uz', role: 'admin', specialization: '', phone: '+998 90 333 33 33', is_active: true },
      { full_name: 'Sekretar', email: 'sekretar@dental.uz', role: 'receptionist', specialization: '', phone: '+998 90 444 44 44', is_active: true },
    ];
    for (const u of users) await base44.entities.User.create(u);
    toast.success(`${users.length} ta xodim yaratildi.`);

    toast.success("✅ Barcha test ma'lumotlari muvaffaqiyatli kiritildi! Sahifani yangilang.");
    setTimeout(() => window.location.reload(), 2000);
  } catch (error) {
    console.error("Xatolik:", error);
    toast.error("Ma'lumotlarni kiritishda xatolik yuz berdi: " + error.message);
  }
};
