// Pagar / desmarcar compromisos del checklist
import * as st from '../store.js';
import { nav } from '../nav.js';
import { fmt, inputToNumber, formatInput } from '../money.js';
import { todayISO, fmtDate } from '../dates.js';
import { esc, sheet, $, toast, bindAmountInputs, confirmSheet, icon } from '../ui.js';
import { phrase } from '../lukas.js';

export async function payCommitment(id, { edit = false } = {}) {
  const p = st.currentPeriod();
  const item = st.checklist(p).find((c) => c.id === id);
  if (!item) return;

  if (!edit) {
    if (item.done) {
      const ok = await confirmSheet({ title: `¿Desmarcar ${item.name}?`, text: 'Se borra el pago registrado de este mes y vuelve a quedar pendiente.', ok: 'Desmarcar' });
      if (!ok) return;
      item.txs.forEach((t) => st.deleteTx(t.id));
      nav.refresh();
      return;
    }
    st.addTx({ type: 'expense', amount: item.amount - item.paid, account: item.account, category: item.category, item: item.item, recurring: item.id, note: item.name, date: todayISO() });
    toast(`${phrase('paid')} ${item.name}`);
    nav.refresh();
    return;
  }

  const accs = st.activeAccounts().filter((a) => a.currency === 'COP');
  const s = sheet(`
    <div class="sheet-head"><h3 class="sheet-title" style="margin:0">${esc(item.name)}</h3><button class="icon-btn" data-close aria-label="Cerrar">${icon('close', 18)}</button></div>
    <p class="small muted" style="margin:0 4px 12px">Compromiso de ${fmt(item.amount)}${item.due ? ` · vence ${fmtDate(item.due)}` : ''}. ${item.paid ? `Llevas ${fmt(item.paid)} pagados este mes.` : ''}</p>
    ${item.txs.length ? `<div class="card tight"><ul class="list">${item.txs.map((t) => `
      <li class="li no-icon"><div class="grow"><div>${fmt(t.amount)}</div><div class="tiny muted">${fmtDate(t.date)} · ${esc(st.account(t.account)?.name)}</div></div><button class="icon-btn" data-del="${t.id}" aria-label="Borrar pago">${icon('trash', 18)}</button></li>`).join('')}</ul></div>` : ''}
    <div class="amount-input"><input inputmode="numeric" data-amount="COP" id="amt" value="${formatInput(String(Math.max(0, item.amount - item.paid)))}"/><div class="cur">COP</div></div>
    <div class="field-row">
      <div class="field"><label>Cuenta</label><select id="acc">${accs.map((a) => `<option value="${a.id}" ${a.id === item.account ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></div>
      <div class="field"><label>Fecha</label><input type="date" id="date" value="${todayISO()}"/></div>
    </div>
    <label class="field row between mt8"><span>Con esto queda listo<br><span class="tiny muted">Apágalo si es un abono (p. ej. 1 de 2 motiladas)</span></span><span class="switch"><input type="checkbox" id="closes" ${item.paid + 1 >= item.amount * 0.5 ? 'checked' : ''}/><span></span></span></label>
    <button class="btn btn-primary btn-block mt16" id="save">Registrar pago</button>
  `);
  bindAmountInputs(s.el);
  // Por defecto: si paga el total queda listo; si es un abono, no
  const amt = $('#amt', s.el), closes = $('#closes', s.el);
  const sync = () => { closes.checked = item.paid + inputToNumber(amt.value) >= item.amount; };
  sync();
  amt.addEventListener('input', sync);
  s.el.addEventListener('click', async (e) => {
    const del = e.target.closest('[data-del]');
    if (del) { st.deleteTx(del.dataset.del); s.close(); nav.refresh(); return; }
  });
  $('#save', s.el).addEventListener('click', () => {
    const amount = inputToNumber(amt.value);
    if (!amount) { toast('Ponle un monto, mi llave.'); return; }
    st.addTx({ type: 'expense', amount, account: $('#acc', s.el).value, category: item.category, item: item.item, recurring: item.id, note: item.name, date: $('#date', s.el).value || todayISO(), closes: closes.checked });
    s.close();
    toast(closes.checked ? `${phrase('paid')} ${item.name}` : `Abono anotado: ${fmt(amount)}`);
    nav.refresh();
  });
}
