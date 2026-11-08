/* AutoPHG — interactions */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- DATA ---------------- */
  // Top clips (views as of Nov 2026). Edit freely.
  const WORK = [
    { id: 'hgbZsTru6tk', short: true, cat: 'SHORTS · HORROR', t: 'ประสบการณ์เจอผีของจริงในแมพ Steal an Egg!?', v: '437K' },
    { id: 'nOabhRMfAto', short: true, cat: 'SHORTS · CREATOR', t: 'กายหงิดเล่น Roblox โหดแค่ไหน?', v: '312K' },
    { id: '1ymsQysuw9A', short: true, cat: 'SHORTS · CREATOR', t: 'แป๊ะดูดแหนมเล่น Roblox เก่งแค่ไหน?', v: '201K' },
    { id: 'zFlcVjNkcUI', short: true, cat: 'SHORTS · NEWS', t: 'ทำไมคนถึงมาปกป้อง David Baszucki???', v: '165K' },
    { id: 'CRpxYfuhXLE', short: true, cat: 'SHORTS · HORROR', t: 'เจอผีในโรบอก ตอนตี 2?', v: '151K' },
    { id: 'rvZpulh6YxU', short: true, cat: 'SHORTS · GAMEPLAY', t: '7 ดาวตัวแรกหลังกลับมาเล่น All Star', v: '103K' },
    { id: 'ERSXSwU9dTg', short: true, cat: 'SHORTS · CREATOR', t: 'พรี่เต้มีโรบัคทั้งหมดเท่าไหร่?', v: '83K' },
    { id: 's8m9JvKSYZM', short: false, cat: 'VIDEO · ESSAY', t: 'Transformers ที่มากกว่าแค่คำว่า ONE', v: '14K' }
  ];
  const COLLAGE = ['vOpL_srj8Xo', 'zk1XXYmffXQ', 'ixOLA99CDn4', 'HbjoFS0nc0Q', 's8m9JvKSYZM', '7gI_ZlZEr8A',
    'fcXtuerkf-k', 'nXvSOq0KbLY', 'S1s1hcm1HaA', 'NBMTNZXpDGI', 'bIQ5oIHtdDY', 'LIXKrikC9Jo',
    'qs_xiTK3FDc', 'odH0zwFpnUM', 'QuXft7Cvwls', 'bPt5pwNWwOo', 'Wcg0FZwmRic', 'aMKR3063eYw'];
  const thumb = (id, q = 'hqdefault') => `https://i.ytimg.com/vi/${id}/${q}.jpg`;

  /* ---------------- INTRO ---------------- */
  const intro = $('#intro'), pct = $('#introPct');
  let introTimer = null;
  function runIntro() {
    intro.classList.remove('done');
    document.body.classList.add('is-loading');
    // restart letter animations
    $$('.intro__l, .intro__bolt', intro).forEach(el => { el.style.animation = 'none'; el.offsetHeight; el.style.animation = ''; });
    clearInterval(introTimer); clearTimeout(introFallback);
    if (reduce) { pct.textContent = '100'; endIntro(); return; }
    // Count up while the letters land; close only after the bolt (last animation) has
    // actually finished, so a slow first paint never cuts the intro short.
    const t0 = performance.now(), dur = 1500;
    introTimer = setInterval(() => {
      const n = Math.min(100, (performance.now() - t0) / dur * 100);
      pct.textContent = String(Math.round(n)).padStart(2, '0');
      if (n >= 100) clearInterval(introTimer);
    }, 30);
    introFallback = setTimeout(endIntro, 5000);
  }
  let introFallback = null;
  $('.intro__bolt', intro).addEventListener('animationend', () => {
    if (!intro.classList.contains('done')) setTimeout(endIntro, 600);
  });
  function endIntro() {
    clearInterval(introTimer); clearTimeout(introFallback);
    pct.textContent = '100';
    intro.classList.add('done');
    document.body.classList.remove('is-loading');
  }
  $('#introSkip').addEventListener('click', endIntro);
  $('#replayIntro').addEventListener('click', () => { window.scrollTo({ top: 0 }); runIntro(); });
  runIntro();

  /* ---------------- NAV ---------------- */
  const nav = $('#nav');
  let lastY = 0;
  const links = $$('.nav__links a');
  const sections = links.map(a => $(a.getAttribute('href')));
  function onScroll() {
    const y = window.scrollY;
    nav.classList.toggle('scrolled', y > 40);
    nav.classList.toggle('hide', y > 400 && y > lastY + 4);
    if (y < lastY - 4) nav.classList.remove('hide');
    lastY = y;
    let cur = -1;
    sections.forEach((s, i) => { if (s && s.getBoundingClientRect().top < window.innerHeight * .4) cur = i; });
    links.forEach((a, i) => a.classList.toggle('active', i === cur));
    storyWords();
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------------- STORY WORDS light up with scroll ---------------- */
  const words = $$('.sw');
  function storyWords() {
    const vh = window.innerHeight;
    words.forEach((w, i) => {
      const r = w.getBoundingClientRect();
      w.classList.toggle('lit', r.top < vh * (0.78 - i * 0.04));
    });
  }

  /* ---------------- REVEAL + COUNTERS ---------------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      $$('.count', e.target).forEach(countUp);
      if (e.target.classList.contains('count')) countUp(e.target);
      io.unobserve(e.target);
    });
  }, { threshold: 0.18 });
  $$('.reveal').forEach(el => io.observe(el));

  function countUp(el) {
    if (el.dataset.done) return; el.dataset.done = 1;
    const to = parseFloat(el.dataset.to), dec = +(el.dataset.dec || 0), suf = el.dataset.suffix || '';
    const t0 = performance.now(), D = reduce ? 1 : 1600;
    (function f(t) {
      const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3);
      el.textContent = (to * e).toFixed(dec) + suf;
      if (k < 1) requestAnimationFrame(f);
    })(t0);
  }

  /* ---------------- COLLAGE ---------------- */
  const col = $('#collage');
  const rows = 4, per = Math.ceil(COLLAGE.length / rows) + 1;
  for (let r = 0; r < rows; r++) {
    const row = document.createElement('div'); row.className = 'collage__row';
    const ids = Array.from({ length: per }, (_, i) => COLLAGE[(r * 5 + i * 3) % COLLAGE.length]);
    // duplicate so the marquee loops seamlessly
    [...ids, ...ids].forEach(id => {
      const img = new Image(); img.src = thumb(id, 'mqdefault'); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
      row.appendChild(img);
    });
    col.appendChild(row);
  }

  /* ---------------- WORK LIST ---------------- */
  const list = $('#worklist');
  WORK.forEach((w, i) => {
    const li = document.createElement('li');
    const url = w.short ? `https://www.youtube.com/shorts/${w.id}` : `https://www.youtube.com/watch?v=${w.id}`;
    li.innerHTML = `
      <a class="wl" href="${url}" target="_blank" rel="noopener" data-img="${thumb(w.id)}">
        <span class="wl__n">${String(i + 1).padStart(2, '0')}</span>
        <img class="wl__thumb" src="${thumb(w.id)}" alt="" loading="lazy">
        <span class="wl__t"><span class="wl__cat">${w.cat}</span>${w.t}</span>
        <span class="wl__v">${w.v}<small>VIEWS</small></span>
        <span class="wl__a" aria-hidden="true">↗</span>
      </a>`;
    list.appendChild(li);
  });

  // cursor-follow preview (desktop)
  const peek = $('#peek'), peekImg = $('img', peek);
  let px = 0, py = 0, tx = 0, ty = 0, raf = null;
  function follow() {
    px += (tx - px) * 0.18; py += (ty - py) * 0.18;
    peek.style.left = px + 'px'; peek.style.top = py + 'px';
    raf = peek.classList.contains('show') ? requestAnimationFrame(follow) : null;
  }
  list.addEventListener('mousemove', e => { tx = e.clientX + 140; ty = e.clientY; });
  $$('.wl', list).forEach(a => {
    a.addEventListener('mouseenter', e => {
      peekImg.src = a.dataset.img;
      if (!peek.classList.contains('show')) { px = tx = e.clientX + 140; py = ty = e.clientY; }
      peek.classList.add('show');
      if (!raf) raf = requestAnimationFrame(follow);
    });
  });
  list.addEventListener('mouseleave', () => peek.classList.remove('show'));

  /* ---------------- MODAL ---------------- */
  const modal = $('#modal'), mv = $('#modalVideo'), heroV = $('.hero__video');
  function openModal() {
    modal.hidden = false; document.body.style.overflow = 'hidden';
    heroV && heroV.pause();
    mv.currentTime = 0; mv.muted = false; mv.play().catch(() => {});
    $('#modalClose').focus();
  }
  function closeModal() {
    mv.pause(); modal.hidden = true; document.body.style.overflow = '';
    heroV && !reduce && heroV.play().catch(() => {});
    $('#playReel').focus();
  }
  $('#playReel').addEventListener('click', openModal);
  $('#modalClose').addEventListener('click', closeModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

  if (reduce && heroV) { heroV.removeAttribute('autoplay'); heroV.pause(); }

  $('#yr').textContent = new Date().getFullYear();
  onScroll();
})();
