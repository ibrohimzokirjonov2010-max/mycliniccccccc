/**
 * Lightweight Telegram bot (MongoDB kerak emas).
 * Bemorni Supabase CRM bilan bog'laydi.
 *
 * Ishga tushirish: node scripts/telegram-bot-standalone.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);
const { Telegraf } = require(path.join(root, 'backend', 'node_modules', 'telegraf'));

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return env;
}

const frontendEnv = readEnvFile(path.join(root, '.env'));
const backendEnv = readEnvFile(path.join(root, 'backend', '.env'));

const TOKEN = backendEnv.TELEGRAM_BOT_TOKEN;
const SUPABASE_URL = frontendEnv.VITE_SUPABASE_URL || backendEnv.SUPABASE_URL;
const SUPABASE_KEY = frontendEnv.VITE_SUPABASE_ANON_KEY || backendEnv.SUPABASE_KEY;

if (!TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN topilmadi (backend/.env)');
  process.exit(1);
}

function mergeTechDataIntoNotes(existingNotes, updates) {
  let techData = {};
  let userNotes = existingNotes || '';

  if (typeof existingNotes === 'string' && existingNotes.startsWith('[TECH_DATA]')) {
    try {
      const endIdx = existingNotes.indexOf('[END_TECH]');
      if (endIdx !== -1) {
        techData = JSON.parse(existingNotes.substring(11, endIdx) || '{}');
        userNotes = existingNotes.substring(endIdx + 10).replace(/^\n/, '');
      }
    } catch {
      // ignore
    }
  }

  return `[TECH_DATA]${JSON.stringify({ ...techData, ...updates })}[END_TECH]${userNotes ? `\n${userNotes}` : ''}`;
}

async function linkPatientInSupabase(patientId, chatId) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;

  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };

  const fetchUrl = `${SUPABASE_URL}/rest/v1/patients?id=eq.${encodeURIComponent(patientId)}&select=id,full_name,notes&limit=1`;
  const response = await fetch(fetchUrl, { headers });
  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const row = rows[0];
  const patchUrl = `${SUPABASE_URL}/rest/v1/patients?id=eq.${encodeURIComponent(patientId)}`;
  const patchRes = await fetch(patchUrl, {
    method: 'PATCH',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({
      notes: mergeTechDataIntoNotes(row.notes || '', { telegram_chat_id: chatId }),
    }),
  });

  if (!patchRes.ok) return null;
  return { full_name: row.full_name };
}

const bot = new Telegraf(TOKEN);

bot.start(async (ctx) => {
  const payload = ctx.startPayload;
  const chatId = String(ctx.chat.id);
  const userFirstName = ctx.from?.first_name || 'Bemor';

  if (!payload) {
    await ctx.reply(
      `👋 Assalomu alaykum, ${userFirstName}!\n\n` +
      `Bu bot klinika tomonidan boshqariladi.\n` +
      `Eslatmalar olish uchun klinikadan maxsus havolani oling.`,
    );
    return;
  }

  if (payload.startsWith('admin_')) {
    await ctx.reply(`✅ Admin bog'landi.\nChat ID: ${chatId}`);
    return;
  }

  try {
    const linked = await linkPatientInSupabase(payload, chatId);
    if (linked) {
      await ctx.reply(
        `✅ Assalomu alaykum, ${linked.full_name || userFirstName}!\n\n` +
        `Siz klinika botiga muvaffaqiyatli ulandingiz.\n` +
        `Endi qabul vaqtingizdan oldin avtomatik eslatmalar olasiz. 🦷`,
      );
      console.log(`✅ Patient linked: ${linked.full_name} -> ${chatId}`);
      return;
    }

    await ctx.reply(
      `❌ Kechirasiz, ${userFirstName}. Ma'lumot topilmadi.\n` +
      `CRM dagi havola orqali qayta urinib ko'ring yoki klinikaga murojaat qiling.`,
    );
  } catch (error) {
    console.error('Link error:', error);
    await ctx.reply('Xatolik yuz berdi. Keyinroq qayta urinib ko\'ring.');
  }
});

bot.launch().then(async () => {
  const me = await bot.telegram.getMe();
  console.log('==============================================');
  console.log(`✅ Telegram bot ishlayapti: @${me.username}`);
  console.log('Bemor havolasi: https://t.me/' + me.username + '?start=BEMOR_ID');
  console.log('To\'xtatish: Ctrl+C');
  console.log('==============================================');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
