/**
 * patientExcelExport.js
 * Utility to export complete patient EHR data to Excel (.csv with UTF-8 BOM).
 */

export function exportPatientToExcel({
  patient,
  plans = [],
  payments = [],
  appointments = [],
  doctors = [],
  card043Data = {},
  totalPaid = 0,
  totalDebt = 0,
  toothRecords = [],
}) {
  if (!patient) return;

  const sanitize = (val) => {
    if (val === null || val === undefined) return '';
    return String(val).replace(/"/g, '""').replace(/\r?\n/g, ' ');
  };

  const lines = [];

  // Helper to push section header
  const addSection = (title) => {
    lines.push('');
    lines.push(`"════════════════════════════════════════════════════════════════════════════════"`);
    lines.push(`"${title.toUpperCase()}"`);
    lines.push(`"════════════════════════════════════════════════════════════════════════════════"`);
  };

  // 1. HEADER & META
  lines.push(`"SHIFOCRM — BEMOR TIBBIY KARTASI VA HISOBOTI (EXCEL EKSPORT)"`);
  lines.push(`"Eksport sanasi:","${new Date().toLocaleDateString('uz-UZ')} ${new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}"`);

  // 2. BEMOR PASPORT VA SHAXSIY MA'LUMOTLARI
  addSection("1. BEMOR PASPORT VA SHAXSIY MA'LUMOTLARI");
  lines.push('"№","Ko\'rsatkich","Qiymati"');
  
  const birthYear = patient.birth_date ? new Date(patient.birth_date).getFullYear() : null;
  const age = birthYear ? (new Date().getFullYear() - birthYear) : '—';
  const genderLabel = patient.gender === 'Female' ? 'Ayol' : patient.gender === 'Male' ? 'Erkak' : (patient.gender || '—');
  const mainDoc = doctors.find(d => d.id === patient.main_treatment_provider || d.id === patient.created_by_id)?.name || patient.main_treatment_provider || 'Belgilanmagan';

  const passportRows = [
    ["1", "F.I.SH. (To'liq ism)", patient.full_name || '—'],
    ["2", "Telefon raqami", patient.phone ? `+998 ${patient.phone.replace(/\D/g, '').slice(-9)}` : '—'],
    ["3", "Tug'ilgan sana", patient.birth_date || '—'],
    ["4", "Yoshi", `${age} yosh`],
    ["5", "Jinsi", genderLabel],
    ["6", "Yashash manzili", patient.address || '—'],
    ["7", "Status / Holati", patient.status || 'Faol'],
    ["8", "Biriktirilgan shifokor", mainDoc],
    ["9", "Ro'yxatdan o'tgan sana", patient.created_date ? new Date(patient.created_date).toLocaleDateString('uz-UZ') : '—'],
    ["10", "Telegram Bot holati", patient.telegram_chat_id ? 'Ulangan' : 'Ulanmagan'],
    ["11", "Tibbiy eslatma / Izoh", patient.notes || patient.important_info || '—'],
  ];

  passportRows.forEach(r => {
    lines.push(`"${r[0]}","${sanitize(r[1])}","${sanitize(r[2])}"`);
  });

  // 3. MOLIYAVIY BALANS VA XULOSA
  addSection("2. MOLIYAVIY BALANS VA KO'RSATKICHLAR");
  lines.push('"№","Ko\'rsatkich","Summa (UZS)","Izoh"');
  
  const totalPlansPrice = plans.reduce((sum, p) => sum + (Number(p.total_price) || 0), 0);
  const paidPct = totalPlansPrice > 0 ? Math.min(100, Math.round((totalPaid / totalPlansPrice) * 100)) : (totalPaid > 0 ? 100 : 0);

  const financeRows = [
    ["1", "Jami muolajalar va rejalar qiymati", totalPlansPrice, `${plans.length} ta davolash rejasi`],
    ["2", "Jami to'langan summa", totalPaid, `To'lov ulushi: ${paidPct}%`],
    ["3", "Qoldiq qarzdorlik", totalDebt, totalDebt > 0 ? "Qarzdorlik mavjud" : "Qarz yo'q"],
    ["4", "To'lovlar soni", payments.length, "Muvaffaqiyatli tranzaksiyalar"],
  ];

  financeRows.forEach(r => {
    lines.push(`"${r[0]}","${sanitize(r[1])}",${r[2]},"${sanitize(r[3])}"`);
  });

  // 4. TISH FORMULASI VA TASHXISLAR
  addSection("3. BOSHLANG'ICH TISH FORMULASI VA TASHXISLAR");
  lines.push('"FDI Tish №","Jag\' / Joylashuv","Tashxis / Holat","Holat KODI","Qo\'shimcha Izoh"');
  
  const toothFdiList = [
    18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28,
    48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38
  ];

  const getToothLocation = (fdi) => {
    const num = Number(fdi);
    if (num >= 11 && num <= 18) return "Yuqori O'ng Jag'";
    if (num >= 21 && num <= 28) return "Yuqori Chap Jag'";
    if (num >= 31 && num <= 38) return "Pastki Chap Jag'";
    if (num >= 41 && num <= 48) return "Pastki O'ng Jag'";
    return "Jag'";
  };

  const getToothStatusLabel = (code) => {
    const map = {
      'C': "Kariyes (Caries)",
      'P': "Pulpit (Pulpitis)",
      'Pt': "Periodontit",
      'R': "Tish ildizi (Root)",
      'A': "Tish yo'q / Olingan (Missing/Extracted)",
      'F': "Plomba qilingan (Filling)",
      'K': "Sun'iy toj / Koronka (Crown)",
      'V': "Vinir (Veneer)",
      'I': "Implantat (Implant)",
      'H': "Sog'lom (Healthy)",
      'N': "Sog'lom / Norma"
    };
    return map[code] || code || "Sog'lom";
  };

  toothFdiList.forEach(fdi => {
    const code = card043Data?.toothStatus?.[fdi] || 'N';
    const loc = getToothLocation(fdi);
    const label = getToothStatusLabel(code);
    lines.push(`"${fdi}","${sanitize(loc)}","${sanitize(label)}","${sanitize(code)}",""`);
  });

  // 5. DAVOLASH REJALARI VA XIZMATLAR
  addSection("4. DAVOLASH REJALARI VA MUOLAJALAR REYESTRI");
  lines.push('"№","Reja Nomi","Tegishli Tishlar","Xizmatlar Soni","Mas\'ul Shifokor","Qiymati (UZS)","Holati","Yaratilgan Sana"');
  
  if (plans.length === 0) {
    lines.push('"—","Davolash rejalari mavjud emas","—","0","—",0,"—","—"');
  } else {
    plans.forEach((p, idx) => {
      const docName = doctors.find(d => d.id === p.doctor_id || d.id === p.doctor)?.name || p.doctor_name || '—';
      const sCount = Array.isArray(p.services) ? p.services.length : (p.services_count || 0);
      const toothNum = p.tooth_number ? `#${p.tooth_number}` : (p.tooth_numbers ? p.tooth_numbers.join(', ') : 'Umumiy');
      const statusLabel = 
        p.status === 'completed' || p.status === 'bajarildi' ? "Tugallangan" :
        p.status === 'in_progress' || p.status === 'jarayonda' ? "Jarayonda" :
        "Rejalashtirilgan";
      const createdStr = p.created_date ? new Date(p.created_date).toLocaleDateString('uz-UZ') : (p.date || '—');

      lines.push(`"${idx + 1}","${sanitize(p.name || 'Reja')}","${sanitize(toothNum)}",${sCount},"${sanitize(docName)}",${Number(p.total_price) || 0},"${sanitize(statusLabel)}","${sanitize(createdStr)}"`);
    });
  }

  // 6. TO'LOVLAR VA TRANZAKSIYALAR REYESTRI
  addSection("5. TO'LOVLAR VA MOLIYAVIY TRANZAKSIYALAR");
  lines.push('"№","Sana va Vaqt","Turi","To\'lov Usuli","Summa (UZS)","Kategoriya / Izoh","Kassir / Shifokor"');
  
  if (payments.length === 0) {
    lines.push('"—","To\'lovlar mavjud emas","—","—",0,"—","—"');
  } else {
    payments.forEach((pm, idx) => {
      const dateStr = pm.date ? new Date(pm.date).toLocaleDateString('uz-UZ') + (pm.date.includes('T') ? ' ' + new Date(pm.date).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) : '') : '—';
      const typeLabel = 
        pm.type === 'Income' ? "Kirim (To'lov)" :
        pm.type === 'Expense' ? "Chiqim" :
        pm.type === 'Refund' ? "Qaytarish" :
        pm.type === 'Discount' ? "Chegirma" : (pm.type || "To'lov");
      const methodLabel = 
        pm.method === 'Cash' ? "Naqd pul" :
        pm.method === 'Card' ? "Plastik karta" :
        pm.method === 'Transfer' ? "Bank o'tkazmasi" : (pm.method || '—');
      const docName = doctors.find(d => d.id === pm.doctor_id)?.name || pm.doctor_name || 'Kassa';
      const note = pm.categoryClean || pm.category || pm.notes || '—';

      lines.push(`"${idx + 1}","${sanitize(dateStr)}","${sanitize(typeLabel)}","${sanitize(methodLabel)}",${Number(pm.amount) || 0},"${sanitize(note)}","${sanitize(docName)}"`);
    });
  }

  // 7. QABULLAR VA TASHRIFLAR TARIXI
  addSection("6. QABULLAR VA TASHRIFLAR TARIXI");
  lines.push('"№","Sana","Vaqt","Xizmat / Muolaja","Mas\'ul Shifokor","Holati"');
  
  if (appointments.length === 0) {
    lines.push('"—","Qabullar mavjud emas","—","—","—","—"');
  } else {
    appointments.forEach((ap, idx) => {
      const dateStr = ap.date ? new Date(ap.date).toLocaleDateString('uz-UZ') : (ap.appointment_date || '—');
      const timeStr = ap.time || ap.start_time || '09:00';
      const serviceStr = ap.service_name || ap.service || ap.title || 'Qabul';
      const docName = doctors.find(d => d.id === ap.doctor_id || d.id === ap.doctor)?.name || ap.doctor || 'Shifokor';
      const statusLabel = 
        ap.status === 'Completed' || ap.status === 'completed' ? "Tugallandi" :
        ap.status === 'Confirmed' || ap.status === 'confirmed' ? "Tasdiqlangan" :
        ap.status === 'Cancelled' || ap.status === 'cancelled' ? "Bekor qilindi" :
        ap.status === 'No Show' ? "Kelmadi" : (ap.status || "Rejalashtirilgan");

      lines.push(`"${idx + 1}","${sanitize(dateStr)}","${sanitize(timeStr)}","${sanitize(serviceStr)}","${sanitize(docName)}","${sanitize(statusLabel)}"`);
    });
  }

  // 8. SHAKL 043/U TIBBIY KUNDALIGI
  addSection("7. SHAKL 043/U TIBBIY KUNDALIK YOZUVLARI");
  lines.push('"№","Sana","Shifokor","Kundalik Bayoni va Tashxis"');
  
  const logs = card043Data?.historyLogs || [];
  if (logs.length === 0) {
    lines.push('"—","Kundalik yozuvlari mavjud emas","—","—"');
  } else {
    logs.forEach((log, idx) => {
      lines.push(`"${idx + 1}","${sanitize(log.date || '—')}","${sanitize(log.doctor || 'Shifokor')}","${sanitize(log.content || '—')}"`);
    });
  }

  // Final Output Generation with UTF-8 BOM
  const csvContent = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const cleanName = (patient.full_name || 'Bemor').replace(/[^a-zA-Z0-9_\u0400-\u04FF]/g, '_');
  const dateStamp = new Date().toISOString().slice(0, 10);
  
  link.setAttribute("href", url);
  link.setAttribute("download", `Bemor_${cleanName}_Excel_${dateStamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
