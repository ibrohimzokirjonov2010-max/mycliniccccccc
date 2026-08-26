import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { notificationStore } from '@/lib/notificationStore';

/**
 * GlobalAlerter Component (v2 — Birlashtrilgan)
 * 
 * AppointmentAlerter + GlobalAlerter birlashtirildi:
 * - 1 ta komponent, 1 ta interval (ilgari 2 ta edi — dublikat Appointment so'rovlari)
 * - useState → useRef (setAlertedIds loop ni to'xtatdi)
 * - Promise.all bilan parallel yuklash (Appointment + Recall birgalikda)
 * - Interval: 60s → 120s (yetarli, 2 daqiqada 1 marta tekshirish)
 * 
 * Monitoring:
 * 1. Appointments — 20 daqiqa oldin ogohlantirish
 * 2. Recalls — bugungi sanalar
 * 3. Implants — bugungi reminder_date lar
 */
export default function GlobalAlerter() {
  const { user, isDoctor } = useAuth();
  // 🔑 useRef — state emas! setAlertedIds → re-render → loop edi
  const alertedIdsRef = useRef(new Set());
  const timerRef = useRef(null);

  // Browser notification permission
  useEffect(() => {
    if (Notification && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const checkAllAlerts = async () => {
    if (!user) return;

    try {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // ⚡ Promise.all — Appointment va Recall birgalikda (ilgari alohida-alohida edi)
      // AppointmentAlerter + GlobalAlerter birlashtirildi: 4 so'rov → 2 so'rov
      const [appointments, recalls] = await Promise.all([
        base44.entities.Appointment.list('time', 50),
        base44.entities.Recall.list('recall_date', 30),
      ]);

      // 1️⃣ Qabullar — 20 daqiqa oldin ogohlantirish
      (appointments || []).forEach(app => {
        if (!app.date || !app.time || app.status === 'Cancelled' || app.status === 'Completed') return;
        const appDateStr = app.date.split('T')[0];
        if (appDateStr !== today) return;

        const [h, m] = app.time.split(':').map(Number);
        const appTime = new Date();
        appTime.setHours(h, m, 0, 0);
        const diffMinutes = Math.round((appTime - now) / 60000);

        const alertKey = `app-${app.id}`;
        if (diffMinutes >= 19 && diffMinutes <= 21 && !alertedIdsRef.current.has(alertKey)) {
          alertedIdsRef.current.add(alertKey);
          sendNotification({
            id: alertKey,
            type: 'appointment',
            title: 'Qabul yaqinlashmoqda! ⏰',
            message: `${app.time}da ${app.patient_name} uchun qabul boshlanishiga 20 daqiqa qoldi.`
          });
        }
      });

      // 2️⃣ Recalllar — bugungi sanalar
      (recalls || []).forEach(rec => {
        if (!rec.recall_date || rec.status !== 'pending') return;
        const recDate = rec.recall_date.split('T')[0];
        const alertKey = `rec-${rec.id}`;
        if (recDate === today && !alertedIdsRef.current.has(alertKey)) {
          alertedIdsRef.current.add(alertKey);
          sendNotification({
            id: alertKey,
            type: 'recall',
            title: 'Recall vaqti keldi! 📞',
            message: `Bugun ${rec.patient_name} bilan bog'lanish vaqti (${rec.type_label || rec.type}).`
          });
        }
      });

      // 3️⃣ Implantlar — alohida so'rov (xatolik bo'lsa boshqalarga ta'sir qilmasin)
      try {
        const implants = await base44.entities.Implant.list('-created_date', 50);
        (implants || []).forEach(imp => {
          if (!imp.reminder_date || imp.lifecycle_status === 'Tugallangan') return;
          const impDate = imp.reminder_date.split('T')[0];
          const alertKey = `imp-${imp.id}`;
          if (impDate === today && !alertedIdsRef.current.has(alertKey)) {
            alertedIdsRef.current.add(alertKey);
            sendNotification({
              id: alertKey,
              type: 'implant',
              title: 'Implant nazorati! 🦷',
              message: `Bugun ${imp.patient_name} uchun implant nazorat kuni.`
            });
          }
        });
      } catch {
        // Implant xatosi — boshqa alertlarni bloklamasin
      }

    } catch (err) {
      console.error('[GlobalAlerter] Xatolik:', err);
    }
  };

  const sendNotification = ({ id, type, title, message }) => {
    // Browser Notification
    if (Notification && Notification.permission === 'granted') {
      new Notification(title, { body: message });
    }

    // Persistent store
    notificationStore.add({ type, title, message });

    // In-app Toast
    toast(message, {
      icon: type === 'appointment' ? '⏰' : type === 'recall' ? '📞' : '🦷',
      duration: 8000,
      position: 'top-center',
      style: {
        background: '#0f172a',
        color: '#fff',
        borderRadius: '1rem',
        padding: '1rem',
        fontWeight: 'bold',
        fontSize: '14px'
      }
    });

    // Voice (optional)
    try {
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = 'uz-UZ';
      window.speechSynthesis.speak(utterance);
    } catch {}
  };

  useEffect(() => {
    if (!user) return;

    // Birinchi tekshiruv 5 daqiqadan so'ng — app startup ni bloklamaslik uchun
    const initTimer = setTimeout(() => {
      checkAllAlerts();
    }, 5 * 60 * 1000);

    // ⏱️ 60s → 120s: 2 daqiqada bir marta yetarli (trafik 2x kamaydi)
    timerRef.current = setInterval(checkAllAlerts, 2 * 60 * 1000);

    return () => {
      clearTimeout(initTimer);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [user]); // ← faqat user, alertedIdsRef o'zgarmaydi (loop yo'q)

  return null;
}
