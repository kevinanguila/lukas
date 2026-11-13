// Primera vez: saludo, PIN, desde cuándo arrancamos, saldos, bolsillos de NU y lo ya pagado.
import * as st from '../store.js';
import { fmt, formatInput, inputToNumber } from '../money.js';
import { periodLabel, fmtDate, addDays, parseISO, iso } from '../dates.js';
import { esc, $, $$, bindAmountInputs, toast, icon } from '../ui.js';
import { pinScreen } from '../pin.js';

export function startOnboarding(done) {
  const S = st.S();
  const app = document.getElementById('app');
  const p = st.currentPeriod();
  const dayBefore = iso(addDays(parseISO(p.start), -1));
  const data = {
    mode: 'payday', // 'payday': desde el último pago · 'today': desde hoy
    bal: { nu: 0, nequi: 0, bancolombia: 0, arq: 0 },
    pockets: {},
    target: 0,
    paid: {},
    dispSpent: 0,
  };
  let step = 0;
  const flow = () => (data.mode === 'payday' ? [0, 1, 2, 3, 5] : [0, 1, 2, 3, 4, 5]);
  const next = () => { const f = flow(); step = f[f.indexOf(step) + 1]; draw(); };
  const back = () => { const f = flow(); step = f[f.indexOf(step) - 1]; draw(); };
  const steps = () => { const f = flow(); const n = f.indexOf(step); return `<div class="steps">${f.slice(1).map((_, i) => `<span class="${i < n ? 'on' : ''}"></span>`).join('')}</div>`; };
  const nav2 = (label = 'Seguir') => `<div class="row" style="gap:8px"><button class="btn btn-secondary" id="back" aria-label="Atrás">${icon('back', 18)}</button><button class="btn btn-primary grow" id="next">${label}</button></div>`;

  const draw = () => {
    if (step === 0) {
      app.innerHTML = `
      <section class="ob">
        <div class="grow">
          <div class="avatar" style="width:64px;height:64px;font-size:30px;margin-bottom:24px">L</div>
          <h1>¡Habla, rey!<br>Soy Lukas.</h1>
          <p class="muted" style="font-size:19px;line-height:1.4">Tu llave pa' la plata. Me cuentas todo como a un amigo y yo llevo las cuentas, te recuerdo los pagos y te la tiro plena cuando toque.</p>
          <article class="card mt24 stack gap12">
            <div class="row"><div class="emoji">💬</div><div class="small"><strong>Cuéntame:</strong> «almuerzo 20 lucas» y queda anotado.</div></div>
            <div class="row"><div class="emoji">✅</div><div class="small"><strong>Checklist:</strong> tus compromisos del mes, con recordatorios.</div></div>
            <div class="row"><div class="emoji">💰</div><div class="small"><strong>¡Yaca!:</strong> el día de pago te armo el reparto por banco.</div></div>
            <div class="row"><div class="emoji">🔒</div><div class="small"><strong>Privado:</strong> todo se queda en tu cel. Sin cuentas, sin servidores.</div></div>
          </article>
        </div>
        <button class="btn btn-primary btn-block mt24" id="next">Arrancar</button>
      </section>`;
      $('#next').addEventListener('click', () => {
        pinScreen({ mode: 'create', subtitle: '4 dígitos para que nadie más vea tu plata.', onDone: () => { step = 1; draw(); } });
      });
    }

    if (step === 1) {
      const opt = (id, title, text, rec) => `
        <button class="card stack gap4" data-mode="${id}" style="text-align:left;width:100%;border:2px solid ${data.mode === id ? 'var(--blue)' : 'transparent'};margin-top:12px">
          <strong>${title}${rec ? ' <span class="tag info">Recomendado</span>' : ''}</strong>
          <span class="small muted">${text}</span>
        </button>`;
      app.innerHTML = `
      <section class="ob">
        ${steps()}
        <div class="grow">
          <h1>¿Desde cuándo arrancamos?</h1>
          <p class="muted">Tu mes de ${periodLabel(p).toLowerCase()} va del ${fmtDate(p.start, { weekday: true })} (cuando te pagaron) al ${fmtDate(p.end)}.</p>
          ${opt('payday', `Desde el día de pago (${fmtDate(p.start)})`, `Me das los saldos que tenías el ${fmtDate(dayBefore)}, antes de que cayera la plata. Registras el pago y anotas todo lo de este mes. Más exacto.`, true)}
          ${opt('today', 'Desde hoy', 'Me das los saldos de hoy y marcas lo que ya pagaste. Más rápido, pero el resumen del mes queda aproximado.')}
        </div>
        ${nav2()}
      </section>`;
      $$('[data-mode]').forEach((b) => b.addEventListener('click', () => { data.mode = b.dataset.mode; draw(); }));
      $('#back').addEventListener('click', () => { step = 0; draw(); });
      $('#next').addEventListener('click', next);
    }

    if (step === 2) {
      const pd = data.mode === 'payday';
      app.innerHTML = `
      <section class="ob">
        ${steps()}
        <div class="grow">
          <h1>Tus saldos.</h1>
          <p class="muted">${pd ? `¿Cuánto tenías en cada cuenta el <strong>${fmtDate(dayBefore, { weekday: true })}</strong> en la noche, antes del pago? Si no lo tienes exacto, mira el extracto o los movimientos de cada app.` : 'Abre cada app y escribe cuánto tienes hoy.'}</p>
          ${['nu', 'nequi', 'bancolombia', 'arq'].map((id) => {
            const a = st.account(id);
            return `<div class="field mt8"><label><span class="dot" style="background:${a.color}"></span> ${esc(a.name)} · ${a.currency}</label><input inputmode="decimal" data-amount="${a.currency}" data-bal="${id}" value="${data.bal[id] ? formatInput(String(data.bal[id]).replace('.', ','), a.currency) : ''}" placeholder="0"/><div class="tiny muted">${esc(a.role)}</div></div>`;
          }).join('')}
        </div>
        ${nav2()}
      </section>`;
      bindAmountInputs(app);
      const read = () => $$('[data-bal]').forEach((i) => (data.bal[i.dataset.bal] = inputToNumber(i.value, st.account(i.dataset.bal).currency)));
      $('#back').addEventListener('click', () => { read(); back(); });
      $('#next').addEventListener('click', () => { read(); next(); });
    }

    if (step === 3) {
      const pd = data.mode === 'payday';
      const pks = S.pockets.filter((x) => x.account === 'nu');
      const sum = () => Object.values(data.pockets).reduce((a, b) => a + (b || 0), 0);
      app.innerHTML = `
      <section class="ob">
        ${steps()}
        <div class="grow">
          <h1>Lo que ya tenías guardado.</h1>
          <p class="muted">De los ${fmt(data.bal.nu)} en NU, ¿cuánto ya estaba apartado ${pd ? 'antes del pago' : 'hoy'}? ${pd ? 'Lo que pongas del pago de este mes lo repartimos después, en el ¡Yaca!' : ''}</p>
          ${pks.map((x) => `<div class="field mt8"><label>${x.emoji} ${esc(x.name)}</label><input inputmode="numeric" data-amount="COP" data-pk="${x.id}" value="${data.pockets[x.id] ? formatInput(String(data.pockets[x.id])) : ''}" placeholder="0"/><div class="tiny muted">${esc(x.note || '')}</div></div>`).join('')}
          <article class="card mt12" style="padding:16px 20px"><div class="row between"><span>Libre en NU</span><strong class="num" id="free">${fmt(data.bal.nu - sum())}</strong></div></article>
          <div class="field mt16"><label>📦 Meta de la mudanza (opcional)</label><input inputmode="numeric" data-amount="COP" id="target" value="${data.target ? formatInput(String(data.target)) : ''}" placeholder="Si no sabes todavía, déjalo en blanco"/><div class="tiny muted">Para el 15 de enero de 2027 · Itagüí o Envigado</div></div>
        </div>
        ${nav2()}
      </section>`;
      bindAmountInputs(app);
      const read = () => { $$('[data-pk]').forEach((i) => (data.pockets[i.dataset.pk] = inputToNumber(i.value))); data.target = inputToNumber($('#target').value); };
      $$('[data-pk]').forEach((i) => i.addEventListener('input', () => { read(); const f = data.bal.nu - sum(); $('#free').textContent = fmt(f); $('#free').style.color = f < 0 ? 'var(--ring-orange)' : ''; }));
      $('#back').addEventListener('click', () => { read(); back(); });
      $('#next').addEventListener('click', () => {
        read();
        if (data.bal.nu - sum() < 0) { toast('Los bolsillos suman más de lo que hay en NU.'); return; }
        if (data.mode === 'payday') finish();
        next();
      });
    }

    if (step === 4) {
      const rec = S.recurring.filter((r) => r.active);
      app.innerHTML = `
      <section class="ob">
        ${steps()}
        <div class="grow">
          <h1>${periodLabel(p)}.</h1>
          <p class="muted">¿Qué compromisos ya pagaste este mes? Márcalos y no te los vuelvo a cobrar.</p>
          <article class="card tight mt12"><ul class="list">
            ${rec.map((r) => `<li class="li"><button class="check ${data.paid[r.id] ? 'on' : ''}" data-paid="${r.id}">${icon('check', 16)}</button><div class="grow"><div>${esc(r.name)}</div><div class="tiny muted">${esc(st.account(r.account)?.name)}${r.day ? ` · día ${r.day}` : ''}</div></div><span class="amount">${fmt(r.amount)}</span></li>`).join('')}
          </ul></article>
          <div class="field mt16"><label>🟢 ¿Cuánto llevas gastado del Disponible este mes?</label><input inputmode="numeric" data-amount="COP" id="disp" value="${data.dispSpent ? formatInput(String(data.dispSpent)) : ''}" placeholder="0"/><div class="tiny muted">Gustos, comida afuera, salidas… desde el ${fmtDate(p.start)}. Un aproximado sirve.</div></div>
        </div>
        ${nav2()}
      </section>`;
      bindAmountInputs(app);
      $$('[data-paid]').forEach((b) => b.addEventListener('click', () => { data.paid[b.dataset.paid] = !data.paid[b.dataset.paid]; b.classList.toggle('on'); }));
      const read = () => { data.dispSpent = inputToNumber($('#disp').value); };
      $('#back').addEventListener('click', () => { read(); back(); });
      $('#next').addEventListener('click', () => { read(); finish(); next(); });
    }

    if (step === 5) {
      const pd = data.mode === 'payday';
      app.innerHTML = `
      <section class="ob">
        <div class="grow">
          <h1>¡Ya salimos de una!</h1>
          <p class="muted" style="font-size:19px">${pd ? `Ahora registra el pago del ${fmtDate(p.start)} y después anota lo que has gastado desde ese día. Tranquilo, se puede hablando: «el 2 almuerzo 20 lucas», «ayer tanqueé 80 mil».` : 'Todo listo, mi llave.'}</p>
          <article class="card mt16 stack gap12">
            ${pd ? `<div class="row" style="align-items:flex-start"><div class="emoji">🗓️</div><div class="small"><strong>Pagos con fecha.</strong> En el checklist, mantén presionado un compromiso para ponerle el día real en que lo pagaste.</div></div>` : ''}
            <div class="row" style="align-items:flex-start"><div class="emoji">💾</div><div class="small"><strong>Haz copias.</strong> Tus datos viven solo en este cel. Cada semana te recuerdo guardar una copia en iCloud Drive.</div></div>
            <div class="row" style="align-items:flex-start"><div class="emoji">📅</div><div class="small"><strong>Recordatorios.</strong> En Plan › Compromisos toca «Al Calendario» y tu iPhone te avisa cada vencimiento.</div></div>
          </article>
        </div>
        <button class="btn btn-primary btn-block mt24" id="go">${pd ? `Registrar el pago de ${periodLabel(p).split(' ')[0].toLowerCase()}` : 'Entrar'}</button>
      </section>`;
      $('#go').addEventListener('click', () => done(pd ? { payday: { date: p.start } } : {}));
    }
  };

  const finish = () => {
    for (const [id, v] of Object.entries(data.bal)) st.account(id).initial = v;
    const date = data.mode === 'payday' ? dayBefore : undefined;
    for (const [pid, v] of Object.entries(data.pockets)) if (v > 0) st.addTx({ type: 'alloc', pocket: pid, amount: v, ...(date ? { date } : {}), note: 'Saldo inicial', initial: true });
    const main = S.pockets.find((x) => x.main);
    if (main && data.target) main.target = data.target;
    if (data.mode === 'today') {
      // Cuenta para el mes, pero no mueve saldos (los saldos de hoy ya son los reales)
      for (const [rid, on] of Object.entries(data.paid)) {
        if (!on) continue;
        const r = st.recurringItem(rid);
        st.addTx({ type: 'expense', amount: r.amount, account: r.account, category: r.category, item: r.item, recurring: r.id, note: r.name, historic: true });
      }
      if (data.dispSpent) st.addTx({ type: 'expense', amount: data.dispSpent, account: 'nequi', category: 'comida', item: 'antojos', note: 'Gastos del Disponible antes de Lukas', historic: true });
    }
    S.onboarded = true;
    S.settings.lastSeenPeriod = p.key;
    st.save();
  };

  draw();
}
