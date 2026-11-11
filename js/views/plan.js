// Plan: presupuesto por bloques, bolsillos/metas, compromisos y deudas.
import * as st from '../store.js';
import { nav } from '../nav.js';
import { fmt, fmtShort, formatInput, inputToNumber } from '../money.js';
import { periodLabel, fmtDate, todayISO } from '../dates.js';
import { esc, icon, bar, sheet, $, $$, toast, bindAmountInputs, confirmSheet } from '../ui.js';
import { goalInfo, disponibleInfo, phrase } from '../lukas.js';
import { BLOCKS } from '../seed.js';
import { downloadICS } from '../ics.js';

let tab = 'budget';

export function render(params = {}) {
  if (params.tab) { tab = params.tab; nav.params = {}; }
  const tabs = [['budget', 'Presupuesto'], ['pockets', 'Bolsillos'], ['rec', 'Compromisos'], ['debts', 'Deudas']];
  return `
  <section class="view">
    <header class="view-head"><div><p class="eyebrow">${periodLabel(st.currentPeriod())}</p><h1>Plan.</h1></div></header>
    <div class="segmented" style="margin-bottom:16px">${tabs.map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-ptab="${k}">${l}</button>`).join('')}</div>
    ${tab === 'budget' ? budget() : tab === 'pockets' ? pockets() : tab === 'rec' ? recurring() : debts()}
  </section>`;
}

// ---------- Presupuesto ----------
function budget() {
  const S = st.S();
  const p = st.currentPeriod();
  const bs = st.blockSummary(p);
  const spent = st.spentByCategory(p);
  const income = st.incomeInPeriod(p);
  const d = disponibleInfo(p);
  const block = (k, rows) => `
    <div class="section-title"><h2><span class="dot" style="background:${BLOCKS[k].color};width:12px;height:12px"></span> ${BLOCKS[k].name}.</h2><span class="small muted num">${fmtShort(bs[k].spent)} / ${fmtShort(bs[k].budget)}</span></div>
    <article class="card">${rows}</article>`;
  const catRow = (c) => {
    const s = spent[c.id] || 0;
    return `<button class="stack gap4" style="width:100%;text-align:left;padding:6px 0" data-cap="${c.id}">
      <div class="row between small"><span>${c.emoji} ${esc(c.name)}${c.account ? ` <span class="muted tiny">· ${esc(st.account(c.account)?.name)}</span>` : ''}</span><span class="num">${fmtShort(s)}${c.cap ? ` <span class="muted">/ ${fmtShort(c.cap)}</span>` : ''}</span></div>
      ${c.cap ? bar(s / c.cap, BLOCKS.gastos.color) : ''}
    </button>`;
  };
  const gastosCats = S.categories.filter((c) => c.block === 'gastos' && (c.cap || spent[c.id]));
  const dispCats = S.categories.filter((c) => c.block === 'disp' && spent[c.id]);
  const compRows = st.checklist(p).map((c) => `<div class="row between small" style="padding:4px 0"><span>${c.done ? '✅' : '⬜️'} ${esc(c.name)}</span><span class="num">${fmtShort(c.paid)} <span class="muted">/ ${fmtShort(c.amount)}</span></span></div>`).join('');
  const assigned = bs.comp.budget + bs.gastos.budget + bs.disp.budget + (bs.ahorro.budget > 1 ? bs.ahorro.budget : 0);

  return `
    <article class="card card-dark">
      <p class="eyebrow" style="color:rgba(255,255,255,.64)">Entró este mes</p>
      <div class="hero-money">${fmt(income)}</div>
      <div class="mt12 stack gap4 small">
        <div class="row between"><span class="muted">Compromisos</span><span class="num">${fmt(bs.comp.budget)}</span></div>
        <div class="row between"><span class="muted">Gastos con tope</span><span class="num">${fmt(bs.gastos.budget)}</span></div>
        <div class="row between"><span class="muted">Disponible</span><span class="num">${fmt(bs.disp.budget)}</span></div>
        <div class="row between"><span class="muted">Ahorro y bolsillos</span><span class="num">${fmt(bs.ahorro.budget > 1 ? bs.ahorro.budget : 0)}</span></div>
        <div class="row between" style="border-top:1px solid rgba(255,255,255,.2);padding-top:6px;margin-top:4px"><strong>${income - assigned >= 0 ? 'Sin asignar' : 'Te pasaste'}</strong><strong class="num">${fmt(Math.abs(income - assigned))}</strong></div>
      </div>
    </article>

    ${block('comp', compRows || '<p class="muted small">Sin compromisos.</p>')}
    ${block('gastos', gastosCats.map(catRow).join('') + `<p class="tiny muted" style="margin:8px 0 0">Toca una categoría para cambiar su tope.</p>`)}
    ${block('disp', `
      <div class="row between"><span>Presupuesto del mes</span><button class="link" data-edit-disp>${fmt(S.settings.disponible)} ${icon('edit', 14)}</button></div>
      <div class="mt8">${bar(d.used, BLOCKS.disp.color)}</div>
      <p class="small muted" style="margin:8px 0">${d.remaining >= 0 ? `Quedan ${fmt(d.remaining)} · ${fmt(d.perDay)}/día` : `Te pasaste ${fmt(-d.remaining)}`}</p>
      ${dispCats.map(catRow).join('')}`)}
    ${block('ahorro', S.pockets.filter((x) => !x.archived).map((x) => `<div class="row between small" style="padding:4px 0"><span>${x.emoji} ${esc(x.name)}</span><span class="num">${fmt(st.pocketBalance(x.id))}</span></div>`).join('') + `<div class="row between small" style="padding:4px 0"><span>💵 ARQ</span><span class="num">${fmt(st.balance('arq'), 'USD')}</span></div>`)}
  `;
}

// ---------- Bolsillos y metas ----------
function pockets() {
  const S = st.S();
  const byAcc = {};
  S.pockets.filter((x) => !x.archived).forEach((x) => (byAcc[x.account] ||= []).push(x));
  return `
    <p class="small muted" style="margin:0 4px 12px">Bolsillos virtuales: la plata sigue en la cuenta real, pero Lukas sabe de quién es cada peso.</p>
    ${Object.entries(byAcc).map(([accId, list]) => {
      const a = st.account(accId);
      return `
      <div class="section-title"><h2><span class="dot" style="background:${a?.color}"></span> ${esc(a?.name)}.</h2><span class="small muted num">${fmt(st.balance(accId), a?.currency)}</span></div>
      ${list.map((x) => {
        const g = goalInfo(x);
        return `<article class="card" data-pocket="${x.id}" style="cursor:pointer">
          <div class="row between"><div class="row" style="gap:10px"><div class="emoji">${x.emoji}</div><div><strong>${esc(x.name)}</strong>${x.main ? ' <span class="tag info">Meta principal</span>' : ''}<div class="tiny muted">${esc(x.note || '')}</div></div></div></div>
          <div class="row between mt12"><span class="h2 num">${fmt(g.saved)}</span>${g.target ? `<span class="small muted num">de ${fmtShort(g.target)}</span>` : ''}</div>
          ${g.target ? `<div class="mt8">${bar(g.progress, 'var(--ring-green)')}</div>` : ''}
          ${x.deadline ? `<p class="tiny muted" style="margin:8px 0 0">${fmtDate(x.deadline, { year: true })}${g.days != null && g.days >= 0 ? ` · faltan ${g.days} días` : ''}${g.target && g.missing && g.pays ? ` · ${fmtShort(g.perPay)} por pago` : ''}</p>` : ''}
          <div class="row mt12" style="gap:8px">
            <button class="btn btn-primary btn-sm" data-alloc="${x.id}">Apartar</button>
            <button class="btn btn-secondary btn-sm" data-unalloc="${x.id}">Sacar</button>
          </div>
        </article>`;
      }).join('')}
      <article class="card" style="padding:16px 22px"><div class="row between small"><span class="muted">Libre en ${esc(a?.name)}</span><strong class="num">${fmt(st.freeInAccount(accId), a?.currency)}</strong></div></article>`;
    }).join('')}
    <button class="btn btn-secondary btn-block mt16" data-new-pocket>${icon('plus', 18)} Nuevo bolsillo o meta</button>
  `;
}

// ---------- Compromisos ----------
function recurring() {
  const S = st.S();
  const act = S.recurring.filter((r) => r.active);
  const paused = S.recurring.filter((r) => !r.active);
  const row = (r) => `<li><button class="li no-icon" data-rec="${r.id}"><div class="grow"><div class="ellipsis">${esc(r.name)}</div><div class="tiny muted">${esc(st.account(r.account)?.name)} · ${r.day ? `día ${r.day}` : 'día variable'}${r.note ? ` · ${esc(r.note)}` : ''}</div></div><span class="amount">${fmtShort(r.amount)}</span>${icon('chevron', 16, 'muted')}</button></li>`;
  const byAcc = st.activeAccounts().map((a) => ({ a, total: st.commitmentsFor(a.id) })).filter((x) => x.total);
  return `
    <article class="card">
      <p class="eyebrow">Total al mes</p>
      <div class="h2 num">${fmt(st.commitmentsTotal())}</div>
      <div class="mt8 stack gap4">${byAcc.map(({ a, total }) => `<div class="row between small"><span><span class="dot" style="background:${a.color}"></span> ${esc(a.name)}</span><span class="num">${fmt(total)}</span></div>`).join('')}</div>
    </article>
    <div class="section-title"><h2>Activos.</h2><button class="link" data-ics>${icon('calendar', 16)} Al Calendario</button></div>
    <article class="card tight"><ul class="list">${act.map(row).join('')}</ul></article>
    ${paused.length ? `<div class="section-title"><h2>En pausa.</h2></div><article class="card tight"><ul class="list">${paused.map(row).join('')}</ul></article>` : ''}
    <button class="btn btn-secondary btn-block mt16" data-new-rec>${icon('plus', 18)} Nuevo compromiso</button>
    <p class="tiny muted" style="margin:12px 8px">«Al Calendario» crea los vencimientos con día fijo en el Calendario de tu iPhone, con alarma a las 9 a. m., para que te avise aunque no abras la app.</p>
  `;
}

// ---------- Deudas ----------
function debts() {
  const S = st.S();
  const list = S.debts.filter((d) => !d.archived);
  const paidOf = (d) => S.transactions.filter((t) => t.debt === d.id).reduce((s, t) => s + t.amount, 0);
  return `
    ${list.length ? list.map((d) => {
      const paid = paidOf(d);
      const left = d.amount - paid;
      return `<article class="card" data-debt="${d.id}">
        <div class="row between"><div><strong>${esc(d.name)}</strong><div class="tiny muted">${d.dir === 'owe' ? 'Le debes' : 'Te debe'}${d.note ? ` · ${esc(d.note)}` : ''}</div></div><span class="tag ${left <= 0 ? 'done' : d.dir === 'owe' ? 'warn' : 'info'}">${left <= 0 ? 'Saldada' : d.dir === 'owe' ? 'Debes' : 'Te deben'}</span></div>
        <div class="row between mt12"><span class="h2 num">${fmt(Math.max(0, left))}</span><span class="small muted num">de ${fmtShort(d.amount)}</span></div>
        <div class="mt8">${bar(d.amount ? paid / d.amount : 0, 'var(--ring-green)')}</div>
        <div class="row mt12" style="gap:8px">
          ${left > 0 ? `<button class="btn btn-primary btn-sm" data-debt-pay="${d.id}">${d.dir === 'owe' ? 'Abonar' : 'Me pagó'}</button>` : ''}
          <button class="btn btn-secondary btn-sm" data-debt-edit="${d.id}">Editar</button>
        </div>
      </article>`;
    }).join('') : `<article class="card empty"><div class="big">🕊️</div><strong style="color:var(--ink)">Cero deudas. ${phrase('good')}</strong><p class="small">Saldaste el Banco de Bogotá en octubre. Si alguien te debe o tú le debes a alguien, anótalo aquí.</p></article>`}
    <button class="btn btn-secondary btn-block mt16" data-new-debt>${icon('plus', 18)} Nueva deuda o préstamo</button>
  `;
}

// ---------- Hojas de edición ----------
function editCap(id) {
  const c = st.category(id);
  const s = sheet(`
    <h3 class="sheet-title">${c.emoji} ${esc(c.name)}</h3>
    <p class="small muted" style="margin:0 4px">Tope máximo por mes. Pon 0 para no tener tope.</p>
    <div class="amount-input"><input inputmode="numeric" data-amount="COP" id="v" value="${formatInput(String(c.cap || 0))}"/><div class="cur">COP</div></div>
    <div class="field"><label>Cuenta habitual</label><select id="acc"><option value="">Cualquiera</option>${st.activeAccounts().filter((a) => a.currency === 'COP').map((a) => `<option value="${a.id}" ${a.id === c.account ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div>
    <button class="btn btn-primary btn-block mt16" id="ok">Guardar</button>`);
  bindAmountInputs(s.el);
  $('#ok', s.el).addEventListener('click', () => { c.cap = inputToNumber($('#v', s.el).value); c.account = $('#acc', s.el).value || null; st.save(); s.close(); nav.refresh(); });
}

function editDisp() {
  const S = st.S();
  const inc = st.incomeInPeriod(st.currentPeriod());
  const s = sheet(`
    <h3 class="sheet-title">Disponible.</h3>
    <p class="small muted" style="margin:0 4px">Tu plata sin culpa. Lo has manejado entre 10 y 12 % del ingreso${inc ? `: entre ${fmtShort(inc * 0.1)} y ${fmtShort(inc * 0.12)} este mes` : ''}.</p>
    <div class="amount-input"><input inputmode="numeric" data-amount="COP" id="v" value="${formatInput(String(S.settings.disponible))}"/><div class="cur">COP al mes</div></div>
    <button class="btn btn-primary btn-block" id="ok">Guardar</button>`);
  bindAmountInputs(s.el);
  $('#ok', s.el).addEventListener('click', () => { S.settings.disponible = inputToNumber($('#v', s.el).value); st.save(); s.close(); nav.refresh(); });
}

export function allocSheet(pid, dir = 1) {
  const x = st.pocket(pid);
  const free = st.freeInAccount(x.account);
  const inPocket = st.pocketBalance(pid);
  const others = st.S().pockets.filter((o) => o.id !== pid && o.account === x.account && !o.archived);
  const s = sheet(`
    <h3 class="sheet-title">${dir > 0 ? 'Apartar para' : 'Sacar de'} ${x.emoji} ${esc(x.name)}</h3>
    <p class="small muted" style="margin:0 4px">${dir > 0 ? `Libre en ${esc(st.account(x.account)?.name)}: ${fmt(free)}` : `En el bolsillo: ${fmt(inPocket)}`}. Es virtual: no mueves plata real.</p>
    <div class="amount-input"><input inputmode="numeric" data-amount="COP" id="v" placeholder="0"/><div class="cur">COP</div></div>
    ${others.length ? `<div class="field"><label>${dir > 0 ? 'Viene de' : 'Va para'}</label><select id="other"><option value="">${dir > 0 ? 'Plata libre' : 'Plata libre'}</option>${others.map((o) => `<option value="${o.id}">${o.emoji} ${esc(o.name)} (${fmtShort(st.pocketBalance(o.id))})</option>`).join('')}</select></div>` : ''}
    <button class="btn btn-primary btn-block mt16" id="ok">${dir > 0 ? 'Apartar' : 'Sacar'}</button>`);
  bindAmountInputs(s.el);
  setTimeout(() => $('#v', s.el).focus(), 300);
  $('#ok', s.el).addEventListener('click', () => {
    const v = inputToNumber($('#v', s.el).value);
    if (!v) return;
    const other = $('#other', s.el)?.value || null;
    const available = dir > 0 ? (other ? st.pocketBalance(other) : st.freeInAccount(x.account)) : inPocket;
    if (v > available) { toast(`${phrase('warn')} Solo hay ${fmt(Math.max(0, available))} ${dir > 0 ? (other ? 'en ese bolsillo' : 'libres') : 'en el bolsillo'}.`); return; }
    const savings = !!(x.main || x.target);
    if (dir > 0) st.addTx({ type: 'alloc', pocket: pid, fromPocket: other, amount: v, savings: savings && !other });
    else if (other) st.addTx({ type: 'alloc', pocket: other, fromPocket: pid, amount: v });
    else st.addTx({ type: 'alloc', pocket: null, fromPocket: pid, amount: v });
    s.close();
    toast(dir > 0 ? `${phrase('good')} ${fmtShort(v)} a ${x.name}.` : `Sacaste ${fmtShort(v)} de ${x.name}.`);
    nav.refresh();
  });
}

function editPocket(pid) {
  const S = st.S();
  const x = pid ? st.pocket(pid) : { id: null, name: '', emoji: '🎯', account: 'nu', target: 0, deadline: '', note: '' };
  const s = sheet(`
    <h3 class="sheet-title">${pid ? 'Editar bolsillo' : 'Nuevo bolsillo.'}</h3>
    <div class="field-row"><div class="field" style="max-width:90px"><label>Emoji</label><input id="em" value="${esc(x.emoji)}" maxlength="4"/></div><div class="field" style="margin-top:0"><label>Nombre</label><input id="nm" value="${esc(x.name)}" placeholder="Ej: Viaje a Europa"/></div></div>
    <div class="field mt8"><label>Meta (opcional)</label><input inputmode="numeric" data-amount="COP" id="tg" value="${x.target ? formatInput(String(x.target)) : ''}" placeholder="0"/></div>
    <div class="field-row mt8">
      <div class="field"><label>Fecha límite</label><input type="date" id="dl" value="${x.deadline || ''}"/></div>
      <div class="field"><label>Vive en</label><select id="acc">${st.activeAccounts().filter((a) => a.currency === 'COP').map((a) => `<option value="${a.id}" ${a.id === x.account ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div>
    </div>
    <div class="field mt8"><label>Nota</label><input id="nt" value="${esc(x.note || '')}"/></div>
    <label class="field row between mt8"><span>Meta principal<br><span class="tiny muted">Recibe los sobrantes y es la que Lukas vigila</span></span><span class="switch"><input type="checkbox" id="mn" ${x.main ? 'checked' : ''}/><span></span></span></label>
    <label class="field row between mt8"><span>Se renueva cada mes<br><span class="tiny muted">Al cerrar el mes, Lukas propone mover lo que sobre</span></span><span class="switch"><input type="checkbox" id="pr" ${x.periodic ? 'checked' : ''}/><span></span></span></label>
    <button class="btn btn-primary btn-block mt16" id="ok">Guardar</button>
    ${pid ? `<button class="btn btn-danger btn-block mt8" id="arch">Archivar bolsillo</button>` : ''}`);
  bindAmountInputs(s.el);
  $('#ok', s.el).addEventListener('click', () => {
    const name = $('#nm', s.el).value.trim();
    if (!name) { toast('Ponle nombre.'); return; }
    const data = { name, emoji: $('#em', s.el).value || '🎯', target: inputToNumber($('#tg', s.el).value), deadline: $('#dl', s.el).value || null, account: $('#acc', s.el).value, note: $('#nt', s.el).value.trim(), main: $('#mn', s.el).checked, periodic: $('#pr', s.el).checked };
    if (data.main) S.pockets.forEach((o) => (o.main = false));
    if (pid) Object.assign(x, data);
    else S.pockets.push({ id: st.uid('p'), ...data });
    st.save(); s.close(); nav.refresh();
  });
  $('#arch', s.el)?.addEventListener('click', async () => {
    const bal = st.pocketBalance(pid);
    if (!(await confirmSheet({ title: `¿Archivar ${x.name}?`, text: bal ? `Tiene ${fmt(bal)}. Esa plata vuelve a quedar libre en ${st.account(x.account)?.name}.` : 'Ya no aparecerá en tus bolsillos.', ok: 'Archivar' }))) return;
    if (bal) st.addTx({ type: 'alloc', pocket: null, fromPocket: pid, amount: bal, note: 'Archivado' });
    x.archived = true; st.save(); s.close(); nav.refresh();
  });
}

function editRec(rid) {
  const S = st.S();
  const r = rid ? st.recurringItem(rid) : { name: '', amount: 0, account: 'nequi', category: 'subs', day: null, active: true, note: '' };
  const s = sheet(`
    <h3 class="sheet-title">${rid ? esc(r.name) : 'Nuevo compromiso.'}</h3>
    <div class="field"><label>Nombre</label><input id="nm" value="${esc(r.name)}" placeholder="Ej: Netflix"/></div>
    <div class="field-row mt8">
      <div class="field"><label>Monto al mes</label><input inputmode="numeric" data-amount="COP" id="am" value="${r.amount ? formatInput(String(r.amount)) : ''}"/></div>
      <div class="field"><label>Día de pago</label><input inputmode="numeric" id="dy" value="${r.day || ''}" placeholder="Variable"/></div>
    </div>
    <div class="field-row mt8">
      <div class="field"><label>Cuenta</label><select id="acc">${st.activeAccounts().filter((a) => a.currency === 'COP').map((a) => `<option value="${a.id}" ${a.id === r.account ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Categoría</label><select id="ct">${S.categories.filter((c) => c.block === 'comp').map((c) => `<option value="${c.id}" ${c.id === r.category ? 'selected' : ''}>${c.emoji} ${esc(c.name)}</option>`).join('')}</select></div>
    </div>
    <div class="field mt8"><label>Nota</label><input id="nt" value="${esc(r.note || '')}"/></div>
    <label class="field row between mt8"><span>Activo</span><span class="switch"><input type="checkbox" id="ac" ${r.active ? 'checked' : ''}/><span></span></span></label>
    <button class="btn btn-primary btn-block mt16" id="ok">Guardar</button>
    ${rid ? `<button class="btn btn-danger btn-block mt8" id="del">Eliminar</button>` : ''}`);
  bindAmountInputs(s.el);
  $('#ok', s.el).addEventListener('click', () => {
    const name = $('#nm', s.el).value.trim();
    const amount = inputToNumber($('#am', s.el).value);
    if (!name || !amount) { toast('Falta nombre o monto.'); return; }
    const day = parseInt($('#dy', s.el).value, 10);
    const data = { name, amount, day: day >= 1 && day <= 31 ? day : null, account: $('#acc', s.el).value, category: $('#ct', s.el).value, note: $('#nt', s.el).value.trim(), active: $('#ac', s.el).checked };
    if (rid) Object.assign(r, data);
    else S.recurring.push({ id: st.uid('r'), ...data });
    st.save(); s.close(); nav.refresh();
  });
  $('#del', s.el)?.addEventListener('click', async () => {
    if (!(await confirmSheet({ title: `¿Eliminar ${r.name}?`, text: 'Los pagos que ya registraste se conservan.', ok: 'Eliminar', danger: true }))) return;
    S.recurring = S.recurring.filter((x) => x.id !== rid); st.save(); s.close(); nav.refresh();
  });
}

function editDebt(did) {
  const S = st.S();
  const d = did ? S.debts.find((x) => x.id === did) : { name: '', amount: 0, dir: 'owe', note: '' };
  const s = sheet(`
    <h3 class="sheet-title">${did ? 'Editar deuda' : 'Nueva deuda.'}</h3>
    <div class="segmented"><button data-dir="owe" class="${d.dir === 'owe' ? 'on' : ''}">Yo debo</button><button data-dir="owed" class="${d.dir === 'owed' ? 'on' : ''}">Me deben</button></div>
    <div class="field mt12"><label>¿A quién / quién?</label><input id="nm" value="${esc(d.name)}" placeholder="Ej: Primo Andrés"/></div>
    <div class="field mt8"><label>Monto total</label><input inputmode="numeric" data-amount="COP" id="am" value="${d.amount ? formatInput(String(d.amount)) : ''}"/></div>
    <div class="field mt8"><label>Nota</label><input id="nt" value="${esc(d.note || '')}"/></div>
    <button class="btn btn-primary btn-block mt16" id="ok">Guardar</button>
    ${did ? `<button class="btn btn-danger btn-block mt8" id="del">Archivar</button>` : ''}`);
  bindAmountInputs(s.el);
  let dir = d.dir;
  $$('[data-dir]', s.el).forEach((b) => b.addEventListener('click', () => { dir = b.dataset.dir; $$('[data-dir]', s.el).forEach((x) => x.classList.toggle('on', x === b)); }));
  $('#ok', s.el).addEventListener('click', () => {
    const name = $('#nm', s.el).value.trim();
    const amount = inputToNumber($('#am', s.el).value);
    if (!name || !amount) { toast('Falta nombre o monto.'); return; }
    const data = { name, amount, dir, note: $('#nt', s.el).value.trim() };
    if (did) Object.assign(d, data); else S.debts.push({ id: st.uid('d'), createdAt: todayISO(), ...data });
    st.save(); s.close(); nav.refresh();
  });
  $('#del', s.el)?.addEventListener('click', () => { d.archived = true; st.save(); s.close(); nav.refresh(); });
}

function payDebt(did) {
  const d = st.S().debts.find((x) => x.id === did);
  const owe = d.dir === 'owe';
  const s = sheet(`
    <h3 class="sheet-title">${owe ? `Abono a ${esc(d.name)}` : `${esc(d.name)} te pagó`}</h3>
    <div class="amount-input"><input inputmode="numeric" data-amount="COP" id="v" placeholder="0"/><div class="cur">COP</div></div>
    <div class="field"><label>${owe ? 'Sale de' : 'Entra a'}</label><select id="acc">${st.activeAccounts().filter((a) => a.currency === 'COP').map((a) => `<option value="${a.id}">${esc(a.name)}</option>`).join('')}</select></div>
    <button class="btn btn-primary btn-block mt16" id="ok">Registrar</button>`);
  bindAmountInputs(s.el);
  $('#ok', s.el).addEventListener('click', () => {
    const v = inputToNumber($('#v', s.el).value);
    if (!v) return;
    st.addTx(owe ? { type: 'expense', amount: v, account: $('#acc', s.el).value, category: 'credito', debt: did, note: `Abono a ${d.name}` } : { type: 'income', amount: v, account: $('#acc', s.el).value, category: 'otros_ing', debt: did, note: `Pago de ${d.name}` });
    s.close(); toast(phrase('paid')); nav.refresh();
  });
}

export function bind(root) {
  root.addEventListener('click', (e) => {
    const g = (sel) => e.target.closest(sel);
    let el;
    if ((el = g('[data-ptab]'))) { tab = el.dataset.ptab; nav.refresh(); return; }
    if ((el = g('[data-cap]'))) return editCap(el.dataset.cap);
    if (g('[data-edit-disp]')) return editDisp();
    if ((el = g('[data-alloc]'))) { e.stopPropagation(); return allocSheet(el.dataset.alloc, 1); }
    if ((el = g('[data-unalloc]'))) { e.stopPropagation(); return allocSheet(el.dataset.unalloc, -1); }
    if ((el = g('[data-pocket]'))) return editPocket(el.dataset.pocket);
    if (g('[data-new-pocket]')) return editPocket(null);
    if ((el = g('[data-rec]'))) return editRec(el.dataset.rec);
    if (g('[data-new-rec]')) return editRec(null);
    if (g('[data-ics]')) return downloadICS();
    if ((el = g('[data-debt-pay]'))) return payDebt(el.dataset.debtPay);
    if ((el = g('[data-debt-edit]'))) return editDebt(el.dataset.debtEdit);
    if (g('[data-new-debt]')) return editDebt(null);
  });
}
