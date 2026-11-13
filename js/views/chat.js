// Chat con Lukas: registrar contando, preguntar y pedir consejos.
import * as st from '../store.js';
import { nav } from '../nav.js';
import { fmt } from '../money.js';
import { fmtDate } from '../dates.js';
import { esc, icon, $, toast } from '../ui.js';
import { parse } from '../parser.js';
import * as L from '../lukas.js';
import { openTxForm } from './txform.js';
import { openGiro } from './payday.js';
import * as B from '../brain.js';

const MAX = 200;

function push(from, text, extra = {}) {
  const S = st.S();
  S.chat.push({ id: st.uid('m'), from, text, ts: Date.now(), ...extra });
  if (S.chat.length > MAX) S.chat = S.chat.slice(-MAX);
  st.save();
}

function draftLines(t) {
  const acc = st.account(t.account);
  const lines = [];
  if (t.type === 'transfer') lines.push(`${esc(acc?.name)} → ${esc(st.account(t.toAccount)?.name)}`);
  else {
    const g = st.category(t.category);
    lines.push(`${g ? `${st.emojiOf(t)} ${esc(st.labelOf(t))}${t.item && g ? ` <span class="muted">· ${esc(g.name)}</span>` : ''}` : '❓ Sin categoría'} · ${esc(acc?.name)}`);
    if (t.pocket) lines.push(`Sale del bolsillo ${esc(st.pocket(t.pocket)?.name)}`);
    if (t.recurring) lines.push(`✓ Marca «${esc(st.recurringItem(t.recurring)?.name)}» en el checklist`);
  }
  lines.push(fmtDate(t.date, { weekday: true }));
  return lines;
}

function draftCard(m) {
  const list = m.drafts || [m.draft];
  const one = list.length === 1;
  const total = list.reduce((s, t) => s + t.amount, 0);
  const t0 = list[0];
  const cur = st.account(t0.account)?.currency || 'COP';
  const label = t0.type === 'income' ? 'Ingreso' : t0.type === 'transfer' ? 'Transferencia' : one ? 'Gasto' : `${list.length} gastos`;
  return `
    <div class="bubble lk card-b">
      <p class="tiny muted strong" style="margin:0">${label.toUpperCase()}${one && t0.note && t0.type !== 'transfer' ? ` · ${esc(t0.note)}` : ''}</p>
      <div class="h2 num" style="margin:2px 0 6px">${fmt(total, cur)}</div>
      ${one ? draftLines(t0).map((l) => `<div class="small muted">${l}</div>`).join('') : list.map((t) => `<div class="row between small" style="padding:3px 0"><span>${st.emojiOf(t) || '❓'} ${esc(t.note || st.labelOf(t) || 'Sin categoría')}</span><span class="num">${fmt(t.amount)}</span></div>`).join('') + `<div class="tiny muted mt8">${esc(st.account(t0.account)?.name)} · ${fmtDate(t0.date, { weekday: true })}</div>`}
      ${m.status === 'pending' ? `
        <div class="row mt12" style="gap:8px">
          <button class="btn btn-primary btn-sm" data-ok="${m.id}">Anotar</button>
          ${one ? `<button class="btn btn-secondary btn-sm" data-edit="${m.id}">Cambiar</button>` : ''}
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
    if (m.draft || m.drafts) return draftCard(m);
    const chips = m.chips && m === S.chat[S.chat.length - 1] ? `<div class="chips mt8" style="flex-wrap:wrap">${m.chips.map((c) => `<button class="chip soft" data-say="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : '';
    return `<div class="bubble ${m.from === 'me' ? 'me' : 'lk'}">${esc(m.text)}${chips}</div>`;
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
      ${['Tírala, ¿qué hago?', '¿Cuánto me queda?', '¿Qué me falta pagar?', '¿En qué gasté más?', '¿Cómo va la mudanza?', 'Ayuda'].map((s) => `<button class="chip" data-say="${esc(s)}">${esc(s)}</button>`).join('')}
    </div>
    <div class="chat-input">
      <textarea id="msg" rows="1" placeholder="Ej: almuerzo 20 lucas"></textarea>
      <button class="send" id="send" aria-label="Enviar">${icon('send', 20)}</button>
    </div>
  </section>`;
}

const groupChips = () => st.S().categories.filter((c) => c.block !== 'ingreso').slice(0, 12).map((c) => `${c.emoji} ${c.name}`);

function proposeTx(t, currency) {
  if (currency === 'USD' && st.account(t.account)?.currency !== 'USD') t.account = 'arq';
  if (t.type !== 'transfer' && !t.category) {
    st.S().chatPending = { need: 'category', draft: t };
    push('lk', `${fmt(t.amount)}, ¿en qué fue, mi llave?`, { chips: groupChips() });
    return;
  }
  push('lk', pick(['¿Lo anoto así?', 'Ajá, ¿así?', 'Mira a ver si quedó bien:']));
  push('lk', '', { draft: t, status: 'pending' });
}
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function respond(text) {
  const S = st.S();
  push('me', text);
  const pending = S.chatPending;
  // Las fichas de categoría vienen con emoji: quítalo para entenderlas
  const r = parse(text.replace(/^\p{Extended_Pictographic}️?\s*/u, ''), { pending });
  if (pending && !['fill', 'cancel_pending'].includes(r.intent)) S.chatPending = null;

  switch (r.intent) {
    case 'fill': {
      const d = { ...pending.draft };
      if (r.amount) d.amount = r.amount;
      if (r.category) { d.category = r.category; d.item = r.item || null; if (r.recurring) d.recurring = r.recurring; }
      S.chatPending = null;
      if (!d.amount) { S.chatPending = { need: 'amount', draft: d }; push('lk', '¿Y cuánto fue?'); break; }
      proposeTx(d, r.currency);
      break;
    }
    case 'cancel_pending': S.chatPending = null; push('lk', 'Listo, lo dejamos así.'); break;
    case 'ask': {
      S.chatPending = { need: r.need, draft: r.draft };
      if (r.need === 'amount') {
        const what = st.labelOf(r.draft) || r.draft.note || 'eso';
        push('lk', pick([`¿Cuánto fue ${what.toLowerCase() === 'eso' ? 'eso' : `lo de ${what.toLowerCase()}`}, mi llave?`, `Ajá, ${what.toLowerCase()}. ¿Cuánto fue?`]));
      } else {
        push('lk', `${fmt(r.draft.amount)}, ¿en qué fue, mi llave?`, { chips: groupChips() });
      }
      break;
    }
    case 'status': push('lk', L.statusText()); break;
    case 'advice': push('lk', L.adviceText()); break;
    case 'pending': push('lk', L.pendingText()); break;
    case 'goal': push('lk', L.goalText()); break;
    case 'broke': push('lk', L.brokeText()); break;
    case 'afford': push('lk', L.affordText(r.amount)); break;
    case 'top': push('lk', L.topText()); break;
    case 'spent_on': push('lk', L.spentOnText(r.category, r.item)); break;
    case 'balance': push('lk', L.balanceText(r.account)); break;
    case 'help': push('lk', B.answer('help')); break;
    case 'thanks': push('lk', pick(['De nada, mi llave. Aquí estoy.', 'Pa\' eso estamos, rey.', 'Eso va. Cualquier cosa me cuentas.'])); break;
    case 'greet': push('lk', `${L.greeting()} ¿Qué gastaste hoy o en qué te ayudo?`); break;
    case 'giro': openGiro(); push('lk', 'Ahí te abrí el reparto del mes.'); break;
    case 'undo': {
      const last = [...S.chat].reverse().find((m) => m.status === 'saved' && (m.txId || m.txIds));
      if (!last) { push('lk', 'No encuentro nada reciente que yo haya anotado.'); break; }
      (last.txIds || [last.txId]).forEach((id) => st.deleteTx(id));
      last.status = 'cancelled';
      push('lk', 'Listo, borrado. Como si nada.');
      break;
    }
    case 'multi': {
      const missing = r.txs.filter((t) => !t.category);
      push('lk', missing.length ? `Anoto ${r.txs.length} gastos. ${missing.length === 1 ? 'Uno quedó' : `${missing.length} quedaron`} sin categoría: si quieres, después lo cambias en Movimientos.` : `${r.txs.length} gastos de una. ¿Así?`);
      push('lk', '', { drafts: r.txs.map((t) => ({ ...t, category: t.category || 'imprevistos', item: t.category ? t.item : null })), status: 'pending' });
      break;
    }
    case 'tx': proposeTx(r.tx, r.currency); break;
    default: {
      const ans = B.answer(r.intent);
      if (ans) { push('lk', ans); break; }
      const sug = (r.alts || []).map((i) => B.SUGGEST_LABEL[i]).filter(Boolean);
      const chips = [...new Set([...sug, '¿En qué me ayudas?', '¿Cómo voy?', 'Tírala, ¿qué hago?'])].slice(0, 4);
      push('lk', `${pick(['Ombe, esa no la cogí bien.', 'Ajá, ¿y entonces? No te entendí.', 'Eche, me perdí.'])} ${sug.length ? '¿Quisiste decir alguna de estas?' : 'Dímelo de otra forma o toca una de estas:'}`, { chips });
    }
  }
  st.save();
}

export function bind(root) {
  const log = $('#log', root);
  log.scrollTop = log.scrollHeight;
  const input = $('#msg', root);
  const after = () => { nav.refresh(); setTimeout(() => { const l = document.getElementById('log'); if (l) l.scrollTop = l.scrollHeight; document.getElementById('msg')?.focus(); }, 0); };
  const send = () => {
    const v = input.value.trim();
    if (!v) return;
    input.value = '';
    respond(v);
    after();
  };
  $('#send', root).addEventListener('click', send);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(120, input.scrollHeight) + 'px'; });

  root.addEventListener('click', (e) => {
    const say = e.target.closest('[data-say]');
    if (say) { respond(say.dataset.say); after(); return; }
    const S = st.S();
    const find = (id) => S.chat.find((m) => m.id === id);
    const ok = e.target.closest('[data-ok]');
    if (ok) {
      const m = find(ok.dataset.ok);
      const list = m.drafts || [m.draft];
      const saved = list.map((d) => { const { _currency, ...clean } = d; return st.addTx(clean); });
      m.status = 'saved';
      if (m.drafts) m.txIds = saved.map((t) => t.id); else m.txId = saved[0].id;
      push('lk', list.length > 1 ? `${L.phrase('logged')} ${list.length} gastos por ${fmt(list.reduce((s, t) => s + t.amount, 0))}.` : L.reactTo(saved[0]));
      after();
      return;
    }
    const no = e.target.closest('[data-no]');
    if (no) { find(no.dataset.no).status = 'cancelled'; push('lk', 'Listo, no lo anoto.'); after(); return; }
    const ed = e.target.closest('[data-edit]');
    if (ed) {
      const m = find(ed.dataset.edit);
      m.status = 'cancelled';
      st.save();
      const { _currency, ...d } = m.draft;
      openTxForm(null, d);
      return;
    }
    if (e.target.closest('[data-clear]')) { S.chat = []; S.chatPending = null; st.save(); nav.refresh(); }
  });
}
