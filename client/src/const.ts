export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const DEV_SESSION_STORAGE_KEY = "manus-dev-session-open-id";
export const APP_SESSION_STORAGE_KEY = "studentbkgs-app-session-token";

declare global {
  interface Window {
    __DEV_SESSION_OPEN_ID__?: string;
  }
}

const isLocalAuthFallbackHost = () => {
  if (typeof window === "undefined") return false;

  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local");
};

export const safeLocalStorageGetItem = (key: string): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const safeLocalStorageSetItem = (key: string, value: string): boolean => {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

export const safeLocalStorageRemoveItem = (key: string): boolean => {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
};

export const clearDevSession = (): void => {
  if (typeof window === "undefined") return;
  try {
    delete window.__DEV_SESSION_OPEN_ID__;
  } catch {
    window.__DEV_SESSION_OPEN_ID__ = undefined;
  }
  safeLocalStorageRemoveItem(DEV_SESSION_STORAGE_KEY);
};

export const setAppSessionToken = (token: string | null | undefined): void => {
  if (!token) {
    safeLocalStorageRemoveItem(APP_SESSION_STORAGE_KEY);
    return;
  }
  safeLocalStorageSetItem(APP_SESSION_STORAGE_KEY, token);
};

export const getAppSessionToken = (): string | null => {
  return safeLocalStorageGetItem(APP_SESSION_STORAGE_KEY)?.trim() || null;
};

export const clearAppSessionToken = (): void => {
  safeLocalStorageRemoveItem(APP_SESSION_STORAGE_KEY);
};

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = (): string | null => {
  if (typeof window === "undefined") return null;

  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL?.trim();
  const appId = import.meta.env.VITE_APP_ID?.trim();
  if (!oauthPortalUrl || !appId) {
    return isLocalAuthFallbackHost() || import.meta.env.DEV ? "/dev-login" : null;
  }

  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  try {
    const url = new URL(`${oauthPortalUrl.replace(/\/+$/, "")}/app-auth`);
    url.searchParams.set("appId", appId);
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");
    return url.toString();
  } catch {
    return null;
  }
};

export const getDevSessionOpenId = (): string | null => {
  if (typeof window === "undefined") return null;
  if (!isLocalAuthFallbackHost()) return null;

  const openId =
    window.__DEV_SESSION_OPEN_ID__?.trim() ??
    safeLocalStorageGetItem(DEV_SESSION_STORAGE_KEY)?.trim();
  return openId ? openId : null;
};

export const getDevAuthHeaders = (): Record<string, string> => {
  const openId = getDevSessionOpenId();
  return openId ? { "x-dev-session": openId } : {};
};
