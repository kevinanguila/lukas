// Formato y parseo de montos (COP / USD)

const nfCOP = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
const nfUSD = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const nf1 = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });

export function fmt(amount, currency = 'COP', { sign = false } = {}) {
  const n = Number(amount) || 0;
  const s = sign && n > 0 ? '+' : n < 0 ? '−' : '';
  const a = Math.abs(n);
  if (currency === 'USD') return `${s}US$${nfUSD.format(Math.round(a * 100) / 100)}`;
  return `${s}$${nfCOP.format(Math.round(a))}`;
}

// Versión corta: $1,6 M · $550 mil · US$230
export function fmtShort(amount, currency = 'COP') {
  const n = Number(amount) || 0;
  const s = n < 0 ? '−' : '';
  const a = Math.abs(n);
  if (currency === 'USD') return `${s}US$${nfUSD.format(Math.round(a))}`;
  if (a >= 1e6) return `${s}$${nf1.format(a / 1e6)} M`;
  if (a >= 1e3) return `${s}$${nfCOP.format(Math.round(a / 1e3))} mil`;
  return `${s}$${nfCOP.format(a)}`;
}

// Interpreta un número escrito por humanos en Colombia.
// "25.000" → 25000 · "1,5" → 1.5 · "1.630,50" → 1630.5 · "25k" → 25000
export function parseNumber(str) {
  if (str == null) return NaN;
  let s = String(str).trim().toLowerCase().replace(/\s/g, '').replace(/^\$|us\$/g, '');
  let mult = 1;
  if (/k$/.test(s)) { mult = 1000; s = s.slice(0, -1); }
  if (/m$/.test(s)) { mult = 1e6; s = s.slice(0, -1); }
  const hasDot = s.includes('.'), hasComma = s.includes(',');
  if (hasDot && hasComma) {
    // El último separador es el decimal
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasDot) {
    // "25.000" (miles) vs "1.5" (decimal)
    const parts = s.split('.');
    if (parts.length > 2 || parts[parts.length - 1].length === 3) s = s.replace(/\./g, '');
  } else if (hasComma) {
    const parts = s.split(',');
    if (parts.length > 2 || parts[parts.length - 1].length === 3) s = s.replace(/,/g, '');
    else s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n * mult;
}

// Para inputs de monto: muestra separadores de miles mientras escribes
export function formatInput(value, currency = 'COP') {
  const raw = String(value).replace(/[^\d,]/g, '');
  if (!raw) return '';
  if (currency === 'USD') {
    const [int, dec] = raw.split(',');
    const i = nfCOP.format(Number(int || 0));
    return dec !== undefined ? `${i},${dec.slice(0, 2)}` : i;
  }
  return nfCOP.format(Number(raw.replace(/,/g, '')));
}

export function inputToNumber(value, currency = 'COP') {
  const raw = String(value).replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
  const n = parseFloat(raw);
  return isNaN(n) ? 0 : currency === 'USD' ? Math.round(n * 100) / 100 : Math.round(n);
}

export const pct = (a, b) => (b > 0 ? a / b : 0);
export const fmtPct = (x) => `${Math.round(x * 100)} %`;
