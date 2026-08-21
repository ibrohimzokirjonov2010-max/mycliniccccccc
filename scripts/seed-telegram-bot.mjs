/**
 * One-time seed: saves Telegram bot config to Supabase botconfigs table.
 * Run: node scripts/seed-telegram-bot.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
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

const supabaseUrl = frontendEnv.VITE_SUPABASE_URL || backendEnv.SUPABASE_URL;
const supabaseKey = frontendEnv.VITE_SUPABASE_ANON_KEY || backendEnv.SUPABASE_KEY;
const botToken = backendEnv.TELEGRAM_BOT_TOKEN;
const botUsername = (frontendEnv.VITE_TELEGRAM_BOT_USERNAME || 'Mydentclinic_bot').replace(/^@/, '');

if (!supabaseUrl || !supabaseKey || !botToken) {
  console.error('Missing SUPABASE_URL, SUPABASE_KEY, or TELEGRAM_BOT_TOKEN');
  process.exit(1);
}

const techData = {
  botToken,
  botUsername,
  isActive: true,
  welcomeMessage: 'Assalomu alaykum! Dental Pro Clinic botiga xush kelibsiz.',
};
const notes = `[TECH_DATA]${JSON.stringify(techData)}[END_TECH]`;

async function upsertGlobalConfig() {
  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    'Content-Type': 'application/json',
  };

  const fetchUrl = `${supabaseUrl}/rest/v1/botconfigs?clinic_id=eq.global&select=id&limit=1`;
  const existingRes = await fetch(fetchUrl, { headers });
  const existing = await existingRes.json();

  if (Array.isArray(existing) && existing.length > 0) {
    const patchUrl = `${supabaseUrl}/rest/v1/botconfigs?id=eq.${existing[0].id}`;
    const patchRes = await fetch(patchUrl, {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({
        notes,
        isActive: true,
        botUsername,
      }),
    });
    const patched = await patchRes.json();
    console.log('Updated global BotConfig:', patched?.[0]?.id || existing[0].id);
    return;
  }

  const createRes = await fetch(`${supabaseUrl}/rest/v1/botconfigs`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({
      clinic_id: 'global',
      isActive: true,
      botUsername,
      notes,
      created_date: new Date().toISOString(),
    }),
  });

  const created = await createRes.json();
  if (!createRes.ok) {
    console.error('Create failed:', created);
    process.exit(1);
  }
  console.log('Created global BotConfig:', created?.[0]?.id || created?.id);
}

upsertGlobalConfig().catch((err) => {
  console.error(err);
  process.exit(1);
});
