// Arranque, navegación por pestañas y bloqueo con PIN.
import * as st from './store.js';
import { nav } from './nav.js';
import { icon, $, toast } from './ui.js';
import { hasPin, pinScreen } from './pin.js';
import * as home from './views/home.js';
import * as movs from './views/movs.js';
import * as chat from './views/chat.js';
import * as plan from './views/plan.js';
import * as settings from './views/settings.js';
import { openTxForm } from './views/txform.js';
import { openPayday, openGiro } from './views/payday.js';
import { startOnboarding } from './views/onboarding.js';
import { doBackup } from './views/settings.js';

const views = { home, movs, chat, plan, settings };
const app = document.getElementById('app');

function tabbar() {
  const t = (id, ic, label) => `<button class="tab ${nav.route === id ? 'on' : ''}" data-tab="${id}" aria-label="${label}">${icon(ic, 25)}<span>${label}</span></button>`;
  return `<nav class="tabbar"><div class="tabbar-inner">
    ${t('home', 'home', 'Inicio')}
    ${t('movs', 'list', 'Movimientos')}
    <button class="tab-plus" data-plus aria-label="Registrar">${icon('plus', 28)}</button>
    ${t('chat', 'chat', 'Lukas')}
    ${t('plan', 'plan', 'Plan')}
  </div></nav>`;
}

function render() {
  const v = views[nav.route] || home;
  const scroll = window.scrollY;
  app.innerHTML = `<main id="view">${v.render(nav.params)}</main>${tabbar()}`;
  v.bind?.($('#view'), nav.params);
  if (nav.keepScroll) window.scrollTo(0, scroll);
  nav.keepScroll = false;
}

nav.go = (route, params = {}) => {
  nav.route = route;
  nav.params = params;
  window.scrollTo(0, 0);
  render();
};
nav.refresh = () => { nav.keepScroll = true; render(); };

// Acciones que vienen de los consejos de Lukas
nav.action = (what) => {
  if (what === 'payday') return openPayday();
  if (what === 'giro') return openGiro();
  if (what === 'checklist') { nav.go('home'); setTimeout(() => document.getElementById('checklist')?.scrollIntoView({ behavior: 'smooth' }), 50); return; }
  if (what === 'pockets') return nav.go('plan', { tab: 'pockets' });
  if (what === 'backup') return doBackup();
  if (what === 'chat') return nav.go('chat');
  if (what === 'settings') return nav.go('settings');
};

app.addEventListener('click', (e) => {
  const tab = e.target.closest('[data-tab]');
  if (tab) { nav.go(tab.dataset.tab); return; }
  if (e.target.closest('[data-plus]')) { openTxForm(); return; }
  const act = e.target.closest('[data-action]');
  if (act) nav.action(act.dataset.action);
});

st.onChange(() => {});

// Bloqueo al volver después de un rato
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) hiddenAt = Date.now();
  else if (hasPin() && hiddenAt && Date.now() - hiddenAt > 60000 && !document.querySelector('.lock')) pinScreen({ onDone: render });
});

function start() {
  st.load();
  if (!st.S().onboarded) {
    startOnboarding(() => render());
    return;
  }
  render();
  if (hasPin()) pinScreen({ onDone: () => {} });
  // Nuevo periodo: Lukas te recibe con el día de pago
  const p = st.currentPeriod();
  if (st.S().settings.lastSeenPeriod !== p.key) {
    const firstTime = !st.S().settings.lastSeenPeriod;
    st.S().settings.lastSeenPeriod = p.key;
    st.save();
    if (!firstTime && !st.paydayDone(p)) setTimeout(() => toast('¡Yaca! Arrancó un mes nuevo. Registra el pago.'), 800);
  }
}

start();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
