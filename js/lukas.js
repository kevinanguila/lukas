// Lukas: la personalidad, las frases barranquilleras y el motor de consejos (100 % local).
import * as st from './store.js';
import { fmt, fmtShort } from './money.js';
import { todayISO, daysBetween, payDate, parseISO, iso, fmtDate, periodFromKey, relDay } from './dates.js';

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
// Pick estable por día (para que el saludo no cambie en cada render)
const daily = (arr, salt = '') => {
  const seed = [...(todayISO() + salt)].reduce((s, c) => s + c.charCodeAt(0), 0);
  return arr[seed % arr.length];
};

export const P = {
  greet: ['¡Habla, rey!', '¿Qué hubo, mi llave?', '¡Ajá, mi hermano!', 'Habla, cuadro.', 'Tírala, tírala plena.', 'Ajá papi.', 'Ey cole.', 'Dímelo, rey.'],
  good: ['¡Erda, qué nota!', '¡Así es que es!', 'Tú sí eres un duro, mi llave.', 'Eso está bacano.', 'Vas volando, rey.', 'Muy pesao lo que hiciste.', 'Moral de perro.', 'Eso va.'],
  warn: ['Ey, mi rey, pilas con eso.', 'Ombe, ¿y esa vaina?', 'Ajá, ¿y entonces?', 'Eche, mira esto.', 'Cule vaina.'],
  scold: ['Deja de gastar en tantas maricadas.', 'Ya vas a empezar cv.'],
  advice: ['Te la tiro plena:', 'Mira, mi llave, te digo una vaina:', 'Hermano, escucha esto:', 'Ponte las pilas:'],
  paid: ['¡Listo el pollo! ✓', 'Uno menos, mi rey.', 'Eso, pagaíto.', 'Ya salimos de una.'],
  payday: ['¡Yaca!', '¡Yaca!', '¡Yacaman!', '¡Yacayou!'],
  logged: ['Anotado, mi llave.', 'Listo, ya quedó.', 'Eso va, anotado.', 'Ajá, guardado.'],
  income: ['¡Cayó la plata, mi llave!', '¡Eso, rey! Plata que entra.'],
};

export const greeting = () => daily(P.greet);
export const phrase = (k) => pick(P[k]);

// ---------- Utilidades de análisis ----------
function periodFraction(p) {
  const total = daysBetween(p.start, p.end) + 1;
  const passed = Math.min(total, Math.max(1, daysBetween(p.start, todayISO()) + 1));
  return { total, passed, left: total - passed + 1, frac: passed / total };
}

export function disponibleInfo(p = st.currentPeriod()) {
  const s = st.blockSummary(p).disp;
  const { left, frac } = periodFraction(p);
  const remaining = s.budget - s.spent;
  return { ...s, remaining, perDay: Math.max(0, remaining / left), daysLeft: left, frac, used: s.budget ? s.spent / s.budget : 0 };
}

// Cuántos pagos te quedan antes de una fecha (incluye pagos hasta la fecha)
export function paydaysUntil(deadline) {
  const t = todayISO();
  let n = 0;
  const d = parseISO(t);
  for (let i = 1; i <= 36; i++) {
    const y = d.getFullYear() + Math.floor((d.getMonth() + i) / 12);
    const m = ((d.getMonth() + i) % 12) + 1;
    const pd = iso(payDate(y, m));
    if (pd > deadline) break;
    if (pd > t) n++;
  }
  return n;
}

export function goalInfo(pk) {
  const saved = st.pocketBalance(pk.id);
  const target = Number(pk.target) || 0;
  const missing = Math.max(0, target - saved);
  const pays = pk.deadline ? paydaysUntil(pk.deadline) : 0;
  const days = pk.deadline ? daysBetween(todayISO(), pk.deadline) : null;
  return { saved, target, missing, pays, perPay: pays ? missing / pays : missing, days, progress: target ? Math.min(1, saved / target) : 0 };
}

// ---------- Motor de consejos ----------
// Cada consejo: { id, level: 'good'|'warn'|'info'|'action', title, text, action?, prio }
export function adviceList() {
  const S = st.S();
  const p = st.currentPeriod();
  const out = [];
  const add = (a) => { if (!S.settings.dismissed[`${a.id}@${p.key}`]) out.push(a); };
  const { frac, left } = periodFraction(p);

  // 1. Día de pago
  if (!st.paydayDone(p)) {
    add({ id: 'payday', level: 'action', prio: 100, title: `${phrase('payday')} Llegó el pago.`, text: `Registra lo que te cayó de Deel y te armo el reparto: cuánto va a Nequi y cuánto se queda en NU por bolsillo.`, action: { label: 'Registrar pago', go: 'payday' } });
  }

  const plan = S.plans[p.key];
  if (st.paydayDone(p) && plan && !plan.steps?.giro && plan.giroNequi > 0) {
    add({ id: 'giro', level: 'action', prio: 95, title: 'Falta el giro a Nequi.', text: `Pásale ${fmt(plan.giroNequi)} de NU a Nequi por Bre-B: compromisos más tu Disponible. Cuando lo hagas, márcalo.`, action: { label: 'Ya lo hice / ver', go: 'giro' } });
  }

  // 2. Compromisos vencidos o por vencer
  const cl = st.checklist(p);
  const late = cl.filter((c) => c.status === 'late');
  const soon = cl.filter((c) => c.status === 'today' || c.status === 'soon');
  if (late.length) add({ id: 'late', level: 'warn', prio: 90, title: `${phrase('warn')}`, text: `Tienes ${late.length === 1 ? 'un pago vencido' : `${late.length} pagos vencidos`}: ${late.map((c) => `${c.name} (${fmtShort(c.amount - c.paid)})`).join(', ')}. Si ya lo pagaste, márcalo en el checklist.`, action: { label: 'Ver checklist', go: 'checklist' } });
  if (soon.length) add({ id: 'soon', level: 'info', prio: 70, title: 'Se viene un pago.', text: soon.map((c) => `${c.name} ${fmtShort(c.amount - c.paid)} vence ${relDay(c.due)}`).join(' · ') + '.', action: { label: 'Ver checklist', go: 'checklist' } });

  // 3. Disponible
  const d = disponibleInfo(p);
  if (d.spent > d.budget) {
    add({ id: 'disp_over', level: 'warn', prio: 85, title: phrase('scold'), text: `Te pasaste ${fmtShort(d.spent - d.budget)} del Disponible. Lo que gastes de aquí al ${fmtDate(p.end)} sale de otro bolsillo, y eso es lo que no queríamos.` });
  } else if (d.used > frac + 0.15 && d.spent > 0) {
    add({ id: 'disp_fast', level: 'warn', prio: 80, title: phrase('warn'), text: `Vas en ${Math.round(d.used * 100)} % del Disponible y apenas va el ${Math.round(frac * 100)} % del mes. Para llegar bien, gasta máximo ${fmt(d.perDay)} al día.` });
  } else if (d.spent > 0 && d.used < frac - 0.1) {
    add({ id: 'disp_good', level: 'good', prio: 40, title: phrase('good'), text: `Vas suave con el Disponible: ${Math.round(d.used * 100)} % usado con ${Math.round(frac * 100)} % del mes corrido. Te quedan ${fmt(d.perDay)} por día.` });
  }

  // 4. Topes de gastos variables
  const spent = st.spentByCategory(p);
  for (const c of S.categories.filter((c) => c.block === 'gastos' && c.cap)) {
    const s = spent[c.id] || 0;
    if (s > c.cap) add({ id: `cap_${c.id}`, level: 'warn', prio: 75, title: phrase('warn'), text: `${c.emoji} ${c.name}: llevas ${fmtShort(s)} y el tope era ${fmtShort(c.cap)}. Te pasaste ${fmtShort(s - c.cap)}.` });
    else if (s > c.cap * 0.8 && frac < 0.6) add({ id: `cap_${c.id}`, level: 'info', prio: 60, title: 'Ojo con ese tope.', text: `${c.emoji} ${c.name} ya va en ${Math.round((s / c.cap) * 100)} % y falta más de la mitad del mes.` });
  }

  // 5. Gastos hormiga
  const small = st.txInPeriod(p).filter((t) => t.type === 'expense' && ['domicilios', 'antojos', 'comida'].includes(t.category) && t.amount < 30000);
  if (small.length >= 6) {
    const tot = small.reduce((s, t) => s + t.amount, 0);
    add({ id: 'hormiga', level: 'warn', prio: 65, title: phrase('scold'), text: `Van ${small.length} gasticos pequeños (domicilios, antojos, comida) que suman ${fmt(tot)}. Uno a uno no se siente, pero juntos sí, mi llave.` });
  }

  // 6. Meta principal (mudanza)
  const main = S.pockets.find((x) => x.main && !x.archived);
  if (main) {
    const g = goalInfo(main);
    if (!g.target) {
      add({ id: 'goal_target', level: 'info', prio: 55, title: `${phrase('advice')} ponle número a la ${main.name.toLowerCase()}.`, text: `Llevas ${fmt(g.saved)} guardados, pero sin una meta no sé si vas bien. Piensa en arriendo del primer mes, depósito, trasteo y lo básico para el apartamento en ${main.note?.split('·')[0]?.trim() || 'tu destino'}.`, action: { label: 'Definir meta', go: 'pockets' } });
    } else if (g.missing > 0) {
      add({ id: 'goal_pace', level: g.pays ? 'info' : 'warn', prio: 58, title: `${main.emoji} ${main.name}: te faltan ${fmtShort(g.missing)}.`, text: g.pays ? `Te quedan ${g.pays} ${g.pays === 1 ? 'pago' : 'pagos'} antes del ${fmtDate(main.deadline)}: necesitas meter ${fmt(g.perPay)} en cada uno.` : `Ya no hay más pagos antes del ${fmtDate(main.deadline)}. Toca recortar stand-by o Disponible para completarla.` });
    } else {
      add({ id: 'goal_done', level: 'good', prio: 50, title: `${phrase('good')} ¡${main.name} completa!`, text: `Ya tienes ${fmt(g.saved)}. Lo que siga entrando, piensa en reconstruir tu fondo de emergencia.` });
    }
  }

  // 7. Plata libre en NU sin asignar
  const nuFree = st.freeInAccount('nu');
  const capsLeft = S.categories.filter((c) => c.block === 'gastos' && c.cap && (c.account || 'nu') === 'nu').reduce((s, c) => s + Math.max(0, c.cap - (spent[c.id] || 0)), 0);
  if (st.paydayDone(p) && nuFree - capsLeft > 200000) {
    add({ id: 'nu_free', level: 'info', prio: 45, title: `${phrase('advice')} tienes plata suelta en NU.`, text: `Hay ${fmt(nuFree - capsLeft)} en NU que no está en ningún bolsillo ni la necesitas para los topes. Mándala a ${main ? main.name : 'una meta'} o a una cajita para que rinda.`, action: { label: 'Mover a bolsillo', go: 'pockets' } });
  }

  // 8. Fin de periodo: sobrante del Disponible
  if (left <= 3 && d.remaining > 50000) {
    add({ id: 'disp_left', level: 'good', prio: 52, title: `${phrase('good')} Te sobra Disponible.`, text: `Quedan ${fmt(d.remaining)} del Disponible y faltan ${left} días. Puedes darte un gusto sin culpa o adelantarle a la ${main?.name.toLowerCase() || 'meta'}. Tú decides, rey.` });
  }

  // 9. Respaldo
  const lb = S.settings.lastBackup;
  if (S.transactions.filter((t) => !t.historic && !t.initial).length > 5 && (!lb || daysBetween(lb.slice(0, 10), todayISO()) > 7)) {
    add({ id: 'backup', level: 'warn', prio: 62, title: 'Haz una copia, mi llave.', text: lb ? `Tu última copia fue hace ${daysBetween(lb.slice(0, 10), todayISO())} días. Si se borra Safari, se pierde todo.` : 'Todavía no has hecho ninguna copia. Si se borra Safari o cambias de cel, se pierde todo.', action: { label: 'Hacer copia', go: 'backup' } });
  }

  // 10. Spread de Deel
  const pay = st.txInPeriod(p).find((t) => t.type === 'income' && t.category === 'sueldo' && t.usd && t.trm && t.account !== 'arq');
  if (pay) {
    const lost = pay.usd * pay.trm - pay.amount;
    if (lost > 0) add({ id: 'spread', level: 'info', prio: 30, title: 'Lo que se quedó Deel.', text: `Te dieron ${fmt(pay.rate)} por dólar y la TRM era ${fmt(pay.trm)}. Este mes Deel se quedó con ${fmt(lost)} (${((lost / (pay.usd * pay.trm)) * 100).toFixed(1)} %).` });
  }

  // 11. 4x1000 en Nequi
  if (S.settings.nequiGMF) {
    const out = st.txInPeriod(p).filter((t) => t.account === 'nequi' && (t.type === 'expense' || t.type === 'transfer')).reduce((s, t) => s + t.amount, 0);
    if (out > 300000) add({ id: 'gmf', level: 'info', prio: 25, title: 'El 4x1000 de Nequi.', text: `Este mes llevas ~${fmt(out * 0.004)} en 4x1000 por lo que sale de Nequi. Lo que puedas pagar directo desde NU no lo paga.` });
  }

  // 12. Pensión en pausa
  const pen = S.recurring.find((r) => r.id === 'r_pension');
  if (pen && !pen.active) add({ id: 'pension', level: 'info', prio: 20, title: 'Hablando claro: la pensión.', text: 'La tienes en pausa. Como independiente, cotizar es obligatorio y la UGPP puede cobrar lo atrasado con intereses. Además, cada mes sin cotizar son ~4 semanas menos para tu pensión. Revísalo cuando puedas.' });

  // 13. Emergencia = mudanza
  if (main && /emergencia/i.test(main.note || '')) add({ id: 'emergency', level: 'info', prio: 22, title: 'Tu colchón está en la mudanza.', text: `Hoy la emergencia y la mudanza son la misma plata. Después de mudarte, arma otra vez un colchón de 1 a 3 meses de compromisos: entre ${fmtShort(st.commitmentsTotal())} y ${fmtShort(st.commitmentsTotal() * 3)}.` });

  // 14. Sin registrar
  const last = S.transactions.filter((t) => !t.historic).map((t) => t.date).sort().pop();
  if (S.onboarded && last && daysBetween(last, todayISO()) >= 3) add({ id: 'quiet', level: 'info', prio: 35, title: 'Ajá, ¿y entonces?', text: `Llevas ${daysBetween(last, todayISO())} días sin contarme nada. ¿No has gastado o se te olvidó anotar?`, action: { label: 'Contarle a Lukas', go: 'chat' } });

  // 15. Todo bien
  if (!out.some((a) => a.level === 'warn') && st.paydayDone(p)) add({ id: 'allgood', level: 'good', prio: 10, title: phrase('good'), text: 'Todo en orden: sin pagos vencidos y los topes bajo control. Sigue así, mi llave.' });

  return out.sort((a, b) => b.prio - a.prio);
}

export function dismiss(id) {
  const p = st.currentPeriod();
  st.S().settings.dismissed[`${id}@${p.key}`] = true;
  st.save();
}

// ---------- Reacciones al registrar ----------
export function reactTo(tx) {
  const S = st.S();
  const p = st.currentPeriod();
  if (tx.type === 'income') return `${phrase('income')} ${fmt(tx.amount, st.account(tx.account)?.currency)} en ${st.account(tx.account)?.name}.`;
  if (tx.type === 'transfer') return `${phrase('logged')} ${fmt(tx.amount, st.account(tx.account)?.currency)} de ${st.account(tx.account)?.name} a ${st.account(tx.toAccount)?.name}.`;
  if (tx.type !== 'expense') return phrase('logged');
  if (tx.recurring) {
    const item = st.checklist(p).find((c) => c.id === tx.recurring);
    return item?.done ? `${phrase('paid')} ${item.name} quedó listo.` : `${phrase('logged')} Abonaste a ${item?.name}: van ${fmtShort(item?.paid)} de ${fmtShort(item?.amount)}.`;
  }
  const c = st.category(tx.category);
  if (c?.block === 'disp') {
    const d = disponibleInfo(p);
    if (d.remaining < 0) return `${phrase('scold')} Ya te pasaste ${fmtShort(-d.remaining)} del Disponible.`;
    if (d.used > d.frac + 0.15) return `${phrase('warn')} Te quedan ${fmtShort(d.remaining)} del Disponible: ${fmtShort(d.perDay)} por día.`;
    return `${phrase('logged')} Te quedan ${fmtShort(d.remaining)} del Disponible (${fmtShort(d.perDay)}/día).`;
  }
  if (c?.block === 'gastos' && c.cap) {
    const s = st.spentByCategory(p)[c.id] || 0;
    if (s > c.cap) return `${phrase('warn')} ${c.name} ya pasó el tope: ${fmtShort(s)} de ${fmtShort(c.cap)}.`;
    return `${phrase('logged')} ${c.name}: ${fmtShort(s)} de ${fmtShort(c.cap)}.`;
  }
  return phrase('logged');
}

// ---------- Respuestas del chat ----------
export function statusText() {
  const p = st.currentPeriod();
  const d = disponibleInfo(p);
  const accs = st.activeAccounts().map((a) => `${a.name}: ${fmt(st.balance(a.id), a.currency)}`).join('\n');
  const pend = st.checklist(p).filter((c) => !c.done);
  return `${greeting()} Así vamos:\n\n${accs}\n\nPatrimonio: ${fmt(st.netWorthCOP())}\nDisponible: te quedan ${fmt(d.remaining)} (${fmt(d.perDay)}/día por ${d.daysLeft} días).\nCompromisos pendientes: ${pend.length ? pend.length + ' por ' + fmt(pend.reduce((s, c) => s + c.amount - c.paid, 0)) : 'ninguno, ¡todo pago!'}`;
}

export function pendingText() {
  const p = st.currentPeriod();
  const pend = st.checklist(p).filter((c) => !c.done);
  if (!pend.length) return `${phrase('good')} No te falta nada por pagar este mes.`;
  return `Te falta:\n${pend.map((c) => `• ${c.name}: ${fmt(c.amount - c.paid)}${c.due ? ` (vence ${relDay(c.due)})` : ''}`).join('\n')}`;
}

export function adviceText() {
  const list = adviceList().filter((a) => a.id !== 'allgood');
  if (!list.length) return `${phrase('good')} La verdad vas bien. Sigue anotando todo y no te descuides con el Disponible.`;
  const top = list.slice(0, 3);
  return `${phrase('advice')}\n\n${top.map((a) => `• ${a.title.replace(/\.$/, '')}: ${a.text}`).join('\n\n')}`;
}

export function goalText() {
  const main = st.S().pockets.find((x) => x.main);
  if (!main) return 'No tienes una meta principal todavía.';
  const g = goalInfo(main);
  if (!g.target) return `${main.emoji} ${main.name}: llevas ${fmt(g.saved)}. Ponle una meta en Plan › Bolsillos y te digo cuánto meter cada mes.`;
  return `${main.emoji} ${main.name}: ${fmt(g.saved)} de ${fmt(g.target)} (${Math.round(g.progress * 100)} %). ${g.missing ? `Faltan ${fmt(g.missing)}${g.pays ? `: ${fmt(g.perPay)} por pago en los próximos ${g.pays}` : ''}.` : phrase('good')}`;
}

export const helpText = () => `${greeting()} Cuéntame como le hablarías a un amigo:\n\n• «Gasté 25 lucas en almuerzo»\n• «Tanqueé 80 mil con NU»\n• «Pagué el internet»\n• «Le pasé 500 mil de NU a Nequi»\n• «¿Cuánto me queda?» · «Tírala, ¿qué hago?» · «¿Qué me falta pagar?»`;
