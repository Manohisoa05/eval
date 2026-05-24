import { ADMIN_DIR } from './config/api.js'

export async function adminLogin(email, password) {
  const adminBase = ADMIN_DIR.startsWith('/') ? ADMIN_DIR : '/' + ADMIN_DIR
  const url = `${adminBase}/index.php?controller=AdminLogin&ajax=1&action=login`;
  const formData = new URLSearchParams();
  formData.append('ajax', '1');
  formData.append('controller', 'AdminLogin');
  formData.append('submitLogin', '1');
  formData.append('email', email);
  formData.append('passwd', password);

  const res = await fetch(url, {
    method: 'POST',
    body: formData,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}${text ? ' - ' + text : ''}`)
  }

  const ct = (res.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) return res.json();
  const text = await res.text().catch(() => '');
  // attempt to parse JSON or XML fallback
  if (text && (text.trim().startsWith('{') || text.trim().startsWith('['))) {
    return JSON.parse(text);
  }
  try {
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, 'application/xml');
    const hasErrorsNode = xml.getElementsByTagName('hasErrors')[0];
    const redirectNode = xml.getElementsByTagName('redirect')[0];
    const hasErrors = hasErrorsNode ? (hasErrorsNode.textContent === 'false' || hasErrorsNode.textContent === '0' ? false : true) : null;
    const redirect = redirectNode ? redirectNode.textContent : null;
    return { hasErrors, redirect };
  } catch (e) {
    return { raw: text };
  }
}

export default { adminLogin };
