import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { Session } from '@/lib/types';

const KEY = 'myclinic.session';

async function readRaw(): Promise<string | null> {
  if (Platform.OS === 'web') {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(KEY);
  }
  return SecureStore.getItemAsync(KEY);
}

async function writeRaw(value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(KEY, value);
    return;
  }
  await SecureStore.setItemAsync(KEY, value);
}

async function deleteRaw(): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(KEY);
    return;
  }
  await SecureStore.deleteItemAsync(KEY);
}

export async function loadSession(): Promise<Session | null> {
  try {
    const raw = await readRaw();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.user?.id || !parsed.user.clinic_id || !parsed.clinic?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveSession(session: Session): Promise<void> {
  await writeRaw(JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await deleteRaw();
}
