'use strict';

/* ==========================================================
   CONFIGURACIÓN: cambia aquí los valores por defecto
   (también se pueden cambiar jugando, con el botón "Configurar")
   ========================================================== */
const CONFIG_POR_DEFECTO = {
  tiempo: 20, // segundos para encontrar todos los pares
  pares: 6,   // cantidad de pares en el tablero
};

const CARTAS = [
  { id: 'lucky',     alt: 'Grupo Lucky',               img: 'img/lucky.png' },
  { id: 'sonrisa',   alt: 'Carita sonriente',          img: 'img/sonrisa.png' },
  { id: 'equipo',    alt: 'Trabajo en equipo',         img: 'img/equipo.png' },
  { id: 'logros',    alt: 'Grandes logros',            img: 'img/logros.png' },
  { id: 'positivo',  alt: 'Siempre positivo',          img: 'img/positivo.png' },
  { id: 'fuertes',   alt: 'Juntos somos más fuertes',  img: 'img/fuertes.png' },
  { id: 'cohete',    alt: 'Suena, cree, logra',        img: 'img/cohete.png' },
  { id: 'ideas',     alt: 'Buenas ideas',              img: 'img/ideas.png' },
  { id: 'tu-puedes', alt: 'Tú puedes',                 img: 'img/tu-puedes.png' },
  { id: 'gracias',   alt: 'Gracias por tu esfuerzo',   img: 'img/gracias.png' },
  { id: 'vamos',     alt: 'Vamos por más',             img: 'img/vamos.png' },
];

const REVERSO = 'img/reverso.png';

const LIMITES = {
  tiempoMin: 5,
  tiempoMax: 600,
  paresMin: 2,
  paresMax: CARTAS.length,
};

const RETARDO_ERROR_MS = 800;
const CLAVE_GUARDADO = 'memoria-lucky-config';

// pares -> columnas en pantallas grandes
const COLUMNAS = { 2: 2, 3: 3, 4: 4, 5: 5, 6: 4, 7: 5, 8: 4, 9: 6, 10: 5, 11: 6 };

/* ==========================================================
   REFERENCIAS AL DOM
   ========================================================== */
const $ = (id) => document.getElementById(id);

const tablero     = $('tablero');
const paresEl     = $('pares');
const intentosEl  = $('intentos');
const mensajeEl   = $('mensaje');
const relojEl     = $('reloj');
const progresoEl  = $('progreso');
const segundosEl  = $('segundos');
const dlgConfig   = $('dlg-config');
const formConfig  = $('form-config');
const inTiempo    = $('in-tiempo');
const inPares     = $('in-pares');
const dlgFin      = $('dlg-fin');
const finTitulo   = $('fin-titulo');
const finTexto    = $('fin-texto');
const confetiEl   = $('confeti');

const ALT = Object.fromEntries(CARTAS.map((c) => [c.id, c.alt]));

/* ==========================================================
   ESTADO
   ========================================================== */
const estado = {
  config: cargarConfig(),
  seleccion: [],
  bloqueado: false,
  iniciado: false,
  terminado: false,
  totalPares: 0,
  paresHallados: 0,
  intentos: 0,
  finMs: 0,
  raf: null,
  esperas: new Set(),
};

/* ==========================================================
   UTILIDADES
   ========================================================== */
function barajar(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function limitar(valor, min, max, porDefecto) {
  const n = Math.round(Number(valor));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : porDefecto;
}

function normalizarConfig(cfg = {}) {
  return {
    tiempo: limitar(cfg.tiempo, LIMITES.tiempoMin, LIMITES.tiempoMax, CONFIG_POR_DEFECTO.tiempo),
    pares: limitar(cfg.pares, LIMITES.paresMin, LIMITES.paresMax, CONFIG_POR_DEFECTO.pares),
  };
}

function cargarConfig() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_GUARDADO));
    return normalizarConfig(guardado ?? CONFIG_POR_DEFECTO);
  } catch {
    return normalizarConfig(CONFIG_POR_DEFECTO);
  }
}

function guardarConfig(cfg) {
  try {
    localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(cfg));
  } catch {
    /* sin almacenamiento disponible: se ignora */
  }
}

function esperar(fn, ms) {
  const id = setTimeout(() => {
    estado.esperas.delete(id);
    fn();
  }, ms);
  estado.esperas.add(id);
}

function limpiarEsperas() {
  estado.esperas.forEach(clearTimeout);
  estado.esperas.clear();
}

function plural(n, singular, pluralTxt) {
  return `${n} ${n === 1 ? singular : pluralTxt}`;
}

/* ==========================================================
   TABLERO
   ========================================================== */
function crearCarta(carta, indice) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'carta';
  el.dataset.id = carta.id;
  el.style.setProperty('--i', indice);
  el.setAttribute('aria-label', 'Carta boca abajo');
  el.innerHTML = `
    <span class="carta-interior">
      <span class="cara dorso"><img src="${REVERSO}" alt="" draggable="false"></span>
      <span class="cara frente"><img src="${carta.img}" alt="${carta.alt}" draggable="false"></span>
    </span>`;
  return el;
}

function columnasPara(pares) {
  const movil = window.matchMedia('(max-width: 600px)').matches;
  if (!movil) return COLUMNAS[pares] ?? 4;
  if (pares === 2) return 2;
  return pares <= 3 ? 3 : 4;
}

function aplicarDisposicion() {
  const total = estado.totalPares * 2;
  const cols = columnasPara(estado.totalPares);
  tablero.style.setProperty('--cols', cols);
  tablero.style.setProperty('--filas', Math.ceil(total / cols));
}

function construirTablero() {
  const elegidas = barajar(CARTAS).slice(0, estado.config.pares);
  const mazo = barajar([...elegidas, ...elegidas]);

  estado.totalPares = elegidas.length;
  tablero.replaceChildren(...mazo.map(crearCarta));
  aplicarDisposicion();
}

function mostrar(carta) {
  carta.classList.add('volteada');
  carta.setAttribute('aria-label', `Carta: ${ALT[carta.dataset.id]}`);
}

function ocultar(carta) {
  carta.classList.remove('volteada', 'error');
  carta.setAttribute('aria-label', 'Carta boca abajo');
}

/* ==========================================================
   MARCADOR Y RELOJ
   ========================================================== */
function actualizarMarcador() {
  paresEl.textContent = `${estado.paresHallados}/${estado.totalPares}`;
  intentosEl.textContent = estado.intentos;
}

function formatearTiempo(seg) {
  if (seg < 60) return String(seg);
  return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
}

function pintarReloj(restanteMs) {
  const limiteMs = estado.config.tiempo * 1000;
  const restante = Math.max(0, restanteMs);
  const umbralUrgente = Math.min(5000, limiteMs * 0.3);

  segundosEl.textContent = formatearTiempo(Math.ceil(restante / 1000));
  progresoEl.style.strokeDashoffset = String(100 * (1 - restante / limiteMs));
  progresoEl.style.opacity = restante > 0 ? '1' : '0';
  relojEl.classList.toggle('urgente', restante > 0 && restante <= umbralUrgente);
}

function tick() {
  const restante = estado.finMs - performance.now();
  if (restante <= 0) {
    pintarReloj(0);
    perder();
    return;
  }
  pintarReloj(restante);
  estado.raf = requestAnimationFrame(tick);
}

function iniciarReloj() {
  estado.iniciado = true;
  estado.finMs = performance.now() + estado.config.tiempo * 1000;
  mensajeEl.textContent = '¡El tiempo corre!';
  estado.raf = requestAnimationFrame(tick);
}

function detenerReloj() {
  if (estado.raf !== null) cancelAnimationFrame(estado.raf);
  estado.raf = null;
}

/* ==========================================================
   JUGADA
   ========================================================== */
function voltear(carta) {
  if (estado.bloqueado || estado.terminado) return;
  if (carta.disabled || carta.classList.contains('volteada')) return;

  if (!estado.iniciado) iniciarReloj();

  mostrar(carta);
  estado.seleccion.push(carta);

  if (estado.seleccion.length === 2) evaluarPareja();
}

function evaluarPareja() {
  const [a, b] = estado.seleccion;
  estado.intentos++;

  if (a.dataset.id === b.dataset.id) {
    [a, b].forEach((c) => {
      c.classList.add('acertada');
      c.disabled = true;
    });
    estado.paresHallados++;
    estado.seleccion = [];
    actualizarMarcador();

    if (estado.paresHallados === estado.totalPares) ganar();
    return;
  }

  estado.bloqueado = true;
  actualizarMarcador();
  [a, b].forEach((c) => c.classList.add('error'));

  esperar(() => {
    [a, b].forEach(ocultar);
    estado.seleccion = [];
    estado.bloqueado = false;
  }, RETARDO_ERROR_MS);
}

/* ==========================================================
   FIN DE PARTIDA
   ========================================================== */
function ganar() {
  estado.terminado = true;
  const sobraMs = Math.max(0, estado.finMs - performance.now());
  detenerReloj();
  relojEl.classList.remove('urgente');
  mensajeEl.textContent = '¡Los encontraste todos!';

  esperar(() => mostrarFin(true, Math.floor(sobraMs / 1000)), 900);
}

function perder() {
  estado.terminado = true;
  estado.bloqueado = true;
  detenerReloj();
  mensajeEl.textContent = 'Se acabó el tiempo.';

  esperar(() => mostrarFin(false, 0), 600);
}

function mostrarFin(gano, sobra) {
  if (gano) {
    const resto = sobra > 0
      ? ` y te sobraron ${plural(sobra, 'segundo', 'segundos')}.`
      : '.';
    finTitulo.textContent = '¡Grandes logros!';
    finTexto.textContent =
      `Encontraste los ${estado.totalPares} pares en ${plural(estado.intentos, 'intento', 'intentos')}${resto}`;
  } else {
    finTitulo.textContent = '¡Vamos por más!';
    finTexto.textContent =
      `Se acabó el tiempo. Encontraste ${estado.paresHallados} de ${estado.totalPares} pares.`;
  }

  dlgFin.showModal();
  if (gano) lanzarConfeti();
}

function lanzarConfeti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const colores = ['#ffffff', '#a98be0', '#5b2fa6', '#d9ccf4', '#ffffff'];
  const piezas = Array.from({ length: 90 }, () => {
    const p = document.createElement('i');
    p.style.setProperty('--x', `${Math.random() * 100}%`);
    p.style.setProperty('--dx', `${(Math.random() - 0.5) * 240}px`);
    p.style.setProperty('--giro', `${360 + Math.random() * 720}deg`);
    p.style.setProperty('--demora', `${Math.random() * 0.8}s`);
    p.style.setProperty('--dura', `${2.4 + Math.random() * 1.6}s`);
    p.style.setProperty('--color', colores[Math.floor(Math.random() * colores.length)]);
    return p;
  });
  confetiEl.replaceChildren(...piezas);
}

/* ==========================================================
   PARTIDA NUEVA Y CONFIGURACIÓN
   ========================================================== */
function nuevaPartida() {
  detenerReloj();
  limpiarEsperas();
  confetiEl.replaceChildren();

  Object.assign(estado, {
    seleccion: [],
    bloqueado: false,
    iniciado: false,
    terminado: false,
    paresHallados: 0,
    intentos: 0,
    finMs: 0,
  });

  construirTablero();
  actualizarMarcador();
  pintarReloj(estado.config.tiempo * 1000);
  mensajeEl.textContent = 'Voltea una carta para empezar.';
}

function abrirConfig() {
  // Se pausa la partida en curso; al cerrar el diálogo empieza una nueva
  detenerReloj();
  limpiarEsperas();
  estado.bloqueado = true;

  inTiempo.value = estado.config.tiempo;
  inPares.value = estado.config.pares;
  dlgConfig.showModal();
}

/* ==========================================================
   EVENTOS
   ========================================================== */
tablero.addEventListener('click', (e) => {
  const carta = e.target.closest('.carta');
  if (carta) voltear(carta);
});

$('btn-reiniciar').addEventListener('click', nuevaPartida);
$('btn-config').addEventListener('click', abrirConfig);

document.querySelectorAll('.stepper-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = $(btn.dataset.objetivo);
    const min = Number(input.min);
    const max = Number(input.max);
    const actual = Number(input.value) || min;
    input.value = Math.min(max, Math.max(min, actual + Number(btn.dataset.paso)));
  });
});

// El formulario usa method="dialog": al enviarse, el diálogo se cierra solo
formConfig.addEventListener('submit', () => {
  estado.config = normalizarConfig({ tiempo: inTiempo.value, pares: inPares.value });
  guardarConfig(estado.config);
});

// Cualquier cierre del diálogo de configuración arranca una partida limpia
dlgConfig.addEventListener('close', nuevaPartida);
dlgFin.addEventListener('close', nuevaPartida);

$('btn-otra').addEventListener('click', () => dlgFin.close());
$('btn-ajustes').addEventListener('click', () => {
  dlgFin.close();
  abrirConfig();
});

window.addEventListener('resize', aplicarDisposicion);

/* ==========================================================
   INICIO
   ========================================================== */
function iniciar() {
  inTiempo.min = LIMITES.tiempoMin;
  inTiempo.max = LIMITES.tiempoMax;
  inPares.min = LIMITES.paresMin;
  inPares.max = LIMITES.paresMax;

  // Precarga para que no haya parpadeo al voltear la primera carta
  [REVERSO, ...CARTAS.map((c) => c.img)].forEach((src) => {
    new Image().src = src;
  });

  nuevaPartida();
  abrirConfig();
}

iniciar();
