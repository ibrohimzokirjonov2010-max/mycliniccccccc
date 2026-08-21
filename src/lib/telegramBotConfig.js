import { fetchTelegramBotUsername } from '@/api/telegramBot';
import { safeLocalStorage as localStorage } from '@/utils/safeStorage';

export const normalizeBotUsername = (value) =>
  String(value || '').replace(/^@/, '').trim();

export const getEnvBotUsername = () =>
  normalizeBotUsername(import.meta.env.VITE_TELEGRAM_BOT_USERNAME);

export const cacheBotCredentials = ({ username, token } = {}) => {
  try {
    const normalizedUsername = normalizeBotUsername(username);
    if (normalizedUsername) {
      localStorage.setItem('global_bot_username', normalizedUsername);
    }
    if (token) {
      localStorage.setItem('global_bot_token', String(token).trim());
    }
  } catch {
    // ignore storage errors
  }
};

export const bootstrapTelegramBotConfig = () => {
  const envUsername = getEnvBotUsername();
  if (envUsername) {
    cacheBotCredentials({ username: envUsername });
  }
};

export const parseBotTechData = (notes) => {
  try {
    const str = String(notes || '');
    if (!str.startsWith('[TECH_DATA]')) return null;
    const jsonStr = str.split('[END_TECH]')[0].replace('[TECH_DATA]', '');
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
};

export const resolveBotUsernameFromConfig = async (cfg, tech) => {
  const direct =
    cfg?.botUsername ||
    cfg?.bot_username ||
    tech?.botUsername ||
    tech?.bot_username ||
    '';

  const configured = normalizeBotUsername(direct);
  if (configured) return configured;

  const envUsername = getEnvBotUsername();
  if (envUsername) return envUsername;

  try {
    const globalUsername = normalizeBotUsername(localStorage.getItem('global_bot_username'));
    if (globalUsername) return globalUsername;
  } catch {
    // ignore
  }

  const token =
    cfg?.botToken ||
    cfg?.bot_token ||
    tech?.botToken ||
    tech?.bot_token ||
    localStorage.getItem('global_bot_token') ||
    '';

  if (token) {
    const fetched = await fetchTelegramBotUsername(token);
    if (fetched) {
      cacheBotCredentials({ username: fetched, token });
      return fetched;
    }
  }

  return '';
};
