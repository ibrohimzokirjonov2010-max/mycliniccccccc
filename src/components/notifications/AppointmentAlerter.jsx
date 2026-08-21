import { useEffect, useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import toast from 'react-hot-toast';
import { notificationStore } from '@/lib/notificationStore';

/**
 * AppointmentAlerter Component
 * Background worker that checks for upcoming appointments and sends notifications 
 * 20 minutes before the scheduled time.
 */
export default function AppointmentAlerter() {
  const { user } = useAuth();
  const [alertedIds, setAlertedIds] = useState(new Set());
  const timerRef = useRef(null);

  // Request browser notification permission
  useEffect(() => {
    if (Notification && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const checkAppointments = async () => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const appointments = await base44.entities.Appointment.list('time', 100);
      
      const now = new Date();
      
      appointments.forEach(app => {
        if (!app.date || !app.time || app.status === 'Cancelled' || app.status === 'Completed') return;
        
        // Parse appointment time
        const [appHours, appMinutes] = app.time.split(':').map(Number);
        const appDate = new Date(app.date);
        appDate.setHours(appHours, appMinutes, 0, 0);

        const diffMinutes = Math.round((appDate - now) / 60000);

        // Check if it's exactly 20 minutes away (or 19-21 to be safe against interval skips)
        if (diffMinutes >= 19 && diffMinutes <= 21 && !alertedIds.has(app.id)) {
          sendNotification(app);
          setAlertedIds(prev => new Set([...prev, app.id]));
        }
      });
    } catch (err) {
      console.error('Appointment check error:', err);
    }
  };

  const sendNotification = (app) => {
    const title = 'Qabul yaqinlashmoqda! 🦷';
    const body = `${app.time}da ${app.patient_name} uchun qabul boshlanishiga 20 daqiqa qoldi.`;
    const icon = '/logo.png'; // Fallback if logo exists

    // Browser Notification
    if (Notification && Notification.permission === 'granted') {
      new Notification(title, { body, icon });
    }

    // Add to persistent store
    notificationStore.add({
      type: 'appointment',
      title: title,
      message: body
    });

    // In-app Toast (more visible if user is already in app)
    toast(body, {
      icon: '⏰',
      duration: 10000,
      position: 'top-center',
      style: {
        background: '#0f172a',
        color: '#fff',
        borderRadius: '1rem',
        padding: '1rem',
        fontWeight: 'bold'
      }
    });

    // Speak (Optional but premium)
    try {
      const utterance = new SpeechSynthesisUtterance(body);
      utterance.lang = 'uz-UZ';
      window.speechSynthesis.speak(utterance);
    } catch (e) {}
  };

  useEffect(() => {
    // Check every 60 seconds
    timerRef.current = setInterval(checkAppointments, 60000);
    
    // Initial check
    checkAppointments();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [user, alertedIds]);

  return null; // Background component
}
