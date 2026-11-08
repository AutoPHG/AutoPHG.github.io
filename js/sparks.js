/* Floating four-point sparkles, drawn to match the channel's star assets. */
(function () {
  const cv = document.getElementById('sparks');
  if (!cv) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = cv.getContext('2d');
  const COLORS = ['#ffffff', '#ff1238', '#ffa000', '#9a4dff', '#ff2d7a'];
  let w, h, dpr, parts = [];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = cv.clientWidth; h = cv.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(46, (w * h) / 32000));
    parts = Array.from({ length: n }, make);
  }
  function make() {
    return {
      x: Math.random() * w, y: Math.random() * h,
      r: 2 + Math.random() * 6,
      vy: -(0.1 + Math.random() * 0.35), vx: (Math.random() - .5) * .15,
      rot: Math.random() * Math.PI, vr: (Math.random() - .5) * .02,
      c: COLORS[(Math.random() * COLORS.length) | 0],
      t: Math.random() * Math.PI * 2
    };
  }
  function star(p) {
    const a = 0.35 + 0.35 * Math.sin(p.t);
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.globalAlpha = a; ctx.fillStyle = p.c;
    const r = p.r, k = r * 0.18;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(k, -k, r, 0);
    ctx.quadraticCurveTo(k, k, 0, r);
    ctx.quadraticCurveTo(-k, k, -r, 0);
    ctx.quadraticCurveTo(-k, -k, 0, -r);
    ctx.fill();
    ctx.restore();
  }
  let scrollV = 0, lastY = window.scrollY;
  window.addEventListener('scroll', () => {
    scrollV += (window.scrollY - lastY) * 0.02; lastY = window.scrollY;
  }, { passive: true });

  function tick() {
    ctx.clearRect(0, 0, w, h);
    scrollV *= 0.9;
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy - scrollV; p.rot += p.vr; p.t += 0.03;
      if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
      if (p.y > h + 10) { p.y = -10; p.x = Math.random() * w; }
      star(p);
    }
    if (document.hidden) { running = false; return; }
    requestAnimationFrame(tick);
  }
  let running = false;
  function start() { if (running || reduce) return; running = true; requestAnimationFrame(tick); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
  window.addEventListener('resize', resize);
  resize();
  if (reduce) { parts.forEach(star); } else { start(); }
})();
