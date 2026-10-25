// Animations signature (accueil). Amélioration progressive : rien n'est masqué sans ce script.
(() => {
  const d = document, W = window;
  if (!W.IntersectionObserver || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const $ = (s, r = d) => r.querySelector(s), $$ = (s, r = d) => [...r.querySelectorAll(s)];
  const R = requestAnimationFrame, gb = e => e.getBoundingClientRect();
  const on = (e, v, f, o) => e.addEventListener(v, f, o);
  const ce = (t, c) => { const e = d.createElement(t); if (c) e.className = c; return e; };
  const C = (e, c, v) => e.classList.toggle(c, v);
  C(d.documentElement, 'anim', true);
  const SX = [{ transform: 'scaleX(0)' }, { transform: 'none' }];
  const cl = x => (x < 0 ? 0 : x > 1 ? 1 : x);
  const ez = x => (x < .5 ? 2 * x * x : 1 - (2 - 2 * x) ** 2 / 2);
  const E = (a, b, t) => ez(cl((t - a) / (b - a)));
  const io = (els, cb) => {
    const o = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { o.unobserve(e.target); cb(e.target); }
    }), { rootMargin: '0px 0px -10%' });
    els.forEach(e => o.observe(e));
  };

  /* ---- Hero : système vivant (boucle de 11 s) ---- */
  const svg = $('.flow-hero');
  if (svg) {
    const NS = 'http://www.w3.org/2000/svg';
    const mk = (tag, at, par = svg) => {
      const e = d.createElementNS(NS, tag);
      for (const k in at) e.setAttribute(k, at[k]);
      return par.appendChild(e);
    };
    const S = (e, o, tr, off) => {
      const s = e.style;
      s.opacity = o;
      if (tr) s.transform = tr;
      if (off >= 0) s.strokeDashoffset = off;
    };
    const typed = $('.fl-typed', svg), N = typed.textContent.length;
    const clip = mk('clipPath', { id: 'fl-clip' });
    mk('rect', { x: 9, y: 141, width: 266, height: 62 }, clip);
    const cov = mk('g', { 'clip-path': 'url(#fl-clip)' }, $('.n2', svg));
    const covIn = mk('g', { class: 'fl-cover' }, cov);
    mk('rect', { x: 22, y: 172, width: 250, height: 24 }, covIn);
    mk('rect', { class: 'fl-caret', x: 22, y: 176, width: 1.5, height: 16 }, covIn);
    const P = mk('rect', { class: 'fl-pkt', x: 139, y: 0, width: 6, height: 6 });
    const PA = mk('rect', { class: 'fl-pkt fl-pkt-a', x: 139, y: 0, width: 6, height: 6 });
    const pulse = mk('rect', { class: 'fl-pulse', x: 8, y: 252, width: 268, height: 64 });
    const chk = $('.fl-check', svg), bar = $('.fl-bar', svg);
    const nw = $$('.fl-net-wire', svg), sites = $$('.fl-site', svg), minis = $$('.fl-mini', svg);
    const leg = $('.fl-net-legend', svg);
    let cw = 7.8;
    const f = t => {
      const F = 1 - E(10200, 10900, t);
      let y = -50, a = 0;
      if (t > 200 && t < 1100) y = 86 + 44 * E(200, 1100, t);
      else if (t > 2300 && t < 3100) y = 198 + 44 * E(2300, 3100, t);
      else if (t > 3900 && t < 4700) { y = 310 + 44 * E(3900, 4700, t); a = 1; }
      S(P, y > 0 && !a ? 1 : 0, `translateY(${y}px)`);
      S(PA, a, `translateY(${y}px)`);
      if (t < 50) cw = parseFloat(getComputedStyle(typed).fontSize) * .6;
      const n = Math.floor(cl((t - 1100) / 1100) * N);
      S(covIn, t < 2350 ? 1 : 0, `translateX(${n*cw}px)`);
      S(typed, t > 10200 ? F : 1);
      S(chk, F, '', 1 - E(3100, 3600, t));
      const p = cl((t - 3300) / 1000);
      S(pulse, p > 0 && p < 1 ? .6 * (1 - p) : 0, `scale(${1+0.05*p})`);
      S(bar, F, '', 1 - E(4700, 5500, t));
      S(nw[0], F, '', 1 - E(5600, 6200, t));
      sites.forEach((g, i) => {
        const q = E(6000 + 150 * i, 6800 + 150 * i, t), r = 1 - q, box = g.firstChild;
        S(box, Math.min(1, q * 4) * F,
          `translate(${r*(-118*i)}px,${r*-102}px) scale(${1+1.68*r},${1+1.133*r})`);
        S(g.lastChild, E(6800 + 150 * i, 7200 + 150 * i, t) * F);
      });
      S(nw[1], F, '', 1 - E(7100, 7600, t));
      minis.forEach((m, j) => {
        const q = E(7200 + 60 * j, 7600 + 60 * j, t);
        S(m, q > 0 ? F : 0, `scale(${q})`);
      });
      S(leg, E(7600, 8000, t) * F);
    };
    const L = 11000;
    let T = 0, last = 0, raf = 0, vis = true;
    const loop = now => {
      if (last) T = (T + Math.min(now - last, 100)) % L;
      last = now; f(T); raf = R(loop);
    };
    const run = () => {
      const go = vis && !d.hidden;
      if (go && !raf) { last = 0; raf = R(loop); }
      else if (!go && raf) { cancelAnimationFrame(raf); raf = 0; }
    };
    new IntersectionObserver(e => { vis = e[0].isIntersecting; run(); }).observe(svg);
    on(d, 'visibilitychange', run);
    f(0);
  }

  /* ---- Trame du hero réactive au curseur (desktop) ---- */
  const fig = $('.hero-figure'), dots = $('.hero-dots');
  if (fig && dots && matchMedia('(pointer: fine)').matches) {
    let q = 0, x = 0, y = 0;
    on(fig, 'pointermove', e => {
      const r = gb(fig);
      x = e.clientX - r.left; y = e.clientY - r.top;
      if (!q) q = R(() => {
        dots.style.setProperty('--mx', x + 'px'); dots.style.setProperty('--my', y + 'px'); q = 0;
      });
    });
    on(fig, 'pointerenter', () => C(fig, 'near', true));
    on(fig, 'pointerleave', () => C(fig, 'near', false));
  }

  /* ---- Titres de section : révélation ligne par ligne ---- */
  const H = $$('.section h2');
  H.forEach(h => C(h, 'rv-wait', true));
  io(H, h => {
    const html = h.innerHTML, w = h.textContent.split(' ');
    h.textContent = '';
    const sp = w.map((x, i) => {
      const s = ce('span');
      s.textContent = x + (i < w.length - 1 ? ' ' : '');
      return h.appendChild(s);
    });
    const lines = [];
    let top = null;
    sp.forEach(s => { if (s.offsetTop !== top) { lines.push([]); top = s.offsetTop; } lines.at(-1).push(s); });
    h.textContent = '';
    C(h, 'rv-wait', false);
    Promise.all(lines.map((ln, i) => {
      const o = ce('span', 'rv-line'), inn = ce('span');
      o.appendChild(inn); ln.forEach(s => inn.appendChild(s)); h.appendChild(o);
      return inn.animate([{ transform: 'translateY(105%)' }, { transform: 'none' }],
        { duration: 750, delay: i * 110, easing: 'ease-out', fill: 'backwards' }).finished;
    })).then(() => { h.innerHTML = html; });
  });

  /* ---- Exemples : Avant barré, flèche, puis Avec l'outil ---- */
  const X = $$('.ex'), done = [];
  const strike = (b, dl) => {
    $$('.ex-strike', b).forEach(s => s.remove());
    const r = d.createRange(); r.selectNodeContents(b);
    const B = gb(b), rows = {};
    [...r.getClientRects()].forEach(c => {
      if (c.width < 4) return;
      const k = Math.round(c.top);
      const o = rows[k] = rows[k] || { l: 1e9, r: 0, t: c.top, h: c.height };
      o.l = Math.min(o.l, c.left); o.r = Math.max(o.r, c.right);
    });
    Object.values(rows).forEach((o, i) => {
      const s = ce('span', 'ex-strike'), st = s.style;
      st.left = o.l - B.left + 'px'; st.top = o.t - B.top + o.h * .55 + 'px'; st.width = o.r - o.l + 'px';
      b.appendChild(s);
      if (dl >= 0) s.animate(SX, { duration: 380, delay: dl + i * 140, easing: 'ease-in-out', fill: 'backwards' });
    });
  };
  let k = 0, z = 0;
  X.forEach(x => C(x, 'ex-wait', true));
  io(X, x => {
    const dl = k++ * 160; clearTimeout(z); z = setTimeout(() => { k = 0; }, 300);
    const b = $('.ex-before', x);
    strike(b, dl); done.push(b);
    C(x, 'ex-wait', false);
    $('.ex-arrow', x).animate(SX, { duration: 380, delay: dl + 520, easing: 'ease-out', fill: 'backwards' });
    $('.ex-after', x).animate([{ opacity: 0, transform: 'translateX(-8px)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: dl + 820, easing: 'ease-out', fill: 'backwards' });
  });
  let rz = 0;
  on(W, 'resize', () => { clearTimeout(rz); rz = setTimeout(() => done.forEach(b => strike(b, -1)), 150); });

  /* ---- Méthode : progression au fil du défilement ---- */
  const stp = $('.steps');
  if (stp) {
    const St = $$('.step', stp);
    C(stp, 'st-wait', true);
    const ln = St.map(s => {
      return s.appendChild(ce('span', 'step-line'));
    });
    let q = 0;
    const upd = () => {
      q = 0;
      const h = innerHeight, row = St[St.length - 1].offsetTop === St[0].offsetTop;
      const p = cl((h * .9 - gb(stp).top) / (h * .45));
      St.forEach((s, i) => {
        const v = row ? cl(p * St.length - i) : cl((h * .9 - gb(s).top) / (h * .25));
        ln[i].style.transform = `scaleX(${v})`;
        C(s, 'on', v >= 1);
      });
    };
    on(W, 'scroll', () => { if (!q) q = R(upd); }, { passive: true });
    on(W, 'resize', upd);
    upd();
  }
})();
