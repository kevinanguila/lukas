// Datos iniciales de Kevin (precarga). Todo es editable desde la app.
//
// Categorías en dos niveles:
//   Grupo (categoría)  → lo que ves en el resumen, el presupuesto y los anillos.
//   Detalle (ítem)     → cada cosa concreta, con su tope, su día de pago y si está paga o no.

export const BLOCKS = {
  comp: { id: 'comp', name: 'Compromisos', short: 'Compromisos', color: 'var(--ring-violet)', hint: 'Fijos e innegociables' },
  ahorro: { id: 'ahorro', name: 'Ahorro y bolsillos', short: 'Ahorro', color: 'var(--ring-green)', hint: 'Mudanza, bolsillos y USD' },
  gastos: { id: 'gastos', name: 'Gastos', short: 'Gastos', color: 'var(--ring-orange)', hint: 'Necesarios, con tope' },
  disp: { id: 'disp', name: 'Disponible', short: 'Disponible', color: 'var(--ring-teal)', hint: 'Tu plata sin culpa' },
};

export const SEED_VERSION = 2;

const it = (id, name, emoji, keywords, extra = {}) => ({ id, name, emoji, keywords, ...extra });
const cat = (id, name, block, emoji, items, extra = {}) => ({ id, name, block, emoji, items, keywords: [], ...extra });

export function seedCategories() {
  return [
    // ---------- Compromisos ----------
    cat('suscripciones', 'Suscripciones', 'comp', '📺', [
      it('spotify', 'Spotify', '🎧', ['spotify']),
      it('icloud', 'iCloud', '☁️', ['icloud', 'icloud+', 'almacenamiento apple']),
      it('hbo', 'HBO', '🎬', ['hbo', 'max', 'hbo max']),
      it('claude', 'Claude', '✳️', ['claude', 'anthropic']),
      it('otra_sub', 'Otra suscripción', '📲', ['netflix', 'youtube', 'disney', 'prime', 'suscripcion', 'suscripción', 'membresia', 'membresía', 'chatgpt', 'apple music']),
    ]),
    cat('cuidado', 'Cuidado personal', 'comp', '💈', [
      it('motiladas', 'Motiladas', '💇🏽‍♂️', ['motilada', 'motiladas', 'motilar', 'motile', 'motilé', 'peluqueria', 'peluquería', 'barberia', 'barbería', 'barbero', 'corte', 'cerquillo']),
      it('unas', 'Uñas', '💅🏽', ['uñas', 'manicure', 'pedicure', 'manicurista']),
      it('gym', 'Gimnasio', '🏋️', ['gym', 'gimnasio', 'gimnacio', 'mensualidad gym']),
      it('aseo_personal', 'Aseo personal', '🧴', ['desodorante', 'shampoo', 'champu', 'champú', 'crema', 'perfume', 'colonia', 'cuchilla', 'afeitar', 'jabon de baño', 'cepillo', 'crema dental']),
    ]),
    cat('hogar', 'Hogar y servicios', 'comp', '🏠', [
      it('internet', 'Internet', '🌐', ['internet', 'wifi', 'fibra', 'claro hogar', 'tigo']),
      it('gas', 'Gas', '🔥', ['gas', 'gases', 'recibo del gas']),
      it('celular', 'Celular', '📱', ['celular', 'plan del cel', 'plan', 'datos', 'recarga', 'minutos']),
      it('servicios', 'Luz y agua', '💡', ['luz', 'agua', 'energia', 'energía', 'air-e', 'aire', 'triple a', 'acueducto', 'servicios', 'recibo']),
    ]),
    cat('familia', 'Familia', 'comp', '💛', [
      it('mama', 'Mamá', '💛', ['mamá', 'mama', 'vieja', 'cucha', 'madre', 'jefa']),
      it('familia_otro', 'Otros familiares', '👨‍👩‍👧', ['sobrina', 'sobrinas', 'hermano', 'hermana', 'papá', 'papa', 'abuela', 'tia', 'tía', 'primo', 'prima']),
    ]),
    cat('seguridad', 'Seguridad social', 'comp', '🧓', [
      it('pension', 'Pensión', '🧓', ['pension', 'pensión', 'pila', 'aportes', 'seguridad social', 'planilla']),
    ]),
    cat('creditos', 'Créditos', 'comp', '🏦', [
      it('credito', 'Cuota de crédito', '🏦', ['credito', 'crédito', 'cuota', 'prestamo', 'préstamo', 'tarjeta de credito', 'abono']),
    ]),

    // ---------- Gastos (necesarios, con tope) ----------
    cat('transporte', 'Transporte', 'gastos', '🚗', [
      it('gasolina', 'Gasolina', '⛽', ['gasolina', 'tanqueo', 'tanquear', 'tanquee', 'tanqueé', 'tanquie', 'tankie', 'tankee', 'gasolinera', 'terpel', 'primax', 'combustible', 'echar gasolina'], { cap: 180000, account: 'nu' }),
      it('lavada', 'Lavada del carro', '🚿', ['lavada', 'lavar el carro', 'lavadero', 'lave el carro', 'lavé el carro', 'lavaron'], { cap: 40000, account: 'nu' }),
      it('pateos', 'Pateos', '🛵', ['pateo', 'pateos', 'mototaxi', 'moto']),
      it('taxi', 'Taxi / Uber / bus', '🚕', ['uber', 'didi', 'taxi', 'bus', 'transmetro', 'indriver', 'indrive', 'cabify', 'buseta', 'colectivo']),
      it('carro', 'Peajes, parqueo y taller', '🅿️', ['peaje', 'parqueadero', 'parqueo', 'taller', 'mecanico', 'mecánico', 'llanta', 'aceite', 'soat', 'tecnomecanica', 'tecnomecánica', 'revision']),
    ]),
    cat('mercado', 'Mercado', 'gastos', '🛒', [
      it('mercado', 'Mercado', '🛒', ['mercado', 'huevos', 'leche', 'olimpica', 'olímpica', 'exito', 'éxito', 'd1', 'ara', 'supermercado', 'pan', 'arroz', 'carne', 'pollo crudo', 'verduras', 'fruta', 'frutas', 'isimo', 'jumbo'], { cap: 70000, account: 'nu' }),
    ]),
    cat('imprevistos', 'Imprevistos', 'gastos', '⚠️', [
      it('imprevisto', 'Imprevistos', '⚠️', ['imprevisto', 'imprevistos', 'urgencia', 'emergencia', 'arreglo', 'daño', 'se daño', 'se dañó', 'multa', 'comparendo'], { cap: 150000, account: 'nu' }),
    ]),
    cat('salud', 'Salud', 'gastos', '💊', [
      it('salud', 'Droguería y médico', '💊', ['drogueria', 'droguería', 'farmacia', 'medicina', 'medicamento', 'medico', 'médico', 'cita', 'pastillas', 'odontologo', 'odontólogo', 'examen', 'laboratorio']),
    ]),
    cat('casa', 'Cosas de la casa', 'gastos', '🧹', [
      it('casa', 'Aseo y cosas de la casa', '🧹', ['aseo', 'detergente', 'jabon', 'jabón', 'mueble', 'escoba', 'trapero', 'bombillo', 'ferreteria', 'ferretería', 'papel higienico', 'papel higiénico']),
    ]),
    cat('eventos', 'Eventos y regalos', 'gastos', '🎁', [
      it('eventos', 'Eventos', '🎟️', ['evento', 'boleta', 'boletas', 'concierto', 'salsa', 'viva la salsa', 'entrada', 'festival', 'carnaval', 'halloween']),
      it('regalos', 'Regalos', '🎁', ['regalo', 'regalos', 'navidad', 'cumpleaños', 'cumple', 'detalle', 'aniversario', 'amor y amistad']),
    ]),
    cat('viajes', 'Viajes', 'gastos', '✈️', [
      it('viajes', 'Viajes', '✈️', ['viaje', 'medellin', 'medellín', 'tiquete', 'tiquetes', 'hotel', 'airbnb', 'vuelo', 'hospedaje']),
    ]),

    // ---------- Disponible (gustos sin culpa) ----------
    cat('comida', 'Comida y antojos', 'disp', '🍔', [
      it('comida', 'Comida afuera', '🍔', ['almuerzo', 'almuerzé', 'almorce', 'almorcé', 'almorze', 'desayuno', 'desayune', 'desayuné', 'cena', 'cene', 'cené', 'comida', 'restaurante', 'corrientazo', 'hamburguesa', 'pizza', 'perro', 'perro caliente', 'empanada', 'arepa', 'salchipapa', 'asado', 'pollo', 'sushi', 'fritos', 'chuzo', 'shawarma', 'comi', 'comí', 'comer']),
      it('domicilios', 'Domicilios', '📦', ['domicilio', 'domicilios', 'rappi', 'ifood', 'pedido', 'pedi', 'pedí']),
      it('antojos', 'Antojos', '🍫', ['antojo', 'antojos', 'dulce', 'helado', 'cafe', 'café', 'snack', 'mecato', 'galletas', 'gaseosa', 'jugo', 'tienda', 'raspao', 'chicle', 'paleta']),
    ]),
    cat('salidas', 'Salidas y ocio', 'disp', '🍻', [
      it('salidas', 'Salidas', '🍻', ['frias', 'frías', 'fria', 'cerveza', 'cervezas', 'birra', 'rumba', 'bar', 'discoteca', 'salida', 'sali', 'salí', 'trago', 'tragos', 'polas', 'pola', 'guaro', 'ron', 'whisky', 'plan', 'parche', 'farra', 'estanco']),
      it('ocio', 'Ocio', '🎮', ['cine', 'pelicula', 'película', 'juego', 'videojuego', 'ocio', 'play', 'bolos', 'billar', 'karaoke']),
    ]),
    cat('compras', 'Compras y ropa', 'disp', '🛍️', [
      it('ropa', 'Ropa', '👕', ['ropa', 'camisa', 'camiseta', 'zapatos', 'tenis', 'pantalon', 'pantalón', 'shein', 'gorra', 'short', 'jean', 'medias', 'boxer', 'bermuda']),
      it('compras', 'Compras', '🛍️', ['amazon', 'compra', 'compré', 'temu', 'mercadolibre', 'mercado libre', 'aliexpress', 'gadget', 'audifonos', 'audífonos', 'cargador', 'accesorio']),
    ]),

    // ---------- Ingresos ----------
    cat('sueldo', 'Sueldo', 'ingreso', '💼', [it('sueldo', 'Sueldo', '💼', ['sueldo', 'salario', 'pago', 'deel', 'yaca', 'pagaron', 'nomina', 'nómina'])]),
    cat('reembolso', 'Reembolso', 'ingreso', '↩️', [it('reembolso', 'Reembolso', '↩️', ['reembolso', 'devolucion', 'devolución', 'reintegro', 'devolvieron'])]),
    cat('otros_ing', 'Otros ingresos', 'ingreso', '✨', [it('otros_ing', 'Otros ingresos', '✨', ['regalaron', 'gane', 'gané', 'venta', 'vendi', 'vendí', 'extra', 'freelance', 'trabajito'])]),
  ];
}

export function seedRecurring() {
  return [
    { id: 'r_pension', name: 'Pensión', amount: 280000, account: 'nu', category: 'seguridad', item: 'pension', day: null, active: false, note: 'En pausa por ahora' },
    { id: 'r_pateos', name: 'Pateos', amount: 104000, account: 'nequi', category: 'transporte', item: 'pateos', day: null, active: true, note: '~2 por semana × $12.000' },
    { id: 'r_internet', name: 'Internet', amount: 155000, account: 'nequi', category: 'hogar', item: 'internet', day: 20, active: true, note: 'Lo cubre el bono' },
    { id: 'r_celular', name: 'Celular', amount: 50000, account: 'nequi', category: 'hogar', item: 'celular', day: 25, active: true, note: 'Ciclo de 30 días' },
    { id: 'r_gas', name: 'Gas', amount: 85000, account: 'nequi', category: 'hogar', item: 'gas', day: 12, active: true },
    { id: 'r_mama', name: 'Mamá', amount: 600000, account: 'nequi', category: 'familia', item: 'mama', day: null, active: true },
    { id: 'r_spotify', name: 'Spotify', amount: 25000, account: 'nequi', category: 'suscripciones', item: 'spotify', day: 30, active: true },
    { id: 'r_icloud', name: 'iCloud', amount: 13000, account: 'nequi', category: 'suscripciones', item: 'icloud', day: null, active: true },
    { id: 'r_hbo', name: 'HBO', amount: 11000, account: 'nequi', category: 'suscripciones', item: 'hbo', day: 7, active: true },
    { id: 'r_claude', name: 'Claude', amount: 66000, account: 'nu', category: 'suscripciones', item: 'claude', day: 10, active: true },
    { id: 'r_gym', name: 'Gimnasio', amount: 80000, account: 'nequi', category: 'cuidado', item: 'gym', day: null, active: true },
    { id: 'r_motiladas', name: 'Motiladas', amount: 50000, account: 'nequi', category: 'cuidado', item: 'motiladas', day: null, active: true, note: '2 al mes × $25.000' },
    { id: 'r_unas', name: 'Uñas', amount: 35000, account: 'nequi', category: 'cuidado', item: 'unas', day: null, active: true },
  ];
}

export function seedState() {
  return {
    version: SEED_VERSION,
    createdAt: new Date().toISOString(),
    onboarded: false,
    settings: {
      name: 'Kevin',
      pin: null, // { salt, hash }
      lastBackup: null,
      disponible: 550000,
      fallbackRate: 3067, // COP por USD, se actualiza con cada pago
      monthlyUSD: 1630,
      lastSeenPeriod: null,
      nequiGMF: true, // ¿Nequi te cobra 4x1000?
      dismissed: {},
    },
    accounts: [
      { id: 'nu', name: 'NU', currency: 'COP', role: 'Centro: recibe el sueldo y guarda los bolsillos', color: '#8668ff', initial: 0, order: 1 },
      { id: 'nequi', name: 'Nequi', currency: 'COP', role: 'Compromisos y Disponible', color: '#00a1b3', initial: 0, order: 2 },
      { id: 'bancolombia', name: 'Bancolombia', currency: 'COP', role: 'Respaldo, PSE y compras online', color: '#ed6300', initial: 0, order: 3 },
      { id: 'arq', name: 'ARQ', currency: 'USD', role: 'Ahorro en dólares', color: '#03aa49', initial: 0, order: 4 },
    ],
    categories: seedCategories(),
    recurring: seedRecurring(),
    // Bolsillos virtuales (viven dentro de una cuenta real)
    pockets: [
      { id: 'p_mudanza', name: 'Mudanza', emoji: '📦', account: 'nu', target: 0, deadline: '2027-01-15', main: true, note: 'Itagüí o Envigado · por ahora también es tu emergencia' },
      { id: 'p_standby', name: 'Stand-by', emoji: '⏸️', account: 'nu', target: 0, deadline: null, periodic: true, note: 'Planes por definir. Lo que sobre se va a la mudanza' },
      { id: 'p_medellin', name: 'Medellín', emoji: '🚠', account: 'nu', target: 500000, deadline: '2026-12-05', note: 'Todo pago: esto es pa\' gastar allá' },
      { id: 'p_navidad', name: 'Navidad', emoji: '🎄', account: 'nu', target: 400000, deadline: '2026-12-24', note: 'Regalos pedidos con tiempo' },
    ],
    // Plantilla del reparto del día de pago (montos sugeridos)
    planTemplate: {
      arqUSD: 0,
      pockets: { p_standby: 600000, p_medellin: 500000, p_navidad: 400000 },
    },
    plans: {}, // por periodo
    transactions: [],
    debts: [],
    learned: {}, // palabra → "categoria/item" aprendido
    chat: [],
    chatPending: null, // borrador esperando un dato (monto, categoría…)
  };
}

// Migración de la versión 1 (categorías planas) a la 2 (grupos con detalle)
export const V1_MAP = {
  pension: ['seguridad', 'pension'], pateos: ['transporte', 'pateos'], internet: ['hogar', 'internet'], celular: ['hogar', 'celular'],
  gas: ['hogar', 'gas'], servicios: ['hogar', 'servicios'], mama: ['familia', 'mama'], subs: ['suscripciones', 'otra_sub'],
  gym: ['cuidado', 'gym'], cuidado: ['cuidado', 'motiladas'], credito: ['creditos', 'credito'], gasolina: ['transporte', 'gasolina'],
  lavada: ['transporte', 'lavada'], mercado: ['mercado', 'mercado'], imprevistos: ['imprevistos', 'imprevisto'], transporte: ['transporte', 'taxi'],
  salud: ['salud', 'salud'], hogar: ['casa', 'casa'], eventos: ['eventos', 'eventos'], regalos: ['eventos', 'regalos'], viajes: ['viajes', 'viajes'],
  comida: ['comida', 'comida'], domicilios: ['comida', 'domicilios'], salidas: ['salidas', 'salidas'], ropa: ['compras', 'ropa'],
  antojos: ['comida', 'antojos'], ocio: ['salidas', 'ocio'], compras: ['compras', 'compras'], sueldo: ['sueldo', 'sueldo'],
  reembolso: ['reembolso', 'reembolso'], otros_ing: ['otros_ing', 'otros_ing'],
};
