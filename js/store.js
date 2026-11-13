// Estado de la app, persistencia local y cálculos.
import { seedState, seedCategories, seedRecurring, V1_MAP, SEED_VERSION } from './seed.js';
import { periodOf, todayISO, dueDateIn, daysBetween } from './dates.js';

const KEY = 'lukas.v1';
let state = null;
const listeners = new Set();

export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? migrate(JSON.parse(raw)) : seedState();
  } catch (e) {
    console.error(e);
    // Guarda los datos dañados aparte para poder recuperarlos, en vez de perderlos
    try { localStorage.setItem(`lukas.danado.${Date.now()}`, localStorage.getItem(KEY)); } catch {}
    state = seedState();
  }
  return state;
}

function migrate(s) {
  const base = seedState();
  s.settings = { ...base.settings, ...s.settings };
  for (const k of Object.keys(base)) if (s[k] === undefined) s[k] = base[k];
  // v1 → v2: categorías planas → grupos con detalle
  if ((s.version || 1) < 2) {
    for (const t of s.transactions) {
      const m = V1_MAP[t.category];
      if (m) { t.category = m[0]; t.item = m[1]; }
    }
    const oldRec = s.recurring || [];
    s.recurring = seedRecurring().map((r) => {
      const o = oldRec.find((x) => x.id === r.id);
      return o ? { ...r, amount: o.amount, account: o.account, day: o.day, active: o.active, note: o.note ?? r.note } : r;
    });
    s.categories = seedCategories();
    s.learned = {};
    s.version = SEED_VERSION;
  }
  return s;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error('No se pudo guardar', e);
  }
  listeners.forEach((fn) => fn(state));
}

export const S = () => state;
export const onChange = (fn) => listeners.add(fn);

export function replaceState(next) {
  state = migrate(next);
  save();
}

export function resetAll() {
  localStorage.removeItem(KEY);
  state = seedState();
  save();
}

export function exportJSON() {
  return JSON.stringify({ app: 'lukas', exportedAt: new Date().toISOString(), data: state }, null, 2);
}

// ---------- Búsquedas ----------
export const account = (id) => state.accounts.find((a) => a.id === id);
export const category = (id) => state.categories.find((c) => c.id === id);
export const pocket = (id) => state.pockets.find((p) => p.id === id);
export const recurringItem = (id) => state.recurring.find((r) => r.id === id);
export const item = (catId, itemId) => category(catId)?.items?.find((i) => i.id === itemId);
// Todos los detalles con su grupo: [{ cat, item }]
export const allItems = () => state.categories.flatMap((c) => (c.items || []).map((i) => ({ cat: c, item: i })));
// Nombre para mostrar de un movimiento: "Gasolina" o el grupo si no tiene detalle
export const labelOf = (t) => item(t.category, t.item)?.name || category(t.category)?.name || '';
export const emojiOf = (t) => item(t.category, t.item)?.emoji || category(t.category)?.emoji || '';
export const activeAccounts = () => state.accounts.filter((a) => !a.hidden).sort((a, b) => (a.order || 0) - (b.order || 0));

// ---------- Movimientos ----------
// Tipos: expense, income, transfer, alloc (mover plata a/desde un bolsillo virtual)
export function addTx(tx) {
  const t = { id: uid('tx'), date: todayISO(), createdAt: Date.now(), ...tx };
  state.transactions.push(t);
  learnFrom(t);
  save();
  return t;
}
export function updateTx(id, patch) {
  const t = state.transactions.find((x) => x.id === id);
  if (t) Object.assign(t, patch);
  if (t) learnFrom(t);
  save();
  return t;
}
export function deleteTx(id) {
  state.transactions = state.transactions.filter((x) => x.id !== id && x.parentId !== id);
  save();
}

const STOP = new Set(['para', 'pero', 'como', 'esta', 'este', 'esto', 'unos', 'unas', 'gaste', 'pague', 'compre', 'lucas', 'pesos', 'desde', 'hasta', 'otro', 'otra', 'cuenta', 'nequi', 'bancolombia']);
function learnFrom(t) {
  if (!['expense', 'income'].includes(t.type) || !t.category || !t.note || t.recurring) return;
  const words = t.note.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !STOP.has(w));
  for (const w of words) state.learned[w] = `${t.category}/${t.item || ''}`;
}

// ---------- Tasa ----------
export function usdRate() {
  // Última tasa real que te dio Deel
  const withRate = state.transactions.filter((t) => t.rate).sort((a, b) => (a.date < b.date ? 1 : -1));
  return withRate[0]?.rate || state.settings.fallbackRate;
}
export const toCOP = (amount, currency) => (currency === 'USD' ? amount * usdRate() : amount);

// ---------- Saldos ----------
export function balance(accId) {
  const a = account(accId);
  let b = Number(a?.initial) || 0;
  for (const t of state.transactions) {
    if (t.historic) continue;
    if (t.type === 'income' && t.account === accId) b += t.amount;
    if (t.type === 'expense' && t.account === accId) b -= t.amount;
    if (t.type === 'transfer') {
      if (t.account === accId) b -= t.amount;
      if (t.toAccount === accId) b += t.toAmount ?? t.amount;
    }
  }
  return b;
}

export function netWorthCOP() {
  return activeAccounts().reduce((s, a) => s + toCOP(balance(a.id), a.currency), 0);
}

export function pocketBalance(pid) {
  let b = 0;
  for (const t of state.transactions) {
    if (t.type === 'alloc') {
      if (t.pocket === pid) b += t.amount;
      if (t.fromPocket === pid) b -= t.amount;
    }
    if (t.type === 'expense' && t.pocket === pid) b -= t.amount;
  }
  return b;
}

// Plata de la cuenta que no está en ningún bolsillo
export function freeInAccount(accId) {
  const inPockets = state.pockets.filter((p) => p.account === accId && !p.archived).reduce((s, p) => s + pocketBalance(p.id), 0);
  return balance(accId) - inPockets;
}

// ---------- Periodo ----------
export const txInPeriod = (p) => state.transactions.filter((t) => t.date >= p.start && t.date <= p.end);

export function blockOf(t) {
  if (t.type !== 'expense') return null;
  return category(t.category)?.block || 'gastos';
}

export function spentByCategory(p) {
  const out = {};
  for (const t of txInPeriod(p)) {
    if (t.type !== 'expense' || t.adjust) continue;
    out[t.category] = (out[t.category] || 0) + toCOP(t.amount, account(t.account)?.currency);
  }
  return out;
}

export function commitmentsTotal() {
  return state.recurring.filter((r) => r.active).reduce((s, r) => s + r.amount, 0);
}
// Compromisos cuyo grupo pertenece a un bloque (p. ej. los pateos viven en Transporte → Gastos)
export function recurringInBlock(block) {
  return state.recurring.filter((r) => r.active && (category(r.category)?.block || 'comp') === block).reduce((s, r) => s + r.amount, 0);
}
export function commitmentsFor(accId) {
  return state.recurring.filter((r) => r.active && r.account === accId).reduce((s, r) => s + r.amount, 0);
}
export function capsTotal() {
  return allItems().filter(({ cat, item }) => cat.block === 'gastos' && item.cap).reduce((s, { item }) => s + item.cap, 0);
}
export function spentByItem(p) {
  const out = {};
  for (const t of txInPeriod(p)) {
    if (t.type !== 'expense' || t.adjust) continue;
    const k = `${t.category}/${t.item || ''}`;
    out[k] = (out[k] || 0) + toCOP(t.amount, account(t.account)?.currency);
  }
  return out;
}
// Resumen por grupo con su detalle (para el presupuesto)
export function groupSummary(p) {
  const byItem = spentByItem(p);
  const cl = checklist(p);
  return state.categories.filter((c) => c.block !== 'ingreso').map((c) => {
    const recs = cl.filter((r) => r.category === c.id);
    const items = (c.items || []).map((i) => ({
      ...i,
      spent: byItem[`${c.id}/${i.id}`] || 0,
      recs: recs.filter((r) => r.item === i.id),
    }));
    const loose = byItem[`${c.id}/`] || 0;
    const spent = items.reduce((s, i) => s + i.spent, 0) + loose;
    const budget = recs.reduce((s, r) => s + r.amount, 0) + items.reduce((s, i) => s + (i.cap || 0), 0);
    return { ...c, items, recs, spent, budget, loose };
  });
}

// Estado del checklist de compromisos en un periodo
export function checklist(p) {
  const txs = txInPeriod(p).filter((t) => t.recurring);
  const t0 = todayISO();
  return state.recurring
    .filter((r) => r.active)
    .map((r) => {
      const paidTx = txs.filter((t) => t.recurring === r.id);
      const paid = paidTx.reduce((s, t) => s + t.amount, 0);
      const done = paidTx.some((t) => t.closes) || paid >= r.amount;
      const due = dueDateIn(p, r.day);
      let status = done ? 'done' : 'pending';
      if (!done && due) {
        const d = daysBetween(t0, due);
        if (d < 0) status = 'late';
        else if (d === 0) status = 'today';
        else if (d <= 3) status = 'soon';
      }
      return { ...r, paid, done, due, status, txs: paidTx };
    })
    .sort((a, b) => {
      const rank = { late: 0, today: 1, soon: 2, pending: 3, done: 4 };
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
      return (a.due || '9999') < (b.due || '9999') ? -1 : 1;
    });
}

// Resumen por bloques del periodo
export function blockSummary(p) {
  const spent = { comp: 0, gastos: 0, disp: 0, ahorro: 0 };
  for (const t of txInPeriod(p)) {
    if (t.type === 'expense' && !t.adjust) {
      const b = blockOf(t);
      if (spent[b] !== undefined) spent[b] += toCOP(t.amount, account(t.account)?.currency);
    }
    // Ahorro y bolsillos: plata apartada (desde la plata libre) y dólares a ARQ
    if (t.type === 'alloc' && t.pocket && !t.fromPocket && !t.initial) spent.ahorro += t.amount;
    if (t.type === 'income' && t.account === 'arq') spent.ahorro += t.amount * (t.rate || usdRate());
  }
  const plan = state.plans[p.key];
  const ahorroPlan = plan ? Object.values(plan.pockets || {}).reduce((s, v) => s + (v || 0), 0) + (plan.arqUSD || 0) * usdRate() : 0;
  return {
    comp: { spent: spent.comp, budget: recurringInBlock('comp') },
    gastos: { spent: spent.gastos, budget: capsTotal() + recurringInBlock('gastos') },
    disp: { spent: spent.disp, budget: state.settings.disponible },
    ahorro: { spent: spent.ahorro, budget: ahorroPlan || spent.ahorro || 1 },
  };
}

export function incomeInPeriod(p) {
  return txInPeriod(p)
    .filter((t) => t.type === 'income' && category(t.category)?.id === 'sueldo')
    .reduce((s, t) => s + (account(t.account)?.currency === 'USD' ? t.amount * (t.rate || usdRate()) : t.amount), 0);
}

export function paydayDone(p) {
  return txInPeriod(p).some((t) => t.type === 'income' && t.category === 'sueldo');
}

export const currentPeriod = () => periodOf(todayISO());
