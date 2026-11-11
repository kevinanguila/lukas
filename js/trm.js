// TRM oficial (Superfinanciera) desde datos.gov.co — gratis, sin clave.
const API = 'https://www.datos.gov.co/resource/32sa-8pi3.json';

export async function fetchTRM(dateISO) {
  const where = encodeURIComponent(`vigenciadesde <= '${dateISO}T00:00:00.000' AND vigenciahasta >= '${dateISO}T00:00:00.000'`);
  const url = `${API}?$where=${where}&$limit=1`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(r.status);
    const data = await r.json();
    const v = parseFloat(data?.[0]?.valor);
    return isNaN(v) ? null : v;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
