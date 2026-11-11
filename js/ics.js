// Exporta los vencimientos al Calendario del iPhone (.ics con alarmas)
import { S } from './store.js';
import { payDate, iso, todayISO } from './dates.js';
import { toast, sheet, $ } from './ui.js';
import { fmt } from './money.js';

const pad = (n) => String(n).padStart(2, '0');
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
const dt = (dateISO, h = 9) => `${dateISO.replace(/-/g, '')}T${pad(h)}0000`;
const escText = (s) => String(s).replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');

function event({ uid, date, title, desc, rrule }) {
  return [
    'BEGIN:VEVENT',
    `UID:${uid}@lukas`,
    `DTSTAMP:${stamp()}`,
    `DTSTART:${dt(date, 9)}`,
    `DTEND:${dt(date, 9).replace('T09', 'T0930').slice(0, 15)}`,
    `SUMMARY:${escText(title)}`,
    desc ? `DESCRIPTION:${escText(desc)}` : null,
    rrule ? `RRULE:${rrule}` : null,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escText(title)}`, 'TRIGGER:PT0M', 'END:VALARM',
    'END:VEVENT',
  ].filter(Boolean).join('\r\n');
}

export function buildICS() {
  const st = S();
  const t = todayISO();
  const [y, m] = t.split('-').map(Number);
  const events = [];
  // Compromisos con día fijo: evento mensual recurrente
  for (const r of st.recurring.filter((r) => r.active && r.day)) {
    let start = `${y}-${pad(m)}-${pad(Math.min(r.day, 28))}`;
    if (r.day > 28) start = `${y}-${pad(m)}-${pad(r.day)}`;
    if (start < t) {
      const nm = m === 12 ? 1 : m + 1, ny = m === 12 ? y + 1 : y;
      start = `${ny}-${pad(nm)}-${pad(Math.min(r.day, 28))}`;
    }
    events.push(event({
      uid: r.id,
      date: start,
      title: `Lukas: pagar ${r.name} (${fmt(r.amount)})`,
      desc: `Ey mi rey, hoy toca ${r.name}. Sale de ${st.accounts.find((a) => a.id === r.account)?.name}. Cuando lo pagues, márcalo en Lukas: ¡ya salimos de una!`,
      rrule: `FREQ=MONTHLY;BYMONTHDAY=${r.day}`,
    }));
  }
  // Días de pago de los próximos 12 meses (calculados con festivos)
  for (let i = 1; i <= 12; i++) {
    const tt = y * 12 + (m - 1) + i;
    const d = iso(payDate(Math.floor(tt / 12), (tt % 12) + 1));
    events.push(event({ uid: `pay-${d}`, date: d, title: '¡Yaca! Día de pago', desc: 'Abre Lukas, registra el pago de Deel y arma el reparto: giro a Nequi y bolsillos en NU.' }));
  }
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lukas//ES', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Lukas', ...events, 'END:VCALENDAR'].join('\r\n');
}

export async function downloadICS() {
  const ics = buildICS();
  const file = new File([ics], 'lukas-pagos.ics', { type: 'text/calendar' });
  const s = sheet(`
    <h3 class="sheet-title">Al Calendario.</h3>
    <p class="small muted" style="margin:0 4px 16px">Se crean tus compromisos con día fijo (cada mes, con alarma a las 9 a. m.) y tus próximos 12 días de pago. En el iPhone toca «Agregar todo».</p>
    <div class="stack gap12">
      <button class="btn btn-primary" id="open">Abrir en Calendario</button>
      ${navigator.canShare?.({ files: [file] }) ? '<button class="btn btn-secondary" id="share">Compartir archivo</button>' : ''}
      <button class="btn btn-ghost" data-close>Cancelar</button>
    </div>`);
  $('#open', s.el).addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
    a.download = 'lukas-pagos.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    s.close();
  });
  $('#share', s.el)?.addEventListener('click', async () => {
    try { await navigator.share({ files: [file], title: 'Pagos Lukas' }); s.close(); } catch { /* cancelado */ }
  });
}
