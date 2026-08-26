/**
 * TelegramReminderWorker.jsx
 * 
 * Background component that runs in the browser and:
 *  1. Every minute — checks if any appointment is exactly 2 hours away → sends Telegram confirmation
 *  2. Every minute at 07:00 — sends morning reminders for today's appointments
 *  3. Every 30 seconds — polls bot updates to handle /start command with clinic welcome message
 * 
 * No backend required! Uses Supabase REST API + Telegram Bot API directly.
 */

import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { check2HourReminders, checkMorningReminders, getTashkentHHMM, pollBotUpdates } from '@/lib/telegramReminderService';

export default function TelegramReminderWorker() {
  const { user } = useAuth();
  const timerRef = useRef(null);
  const pollTimerRef = useRef(null);
  const lastRunRef = useRef('');

  const runChecks = async () => {
    if (!user) return;

    // Clinic ID
    const clinicId = localStorage.getItem('current_clinic_id') || user?.clinic_id || null;
    const nowKey = getTashkentHHMM();

    // Prevent duplicate runs in same minute
    if (lastRunRef.current === nowKey) return;
    lastRunRef.current = nowKey;

    // Har daqiqa log chiqarmaydi — faqat eslatma yuborganda log qilinadi


    try {
      // Run both checks in parallel
      await Promise.allSettled([
        check2HourReminders(clinicId),
        checkMorningReminders(clinicId),
      ]);
    } catch (e) {
      console.error('[ReminderWorker] Error:', e);
    }
  };

  const runPoll = async () => {
    if (!user) return;
    const clinicId = localStorage.getItem('current_clinic_id') || user?.clinic_id || null;
    try {
      await pollBotUpdates(clinicId);
    } catch (e) {
      console.warn('[ReminderWorker] pollBotUpdates error:', e);
    }
  };

  useEffect(() => {
    if (!user) return;

    // App to'liq yuklanib bo'lgandan keyin 60 sekunddan so'ng boshlaydi
    // GlobalAlerter (5 min) dan ancha oldin, lekin startup bloklashini oldini olish uchun
    const initTimer = setTimeout(() => {
      runChecks();
    }, 60000);

    // Check every 60 seconds
    timerRef.current = setInterval(() => {
      runChecks();
    }, 60000);

    // /start polling — dastlab 2 daqiqadan keyin boshlaydi (ilgari 5 sek edi — startup blokardi!)
    const pollInitTimer = setTimeout(() => {
      runPoll();
    }, 2 * 60 * 1000); // 2 daqiqa

    pollTimerRef.current = setInterval(() => {
      runPoll();
    }, 2 * 60 * 1000); // 30s → 120s: Telegram bot uchun 2 daqiqa yetarli (trafik 4x kamaydi)

    return () => {
      clearTimeout(initTimer);
      clearTimeout(pollInitTimer);
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [user]);

  return null; // Background component — renders nothing
}
