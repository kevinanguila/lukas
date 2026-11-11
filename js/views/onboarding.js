// Primera vez: saludo, PIN, saldos reales, bolsillos de NU y lo que ya pagaste este mes.
import * as st from '../store.js';
import { fmt, formatInput, inputToNumber } from '../money.js';
import { periodLabel, fmtDate, todayISO } from '../dates.js';
import { esc, $, $$, bindAmountInputs, toast, icon } from '../ui.js';
import { pinScreen } from '../pin.js';
import { NOV_2026 } from '../seed.js';

export function startOnboarding(done) {
  const S = st.S();
  const app = document.getElementById('app');
  const p = st.currentPeriod();
  const isNov = p.key === '2026-11';
  const data = {
    bal: { nu: 0, nequi: 0, bancolombia: 0, arq: 0 },
    pockets: isNov ? { ...NOV_2026.pockets } : {},
    target: 0,
    paid: {},
    dispSpent: 0,
    incomeDone: isNov,
  };
  let step = 0;
  const total = 5;
  const steps = (n) => `<div class="steps">${Array.from({ length: total }, (_, i) => `<span class="${i < n ? 'on' : ''}"></span>`).join('')}</div>`;

  const draw = () => {
    if (step === 0) {
      app.innerHTML = `
      <section class="ob">
        <div class="grow">
          <div class="avatar" style="width:64px;height:64px;font-size:30px;margin-bottom:24px">L</div>
          <h1>¡Habla, rey!<br>Soy Lukas.</h1>
          <p class="muted" style="font-size:19px;line-height:1.4">Tu llave pa' la plata. Me cuentas todo como a un amigo y yo llevo las cuentas, te recuerdo los pagos y te la tiro plena cuando toque.</p>
          <article class="card mt24 stack gap12">
            <div class="row"><div class="emoji">💬</div><div class="small"><strong>Cuéntame:</strong> «gasté 25 lucas en almuerzo» y queda anotado.</div></div>
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
      app.innerHTML = `
      <section class="ob">
        ${steps(1)}
        <div class="grow">
          <h1>Tus saldos.</h1>
          <p class="muted">Abre cada app y escribe cuánto tienes hoy. Con esto arranco.</p>
          ${['nu', 'nequi', 'bancolombia', 'arq'].map((id) => {
            const a = st.account(id);
            return `<div class="field mt8"><label><span class="dot" style="background:${a.color}"></span> ${esc(a.name)} · ${a.currency}</label><input inputmode="decimal" data-amount="${a.currency}" data-bal="${id}" value="${data.bal[id] ? formatInput(String(data.bal[id]).replace('.', ','), a.currency) : ''}" placeholder="0"/><div class="tiny muted">${esc(a.role)}</div></div>`;
          }).join('')}
        </div>
        <button class="btn btn-primary btn-block mt24" id="next">Seguir</button>
      </section>`;
      bindAmountInputs(app);
      $('#next').addEventListener('click', () => {
        $$('[data-bal]').forEach((i) => (data.bal[i.dataset.bal] = inputToNumber(i.value, st.account(i.dataset.bal).currency)));
        step = 2; draw();
      });
    }

    if (step === 2) {
      const pks = S.pockets.filter((x) => x.account === 'nu');
      const sum = () => Object.values(data.pockets).reduce((a, b) => a + (b || 0), 0);
      app.innerHTML = `
      <section class="ob">
        ${steps(2)}
        <div class="grow">
          <h1>Lo que hay en NU.</h1>
          <p class="muted">Tienes ${fmt(data.bal.nu)} en NU. ¿De quién es cada peso? Puse lo que planeaste para noviembre; ajústalo a lo que hay de verdad.</p>
          ${pks.map((x) => `<div class="field mt8"><label>${x.emoji} ${esc(x.name)}</label><input inputmode="numeric" data-amount="COP" data-pk="${x.id}" value="${data.pockets[x.id] ? formatInput(String(data.pockets[x.id])) : ''}" placeholder="0"/><div class="tiny muted">${esc(x.note || '')}</div></div>`).join('')}
          <article class="card mt12" style="padding:16px 20px"><div class="row between"><span>Libre en NU</span><strong class="num" id="free">${fmt(data.bal.nu - sum())}</strong></div><p class="tiny muted" style="margin:4px 0 0">Para gasolina, lavada, mercado e imprevistos del mes.</p></article>
          <div class="field mt16"><label>📦 Meta de la mudanza (opcional)</label><input inputmode="numeric" data-amount="COP" id="target" value="${data.target ? formatInput(String(data.target)) : ''}" placeholder="Si no sabes todavía, déjalo en blanco"/><div class="tiny muted">Para el 15 de enero de 2027 · Itagüí o Envigado</div></div>
        </div>
        <div class="row" style="gap:8px"><button class="btn btn-secondary" id="back">${icon('back', 18)}</button><button class="btn btn-primary grow" id="next">Seguir</button></div>
      </section>`;
      bindAmountInputs(app);
      const read = () => { $$('[data-pk]').forEach((i) => (data.pockets[i.dataset.pk] = inputToNumber(i.value))); data.target = inputToNumber($('#target').value); };
      $$('[data-pk]').forEach((i) => i.addEventListener('input', () => { read(); const f = data.bal.nu - sum(); $('#free').textContent = fmt(f); $('#free').style.color = f < 0 ? 'var(--ring-orange)' : ''; }));
      $('#back').addEventListener('click', () => { read(); step = 1; draw(); });
      $('#next').addEventListener('click', () => {
        read();
        if (data.bal.nu - sum() < 0) { toast('Los bolsillos suman más de lo que hay en NU.'); return; }
        step = 3; draw();
      });
    }

    if (step === 3) {
      const rec = S.recurring.filter((r) => r.active);
      app.innerHTML = `
      <section class="ob">
        ${steps(3)}
        <div class="grow">
          <h1>${periodLabel(p)}.</h1>
          <p class="muted">Tu mes va del ${fmtDate(p.start)} al ${fmtDate(p.end)}. ¿Qué compromisos ya pagaste? Márcalos y no te los vuelvo a cobrar.</p>
          <article class="card tight mt12"><ul class="list">
            ${rec.map((r) => `<li class="li"><button class="check ${data.paid[r.id] ? 'on' : ''}" data-paid="${r.id}">${icon('check', 16)}</button><div class="grow"><div>${esc(r.name)}</div><div class="tiny muted">${esc(st.account(r.account)?.name)}${r.day ? ` · día ${r.day}` : ''}</div></div><span class="amount">${fmt(r.amount)}</span></li>`).join('')}
          </ul></article>
          <div class="field mt16"><label>🟢 ¿Cuánto llevas gastado del Disponible este mes?</label><input inputmode="numeric" data-amount="COP" id="disp" value="${data.dispSpent ? formatInput(String(data.dispSpent)) : ''}" placeholder="0"/><div class="tiny muted">Gustos, comida afuera, salidas… desde el ${fmtDate(p.start)}. Un aproximado sirve.</div></div>
          ${isNov ? `<label class="field row between mt8"><span>Ya recibí el pago de noviembre<br><span class="tiny muted">US$1.630 → $5.000.000 el 30 oct</span></span><span class="switch"><input type="checkbox" id="inc" ${data.incomeDone ? 'checked' : ''}/><span></span></span></label>` : ''}
        </div>
        <div class="row" style="gap:8px"><button class="btn btn-secondary" id="back">${icon('back', 18)}</button><button class="btn btn-primary grow" id="next">Seguir</button></div>
      </section>`;
      bindAmountInputs(app);
      $$('[data-paid]').forEach((b) => b.addEventListener('click', () => { data.paid[b.dataset.paid] = !data.paid[b.dataset.paid]; b.classList.toggle('on'); }));
      const read = () => { data.dispSpent = inputToNumber($('#disp').value); if ($('#inc')) data.incomeDone = $('#inc').checked; };
      $('#back').addEventListener('click', () => { read(); step = 2; draw(); });
      $('#next').addEventListener('click', () => { read(); finish(); step = 4; draw(); });
    }

    if (step === 4) {
      app.innerHTML = `
      <section class="ob">
        ${steps(5)}
        <div class="grow">
          <h1>¡Ya salimos de una!</h1>
          <p class="muted" style="font-size:19px">Todo listo, mi llave. Dos cosas antes de arrancar:</p>
          <article class="card mt16 stack gap12">
            <div class="row" style="align-items:flex-start"><div class="emoji">📲</div><div class="small"><strong>Instálame.</strong> En Safari toca <strong>Compartir</strong> › <strong>Agregar a inicio</strong>. Así abro a pantalla completa como una app.</div></div>
            <div class="row" style="align-items:flex-start"><div class="emoji">💾</div><div class="small"><strong>Haz copias.</strong> Tus datos viven solo en este cel. Cada semana te voy a recordar guardar una copia en iCloud Drive.</div></div>
            <div class="row" style="align-items:flex-start"><div class="emoji">📅</div><div class="small"><strong>Recordatorios.</strong> En Plan › Compromisos toca «Al Calendario» y tu iPhone te avisa cada vencimiento.</div></div>
          </article>
        </div>
        <button class="btn btn-primary btn-block mt24" id="go">Entrar</button>
      </section>`;
      $('#go').addEventListener('click', done);
    }
  };

  const finish = () => {
    for (const [id, v] of Object.entries(data.bal)) st.account(id).initial = v;
    const date = todayISO();
    for (const [pid, v] of Object.entries(data.pockets)) if (v > 0) st.addTx({ type: 'alloc', pocket: pid, amount: v, date, note: 'Saldo inicial', initial: true });
    const main = S.pockets.find((x) => x.main);
    if (main && data.target) main.target = data.target;
    // Historial del periodo (cuenta para el mes, no mueve saldos: los saldos ya son los reales)
    for (const [rid, on] of Object.entries(data.paid)) {
      if (!on) continue;
      const r = st.recurringItem(rid);
      st.addTx({ type: 'expense', amount: r.amount, account: r.account, category: r.category, recurring: r.id, note: r.name, date, historic: true });
    }
    if (data.dispSpent) st.addTx({ type: 'expense', amount: data.dispSpent, account: 'nequi', category: 'antojos', note: 'Gastos del Disponible antes de Lukas', date, historic: true });
    if (isNov && data.incomeDone) {
      st.addTx({ type: 'income', amount: NOV_2026.income.cop, account: 'nu', category: 'sueldo', date: NOV_2026.income.date, note: 'Pago Deel noviembre', usd: NOV_2026.income.usd, rate: NOV_2026.income.cop / NOV_2026.income.usd, historic: true });
      S.plans[p.key] = { giroNequi: st.commitmentsFor('nequi') + S.settings.disponible, pockets: { ...NOV_2026.pockets }, arqUSD: 0, incomeCOP: NOV_2026.income.cop, steps: { giro: true } };
    }
    S.onboarded = true;
    S.settings.lastSeenPeriod = p.key;
    st.save();
  };

  draw();
}
