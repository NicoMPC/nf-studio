// Animations signature (accueil). Amélioration progressive : rien n'est masqué sans ce script.
(() => {
  const d = document, W = window;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const $ = (s, r = d) => r.querySelector(s), $$ = (s, r = d) => [...r.querySelectorAll(s)];
  const R = requestAnimationFrame, gb = e => e.getBoundingClientRect();
  const on = (e, v, f, o) => e.addEventListener(v, f, o);
  const ce = (t, c) => { const e = d.createElement(t); if (c) e.className = c; return e; };
  const C = (e, c, v) => e.classList.toggle(c, v);
  C(d.documentElement, 'anim', !0);
  const an = (el, k, du, dl, ea = 'ease-out') => el.animate(k, { duration: du, delay: dl, easing: ea, fill: 'backwards' });
  const ty = y => `translateY(${y}px)`;
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

  /* ---- Outils communs aux schémas animés ---- */
  const mk = (tag, at, par) => {
    const e = d.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const k in at) e.setAttribute(k, at[k]);
    return par.appendChild(e);
  };
  const S = (e, o, tr, off) => {
    const s = e.style;
    s.opacity = o;
    if (tr) s.transform = tr;
    if (off >= 0) s.strokeDashoffset = off;
  };
  // boucle rAF, en pause hors écran et onglet caché
  const lp = (el, L, f) => {
    let T = 0, last = 0, raf = 0, vis = !0;
    const loop = now => {
      if (last) T = (T + Math.min(now - last, 100)) % L;
      last = now; f(T); raf = R(loop);
    };
    const run = () => {
      const go = vis && !d.hidden;
      if (go && !raf) { last = 0; raf = R(loop); }
      else if (!go && raf) { cancelAnimationFrame(raf); raf = 0; }
    };
    new IntersectionObserver(e => { vis = e[0].isIntersecting; run(); }).observe(el);
    on(d, 'visibilitychange', run);
    f(0);
  };
  const pk = (x, y, par, c = '') => mk('rect', { class: 'fl-pkt ' + c, x, y, width: 6, height: 6 }, par);

  /* ---- Hero : système vivant (boucle de 11 s) ---- */
  const svg = $('.flow-hero');
  if (svg) {
    const tp = $('.fl-typed', svg), N = tp.textContent.length;
    const clip = mk('clipPath', { id: 'fl-clip' }, svg);
    mk('rect', { x: 9, y: 141, width: 266, height: 62 }, clip);
    const cov = mk('g', { 'clip-path': 'url(#fl-clip)' }, $('.n2', svg));
    const cv = mk('g', { class: 'fl-cover' }, cov);
    mk('rect', { x: 22, y: 172, width: 250, height: 24 }, cv);
    mk('rect', { class: 'fl-caret', x: 22, y: 176, width: 1.5, height: 16 }, cv);
    const P = pk(139, 0, svg);
    const PA = pk(139, 0, svg, 'fl-pkt-a');
    const pu = mk('rect', { class: 'fl-pulse', x: 8, y: 252, width: 268, height: 64 }, svg);
    const chk = $('.fl-check', svg), bar = $('.fl-bar', svg);
    const nw = $$('.fl-net-wire', svg), st = $$('.fl-site', svg), mi = $$('.fl-mini', svg);
    const leg = $('.fl-net-legend', svg);
    let cw = 7.8;
    const f = t => {
      const F = 1 - E(10200, 10900, t);
      let y = -50, a = 0;
      if (t > 200 && t < 1100) y = 86 + 44 * E(200, 1100, t);
      else if (t > 2300 && t < 3100) y = 198 + 44 * E(2300, 3100, t);
      else if (t > 3900 && t < 4700) { y = 310 + 44 * E(3900, 4700, t); a = 1; }
      S(P, +(y > 0 && !a), ty(y));
      S(PA, a, ty(y));
      if (t < 50) cw = parseFloat(getComputedStyle(tp).fontSize) * .6;
      const n = cl((t - 1100) / 1100) * N | 0;
      S(cv, +(t < 2350), `translateX(${n*cw}px)`);
      S(tp, t > 10200 ? F : 1);
      S(chk, F, '', 1 - E(3100, 3600, t));
      const p = cl((t - 3300) / 1000);
      S(pu, .6 * (1 - p) * (p > 0), `scale(${1+0.05*p})`);
      S(bar, F, '', 1 - E(4700, 5500, t));
      S(nw[0], F, '', 1 - E(5600, 6200, t));
      st.forEach((g, i) => {
        const q = E(6000 + 150 * i, 6800 + 150 * i, t), r = 1 - q, box = g.firstChild;
        S(box, cl(q * 4) * F,
          `translate(${r*(-118*i)}px,${r*-102}px) scale(${1+1.68*r},${1+1.133*r})`);
        S(g.lastChild, E(6800 + 150 * i, 7200 + 150 * i, t) * F);
      });
      S(nw[1], F, '', 1 - E(7100, 7600, t));
      mi.forEach((m, j) => {
        const q = E(7200 + 60 * j, 7600 + 60 * j, t);
        S(m, F * (q > 0), `scale(${q})`);
      });
      S(leg, E(7600, 8000, t) * F);
    };
    lp(svg, 11000, f);
  }

  /* ---- Confidentialité : les paquets restent dans vos locaux (boucle de 5 s) ---- */
  const cf = $('.flow-conf');
  if (cf) {
    const A = pk(126, 0, cf), B = pk(0, 139, cf), X = $('.cf-x', cf);
    lp(cf, 5000, t => {
      let y = -50;
      if (t < 800) y = 84 + 22 * E(0, 800, t);
      else if (t > 1900 && t < 2700) y = 172 + 22 * E(1900, 2700, t);
      S(A, +(y > 0), ty(y));
      S(B, (t > 900 && t < 1900) * (1 - E(1500, 1900, t)), `translateX(${236+8*E(900,1450,t)}px)`);
      S(X, 1, `scale(${1+.35*Math.sin(Math.PI*cl((t-1400)/500))})`);
    });
  }

  /* ---- Trame du hero réactive au curseur (desktop) ---- */
  const fg = $('.hero-figure'), dt = $('.hero-dots');
  if (fg && dt && matchMedia('(pointer: fine)').matches) {
    let q = 0, x = 0, y = 0;
    on(fg, 'pointermove', e => {
      const r = gb(fg);
      x = e.clientX - r.left; y = e.clientY - r.top;
      if (!q) q = R(() => {
        dt.style.setProperty('--mx', x + 'px'); dt.style.setProperty('--my', y + 'px'); q = 0;
      });
    });
    ['pointerenter', 'pointerleave'].forEach((v, i) => on(fg, v, () => C(fg, 'near', !i)));
  }

  /* ---- Titres de section : révélation ligne par ligne ---- */
  const H = $$('.section h2');
  H.forEach(h => C(h, 'rv-wait', !0));
  io(H, h => {
    const html = h.innerHTML, w = h.textContent.split(' ');
    h.textContent = '';
    const sp = w.map((x, i) => {
      const s = ce('span');
      s.textContent = x + (i < w.length - 1 ? ' ' : '');
      return h.appendChild(s);
    });
    const ls = [];
    let top = null;
    sp.forEach(s => { if (s.offsetTop !== top) { ls.push([]); top = s.offsetTop; } ls.at(-1).push(s); });
    h.textContent = '';
    C(h, 'rv-wait', !1);
    Promise.all(ls.map((ln, i) => {
      const o = ce('span', 'rv-line'), inn = ce('span');
      o.appendChild(inn); ln.forEach(s => inn.appendChild(s)); h.appendChild(o);
      return an(inn, [{ transform: 'translateY(105%)' }, { transform: 'none' }], 750, i * 110).finished;
    })).then(() => { h.innerHTML = html; });
  });

  /* ---- Exemples : Avant barré, flèche, puis Avec l'outil ---- */
  const X = $$('.ex'), dn = [];
  const sk = (b, dl) => {
    $$('.ex-strike', b).forEach(s => s.remove());
    const r = d.createRange(); r.selectNodeContents(b);
    const B = gb(b), rw = {};
    [...r.getClientRects()].forEach(c => {
      if (c.width < 4) return;
      const k = Math.round(c.top);
      const o = rw[k] = rw[k] || { l: 1e9, r: 0, t: c.top, h: c.height };
      o.l = Math.min(o.l, c.left); o.r = Math.max(o.r, c.right);
    });
    Object.values(rw).forEach((o, i) => {
      const s = ce('span', 'ex-strike'), st = s.style;
      st.left = o.l - B.left + 'px'; st.top = o.t - B.top + o.h * .55 + 'px'; st.width = o.r - o.l + 'px';
      b.appendChild(s);
      if (dl >= 0) an(s, SX, 380, dl + i * 140, 'ease-in-out');
    });
  };
  X.forEach(x => C(x, 'ex-wait', !0));
  io(X, x => {
    const dl = X.indexOf(x) % 4 * 140;
    const b = $('.ex-before', x);
    sk(b, dl); dn.push(b);
    C(x, 'ex-wait', !1);
    an($('.ex-arrow', x), SX, 380, dl + 520);
    an($('.ex-after', x), [{ opacity: 0, transform: 'translateX(-8px)' }, { opacity: 1, transform: 'none' }], 480, dl + 820);
  });
  let rz = 0;
  on(W, 'resize', () => { clearTimeout(rz); rz = setTimeout(() => dn.forEach(b => sk(b, -1)), 150); });

  /* ---- Méthode : progression au fil du défilement ---- */
  const stp = $('.steps');
  if (stp) {
    const St = $$('.step', stp);
    C(stp, 'st-wait', !0);
    const ln = St.map(s => {
      return s.appendChild(ce('span', 'step-line'));
    });
    let q = 0;
    const upd = () => {
      q = 0;
      const h = innerHeight, row = St.at(-1).offsetTop === St[0].offsetTop;
      const p = cl((h * .9 - gb(stp).top) / (h * .45));
      St.forEach((s, i) => {
        const v = row ? cl(p * St.length - i) : cl((h * .9 - gb(s).top) / (h * .25));
        ln[i].style.transform = `scaleX(${v})`;
        C(s, 'on', v >= 1);
      });
    };
    on(W, 'scroll', () => { if (!q) q = R(upd); }, { passive: !0 });
    on(W, 'resize', upd);
    upd();
  }
})();
