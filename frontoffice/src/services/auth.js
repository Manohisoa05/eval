import { buildUrl } from './config/api'

export function getCachedCustomer() {
  try {
    const raw = localStorage.getItem('ps_customer')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.customer?.customer) return { customer: parsed.customer.customer }
    if (parsed?.customer) return { customer: parsed.customer }
    return parsed
  } catch (e) {}
  return null
}

export function clearCachedCustomer() {
  try { localStorage.removeItem('ps_customer') } catch (e) {}
  try { document.cookie = 'ps_customer=; Path=/; Max-Age=0; SameSite=Lax' } catch (e) {}
}

export function cacheCustomer(customer, remember) {
  if (!customer) return
  try {
    localStorage.setItem('ps_customer', JSON.stringify({ customer }))
  } catch (e) {
    // ignore storage errors
  }

  try {
    const payload = encodeURIComponent(JSON.stringify({ customer }))
    const maxAge = remember ? 60 * 60 * 24 * 30 : undefined
    document.cookie = `ps_customer=${payload}; Path=/; SameSite=Lax${maxAge ? `; Max-Age=${maxAge}` : ''}`
  } catch (e) {
    // ignore cookie errors
  }

  try { window.dispatchEvent(new Event('ps_customer_changed')) } catch (e) {}
}

export default async function handleLogin(email, passwordSaisi, remember = false) {
  // 1. Chercher le client par email via l'API (JSON)
  const url = buildUrl(`customers?filter[email]=[${encodeURIComponent(email)}]&display=full&output_format=JSON`)

  try {
    const response = await fetch(url, { method: 'GET' })
    if (!response.ok) {
      return { ok: false, message: `Erreur ${response.status}` }
    }

    const data = await response.json()

    // 2. Vérification de l'existence
    if (!data.customers || data.customers.length === 0) {
      return { ok: false, message: 'Client inexistant, veuillez vous enregistrer !' }
    }

    const customer = data.customers[0]
    cacheCustomer(customer, remember)

    // 3. Attention: le mot de passe ne peut pas etre verifie via l'API
    // On considere le login valide si l'email existe
    return {
      ok: true,
      customer,
      warning: "Email trouve. La verification du mot de passe n'est pas possible via l'API PrestaShop.",
    }
  } catch (error) {
    return { ok: false, message: 'Erreur API' }
  }
}
