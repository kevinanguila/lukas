// Entiende frases tipo chat: "gasté 25 lucas en almuerzo con nequi"
import { S } from './store.js';
import { parseNumber } from './money.js';
import { todayISO, addDays, iso, today } from './dates.js';

export const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

const ACCOUNT_ALIASES = {
  nu: ['nu', 'nubank', 'la nu', 'cajita', 'cajitas'],
  nequi: ['nequi', 'neki'],
  bancolombia: ['bancolombia', 'banco', 'bc', 'tarjeta bancolombia'],
  arq: ['arq', 'dolares', 'usd'],
};

// Monto: "25 lucas", "25 mil", "25k", "25.000", "1,5 millones", "un palo", "1630 usd", "$25.000"
function findAmount(text) {
  const t = norm(text);
  const re = /(\$|us\$)?\s*(\d+(?:[.,]\d+)*)\s*(millon(?:es)?|k|mil|lucas?|lukas?|barras?|palos?|m\b|usd|dolares|dolar|us)?/g;
  let best = null;
  let m;
  while ((m = re.exec(t))) {
    let n = parseNumber(m[2]);
    if (isNaN(n)) continue;
    const unit = m[3] || '';
    let currency = m[1] === 'us$' ? 'USD' : null;
    if (/^(k|mil|lucas?|lukas?|barras?)$/.test(unit)) n *= 1000;
    else if (/^(millon|millones|palos?|m)$/.test(unit)) n *= 1e6;
    else if (/^(usd|dolares|dolar|us)$/.test(unit)) currency = 'USD';
    // Ignora números de días ("el 20") si hay otro mejor
    const score = (unit ? 2 : 0) + (m[1] ? 2 : 0) + (n >= 1000 ? 1 : 0);
    if (!best || score > best.score) best = { amount: n, currency, score, raw: m[0] };
  }
  if (!best) {
    if (/\bun palo\b/.test(t)) return { amount: 1e6, currency: null, raw: 'un palo' };
    if (/\bmedio palo\b/.test(t)) return { amount: 5e5, currency: null, raw: 'medio palo' };
    if (/\buna luca\b/.test(t)) return { amount: 1000, currency: null, raw: 'una luca' };
  }
  return best;
}

function findAccounts(text) {
  const t = ` ${norm(text)} `;
  const found = [];
  for (const [id, aliases] of Object.entries(ACCOUNT_ALIASES)) {
    for (const a of aliases) {
      const idx = t.search(new RegExp(`[^a-z]${a}[^a-z]`));
      if (idx >= 0) { found.push({ id, idx }); break; }
    }
  }
  return found.sort((a, b) => a.idx - b.idx).map((f) => f.id);
}

export function guessCategory(text, type = 'expense') {
  const t = norm(text);
  const words = t.split(/[^a-zñ0-9]+/);
  const st = S();
  // 1. Lo que Lukas ya aprendió de ti
  for (const w of words) if (st.learned[w]) {
    const c = st.categories.find((x) => x.id === st.learned[w]);
    if (c && (type !== 'income') === (c.block !== 'ingreso')) return c.id;
  }
  // 2. Palabras clave de cada categoría
  let best = null;
  for (const c of st.categories) {
    if (type === 'income' ? c.block !== 'ingreso' : c.block === 'ingreso') continue;
    for (const k of c.keywords || []) {
      const kn = norm(k);
      if (new RegExp(`(^|[^a-z])${kn}([^a-z]|$)`).test(t) && (!best || kn.length > best.len)) best = { id: c.id, len: kn.length };
    }
  }
  return best?.id || null;
}

function findRecurring(text) {
  const t = norm(text);
  return S().recurring.find((r) => r.active && new RegExp(`(^|[^a-z])${norm(r.name)}([^a-z]|$)`).test(t));
}

function findPocket(text) {
  const t = norm(text);
  return S().pockets.find((p) => !p.archived && t.includes(norm(p.name)));
}

function findDate(text) {
  const t = norm(text);
  if (/\bantier|anteayer|antes de ayer\b/.test(t)) return iso(addDays(today(), -2));
  if (/\bayer\b/.test(t)) return iso(addDays(today(), -1));
  const m = t.match(/\bel (\d{1,2})\b/);
  if (m) {
    const d = new Date();
    const day = Number(m[1]);
    if (day >= 1 && day <= 31) {
      let cand = new Date(d.getFullYear(), d.getMonth(), day);
      if (cand > d) cand = new Date(d.getFullYear(), d.getMonth() - 1, day);
      return iso(cand);
    }
  }
  return todayISO();
}

// Limpia el texto para usarlo como nota
function cleanNote(text, amountRaw) {
  let s = text;
  if (amountRaw) s = s.replace(new RegExp(amountRaw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '');
  s = s
    .replace(/\b(gast[eé]|pagu[eé]|compr[eé]|me gast[eé]|saqu[eé]|ech[eé]|tanque[eé]|di|en|con|por|de|del|la|el|los|las|un|una|hoy|ayer|desde|a|al|y|mi|pesos|lucas?|mil|me pagaron|recib[ií]|pas[eé]|mand[eé]|transfer[ií])\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return s ? s[0].toUpperCase() + s.slice(1) : '';
}

// Resultado: { intent, tx?, question? }
export function parse(text) {
  const t = norm(text).trim();
  if (!t) return { intent: 'empty' };

  // Preguntas a Lukas
  if (/(cuanto|cuánto).*(queda|tengo|llevo|disponible)|^saldo|mis cuentas|como voy|cómo voy|resumen/.test(t) && !/gast[eé]|pagu[eé]/.test(t)) return { intent: 'status' };
  if (/consejo|que hago|qué hago|recomienda|tirala|tírala|dimelo|ayuda/.test(t)) return { intent: 'advice' };
  if (/^(hola|habla|ey|ajá|aja|que hubo|qu[eé] hubo|buenas|epa)\b/.test(t) && !findAmount(t)) return { intent: 'greet' };
  if (/pendiente|que me falta|qué me falta|checklist|que debo pagar/.test(t)) return { intent: 'pending' };
  if (/mudanza|meta/.test(t) && !findAmount(t)) return { intent: 'goal' };

  let amt = findAmount(text);
  const rec = findRecurring(text);
  // "Pagué el internet" sin monto: usa lo que falta del compromiso
  if (!amt && rec && /\b(pague|pagué|pago|pagado|listo|cancele|cancelé)\b/.test(t)) {
    amt = { amount: rec.amount, currency: null, raw: '' };
  }
  if (!amt) return { intent: 'unknown' };

  const accs = findAccounts(text);
  const date = findDate(text);
  const pk = findPocket(text);

  // Transferencia: "pasé 500 lucas de nu a nequi"
  if (/\b(pase|pasé|mande|mandé|transferi|transferí|movi|moví|gire|giré)\b/.test(t) && accs.length >= 2 && !/mama|mamá/.test(t)) {
    return {
      intent: 'tx',
      tx: { type: 'transfer', amount: amt.amount, account: accs[0], toAccount: accs[1], toAmount: amt.amount, date, note: 'Transferencia' },
    };
  }

  // Ingreso
  if (/\b(me pagaron|recibi|recibí|me llego|me llegó|me cayo|me cayó|ingreso|yaca|me consignaron|me devolvieron|gane|gané|vendi|vendí)\b/.test(t)) {
    return {
      intent: 'tx',
      tx: { type: 'income', amount: amt.amount, account: accs[0] || (amt.currency === 'USD' ? 'arq' : 'nu'), category: guessCategory(text, 'income') || 'otros_ing', date, note: cleanNote(text, amt.raw) },
      currency: amt.currency,
    };
  }

  // Gasto
  const catId = rec?.category || guessCategory(text);
  const defaultAcc = rec?.account || S().categories.find((c) => c.id === catId)?.account || 'nequi';
  return {
    intent: 'tx',
    tx: {
      type: 'expense',
      amount: amt.amount,
      account: accs[0] || defaultAcc,
      category: catId,
      recurring: rec?.id || null,
      pocket: pk?.id || null,
      date,
      note: rec ? rec.name : cleanNote(text, amt.raw),
    },
    currency: amt.currency,
  };
}
