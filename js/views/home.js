// Inicio: saludo de Lukas, patrimonio, Disponible, anillos de bloques, checklist y últimos movimientos.
import * as st from '../store.js';
import { nav } from '../nav.js';
import { fmt, fmtShort } from '../money.js';
import { periodLabel, fmtDate, relDay } from '../dates.js';
import { esc, icon, rings, bar, $, $$, toast, haptic } from '../ui.js';
import { greeting, adviceList, disponibleInfo, dismiss, phrase } from '../lukas.js';
import { BLOCKS } from '../seed.js';
import { txRow, openTxForm } from './txform.js';
import { payCommitment } from './checklist.js';

export function render() {
  const S = st.S();
  const p = st.currentPeriod();
  const advice = adviceList();
  const top = advice[0];
  const more = advice.length - 1;
  const d = disponibleInfo(p);
  const bs = st.blockSummary(p);
  const cl = st.checklist(p);
  const doneCount = cl.filter((c) => c.done).length;
  const recent = S.transactions.filter((t) => t.type !== 'alloc').sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1)).slice(0, 5);

  const order = ['comp', 'gastos', 'disp', 'ahorro'];
  const ringItems = order.map((k) => ({ color: BLOCKS[k].color, value: bs[k].budget ? bs[k].spent / bs[k].budget : 0 }));

  return `
  <section class="view">
    <header class="view-head">
      <div>
        <p class="eyebrow">${periodLabel(p)} · ${fmtDate(p.start)} – ${fmtDate(p.end)}</p>
        <h1>${esc(greeting().replace(/[.!]$/, ''))}.</h1>
      </div>
      <button class="icon-btn white" data-tab="settings" aria-label="Ajustes">${icon('gear', 22)}</button>
    </header>

    ${top ? `
    <article class="card lukas-card">
      <div class="avatar">L</div>
      <div class="grow">
        <div class="row between"><strong>${esc(top.title)}</strong>${top.level !== 'action' ? `<button class="muted" data-dismiss="${top.id}" aria-label="Descartar">${icon('close', 18)}</button>` : ''}</div>
        <p class="small" style="margin:4px 0 0">${esc(top.text)}</p>
        <div class="row mt12" style="gap:16px">
          ${top.action ? `<button class="btn btn-primary btn-sm" data-action="${top.action.go}">${esc(top.action.label)}</button>` : ''}
          ${more > 0 ? `<button class="link" data-more>${more} consejo${more > 1 ? 's' : ''} más ${icon('chevron', 16)}</button>` : ''}
        </div>
      </div>
    </article>` : ''}

    <article class="card mt12">
      <p class="eyebrow">Patrimonio</p>
      <div class="hero-money">${fmt(st.netWorthCOP())}</div>
      <p class="small muted" style="margin:4px 0 0">ARQ convertido a ${fmt(st.usdRate())} por dólar.</p>
      <div class="mt16 stack gap8">
        <div class="row between small"><span><span class="dot" style="background:var(--ring-teal)"></span> Disponible</span><span class="num"><strong>${fmt(Math.max(0, d.remaining))}</strong> <span class="muted">de ${fmtShort(d.budget)}</span></span></div>
        ${bar(d.used, 'var(--ring-teal)')}
        <p class="small muted" style="margin:0">${d.remaining >= 0 ? `Puedes gastar <strong class="num" style="color:var(--ink)">${fmt(d.perDay)}</strong> al día por ${d.daysLeft} días.` : `Te pasaste ${fmt(-d.remaining)}.`}</p>
      </div>
    </article>

    <div class="section-title"><h2>Tu mes.</h2><button class="link" data-tab="plan">Ver plan ${icon('chevron', 16)}</button></div>
    <article class="card">
      <div class="rings-wrap">
        ${rings(ringItems, 116)}
        <div class="legend">
          ${order.map((k) => `<div class="legend-row"><span class="dot" style="background:${BLOCKS[k].color}"></span><div class="grow"><div>${BLOCKS[k].short}</div><div class="val">${fmtShort(bs[k].spent)} <span>de ${fmtShort(bs[k].budget > 1 ? bs[k].budget : 0)}</span></div></div></div>`).join('')}
        </div>
      </div>
    </article>

    <div class="section-title" id="checklist"><h2>Compromisos.</h2><span class="small muted">${doneCount} de ${cl.length} listos</span></div>
    <article class="card tight">
      <ul class="list">
        ${groupedChecklist(cl) || '<li class="empty">No hay compromisos activos.</li>'}
      </ul>
    </article>
    <p class="tiny muted" style="margin:8px 12px 0">Toca el círculo para marcarlo listo. Mantén presionado si pagaste un monto distinto.</p>

    <div class="section-title"><h2>Cuentas.</h2></div>
    <div class="acc-grid">
      ${st.activeAccounts().map((a) => `
        <button class="acc" data-acc="${a.id}">
          <div class="name"><span class="dot" style="background:${a.color}"></span>${esc(a.name)}</div>
          <div class="val">${a.currency === 'USD' ? fmt(st.balance(a.id), 'USD') : fmtShort(st.balance(a.id))}</div>
          ${st.S().pockets.some((x) => x.account === a.id && !x.archived) ? `<div class="tiny muted">Libre: ${fmtShort(st.freeInAccount(a.id), a.currency)}</div>` : `<div class="tiny muted">${a.currency}</div>`}
        </button>`).join('')}
    </div>

    <div class="section-title"><h2>Recientes.</h2><button class="link" data-tab="movs">Ver todo ${icon('chevron', 16)}</button></div>
    <article class="card tight">
      <ul class="list">${recent.map(txRow).join('') || `<li class="empty"><div class="big">🗒️</div>Cuéntale a Lukas tu primer gasto.</li>`}</ul>
    </article>
  </section>`;
}

// Checklist agrupado por categoría (los grupos con algo urgente van primero)
function groupedChecklist(cl) {
  const order = [];
  const by = {};
  for (const c of cl) {
    if (!by[c.category]) { by[c.category] = []; order.push(c.category); }
    by[c.category].push(c);
  }
  return order.map((cid) => {
    const g = st.category(cid);
    const list = by[cid];
    const done = list.filter((c) => c.done).length;
    return `<li class="li no-icon" style="min-height:0;padding:12px 22px 2px"><span class="tiny muted strong">${g?.emoji || ''} ${esc((g?.name || 'Otros').toUpperCase())} · ${done} de ${list.length}</span></li>${list.map(checkRow).join('')}`;
  }).join('');
}

function checkRow(c) {
  const partial = !c.done && c.paid > 0;
  const tag = c.done ? '<span class="tag done">Listo</span>'
    : c.status === 'late' ? `<span class="tag warn">Vencido</span>`
    : c.status === 'today' ? `<span class="tag warn">Hoy</span>`
    : c.status === 'soon' ? `<span class="tag info">${relDay(c.due)}</span>`
    : c.due ? `<span class="tag">${fmtDate(c.due)}</span>` : '';
  return `
    <li class="li ${c.done ? 'done' : ''}" data-rec="${c.id}">
      <button class="check ${c.done ? 'on' : partial ? 'part' : ''}" data-check="${c.id}" aria-label="Marcar ${esc(c.name)}">${icon('check', 16)}</button>
      <div class="grow">
        <div class="ttl ellipsis">${esc(c.name)}</div>
        <div class="tiny muted">${esc(st.account(c.account)?.name || '')}${partial ? ` · van ${fmtShort(c.paid)}` : ''}${c.note ? ` · ${esc(c.note)}` : ''}</div>
      </div>
      <div class="stack" style="align-items:flex-end;gap:2px">
        <span class="amount">${fmtShort(c.amount)}</span>${tag}
      </div>
    </li>`;
}

export function bind(root) {
  root.addEventListener('click', (e) => {
    const dis = e.target.closest('[data-dismiss]');
    if (dis) { dismiss(dis.dataset.dismiss); nav.refresh(); return; }
    if (e.target.closest('[data-more]')) { nav.go('chat', { advice: true }); return; }
    const acc = e.target.closest('[data-acc]');
    if (acc) { nav.go('movs', { account: acc.dataset.acc }); return; }
    const row = e.target.closest('[data-tx]');
    if (row) { openTxForm(st.S().transactions.find((t) => t.id === row.dataset.tx)); return; }
  });

  // Checklist: toque = pagar monto por defecto; presión larga = editar
  $$('[data-check]', root).forEach((btn) => {
    let timer = null, long = false;
    const id = btn.dataset.check;
    const start = () => { long = false; timer = setTimeout(() => { long = true; haptic(); payCommitment(id, { edit: true }); }, 500); };
    const cancel = () => clearTimeout(timer);
    btn.addEventListener('touchstart', start, { passive: true });
    btn.addEventListener('touchend', cancel);
    btn.addEventListener('touchmove', cancel, { passive: true });
    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', cancel);
    btn.addEventListener('mouseleave', cancel);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (long) return;
      payCommitment(id);
    });
  });
  $$('[data-rec]', root).forEach((li) => li.addEventListener('click', (e) => {
    if (e.target.closest('[data-check]')) return;
    payCommitment(li.dataset.rec, { edit: true });
  }));
}
