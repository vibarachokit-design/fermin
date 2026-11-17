/* Vuelo del Gaviotín — juego educativo (HTML5 Canvas, sin dependencias) */
'use strict';

const W = 1280, H = 720;
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
let pxScale = 1, cssScale = 1;

function fit() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cssScale = Math.min(innerWidth / W, innerHeight / H);
  cv.style.width = W * cssScale + 'px';
  cv.style.height = H * cssScale + 'px';
  cv.width = Math.round(W * cssScale * dpr);
  cv.height = Math.round(H * cssScale * dpr);
  pxScale = cssScale * dpr;
}
addEventListener('resize', fit);
fit();

// ------------------------------------------------------------------ utils
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const FONT = '"Baloo 2", "Trebuchet MS", system-ui, sans-serif';
const C = {
  sand: '#E8C38A', ochre: '#C98B4F', deep: '#0E4C6E', teal: '#2A9DB5', coral: '#F28C6B',
  ink: '#1d2b36', white: '#ffffff', cream: '#fff6e6', good: '#3fbf7f', bad: '#e5533d',
};

// ----------------------------------------------------------------- assets
const SRC = {
  sky1: 'bg/13_bg_migration_far_sky.webp', mount1: 'bg/14_bg_migration_distant_mountains.webp',
  clouds1: 'bg/15_bg_migration_middle_clouds.webp', ocean1: 'bg/16_bg_migration_near_ocean.webp',
  sky2: 'bg/17_bg_mejillones_sky.webp', hills2: 'bg/18_bg_mejillones_far_hills_port.webp',
  surf2: 'bg/19_bg_mejillones_water_surface.webp', under2: 'bg/20_bg_mejillones_underwater.webp',
  sky3: 'bg/21_bg_pampa_warm_sky.webp', hor3: 'bg/22_bg_pampa_far_horizon.webp',
  ground3: 'bg/23_bg_pampa_middle_ground.webp', night3: 'bg/24_bg_pampa_night_light_pollution.webp',
  title: 'screens/25_screen_title.webp', win: 'screens/26_screen_victory.webp', lose: 'screens/27_screen_game_over.webp',
  flight: 'sprites/tern_flight.png', dive: 'sprites/tern_dive.png', states: 'sprites/tern_states.png',
  air: 'sprites/air.png', desert: 'sprites/desert.png', fish: 'sprites/fish.png', icons: 'sprites/icons.png',
};
for (const n of ['tool_sign', 'tool_fence', 'tool_cone', 'tool_lamp', 'tool_detour', 'trash_bottle', 'trash_bag',
  'trash_line', 'trash_rings', 'trash_cap', 'sea_pelican', 'sea_lion', 'sea_net', 'sea_boat', 'nest_eggs',
  'chick_beg', 'chick_eat', 'pair_nest', 'fact_card']) SRC[n] = `items/${n}.png`;

const SHEETS = {
  flight: { img: 'flight', cell: 256, cols: 6, n: 6 },
  dive: { img: 'dive', cell: 256, cols: 8, n: 8 },
  states: { img: 'states', cell: 256, cols: 6, n: 6 },
  air: { img: 'air', cell: 256, cols: 4, n: 16 },
  desert: { img: 'desert', cell: 256, cols: 4, n: 20 },
  fish: { img: 'fish', cell: 128, cols: 3, n: 9 },
  icons: { img: 'icons', cell: 128, cols: 4, n: 12 },
};
const ICON = { heart: 0, fish: 1, bolt: 2, egg: 3, star: 4, pause: 5, play: 6, sound: 7, mute: 8, home: 9, restart: 10, info: 11 };
const IMG = {};
let loaded = 0;
const total = Object.keys(SRC).length;

function loadAll() {
  const one = (k, src, tries) => new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => { IMG[k] = im; loaded++; res(); };
    im.onerror = () => (tries > 1
      ? setTimeout(() => one(k, src, tries - 1).then(res, rej), 400)
      : rej(new Error('No se pudo cargar ' + src)));
    im.src = 'assets/' + src + (tries < 3 ? `?r=${tries}` : '');
  });
  return Promise.all(Object.entries(SRC).map(([k, src]) => one(k, src, 3)));
}

// Caja de contenido real (alfa) de cada cuadro, para anclar y colisionar con precisión.
function computeBoxes() {
  for (const sh of Object.values(SHEETS)) {
    const img = IMG[sh.img];
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, img.width, img.height).data;
    sh.box = [];
    for (let i = 0; i < sh.n; i++) {
      const ox = (i % sh.cols) * sh.cell, oy = Math.floor(i / sh.cols) * sh.cell;
      let x0 = sh.cell, y0 = sh.cell, x1 = 0, y1 = 0;
      for (let y = 0; y < sh.cell; y += 2) for (let x = 0; x < sh.cell; x += 2) {
        if (d[((oy + y) * img.width + ox + x) * 4 + 3] > 60) {
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
      sh.box.push(x1 > x0 ? { x0, y0, x1: x1 + 2, y1: y1 + 2 } : { x0: 0, y0: 0, x1: sh.cell, y1: sh.cell });
    }
  }
}

// ---------------------------------------------------------------- drawing
function drawSprite(sheet, idx, x, y, s, o = {}) {
  const sh = SHEETS[sheet], img = IMG[sh.img], b = sh.box[idx], c = sh.cell;
  const sx = (idx % sh.cols) * c, sy = Math.floor(idx / sh.cols) * c;
  const ax = (b.x0 + b.x1) / 2, ay = o.anchor === 'bottom' ? b.y1 : (b.y0 + b.y1) / 2;
  ctx.save();
  ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  if (o.flip) ctx.scale(-1, 1);
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  ctx.drawImage(img, sx, sy, c, c, -ax * s, -ay * s, c * s, c * s);
  ctx.restore();
}
function spriteRect(sheet, idx, x, y, s, anchor, shrink = 0.6) {
  const b = SHEETS[sheet].box[idx];
  const w = (b.x1 - b.x0) * s, h = (b.y1 - b.y0) * s;
  const cy = anchor === 'bottom' ? y - h / 2 : y;
  return { x: x - w * shrink / 2, y: cy - h * shrink / 2, w: w * shrink, h: h * shrink };
}
function drawItem(name, x, y, s, o = {}) {
  const img = IMG[name];
  const w = img.width * s, h = img.height * s;
  ctx.save();
  ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  if (o.flip) ctx.scale(-1, 1);
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  ctx.drawImage(img, -w / 2, o.anchor === 'bottom' ? -h : -h / 2, w, h);
  ctx.restore();
}
function itemRect(name, x, y, s, anchor, shrink = 0.6) {
  const img = IMG[name], w = img.width * s, h = img.height * s;
  const cy = anchor === 'bottom' ? y - h / 2 : y;
  return { x: x - w * shrink / 2, y: cy - h * shrink / 2, w: w * shrink, h: h * shrink };
}
// Fondo que se repite en espejo (sin costuras).
function drawTiled(img, off, dy = 0, sy = 0, sh = img.height, alpha = 1) {
  const w = img.width, period = 2 * w;
  const o = ((off % period) + period) % period;
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let x = -o, i = 0; x < W; x += w, i++) {
    if (x + w <= 0) continue;
    if (i % 2 === 0) ctx.drawImage(img, 0, sy, w, sh, x, dy, w, sh);
    else { ctx.save(); ctx.translate(x + w, dy); ctx.scale(-1, 1); ctx.drawImage(img, 0, sy, w, sh, 0, 0, w, sh); ctx.restore(); }
  }
  ctx.restore();
}
function text(str, x, y, size, color = C.white, o = {}) {
  ctx.save();
  ctx.font = `${o.weight || 800} ${size}px ${FONT}`;
  ctx.textAlign = o.align || 'center';
  ctx.textBaseline = o.baseline || 'middle';
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.strokeW || size / 5; ctx.strokeStyle = o.stroke; ctx.strokeText(str, x, y); }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.restore();
}
function wrap(str, maxW, size, weight = 600) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${FONT}`;
  const out = [];
  for (const para of str.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const t = line ? line + ' ' + word : word;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = word; } else line = t;
    }
    out.push(line);
  }
  ctx.restore();
  return out;
}
function roundRect(x, y, w, h, r, fill, stroke, lw = 4) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
}
function bar(x, y, w, h, frac, color, back = 'rgba(0,0,0,.35)') {
  roundRect(x, y, w, h, h / 2, back);
  if (frac > 0) roundRect(x, y, Math.max(h, w * clamp(frac, 0, 1)), h, h / 2, color);
  roundRect(x, y, w, h, h / 2, null, 'rgba(255,255,255,.85)', 3);
}

// ------------------------------------------------------------------ input
const keys = {}, pressed = {};
const ptr = { x: 0, y: 0, down: false, tap: false, downT: 0 };
const GAME_KEYS = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
addEventListener('keydown', (e) => {
  if (!e.repeat) pressed[e.code] = true;
  keys[e.code] = true;
  if (GAME_KEYS.includes(e.code)) e.preventDefault();
  unlockAudio();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; ptr.down = false; });
function ptrPos(e) {
  const r = cv.getBoundingClientRect();
  ptr.x = (e.clientX - r.left) / r.width * W;
  ptr.y = (e.clientY - r.top) / r.height * H;
}
cv.addEventListener('pointerdown', (e) => {
  ptrPos(e); ptr.down = true; ptr.tap = true; ptr.downT = 0;
  try { cv.setPointerCapture(e.pointerId); } catch (_) { /* sin captura */ }
  unlockAudio();
});
cv.addEventListener('pointermove', (e) => ptrPos(e));
const ptrUp = () => { ptr.down = false; };
cv.addEventListener('pointerup', ptrUp);
cv.addEventListener('pointercancel', ptrUp);
const hit = (bx, x, y) => x >= bx.x && x <= bx.x + bx.w && y >= bx.y && y <= bx.y + bx.h;

// Botones que se registran al dibujar y se evalúan en el siguiente update.
let buttons = [], nextButtons = [];
function button(label, x, y, w, h, cb, o = {}) {
  const hover = hit({ x, y, w, h }, ptr.x, ptr.y);
  roundRect(x, y + 6, w, h, h / 2, 'rgba(0,0,0,.25)');
  roundRect(x, y, w, h, h / 2, o.color || (hover ? '#ffb08f' : C.coral), C.white, 4);
  text(label, x + w / 2, y + h / 2 + 2, o.size || 30, C.white, { stroke: 'rgba(80,30,10,.35)', strokeW: 4 });
  nextButtons.push({ x, y, w, h, cb });
}
function iconButton(icon, x, y, size, cb) {
  roundRect(x, y, size, size, size / 2, 'rgba(14,76,110,.55)');
  drawSprite('icons', icon, x + size / 2, y + size / 2, size / 128 * 0.95);
  nextButtons.push({ x, y, w: size, h: size, cb });
}
function handleButtons() {
  if (!ptr.tap) return false;
  for (const b of buttons) if (hit(b, ptr.x, ptr.y)) { ptr.tap = false; ptr.down = false; sfx('click'); b.cb(); return true; }
  return false;
}

// ------------------------------------------------------------------ audio
let actx = null, muted = false;
try { muted = localStorage.getItem('gaviotin_mute') === '1'; } catch (_) { /* sin almacenamiento */ }
function unlockAudio() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { actx = null; }
}
function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('gaviotin_mute', muted ? '1' : '0'); } catch (_) { /* nada */ }
}
function tone(f0, f1, dur, type = 'sine', vol = 0.15, delay = 0) {
  const t = actx.currentTime + delay;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(actx.destination);
  o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, vol = 0.2, freq = 1200) {
  const len = Math.floor(actx.sampleRate * dur);
  const buf = actx.createBuffer(1, len, actx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = actx.createBufferSource(), f = actx.createBiquadFilter(), g = actx.createGain();
  src.buffer = buf; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol;
  src.connect(f).connect(g).connect(actx.destination);
  src.start();
}
function sfx(kind) {
  if (muted || !actx || actx.state !== 'running') return;
  switch (kind) {
    case 'click': tone(660, 880, 0.08, 'triangle', 0.12); break;
    case 'star': tone(880, 1320, 0.12, 'triangle', 0.14); tone(1320, 1760, 0.12, 'triangle', 0.1, 0.07); break;
    case 'hit': tone(300, 90, 0.35, 'sawtooth', 0.14); noise(0.2, 0.15, 900); break;
    case 'dive': tone(900, 300, 0.25, 'sine', 0.1); break;
    case 'splash': noise(0.35, 0.25, 2200); break;
    case 'catch': tone(520, 1040, 0.12, 'square', 0.07); tone(780, 1560, 0.15, 'triangle', 0.1, 0.06); break;
    case 'good': [523, 659, 784].forEach((f, i) => tone(f, f, 0.16, 'triangle', 0.13, i * 0.08)); break;
    case 'bad': tone(220, 160, 0.25, 'square', 0.08); break;
    case 'win': [523, 659, 784, 1047].forEach((f, i) => tone(f, f * 1.01, 0.3, 'triangle', 0.14, i * 0.12)); break;
    case 'chirp': tone(2200, 3000, 0.07, 'sine', 0.08); tone(2600, 3400, 0.07, 'sine', 0.06, 0.09); break;
  }
}

// --------------------------------------------------------- shared effects
let particles = [], toasts = [], shake = 0;
function burst(x, y, n, color, speed = 200, life = 0.7, size = 6, grav = 300) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, v = rand(0.3, 1) * speed;
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, life, max: life, color, size: rand(0.5, 1) * size, grav });
  }
}
function updateParticles(dt) {
  for (const p of particles) { p.life -= dt; p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  particles = particles.filter((p) => p.life > 0);
}
function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function toast(msg, color = C.deep, dur = 2.4, big = false) {
  toasts = toasts.filter((t) => t.msg !== msg);
  toasts.push({ msg, color, t: 0, dur, big });
  if (toasts.length > 3) toasts.shift();
}
function updateToasts(dt) { for (const t of toasts) t.t += dt; toasts = toasts.filter((t) => t.t < t.dur); }
function drawToasts() {
  let y = 112;
  for (const t of toasts) {
    const a = Math.min(1, t.t * 6, (t.dur - t.t) * 3);
    const size = t.big ? 26 : 23;
    const lines = wrap(t.msg, 760, size, 700);
    const h = lines.length * size * 1.25 + 22;
    ctx.save();
    ctx.globalAlpha = a;
    roundRect(W / 2 - 400, y, 800, h, 22, t.color + 'e6', 'rgba(255,255,255,.9)', 3);
    lines.forEach((l, i) => text(l, W / 2, y + 11 + size * 0.62 + i * size * 1.25, size, C.white, { weight: 700 }));
    ctx.restore();
    y += h + 10;
  }
}

// ------------------------------------------------------------------ state
const game = { score: 0, phaseStartScore: 0, lives: 3, phase: 0, best: 0 };
try { game.best = +localStorage.getItem('gaviotin_best') || 0; } catch (_) { /* nada */ }
let scene = null, paused = false;
function setScene(s) { scene = s; particles = []; toasts = []; paused = false; game.overT = 0; if (s.enter) s.enter(); }
function tickGameOver(dt) {
  if (game.overT > 0 && !paused) { game.overT -= dt; if (game.overT <= 0) setScene(GameOver()); }
}

function hud(opts) {
  for (let i = 0; i < 3; i++) drawSprite('icons', ICON.heart, 46 + i * 52, 44, 0.4, { alpha: i < game.lives ? 1 : 0.22 });
  text(`${game.score}`, 230, 46, 34, C.white, { align: 'left', stroke: 'rgba(0,0,0,.45)', strokeW: 6 });
  text(opts.title, W / 2, 30, 24, C.white, { stroke: 'rgba(0,0,0,.45)', strokeW: 5 });
  if (opts.bar != null) {
    bar(W / 2 - 170, 52, 340, 20, opts.bar, opts.barColor || C.coral);
    if (opts.barIcon != null) drawSprite('icons', opts.barIcon, W / 2 - 190, 62, 0.3);
  }
  iconButton(paused ? ICON.play : ICON.pause, W - 150, 16, 58, () => { paused = !paused; });
  iconButton(muted ? ICON.mute : ICON.sound, W - 80, 16, 58, toggleMute);
}
function loseLife(msg) {
  if (game.lives <= 0) return;
  game.lives--;
  shake = 0.35;
  sfx('hit');
  if (msg) toast(msg, '#b5452f');
  if (game.lives <= 0) game.overT = 1.0;
}
function pauseOverlay() {
  ctx.fillStyle = 'rgba(8,24,36,.6)';
  ctx.fillRect(0, 0, W, H);
  text('Pausa', W / 2, H / 2 - 70, 72, C.white, { stroke: C.deep, strokeW: 10 });
  button('Continuar', W / 2 - 150, H / 2, 300, 74, () => { paused = false; });
  button('Menú', W / 2 - 110, H / 2 + 100, 220, 64, () => setScene(Title()), { color: C.teal, size: 26 });
}

// ------------------------------------------------------------ fact cards
function Card(o) {
  // o: {title, body, footer, art(cx, cy), backdrop(), next}
  let t = 0;
  return {
    update(dt) {
      t += dt;
      if (t > 0.5 && (pressed.Space || pressed.Enter || ptr.tap)) { sfx('click'); o.next(); }
    },
    draw() {
      o.backdrop();
      ctx.fillStyle = `rgba(8,24,36,${Math.min(0.55, t * 2)})`;
      ctx.fillRect(0, 0, W, H);
      const cw = 860, ch = 600, cx = W / 2;
      const top = (H - ch) / 2 + (1 - Math.min(1, t * 3)) ** 2 * 300;
      roundRect(cx - cw / 2, top + 10, cw, ch, 36, 'rgba(0,0,0,.3)');
      roundRect(cx - cw / 2, top, cw, ch, 36, C.ochre);
      roundRect(cx - cw / 2 + 14, top + 14, cw - 28, ch - 28, 26, C.cream, C.sand, 6);
      // franja de mar y arena arriba
      ctx.save();
      ctx.beginPath(); ctx.roundRect(cx - cw / 2 + 14, top + 14, cw - 28, 22, [26, 26, 0, 0]); ctx.clip();
      ctx.fillStyle = C.teal; ctx.fillRect(cx - cw / 2, top, cw, 40);
      ctx.restore();
      const inner = cw - 120;
      text(o.kicker || '', cx, top + 70, 22, C.ochre, { weight: 800 });
      const tl = wrap(o.title, inner, 46, 800);
      tl.forEach((l, i) => text(l, cx, top + 112 + i * 50, 46, C.deep, { weight: 800 }));
      let y = top + 112 + tl.length * 50;
      if (o.art) { o.art(cx, y + 62, t); y += 132; } else y += 20;
      const lines = wrap(o.body, inner, 25, 600);
      lines.forEach((l, i) => text(l, cx, y + i * 33, 25, C.ink, { weight: 600 }));
      const pulse = 0.6 + 0.4 * Math.sin(t * 5);
      roundRect(cx - 250, top + ch - 74, 500, 46, 23, C.coral);
      text(o.footer || 'Toca o presiona Espacio para continuar', cx, top + ch - 50, 21, C.white, { weight: 700, alpha: 0.75 + pulse * 0.25 });
    },
  };
}

// ------------------------------------------------------------------ title
function Title() {
  let t = 0;
  return {
    enter() { game.score = 0; game.lives = 3; },
    update(dt) {
      t += dt;
      if (handleButtons()) return;
      if (pressed.Space || pressed.Enter) start();
    },
    draw() {
      ctx.drawImage(IMG.title, 0, 0, W, H);
      const g = ctx.createLinearGradient(0, 0, 0, 330);
      g.addColorStop(0, 'rgba(14,76,110,.75)'); g.addColorStop(1, 'rgba(14,76,110,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, 330);
      text('Vuelo del Gaviotín', W / 2, 92 + Math.sin(t * 2) * 4, 92, C.white, { stroke: C.deep, strokeW: 14 });
      text('Ayuda al Gaviotín Chico a llegar a Mejillones, alimentar a sus polluelos y proteger su nido',
        W / 2, 172, 25, C.cream, { weight: 700, stroke: 'rgba(14,76,110,.8)', strokeW: 6 });
      button('¡A volar!', W / 2 - 150, 228, 300, 82, start, { size: 38 });
      if (game.best) text(`Mejor puntaje: ${game.best}`, W / 2, 342, 22, C.white, { stroke: 'rgba(0,0,0,.5)', strokeW: 5 });
      text('Espacio / Enter para comenzar', W / 2, H - 28, 20, C.white, { weight: 700, stroke: 'rgba(0,0,0,.5)', strokeW: 5, alpha: 0.85 });
      iconButton(muted ? ICON.mute : ICON.sound, W - 80, 16, 58, toggleMute);
    },
  };
  function start() { sfx('chirp'); game.score = 0; startPhase(1); }
}

// ----------------------------------------------------------- phase flow
const INTRO = {
  1: { kicker: 'FASE 1 DE 3', title: 'La migración',
    body: 'Vuela hacia Mejillones. Esquiva gaviotas y halcones, aprovecha o evita las ráfagas de viento y junta estrellas.\n\nTeclado: flechas o W A S D.\nCelular: arrastra el dedo.',
    art: (x, y, t) => drawSprite('flight', Math.floor(t * 10) % 6, x, y, 0.5) },
  2: { kicker: 'FASE 2 DE 3', title: 'La pesca',
    body: 'Tus polluelos tienen hambre: atrapa 10 peces. ¡No atrapes basura! Cuidado con pelícanos, lobos marinos y redes.\n\nTeclado: ← → para moverte, mantén Espacio para zambullirte.\nCelular: toca el cielo para moverte, mantén el dedo en el agua para zambullirte.',
    art: (x, y, t) => drawSprite('dive', 2 + Math.floor(t * 4) % 3, x, y, 0.42) },
  3: { kicker: 'FASE 3 DE 3', title: 'Proteger el nido',
    body: 'Usa la herramienta correcta antes de que la amenaza llegue al nido.\n1 Letrero → personas · 2 Cerco → perros\n3 Desvío → vehículos · 4 Luz cálida → focos\nO toca una herramienta y luego la amenaza.',
    art: (x, y) => drawItem('nest_eggs', x, y, 0.42) },
};
const PHASES = { 1: Phase1, 2: Phase2, 3: Phase3 };
function startPhase(n) {
  game.phase = n; game.lives = 3; game.phaseStartScore = game.score;
  const p = PHASES[n]();
  setScene(Card({ ...INTRO[n], backdrop: () => p.drawWorld(), next: () => setScene(p) }));
}
function completePhase(world, fact, next) {
  sfx('win');
  setScene(Card({ ...fact, backdrop: () => world.drawWorld(), next }));
}

// ------------------------------------------------- phase 1: migration
function Phase1() {
  const DUR = 50;
  const pl = { x: 260, y: 300, inv: 0, hurt: 0, push: 0 };
  let t = 0, dist = 0, speed = 300, ents = [], done = false, doneT = 0, acc = 0;
  const timers = { gull: 1.2, falcon: 7, wind: 4, star: 1.5 };
  const S = 0.52;

  function spawn(dt) {
    const d = t / DUR;
    for (const k in timers) timers[k] -= dt;
    if (timers.gull <= 0) {
      ents.push({ type: 'gull', x: W + 140, y: rand(90, 500), vx: -(speed + rand(60, 200)), ph: rand(0, 6) });
      timers.gull = rand(1.6, 2.6) - d * 0.9;
    }
    if (timers.falcon <= 0 && t > 6) {
      ents.push({ type: 'warn', y: clamp(pl.y, 100, 520), life: 1.0 });
      timers.falcon = rand(5.5, 8) - d * 2.5;
    }
    if (timers.wind <= 0) {
      ents.push({ type: 'wind', x: W + 200, y: rand(110, 480), vx: -(speed + 120), push: pick([-1, 1]) * 240, f: rand(0, 4) });
      timers.wind = rand(4, 7);
    }
    if (timers.star <= 0) {
      const y = rand(100, 500);
      for (let i = 0; i < 3; i++) ents.push({ type: 'star', x: W + 60 + i * 70, y: y + Math.sin(i) * 30, vx: -speed });
      timers.star = rand(3, 5);
    }
  }
  const body = () => ({ x: pl.x - 38, y: pl.y - 14, w: 78, h: 30 });

  return {
    update(dt) {
      if (handleButtons()) return;
      if (pressed.Escape || pressed.KeyP) { paused = !paused; return; }
      if (paused) return;
      t += dt; dist += speed * dt;
      pl.inv = Math.max(0, pl.inv - dt); pl.hurt = Math.max(0, pl.hurt - dt);
      if (!done) {
        let dx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
        let dy = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
        if (ptr.down) { dx = clamp((ptr.x - pl.x) / 50, -1, 1); dy = clamp((ptr.y - pl.y) / 50, -1, 1); }
        pl.x = clamp(pl.x + dx * 380 * dt, 90, 760);
        pl.y = clamp(pl.y + dy * 380 * dt + pl.push * dt, 70, 540);
        pl.push *= Math.pow(0.15, dt);
        spawn(dt);
        acc += dt * 10;
        if (acc >= 1) { game.score += Math.floor(acc); acc -= Math.floor(acc); }
        if (t >= DUR) { done = true; toast('¡Mejillones a la vista!', C.teal); }
      } else {
        doneT += dt;
        pl.x += 420 * dt; pl.y = lerp(pl.y, 260, dt * 2);
        if (doneT > 2.2) completePhase(this, {
          kicker: '¿SABÍAS QUE…?', title: '¡Llegaste a Mejillones!',
          body: 'El Gaviotín Chico es un ave migratoria en peligro de extinción. Llega a Mejillones alrededor de junio o julio para reproducirse.',
          art: (x, y, tt) => drawSprite('states', 4 + Math.floor(tt * 4) % 2, x, y, 0.42),
        }, () => startPhase(2));
      }
      for (const e of ents) {
        if (e.type === 'warn') { e.life -= dt; if (e.life <= 0) { e.dead = true; ents.push({ type: 'falcon', x: W + 140, y: e.y, vx: -(speed + 560), vy: 0 }); } continue; }
        e.x += e.vx * dt;
        if (e.type === 'gull') e.y += Math.sin(t * 3 + e.ph) * 40 * dt;
        if (e.type === 'falcon') e.y += clamp(pl.y - e.y, -1, 1) * 60 * dt;
        if (e.x < -300) e.dead = true;
        if (done) continue;
        const b = body();
        if (e.type === 'star' && overlap(b, { x: e.x - 24, y: e.y - 24, w: 48, h: 48 })) {
          e.dead = true; game.score += 50; sfx('star'); burst(e.x, e.y, 10, '#ffd34d', 160, 0.5, 5, 0);
        } else if (e.type === 'wind' && overlap(b, { x: e.x - 90, y: e.y - 40, w: 180, h: 80 })) {
          pl.push = e.push;
          if (!e.felt) { e.felt = true; toast(e.push < 0 ? 'Una ráfaga te eleva' : 'Una ráfaga te empuja hacia abajo', C.teal, 1.4); }
        } else if ((e.type === 'gull' || e.type === 'falcon') && pl.inv <= 0) {
          const idx = e.type === 'gull' ? 0 : 4;
          if (overlap(b, spriteRect('air', idx, e.x, e.y, 0.5, 'center', 0.5))) {
            pl.inv = 1.8; pl.hurt = 0.7; burst(pl.x, pl.y, 14, '#ffffff', 220, 0.6, 6, 200);
            loseLife(e.type === 'gull' ? '¡Choque con una gaviota dominicana!' : '¡Un halcón peregrino te sorprendió!');
          }
        }
      }
      ents = ents.filter((e) => !e.dead);
    },
    drawWorld() {
      drawTiled(IMG.sky1, dist * 0.04 + t * 6);
      drawTiled(IMG.mount1, dist * 0.12, 10);
      drawTiled(IMG.clouds1, dist * 0.3, -40, 0, 720);
      drawTiled(IMG.ocean1, dist * 0.9, 430);
    },
    draw() {
      this.drawWorld();
      for (const e of ents) {
        if (e.type === 'star') drawSprite('icons', ICON.star, e.x, e.y + Math.sin(t * 4 + e.x * 0.01) * 6, 0.36);
        else if (e.type === 'wind') drawSprite('air', 8 + Math.floor(t * 8 + e.f) % 4, e.x, e.y, 0.6, { alpha: 0.9 });
        else if (e.type === 'gull') drawSprite('air', Math.floor(t * 8 + e.ph) % 4, e.x, e.y, 0.5);
        else if (e.type === 'falcon') drawSprite('air', 4 + Math.floor(t * 10) % 4, e.x, e.y, 0.5);
        else if (e.type === 'warn') {
          const a = 0.5 + 0.5 * Math.sin(t * 20);
          roundRect(W - 86, e.y - 34, 68, 68, 34, `rgba(229,83,61,${0.6 + a * 0.4})`, C.white, 4);
          text('!', W - 52, e.y + 3, 48, C.white);
        }
      }
      const blink = pl.inv > 0 && Math.floor(t * 12) % 2 === 0;
      if (!blink) {
        if (pl.hurt > 0) drawSprite('states', Math.floor(t * 8) % 2, pl.x, pl.y, S * 0.9);
        else drawSprite('flight', Math.floor(t * 12) % 6, pl.x, pl.y, S);
      }
      drawParticles();
      hud({ title: 'Fase 1 · La migración', bar: Math.min(1, t / DUR), barColor: C.teal, barIcon: ICON.star });
      drawSprite('flight', 2, W / 2 - 170 + 340 * Math.min(1, t / DUR), 62, 0.16);
      drawToasts();
      if (paused) pauseOverlay();
    },
  };
}

// ------------------------------------------------------ phase 2: fishing
function Phase2() {
  const WY = 330, GOAL = 10, CRUISE = 170, S = 0.5;
  const pl = { x: 640, y: CRUISE, vy: 0, state: 'fly', carry: null, inv: 0, hurt: 0, face: 1, catchT: 0 };
  let t = 0, ents = [], caught = 0, energy = 100, done = false, doneT = 0, splashed = false;
  const timers = { trash: 2, net: 14, pelican: 6, lion: 10 };
  const FISH = [{ row: 0, w: 0.55, val: 1, en: 20, pts: 100 }, { row: 1, w: 0.35, val: 1, en: 24, pts: 120 }, { row: 2, w: 0.1, val: 2, en: 45, pts: 300 }];
  const TRASH = ['trash_bottle', 'trash_bag', 'trash_line', 'trash_rings', 'trash_cap'];

  function spawnFish() {
    let r = Math.random(), def = FISH[0];
    for (const f of FISH) { if (r < f.w) { def = f; break; } r -= f.w; }
    const dir = pick([-1, 1]);
    ents.push({ type: 'fish', def, x: dir > 0 ? -60 : W + 60, y: rand(WY + 60, 660), vx: dir * rand(60, 140), ph: rand(0, 6) });
  }
  function spawn(dt) {
    for (const k in timers) timers[k] -= dt;
    if (ents.filter((e) => e.type === 'fish').length < 7) spawnFish();
    if (timers.trash <= 0) {
      ents.push({ type: 'trash', name: pick(TRASH), x: W + 80, y: rand(WY + 60, 640), vx: -rand(40, 90), ph: rand(0, 6), rot: rand(-0.4, 0.4) });
      timers.trash = rand(3.4, 5.4);
    }
    if (timers.net <= 0) { ents.push({ type: 'net', x: W + 160, y: rand(WY + 140, 600), vx: -60 }); timers.net = rand(14, 20); }
    if (timers.pelican <= 0) { ents.push({ type: 'pelican', x: W + 120, y: WY + 22, vx: -rand(50, 80) }); timers.pelican = rand(9, 14); }
    if (timers.lion <= 0) { ents.push({ type: 'lion', x: rand(200, W - 200), y: WY + 30, life: 4, max: 4 }); timers.lion = rand(9, 13); }
  }
  const beak = () => ({ x: pl.x - 30, y: pl.y - 30, w: 60, h: 70 });

  return {
    update(dt) {
      if (handleButtons()) return;
      if (pressed.Escape || pressed.KeyP) { paused = !paused; return; }
      if (paused) return;
      t += dt;
      pl.inv = Math.max(0, pl.inv - dt); pl.hurt = Math.max(0, pl.hurt - dt); pl.catchT = Math.max(0, pl.catchT - dt);
      const touchWater = ptr.down && ptr.y > WY;
      const diveHeld = keys.Space || keys.ArrowDown || keys.KeyS || touchWater;
      let dx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
      if (ptr.down) dx = clamp((ptr.x - pl.x) / 40, -1, 1);
      if (dx) pl.face = dx > 0 ? 1 : -1;
      const hs = pl.state === 'fly' ? 420 : 200;
      pl.x = clamp(pl.x + dx * hs * dt, 70, W - 70);

      if (!done) {
        spawn(dt);
        energy -= dt * 3.2;
        if (energy <= 0) { energy = 60; pl.inv = 1.5; loseLife('¡Sin energía! Atrapa peces para recuperarla.'); }
      }
      if (pl.state === 'fly') {
        pl.y = lerp(pl.y, CRUISE + Math.sin(t * 2) * 10, dt * 4);
        if (diveHeld && !done && pl.hurt <= 0) { pl.state = 'dive'; pl.vy = 250; splashed = false; sfx('dive'); }
      } else if (pl.state === 'dive') {
        pl.vy = Math.min(820, pl.vy + 1600 * dt);
        pl.y += pl.vy * dt;
        if (!splashed && pl.y > WY) { splashed = true; sfx('splash'); burst(pl.x, WY, 22, '#bfefff', 320, 0.8, 6, 700); }
        if ((!diveHeld && pl.y > WY + 50) || pl.y > 680) pl.state = 'rise';
      } else if (pl.state === 'rise') {
        pl.y -= 560 * dt;
        if (splashed && pl.y < WY) { splashed = false; burst(pl.x, WY, 14, '#bfefff', 240, 0.7, 5, 700); }
        if (pl.y <= CRUISE) {
          pl.y = CRUISE; pl.state = 'fly';
          if (pl.carry) {
            caught += pl.carry.val; energy = Math.min(100, energy + pl.carry.en); game.score += pl.carry.pts;
            sfx('good'); burst(pl.x, pl.y, 16, '#ffd34d', 200, 0.6, 5, 100);
            if (pl.carry.val > 1) toast('¡Pez dorado! Vale doble.', '#c98b1f', 1.8);
            pl.carry = null;
            if (caught >= GOAL && !done) { done = true; toast('¡Los polluelos están alimentados!', C.teal); }
          }
        }
      }
      if (done) {
        doneT += dt;
        if (doneT > 2.2) completePhase(this, {
          kicker: '¿SABÍAS QUE…?', title: 'Pescador experto',
          body: 'El Gaviotín Chico se alimenta de peces pequeños, como la anchoveta, que atrapa lanzándose en picada al mar. La basura en el océano pone en riesgo a las aves marinas.',
          art: (x, y) => drawItem('chick_eat', x, y, 0.27),
        }, () => startPhase(3));
      }

      for (const e of ents) {
        if (e.type === 'fish') { e.x += e.vx * dt; e.y += Math.sin(t * 2 + e.ph) * 12 * dt; if (e.x < -120 || e.x > W + 120) e.dead = true; }
        else if (e.type === 'trash') { e.x += e.vx * dt; e.y += Math.sin(t + e.ph) * 14 * dt; if (e.x < -120) e.dead = true; }
        else if (e.type === 'net' || e.type === 'pelican') { e.x += e.vx * dt; if (e.x < -260) e.dead = true; }
        else if (e.type === 'lion') { e.life -= dt; if (e.life <= 0) e.dead = true; }
        if (done || e.dead) continue;
        const under = pl.y > WY + 10 && (pl.state === 'dive' || pl.state === 'rise');
        const b = beak();
        if (e.type === 'fish' && under && !pl.carry && overlap(b, spriteRect('fish', e.def.row * 3, e.x, e.y, 0.5, 'center', 0.8))) {
          e.dead = true; pl.carry = e.def; pl.state = 'rise'; pl.catchT = 0.25; sfx('catch');
          burst(e.x, e.y, 10, '#d9f6ff', 140, 0.5, 4, -60);
        } else if (pl.inv <= 0 && under) {
          let r = null, msg = '';
          if (e.type === 'trash') { r = itemRect(e.name, e.x, e.y, 0.22, 'center', 0.7); msg = '¡Eso es basura! El plástico daña a las aves marinas.'; }
          if (e.type === 'net') { r = itemRect('sea_net', e.x, e.y, 0.55, 'center', 0.7); msg = '¡Cuidado con las redes abandonadas!'; }
          if (r && overlap(b, r)) { e.dead = e.type === 'trash'; pl.inv = 1.6; pl.hurt = 0.6; pl.carry = null; pl.state = 'rise'; loseLife(msg); }
        }
        if (pl.inv <= 0 && (e.type === 'pelican' || e.type === 'lion') && Math.abs(pl.y - WY) < 50 && pl.state !== 'fly') {
          const w = e.type === 'pelican' ? 80 : 60;
          if (Math.abs(pl.x - e.x) < w && (e.type !== 'lion' || e.life < e.max - 0.4)) {
            pl.inv = 1.6; pl.hurt = 0.6; pl.carry = null; pl.state = 'rise';
            loseLife(e.type === 'pelican' ? '¡Un pelícano te quitó el pez!' : '¡Un lobo marino asomó justo ahí!');
          }
        }
      }
      ents = ents.filter((e) => !e.dead);
      updateBubbles(dt);
    },
    drawWorld() {
      drawTiled(IMG.sky2, t * 6);
      drawTiled(IMG.hills2, t * 10, WY - 572);
      ctx.save();
      ctx.beginPath(); ctx.rect(0, WY, W, H - WY); ctx.clip();
      drawTiled(IMG.under2, t * 14, WY - 70);
      ctx.restore();
    },
    draw() {
      this.drawWorld();
      for (const e of ents) {
        if (e.type === 'fish') drawSprite('fish', e.def.row * 3 + Math.floor(t * 8 + e.ph) % 3, e.x, e.y, 0.5, { flip: e.vx < 0 });
        else if (e.type === 'trash') drawItem(e.name, e.x, e.y, 0.22, { rot: e.rot + Math.sin(t + e.ph) * 0.2 });
        else if (e.type === 'net') drawItem('sea_net', e.x, e.y, 0.55, { alpha: 0.95 });
      }
      for (const b of bubbles) { ctx.globalAlpha = b.a; ctx.strokeStyle = '#e8fbff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.stroke(); }
      ctx.globalAlpha = 1;
      const under = pl.y > WY;
      if (under) drawTern(0.85);
      drawTiled(IMG.surf2, t * 30, WY - 30, 250, 60);
      for (const e of ents) {
        if (e.type === 'pelican') drawItem('sea_pelican', e.x, e.y + 26, 0.42, { anchor: 'bottom' });
        if (e.type === 'lion') {
          const k = Math.min(1, (e.max - e.life) * 3, e.life * 3);
          ctx.save(); ctx.beginPath(); ctx.rect(e.x - 120, 0, 240, WY + 34); ctx.clip();
          drawItem('sea_lion', e.x, WY + 34 + (1 - k) * 110, 0.38, { anchor: 'bottom' });
          ctx.restore();
        }
      }
      if (!under) drawTern(1);
      drawParticles();
      hud({ title: `Fase 2 · La pesca   🐟 ${caught}/${GOAL}`, bar: energy / 100, barColor: energy < 30 ? C.bad : '#f6c445', barIcon: ICON.bolt });
      drawToasts();
      if (paused) pauseOverlay();
    },
  };
  function drawTern(alpha) {
    if (pl.inv > 0 && Math.floor(t * 12) % 2 === 0) return;
    const flip = pl.face < 0;
    if (pl.hurt > 0) drawSprite('states', Math.floor(t * 8) % 2, pl.x, pl.y, S * 0.9, { flip, alpha });
    else if (pl.state === 'dive') drawSprite('dive', pl.y < WY - 60 ? 2 : pl.y < WY + 40 ? 3 : 4, pl.x, pl.y, S, { flip, alpha });
    else if (pl.state === 'rise' && pl.carry) drawSprite('dive', pl.catchT > 0 ? 5 : 6 + Math.floor(t * 6) % 2, pl.x, pl.y, S, { flip, alpha });
    else drawSprite('flight', Math.floor(t * 12) % 6, pl.x, pl.y, S, { flip, alpha });
  }
}
let bubbles = [];
function updateBubbles(dt) {
  if (Math.random() < dt * 4) bubbles.push({ x: rand(0, W), y: H + 10, r: rand(2, 6), vy: rand(30, 70), a: rand(0.3, 0.7) });
  for (const b of bubbles) { b.y -= b.vy * dt; b.x += Math.sin(b.y * 0.05) * 0.3; }
  bubbles = bubbles.filter((b) => b.y > 340);
}

// ---------------------------------------------------- phase 3: the nest
function Phase3() {
  const DUR = 75, NIGHT = 46, NEST = { x: 175, y: 560 };
  const TOOLS = [
    { id: 'sign', name: 'Letrero', art: 'El letrero', img: 'tool_sign', key: 'Digit1' },
    { id: 'fence', name: 'Cerco', art: 'El cerco', img: 'tool_fence', key: 'Digit2' },
    { id: 'detour', name: 'Desvío', art: 'El desvío', img: 'tool_detour', key: 'Digit3' },
    { id: 'lamp', name: 'Luz cálida', art: 'La luz cálida', img: 'tool_lamp', key: 'Digit4' },
  ];
  const TYPES = {
    person: { f: 12, s: 0.62, v: 52, tool: 'sign', label: 'una persona',
      fact: 'Los huevos se camuflan con el suelo y casi no se ven. Respeta los letreros y no camines por zonas de nidificación.' },
    dog: { f: 8, s: 0.52, v: 82, tool: 'fence', label: 'un perro',
      fact: 'Los perros sueltos espantan a los adultos y pueden dañar los nidos. Pasea a tu perro siempre con correa.' },
    truck: { f: 0, s: 0.8, v: 112, tool: 'detour', label: 'un vehículo',
      fact: 'Manejar fuera del camino puede aplastar nidos invisibles. Usa solo los caminos habilitados.' },
    atv: { f: 4, s: 0.66, v: 126, tool: 'detour', label: 'un vehículo',
      fact: 'Las motos y cuatrimotos fuera de ruta destruyen nidos en la pampa. Respeta los caminos señalizados.' },
    lamp: { f: 16, s: 0.6, v: 0, tool: 'lamp', label: 'un foco',
      fact: 'La luz blanca intensa desorienta a las aves de noche. Las luminarias cálidas y apantalladas las protegen.' },
  };
  let t = 0, ents = [], effects = [], spawnT = 1.5, sel = -1, done = false, doneT = 0, saved = 0, nightToastShown = false;
  const seen = {};

  function spawn(dt) {
    spawnT -= dt;
    if (spawnT > 0 || t > DUR - 3) return;
    const pool = ['person'];
    if (t > 8) pool.push('dog');
    if (t > 16) pool.push('truck');
    if (t > 26) pool.push('atv');
    if (t > NIGHT) pool.push('lamp', 'lamp');
    const type = pick(pool), d = TYPES[type];
    const y = rand(390, 660);
    if (type === 'lamp') ents.push({ type, d, x: rand(560, 1120), y, timer: 8, max: 8, ph: rand(0, 4) });
    else ents.push({ type, d, x: W + 140, y, ph: rand(0, 4), state: 'come' });
    spawnT = Math.max(1.8, 3.4 - t * 0.03) + rand(-0.3, 0.5);
  }
  const persp = (y) => 0.72 + 0.5 * (y - 390) / 270;
  function rectOf(e) {
    const s = e.d.s * persp(e.y);
    return spriteRect('desert', e.d.f, e.x, e.y, s, 'bottom', 1.0);
  }
  function apply(toolIdx, e) {
    const tool = TOOLS[toolIdx];
    if (!e) { sfx('bad'); toast('No hay amenazas por ahora.', C.teal, 1.2); return; }
    if (e.d.tool !== tool.id) { sfx('bad'); toast(`${tool.art} no sirve para ${e.d.label}.`, '#b5452f', 1.6); return; }
    sfx('good');
    saved++;
    const bonus = e.type === 'lamp' ? Math.round(e.timer * 10) : Math.round(clamp((e.x - NEST.x) / 4, 0, 150));
    game.score += 100 + bonus;
    effects.push({ img: tool.img, x: e.type === 'lamp' ? e.x : e.x - 70, y: e.y + 4, life: 1.6, s: 0.2 * persp(e.y) });
    burst(e.x, e.y - 60, 14, '#ffe08a', 200, 0.6, 5, 120);
    if (e.type === 'lamp') { e.state = 'fixed'; e.fixT = 1.4; } else e.state = 'leave';
    if (!seen[e.type]) { seen[e.type] = true; toast(e.d.fact, C.deep, 5.5, true); }
    else toast(`+${100 + bonus}  ¡Bien hecho!`, C.good, 1.0);
  }
  function urgent(toolId) {
    const live = ents.filter((e) => e.state === 'come' || (e.type === 'lamp' && !e.state));
    const cand = toolId ? live.filter((e) => e.d.tool === toolId) : live;
    const list = cand.length ? cand : live;
    return list.sort((a, b) => urgency(a) - urgency(b))[0];
  }
  const urgency = (e) => (e.type === 'lamp' ? e.timer * 60 : (e.x - NEST.x) / e.d.v * 60);
  const toolBox = (i) => ({ x: W / 2 - 250 + i * 128, y: H - 128, w: 116, h: 116 });

  return {
    update(dt) {
      if (handleButtons()) return;
      if (pressed.Escape || pressed.KeyP) { paused = !paused; return; }
      if (paused) return;
      t += dt;
      if (!done) {
        spawn(dt);
        if (t > NIGHT && !nightToastShown) { nightToastShown = true; toast('Cae la noche… ¡atento a los focos de luz!', '#33356b', 2.6); }
        TOOLS.forEach((tool, i) => {
          if (pressed[tool.key] || pressed['Numpad' + (i + 1)]) {
            sel = i;
            const live = ents.filter((e) => e.state === 'come' || (e.type === 'lamp' && !e.state));
            const target = live.sort((a, b) => urgency(a) - urgency(b))[0];
            apply(i, target);
          }
        });
        if (ptr.tap) {
          ptr.tap = false;
          const ti = TOOLS.findIndex((_, i) => hit(toolBox(i), ptr.x, ptr.y));
          if (ti >= 0) { sel = ti; sfx('click'); }
          else {
            const target = ents.filter((e) => e.state === 'come' || (e.type === 'lamp' && !e.state))
              .find((e) => { const r = rectOf(e); return hit({ x: r.x - 30, y: r.y - 30, w: r.w + 60, h: r.h + 60 }, ptr.x, ptr.y); });
            if (target) { if (sel < 0) { sfx('bad'); toast('Primero elige una herramienta abajo.', C.teal, 1.6); } else apply(sel, target); }
          }
        }
        if (t >= DUR && !ents.some((e) => e.state === 'come' || (e.type === 'lamp' && !e.state))) {
          done = true; toast('¡Los polluelos nacieron sanos y salvos!', C.teal, 2.4);
        }
      } else {
        doneT += dt;
        if (doneT > 2.4) completePhase(this, {
          kicker: '¿SABÍAS QUE…?', title: 'Guardián de la pampa',
          body: 'El Gaviotín Chico anida en el suelo de la pampa desértica, lejos de la costa. Sus huevos y polluelos se camuflan con el terreno: por eso es tan importante respetar las zonas de nidificación.',
          art: (x, y) => drawItem('chick_beg', x, y, 0.27),
        }, () => setScene(Victory()));
      }
      for (const e of ents) {
        if (e.type === 'lamp') {
          if (e.state === 'fixed') { e.fixT -= dt; if (e.fixT <= 0) e.dead = true; continue; }
          e.timer -= dt;
          if (e.timer <= 0 && !done) { e.dead = true; loseLife('La luz intensa espantó a los gaviotines del nido.'); }
          continue;
        }
        const v = e.d.v * persp(e.y);
        if (e.state === 'come') {
          e.x -= v * dt;
          if (e.x < NEST.x + 150 && !done) { e.state = 'leave'; loseLife(`¡${e.d.label[0].toUpperCase() + e.d.label.slice(1)} llegó al nido!`); }
        } else { e.x += v * 1.8 * dt; if (e.x > W + 200) e.dead = true; }
      }
      ents = ents.filter((e) => !e.dead);
      for (const f of effects) f.life -= dt;
      effects = effects.filter((f) => f.life > 0);
    },
    drawWorld() {
      const night = clamp((t - NIGHT) / 3, 0, 1);
      drawTiled(IMG.sky3, t * 4);
      drawTiled(IMG.hor3, t * 4, -40);
      drawTiled(IMG.ground3, 0, 0);
      if (night > 0) {
        ctx.globalAlpha = night * 0.85;
        ctx.drawImage(IMG.night3, 0, 0, IMG.night3.width * H / IMG.night3.height, H);
        ctx.globalAlpha = 1;
      }
      drawItem('pair_nest', NEST.x, NEST.y, 0.62, { anchor: 'bottom' });
    },
    draw() {
      this.drawWorld();
      const list = [...ents].sort((a, b) => a.y - b.y);
      for (const e of list) {
        const s = e.d.s * persp(e.y);
        if (e.type === 'lamp') {
          if (e.state === 'fixed') {
            const g = ctx.createRadialGradient(e.x, e.y - 90, 5, e.x, e.y - 90, 120);
            g.addColorStop(0, 'rgba(255,190,90,.6)'); g.addColorStop(1, 'rgba(255,190,90,0)');
            ctx.fillStyle = g; ctx.fillRect(e.x - 120, e.y - 210, 240, 240);
            drawItem('tool_lamp', e.x, e.y, 0.3 * persp(e.y), { anchor: 'bottom', alpha: Math.min(1, e.fixT) });
          } else {
            const g = ctx.createRadialGradient(e.x - 60, e.y - 150, 10, e.x - 60, e.y - 150, 260);
            g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g; ctx.fillRect(e.x - 330, e.y - 420, 540, 540);
            drawSprite('desert', 16 + Math.floor(t * 6 + e.ph) % 4, e.x, e.y, s, { anchor: 'bottom' });
            bar(e.x - 50, e.y + 8, 100, 12, e.timer / e.max, e.timer < 3 ? C.bad : '#f6c445');
          }
        } else {
          drawSprite('desert', e.d.f + Math.floor(t * 8 + e.ph) % 4, e.x, e.y, s, { anchor: 'bottom', flip: e.state === 'leave' });
        }
        if ((e.state === 'come' || (e.type === 'lamp' && !e.state)) && urgent() === e) {
          const r = rectOf(e);
          text('▼', e.x, r.y - 22 + Math.sin(t * 8) * 5, 30, C.coral, { stroke: C.white, strokeW: 5 });
        }
      }
      for (const f of effects) drawItem(f.img, f.x, f.y, f.s, { anchor: 'bottom', alpha: Math.min(1, f.life * 2) });
      drawParticles();
      TOOLS.forEach((tool, i) => {
        const b = toolBox(i), on = sel === i;
        roundRect(b.x, b.y, b.w, b.h, 22, on ? 'rgba(242,140,107,.92)' : 'rgba(14,76,110,.78)', on ? C.white : 'rgba(255,255,255,.6)', on ? 5 : 3);
        const img = IMG[tool.img], sc = Math.min(70 / img.width, 64 / img.height);
        drawItem(tool.img, b.x + b.w / 2, b.y + 50, sc);
        text(tool.name, b.x + b.w / 2, b.y + b.h - 18, 18, C.white, { weight: 700 });
        roundRect(b.x - 6, b.y - 6, 30, 30, 15, C.white);
        text(String(i + 1), b.x + 9, b.y + 10, 19, C.deep);
      });
      hud({ title: `Fase 3 · Proteger el nido   ✔ ${saved}`, bar: Math.min(1, t / DUR), barColor: C.good, barIcon: ICON.egg });
      drawToasts();
      if (paused) pauseOverlay();
    },
  };
}

// ------------------------------------------------------------- endings
function saveBest() {
  if (game.score > game.best) { game.best = game.score; try { localStorage.setItem('gaviotin_best', String(game.best)); } catch (_) { /* nada */ } return true; }
  return false;
}
function Victory() {
  let t = 0, record = false;
  return {
    enter() { record = saveBest(); sfx('win'); },
    update(dt) { t += dt; handleButtons(); if (t > 1 && (pressed.Space || pressed.Enter)) setScene(Title()); if (Math.random() < dt * 3) burst(rand(100, W - 100), rand(80, 300), 12, pick(['#ffd34d', C.coral, '#7fe0ff', '#ffffff']), 180, 1.2, 5, 120); updateParticles(dt); },
    draw() {
      ctx.drawImage(IMG.win, 0, 0, W, H);
      ctx.fillStyle = 'rgba(14,40,60,.35)'; ctx.fillRect(0, 0, W, H);
      text('¡Lo lograste!', W / 2, 110, 86, C.white, { stroke: C.deep, strokeW: 14 });
      text('La familia del Gaviotín Chico está a salvo', W / 2, 185, 30, C.cream, { stroke: 'rgba(14,76,110,.9)', strokeW: 7 });
      text(`Puntaje: ${game.score}`, W / 2, 262, 48, '#ffd34d', { stroke: C.deep, strokeW: 10 });
      if (record) text('¡Nuevo récord!', W / 2, 314, 28, C.white, { stroke: C.coral, strokeW: 7 });
      button('Jugar de nuevo', W / 2 - 170, 360, 340, 78, () => setScene(Title()), { size: 32 });
      text('Conoce más y súmate a su cuidado en gaviotinchico.cl', W / 2, H - 34, 22, C.white, { weight: 700, stroke: 'rgba(0,0,0,.6)', strokeW: 6 });
      drawParticles();
    },
  };
}
function GameOver() {
  let t = 0;
  return {
    enter() { saveBest(); },
    update(dt) {
      t += dt;
      if (handleButtons()) return;
      if (t > 0.8 && (pressed.Space || pressed.Enter)) retry();
      if (pressed.Escape) setScene(Title());
    },
    draw() {
      ctx.drawImage(IMG.lose, 0, 0, W, H);
      ctx.fillStyle = 'rgba(14,40,60,.4)'; ctx.fillRect(0, 0, W, H);
      text('¡Casi!', W / 2, 120, 92, C.white, { stroke: C.deep, strokeW: 14 });
      text('El gaviotín necesita descansar un poco. ¿Lo intentas de nuevo?', W / 2, 200, 28, C.cream, { stroke: 'rgba(14,76,110,.9)', strokeW: 7 });
      text(`Puntaje: ${game.score}`, W / 2, 268, 40, '#ffd34d', { stroke: C.deep, strokeW: 9 });
      button('Reintentar fase', W / 2 - 170, 320, 340, 78, retry, { size: 32 });
      button('Menú', W / 2 - 110, 420, 220, 64, () => setScene(Title()), { color: C.teal, size: 26 });
    },
  };
  function retry() { game.score = game.phaseStartScore; startPhase(game.phase); }
}

// --------------------------------------------------------------- loading
function Loading(err) {
  return {
    update() {},
    draw() {
      ctx.fillStyle = C.deep; ctx.fillRect(0, 0, W, H);
      text('Vuelo del Gaviotín', W / 2, H / 2 - 60, 56, C.white);
      if (err) { text(err, W / 2, H / 2 + 20, 24, C.coral); return; }
      bar(W / 2 - 220, H / 2 + 10, 440, 22, loaded / total, C.coral);
      text('Cargando…', W / 2, H / 2 + 70, 22, C.sand, { weight: 600 });
    },
  };
}

// ------------------------------------------------------------------ loop
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  try { step(now); } catch (e) { console.error(e); for (const k in pressed) delete pressed[k]; ptr.tap = false; }
}
function step(now) {
  const dt = Math.min(1 / 30, (now - last) / 1000);
  last = now;
  buttons = nextButtons; nextButtons = [];
  if (scene) {
    scene.update(dt);
    tickGameOver(dt);
    if (!paused) { updateParticles(dt); updateToasts(dt); }
    shake = Math.max(0, shake - dt);
  }
  ctx.setTransform(pxScale, 0, 0, pxScale, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  if (shake > 0) ctx.translate(rand(-8, 8) * shake * 2, rand(-8, 8) * shake * 2);
  ctx.clearRect(-20, -20, W + 40, H + 40);
  if (scene) scene.draw();
  for (const k in pressed) delete pressed[k];
  ptr.tap = false;
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden && scene && scene.drawWorld && !paused) paused = true;
});

// Gancho de prueba: avanza la simulación N segundos sin depender del reloj del navegador.
window.__gav = {
  step(sec, hold = {}) {
    for (let i = 0; i < Math.round(sec * 30); i++) {
      Object.assign(keys, hold);
      buttons = nextButtons; nextButtons = [];
      scene.update(1 / 30);
      tickGameOver(1 / 30);
      if (!paused) { updateParticles(1 / 30); updateToasts(1 / 30); }
      nextButtons = [];
      ctx.setTransform(pxScale, 0, 0, pxScale, 0, 0);
      scene.draw();
      for (const k in pressed) delete pressed[k];
      ptr.tap = false;
    }
    for (const k in hold) keys[k] = false;
  },
  press(code) { pressed[code] = true; },
  get scene() { return scene; }, game, startPhase,
};
scene = Loading();
requestAnimationFrame(frame);
loadAll()
  .then(() => (document.fonts ? document.fonts.ready : null))
  .then(() => { computeBoxes(); setScene(Title()); })
  .catch((e) => { scene = Loading(e.message + ' (abre el juego desde un servidor web)'); });
