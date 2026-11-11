// Movimientos: lista por día con filtros por cuenta, tipo, periodo y búsqueda.
import * as st from '../store.js';
import { nav } from '../nav.js';
import { fmt, fmtShort } from '../money.js';
import { periodLabel, prevPeriod, nextPeriod, periodFromKey, fmtDate } from '../dates.js';
import { esc, icon, $, $$ } from '../ui.js';
import { txRow, openTxForm } from './txform.js';

let filter = { account: null, type: 'all', q: '', period: null };

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function render(params = {}) {
  if (params.account !== undefined) filter.account = params.account;
  const p = filter.period ? periodFromKey(filter.period) : st.currentPeriod();
  const cur = st.currentPeriod();
  let txs = st.txInPeriod(p).filter((t) => t.type !== 'alloc' || filter.type === 'alloc');
  if (filter.account) txs = txs.filter((t) => t.account === filter.account || t.toAccount === filter.account || (t.type === 'alloc' && st.pocket(t.pocket || t.fromPocket)?.account === filter.account));
  if (filter.type !== 'all') txs = txs.filter((t) => t.type === filter.type);
  if (filter.q) {
    const q = norm(filter.q);
    txs = txs.filter((t) => norm(`${t.note} ${st.category(t.category)?.name} ${st.account(t.account)?.name}`).includes(q));
  }
  txs.sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));

  const groups = {};
  for (const t of txs) (groups[t.date] ||= []).push(t);
  const spent = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + st.toCOP(t.amount, st.account(t.account)?.currency), 0);
  const income = txs.filter((t) => t.type === 'income').reduce((s, t) => s + (st.account(t.account)?.currency === 'USD' ? t.amount * (t.rate || st.usdRate()) : t.amount), 0);

  const acc = filter.account ? st.account(filter.account) : null;
  return `
  <section class="view">
    <header class="view-head">
      <div><p class="eyebrow">${fmtDate(p.start)} – ${fmtDate(p.end)}</p><h1>Movimientos.</h1></div>
    </header>

    <div class="row between" style="margin:0 4px 12px">
      <button class="icon-btn white" data-per="-1" aria-label="Mes anterior">${icon('back', 20)}</button>
      <strong>${periodLabel(p)}</strong>
      <button class="icon-btn white" data-per="1" aria-label="Mes siguiente" ${p.key >= cur.key ? 'disabled style="opacity:.3"' : ''}>${icon('chevron', 20)}</button>
    </div>

    ${acc ? `
    <article class="card mb12" style="margin-bottom:12px">
      <div class="row between"><div><p class="eyebrow"><span class="dot" style="background:${acc.color}"></span> ${esc(acc.name)}</p><div class="h2 num">${fmt(st.balance(acc.id), acc.currency)}</div></div>
      <button class="btn btn-secondary btn-sm" data-clear-acc>Ver todas</button></div>
      <p class="small muted" style="margin:6px 0 0">${esc(acc.role || '')}</p>
      ${st.S().pockets.filter((x) => x.account === acc.id && !x.archived).map((x) => `<div class="row between small mt8"><span>${x.emoji} ${esc(x.name)}</span><span class="num">${fmt(st.pocketBalance(x.id))}</span></div>`).join('')}
      ${st.S().pockets.some((x) => x.account === acc.id && !x.archived) ? `<div class="row between small mt8"><strong>Libre</strong><strong class="num">${fmt(st.freeInAccount(acc.id), acc.currency)}</strong></div>` : ''}
    </article>` : ''}

    <div class="field row" style="gap:8px;padding:8px 16px">${icon('search', 18, 'muted')}<input id="q" placeholder="Buscar" value="${esc(filter.q)}" style="padding:4px 0"/></div>

    <div class="chips mt12">
      ${[['all', 'Todo'], ['expense', 'Gastos'], ['income', 'Ingresos'], ['transfer', 'Transferencias'], ['alloc', 'Bolsillos']].map(([k, l]) => `<button class="chip ${filter.type === k ? 'on' : ''}" data-ftype="${k}">${l}</button>`).join('')}
    </div>
    <div class="chips mt8">
      ${st.activeAccounts().map((a) => `<button class="chip ${filter.account === a.id ? 'on' : 'soft'}" data-facc="${a.id}"><span class="dot" style="background:${a.color}"></span>${esc(a.name)}</button>`).join('')}
    </div>

    <div class="row mt16" style="gap:10px">
      <div class="card grow" style="padding:16px"><p class="eyebrow">Gastado</p><div class="h3 num">${fmtShort(spent)}</div></div>
      <div class="card grow" style="padding:16px;margin-top:0"><p class="eyebrow">Entró</p><div class="h3 num" style="color:var(--ring-green)">${fmtShort(income)}</div></div>
    </div>

    ${Object.keys(groups).length ? Object.entries(groups).map(([d, list]) => `
      <p class="day-head">${fmtDate(d, { weekday: true })}</p>
      <article class="card tight"><ul class="list">${list.map(txRow).join('')}</ul></article>`).join('') : `<div class="empty"><div class="big">🧾</div>Nada por aquí todavía.</div>`}
  </section>`;
}

export function bind(root) {
  root.addEventListener('click', (e) => {
    const per = e.target.closest('[data-per]');
    if (per) {
      const p = filter.period ? periodFromKey(filter.period) : st.currentPeriod();
      const np = Number(per.dataset.per) < 0 ? prevPeriod(p) : nextPeriod(p);
      if (np.key > st.currentPeriod().key) return;
      filter.period = np.key;
      nav.refresh();
      return;
    }
    const ft = e.target.closest('[data-ftype]');
    if (ft) { filter.type = ft.dataset.ftype; nav.refresh(); return; }
    const fa = e.target.closest('[data-facc]');
    if (fa) { filter.account = filter.account === fa.dataset.facc ? null : fa.dataset.facc; nav.params = {}; nav.refresh(); return; }
    if (e.target.closest('[data-clear-acc]')) { filter.account = null; nav.params = {}; nav.refresh(); return; }
    const row = e.target.closest('[data-tx]');
    if (row) openTxForm(st.S().transactions.find((t) => t.id === row.dataset.tx));
  });
  const q = $('#q', root);
  let timer;
  q.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      filter.q = q.value;
      nav.refresh();
      const nq = document.getElementById('q');
      nq.focus();
      nq.setSelectionRange(nq.value.length, nq.value.length);
    }, 250);
  });
}
