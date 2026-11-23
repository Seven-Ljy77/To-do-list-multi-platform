import { isTauri } from "@tauri-apps/api/core";
import { load } from "@tauri-apps/plugin-store";

const TOKEN_KEY = "token";
const FALLBACK_KEY = "todo_token";

type TauriStore = Awaited<ReturnType<typeof load>>;

let storePromise: Promise<TauriStore | null> | null = null;

function getStore(): Promise<TauriStore | null> {
  if (!isTauri()) {
    return Promise.resolve(null);
  }
  if (!storePromise) {
    storePromise = load("auth.json", { autoSave: true }).catch(() => null);
  }
  return storePromise;
}

export async function loadToken(): Promise<string | null> {
  const store = await getStore();
  if (store) {
    return (await store.get<string>(TOKEN_KEY)) ?? null;
  }
  return localStorage.getItem(FALLBACK_KEY);
}

export async function saveToken(token: string): Promise<void> {
  const store = await getStore();
  if (store) {
    await store.set(TOKEN_KEY, token);
    await store.save();
    return;
  }
  localStorage.setItem(FALLBACK_KEY, token);
}

export async function clearToken(): Promise<void> {
  const store = await getStore();
  if (store) {
    await store.delete(TOKEN_KEY);
    await store.save();
    return;
  }
  localStorage.removeItem(FALLBACK_KEY);
}

export const deviceName = /Android/i.test(navigator.userAgent)
  ? "Android 手机"
  : "Windows 桌面端";
