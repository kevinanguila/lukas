// El "cerebro" del chat: entiende frases como las dirías hablando.
//   "gasté 25 lucas en almuerzo con nequi"
//   "almuerzo 20 y taxi 12"
//   "pagué el internet"            (sin monto: usa el del compromiso)
//   "tankié 80 mil"                (con errores de escritura)
//   "¿me alcanza pa' salir el sábado con 100 lucas?"
import { S } from './store.js';
import { parseNumber } from './money.js';
import { todayISO, addDays, iso, today } from './dates.js';
import { classify } from './brain.js';

// Quita tildes pero conserva la ñ (para no confundir "uñas" con "unas")
export const norm = (s) => String(s || '').toLowerCase().replace(/ñ/g, '\u0001').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0001/g, 'ñ').replace(/[¿¡]/g, '');

// ---------- Utilidades de texto ----------
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}
// "tankie" ≈ "tanquie", "almorze" ≈ "almorce"
const unify = (w) => w.replace(/qu/g, 'k').replace(/c(?=[aou])/g, 'k').replace(/z/g, 's').replace(/ce|ci/g, (m) => 's' + m[1]).replace(/v/g, 'b').replace(/ll/g, 'y').replace(/h/g, '').replace(/(.)\1+/g, '$1');
const words = (t) => norm(t).split(/[^a-z0-9ñ]+/).filter(Boolean);
const hasWord = (t, w) => new RegExp(`(^|[^a-z0-9ñ])${w}([^a-z0-9ñ]|$)`).test(t);

function fuzzyHas(text, keyword) {
  const t = norm(text), k = norm(keyword);
  if (k.includes(' ')) return t.includes(k);
  if (hasWord(t, k)) return true;
  if (k.length < 5) return false;
  const uk = unify(k);
  return words(t).some((w) => w.length >= 4 && (unify(w) === uk || (w.length >= 5 && lev(unify(w), uk) <= 1)));
}

// ---------- Cuentas ----------
const ACCOUNT_ALIASES = {
  nu: ['nu', 'nubank', 'la nu', 'cajita', 'cajitas', 'tarjeta nu'],
  nequi: ['nequi', 'neki', 'nekí', 'el nequi'],
  bancolombia: ['bancolombia', 'banco', 'bc', 'tarjeta bancolombia', 'la bancolombia'],
  arq: ['arq', 'dolares', 'usd'],
};
function findAccounts(text) {
  const t = ` ${norm(text)} `;
  const found = [];
  const accs = S().accounts.filter((a) => !a.hidden);
  for (const a of accs) {
    const aliases = [...(ACCOUNT_ALIASES[a.id] || []), norm(a.name)];
    for (const al of aliases) {
      const idx = t.search(new RegExp(`[^a-z]${al}[^a-z]`));
      if (idx >= 0) { found.push({ id: a.id, idx }); break; }
    }
  }
  return found.sort((a, b) => a.idx - b.idx).map((f) => f.id);
}

// ---------- Montos ----------
// "25 lucas", "25 mil", "25k", "25.000", "1,5 millones", "un palo", "medio palo", "1630 usd", "$25.000", "20" (→ 20 mil)
const UNIT = '(millon(?:es)?|palos?|k|mil|lucas?|lukas?|barras?|m\\b|usd|dolares|dolar|us)';
export function findAmounts(text) {
  // "4x1000" es el impuesto, no un monto
  const t = norm(text).replace(/\b4\s*x\s*1\.?000\b|\b4\s*por\s*mil\b/g, ' gmf ');
  const re = new RegExp(`(\\$|us\\$)?\\s*(\\d+(?:[.,]\\d+)*)\\s*${UNIT}?`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(t))) {
    let n = parseNumber(m[2]);
    if (isNaN(n)) continue;
    const before = t.slice(Math.max(0, m.index - 4), m.index);
    // "el 20", "dia 15": son fechas, no montos
    if (/(el|dia|los) $/.test(before) && !m[3] && !m[1]) continue;
    const unit = m[3] || '';
    let currency = m[1] === 'us$' ? 'USD' : null;
    let explicit = !!(unit || m[1]);
    if (/^(k|mil|lucas?|lukas?|barras?)$/.test(unit)) n *= 1000;
    else if (/^(millon|millones|palos?|m)$/.test(unit)) n *= 1e6;
    else if (/^(usd|dolares|dolar|us)$/.test(unit)) currency = 'USD';
    out.push({ amount: n, currency, explicit, idx: m.index, raw: m[0].trim() });
  }
  if (/\bmedio palo\b/.test(t)) out.push({ amount: 5e5, currency: null, explicit: true, idx: t.indexOf('medio palo'), raw: 'medio palo' });
  else if (/\bun palo\b/.test(t)) out.push({ amount: 1e6, currency: null, explicit: true, idx: t.indexOf('un palo'), raw: 'un palo' });
  if (/\buna luca\b/.test(t)) out.push({ amount: 1000, currency: null, explicit: true, idx: t.indexOf('una luca'), raw: 'una luca' });
  // En pesos nadie gasta "20": se entiende "20 mil"
  for (const a of out) if (!a.explicit && !a.currency && a.amount > 0 && a.amount < 1000) { a.amount *= 1000; a.assumed = true; }
  return out.sort((a, b) => a.idx - b.idx);
}
export function findAmount(text) {
  const all = findAmounts(text);
  if (!all.length) return null;
  return all.slice().sort((a, b) => (b.explicit - a.explicit) || (b.amount - a.amount))[0];
}

// ---------- Categoría (grupo + detalle) ----------
export function guessCategory(text, type = 'expense') {
  const st = S();
  const wantIncome = type === 'income';
  // 1. Lo que Lukas ya aprendió de ti
  for (const w of words(text)) {
    const l = st.learned[w];
    if (!l) continue;
    const [c, i] = l.split('/');
    const cat = st.categories.find((x) => x.id === c);
    if (cat && (cat.block === 'ingreso') === wantIncome) return { category: c, item: i || null };
  }
  // 2. Compromisos por nombre ("pagué el internet")
  const rec = st.recurring.find((r) => r.active && fuzzyHas(text, r.name));
  if (rec && !wantIncome) return { category: rec.category, item: rec.item || null, recurring: rec.id };
  // 3. Palabras clave de cada detalle y de cada grupo
  let best = null;
  for (const c of st.categories) {
    if ((c.block === 'ingreso') !== wantIncome) continue;
    const consider = (kw, itemId) => {
      if (fuzzyHas(text, kw)) {
        const score = norm(kw).length + (hasWord(norm(text), norm(kw)) ? 2 : 0);
        if (!best || score > best.score) best = { category: c.id, item: itemId, score };
      }
    };
    for (const i of c.items || []) { consider(i.name, i.id); (i.keywords || []).forEach((k) => consider(k, i.id)); }
    consider(c.name, null);
    (c.keywords || []).forEach((k) => consider(k, null));
  }
  return best ? { category: best.category, item: best.item } : null;
}

// ---------- Fechas ----------
const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
export function findDate(text) {
  const t = norm(text);
  if (/\b(antier|anteayer|antes de ayer|antes de anoche)\b/.test(t)) return iso(addDays(today(), -2));
  if (/\b(ayer|anoche)\b/.test(t)) return iso(addDays(today(), -1));
  for (let i = 0; i < 7; i++) {
    if (new RegExp(`\\b(el )?${DIAS[i]}( pasado)?\\b`).test(t) && !/\b(este|proximo|que viene)\b/.test(t)) {
      let d = today();
      do d = addDays(d, -1); while (d.getDay() !== i);
      return iso(d);
    }
  }
  const m = t.match(/\b(?:el|dia)\s+(\d{1,2})(?:\s+de\s+([a-z]+))?\b/);
  if (m) {
    const day = Number(m[1]);
    const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const now = new Date();
    let month = m[2] ? MES.indexOf(m[2]) : now.getMonth();
    if (month < 0) month = now.getMonth();
    if (day >= 1 && day <= 31) {
      let cand = new Date(now.getFullYear(), month, day);
      if (cand > now) cand = m[2] ? new Date(now.getFullYear() - 1, month, day) : new Date(now.getFullYear(), now.getMonth() - 1, day);
      return iso(cand);
    }
  }
  return todayISO();
}

// ---------- Nota limpia ----------
const FILLER = /\b(gast[eéo]|me gaste|pagu[eé]|pago|compr[eé]|saqu[eé]|ech[eé]|tanque[eé]|tankie|tanquie|di|en|con|por|de|del|la|el|los|las|un|una|unos|unas|hoy|ayer|anoche|antier|desde|a|al|y|mi|me|pesos|lucas?|lukas?|mil|barras?|palos?|millones|millon|k|usd|dolares|nequi|nu|bancolombia|arq|cuenta|tarjeta|que|se|fue|fueron|por fa|porfa|anota|anotame|apunta|registra)\b/gi;
function cleanNote(text, raw) {
  let s = text;
  if (raw) s = s.replace(new RegExp(raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), ' ');
  s = s.replace(/\$?\d+(?:[.,]\d+)*/g, ' ').replace(FILLER, ' ').replace(/[¿?¡!.,;:]/g, ' ').replace(/\s+/g, ' ').trim();
  return s ? s[0].toUpperCase() + s.slice(1) : '';
}

// ---------- Intenciones ----------
const RX = {
  income: /\b(me pagaron|pagaron|recibi|me llego|me llegaron|llego|me cayo|cayo|ingreso|yaca|yacaman|yacayou|me consignaron|consignaron|me devolvieron|gane|vendi|me transfirieron|me mandaron|me pasaron|me dieron|me regalaron)\b/,
  transfer: /\b(pase|mande|transferi|movi|gire|envie|meti|traslade)\b/,
  expense: /\b(gaste|gasto|me gaste|pague|compre|saque|eche|tanquee|tankie|tanquie|tankee|me comi|me tome|invite|di|dimos|salio|costo|valio|fueron|fue)\b/,
};

export function parse(text, ctx = {}) {
  const t = norm(text).trim().replace(/\s+/g, ' ');
  if (!t) return { intent: 'empty' };
  const amounts = findAmounts(text);
  const hasAmt = amounts.length > 0;

  // Respuestas cortas a una pregunta pendiente de Lukas
  if (ctx.pending) {
    if (/^(no|nada|cancela|cancelar|olvidalo|dejalo|deja asi)\b/.test(t)) return { intent: 'cancel_pending' };
    if (ctx.pending.need === 'amount' && hasAmt) return { intent: 'fill', amount: amounts[0].amount, currency: amounts[0].currency };
    if (ctx.pending.need === 'category') {
      const g = guessCategory(text, ctx.pending.draft?.type);
      if (g) return { intent: 'fill', ...g };
    }
  }

  // Charla
  if (/^(gracias|grax|mil gracias|muchas gracias|bacano|chevere|listo|ok|okey|dale|va|eso|perfecto|nitido)\b[\s!.]*$/.test(t)) return { intent: 'thanks' };
  if (/^(hola|habla|ey|epa|aja|que hubo|quiubo|buenas|buenos dias|buenas tardes|buenas noches|que mas|q mas|que hay|que es la que hay)\b/.test(t) && !hasAmt) return { intent: 'greet' };
  if (/\b(ayuda|como funciona|que puedo decir|que sabes hacer|como te hablo|comandos)\b/.test(t)) return { intent: 'help' };
  if (/\b(borra|borrar|deshace|deshacer|elimina|quita)\b.*\b(ultimo|ultima|eso|anterior)\b|^(deshacer|borralo|borra eso)$/.test(t)) return { intent: 'undo' };

  // Preguntas sobre la plata
  if (/\b(pelado|pelao|sin plata|sin un peso|limpio|en la mala|quebrado|estoy en cero|no tengo plata|no me queda nada)\b/.test(t)) return { intent: 'broke' };
  if (/\b(alcanza|me da|puedo gastar|me puedo dar|puedo comprar|me puedo comprar|aguanta)\b/.test(t)) return { intent: 'afford', amount: hasAmt ? findAmount(text).amount : null };
  if (/\b(en que (gaste|se me fue|se va)|donde (gaste|se me fue)|que es lo que mas gasto|en que mas gasto|mayor gasto|gaste mas)\b/.test(t)) return { intent: 'top' };
  if (/\b(cuanto (he )?(gaste|llevo|va|van|lleve)|cuanto se me (fue|ha ido))\b.*\b(en|de)\b/.test(t)) {
    const g = guessCategory(text.replace(/cu[aá]nto|gast[eé]|llevo|en|de/gi, ' '));
    if (g) return { intent: 'spent_on', ...g };
  }
  if (/\b(cuanto tengo|saldo|cuanto hay|cuanta plata)\b/.test(t) && findAccounts(text).length && !RX.expense.test(t)) return { intent: 'balance', account: findAccounts(text)[0] };
  if (/\b(cuanto me queda|que me queda|cuanto tengo|como voy|como vamos|como estoy|resumen|mis cuentas|mi plata|saldo|patrimonio)\b/.test(t) && !(hasAmt && RX.expense.test(t))) return { intent: 'status' };
  if (/\b(consejo|que hago|recomienda|recomendacion|tirala|dimelo|que me dices|como mejoro|como ahorro|que opinas|aconsejame|tirame)\b/.test(t)) return { intent: 'advice' };
  if (/\b(pendiente|pendientes|que me falta|que debo|que tengo que pagar|que falta por pagar|checklist|que se vence|vencimientos)\b/.test(t)) return { intent: 'pending' };
  if (/\b(mudanza|meta|metas|ahorro)\b/.test(t) && !hasAmt && /\b(como va|cuanto|voy|llevo|falta)\b/.test(t)) return { intent: 'goal' };
  if (/\b(giro|reparto|transferencias)\b/.test(t) && !hasAmt) return { intent: 'giro' };

  // Preguntas "como persona" (sin montos): se comparan con muchas formas de decir lo mismo
  const brain = !hasAmt ? classify(text) : null;
  if (brain && brain.score >= 0.72) return { intent: brain.intent, via: 'brain' };

  // Varios gastos en un mensaje: "almuerzo 20 y taxi 12, gasolina 80 mil"
  if (amounts.length > 1 && !RX.transfer.test(t) && !RX.income.test(t)) {
    const parts = text.split(/\s*(?:,|;|\n|\s+y\s+|\s+mas\s+|\s+más\s+|\s+tambien\s+|\s+también\s+)\s*/i).filter((x) => findAmounts(x).length);
    if (parts.length > 1) {
      const sharedAcc = findAccounts(text)[0];
      const date = findDate(text);
      const txs = parts.map((part) => buildExpense(part, { account: findAccounts(part)[0] || sharedAcc, date })).filter(Boolean);
      if (txs.length > 1) return { intent: 'multi', txs };
    }
  }

  const accs = findAccounts(text);
  const date = findDate(text);

  // Transferencia: "pasé 500 lucas de nu a nequi"
  if (RX.transfer.test(t) && accs.length >= 2 && hasAmt) {
    const a = findAmount(text);
    return { intent: 'tx', tx: { type: 'transfer', amount: a.amount, account: accs[0], toAccount: accs[1], toAmount: a.amount, date, note: 'Transferencia' } };
  }

  // Ingreso
  if (RX.income.test(t)) {
    const a = findAmount(text);
    const g = guessCategory(text, 'income') || { category: 'otros_ing', item: 'otros_ing' };
    const tx = { type: 'income', amount: a?.amount || 0, account: accs[0] || (a?.currency === 'USD' ? 'arq' : 'nu'), ...g, date, note: cleanNote(text, a?.raw) };
    if (!a) return { intent: 'ask', need: 'amount', draft: tx };
    return { intent: 'tx', tx, currency: a.currency };
  }

  // Gasto
  const tx = buildExpense(text, { account: accs[0], date });
  if (tx && tx.amount && tx.category) return { intent: 'tx', tx, currency: tx._currency };
  // Sin monto pero sí sabemos qué fue: preguntar el monto
  const g = guessCategory(text);
  if (g && (RX.expense.test(t) || words(text).length <= 4)) {
    return { intent: 'ask', need: 'amount', draft: { type: 'expense', amount: 0, account: accs[0] || defaultAccount(g), ...g, date, note: cleanNote(text) } };
  }
  // Monto suelto sin categoría: preguntar en qué fue
  if (hasAmt) {
    const a = findAmount(text);
    return { intent: 'ask', need: 'category', draft: { type: 'expense', amount: a.amount, account: accs[0] || 'nequi', date, note: cleanNote(text, a.raw) } };
  }
  // Coincidencia más floja: si se parece bastante a algo conocido, lo tomamos
  if (brain && brain.score >= 0.5) return { intent: brain.intent, via: 'brain' };
  return { intent: 'unknown', alts: brain?.alts || [] };
}

function defaultAccount(g) {
  const st = S();
  const r = g?.recurring && st.recurring.find((x) => x.id === g.recurring);
  if (r) return r.account;
  const it = st.categories.find((c) => c.id === g?.category)?.items?.find((i) => i.id === g?.item);
  return it?.account || 'nequi';
}

function buildExpense(text, { account, date }) {
  const st = S();
  let a = findAmount(text);
  const g = guessCategory(text);
  const rec = g?.recurring ? st.recurring.find((r) => r.id === g.recurring) : null;
  // "Pagué el internet" sin monto: usa el valor del compromiso
  if (!a && rec) a = { amount: rec.amount, currency: null, raw: '' };
  if (!a) return null;
  return {
    type: 'expense',
    amount: a.amount,
    account: account || defaultAccount(g),
    category: g?.category || null,
    item: g?.item || null,
    recurring: rec?.id || null,
    pocket: findPocket(text)?.id || null,
    date: date || findDate(text),
    note: rec ? rec.name : cleanNote(text, a.raw),
    _currency: a.currency,
  };
}

function findPocket(text) {
  const t = norm(text);
  if (!/\b(bolsillo|de la|del)\b/.test(t)) return null;
  return S().pockets.find((p) => !p.archived && hasWord(t, norm(p.name)));
}
