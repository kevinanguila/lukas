// PIN de 4 dígitos (se guarda solo el hash con sal, nunca el PIN)
import { S, save } from './store.js';
import { $, $$, icon } from './ui.js';
import { greeting } from './lukas.js';

async function hash(pin, salt) {
  const data = new TextEncoder().encode(`${salt}:${pin}`);
  if (crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Respaldo simple si no hay crypto.subtle (no debería pasar en HTTPS)
  let h = 0;
  for (const b of data) h = (h * 31 + b) | 0;
  return String(h);
}

export async function setPin(pin) {
  const salt = Math.random().toString(36).slice(2);
  S().settings.pin = { salt, hash: await hash(pin, salt) };
  save();
}

export async function checkPin(pin) {
  const p = S().settings.pin;
  if (!p) return true;
  return (await hash(pin, p.salt)) === p.hash;
}

export const hasPin = () => !!S().settings.pin;

// Pantalla de PIN. mode: 'unlock' | 'create'
export function pinScreen({ mode = 'unlock', title, subtitle, onDone, onCancel }) {
  const el = document.createElement('div');
  el.className = 'lock';
  let value = '';
  let first = null;
  const head = () => {
    if (mode === 'create') return first ? 'Confírmalo.' : (title || 'Crea tu PIN.');
    return title || greeting();
  };
  const sub = () => {
    if (mode === 'create') return first ? 'Escríbelo otra vez.' : (subtitle || '4 dígitos para que nadie más vea tu plata.');
    return subtitle || 'Escribe tu PIN.';
  };
  const draw = () => {
    el.innerHTML = `
      <div class="avatar">L</div>
      <h2 class="mt12 center">${head()}</h2>
      <p class="muted small center" style="margin:0">${sub()}</p>
      <div class="pin-dots">${[0, 1, 2, 3].map((i) => `<span class="${i < value.length ? 'on' : ''}"></span>`).join('')}</div>
      <div class="keypad">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button class="key" data-k="${n}">${n}</button>`).join('')}
        ${onCancel ? '<button class="key txt" data-cancel>Cancelar</button>' : '<span class="key empty"></span>'}
        <button class="key" data-k="0">0</button>
        <button class="key txt" data-del aria-label="Borrar">${icon('back', 26)}</button>
      </div>`;
  };
  draw();
  const dots = () => $('.pin-dots', el);
  const fail = (msg) => {
    value = '';
    draw();
    dots().classList.add('shake');
    if (msg) $('p', el).textContent = msg;
    navigator.vibrate?.(60);
  };
  el.addEventListener('click', async (e) => {
    const k = e.target.closest('[data-k]');
    if (e.target.closest('[data-cancel]')) { el.remove(); onCancel?.(); return; }
    if (e.target.closest('[data-del]')) { value = value.slice(0, -1); draw(); return; }
    if (!k || value.length >= 4) return;
    value += k.dataset.k;
    draw();
    if (value.length < 4) return;
    if (mode === 'create') {
      if (!first) { first = value; value = ''; setTimeout(draw, 120); return; }
      if (first !== value) { first = null; fail('No coinciden. Empieza otra vez.'); return; }
      await setPin(value);
      setTimeout(() => { el.remove(); onDone?.(); }, 150);
    } else {
      if (await checkPin(value)) setTimeout(() => { el.remove(); onDone?.(); }, 120);
      else fail('Ese no es, mi llave. Intenta otra vez.');
    }
  });
  document.body.appendChild(el);
  return el;
}
