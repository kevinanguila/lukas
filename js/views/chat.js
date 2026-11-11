// Chat con Lukas: registrar contando, preguntar y pedir consejos.
import * as st from '../store.js';
import { nav } from '../nav.js';
import { fmt } from '../money.js';
import { fmtDate } from '../dates.js';
import { esc, icon, $, toast } from '../ui.js';
import { parse } from '../parser.js';
import * as L from '../lukas.js';
import { openTxForm } from './txform.js';

const MAX = 200;

function push(from, text, extra = {}) {
  const S = st.S();
  S.chat.push({ id: st.uid('m'), from, text, ts: Date.now(), ...extra });
  if (S.chat.length > MAX) S.chat = S.chat.slice(-MAX);
  st.save();
}

function draftCard(m) {
  const t = m.draft;
  const acc = st.account(t.account);
  const cur = acc?.currency || 'COP';
  const c = st.category(t.category);
  const lines = [];
  if (t.type === 'transfer') lines.push(`${esc(acc?.name)} → ${esc(st.account(t.toAccount)?.name)}`);
  else {
    lines.push(`${c ? `${c.emoji} ${esc(c.name)}` : '❓ Sin categoría'} · ${esc(acc?.name)}`);
    if (t.pocket) lines.push(`Sale del bolsillo ${esc(st.pocket(t.pocket)?.name)}`);
    if (t.recurring) lines.push(`✓ Marca «${esc(st.recurringItem(t.recurring)?.name)}» en el checklist`);
  }
  lines.push(fmtDate(t.date, { weekday: true }));
  const label = t.type === 'income' ? 'Ingreso' : t.type === 'transfer' ? 'Transferencia' : 'Gasto';
  return `
    <div class="bubble lk card-b">
      <p class="tiny muted strong" style="margin:0">${label.toUpperCase()}${t.note && t.type !== 'transfer' ? ` · ${esc(t.note)}` : ''}</p>
      <div class="h2 num" style="margin:2px 0 6px">${fmt(t.amount, cur)}</div>
      ${lines.map((l) => `<div class="small muted">${l}</div>`).join('')}
      ${m.status === 'pending' ? `
        <div class="row mt12" style="gap:8px">
          <button class="btn btn-primary btn-sm" data-ok="${m.id}">Anotar</button>
          <button class="btn btn-secondary btn-sm" data-edit="${m.id}">Cambiar</button>
          <button class="btn btn-ghost btn-sm" data-no="${m.id}">No</button>
        </div>` : `<div class="tag ${m.status === 'saved' ? 'done' : ''} mt8">${m.status === 'saved' ? '✓ Anotado' : 'Cancelado'}</div>`}
    </div>`;
}

export function render(params = {}) {
  const S = st.S();
  if (!S.chat.length) push('lk', L.helpText());
  if (params.advice) {
    push('lk', L.adviceText());
    nav.params = {};
  }
  const msgs = S.chat.map((m) => {
    if (m.draft) return draftCard(m);
    return `<div class="bubble ${m.from === 'me' ? 'me' : 'lk'}">${esc(m.text)}</div>`;
  }).join('');
  return `
  <section class="chat-view">
    <header class="chat-head">
      <div class="avatar">L</div>
      <div class="grow"><h3>Lukas.</h3><div class="tiny muted">Tu llave pa' la plata · todo se queda en tu cel</div></div>
      <button class="icon-btn" data-clear aria-label="Limpiar chat">${icon('trash', 18)}</button>
    </header>
    <div class="chat-log" id="log">${msgs}</div>
    <div class="suggest">
      ${['Tírala, ¿qué hago?', '¿Cuánto me queda?', '¿Qué me falta pagar?', '¿Cómo va la mudanza?'].map((s) => `<button class="chip" data-say="${esc(s)}">${esc(s)}</button>`).join('')}
    </div>
    <div class="chat-input">
      <textarea id="msg" rows="1" placeholder="Ej: gasté 25 lucas en almuerzo"></textarea>
      <button class="send" id="send" aria-label="Enviar">${icon('send', 20)}</button>
    </div>
  </section>`;
}

function respond(text) {
  push('me', text);
  const r = parse(text);
  switch (r.intent) {
    case 'status': push('lk', L.statusText()); break;
    case 'advice': push('lk', L.adviceText()); break;
    case 'pending': push('lk', L.pendingText()); break;
    case 'goal': push('lk', L.goalText()); break;
    case 'greet': push('lk', `${L.greeting()} ¿Qué gastaste hoy o en qué te ayudo?`); break;
    case 'tx': {
      const t = r.tx;
      // Si dijo dólares y la cuenta es en pesos, sugiere ARQ
      if (r.currency === 'USD' && st.account(t.account)?.currency !== 'USD') t.account = 'arq';
      const intro = t.type === 'expense' && !t.category ? 'No supe la categoría, escógela con «Cambiar».' : '¿Lo anoto así?';
      push('lk', intro);
      push('lk', '', { draft: t, status: 'pending' });
      break;
    }
    default:
      push('lk', `${L.phrase('warn').replace('.', '')}, no te entendí. Prueba con algo como «gasté 30 mil en gasolina con NU» o pregúntame «¿cuánto me queda?».`);
  }
}

export function bind(root) {
  const log = $('#log', root);
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  scroll();
  const input = $('#msg', root);
  const send = () => {
    const v = input.value.trim();
    if (!v) return;
    input.value = '';
    respond(v);
    nav.refresh();
    setTimeout(() => { const l = document.getElementById('log'); l.scrollTop = l.scrollHeight; }, 0);
  };
  $('#send', root).addEventListener('click', send);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(120, input.scrollHeight) + 'px'; });

  root.addEventListener('click', (e) => {
    const say = e.target.closest('[data-say]');
    if (say) { respond(say.dataset.say); nav.refresh(); setTimeout(() => { const l = document.getElementById('log'); l.scrollTop = l.scrollHeight; }, 0); return; }
    const S = st.S();
    const find = (id) => S.chat.find((m) => m.id === id);
    const ok = e.target.closest('[data-ok]');
    if (ok) {
      const m = find(ok.dataset.ok);
      if (m.draft.type !== 'transfer' && !m.draft.category) { toast('Escoge la categoría con «Cambiar».'); return; }
      const saved = st.addTx(m.draft);
      m.status = 'saved';
      m.txId = saved.id;
      push('lk', L.reactTo(saved));
      nav.refresh();
      return;
    }
    const no = e.target.closest('[data-no]');
    if (no) { find(no.dataset.no).status = 'cancelled'; push('lk', 'Listo, no lo anoto.'); nav.refresh(); return; }
    const ed = e.target.closest('[data-edit]');
    if (ed) {
      const m = find(ed.dataset.edit);
      m.status = 'cancelled';
      st.save();
      openTxForm(null, m.draft);
      return;
    }
    if (e.target.closest('[data-clear]')) { S.chat = []; st.save(); nav.refresh(); }
  });
}
