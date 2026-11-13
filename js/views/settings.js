// Ajustes: perfil, PIN, cuentas, categorías, respaldo y más.
import * as st from '../store.js';
import { nav } from '../nav.js';
import { fmt, formatInput, inputToNumber } from '../money.js';
import { fmtDate, todayISO, daysBetween } from '../dates.js';
import { esc, icon, sheet, $, $$, toast, bindAmountInputs, confirmSheet } from '../ui.js';
import { pinScreen, hasPin } from '../pin.js';
import { downloadICS } from '../ics.js';
import { BLOCKS } from '../seed.js';
import { phrase } from '../lukas.js';

export function render() {
  const S = st.S();
  const lb = S.settings.lastBackup;
  const row = (attr, ic, label, value = '') => `<li><button class="li" ${attr}><div class="emoji">${ic}</div><div class="grow">${label}</div><span class="muted small">${value}</span>${icon('chevron', 16, 'muted')}</button></li>`;
  return `
  <section class="view">
    <header class="view-head"><div><p class="eyebrow">Lukas</p><h1>Ajustes.</h1></div><button class="icon-btn white" data-tab="home" aria-label="Volver">${icon('close', 20)}</button></header>

    <div class="section-title"><h2>Respaldo.</h2></div>
    <article class="card">
      <p class="small" style="margin:0">Tus datos viven solo en este iPhone. Haz una copia y guárdala en iCloud Drive o Archivos.</p>
      <p class="tiny muted" style="margin:6px 0 12px">${lb ? `Última copia: ${fmtDate(lb.slice(0, 10), { year: true })} (hace ${daysBetween(lb.slice(0, 10), todayISO())} días)` : 'Todavía no has hecho ninguna copia.'}</p>
      <div class="row" style="gap:8px"><button class="btn btn-primary btn-sm" data-backup>Hacer copia</button><button class="btn btn-secondary btn-sm" data-restore>Restaurar</button></div>
      <input type="file" id="file" accept="application/json,.json" class="hidden"/>
    </article>

    <div class="section-title"><h2>Tu plata.</h2></div>
    <article class="card tight"><ul class="list">
      ${row('data-accounts', '🏦', 'Cuentas y saldos', `${st.activeAccounts().length}`)}
      ${row('data-cats', '🏷️', 'Categorías', `${S.categories.length}`)}
      ${row('data-income', '💵', 'Sueldo mensual', fmt(S.settings.monthlyUSD, 'USD'))}
      ${row('data-rate', '💱', 'Tasa de respaldo', fmt(S.settings.fallbackRate))}
      ${row('data-cal', '📅', 'Pagos al Calendario', '')}
      <li><label class="li"><div class="emoji">🧾</div><div class="grow">Nequi me cobra 4x1000<div class="tiny muted">Apágalo si confirmas que estás exento</div></div><span class="switch"><input type="checkbox" id="gmf" ${S.settings.nequiGMF ? 'checked' : ''}/><span></span></span></label></li>
    </ul></article>

    <div class="section-title"><h2>Seguridad.</h2></div>
    <article class="card tight"><ul class="list">
      ${row('data-pin', '🔒', hasPin() ? 'Cambiar PIN' : 'Crear PIN', hasPin() ? 'Activo' : 'Apagado')}
      ${hasPin() ? row('data-nopin', '🔓', 'Quitar PIN', '') : ''}
      ${row('data-name', '🙋🏽‍♂️', 'Cómo te llamo', esc(S.settings.name))}
    </ul></article>

    <div class="section-title"><h2>Sobre Lukas.</h2></div>
    <article class="card">
      <div class="lukas-card"><div class="avatar">L</div><div class="small">${esc(phrase('greet'))} Soy Lukas, tu llave pa' la plata. Todo lo que me cuentas se queda en tu cel: no hay servidores, ni cuentas, ni nadie mirando. Mis consejos son para ayudarte a decidir; no soy asesor financiero certificado, así que la última palabra es tuya.</div></div>
    </article>

    <button class="btn btn-danger btn-block mt24" data-reset>Borrar todos los datos</button>
    <p class="tiny muted center mt12">Lukas v1 · hecho a la medida pa' Kevin</p>
  </section>`;
}

export async function doBackup() {
  const json = st.exportJSON();
  const name = `lukas-respaldo-${todayISO()}.json`;
  const file = new File([json], name, { type: 'application/json' });
  const mark = () => { st.S().settings.lastBackup = new Date().toISOString(); st.save(); nav.refresh(); };
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Respaldo Lukas' });
      mark();
      toast('Copia lista. Guárdala en Archivos › iCloud Drive.');
      return;
    } catch (e) {
      if (e?.name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  mark();
  toast('Copia descargada.');
}

async function restore(file) {
  try {
    const obj = JSON.parse(await file.text());
    const data = obj.data || obj;
    if (!data.accounts || !data.transactions) throw new Error('formato');
    const ok = await confirmSheet({ title: '¿Restaurar esta copia?', text: `Copia del ${obj.exportedAt ? fmtDate(obj.exportedAt.slice(0, 10), { year: true }) : '—'} con ${data.transactions.length} movimientos. Reemplaza todo lo que hay ahora.`, ok: 'Restaurar', danger: true });
    if (!ok) return;
    st.replaceState(data);
    toast('Copia restaurada. ¡Ya salimos de una!');
    nav.go('home');
  } catch {
    toast('Ese archivo no es una copia de Lukas.');
  }
}

function accountsSheet() {
  const S = st.S();
  const s = sheet(`
    <h3 class="sheet-title">Cuentas.</h3>
    <p class="small muted" style="margin:0 4px 12px">Si un saldo no cuadra con tu banco, ajústalo aquí: Lukas crea un movimiento de ajuste.</p>
    ${S.accounts.map((a) => `
      <article class="card" style="padding:16px 18px">
        <div class="row between"><strong><span class="dot" style="background:${a.color}"></span> ${esc(a.name)} <span class="muted tiny">${a.currency}</span></strong><label class="row small muted" style="gap:8px">Visible<span class="switch"><input type="checkbox" data-vis="${a.id}" ${!a.hidden ? 'checked' : ''}/><span></span></span></label></div>
        <div class="field mt8" style="background:var(--fog)"><label>Saldo real hoy</label><input inputmode="decimal" data-amount="${a.currency}" data-bal="${a.id}" value="${formatInput(String(Math.round(st.balance(a.id) * 100) / 100).replace('.', ','), a.currency)}"/></div>
        <div class="field mt8" style="background:var(--fog)"><label>Para qué la usas</label><input data-role="${a.id}" value="${esc(a.role || '')}"/></div>
      </article>`).join('')}
    <button class="btn btn-secondary btn-block mt12" id="add">${icon('plus', 18)} Agregar cuenta</button>
    <button class="btn btn-primary btn-block mt12" id="ok">Guardar</button>`, { tall: true });
  bindAmountInputs(s.el);
  $('#add', s.el).addEventListener('click', () => {
    const name = prompt('Nombre de la cuenta (ej: Lulo)');
    if (!name) return;
    const usd = confirm('¿Es en dólares? (Aceptar = USD, Cancelar = COP)');
    S.accounts.push({ id: st.uid('acc'), name, currency: usd ? 'USD' : 'COP', role: '', color: '#707070', initial: 0, order: S.accounts.length + 1 });
    st.save(); s.close(); accountsSheet();
  });
  $('#ok', s.el).addEventListener('click', () => {
    for (const a of S.accounts) {
      a.hidden = !$(`[data-vis="${a.id}"]`, s.el).checked;
      a.role = $(`[data-role="${a.id}"]`, s.el).value.trim();
      const want = inputToNumber($(`[data-bal="${a.id}"]`, s.el).value, a.currency);
      const cur = st.balance(a.id);
      const diff = Math.round((want - cur) * 100) / 100;
      if (Math.abs(diff) >= (a.currency === 'USD' ? 0.01 : 1)) {
        if (!S.transactions.some((t) => !t.historic && (t.account === a.id || t.toAccount === a.id))) a.initial = (a.initial || 0) + diff;
        else st.addTx({ type: diff > 0 ? 'income' : 'expense', amount: Math.abs(diff), account: a.id, category: diff > 0 ? 'otros_ing' : 'imprevistos', note: 'Ajuste de saldo', adjust: true });
      }
    }
    st.save(); s.close(); toast('Cuentas actualizadas.'); nav.refresh();
  });
}

function catsSheet() {
  const S = st.S();
  const s = sheet('', { tall: true });
  const blocks = [...Object.values(BLOCKS).filter((b) => b.id !== 'ahorro'), { id: 'ingreso', name: 'Ingresos' }];
  const draw = () => {
    s.set(`
      <h3 class="sheet-title">Categorías.</h3>
      <p class="small muted" style="margin:0 4px 8px">Grupos con su detalle adentro. El grupo es lo que ves en el resumen; el detalle tiene su tope y las palabras con que Lukas lo reconoce.</p>
      ${blocks.map((b) => `
        <p class="tiny muted strong" style="margin:16px 8px 6px">${b.name.toUpperCase()}</p>
        <article class="card tight"><ul class="list">${S.categories.filter((c) => c.block === b.id).map((c) => `<li><button class="li" data-cat="${c.id}"><div class="emoji">${c.emoji}</div><div class="grow ellipsis">${esc(c.name)}<div class="tiny muted ellipsis">${esc((c.items || []).map((i) => i.name).join(', '))}</div></div>${icon('chevron', 16, 'muted')}</button></li>`).join('') || '<li class="empty small">Sin grupos (el ahorro se maneja con bolsillos)</li>'}</ul></article>`).join('')}
      <button class="btn btn-secondary btn-block mt16" id="add">${icon('plus', 18)} Nuevo grupo</button>`);
    s.el.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => editGroup(b.dataset.cat)));
    $('#add', s.el).addEventListener('click', () => editGroup(null));
  };

  const editGroup = (id) => {
    const c = id ? st.category(id) : { name: '', emoji: '🏷️', block: 'disp', items: [], keywords: [] };
    const e = sheet('', { tall: true });
    const drawG = () => {
      e.set(`
        <h3 class="sheet-title">${id ? esc(c.name) : 'Nuevo grupo.'}</h3>
        <div class="field-row"><div class="field" style="max-width:90px"><label>Emoji</label><input id="em" value="${esc(c.emoji)}" maxlength="4"/></div><div class="field" style="margin-top:0"><label>Nombre</label><input id="nm" value="${esc(c.name)}"/></div></div>
        <div class="field mt8"><label>Bloque</label><select id="bl">${blocks.map((b) => `<option value="${b.id}" ${b.id === c.block ? 'selected' : ''}>${b.name}</option>`).join('')}</select></div>
        <p class="tiny muted strong" style="margin:16px 8px 6px">DETALLE</p>
        <article class="card tight"><ul class="list">${(c.items || []).map((i) => `<li><button class="li" data-it="${i.id}"><div class="emoji">${i.emoji}</div><div class="grow ellipsis">${esc(i.name)}<div class="tiny muted ellipsis">${i.cap ? `Tope ${fmt(i.cap)} · ` : ''}${esc((i.keywords || []).slice(0, 4).join(', '))}</div></div>${icon('chevron', 16, 'muted')}</button></li>`).join('') || '<li class="empty small">Sin detalle todavía</li>'}</ul></article>
        <button class="btn btn-secondary btn-block mt8" id="addit">${icon('plus', 18)} Agregar detalle</button>
        <button class="btn btn-primary btn-block mt16" id="ok">Guardar grupo</button>
        ${id ? '<button class="btn btn-danger btn-block mt8" id="del">Eliminar grupo</button>' : ''}`);
      e.el.querySelectorAll('[data-it]').forEach((b) => b.addEventListener('click', () => { readG(); editItem(c, b.dataset.it, drawG); }));
      $('#addit', e.el).addEventListener('click', () => { readG(); editItem(c, null, drawG); });
      $('#ok', e.el).addEventListener('click', () => {
        readG();
        if (!c.name) { toast('Ponle nombre al grupo.'); return; }
        if (!id) S.categories.push({ id: st.uid('c'), ...c });
        st.save(); e.close(); draw();
      });
      $('#del', e.el)?.addEventListener('click', () => {
        const used = S.transactions.some((t) => t.category === id) || S.recurring.some((r) => r.category === id);
        if (used) { toast('Tiene movimientos o compromisos: renómbralo en vez de borrarlo.'); return; }
        S.categories = S.categories.filter((x) => x.id !== id); st.save(); e.close(); draw();
      });
    };
    const readG = () => {
      c.name = $('#nm', e.el).value.trim();
      c.emoji = $('#em', e.el).value || '🏷️';
      c.block = $('#bl', e.el).value;
    };
    drawG();
  };

  const editItem = (c, iid, back) => {
    c.items = c.items || [];
    const i = iid ? c.items.find((x) => x.id === iid) : { name: '', emoji: '•', keywords: [] };
    const e = sheet(`
      <h3 class="sheet-title">${iid ? esc(i.name) : 'Nuevo detalle.'}</h3>
      <div class="field-row"><div class="field" style="max-width:90px"><label>Emoji</label><input id="em" value="${esc(i.emoji)}" maxlength="4"/></div><div class="field" style="margin-top:0"><label>Nombre</label><input id="nm" value="${esc(i.name)}"/></div></div>
      <div class="field mt8"><label>Tope al mes (opcional)</label><input inputmode="numeric" data-amount="COP" id="cap" value="${i.cap ? formatInput(String(i.cap)) : ''}" placeholder="Sin tope"/></div>
      <div class="field mt8"><label>Palabras con que lo reconoce Lukas (separadas por coma)</label><textarea id="kw" rows="3">${esc((i.keywords || []).join(', '))}</textarea></div>
      <button class="btn btn-primary btn-block mt16" id="ok">Guardar</button>
      ${iid ? '<button class="btn btn-danger btn-block mt8" id="del">Eliminar detalle</button>' : ''}`);
    bindAmountInputs(e.el);
    $('#ok', e.el).addEventListener('click', () => {
      const name = $('#nm', e.el).value.trim();
      if (!name) return;
      const data = { name, emoji: $('#em', e.el).value || '•', cap: inputToNumber($('#cap', e.el).value) || undefined, keywords: $('#kw', e.el).value.split(',').map((k) => k.trim()).filter(Boolean) };
      if (iid) Object.assign(i, data); else c.items.push({ id: st.uid('i'), ...data });
      st.save(); e.close(); back();
    });
    $('#del', e.el)?.addEventListener('click', () => {
      if (S.transactions.some((t) => t.item === iid) || S.recurring.some((r) => r.item === iid)) { toast('Tiene movimientos: renómbralo en vez de borrarlo.'); return; }
      c.items = c.items.filter((x) => x.id !== iid); st.save(); e.close(); back();
    });
  };
  draw();
}

function numberSheet(title, text, value, cur, onSave) {
  const s = sheet(`
    <h3 class="sheet-title">${esc(title)}</h3><p class="small muted" style="margin:0 4px">${esc(text)}</p>
    <div class="amount-input"><input inputmode="decimal" data-amount="${cur}" id="v" value="${formatInput(String(value).replace('.', ','), cur)}"/><div class="cur">${cur}</div></div>
    <button class="btn btn-primary btn-block" id="ok">Guardar</button>`);
  bindAmountInputs(s.el);
  $('#ok', s.el).addEventListener('click', () => { onSave(inputToNumber($('#v', s.el).value, cur)); st.save(); s.close(); nav.refresh(); });
}

export function bind(root) {
  const S = st.S();
  root.addEventListener('click', async (e) => {
    const g = (x) => e.target.closest(x);
    if (g('[data-backup]')) return doBackup();
    if (g('[data-restore]')) return $('#file', root).click();
    if (g('[data-accounts]')) return accountsSheet();
    if (g('[data-cats]')) return catsSheet();
    if (g('[data-cal]')) return downloadICS();
    if (g('[data-income]')) return numberSheet('Sueldo mensual.', 'Lo que te paga Deel al mes (sueldo + bono de internet).', S.settings.monthlyUSD, 'USD', (v) => (S.settings.monthlyUSD = v));
    if (g('[data-rate]')) return numberSheet('Tasa de respaldo.', 'Se usa para convertir ARQ a pesos si todavía no has registrado un pago con tasa real.', S.settings.fallbackRate, 'COP', (v) => (S.settings.fallbackRate = v));
    if (g('[data-pin]')) return pinScreen({ mode: 'create', onDone: () => { toast('PIN guardado.'); nav.refresh(); }, onCancel: () => {} });
    if (g('[data-nopin]')) {
      if (await confirmSheet({ title: '¿Quitar el PIN?', text: 'Cualquiera con tu iPhone desbloqueado podrá abrir Lukas.', ok: 'Quitar' })) { S.settings.pin = null; st.save(); nav.refresh(); }
      return;
    }
    if (g('[data-name]')) {
      const n = prompt('¿Cómo te llamo?', S.settings.name);
      if (n) { S.settings.name = n.trim(); st.save(); nav.refresh(); }
      return;
    }
    if (g('[data-reset]')) {
      if (await confirmSheet({ title: '¿Borrar todo?', text: 'Se borran todos tus movimientos, bolsillos y ajustes de este iPhone. Haz una copia antes si la quieres.', ok: 'Borrar todo', danger: true })) {
        st.resetAll();
        location.reload();
      }
    }
  });
  $('#gmf', root).addEventListener('change', (e) => { S.settings.nequiGMF = e.target.checked; st.save(); });
  $('#file', root).addEventListener('change', (e) => { const f = e.target.files?.[0]; if (f) restore(f); e.target.value = ''; });
}
