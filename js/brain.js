// Entiende preguntas "como persona": compara lo que escribes con muchas formas de decir
// lo mismo (tolerante a errores de escritura) y responde con tus datos reales.
import * as st from './store.js';
import * as L from './lukas.js';
import { fmt, fmtShort } from './money.js';
import { fmtDate, daysBetween, todayISO } from './dates.js';

const norm = (s) => String(s || '').toLowerCase().replace(/ñ/g, '\u0001').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0001/g, 'ñ');
const STOP = new Set('a al algo alguna algun ante con contra de del desde donde el ella ellas en entre era es esa ese eso esta este esto estos fue ha han hay la las le les lo los me mi mis muy nos o os para pero por que se si sin sobre su sus te ti tu tus un una uno unos y ya yo son soy sea porfa favor pues oye mira entonces ok osea tambien asi como cual cuales'.split(' '));
// "como" y "cual" sí importan en algunas frases: se quitan como palabra vacía pero cuentan en la frase completa
const unify = (w) => w.replace(/qu/g, 'k').replace(/c(?=[aou])/g, 'k').replace(/z/g, 's').replace(/ce|ci/g, (m) => 's' + m[1]).replace(/v/g, 'b').replace(/ll/g, 'y').replace(/h/g, '').replace(/(.)\1+/g, '$1');
const stem = (w) => (w.length >= 6 ? w.slice(0, 5) : w);
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 9;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}
const tokens = (s) => norm(s).split(/[^a-z0-9ñ]+/).filter((w) => w && !STOP.has(w));
const same = (a, b) => a === b || unify(a) === unify(b) || (a.length >= 5 && b.length >= 5 && stem(unify(a)) === stem(unify(b))) || (a.length >= 4 && b.length >= 4 && lev(unify(a), unify(b)) <= 1);

// Intenciones con muchas formas de decirlas
const INTENTS = {
  help: ['en que me puedes ayudar', 'que puedes hacer', 'cuales son tus mejores herramientas', 'que herramientas tienes', 'que sabes hacer', 'para que sirves', 'que haces', 'como te uso', 'como funcionas', 'como funciona esto', 'como funciona la app', 'explicame la app', 'que funciones tienes', 'que me ofreces', 'ayudame', 'ayuda', 'que te puedo preguntar', 'que te puedo decir', 'como debo hablarte', 'que cosas haces', 'en que eres bueno', 'que me recomiendas usar', 'por donde empiezo', 'no se como usarte'],
  about: ['quien eres', 'como te llamas', 'eres una persona', 'eres humano', 'eres un robot', 'quien te hizo', 'quien te creo', 'que eres', 'eres inteligencia artificial', 'eres real', 'de donde eres'],
  howareyou: ['como estas', 'como te va', 'como amaneciste', 'todo bien', 'que tal', 'como vas tu', 'como andas', 'que mas pues como estas'],
  tips: ['como puedo ahorrar mas', 'tips para ahorrar', 'como gasto menos', 'dame tips', 'como mejoro mis finanzas', 'como hago para que me rinda la plata', 'como ahorro', 'quiero ahorrar mas', 'consejos para ahorrar', 'como organizo mi plata', 'como manejo mejor la plata', 'como llego bien a fin de mes', 'trucos para ahorrar'],
  status: ['como voy', 'como vamos', 'como estoy de plata', 'como estan mis finanzas', 'dame un resumen', 'resumen del mes', 'cuanta plata tengo', 'cuanto tengo en total', 'muestrame mis cuentas', 'mis saldos', 'estado de cuenta', 'como va el mes'],
  advice: ['que me recomiendas', 'dame un consejo', 'que hago', 'que deberia hacer', 'que harias tu', 'que opinas de mis gastos', 'tirala', 'tirala plena', 'que me dices', 'aconsejame', 'que debo mejorar', 'en que la estoy embarrando', 'donde estoy fallando', 'voy bien o mal'],
  pending: ['que me falta pagar', 'que tengo pendiente', 'que debo pagar', 'que se me vence', 'que pagos tengo', 'tengo algo pendiente', 'que me toca pagar', 'que pagos vienen'],
  goal: ['como va la mudanza', 'cuanto llevo de la mudanza', 'cuanto me falta para la mudanza', 'voy bien con la meta', 'como van mis metas', 'cuanto tengo ahorrado'],
  top: ['en que gasto mas', 'en que se me va la plata', 'donde se me va la plata', 'cual es mi mayor gasto', 'en que gaste mas este mes', 'que es lo que mas gasto'],
  broke: ['estoy pelado', 'no tengo plata', 'estoy sin plata', 'estoy en la mala', 'se me acabo la plata', 'estoy quebrado', 'no me queda nada'],
  payday_when: ['cuando me pagan', 'cuando cae la plata', 'cuanto falta para el pago', 'cuando es el proximo pago', 'que dia me pagan', 'cuando llega el sueldo', 'cuantos dias faltan para que me paguen'],
  dollar: ['como esta el dolar', 'a cuanto esta el dolar', 'cuanto vale el dolar', 'la trm', 'a como me pagaron el dolar', 'cuanto me cobra deel', 'cuanto se queda deel', 'conviene ahorrar en dolares'],
  feel: ['estoy estresado con la plata', 'me siento mal con mis finanzas', 'me fue mal este mes', 'estoy preocupado por la plata', 'me da ansiedad la plata', 'la embarre', 'gaste de mas', 'me pase', 'estoy aburrido de no tener plata'],
  compliment: ['eres un duro', 'te quiero', 'gracias por todo', 'eres el mejor', 'que bacano eres', 'me encantas', 'buen trabajo', 'eres una nota'],
  joke: ['cuentame un chiste', 'dime algo chistoso', 'hazme reir', 'echame un chiste'],
  faq_disponible: ['que es el disponible', 'para que es el disponible', 'como funciona el disponible', 'que es la plata sin culpa'],
  faq_bolsillos: ['que son los bolsillos', 'como funcionan los bolsillos', 'para que sirven los bolsillos', 'que es un bolsillo virtual'],
  faq_checklist: ['como marco un pago', 'como funciona el checklist', 'como pago un compromiso', 'como marco algo como pagado', 'como registro un abono'],
  faq_registrar: ['como registro un gasto', 'como anoto un gasto', 'como te digo un gasto', 'como meto un gasto', 'como agrego un movimiento'],
  faq_payday: ['como funciona el dia de pago', 'que es el yaca', 'como registro el sueldo', 'como hago el reparto'],
  faq_gmf: ['que es el 4x1000', 'cuanto pago de 4x1000', 'como evito el 4x1000'],
  faq_backup: ['como hago una copia', 'como respaldo mis datos', 'como no pierdo mis datos', 'como paso mis datos a otro celular'],
  undo: ['borra el ultimo', 'me equivoque', 'eso estuvo mal', 'deshaz eso', 'quita lo ultimo'],
};

const PREPARED = Object.entries(INTENTS).flatMap(([intent, ex]) => ex.map((e) => ({ intent, toks: tokens(e), full: norm(e) })));

export function classify(text) {
  const u = tokens(text);
  const full = norm(text);
  const scores = {};
  for (const ex of PREPARED) {
    let s;
    if (!ex.toks.length) continue;
    if (full.includes(ex.full)) s = 1.1;
    else {
      const matched = ex.toks.filter((e) => u.some((w) => same(w, e))).length;
      if (!matched) continue;
      s = (matched / ex.toks.length) * 0.75 + (u.length ? (matched / u.length) * 0.25 : 0);
      if (ex.toks.length === 1 && u.length > 3) s *= 0.7; // una sola palabra en una frase larga: poca evidencia
    }
    if (!scores[ex.intent] || s > scores[ex.intent]) scores[ex.intent] = s;
  }
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  return { intent: ranked[0]?.[0] || null, score: ranked[0]?.[1] || 0, alts: ranked.slice(0, 3).map(([i]) => i) };
}

export const SUGGEST_LABEL = {
  help: '¿En qué me ayudas?', status: '¿Cómo voy?', advice: 'Tírala, ¿qué hago?', pending: '¿Qué me falta pagar?', goal: '¿Cómo va la mudanza?',
  top: '¿En qué gasto más?', tips: 'Tips pa\' ahorrar', payday_when: '¿Cuándo me pagan?', dollar: '¿Cómo está el dólar?', broke: 'Estoy pelado',
  faq_registrar: '¿Cómo anoto un gasto?', faq_bolsillos: '¿Qué son los bolsillos?', faq_disponible: '¿Qué es el Disponible?', faq_checklist: '¿Cómo marco un pago?',
};

// ---------- Respuestas ----------
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function capabilities() {
  const S = st.S();
  const p = st.currentPeriod();
  const d = L.disponibleInfo(p);
  const pend = st.checklist(p).filter((c) => !c.done).length;
  const main = S.pockets.find((x) => x.main);
  return `${L.greeting()} Te la tiro plena, esto es lo que mejor hago por ti:

1. 💬 Anotar hablando. Me dices «almuerzo 20 lucas» o «almuerzo 20 y taxi 12» y queda. Sin formularios.
2. 🟢 Cuidarte el Disponible. Hoy te quedan ${fmt(Math.max(0, d.remaining))}: ${fmt(d.perDay)} por día. Te aviso si vas muy rápido.
3. ✅ Que no se te pase nada. Tienes ${pend} compromiso${pend === 1 ? '' : 's'} por pagar este mes y te los recuerdo (también en el Calendario del cel).
4. 💰 El día de pago (¡Yaca!). Te armo el reparto por banco: cuánto a Nequi, cuánto se queda en NU por bolsillo y cuánto se quedó Deel.
5. 📦 Tu meta. ${main ? `Vigilo la ${main.name.toLowerCase()} y te digo cuánto meter en cada pago pa' llegar al ${fmtDate(main.deadline)}.` : 'Vigilo tus metas.'}
6. 🧠 Consejos francos. Si algo no cuadra te lo digo, sin darte la razón por darla.

Pregúntame cosas como «¿cómo voy?», «¿me alcanza pa' salir?», «¿en qué gasto más?» o «tírala, ¿qué hago?».`;
}

function tips() {
  const S = st.S();
  const p = st.currentPeriod();
  const groups = st.groupSummary(p).filter((g) => g.block === 'disp' && g.spent > 0).sort((a, b) => b.spent - a.spent);
  const out = [];
  if (groups[0]) out.push(`Tu gusto más caro este mes es ${groups[0].emoji} ${groups[0].name.toLowerCase()} (${fmt(groups[0].spent)}). Bájale un 20 % y son ${fmtShort(groups[0].spent * 0.2)} más pa' la mudanza.`);
  out.push('Aparta primero, gasta después: el día del ¡Yaca! manda la plata a los bolsillos antes de tocar nada. Lo que no ves, no te lo gastas.');
  out.push('Regla de las 48 horas: si es un antojo de más de 100 lucas, espera dos días. Si todavía lo quieres, dale sin culpa.');
  if (S.settings.nequiGMF) out.push('Paga lo que puedas directo desde NU: no te cobra 4x1000 y no infla el giro a Nequi.');
  out.push('Anota todo el mismo día. Lo que no se anota, no se controla, y a fin de mes no sabes pa\' dónde se fue.');
  return `${pick(['Mira, mi llave, te digo unas vainas:', 'Te la tiro plena:'])}\n\n${out.slice(0, 4).map((x) => `• ${x}`).join('\n\n')}`;
}

function paydayWhen() {
  const p = st.currentPeriod();
  const n = daysBetween(todayISO(), p.nextPay);
  return n <= 0 ? `${pick(['¡Yaca!', '¡Yacaman!'])} Hoy es día de pago, mi llave.` : `El próximo pago cae el ${fmtDate(p.nextPay, { weekday: true })}: faltan ${n} día${n === 1 ? '' : 's'}. ${n <= 3 ? 'Ya casi, aguanta.' : `Con el Disponible te quedan ${fmt(L.disponibleInfo(p).perDay)} por día hasta allá.`}`;
}

function dollar() {
  const pay = st.S().transactions.filter((t) => t.type === 'income' && t.rate && t.usd).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  if (!pay) return `Todavía no has registrado un pago con dólares. Uso ${fmt(st.usdRate())} por dólar como referencia. El día del ¡Yaca! busco la TRM oficial y te digo cuánto se quedó Deel.`;
  const lost = pay.trm ? pay.usd * pay.trm - pay.amount : null;
  return `En tu último pago (${fmtDate(pay.date)}) Deel te dio ${fmt(pay.rate)} por dólar${pay.trm ? ` y la TRM era ${fmt(pay.trm)}: se quedó ${fmt(lost)} (${((lost / (pay.usd * pay.trm)) * 100).toFixed(1)} %)` : ''}. Yo no tengo el dólar en vivo; para la del día, mírala en el Banco de la República o en tu app de Deel.`;
}

function feel() {
  const p = st.currentPeriod();
  const d = L.disponibleInfo(p);
  const pend = st.checklist(p).filter((c) => !c.done);
  return `Ey, tranquilo mi hermano, que pa' eso estoy. Respira. Veamos los números en frío:\n\n• Del Disponible te quedan ${fmt(Math.max(0, d.remaining))}${d.remaining < 0 ? ` (te pasaste ${fmt(-d.remaining)})` : ''}.\n• Te falta${pend.length === 1 ? '' : 'n'} ${pend.length} pago${pend.length === 1 ? '' : 's'} este mes.\n• El próximo pago cae el ${fmtDate(p.nextPay)}.\n\nUn mes malo no daña el año. Lo que importa es que ya lo estás mirando, y eso la mayoría no lo hace. Moral de perro, que esto se arregla.`;
}

const FAQ = {
  faq_disponible: () => `El Disponible es tu plata sin culpa: ${fmt(st.S().settings.disponible)} al mes pa' gustos (comida afuera, salidas, ropa, antojos). Vive en Nequi. Si lo gastas todo, bien; lo que no queremos es sacar de otros bolsillos. En el inicio ves cuánto puedes gastar al día. Lo cambias en Plan › Presupuesto.`,
  faq_bolsillos: () => 'Los bolsillos son virtuales: la plata sigue en NU como un solo saldo, pero yo sé cuánto es de la mudanza, del stand-by, de Medellín… Así no te gastas sin querer la plata de una meta. En Plan › Bolsillos tocas «Apartar» o «Sacar».',
  faq_checklist: () => 'En el inicio, en «Compromisos», toca el círculo y queda «Listo» con el monto de siempre. Si pagaste distinto, en otra fecha o es un abono (ej. 1 de 2 motiladas), mantén presionado el círculo o toca el nombre. Si te equivocaste, tócalo otra vez y lo desmarcas.',
  faq_registrar: () => 'Tres formas:\n• Aquí en el chat, hablando: «almuerzo 20 lucas», «tanqueé 80 mil con NU», «almuerzo 20 y taxi 12».\n• El botón azul «+» de abajo.\n• En el checklist, si es un compromiso.\nSi no me dices la cuenta, uso la habitual de esa categoría.',
  faq_payday: () => 'El día de pago abres el ¡Yaca! (te aparece arriba en el inicio). Escribes lo que llegó de Deel y a qué cuenta, y yo te armo el reparto: el giro a Nequi, lo que se queda en NU por bolsillo y lo que sobra va a la mudanza. Después marcas cada transferencia cuando la hagas.',
  faq_gmf: () => `El 4x1000 es el impuesto a los movimientos financieros: 4 pesos por cada 1.000 que sacas. Solo una cuenta tuya puede ser exenta, y tú marcaste NU. Lo que sale de Nequi lo paga (si no tienes exención allá). Truco: paga lo que puedas directo desde NU.`,
  faq_backup: () => 'En Ajustes › Respaldo toca «Hacer copia» y guarda el archivo en iCloud Drive. Si cambias de cel o se borra Safari, en «Restaurar» escoges ese archivo y vuelve todo. Te recuerdo cada semana.',
};

export function answer(intent) {
  switch (intent) {
    case 'help': return capabilities();
    case 'about': return 'Soy Lukas, tu llave pa\' la plata. No soy persona: soy una app hecha a tu medida, con alma barranquillera. Todo lo que me cuentas se queda en tu cel. No soy asesor financiero certificado, pero te hablo claro con tus números.';
    case 'howareyou': return pick(['Aquí, bien bacano, cuidándote la plata. ¿Y tú qué, mi llave?', 'Melo, rey. Con moral de perro. ¿Qué gastaste hoy?', '¡Bien, mi hermano! ¿Cómo va tu día?']);
    case 'tips': return tips();
    case 'payday_when': return paydayWhen();
    case 'dollar': return dollar();
    case 'feel': return feel();
    case 'compliment': return pick(['¡Erda, qué nota! Tú también eres un duro, mi llave. Sigue así.', 'Ajá, me vas a hacer sonrojar. Pa\' eso estamos, rey.', 'Gracias, hermano. Ahora ponte serio y anota los gastos de hoy, jajaja.']);
    case 'joke': return pick(['¿Sabes cuál es el animal más ahorrador? La vaca… porque siempre está haciendo «muuucho» ahorro. Ok, ok, ya me voy.', 'Mi plata y yo somos como Junior en la final: nos vemos poco, pero cuando llega, ¡qué felicidad!', 'Le pregunté a mi cuenta de Nequi cómo estaba y me dijo: «Aquí, en las últimas, mi llave».']);
    default: return FAQ[intent] ? FAQ[intent]() : null;
  }
}
