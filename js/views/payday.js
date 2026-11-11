// Día de pago: ¡Yaca! Registra lo de Deel, calcula tasa y spread, mueve sobrantes y arma el reparto.
import * as st from '../store.js';
import { nav } from '../nav.js';
import { fmt, fmtShort, formatInput, inputToNumber } from '../money.js';
import { todayISO, periodLabel, prevPeriod, fmtDate } from '../dates.js';
import { esc, sheet, $, $$, toast, bindAmountInputs, icon } from '../ui.js';
import { phrase } from '../lukas.js';
import { fetchTRM } from '../trm.js';

export function openPayday() {
  const S = st.S();
  const p = st.currentPeriod();
  if (st.paydayDone(p)) return openGiro();

  const tpl = S.planTemplate;
  const data = {
    date: todayISO() < p.start ? p.start : todayISO() > p.end ? p.end : todayISO() === p.start ? p.start : todayISO(),
    usd: S.settings.monthlyUSD,
    arqUSD: tpl.arqUSD || 0,
    arqGot: tpl.arqUSD ? Math.max(0, tpl.arqUSD - 3) : 0,
    cop: 0,
    trm: null,
    leftovers: {},
    giro: 0,
    pockets: { ...tpl.pockets },
  };
  if (data.date > todayISO()) data.date = todayISO();
  let step = 1;
  const s = sheet('', { tall: true });

  const nequiNeed = () => st.commitmentsFor('nequi') + S.settings.disponible;
  const capsNU = () => S.categories.filter((c) => c.block === 'gastos' && c.cap && (c.account || 'nu') === 'nu').reduce((a, c) => a + c.cap, 0);
  const capsOther = () => S.categories.filter((c) => c.block === 'gastos' && c.cap && c.account === 'nequi').reduce((a, c) => a + c.cap, 0);
  const main = () => S.pockets.find((x) => x.main && !x.archived);
  const others = () => S.pockets.filter((x) => !x.main && !x.archived && x.account === 'nu');
  const compNU = () => st.commitmentsFor('nu');
  const absorber = () => data.cop - data.giro - capsNU() - compNU() - Object.entries(data.pockets).reduce((a, [pid, v]) => a + (st.pocket(pid) && !st.pocket(pid).archived && !st.pocket(pid).main ? v : 0), 0);

  // Sobrantes del periodo anterior: bolsillos que se renuevan cada mes
  const prev = prevPeriod(p);
  const leftovers = S.pockets.filter((x) => x.periodic && !x.archived && st.pocketBalance(x.id) > 0).map((x) => ({ x, v: st.pocketBalance(x.id) }));
  leftovers.forEach(({ x, v }) => (data.leftovers[x.id] = true));

  const stepsBar = (n) => `<div class="steps">${[1, 2, 3].map((i) => `<span class="${i <= n ? 'on' : ''}"></span>`).join('')}</div>`;

  const draw = () => {
    if (step === 1) {
      const toNU = data.usd - data.arqUSD;
      const rate = data.cop && toNU ? data.cop / toNU : 0;
      const lost = data.trm && rate ? toNU * data.trm - data.cop : 0;
      s.set(`
        <div class="sheet-head"><button class="btn btn-ghost btn-sm" data-close>Cerrar</button><strong>${periodLabel(p)}</strong><span style="width:70px"></span></div>
        ${stepsBar(1)}
        <h1>${esc(phrase('payday'))}</h1>
        <p class="muted" style="margin:6px 4px 16px">Cuéntame qué llegó de Deel. Tu pago de ${periodLabel(p).toLowerCase()} cae el ${fmtDate(p.start, { weekday: true })}.</p>
        <div class="field"><label>Te pagaron (USD)</label><input inputmode="decimal" data-amount="USD" id="usd" value="${formatInput(String(data.usd), 'USD')}"/></div>
        <div class="field-row mt8">
          <div class="field"><label>A ARQ (USD)</label><input inputmode="decimal" data-amount="USD" id="arq" value="${data.arqUSD ? formatInput(String(data.arqUSD).replace('.', ','), 'USD') : ''}" placeholder="0"/></div>
          <div class="field"><label>A NU (USD)</label><input disabled value="${formatInput(String(toNU).replace('.', ','), 'USD')}" id="tonu"/></div>
        </div>
        <div class="field mt8"><label>Lo que llegó a NU (COP)</label><input inputmode="numeric" data-amount="COP" id="cop" value="${data.cop ? formatInput(String(data.cop)) : ''}" placeholder="Ej: 5.000.000"/></div>
        <div class="field mt8 ${data.arqUSD ? '' : 'hidden'}" id="arqgotwrap"><label>Lo que llegó a ARQ (USD, después de comisión)</label><input inputmode="decimal" data-amount="USD" id="arqgot" value="${data.arqGot ? formatInput(String(data.arqGot).replace('.', ','), 'USD') : ''}"/></div>
        <div class="field-row mt8">
          <div class="field"><label>Fecha</label><input type="date" id="date" value="${data.date}"/></div>
          <div class="field"><label>TRM del día</label><div class="row" style="gap:6px"><input inputmode="decimal" id="trm" value="${data.trm ? formatInput(String(data.trm).replace('.', ','), 'USD') : ''}" placeholder="Buscando…" data-amount="USD"/><button class="muted" id="retrm" aria-label="Buscar TRM">${icon('refresh', 18)}</button></div></div>
        </div>
        <article class="card mt12" style="padding:16px 20px">
          <div class="row between small"><span class="muted">Tasa que te dio Deel</span><strong class="num" id="rate">${rate ? fmt(rate) : '—'}</strong></div>
          <div class="row between small mt8"><span class="muted">Se quedó Deel (spread)</span><strong class="num" id="lost">${lost > 0 ? `${fmt(lost)} · ${((lost / (toNU * data.trm)) * 100).toFixed(1)} %` : '—'}</strong></div>
        </article>
        <button class="btn btn-primary btn-block mt16" id="next">Seguir</button>`);
      bindAmountInputs(s.el);
      const recalc = () => {
        data.usd = inputToNumber($('#usd', s.el).value, 'USD');
        data.arqUSD = inputToNumber($('#arq', s.el).value, 'USD');
        data.cop = inputToNumber($('#cop', s.el).value);
        data.arqGot = inputToNumber($('#arqgot', s.el).value, 'USD');
        data.trm = inputToNumber($('#trm', s.el).value, 'USD') || null;
        data.date = $('#date', s.el).value || todayISO();
        const toNU2 = data.usd - data.arqUSD;
        $('#tonu', s.el).value = formatInput(String(toNU2).replace('.', ','), 'USD');
        $('#arqgotwrap', s.el).classList.toggle('hidden', !data.arqUSD);
        const r = data.cop && toNU2 ? data.cop / toNU2 : 0;
        $('#rate', s.el).textContent = r ? fmt(r) : '—';
        const l = data.trm && r ? toNU2 * data.trm - data.cop : 0;
        $('#lost', s.el).textContent = l > 0 ? `${fmt(l)} · ${((l / (toNU2 * data.trm)) * 100).toFixed(1)} %` : '—';
      };
      $$('input', s.el).forEach((i) => i.addEventListener('input', recalc));
      $('#date', s.el).addEventListener('change', () => { recalc(); loadTRM(); });
      $('#arq', s.el).addEventListener('change', () => { if (data.arqUSD && !data.arqGot) { data.arqGot = Math.max(0, data.arqUSD - 3); $('#arqgot', s.el).value = formatInput(String(data.arqGot).replace('.', ','), 'USD'); } });
      const loadTRM = async () => {
        const inp = $('#trm', s.el);
        inp.placeholder = 'Buscando…';
        const v = await fetchTRM(data.date);
        if (v && document.body.contains(inp)) { data.trm = v; inp.value = formatInput(String(v.toFixed(2)).replace('.', ','), 'USD'); recalc(); }
        else if (document.body.contains(inp)) inp.placeholder = 'Escríbela';
      };
      $('#retrm', s.el).addEventListener('click', loadTRM);
      if (!data.trm) loadTRM();
      $('#next', s.el).addEventListener('click', () => {
        recalc();
        if (!data.cop && data.usd - data.arqUSD > 0) { toast('Escribe cuánto llegó a NU en pesos.'); return; }
        if (!data.giro) data.giro = nequiNeed();
        step = leftovers.length ? 2 : 3;
        draw();
      });
    }

    if (step === 2) {
      const m = main();
      s.set(`
        <div class="sheet-head"><button class="btn btn-ghost btn-sm" data-back>${icon('back', 18)} Atrás</button><strong>Sobrantes</strong><span style="width:70px"></span></div>
        ${stepsBar(2)}
        <h1>Lo que sobró.</h1>
        <p class="muted" style="margin:6px 4px 16px">Del mes pasado quedó plata en estos bolsillos. ${m ? `Te propongo mandarla a ${m.emoji} ${esc(m.name)}.` : ''} Tú decides.</p>
        <article class="card tight"><ul class="list">
          ${leftovers.map(({ x, v }) => `<li class="li"><div class="emoji">${x.emoji}</div><div class="grow"><div>${esc(x.name)}</div><div class="tiny muted">Sobraron ${fmt(v)}</div></div><label class="switch"><input type="checkbox" data-left="${x.id}" ${data.leftovers[x.id] ? 'checked' : ''}/><span></span></label></li>`).join('')}
        </ul></article>
        <p class="tiny muted" style="margin:8px 12px">Encendido = se mueve a ${m ? esc(m.name) : 'la meta principal'}. Apagado = se queda donde está.</p>
        <button class="btn btn-primary btn-block mt16" id="next">Seguir</button>`);
      $$('[data-left]', s.el).forEach((i) => i.addEventListener('change', () => (data.leftovers[i.dataset.left] = i.checked)));
      $('[data-back]', s.el).addEventListener('click', () => { step = 1; draw(); });
      $('#next', s.el).addEventListener('click', () => { step = 3; draw(); });
    }

    if (step === 3) {
      const m = main();
      const nequiNow = st.balance('nequi');
      const rest = absorber();
      s.set(`
        <div class="sheet-head"><button class="btn btn-ghost btn-sm" data-back>${icon('back', 18)} Atrás</button><strong>Reparto</strong><span style="width:70px"></span></div>
        ${stepsBar(3)}
        <h1>El reparto.</h1>
        <p class="muted" style="margin:6px 4px 16px">De los ${fmt(data.cop)} que llegaron a NU. Organizado por banco, como te gusta.</p>

        <div class="section-title" style="margin-top:8px"><h2><span class="dot" style="background:#00a1b3"></span> A Nequi.</h2></div>
        <article class="card">
          <div class="row between small"><span class="muted">Compromisos por Nequi</span><span class="num">${fmt(st.commitmentsFor('nequi'))}</span></div>
          <div class="row between small mt8"><span class="muted">Disponible</span><span class="num">${fmt(S.settings.disponible)}</span></div>
          <div class="field mt12" style="background:var(--fog)"><label>Giro único NU → Nequi</label><input inputmode="numeric" data-amount="COP" id="giro" value="${formatInput(String(data.giro))}"/></div>
          ${nequiNow > 0 ? `<button class="link mt8" id="minusNequi">Nequi ya tiene ${fmt(nequiNow)}: restarlo del giro</button>` : ''}
        </article>

        <div class="section-title"><h2><span class="dot" style="background:#8668ff"></span> Se queda en NU.</h2></div>
        <article class="card">
          ${compNU() ? `<div class="row between small"><span class="muted">Compromisos desde NU</span><span class="num">${fmt(compNU())}</span></div>` : ''}
          <div class="row between small ${compNU() ? 'mt8' : ''}"><span class="muted">Gastos con tope (gasolina, lavada, mercado, imprevistos)</span><span class="num">${fmt(capsNU())}</span></div>
          ${others().map((x) => `<div class="field mt8" style="background:var(--fog)"><label>${x.emoji} ${esc(x.name)}${x.target ? ` · meta ${fmtShort(x.target)}, lleva ${fmtShort(st.pocketBalance(x.id))}` : ''}</label><input inputmode="numeric" data-amount="COP" data-pk="${x.id}" value="${data.pockets[x.id] ? formatInput(String(data.pockets[x.id])) : ''}" placeholder="0"/></div>`).join('')}
          ${m ? `<div class="row between mt12" style="padding-top:10px;border-top:1px solid var(--pebble)"><span><strong>${m.emoji} ${esc(m.name)}</strong><br><span class="tiny muted">Recibe lo que quede</span></span><strong class="num h3" id="rest" style="color:${rest < 0 ? 'var(--ring-orange)' : 'var(--ink)'}">${fmt(rest)}</strong></div>` : ''}
        </article>

        ${data.arqUSD ? `<div class="section-title"><h2><span class="dot" style="background:#03aa49"></span> En ARQ.</h2></div><article class="card"><div class="row between"><span>Ahorro en dólares</span><strong class="num">${fmt(data.arqGot || data.arqUSD, 'USD')}</strong></div></article>` : ''}

        <p class="small muted" id="warn" style="margin:12px 8px">${rest < 0 ? `${esc(phrase('warn'))} Te pasaste ${fmt(-rest)}: baja algún bolsillo o el giro.` : ''}</p>
        <button class="btn btn-primary btn-block mt8" id="ok">Listo, guardar el reparto</button>`);
      bindAmountInputs(s.el);
      const recalc = () => {
        data.giro = inputToNumber($('#giro', s.el).value);
        $$('[data-pk]', s.el).forEach((i) => (data.pockets[i.dataset.pk] = inputToNumber(i.value)));
        const r = absorber();
        const el = $('#rest', s.el);
        if (el) { el.textContent = fmt(r); el.style.color = r < 0 ? 'var(--ring-orange)' : 'var(--ink)'; }
        $('#warn', s.el).textContent = r < 0 ? `${phrase('warn')} Te pasaste ${fmt(-r)}: baja algún bolsillo o el giro.` : '';
      };
      $$('input', s.el).forEach((i) => i.addEventListener('input', recalc));
      $('#minusNequi', s.el)?.addEventListener('click', () => { data.giro = Math.max(0, data.giro - nequiNow); $('#giro', s.el).value = formatInput(String(data.giro)); recalc(); });
      $('[data-back]', s.el).addEventListener('click', () => { recalc(); step = leftovers.length ? 2 : 1; draw(); });
      $('#ok', s.el).addEventListener('click', () => {
        recalc();
        if (absorber() < 0) { toast('El reparto no cuadra todavía.'); return; }
        commit();
        s.close();
        openGiro(true);
      });
    }
  };

  const commit = () => {
    const toNU = data.usd - data.arqUSD;
    const rate = data.cop && toNU ? data.cop / toNU : null;
    const pid = st.uid('pay');
    if (data.cop) st.addTx({ type: 'income', amount: data.cop, account: 'nu', category: 'sueldo', date: data.date, note: `Pago Deel ${periodLabel(p)}`, usd: toNU, rate, trm: data.trm, payday: pid });
    if (data.arqUSD) st.addTx({ type: 'income', amount: data.arqGot || data.arqUSD, account: 'arq', category: 'sueldo', date: data.date, note: `Pago Deel ${periodLabel(p)} (directo a ARQ)`, usd: data.arqUSD, rate: rate || st.usdRate(), trm: data.trm, fee: data.arqUSD - (data.arqGot || data.arqUSD), payday: pid });
    const m = main();
    // Sobrantes → meta principal
    for (const [id, on] of Object.entries(data.leftovers)) {
      const v = st.pocketBalance(id);
      if (on && m && v > 0) st.addTx({ type: 'alloc', pocket: m.id, fromPocket: id, amount: v, date: data.date, note: 'Sobrante del mes pasado' });
    }
    // Bolsillos
    for (const [id, v] of Object.entries(data.pockets)) {
      const x = st.pocket(id);
      if (v > 0 && x && !x.archived && !x.main) st.addTx({ type: 'alloc', pocket: id, amount: v, date: data.date, savings: !!x.target, note: 'Reparto del pago' });
    }
    const rest = absorber();
    if (m && rest > 0) st.addTx({ type: 'alloc', pocket: m.id, amount: rest, date: data.date, savings: true, note: 'Reparto del pago' });
    S.plans[p.key] = { giroNequi: data.giro, pockets: { ...data.pockets, ...(m ? { [m.id]: Math.max(0, rest) } : {}) }, arqUSD: data.arqUSD, incomeCOP: data.cop, steps: { giro: data.giro === 0 } };
    S.planTemplate = { arqUSD: data.arqUSD, pockets: Object.fromEntries(Object.entries(data.pockets).filter(([id]) => st.pocket(id) && !st.pocket(id).main)) };
    S.settings.monthlyUSD = data.usd;
    if (rate) S.settings.fallbackRate = Math.round(rate);
    st.save();
  };

  draw();
}

// Checklist de transferencias del reparto
export function openGiro(fresh = false) {
  const S = st.S();
  const p = st.currentPeriod();
  const plan = S.plans[p.key];
  if (!plan) { toast('Ya registraste el pago de este mes.'); return; }
  const done = plan.steps?.giro;
  const s = sheet(`
    <h1 style="margin:8px 4px">${fresh ? esc(phrase('good')) : 'El reparto.'}</h1>
    <p class="muted" style="margin:6px 4px 16px">${fresh ? 'Reparto guardado. Los bolsillos de NU ya quedaron apartados. Te falta una sola transferencia:' : 'Transferencias del mes:'}</p>
    <article class="card tight"><ul class="list">
      <li class="li ${done ? 'done' : ''}"><button class="check ${done ? 'on' : ''}" id="g">${icon('check', 16)}</button><div class="grow"><div class="ttl">Giro NU → Nequi</div><div class="tiny muted">Por Bre-B, gratis e inmediato</div></div><span class="amount">${fmt(plan.giroNequi)}</span></li>
      ${plan.arqUSD ? `<li class="li done"><span class="check on">${icon('check', 16)}</span><div class="grow"><div class="ttl">Deel → ARQ</div><div class="tiny muted">Ya registrado</div></div><span class="amount">${fmt(plan.arqUSD, 'USD')}</span></li>` : ''}
    </ul></article>
    <button class="btn btn-secondary btn-block mt16" data-close>Cerrar</button>`);
  $('#g', s.el).addEventListener('click', () => {
    if (plan.steps.giro) {
      const tx = S.transactions.find((t) => t.id === plan.steps.giroTx);
      if (tx) st.deleteTx(tx.id);
      plan.steps.giro = false; plan.steps.giroTx = null;
    } else {
      const tx = st.addTx({ type: 'transfer', amount: plan.giroNequi, account: 'nu', toAccount: 'nequi', toAmount: plan.giroNequi, note: 'Giro del mes' });
      plan.steps.giro = true; plan.steps.giroTx = tx.id;
      toast(phrase('paid'));
    }
    st.save();
    s.close();
    nav.refresh();
  });
  nav.refresh();
}
