// Central API configuration and helpers
// Safe handling so this file can be imported by both Vite (browser) and Node (vite.config)
const _importMetaEnv = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
const _wsKeyRaw = (_importMetaEnv && _importMetaEnv.VITE_WS_KEY) || (typeof process !== 'undefined' && process.env && process.env.VITE_WS_KEY) || '3EUEWX5678QLZCLEY6BMTZ65WSD341XU';

export const API_BASE = (_importMetaEnv && _importMetaEnv.VITE_API_BASE) || '/api';
export const CACHE_TTL = parseInt((_importMetaEnv && _importMetaEnv.VITE_CACHE_TTL_MS) || '300000', 10);
export const WS_KEY = String(_wsKeyRaw).trim();

// Dev proxy configuration (falls back to process.env when available)
export const DEV_PROXY = {
  target: (typeof process !== 'undefined' && process.env && process.env.VITE_API_TARGET) || 'http://localhost/evaluation',
  adminPath: (typeof process !== 'undefined' && process.env && process.env.VITE_ADMIN_PATH) || '/admin123',
};

// ADMIN_DIR: prefer import.meta.env, then process.env, then DEV_PROXY.adminPath default
export const ADMIN_DIR = (_importMetaEnv && _importMetaEnv.VITE_ADMIN_DIR) || (typeof process !== 'undefined' && process.env && process.env.VITE_ADMIN_PATH) || DEV_PROXY.adminPath || '/admin123';

export function buildUrl(path) {
  // ensure no double-slashes
  if (!path) return API_BASE;
  const base = API_BASE.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
  if (WS_KEY && !/([?&])ws_key=/.test(base)) {
    return base + (base.indexOf('?') === -1 ? '?' : '&') + `ws_key=${encodeURIComponent(WS_KEY)}`;
  }
  return base;
}

export async function fetchXmlResponse(url) {
  const r = await fetch(url, { headers: { Accept: "application/xml" }, credentials: "include" });
  if (!r.ok) throw new Error("http " + r.status);
  return r.text();
}

export default {
  API_BASE,
  CACHE_TTL,
  DEV_PROXY,
  buildUrl,
  fetchXmlResponse,
};
