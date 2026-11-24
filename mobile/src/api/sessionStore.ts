import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Session tokens live in the iOS Keychain / Android Keystore via expo-secure-store.
 * Values are split so a Supabase JWT still fits under the iOS 2048-byte item limit.
 * Web (Expo web preview only) has no Keychain; it uses localStorage and is not a store build.
 */

const CHUNK = 1800;
const memory = new Map<string, string>();
let ephemeral = false;

export function setEphemeralSession(on: boolean): void {
  ephemeral = on;
  if (on) memory.clear();
}

function webStorage(): Storage | null {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return null;
  return localStorage;
}

async function writeRaw(key: string, value: string): Promise<void> {
  const web = webStorage();
  if (web) {
    web.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function readRaw(key: string): Promise<string | null> {
  const web = webStorage();
  if (web) return web.getItem(key);
  return SecureStore.getItemAsync(key);
}

async function deleteRaw(key: string): Promise<void> {
  const web = webStorage();
  if (web) {
    web.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function secureGet(key: string): Promise<string | null> {
  if (ephemeral && memory.has(key)) return memory.get(key) ?? null;
  const countRaw = await readRaw(`${key}.n`);
  if (!countRaw) return readRaw(key);
  const count = Number(countRaw);
  if (!Number.isFinite(count) || count <= 0) return null;
  const parts: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const part = await readRaw(`${key}.${index}`);
    if (part == null) return null;
    parts.push(part);
  }
  return parts.join('');
}

export async function secureSet(key: string, value: string): Promise<void> {
  if (ephemeral) {
    memory.set(key, value);
    return;
  }
  await secureRemove(key);
  const count = Math.max(1, Math.ceil(value.length / CHUNK));
  await writeRaw(`${key}.n`, String(count));
  for (let index = 0; index < count; index += 1) {
    await writeRaw(`${key}.${index}`, value.slice(index * CHUNK, (index + 1) * CHUNK));
  }
}

export async function secureRemove(key: string): Promise<void> {
  memory.delete(key);
  const countRaw = await readRaw(`${key}.n`);
  const count = Number(countRaw || 0);
  if (countRaw) await deleteRaw(`${key}.n`);
  for (let index = 0; index < count; index += 1) {
    await deleteRaw(`${key}.${index}`);
  }
  await deleteRaw(key);
}

export async function persistSet(key: string, value: string): Promise<void> {
  const previous = ephemeral;
  ephemeral = false;
  try {
    await secureSet(key, value);
  } finally {
    ephemeral = previous;
  }
}
export const authStorage = {
  getItem: (key: string) => secureGet(key),
  setItem: (key: string, value: string) => secureSet(key, value),
  removeItem: (key: string) => secureRemove(key),
};
