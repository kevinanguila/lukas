// Fechas, festivos de Colombia y periodos de pago.
// Un "periodo" va desde un día de pago hasta el día antes del siguiente.
// Se identifica por el mes al que corresponde el sueldo: "2026-11" = pago del 1 de noviembre
// (que puede caer antes, p. ej. el 30 de octubre).

const pad = (n) => String(n).padStart(2, '0');

export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const today = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};
export const todayISO = () => iso(today());

export function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);

// Domingo de Pascua (algoritmo de Meeus/Butcher)
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}

// Ley Emiliani: se corre al lunes siguiente (si no cae en lunes)
function nextMonday(d) {
  const r = new Date(d);
  const dow = r.getDay();
  if (dow !== 1) r.setDate(r.getDate() + ((8 - dow) % 7));
  return r;
}

const holidayCache = {};
export function holidays(y) {
  if (holidayCache[y]) return holidayCache[y];
  const D = (m, d) => new Date(y, m - 1, d);
  const e = easter(y);
  const list = [
    D(1, 1), D(5, 1), D(7, 20), D(8, 7), D(12, 8), D(12, 25),
    nextMonday(D(1, 6)), nextMonday(D(3, 19)), nextMonday(D(6, 29)),
    nextMonday(D(8, 15)), nextMonday(D(10, 12)), nextMonday(D(11, 1)), nextMonday(D(11, 11)),
    addDays(e, -3), addDays(e, -2), // Jueves y Viernes Santo
    addDays(e, 43), // Ascensión (lunes)
    addDays(e, 64), // Corpus Christi (lunes)
    addDays(e, 71), // Sagrado Corazón (lunes)
  ];
  holidayCache[y] = new Set(list.map(iso));
  return holidayCache[y];
}

export const isHoliday = (d) => holidays(d.getFullYear()).has(iso(d));
export const isBusinessDay = (d) => d.getDay() !== 0 && d.getDay() !== 6 && !isHoliday(d);

// Fecha real de pago del sueldo del mes (y, m: 1-12): día 1 o el hábil anterior
export function payDate(y, m) {
  let d = new Date(y, m - 1, 1);
  while (!isBusinessDay(d)) d = addDays(d, -1);
  return d;
}

const keyOf = (y, m) => `${y}-${pad(m)}`;
const shiftMonth = (y, m, n) => {
  const t = y * 12 + (m - 1) + n;
  return [Math.floor(t / 12), (t % 12) + 1];
};

export function periodFromKey(key) {
  const [y, m] = key.split('-').map(Number);
  const start = payDate(y, m);
  const [ny, nm] = shiftMonth(y, m, 1);
  const nextPay = payDate(ny, nm);
  return {
    key,
    year: y,
    month: m,
    start: iso(start),
    end: iso(addDays(nextPay, -1)), // inclusivo
    nextPay: iso(nextPay),
  };
}

// Periodo que contiene una fecha ISO
export function periodOf(dateISO = todayISO()) {
  const d = parseISO(dateISO);
  let [y, m] = [d.getFullYear(), d.getMonth() + 1];
  // El periodo puede ser el del mes siguiente (si el pago ya se adelantó) o el actual
  for (const n of [1, 0, -1]) {
    const [yy, mm] = shiftMonth(y, m, n);
    const p = periodFromKey(keyOf(yy, mm));
    if (p.start <= dateISO && dateISO <= p.end) return p;
  }
  return periodFromKey(keyOf(y, m));
}

export function prevPeriod(p) {
  const [y, m] = shiftMonth(p.year, p.month, -1);
  return periodFromKey(keyOf(y, m));
}
export function nextPeriod(p) {
  const [y, m] = shiftMonth(p.year, p.month, 1);
  return periodFromKey(keyOf(y, m));
}

// Fecha de vencimiento de un compromiso con día fijo dentro de un periodo
export function dueDateIn(period, day) {
  if (!day) return null;
  const last = new Date(period.year, period.month, 0).getDate();
  let d = iso(new Date(period.year, period.month - 1, Math.min(day, last)));
  if (d < period.start) d = period.start;
  if (d > period.end) d = period.end;
  return d;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export const monthName = (m) => MESES[m - 1];
export const periodLabel = (p) => `${MESES[p.month - 1][0].toUpperCase()}${MESES[p.month - 1].slice(1)} ${p.year}`;

export function fmtDate(s, { weekday = false, year = false } = {}) {
  const d = parseISO(s);
  let out = `${d.getDate()} ${MESES_C[d.getMonth()]}`;
  if (year) out += ` ${d.getFullYear()}`;
  if (weekday) out = `${DIAS[d.getDay()]} ${out}`;
  return out;
}

export function relDay(s) {
  const n = daysBetween(todayISO(), s);
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  if (n === -1) return 'ayer';
  if (n > 1 && n < 7) return `en ${n} días`;
  if (n < -1 && n > -7) return `hace ${-n} días`;
  return fmtDate(s);
}
