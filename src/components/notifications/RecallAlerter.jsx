import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

/**
 * RecallAlerter Component
 * Background worker that checks for scheduled recall notifications and sends them via Telegram Bot API.
 */
export default function RecallAlerter() {
  const { user } = useAuth();
  const timerRef = useRef(null);

  const processNotifications = async () => {
    if (!user) return;

    try {
      // 1. Get Bot Config
      const botConfigRes = await base44.get('/BotConfig');
      const botConfig = botConfigRes.data?.[0];
      
      if (!botConfig || !botConfig.isActive || !botConfig.botToken) return;

      // 2. Get Pending Notifications marked as 'scheduled'
      // In a real scenario, we'd filter for scheduled_at <= now
      const now = new Date().toISOString();
      const pendingRes = await base44.entities.ScheduledNotification?.filter({ status: 'scheduled' }) || { data: [] };
      const pending = Array.isArray(pendingRes) ? pendingRes : (pendingRes.data || []);

      for (const note of pending) {
        if (new Date(note.scheduled_at) > new Date()) continue;

        // 3. Send via Telegram API
        if (note.channel === 'telegram' && note.chat_id) {
          try {
            const botToken = botConfig.botToken;
            const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
            
            const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: note.chat_id,
                text: note.message,
                parse_mode: 'Markdown'
              })
            });

            if (response.ok) {
              // 4. Update status to 'sent'
              await base44.entities.ScheduledNotification.update(note.id, { 
                status: 'sent', 
                sent_at: new Date().toISOString() 
              });
              
              // 5. Log to history
              await base44.entities.NotificationHistory?.create({
                recall_id: note.recall_id,
                patient_id: note.patient_id,
                channel: 'telegram',
                message: note.message,
                sent_at: new Date().toISOString(),
                status: 'sent'
              });
            } else {
               console.error('Telegram API error:', await response.text());
            }
          } catch (sendErr) {
            console.error('Failed to send telegram message:', sendErr);
          }
        }
      }
    } catch (err) {
      console.error('Recall process error:', err);
    }
  };

  useEffect(() => {
    // Dastlabki tekshiruv 3 daqiqadan keyin — startup bloklanmasin!
    // (BotConfig + ScheduledNotification so'rovlari ilgari darhol ketar edi)
    const initTimer = setTimeout(processNotifications, 3 * 60 * 1000);

    // Keyingi tekshiruvlar har 5 daqiqada
    timerRef.current = setInterval(processNotifications, 300000);

    return () => {
      clearTimeout(initTimer);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [user]);

  return null;
}
