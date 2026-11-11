// Utilidades de interfaz: escape, íconos, hojas (sheets), toasts, inputs de monto.
import { formatInput } from './money.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Íconos lineales estilo SF Symbols
const paths = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h5v-6h4v6h5V9.5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z"/>',
  plan: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2.5v3M16 2.5v3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  back: '<path d="m15 6-6 6 6 6"/>',
  send: '<path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/>',
  arrows: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
  down: '<path d="M12 5v14M5.5 12.5 12 19l6.5-6.5"/>',
  up: '<path d="M12 19V5M5.5 11.5 12 5l6.5 6.5"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  box: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2Z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  dollar: '<path d="M12 3v18M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3S9.5 10.5 12 11s4.5 1.3 4.5 3.5-2 3-4.5 3-4.5-1.3-4.5-3"/>',
  refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
};
export const icon = (name, size = 22, extra = '') =>
  `<svg class="ic ${extra}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || ''}</svg>`;

// ---------- Toast ----------
let toastTimer;
export function toast(msg) {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ---------- Sheet (hoja inferior estilo iOS) ----------
export function sheet(html, { onClose, tall = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-backdrop"></div><div class="sheet ${tall ? 'tall' : ''}" role="dialog" aria-modal="true"><div class="sheet-grab"></div><div class="sheet-body">${html}</div></div>`;
  document.body.appendChild(wrap);
  document.body.classList.add('noscroll');
  requestAnimationFrame(() => wrap.classList.add('open'));
  const close = () => {
    wrap.classList.remove('open');
    setTimeout(() => {
      wrap.remove();
      if (!$('.sheet-wrap')) document.body.classList.remove('noscroll');
    }, 260);
    onClose?.();
  };
  $('.sheet-backdrop', wrap).addEventListener('click', close);
  wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  const body = $('.sheet-body', wrap);
  return { el: body, close, set: (h) => { body.innerHTML = h; } };
}

export function confirmSheet({ title, text, ok = 'Confirmar', danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    const s = sheet(`
      <h3 class="sheet-title">${esc(title)}</h3>
      <p class="muted">${esc(text)}</p>
      <div class="stack gap12 mt24">
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(ok)}</button>
        <button class="btn btn-ghost" data-close>Cancelar</button>
      </div>`, { onClose: () => { if (!answered) resolve(false); } });
    $('[data-ok]', s.el).addEventListener('click', () => { answered = true; resolve(true); s.close(); });
  });
}

// Inputs de monto con separador de miles en vivo
export function bindAmountInputs(root) {
  $$('input[data-amount]', root).forEach((inp) => {
    inp.addEventListener('input', () => {
      const cur = inp.dataset.amount || 'COP';
      const pos = inp.value.length - inp.selectionStart;
      inp.value = formatInput(inp.value, cur);
      const np = Math.max(0, inp.value.length - pos);
      inp.setSelectionRange(np, np);
    });
  });
}

// Anillos estilo Actividad (Apple Watch)
export function rings(items, size = 132) {
  const stroke = 12, gap = 3;
  let r = size / 2 - stroke / 2;
  const svg = items
    .map((it) => {
      const c = 2 * Math.PI * r;
      const v = Math.max(0, Math.min(it.value, 1));
      const over = it.value > 1;
      const out = `
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${it.color}" stroke-opacity=".16" stroke-width="${stroke}" fill="none"/>
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${it.color}" stroke-width="${stroke}" fill="none" stroke-linecap="round"
          stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - v)}" transform="rotate(-90 ${size / 2} ${size / 2})" class="${over ? 'ring-over' : ''}"/>`;
      r -= stroke + gap;
      return out;
    })
    .join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="rings" aria-hidden="true">${svg}</svg>`;
}

export const bar = (value, color = 'var(--blue)') =>
  `<div class="bar"><span style="width:${Math.min(100, Math.max(0, value * 100))}%;background:${value > 1 ? 'var(--ring-orange)' : color}"></span></div>`;

export function haptic() {
  try { navigator.vibrate?.(8); } catch {}
}
