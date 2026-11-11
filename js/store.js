// Estado de la app, persistencia local y cálculos.
import { seedState } from './seed.js';
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
    state = seedState();
  }
  return state;
}

function migrate(s) {
  const base = seedState();
  s.settings = { ...base.settings, ...s.settings };
  for (const k of Object.keys(base)) if (s[k] === undefined) s[k] = base[k];
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

function learnFrom(t) {
  if (t.type !== 'expense' || !t.category || !t.note) return;
  const words = t.note.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-zñ0-9]+/).filter((w) => w.length > 3);
  for (const w of words) state.learned[w] = t.category;
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
    if (t.type !== 'expense') continue;
    out[t.category] = (out[t.category] || 0) + toCOP(t.amount, t.currencyOverride || account(t.account)?.currency);
  }
  return out;
}

export function commitmentsTotal() {
  return state.recurring.filter((r) => r.active).reduce((s, r) => s + r.amount, 0);
}
export function commitmentsFor(accId) {
  return state.recurring.filter((r) => r.active && r.account === accId).reduce((s, r) => s + r.amount, 0);
}
export function capsTotal() {
  return state.categories.filter((c) => c.block === 'gastos' && c.cap).reduce((s, c) => s + c.cap, 0);
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
    if (t.type === 'expense') {
      const b = blockOf(t);
      if (spent[b] !== undefined) spent[b] += toCOP(t.amount, account(t.account)?.currency);
    }
    // Ahorro y bolsillos: plata apartada (desde la plata libre) y dólares a ARQ
    if (t.type === 'alloc' && t.pocket && !t.fromPocket) spent.ahorro += t.amount;
    if (t.type === 'income' && t.account === 'arq') spent.ahorro += t.amount * (t.rate || usdRate());
  }
  const plan = state.plans[p.key];
  const ahorroPlan = plan ? Object.values(plan.pockets || {}).reduce((s, v) => s + (v || 0), 0) + (plan.arqUSD || 0) * usdRate() : 0;
  return {
    comp: { spent: spent.comp, budget: commitmentsTotal() },
    gastos: { spent: spent.gastos, budget: capsTotal() },
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
