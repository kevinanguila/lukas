// Datos iniciales de Kevin (precarga). Todo es editable desde la app.

export const BLOCKS = {
  comp: { id: 'comp', name: 'Compromisos', short: 'Compromisos', color: 'var(--ring-violet)', hint: 'Fijos e innegociables' },
  ahorro: { id: 'ahorro', name: 'Ahorro y bolsillos', short: 'Ahorro', color: 'var(--ring-green)', hint: 'Mudanza, bolsillos y USD' },
  gastos: { id: 'gastos', name: 'Gastos', short: 'Gastos', color: 'var(--ring-orange)', hint: 'Variables con tope' },
  disp: { id: 'disp', name: 'Disponible', short: 'Disponible', color: 'var(--ring-teal)', hint: 'Tu plata sin culpa' },
};

const cat = (id, name, block, emoji, keywords, extra = {}) => ({ id, name, block, emoji, keywords, ...extra });

export function seedState() {
  return {
    version: 1,
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
    categories: [
      // Compromisos
      cat('pension', 'Pensión', 'comp', '🧓', ['pension', 'pensión', 'pila', 'aportes', 'seguridad social']),
      cat('pateos', 'Pateos', 'comp', '🛵', ['pateo', 'pateos', 'mototaxi', 'moto']),
      cat('internet', 'Internet', 'comp', '🌐', ['internet', 'wifi', 'fibra']),
      cat('celular', 'Celular', 'comp', '📱', ['celular', 'plan', 'datos', 'recarga']),
      cat('gas', 'Gas', 'comp', '🔥', ['gas', 'gases']),
      cat('servicios', 'Servicios', 'comp', '💡', ['luz', 'agua', 'energia', 'energía', 'servicios', 'aire']),
      cat('mama', 'Mamá', 'comp', '💛', ['mamá', 'mama', 'vieja', 'cucha', 'madre']),
      cat('subs', 'Suscripciones', 'comp', '🎧', ['spotify', 'netflix', 'hbo', 'max', 'icloud', 'youtube', 'disney', 'prime', 'suscripcion', 'suscripción', 'apple']),
      cat('gym', 'Gimnasio', 'comp', '🏋️', ['gym', 'gimnasio', 'gimnacio']),
      cat('cuidado', 'Cuidado personal', 'comp', '💈', ['motilada', 'motilar', 'motilé', 'peluqueria', 'peluquería', 'barberia', 'barbería', 'uñas', 'manicure', 'pedicure', 'corte']),
      cat('credito', 'Créditos', 'comp', '🏦', ['credito', 'crédito', 'cuota', 'prestamo', 'préstamo']),
      // Gastos (necesarios, con tope)
      cat('gasolina', 'Gasolina', 'gastos', '⛽', ['gasolina', 'tanqueo', 'tanquear', 'tanqueé', 'gasolinera', 'terpel', 'primax', 'combustible'], { cap: 180000, account: 'nu' }),
      cat('lavada', 'Lavada carro', 'gastos', '🚿', ['lavada', 'lavar', 'lavadero', 'lavé'], { cap: 40000, account: 'nu' }),
      cat('mercado', 'Mercado', 'gastos', '🛒', ['mercado', 'huevos', 'leche', 'olimpica', 'olímpica', 'exito', 'éxito', 'd1', 'ara', 'supermercado', 'pan', 'arroz'], { cap: 70000, account: 'nu' }),
      cat('imprevistos', 'Imprevistos', 'gastos', '⚠️', ['imprevisto', 'urgencia', 'arreglo', 'taller', 'mecanico', 'mecánico', 'llanta', 'daño'], { cap: 150000, account: 'nu' }),
      cat('transporte', 'Transporte', 'gastos', '🚕', ['uber', 'didi', 'taxi', 'bus', 'transmetro', 'peaje', 'parqueadero', 'parqueo', 'indriver'], { cap: 0 }),
      cat('salud', 'Salud', 'gastos', '💊', ['drogueria', 'droguería', 'farmacia', 'medicina', 'medico', 'médico', 'cita', 'pastillas'], { cap: 0 }),
      cat('hogar', 'Hogar', 'gastos', '🏠', ['hogar', 'casa', 'mueble', 'aseo', 'jabon', 'jabón', 'detergente'], { cap: 0 }),
      cat('eventos', 'Eventos', 'gastos', '🎟️', ['evento', 'boleta', 'concierto', 'salsa', 'entrada', 'festival'], { cap: 0 }),
      cat('regalos', 'Regalos', 'gastos', '🎁', ['regalo', 'regalos', 'navidad', 'cumpleaños', 'detalle', 'aniversario'], { cap: 0 }),
      cat('viajes', 'Viajes', 'gastos', '✈️', ['viaje', 'medellin', 'medellín', 'tiquete', 'hotel', 'airbnb', 'vuelo'], { cap: 0 }),
      // Disponible (gustos sin culpa)
      cat('comida', 'Comida afuera', 'disp', '🍔', ['almuerzo', 'desayuno', 'cena', 'restaurante', 'comida', 'hamburguesa', 'pizza', 'perro', 'empanada', 'arepa', 'salchipapa', 'asado', 'pollo', 'sushi', 'fritos']),
      cat('domicilios', 'Domicilios', 'disp', '📦', ['domicilio', 'domicilios', 'rappi', 'ifood', 'pedido']),
      cat('salidas', 'Salidas', 'disp', '🍻', ['frias', 'frías', 'cerveza', 'cervezas', 'rumba', 'bar', 'discoteca', 'salida', 'trago', 'tragos', 'polas', 'guaro', 'ron', 'whisky', 'plan']),
      cat('ropa', 'Ropa', 'disp', '👕', ['ropa', 'camisa', 'camiseta', 'zapatos', 'tenis', 'pantalon', 'pantalón', 'shein', 'gorra', 'short']),
      cat('antojos', 'Antojos', 'disp', '🍫', ['antojo', 'dulce', 'helado', 'cafe', 'café', 'snack', 'mecato', 'galletas', 'gaseosa', 'jugo', 'tienda']),
      cat('ocio', 'Ocio', 'disp', '🎮', ['cine', 'juego', 'videojuego', 'ocio', 'play', 'bolos']),
      cat('compras', 'Compras', 'disp', '🛍️', ['amazon', 'compra', 'temu', 'mercadolibre', 'aliexpress', 'gadget']),
      // Ingresos
      cat('sueldo', 'Sueldo', 'ingreso', '💼', ['sueldo', 'salario', 'pago', 'deel', 'yaca', 'pagaron', 'quincena', 'nomina', 'nómina']),
      cat('reembolso', 'Reembolso', 'ingreso', '↩️', ['reembolso', 'devolucion', 'devolución', 'reintegro']),
      cat('otros_ing', 'Otros ingresos', 'ingreso', '✨', ['regalaron', 'gane', 'gané', 'venta', 'vendí', 'extra']),
    ],
    // Compromisos recurrentes (checklist del periodo)
    recurring: [
      { id: 'r_pension', name: 'Pensión', amount: 280000, account: 'nu', category: 'pension', day: null, active: false, note: 'En pausa por ahora' },
      { id: 'r_pateos', name: 'Pateos', amount: 104000, account: 'nequi', category: 'pateos', day: null, active: true, note: '~2 por semana × $12.000' },
      { id: 'r_internet', name: 'Internet', amount: 155000, account: 'nequi', category: 'internet', day: 20, active: true, note: 'Lo cubre el bono' },
      { id: 'r_celular', name: 'Celular', amount: 50000, account: 'nequi', category: 'celular', day: 25, active: true, note: 'Ciclo de 30 días' },
      { id: 'r_gas', name: 'Gas', amount: 85000, account: 'nequi', category: 'gas', day: 12, active: true },
      { id: 'r_mama', name: 'Mamá', amount: 600000, account: 'nequi', category: 'mama', day: null, active: true },
      { id: 'r_spotify', name: 'Spotify', amount: 25000, account: 'nequi', category: 'subs', day: 30, active: true },
      { id: 'r_icloud', name: 'iCloud', amount: 13000, account: 'nequi', category: 'subs', day: null, active: true },
      { id: 'r_hbo', name: 'HBO', amount: 11000, account: 'nequi', category: 'subs', day: 7, active: true },
      { id: 'r_gym', name: 'Gimnasio', amount: 80000, account: 'nequi', category: 'gym', day: null, active: true },
      { id: 'r_motiladas', name: 'Motiladas', amount: 50000, account: 'nequi', category: 'cuidado', day: null, active: true, note: '2 al mes × $25.000' },
      { id: 'r_unas', name: 'Uñas', amount: 35000, account: 'nequi', category: 'cuidado', day: null, active: true },
    ],
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
      pockets: { p_standby: 600000, p_medellin: 0, p_navidad: 0 },
    },
    plans: {}, // por periodo: { incomeCOP, giroNequi, pockets:{}, steps:{} }
    transactions: [],
    debts: [],
    learned: {}, // palabra → categoría aprendida
    chat: [],
  };
}

// Plan de noviembre 2026 (ya ocurrido antes de usar la app): sirve de punto de partida
export const NOV_2026 = {
  income: { usd: 1630, cop: 5000000, date: '2026-10-30' },
  pockets: { p_mudanza: 896000, p_standby: 600000, p_medellin: 500000, p_navidad: 400000 },
};
