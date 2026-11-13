// Formulario rápido de movimiento (gasto / ingreso / transferencia) y fila de lista
import * as st from '../store.js';
import { nav } from '../nav.js';
import { fmt, formatInput, inputToNumber } from '../money.js';
import { todayISO, fmtDate } from '../dates.js';
import { esc, sheet, $, $$, toast, bindAmountInputs, icon, confirmSheet } from '../ui.js';
import { reactTo } from '../lukas.js';
import { BLOCKS } from '../seed.js';
import { guessCategory } from '../parser.js';

export function txRow(t) {
  const acc = st.account(t.account);
  const cur = acc?.currency || 'COP';
  if (t.type === 'transfer') {
    const to = st.account(t.toAccount);
    return `<li><button class="li" data-tx="${t.id}"><div class="emoji">${icon('arrows', 18)}</div><div class="grow"><div class="ellipsis">${esc(acc?.name)} → ${esc(to?.name)}</div><div class="tiny muted">${fmtDate(t.date)}${t.rate ? ` · ${fmt(t.rate)}/USD` : ''}</div></div><span class="amount">${fmt(t.amount, cur)}</span></button></li>`;
  }
  if (t.type === 'alloc') {
    const pk = st.pocket(t.pocket) || st.pocket(t.fromPocket);
    return `<li><button class="li" data-tx="${t.id}"><div class="emoji">${pk?.emoji || '📦'}</div><div class="grow"><div class="ellipsis">${t.fromPocket ? 'Sale de' : 'Al bolsillo'} ${esc(pk?.name)}</div><div class="tiny muted">${fmtDate(t.date)} · virtual</div></div><span class="amount">${fmt(t.amount)}</span></button></li>`;
  }
  const c = st.category(t.category);
  const inc = t.type === 'income';
  const lbl = st.labelOf(t);
  const sub = lbl && c && lbl !== c.name ? `${lbl} · ${c.name}` : c?.name || '';
  return `<li><button class="li" data-tx="${t.id}"><div class="emoji">${st.emojiOf(t) || (inc ? '💰' : '💸')}</div><div class="grow"><div class="ellipsis">${esc(t.note || lbl || 'Movimiento')}</div><div class="tiny muted ellipsis">${esc(sub)} · ${esc(acc?.name || '')}${t.historic ? ' · antes de la app' : ''}</div></div><span class="amount ${inc ? 'in' : ''}">${fmt(inc ? t.amount : -t.amount, cur, { sign: inc })}</span></button></li>`;
}

function catGrid(type, selected, selItem) {
  const S = st.S();
  const chip = (c) => `<button class="chip ${c.id === selected ? 'on' : ''}" data-cat="${c.id}">${c.emoji} ${esc(c.name)}</button>`;
  const items = () => {
    const c = st.category(selected);
    if (!c || (c.items || []).length < 2) return '';
    return `<p class="tiny muted strong" style="margin:14px 4px 6px">DETALLE DE ${esc(c.name.toUpperCase())}</p>
      <div class="chips" style="flex-wrap:wrap">${c.items.map((i) => `<button class="chip ${i.id === selItem ? 'on' : 'soft'}" data-item="${i.id}">${i.emoji} ${esc(i.name)}</button>`).join('')}</div>`;
  };
  if (type === 'income') return `<div class="chips mt12" style="flex-wrap:wrap">${S.categories.filter((c) => c.block === 'ingreso').map(chip).join('')}</div>`;
  return ['disp', 'gastos', 'comp'].map((b) => `
    <p class="tiny muted strong" style="margin:12px 4px 6px"><span class="dot" style="background:${BLOCKS[b].color}"></span> ${BLOCKS[b].name.toUpperCase()}</p>
    <div class="chips" style="flex-wrap:wrap">${S.categories.filter((c) => c.block === b).map(chip).join('')}</div>`).join('') + items();
}

export function openTxForm(existing = null, preset = {}) {
  const S = st.S();
  const t = existing ? { ...existing } : { type: 'expense', account: 'nequi', date: todayISO(), ...preset };
  if (t.type === 'alloc') return openAllocView(existing);
  let type = t.type;
  let cat = t.category || null;
  let item = t.item || null;
  let catTouched = !!existing || !!preset.category;

  const accOpts = (sel, filter = () => true) => st.activeAccounts().filter(filter).map((a) => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${esc(a.name)} · ${a.currency}</option>`).join('');
  const cur = (id) => st.account(id)?.currency || 'COP';

  const s = sheet('', { tall: true });
  const draw = () => {
    s.set(`
      <div class="sheet-head">
        <button class="btn btn-ghost btn-sm" data-close>Cancelar</button>
        <strong>${existing ? 'Editar' : 'Nuevo'}</strong>
        <button class="btn btn-primary btn-sm" id="save">Guardar</button>
      </div>
      <div class="segmented">
        <button data-type="expense" class="${type === 'expense' ? 'on' : ''}">Gasto</button>
        <button data-type="income" class="${type === 'income' ? 'on' : ''}">Ingreso</button>
        <button data-type="transfer" class="${type === 'transfer' ? 'on' : ''}">Transferencia</button>
      </div>
      <div class="amount-input">
        <input inputmode="decimal" data-amount="${cur(t.account)}" id="amt" placeholder="0" value="${t.amount ? formatInput(String(t.amount).replace('.', ','), cur(t.account)) : ''}" autocomplete="off"/>
        <div class="cur" id="curlbl">${cur(t.account)}</div>
      </div>
      ${type === 'transfer' ? `
        <div class="field-row">
          <div class="field"><label>Desde</label><select id="acc">${accOpts(t.account)}</select></div>
          <div class="field"><label>Hacia</label><select id="to">${accOpts(t.toAccount || 'nequi')}</select></div>
        </div>
        <div class="field mt8 ${cur(t.account) === cur(t.toAccount || 'nequi') ? 'hidden' : ''}" id="toAmtWrap">
          <label>Lo que llegó (<span id="toCur">${cur(t.toAccount || 'nequi')}</span>)</label>
          <input inputmode="decimal" data-amount="${cur(t.toAccount || 'nequi')}" id="toAmt" value="${t.toAmount && cur(t.account) !== cur(t.toAccount) ? formatInput(String(t.toAmount).replace('.', ','), cur(t.toAccount)) : ''}" placeholder="0"/>
          <div class="tiny muted" id="rateInfo"></div>
        </div>` : `
        <div class="field mt8"><label>Nota</label><input id="note" value="${esc(t.note || '')}" placeholder="${type === 'income' ? 'Ej: pago de Deel' : 'Ej: almuerzo con los muchachos'}" autocomplete="off"/></div>
        <div class="field-row mt8">
          <div class="field"><label>Cuenta</label><select id="acc">${accOpts(t.account)}</select></div>
          <div class="field"><label>Fecha</label><input type="date" id="date" value="${t.date}"/></div>
        </div>`}
      ${type === 'transfer' ? `<div class="field mt8"><label>Fecha</label><input type="date" id="date" value="${t.date}"/></div>` : ''}
      ${type !== 'transfer' ? `<div id="cats">${catGrid(type, cat, item)}</div>` : ''}
      ${type === 'expense' ? `
        <div class="field mt16"><label>¿Sale de un bolsillo?</label><select id="pocket"><option value="">No, de la plata libre</option>${S.pockets.filter((p) => !p.archived).map((p) => `<option value="${p.id}" ${p.id === t.pocket ? 'selected' : ''}>${p.emoji} ${esc(p.name)} (${st.account(p.account)?.name})</option>`).join('')}</select></div>
        <div class="field mt8"><label>¿Es un compromiso del checklist?</label><select id="rec"><option value="">No</option>${S.recurring.filter((r) => r.active).map((r) => `<option value="${r.id}" ${r.id === t.recurring ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select></div>` : ''}
      ${existing ? `<button class="btn btn-danger btn-block mt24" id="del">${icon('trash', 18)} Borrar movimiento</button>` : ''}
    `);
    bindAmountInputs(s.el);
    wire();
  };

  const updateRate = () => {
    const info = $('#rateInfo', s.el);
    if (!info) return;
    const a = inputToNumber($('#amt', s.el).value, cur($('#acc', s.el).value));
    const b = inputToNumber($('#toAmt', s.el).value, cur($('#to', s.el).value));
    if (a && b) {
      const rate = cur($('#acc', s.el).value) === 'USD' ? b / a : a / b;
      info.textContent = `Tasa: ${fmt(rate)} por dólar`;
    } else info.textContent = '';
  };

  const wire = () => {
    $$('[data-type]', s.el).forEach((b) => b.addEventListener('click', () => {
      collect();
      type = b.dataset.type;
      if (type === 'income' && (!cat || st.category(cat)?.block !== 'ingreso')) { cat = 'sueldo'; item = 'sueldo'; }
      if (type === 'expense' && st.category(cat)?.block === 'ingreso') { cat = null; item = null; }
      draw();
    }));
    const redrawCats = () => {
      const box = $('#cats', s.el);
      if (!box) return;
      box.innerHTML = catGrid(type, cat, item);
      wireCats();
    };
    const wireCats = () => {
      $$('[data-cat]', s.el).forEach((b) => b.addEventListener('click', () => {
        if (cat !== b.dataset.cat) item = null;
        cat = b.dataset.cat;
        const c = st.category(cat);
        if ((c.items || []).length === 1) item = c.items[0].id;
        catTouched = true;
        redrawCats();
      }));
      $$('[data-item]', s.el).forEach((b) => b.addEventListener('click', () => {
        item = item === b.dataset.item ? null : b.dataset.item;
        catTouched = true;
        const i = st.item(cat, item);
        if (!existing && i?.account && $('#acc', s.el)) $('#acc', s.el).value = i.account;
        redrawCats();
      }));
    };
    wireCats();
    const note = $('#note', s.el);
    note?.addEventListener('input', () => {
      if (catTouched) return;
      const g = guessCategory(note.value, type);
      if (g && (g.category !== cat || g.item !== item)) { cat = g.category; item = g.item; redrawCats(); }
    });
    const acc = $('#acc', s.el), to = $('#to', s.el);
    const onAcc = () => {
      const c = cur(acc.value);
      $('#amt', s.el).dataset.amount = c;
      $('#curlbl', s.el).textContent = c;
      if (to) {
        const diff = cur(acc.value) !== cur(to.value);
        $('#toAmtWrap', s.el).classList.toggle('hidden', !diff);
        $('#toAmt', s.el).dataset.amount = cur(to.value);
        $('#toCur', s.el).textContent = cur(to.value);
      }
      updateRate();
    };
    acc?.addEventListener('change', onAcc);
    to?.addEventListener('change', onAcc);
    $('#toAmt', s.el)?.addEventListener('input', updateRate);
    $('#amt', s.el)?.addEventListener('input', updateRate);
    $('#rec', s.el)?.addEventListener('change', (e) => {
      const r = st.recurringItem(e.target.value);
      if (r) { cat = r.category; item = r.item || null; redrawCats(); if (!$('#note', s.el).value) $('#note', s.el).value = r.name; }
    });
    $('#save', s.el).addEventListener('click', saveTx);
    $('#del', s.el)?.addEventListener('click', async () => {
      if (await confirmSheet({ title: '¿Borrar este movimiento?', text: 'No se puede deshacer.', ok: 'Borrar', danger: true })) {
        st.deleteTx(existing.id);
        s.close();
        nav.refresh();
      }
    });
    if (!existing) setTimeout(() => $('#amt', s.el)?.focus(), 300);
  };

  const collect = () => {
    const accEl = $('#acc', s.el);
    if (accEl) t.account = accEl.value;
    t.amount = inputToNumber($('#amt', s.el)?.value || '', cur(t.account));
    if ($('#note', s.el)) t.note = $('#note', s.el).value.trim();
    if ($('#date', s.el)) t.date = $('#date', s.el).value || todayISO();
    if ($('#to', s.el)) t.toAccount = $('#to', s.el).value;
  };

  const saveTx = () => {
    collect();
    if (!t.amount) { toast('Ponle un monto, mi llave.'); return; }
    const out = { type, amount: t.amount, account: t.account, date: t.date };
    if (type === 'transfer') {
      if (t.account === t.toAccount) { toast('Escoge dos cuentas distintas.'); return; }
      const diff = cur(t.account) !== cur(t.toAccount);
      out.toAccount = t.toAccount;
      out.toAmount = diff ? inputToNumber($('#toAmt', s.el).value, cur(t.toAccount)) : t.amount;
      if (diff && !out.toAmount) { toast('Escribe cuánto llegó.'); return; }
      if (diff) out.rate = cur(t.account) === 'USD' ? out.toAmount / out.amount : out.amount / out.toAmount;
      out.note = 'Transferencia';
    } else {
      if (!cat) { toast('Escoge una categoría.'); return; }
      out.category = cat;
      out.item = item;
      out.note = t.note;
      if (type === 'expense') {
        out.pocket = $('#pocket', s.el)?.value || null;
        out.recurring = $('#rec', s.el)?.value || null;
      }
    }
    let saved;
    if (existing) saved = st.updateTx(existing.id, out);
    else saved = st.addTx(out);
    s.close();
    toast(existing ? 'Actualizado.' : reactTo(saved));
    nav.refresh();
  };

  draw();
}

function openAllocView(t) {
  const pk = st.pocket(t.pocket) || st.pocket(t.fromPocket);
  const s = sheet(`
    <h3 class="sheet-title">${pk?.emoji || ''} ${esc(pk?.name || 'Bolsillo')}</h3>
    <p class="muted" style="margin:0 4px">${t.fromPocket ? 'Sacaste' : 'Apartaste'} ${fmt(t.amount)} el ${fmtDate(t.date)}. Es un movimiento virtual: la plata no salió de ${esc(st.account(pk?.account)?.name)}.</p>
    <div class="stack gap12 mt24">
      <button class="btn btn-danger" id="del">Borrar movimiento</button>
      <button class="btn btn-ghost" data-close>Cerrar</button>
    </div>`);
  $('#del', s.el).addEventListener('click', () => { st.deleteTx(t.id); s.close(); nav.refresh(); });
}
