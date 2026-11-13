/* AutoPHG — page logic: loader, scroll direction for the 3D avatar, story beats, coverflow,
   rope-and-badge physics, game-style contact menu, cursor and sound. The WebGL stage lives in
   scene.js and is optional: if it fails to load the page still works with the 2D art. */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const isMobile = () => innerWidth <= 860;

/* ---------------- DATA ---------------- */
// Top clips on the channel (views as of Nov 2026) — edit freely.
const WORK = [
  { id: 'hgbZsTru6tk', short: true, cat: 'SHORTS · HORROR', t: 'ประสบการณ์เจอผีของจริงในแมพ Steal an Egg!?', tag: 'STEAL AN EGG', v: '437K' },
  { id: 'nOabhRMfAto', short: true, cat: 'SHORTS · CREATOR', t: 'กายหงิดเล่น Roblox โหดแค่ไหน?', tag: 'กายหงิด × ROBLOX', v: '312K' },
  { id: '1ymsQysuw9A', short: true, cat: 'SHORTS · CREATOR', t: 'แป๊ะดูดแหนมเล่น Roblox เก่งแค่ไหน?', tag: 'แป๊ะดูดแหนม × ROBLOX', v: '201K' },
  { id: 'zFlcVjNkcUI', short: true, cat: 'SHORTS · NEWS', t: 'ทำไมคนถึงมาปกป้อง David Baszucki???', tag: 'ROBLOX NEWS', v: '165K' },
  { id: 'CRpxYfuhXLE', short: true, cat: 'SHORTS · HORROR', t: 'เจอผีในโรบอก ตอนตี 2?', tag: 'ตี 2', v: '151K' },
  { id: 'rvZpulh6YxU', short: true, cat: 'SHORTS · GAMEPLAY', t: '7 ดาวตัวแรกหลังกลับมาเล่น All Star', tag: 'ALL STAR', v: '103K' },
  { id: 'ERSXSwU9dTg', short: true, cat: 'SHORTS · CREATOR', t: 'พรี่เต้มีโรบัคทั้งหมดเท่าไหร่?', tag: 'ROBUX CHECK', v: '83K' },
  { id: 's8m9JvKSYZM', short: false, cat: 'VIDEO · ESSAY', t: 'Transformers ที่มากกว่าแค่คำว่า ONE', tag: 'VIDEO ESSAY', v: '14K' },
];
const MORE = ['vOpL_srj8Xo', 'zk1XXYmffXQ', 'ixOLA99CDn4', 'HbjoFS0nc0Q', '7gI_ZlZEr8A'];
const yt = (id, n) => `https://i.ytimg.com/vi/${id}/${n}.jpg`;
const watch = (w) => (w.short ? `https://www.youtube.com/shorts/${w.id}` : `https://www.youtube.com/watch?v=${w.id}`);

const body = document.body, canvas = $('#gl'), loader = $('#loader'), wipe = $('#wipe'), nav = $('#nav');
const sections = $$('main > section');

/* ---------------- SOUND (synthesised, off until asked for) ---------------- */
const sfx = (() => {
  let ctx = null, out = null, on = false;
  const boot = () => { if (ctx) return; ctx = new (window.AudioContext || window.webkitAudioContext)(); out = ctx.createGain(); out.gain.value = 0.5; out.connect(ctx.destination); };
  const env = (g, t, a, d, peak) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  const noise = (dur) => { const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; const s = ctx.createBufferSource(); s.buffer = b; return s; };
  const osc = (type, f, t, dur, peak, dest, f2) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur); env(g, t, 0.005, dur, peak); o.connect(g).connect(dest || out); o.start(t); o.stop(t + dur + 0.05); };
  const guard = (fn) => (...a) => { if (!on || !ctx) return; try { fn(ctx.currentTime, ...a); } catch (_) { /* audio is decoration */ } };
  return {
    get on() { return on; },
    toggle() { on = !on; if (on) { boot(); ctx.resume(); } return on; },
    whoosh: guard((t) => { const n = noise(0.3), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(5200, t + 0.16); env(g, t, 0.02, 0.22, 0.7); n.connect(f).connect(g).connect(out); n.start(t); }),
    thud: guard((t) => { osc('sine', 130, t, 0.4, 0.9, null, 38); const n = noise(0.25), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'lowpass'; f.frequency.value = 700; env(g, t, 0.004, 0.2, 0.5); n.connect(f).connect(g).connect(out); n.start(t); }),
    chord: guard((t) => {                                    // distorted E5 power chord
      const ws = ctx.createWaveShaper(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), c = new Float32Array(256);
      for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 6); } ws.curve = c; lp.type = 'lowpass'; lp.frequency.value = 2600;
      env(g, t, 0.006, 1.1, 0.32); ws.connect(lp).connect(g).connect(out);
      [82.41, 123.47, 164.81, 247.2].forEach((f, i) => { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = (i - 1.5) * 6; og.gain.value = 0.5; o.connect(og).connect(ws); o.start(t); o.stop(t + 1.3); });
    }),
    tick: guard((t) => osc('square', 1250, t, 0.035, 0.12)),
    confirm: guard((t) => { osc('square', 660, t, 0.07, 0.16); osc('square', 990, t + 0.07, 0.14, 0.16); }),
  };
})();
const sndBtn = $('#snd');
sndBtn.addEventListener('click', () => { const on = sfx.toggle(); sndBtn.setAttribute('aria-pressed', on); $('span', sndBtn).textContent = on ? 'SOUND ON' : 'SOUND OFF'; if (on) sfx.confirm(); });

/* ---------------- LAYOUT METRICS ---------------- */
let vh = innerHeight, vw = innerWidth, docH = 1;
const M = {};
function measure() {
  vh = innerHeight; vw = innerWidth;
  sections.forEach((s) => { M[s.id] = { top: s.offsetTop, h: s.offsetHeight }; });
  docH = Math.max(1, document.documentElement.scrollHeight - vh);
  buildKeys(); layoutRope(); pmPlace();
}
const pinY = (id, p) => M[id].top + p * (M[id].h - vh);
const enterY = (id, p) => M[id].top - vh + p * vh;
const pinP = (id, y) => (y - M[id].top) / Math.max(1, M[id].h - vh);

/* ---------------- SHOT KEYFRAMES (where the avatar is, which pose weights are on) ----------------
   fx,fy screen position of the chest · fh avatar height as a share of the viewport · yaw,pitch camera orbit
   turn avatar spin · vis canvas opacity · rest/present/wave/point pose weights · run, storm acts · light 0 red rim, 1 bone rim */
const BASE = { fx: .5, fy: .52, fh: .6, yaw: 0, pitch: 0, turn: 0, vis: 1, run: 0, storm: 0, look: 0, pad: 1, fx3d: 1, light: 0, rest: 1, present: 0, wave: 0, point: 0 };
let KEYS = [];
function buildKeys() {
  const m = isMobile();
  const k = (y, d, mob) => ({ y, s: { ...BASE, ...d, ...(m ? mob : null) } });
  KEYS = [
    k(0, { fx: .72, fy: .52, fh: .6, yaw: -.2, pitch: -.04, turn: -.08, look: 1 }, { fx: .54, fy: .655, fh: .35, yaw: -.14 }),
    k(vh * .5, { fx: .66, fy: .54, fh: .6, yaw: -.45, pitch: -.03, run: .6, look: .3, pad: .4 }, { fx: .52, fy: .58, fh: .38 }),
    // I PLAY — sprinting, camera drifting round
    k(pinY('story', 0), { fx: .3, fy: .57, fh: .56, yaw: -.62, pitch: -.02, run: 1, pad: 0, fx3d: .6 }, { fx: .5, fy: .5, fh: .42 }),
    k(pinY('story', .2), { fx: .3, fy: .57, fh: .58, yaw: -.95, pitch: -.02, run: 1, pad: 0, fx3d: .6 }, { fx: .5, fy: .5, fh: .44 }),
    // I CUT — the leaping slash is a timed act fired from step()
    k(pinY('story', .27), { fx: .5, fy: .6, fh: .58, yaw: .12, pitch: -.04 }, { fy: .5, fh: .42 }),
    k(pinY('story', .49), { fx: .5, fy: .6, fh: .62, yaw: -.1, pitch: -.05 }, { fy: .5, fh: .45 }),
    // I POST — clips orbit the avatar
    k(pinY('story', .57), { fx: .46, fy: .6, fh: .46, yaw: .35, pitch: .06, present: 1 }, { fx: .5, fy: .47, fh: .3 }),
    k(pinY('story', .63), { fx: .46, fy: .6, fh: .46, yaw: .2, pitch: .08, present: 1, storm: .8 }, { fx: .5, fy: .47, fh: .3 }),
    k(pinY('story', .76), { fx: .46, fy: .6, fh: .48, yaw: -.3, pitch: .08, present: 1, storm: 1 }, { fx: .5, fy: .47, fh: .31 }),
    // motto — avatar drops out of frame; it is off stage until the contact menu
    k(pinY('story', .84), { fx: .5, fy: 1.25, fh: .5, yaw: -.4, fx3d: .3, pad: 0 }, null),
    k(pinY('story', .88), { fx: .5, fy: 1.5, fh: .5, vis: 0, fx3d: 0, pad: 0 }, null),
    k(enterY('contact', .2), { fx: .76, fy: 1.2, fh: .72, yaw: -.3, turn: -.12, vis: 0, light: 1, fx3d: .3 }, { fx: .76, fy: 1.1, fh: .27, pad: 0 }),
    k(enterY('contact', .9), { fx: .76, fy: .53, fh: .72, yaw: -.28, pitch: -.04, turn: -.12, look: 1, light: 1, fx3d: .3 }, { fx: .76, fy: .3, fh: .27, pad: 0, fx3d: .15 }),
    k(docH + 10, { fx: .76, fy: .52, fh: .72, yaw: -.22, pitch: -.04, turn: -.12, look: 1, light: 1, fx3d: .3 }, { fx: .76, fy: .26, fh: .27, pad: 0, fx3d: .15 }),
  ].sort((a, b) => a.y - b.y);
}
const shot = { ...BASE };
const pmBg = $('.pm__bg');
function shotAt(y) {
  let i = 0; while (i < KEYS.length - 2 && y > KEYS[i + 1].y) i++;
  const A = KEYS[i], B = KEYS[i + 1], t = smooth((y - A.y) / Math.max(1, B.y - A.y));
  for (const key in BASE) shot[key] = lerp(A.s[key], B.s[key], t);
  const cy = enterY('contact', .3);
  if (y > cy) {                                              // contact menu: pose follows the highlighted item
    const w = smooth((y - cy) / (vh * .5));
    shot.point = pm.pose === 'point' ? w : 0; shot.wave = pm.pose === 'wave' ? w : 0; shot.present = pm.pose === 'present' ? w : 0;
    const mob = isMobile();
    if (mob) { const r = pmBg.getBoundingClientRect(); shot.fy = lerp(shot.fy, (r.top + r.height * .25) / vh, w); }
    if (pm.view === 'sub') { shot.fh *= mob ? 1.25 : 1.45; shot.fy += mob ? .05 : .2; shot.yaw += .2; shot.pad = 0; }   // close-up while a sub-menu is open
  }
  return shot;
}

/* ---------------- LOADER / INTRO ---------------- */
const pctEl = $('#loaderPct'), barEl = $('#loaderBar'), msgEl = $('#loaderMsg');
const load = { model: 0, fonts: 0, shown: 0, done: false, t0: performance.now(), settled: false };
let scene = null;
function loaderTick() {
  if (load.done) return;
  const elapsed = performance.now() - load.t0;
  const target = Math.min(load.model * .85 + load.fonts * .15, clamp(elapsed / 1200)) * 100;
  load.shown += (target - load.shown) * .14;
  const n = Math.round(load.shown);
  pctEl.textContent = String(n).padStart(2, '0'); barEl.style.setProperty('--p', (load.shown / 100).toFixed(3));
  if (n >= 60) msgEl.textContent = 'กำลังลับดาบ';
  if ((n >= 99 && load.settled) || elapsed > 12000) finishIntro(); else requestAnimationFrame(loaderTick);
}
function finishIntro() {
  if (load.done) return; load.done = true;
  pctEl.textContent = '100'; barEl.style.setProperty('--p', 1);
  loader.classList.add('done'); wipe.classList.add('done'); body.classList.remove('is-loading');
  setTimeout(enter, reduce ? 0 : 480);
}
function enter() {
  if (!scene) { heroCounts(); return; }
  if (reduce || scrollY > vh * .5) { scene.skipIntro(); heroCounts(); } else scene.play('entrance');
}
$('#loaderSkip').addEventListener('click', finishIntro);
(document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { load.fonts = 1; measure(); });
if (reduce) { load.settled = true; finishIntro(); } else requestAnimationFrame(loaderTick);

/* ---------------- WEBGL STAGE ---------------- */
const impact = $('#impact'), wordCut = $('.word--cut');
function fireImpact() {
  impact.classList.toggle('flip'); impact.classList.remove('go'); void impact.offsetWidth; impact.classList.add('go');
  canvas.classList.add('flash'); setTimeout(() => canvas.classList.remove('flash'), 70);
}
let heroCounted = false;
function heroCounts() { if (heroCounted) return; heroCounted = true; $$('.hero__stats .count').forEach(countUp); }
import('./scene.js').then((mod) => mod.createScene(canvas, {
  onProgress: (p) => { load.model = Math.max(load.model, p * .98); },
  onLand: () => { sfx.thud(); },
  onSlash: () => {
    if (!reduce && Math.abs(scrollV) < 5000) fireImpact();
    sfx.whoosh(); sfx.chord(); heroCounts();
    const raw = pinP('story', scrollY); if (raw > .24 && raw < .56) wordCut.classList.add('is-cut');
  },
})).then((s) => {
  scene = s; load.model = 1; load.settled = true;
  if (load.done) enter();
  (window.requestIdleCallback || ((f) => setTimeout(f, 1500)))(() => scene.loadClips([...WORK.filter((w) => w.short).map((w) => yt(w.id, 'frame0')), ...MORE.map((id) => yt(id, 'mqdefault'))]));
}).catch((err) => {
  console.warn('[AutoPHG] 3D stage unavailable, using 2D art.', err);
  canvas.hidden = true; $('.hero__fallback').hidden = false; $('#heroDrag').hidden = true; $('.hero__hint').hidden = true;
  load.model = 1; load.settled = true;
});

/* ---------------- POINTER, DRAG TO ROTATE, CURSOR ---------------- */
let scrollV = 0;
const env = { px: 0, py: 0, dragYaw: 0, dt: 0.016 };
const ptr = { x: 0, y: 0, vyaw: 0, dragging: false, lastX: 0, idle: 0 };
addEventListener('pointermove', (e) => { if (e.pointerType === 'touch') return; ptr.x = (e.clientX / vw) * 2 - 1; ptr.y = (e.clientY / vh) * 2 - 1; }, { passive: true });
// custom cursor (mouse only): a small block; outlined square on links; labelled block on things you can drag / open
const cur = $('#cur'), curLabel = $('span', cur);
if (finePointer) {
  document.documentElement.classList.add('has-cur');
  let mx = -99, my = -99, cx = -99, cy = -99, craf = 0;
  const loop = () => {
    cx += (mx - cx) * .3; cy += (my - cy) * .3; cur.style.translate = `${cx.toFixed(1)}px ${cy.toFixed(1)}px`;   // `translate`, so the click squash (scale) stays in place
    craf = Math.abs(mx - cx) + Math.abs(my - cy) > .3 ? requestAnimationFrame(loop) : 0;                          // idle once it has caught up
  };
  addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; cur.classList.add('on'); if (!craf) craf = requestAnimationFrame(loop); }, { passive: true });
  document.addEventListener('pointerleave', () => cur.classList.remove('on')); addEventListener('blur', () => cur.classList.remove('on'));
  addEventListener('pointerover', (e) => {
    const t = e.target; if (!t.closest) return;
    const big = t.closest('[data-cur]'), link = big ? null : t.closest('a,button,[role="button"]');
    cur.classList.toggle('big', !!big); cur.classList.toggle('link', !!link); cur.classList.toggle('hide', !!t.closest('.modal'));
    curLabel.textContent = big ? big.dataset.cur : '';
  }, { passive: true });
  addEventListener('pointerdown', () => cur.animate([{ scale: '1 1' }, { scale: '1.35 .7' }, { scale: '1 1' }], { duration: 260, easing: 'ease-out' }));
}
const dragEl = $('#heroDrag');
dragEl.addEventListener('pointerdown', (e) => { ptr.dragging = true; ptr.lastX = e.clientX; ptr.vyaw = 0; dragEl.setPointerCapture(e.pointerId); });
dragEl.addEventListener('pointermove', (e) => { if (!ptr.dragging) return; const dx = e.clientX - ptr.lastX; ptr.lastX = e.clientX; env.dragYaw += dx * .011; ptr.vyaw = dx * .66; ptr.idle = 0; });
const endDrag = () => { ptr.dragging = false; };
dragEl.addEventListener('pointerup', endDrag); dragEl.addEventListener('pointercancel', endDrag);

/* ---------------- STORY BEATS ---------------- */
const BEATS = [[0, .245], [.245, .51], [.51, .79], [.79, 1.001]];
const words = $$('.story .word'), beats = $$('.story .beat'), dots = $$('.story__dots i');
let prevRaw = -9;
function storyFrame(y) {
  const raw = pinP('story', y);
  if (scene && prevRaw < .3 && raw >= .3 && raw < .48 && Math.abs(scrollV) < 6000 && !scene.busy && !reduce) scene.play('leap');
  if (raw < .24 || raw > .58) wordCut.classList.remove('is-cut');
  prevRaw = raw;
  if (raw < -1.2 || raw > 1.4) return;
  const enter = clamp((y - (M.story.top - vh)) / vh);
  BEATS.forEach(([a, b], i) => {
    const local = (raw - a) / (b - a);
    let win = clamp(local / .16) * clamp((1 - local) / .14);
    if (i === 0 && raw < .04) win = enter * enter;
    if (i === BEATS.length - 1 && local > .5) win = 1;
    const w = words[i], bt = beats[i];
    w.style.opacity = win.toFixed(3); bt.style.opacity = smooth(win * 1.25).toFixed(3);
    bt.style.translate = `0 ${((1 - win) * (local < .5 ? 30 : -30)).toFixed(1)}px`;
    if (i === 0) w.style.setProperty('--x', lerp(14, -14, clamp(local)).toFixed(2));
    if (i === 2) w.style.setProperty('--s', clamp(local).toFixed(3));
    if (i === 3) w.style.setProperty('--m', (1 - smooth(local / .45)).toFixed(3));
    dots[i].classList.toggle('on', local >= 0 && local < 1);
  });
}

/* ---------------- WORK COVERFLOW ---------------- */
const flow = $('#flow'), work = { active: -1, f: 0 }, workInfo = $('#workInfo');
const cards = WORK.map((w, i) => {
  const a = document.createElement('a');
  a.className = 'card' + (w.short ? '' : ' card--wide'); a.href = watch(w); a.target = '_blank'; a.rel = 'noopener'; a.setAttribute('role', 'listitem'); a.dataset.cur = 'OPEN';
  a.setAttribute('aria-label', `${w.t} — ${w.v} views`);
  const src = w.short ? yt(w.id, 'oar2') : yt(w.id, 'hq720');
  a.innerHTML = (w.short ? '' : `<img class="card__blur" src="${src}" alt="" loading="lazy" decoding="async">`) +
    `<img class="card__main" src="${src}" alt="" loading="lazy" decoding="async"><span class="card__n">${String(i + 1).padStart(2, '0')}</span><span class="card__t"><small>${w.cat}</small>${w.tag}</span>`;
  a.addEventListener('click', (e) => { if (i !== work.active) { e.preventDefault(); goWork(i); } });
  flow.appendChild(a); return a;
});
$('#workTotal').textContent = String(WORK.length).padStart(2, '0');
function setWork(i) {
  if (i === work.active) return; const first = work.active < 0; work.active = i; const w = WORK[i];
  $('#workCat').textContent = w.cat; $('#workName').textContent = w.t; $('#workViews').textContent = w.v; $('#workLink').href = watch(w);
  $('#workIdx').textContent = String(i + 1).padStart(2, '0');
  cards.forEach((c, j) => c.classList.toggle('is-active', j === i));
  workInfo.classList.remove('swap'); void workInfo.offsetWidth; workInfo.classList.add('swap'); if (!first) sfx.tick();
}
function goWork(i) { scrollTo({ top: pinY('work', clamp(i, 0, WORK.length - 1) / (WORK.length - 1)) + 1, behavior: reduce ? 'auto' : 'smooth' }); }
$('#workPrev').addEventListener('click', () => goWork(work.active - 1));
$('#workNext').addEventListener('click', () => goWork(work.active + 1));
function workFrame(y, dt) {
  const p = pinP('work', y); if (p < -.6 || p > 1.6) return;
  const target = clamp(p) * (WORK.length - 1);
  work.f += (target - work.f) * (1 - Math.exp(-dt * 9));
  setWork(Math.round(target));
  const u = vh / 100, m = isMobile();
  cards.forEach((c, i) => {
    const d = i - work.f, ad = Math.abs(d), sgn = Math.sign(d);
    const x = (d * (m ? 15 : 18) + sgn * Math.min(ad, 1) * (m ? 9 : 12)) * u;
    c.style.transform = `translate3d(${x.toFixed(1)}px,0,${(-Math.min(ad, 3) * 20 * u).toFixed(1)}px) rotateY(${(-clamp(d, -1, 1) * 52).toFixed(2)}deg)`;
    c.style.opacity = clamp(1.25 - (ad - 2.2)).toFixed(2); c.style.zIndex = String(100 - Math.round(ad * 10));
    c.style.filter = ad > .5 ? `brightness(${clamp(1 - ad * .24, .3, 1).toFixed(2)})` : ''; c.style.visibility = ad > 3.4 ? 'hidden' : '';
  });
}

/* ---------------- BADGE ON A ROPE (verlet) — drag, fling, click to flip ---------------- */
const ly = { el: $('#lanyard'), cv: $('#lanyard canvas'), badge: $('#badge'), N: 14, pts: [], seg: 1, ox: 60, oy: 0, drag: false, off: [0, 0], tgt: [0, 0], ang: 0, flip: 0, flipTo: 0, moved: 0, t0: 0, w: 280, ready: false };
ly.ctx = ly.cv.getContext('2d');
function layoutRope() {
  const r = ly.el.getBoundingClientRect(); if (!r.width) return;
  ly.oy = Math.round(vh * .22); ly.w = ly.badge.offsetWidth;
  const dpr = Math.min(devicePixelRatio || 1, 2), cw = r.width + ly.ox * 2, ch = r.height + ly.oy + 80;
  ly.cv.width = Math.round(cw * dpr); ly.cv.height = Math.round(ch * dpr); ly.ctx.setTransform(dpr, 0, 0, dpr, ly.ox * dpr, ly.oy * dpr);
  ly.ax = r.width / 2; ly.ay = -ly.oy - 10; ly.len = ly.oy + 120; ly.seg = ly.len / ly.N; ly.cw = cw; ly.ch = ch;
  if (!ly.ready) { ly.pts = Array.from({ length: ly.N + 1 }, (_, i) => ({ x: ly.ax + (i ? 46 : 0), y: ly.ay + i * ly.seg, px: ly.ax + (i ? 70 : 0), py: ly.ay + i * ly.seg })); ly.ready = true; }
}
const local = (e) => { const r = ly.el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
ly.badge.addEventListener('pointerdown', (e) => {
  const [x, y] = local(e), last = ly.pts[ly.N]; ly.drag = true; ly.off = [x - last.x, y - last.y]; ly.tgt = [last.x, last.y]; ly.moved = 0; ly.t0 = performance.now(); ly.sx = e.clientX; ly.sy = e.clientY;
  ly.badge.setPointerCapture(e.pointerId);
});
ly.badge.addEventListener('pointermove', (e) => { if (!ly.drag) return; const [x, y] = local(e); ly.tgt = [x - ly.off[0], y - ly.off[1]]; ly.moved = Math.max(ly.moved, Math.hypot(e.clientX - ly.sx, e.clientY - ly.sy)); });
const flipBadge = () => { ly.flipTo += 180; sfx.tick(); };
const dropBadge = () => { if (!ly.drag) return; ly.drag = false; if (ly.moved < 7 && performance.now() - ly.t0 < 450) flipBadge(); };
ly.badge.addEventListener('pointerup', dropBadge); ly.badge.addEventListener('pointercancel', dropBadge);
ly.badge.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flipBadge(); } });
function ropeFrame(dt, y) {
  const r = M.about; if (!r || !ly.ready || y + vh < r.top - 300 || y > r.top + r.h + 300) return;
  const P = ly.pts, N = ly.N, h = Math.min(dt, 1 / 30) / 2;
  for (let step = 0; step < 2; step++) {
    for (let i = 1; i <= N; i++) {
      const p = P[i], vx = (p.x - p.px) * .992, vy = (p.y - p.py) * .992;
      p.px = p.x; p.py = p.y; p.x += vx + clamp(scrollV, -3000, 3000) * .0000035 * i; p.y += vy + (i === N ? 5200 : 2600) * h * h;
    }
    for (let it = 0; it < 14; it++) {
      P[0].x = ly.ax; P[0].y = ly.ay;
      if (ly.drag) {                                         // the hand holds the badge; the rope cannot stretch
        let dx = ly.tgt[0] - ly.ax, dy = ly.tgt[1] - ly.ay; const d = Math.hypot(dx, dy) || 1, mx = ly.len * 1.02;
        if (d > mx) { dx *= mx / d; dy *= mx / d; } P[N].x = ly.ax + dx; P[N].y = ly.ay + dy;
      }
      for (let i = 0; i < N; i++) {
        const a = P[i], b = P[i + 1], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, k = (d - ly.seg) / d;
        const wa = i === 0 ? 0 : (ly.drag && i + 1 === N ? 1 : .5), wb = ly.drag && i + 1 === N ? 0 : (i === 0 ? 1 : .5);
        a.x += dx * k * wa; a.y += dy * k * wa; b.x -= dx * k * wb; b.y -= dy * k * wb;
      }
    }
  }
  const end = P[N], pre = P[N - 3];
  let target = Math.atan2(end.x - pre.x, end.y - pre.y); target += clamp((end.x - end.px) * .012, -.5, .5);
  ly.ang += (target - ly.ang) * .28; ly.flip += (ly.flipTo - ly.flip) * (1 - Math.exp(-dt * 9));
  ly.badge.style.transform = `translate(${(end.x - ly.w / 2).toFixed(1)}px,${end.y.toFixed(1)}px) rotate(${(-ly.ang).toFixed(4)}rad) rotateY(${ly.flip.toFixed(1)}deg)`;
  ly.badge.style.setProperty('--gl', (ly.ang * 260).toFixed(0) + '%');
  const c = ly.ctx; c.clearRect(-ly.ox, -ly.oy, ly.cw, ly.ch); c.lineCap = 'round'; c.lineJoin = 'round';
  const path = () => { c.beginPath(); c.moveTo(P[0].x, P[0].y); for (let i = 1; i < N; i++) c.quadraticCurveTo(P[i].x, P[i].y, (P[i].x + P[i + 1].x) / 2, (P[i].y + P[i + 1].y) / 2); c.lineTo(end.x, end.y); };
  path(); c.strokeStyle = '#efe7d8'; c.lineWidth = 18; c.stroke();
  path(); c.strokeStyle = '#161313'; c.lineWidth = 15; c.stroke();
  path(); c.strokeStyle = '#ee1026'; c.lineWidth = 2.5; c.setLineDash([12, 16]); c.stroke(); c.setLineDash([]);
  c.save(); c.translate(end.x, end.y); c.rotate(-ly.ang); c.fillStyle = '#b9b2a7'; c.fillRect(-9, -14, 18, 26); c.fillStyle = '#161313'; c.fillRect(-5, -2, 10, 10); c.restore();
}

/* ---------------- CONTACT — game menu: pick a category, a wedge wipes across, its rows slide in ---------------- */
const pm = { main: $('#pmMain'), sub: $('#pms'), items: $$('.pm__item'), sel: -1, selEl: $('#pmSel'), info: $('#pmInfo'), wipes: $$('.pm__wipe'), pose: 'rest', typer: 0, view: 'main', rows: [], rsel: 0, busy: false };
pm.items.forEach((it, i) => it.style.setProperty('--i', i));
function pmPlace() {
  const it = pm.items[Math.max(0, pm.sel)]; if (!it || pm.view !== 'main') return;
  const shift = parseFloat(getComputedStyle(it).fontSize) * .3, st = pm.selEl.style;
  st.setProperty('--x', (it.offsetLeft + shift) + 'px'); st.setProperty('--y', it.offsetTop + 'px'); st.setProperty('--w', it.offsetWidth + 'px'); st.setProperty('--h', it.offsetHeight + 'px');
}
function pmSelect(i, quiet) {
  i = (i + pm.items.length) % pm.items.length; if (i === pm.sel) return; pm.sel = i; const it = pm.items[i];
  pm.items.forEach((el, j) => el.classList.toggle('is-sel', j === i)); pmPlace(); pm.pose = it.dataset.pose;
  pm.selEl.classList.remove('kick', 'go'); void pm.selEl.offsetWidth; pm.selEl.classList.add('kick');
  clearInterval(pm.typer); const txt = it.dataset.info; let n = 0; pm.info.textContent = '';
  pm.typer = setInterval(() => { pm.info.textContent = txt.slice(0, (n += 2)); if (n >= txt.length) clearInterval(pm.typer); }, reduce ? 1 : 16);
  if (!quiet) sfx.tick();
}
function rowSelect(j, quiet) {
  if (!pm.rows.length) return; j = (j + pm.rows.length) % pm.rows.length; if (j === pm.rsel && pm.rows[j].classList.contains('is-sel')) return;
  pm.rsel = j; pm.rows.forEach((r, k) => r.classList.toggle('is-sel', k === j)); if (!quiet) sfx.tick();
}
function pmWipe(mid) {
  if (reduce) { mid(); return; }
  pm.busy = true; pm.wipes.forEach((w) => { w.classList.remove('go'); void w.offsetWidth; w.classList.add('go'); }); sfx.whoosh();
  setTimeout(mid, 250); setTimeout(() => { pm.busy = false; }, 540);
}
function pmOpen(i) {
  if (pm.busy || pm.view === 'sub') return; pmSelect(i, true); const it = pm.items[pm.sel], k = it.dataset.k;
  pm.selEl.classList.remove('go'); void pm.selEl.offsetWidth; pm.selEl.classList.add('go'); sfx.confirm();
  pmWipe(() => {
    pm.view = 'sub'; pm.main.hidden = true; pm.sub.hidden = false; $('#pmsTitle').textContent = it.textContent.trim();
    $$('.pms__list', pm.sub).forEach((l) => { l.hidden = l.dataset.k !== k; });
    pm.rows = $$(`.pms__list[data-k="${k}"] .pms__row`, pm.sub); pm.rows.forEach((r, j) => r.style.setProperty('--i', j));
    pm.sub.classList.remove('in'); void pm.sub.offsetWidth; pm.sub.classList.add('in'); rowSelect(0, true);
    if (pm.rows[0]) pm.rows[0].focus({ preventScroll: true });
  });
}
function pmBack() {
  if (pm.busy || pm.view === 'main') return; sfx.tick();
  pmWipe(() => {
    pm.view = 'main'; pm.sub.hidden = true; pm.main.hidden = false; pm.main.classList.remove('in'); void pm.main.offsetWidth; pm.main.classList.add('in');
    pmPlace(); pm.items[pm.sel].focus({ preventScroll: true });
  });
}
pm.items.forEach((it, i) => { it.addEventListener('pointerenter', () => pmSelect(i)); it.addEventListener('focus', () => pmSelect(i)); it.addEventListener('click', () => pmOpen(i)); });
const rowIndex = (e) => pm.rows.indexOf(e.target.closest ? e.target.closest('.pms__row') : null);
pm.sub.addEventListener('pointerover', (e) => { const j = rowIndex(e); if (j >= 0) rowSelect(j); });
pm.sub.addEventListener('focusin', (e) => { const j = rowIndex(e); if (j >= 0) rowSelect(j); });
pm.sub.addEventListener('click', (e) => { const j = rowIndex(e); if (j < 0) return; const r = pm.rows[j]; r.classList.remove('go'); void r.offsetWidth; r.classList.add('go'); sfx.confirm(); });
$('#pmsBack').addEventListener('click', pmBack);
pmSelect(0, true);

/* ---------------- SHIRT RACK (Roblox group) ---------------- */
const TEES = ['Black Red Suit 2.0', 'Christmas Santa Suit', 'BlueGenius Suit XD', 'RedGenius Suit XD', 'Christmas Red Santa', 'RedGeniusCloth XD', 'RedMaster Coat XD', 'Halloween Suit · Long',
  'Black Red Suit', 'Christmas Green Elf', 'Black Blue Suit Shirt', 'Christmas Hoodie', 'Green Elf Christmas', 'BluePremium Suit XD', 'RedPremium Suit XD', 'Halloween · Short Sleeve'];
const rack = $('#rack');
[TEES.slice(0, 8), TEES.slice(8)].forEach((names, r) => {
  const row = document.createElement('div'); row.className = 'rack__row';
  const html = names.map((n, i) => `<div class="tee"><div class="tee__img"><img src="media/img/shirts/s${String(r * 8 + i).padStart(2, '0')}.webp" alt="${n}" loading="lazy" width="338" height="336"></div><b>${n}</b><span class="mono">ROBLOX SHIRT · OFF SALE</span></div>`).join('');
  row.innerHTML = html.repeat(4); $$('.tee', row).slice(8).forEach((el) => el.setAttribute('aria-hidden', 'true')); rack.appendChild(row);
});

/* ---------------- DISCORD — live member counts from the public invite endpoint (static numbers stay if it fails) ---------------- */
const invites = {};
$$('[data-invite]').forEach((el) => { (invites[el.dataset.invite] = invites[el.dataset.invite] || []).push(el); });
Object.keys(invites).forEach((code) => fetch(`https://discord.com/api/v9/invites/${code}?with_counts=true`).then((r) => (r.ok ? r.json() : null)).then((d) => {
  if (!d || !d.guild) return;
  invites[code].forEach((el) => {
    $$('[data-members]', el).forEach((n) => { n.textContent = d.approximate_member_count.toLocaleString('en-US'); });
    $$('[data-online]', el).forEach((n) => { n.textContent = d.approximate_presence_count.toLocaleString('en-US'); });
    const nm = $('.srv__name', el), img = $('.srv__icon img', el); if (nm) nm.textContent = d.guild.name;
    if (img && d.guild.icon) { img.onload = () => { img.hidden = false; }; img.src = `https://cdn.discordapp.com/icons/${d.guild.id}/${d.guild.icon}.webp?size=160`; }
  });
}).catch(() => {}));

/* ---------------- NAV / HUD / BG ---------------- */
const links = $$('.nav__links a'), linkTargets = links.map((a) => a.getAttribute('href').slice(1));
const hudNum = $('#hudNum'), hudName = $('#hudName'), rail = $('#railFill'), bg = $('.bg');
const GLOW = { home: ['72%', '52%', .5], story: ['50%', '60%', .75], collab: ['80%', '40%', .4], work: ['62%', '60%', .45], merch: ['50%', '70%', .5], tac: ['50%', '50%', 0], discord: ['20%', '50%', .4], about: ['24%', '46%', .55], contact: ['50%', '50%', 0] };
const NAVMAP = { collab: 'story', discord: 'tac' };
let curSec = '', lastY = 0, navY = 0;
function chrome(y) {
  let s = sections[0]; for (const el of sections) if (M[el.id].top <= y + vh * .5) s = el;
  if (s.id !== curSec) {
    curSec = s.id; hudNum.textContent = String(sections.indexOf(s)).padStart(2, '0'); hudName.textContent = s.dataset.sec;
    const g = GLOW[s.id]; bg.style.setProperty('--gx', g[0]); bg.style.setProperty('--gy', g[1]); bg.style.setProperty('--glow', g[2]);
    const navId = NAVMAP[s.id] || s.id; links.forEach((a, i) => a.classList.toggle('active', linkTargets[i] === navId));
  }
  rail.style.setProperty('--p', clamp(y / docH).toFixed(4));
}
const burger = $('#burger');
burger.addEventListener('click', () => { const o = nav.classList.toggle('open'); burger.setAttribute('aria-expanded', o); body.style.overflow = o ? 'hidden' : ''; });
links.forEach((a) => a.addEventListener('click', () => { nav.classList.remove('open'); burger.setAttribute('aria-expanded', false); body.style.overflow = ''; }));

/* ---------------- REVEAL + COUNTERS ---------------- */
function countUp(el) {
  if (el.dataset.done) return; el.dataset.done = 1;
  const to = parseFloat(el.dataset.to), suf = el.dataset.suffix || '', t0 = performance.now(), D = reduce ? 1 : 1400;
  (function f(t) { const k = clamp((t - t0) / D), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(to * e) + suf; if (k < 1) requestAnimationFrame(f); })(t0);
}
const io = new IntersectionObserver((entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .2, rootMargin: '0px 0px -6% 0px' });
$$('.reveal').forEach((el, i) => { el.style.transitionDelay = (i % 4) * 70 + 'ms'; io.observe(el); });

/* ---------------- SHOWREEL MODAL + KEYS ---------------- */
const modal = $('#modal'), mv = $('#modalVideo');
function openModal() { modal.hidden = false; body.style.overflow = 'hidden'; mv.currentTime = 0; mv.muted = false; mv.play().catch(() => {}); $('#modalClose').focus(); }
function closeModal() { mv.pause(); modal.hidden = true; body.style.overflow = ''; $('#playReel').focus(); }
$('#playReel').addEventListener('click', openModal); $('#modalClose').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
addEventListener('keydown', (e) => {
  if (!modal.hidden) { if (e.key === 'Escape') closeModal(); return; }
  if (curSec === 'work') { if (e.key === 'ArrowRight') goWork(work.active + 1); if (e.key === 'ArrowLeft') goWork(work.active - 1); }
  if (curSec !== 'contact') return;
  const dir = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
  if (pm.view === 'main') {
    if (dir) { e.preventDefault(); pmSelect(pm.sel + dir); pm.items[pm.sel].focus({ preventScroll: true }); }
    else if (e.key === 'Enter' && !document.activeElement.closest('.pm__item, a, button')) pmOpen(pm.sel);
  } else {
    if (dir) { e.preventDefault(); rowSelect(pm.rsel + dir); pm.rows[pm.rsel].focus({ preventScroll: true }); }
    else if (e.key === 'Escape' || e.key === 'Backspace') { e.preventDefault(); pmBack(); }
  }
});

/* ---------------- MAIN LOOP ---------------- */
let prevT = performance.now();
function tick(t) { const dt = Math.min(.05, (t - prevT) / 1000) || .016; prevT = t; step(dt); requestAnimationFrame(tick); }
function step(dt) {
  const y = scrollY; scrollV = (y - lastY) / dt; lastY = y;
  chrome(y); storyFrame(y); workFrame(y, dt); ropeFrame(dt, y);
  env.px += (ptr.x - env.px) * (1 - Math.exp(-dt * 5)); env.py += (ptr.y - env.py) * (1 - Math.exp(-dt * 5));
  if (!ptr.dragging) {
    ptr.idle += dt; env.dragYaw += ptr.vyaw * dt; ptr.vyaw *= Math.exp(-dt * 3);
    if (ptr.idle > 1.6 || y > vh * .3) { const turns = Math.round(env.dragYaw / (Math.PI * 2)) * Math.PI * 2; env.dragYaw += (turns - env.dragYaw) * (1 - Math.exp(-dt * 2.2)); if (Math.abs(env.dragYaw - turns) < .001) env.dragYaw = 0; }
  }
  env.dt = dt;
  if (scene) scene.frame(shotAt(y), env);
}
// dev helper: advance the whole page by n frames (handy when the tab is throttled)
window.__aphg = { pump(n = 90, dt = 1 / 60) { for (let i = 0; i < n; i++) step(dt); }, play: (n) => scene && scene.play(n), get scene() { return scene; } };

addEventListener('resize', measure); addEventListener('load', measure);
measure();
$('#yr').textContent = new Date().getFullYear();
requestAnimationFrame(tick);
