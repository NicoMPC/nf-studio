// Menu mobile : seul JS du site.
(function () {
  var btn = document.querySelector('.menu-toggle');
  var nav = document.getElementById('menu-principal');
  if (!btn || !nav) return;
  document.documentElement.classList.add('js');

  function isOpen() { return btn.getAttribute('aria-expanded') === 'true'; }
  function setOpen(open) {
    btn.setAttribute('aria-expanded', String(open));
    btn.querySelector('.menu-toggle-label').textContent = open ? 'Fermer' : 'Menu';
    document.body.classList.toggle('menu-open', open);
  }
  function inside(el) { return el && (nav.contains(el) || btn.contains(el)); }

  btn.addEventListener('click', function () { setOpen(!isOpen()); });
  // clic sur un lien du menu
  nav.addEventListener('click', function (e) {
    if (e.target.closest('a')) setOpen(false);
  });
  // clic à l'extérieur
  document.addEventListener('click', function (e) {
    if (isOpen() && !inside(e.target)) setOpen(false);
  });
  // focus qui sort du menu (Tab au-delà du dernier lien)
  [nav, btn].forEach(function (el) {
    el.addEventListener('focusout', function (e) {
      if (isOpen() && e.relatedTarget && !inside(e.relatedTarget)) setOpen(false);
    });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen()) {
      setOpen(false);
      btn.focus();
    }
  });
})();
