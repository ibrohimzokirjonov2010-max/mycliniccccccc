import { useEffect, useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import toast from 'react-hot-toast';
import { notificationStore } from '@/lib/notificationStore';

/**
 * GlobalAlerter Component
 * Background worker that monitors:
 * 1. Appointments (20 mins before)
 * 2. Recalls (Today)
 * 3. Implants (Today's reminder_date)
 * 4. Large Debts (System alert)
 */
export default function GlobalAlerter() {
  const { user, isDoctor } = useAuth();
  const [alertedIds, setAlertedIds] = useState(new Set());
  const timerRef = useRef(null);

  // Request browser notification permission
  useEffect(() => {
    if (Notification && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const checkEverything = async () => {
    if (!user) return;

    try {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const doctorFilter = isDoctor ? { doctor_id: user.id } : {};

      // 1. Check Appointments
      const appointments = await base44.entities.Appointment.list('time', 50);
      appointments.forEach(app => {
        if (!app.date || !app.time || app.status === 'Cancelled' || app.status === 'Completed') return;
        const appDateStr = app.date.split('T')[0];
        if (appDateStr !== today) return;

        const [appHours, appMinutes] = app.time.split(':').map(Number);
        const appTime = new Date();
        appTime.setHours(appHours, appMinutes, 0, 0);

        const diffMinutes = Math.round((appTime - now) / 60000);
        if (diffMinutes >= 19 && diffMinutes <= 21 && !alertedIds.has(`app-${app.id}`)) {
          sendNotification({
            id: `app-${app.id}`,
            type: 'appointment',
            title: 'Qabul yaqinlashmoqda!',
            message: `${app.time}da ${app.patient_name} uchun qabul boshlanishiga 20 daqiqa qoldi.`
          });
        }
      });

      // 2. Check Recalls
      const recalls = await base44.entities.Recall.list('recall_date', 50);
      recalls.forEach(rec => {
        if (!rec.recall_date || rec.status !== 'pending') return;
        const recDate = rec.recall_date.split('T')[0];
        if (recDate === today && !alertedIds.has(`rec-${rec.id}`)) {
          sendNotification({
            id: `rec-${rec.id}`,
            type: 'recall',
            title: 'Recall vaqti keldi!',
            message: `Bugun ${rec.patient_name} bilan bog'lanish vaqti (Turi: ${rec.type_label || rec.type}).`
          });
        }
      });

      // 3. Check Implants
      try {
        const implants = await base44.entities.Implant.list('-created_date', 50);
        implants.forEach(imp => {
          if (!imp.reminder_date || imp.lifecycle_status === 'Tugallangan') return;
          const impDate = imp.reminder_date.split('T')[0];
          if (impDate === today && !alertedIds.has(`imp-${imp.id}`)) {
            sendNotification({
              id: `imp-${imp.id}`,
              type: 'implant',
              title: 'Implant nazorati!',
              message: `Bugun ${imp.patient_name} uchun implant nazorat kuni.`
            });
          }
        });
      } catch (e) {
        console.error('Implant check error:', e);
      }

    } catch (err) {
      console.error('Global check error:', err);
    }
  };

  const sendNotification = ({ id, type, title, message }) => {
    // Avoid double alerts in state
    setAlertedIds(prev => new Set([...prev, id]));

    // Browser Notification
    if (Notification && Notification.permission === 'granted') {
      new Notification(title, { body: message });
    }

    // Add to persistent store
    notificationStore.add({ type, title, message });

    // In-app Toast
    toast(message, {
      icon: type === 'appointment' ? '⏰' : (type === 'recall' ? '📞' : '🦷'),
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

    // Voice
    try {
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = 'uz-UZ';
      window.speechSynthesis.speak(utterance);
    } catch (e) {}
  };

  useEffect(() => {
    // Birinchi tekshiruv 5 daqiqadan so'ng — sahifa qotmasligi uchun!
    // (Ilgari 30 sek edi, app ochilishi bilan 3 ta og'ir API so'rov ketardi)
    const initTimer = setTimeout(() => {
      checkEverything();
    }, 5 * 60 * 1000); // 5 daqiqa

    timerRef.current = setInterval(checkEverything, 60000);

    return () => {
      clearTimeout(initTimer);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [user]);

  return null;
}
