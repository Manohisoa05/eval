// Simple localStorage-backed cache for API responses
// Key is any string (we commonly use the request URL). Stores {ts, data}.
export function _cacheKey(key) {
  return `apiCache:${key}`
}

export async function fetchWithCache(key, fetcher, ttl = 5000 ) {
  try {
    const raw = localStorage.getItem(_cacheKey(key))
    if (raw) {
      const obj = JSON.parse(raw)
      if (obj && obj.ts && (Date.now() - obj.ts) < ttl) {
        return obj.data
      }
    }
  } catch (e) {
    // ignore parse/storage errors and fallthrough to fetching
  }

  const data = await fetcher()
  try {
    localStorage.setItem(_cacheKey(key), JSON.stringify({ ts: Date.now(), data }))
  } catch (e) {
    // ignore quota errors
  }
  return data
}

export function clearCache(key) {
  try { localStorage.removeItem(_cacheKey(key)) } catch (e) {}
}

export function clearCachePrefix(prefix) {
  try {
    const p = _cacheKey(prefix);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.indexOf(p) === 0) localStorage.removeItem(k);
    }
  } catch (e) {}
}

export function setCache(key, data) {
  try { localStorage.setItem(_cacheKey(key), JSON.stringify({ ts: Date.now(), data })) } catch (e) {}
}
