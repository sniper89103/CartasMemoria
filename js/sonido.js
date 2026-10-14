'use strict';

/* Efectos de sonido sintetizados con Web Audio: no necesitan archivos.
   El navegador solo permite audio después de un clic o tecla del usuario. */
const Sonido = (() => {
  const CLAVE = 'memoria-lucky-mute';
  let ctx = null;
  let salida = null;
  let silenciado = false;

  try { silenciado = localStorage.getItem(CLAVE) === '1'; } catch { /* sin almacenamiento */ }

  const nota = (semitonos) => 440 * 2 ** (semitonos / 12);

  function activar() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor(); // evita saturar los parlantes
      salida = ctx.createGain();
      salida.gain.value = 0.8;
      salida.connect(comp);
      comp.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function tono({ f0, f1 = f0, dur = 0.15, tipo = 'sine', vol = 0.3, t = 0, filtro }) {
    if (!ctx || silenciado) return;
    const ini = ctx.currentTime + t;
    const osc = ctx.createOscillator();
    const gan = ctx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(f0, ini);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, ini + dur);
    gan.gain.setValueAtTime(0.0001, ini);
    gan.gain.exponentialRampToValueAtTime(vol, ini + 0.01);
    gan.gain.exponentialRampToValueAtTime(0.0001, ini + dur);

    let ultimo = osc;
    if (filtro) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filtro;
      osc.connect(f);
      ultimo = f;
    }
    ultimo.connect(gan);
    gan.connect(salida);
    osc.start(ini);
    osc.stop(ini + dur + 0.05);
  }

  function whoosh() {
    if (!ctx || silenciado) return;
    const n = Math.floor(ctx.sampleRate * 0.35);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const datos = buf.getChannelData(0);
    for (let i = 0; i < n; i++) datos[i] = Math.random() * 2 - 1;

    const fuente = ctx.createBufferSource();
    fuente.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    const t = ctx.currentTime;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(3000, t + 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.33);
    fuente.connect(f);
    f.connect(g);
    g.connect(salida);
    fuente.start(t);
  }

  return {
    activar,
    whoosh,

    get silenciado() { return silenciado; },

    alternar() {
      silenciado = !silenciado;
      try { localStorage.setItem(CLAVE, silenciado ? '1' : '0'); } catch { /* ignorar */ }
      if (!silenciado) activar();
      return silenciado;
    },

    voltear() {
      tono({ f0: 500, f1: 800, dur: 0.07, tipo: 'triangle', vol: 0.25 });
    },

    // La racha sube el tono: cada acierto seguido suena más agudo
    acierto(racha = 1) {
      const s = Math.min(racha - 1, 6) * 2;
      tono({ f0: nota(7 + s), dur: 0.18, tipo: 'triangle', vol: 0.3 });
      tono({ f0: nota(12 + s), dur: 0.3, tipo: 'triangle', vol: 0.3, t: 0.1 });
      tono({ f0: nota(19 + s), dur: 0.4, vol: 0.12, t: 0.1 });
    },

    fallo() {
      tono({ f0: 200, f1: 110, dur: 0.28, tipo: 'sawtooth', vol: 0.18, filtro: 900 });
    },

    // Alerta al llegar a 10 segundos
    sirena() {
      for (let i = 0; i < 4; i++) {
        tono({ f0: i % 2 ? 880 : 660, dur: 0.16, tipo: 'square', vol: 0.16, t: i * 0.18, filtro: 3000 });
      }
    },

    // Tic-tac cada segundo; en los últimos 3 suma un pitido que sube
    tictac(seg) {
      tono({ f0: seg % 2 ? 1500 : 1100, dur: 0.05, tipo: 'square', vol: 0.12 });
      if (seg <= 3) {
        tono({ f0: 700 + (4 - seg) * 150, dur: 0.18, vol: 0.35, t: 0.05 });
      }
    },

    // Timbre al acabarse el tiempo
    alarma() {
      for (let i = 0; i < 3; i++) {
        tono({ f0: 520, f1: 260, dur: 0.4, tipo: 'sawtooth', vol: 0.25, t: i * 0.45, filtro: 1800 });
      }
    },

    victoria() {
      [3, 7, 10, 15, 19].forEach((s, i) => {
        tono({ f0: nota(s), dur: 0.3, tipo: 'triangle', vol: 0.3, t: i * 0.11 });
      });
      [3, 10, 15].forEach((s) => {
        tono({ f0: nota(s), dur: 0.9, tipo: 'triangle', vol: 0.22, t: 0.6 });
      });
    },
  };
})();
