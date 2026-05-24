// Central API configuration and helpers for frontoffice
const _importMetaEnv = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
const _wsKeyRaw = (_importMetaEnv && _importMetaEnv.VITE_WS_KEY) || (typeof process !== 'undefined' && process.env && process.env.VITE_WS_KEY) || '3EUEWX5678QLZCLEY6BMTZ65WSD341XU';

export const API_BASE = (_importMetaEnv && _importMetaEnv.VITE_API_BASE) || '/api';
export const CACHE_TTL = parseInt((_importMetaEnv && _importMetaEnv.VITE_CACHE_TTL_MS) || '300000', 10);
// PrestaShop webservice key (can be set with VITE_WS_KEY)
export const WS_KEY = String(_wsKeyRaw).trim();

export const DEV_PROXY = {
  target: (typeof process !== 'undefined' && process.env && process.env.VITE_API_TARGET) || 'http://localhost/evaluation',
};

// Base URL for frontoffice pages (can be set with VITE_SHOP_BASE)
export const SHOP_BASE = (_importMetaEnv && _importMetaEnv.VITE_SHOP_BASE) || (typeof process !== 'undefined' && process.env && process.env.VITE_SHOP_BASE) || DEV_PROXY.target;


export function buildUrl(path) {
  if (!path) return API_BASE;
  const base = API_BASE.replace(/\/$/, '') + '/' + path.replace(/^\//, '')
  // append ws_key if provided and not already present
  try {
    if (WS_KEY && !/([?&])ws_key=/.test(base)) {
      return base + (base.indexOf('?') === -1 ? '?' : '&') + `ws_key=${encodeURIComponent(WS_KEY)}`
    }
  } catch (e) {
    // ignore and return base
  }
  return base
}

export async function fetchXmlResponse(url) {
  const r = await fetch(url, { headers: { Accept: 'application/xml' }, credentials: 'include' });
  if (!r.ok) throw new Error('http ' + r.status);
  return r.text();
}

export function buildAuthUrl() {
  // Use same-origin proxy when API_BASE is relative (avoids CORS in dev)
  if (API_BASE && API_BASE.startsWith('/')) {
    const base = API_BASE.replace(/\/$/, '')
    return `${base}/index.php?controller=authentication`
  }
  const base = (SHOP_BASE || '').replace(/\/$/, '')
  return `${base}/index.php?controller=authentication`
}

export default {
  API_BASE,
  CACHE_TTL,
  DEV_PROXY,
  SHOP_BASE,
  buildUrl,
  fetchXmlResponse,
  buildAuthUrl,
};

