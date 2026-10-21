/* =========================================================
   DUB EDITION VLC — interacción y efectos de scroll
   Todo el trabajo por frame va en un único requestAnimationFrame,
   listeners pasivos y solo transform/opacity (compositor) para que
   el scroll en móvil no se bloquee.
   ========================================================= */
(() => {
  const doc = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const desktop = window.matchMedia('(min-width: 901px)');
  const header = document.querySelector('.site-header');

  /* ---------- Menú móvil ---------- */
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');
  const setMenu = (open) => {
    if (!toggle || !nav) return;
    nav.classList.toggle('open', open);
    header?.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    toggle.textContent = open ? '✕' : '☰';
  };
  if (toggle && nav) {
    toggle.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
    nav.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
    document.addEventListener('click', (e) => {
      if (nav.classList.contains('open') && header && !header.contains(e.target)) setMenu(false);
    });
  }

  /* ---------- Pestañas (Únete) ---------- */
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');
  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      tabButtons.forEach((btn) => btn.classList.remove('active'));
      tabPanels.forEach((panel) => panel.classList.remove('active'));
      button.classList.add('active');
      document.getElementById(button.dataset.tab)?.classList.add('active');
    });
  });

  /* ---------- Formularios ---------- */
  const photos = document.getElementById('carPhotos');
  if (photos) {
    photos.addEventListener('change', () => {
      if (photos.files.length > 2) {
        alert('Solo puedes subir 2 fotos como máximo.');
        photos.value = '';
      }
    });
  }
  document.querySelectorAll('form').forEach((form) => {
    form.addEventListener('submit', (event) => {
      if (!form.getAttribute('action')) {
        event.preventDefault();
        alert('Formulario preparado. Para recibir solicitudes, conecta este formulario con Formspree, Netlify Forms o Google Forms. Revisa el README.');
      }
    });
  });

  /* ---------- Animaciones de entrada ----------
     Antes se ocultaba la sección entera (opacity:0) hasta que el 12% estaba en pantalla:
     en móvil las secciones son muy altas y se veía la pantalla en negro mientras bajabas.
     Ahora el contenedor siempre se ve y se animan sus elementos uno a uno, justo al entrar. */
  const GROUPS = '.stats,.feature-grid,.event-highlights,.timeline,.photo-gallery,.partner-grid,.gallery,.mock-feed,.kdd-list,.keyword-pills,.kdd-photo-stack,.split,.instagram-panel,.kdd-highlight,.kdd-rules,.hero-actions,.footer-links,.tab-buttons';
  const IMG_ITEMS = 'figure,.gallery-card,.photo-card,.community-visual-card,.mock-feed>*';
  const items = [];
  const collect = (el) => {
    for (const child of el.children) {
      if (child.matches('script,style,input[type="hidden"]')) continue;
      if (child.matches(GROUPS) && child.children.length) collect(child);
      else items.push(child);
    }
  };
  document.querySelectorAll('.reveal').forEach(collect);

  if (!reduceMotion && 'IntersectionObserver' in window && items.length) {
    // Sin getBoundingClientRect al arrancar (forzaba un reflow): la primera notificación del
    // observer dice qué está ya en pantalla. Eso se queda tal cual (sin parpadeo) y solo
    // se ocultan, para animarlos luego, los elementos que están por debajo.
    const seen = new WeakSet();
    const io = new IntersectionObserver((entries) => {
      const show = [];
      entries.forEach((e) => {
        const el = e.target;
        const passed = e.boundingClientRect.bottom < 0;
        if (!seen.has(el)) {
          seen.add(el);
          if (e.isIntersecting || passed) { io.unobserve(el); return; }
          el.classList.add('rv');
          if (el.matches(IMG_ITEMS)) el.classList.add('rv-img');
          return;
        }
        if (e.isIntersecting || passed) show.push(e);
      });
      show.sort((a, b) => (a.boundingClientRect.top - b.boundingClientRect.top) || (a.boundingClientRect.left - b.boundingClientRect.left));
      let n = 0;
      show.forEach((e) => {
        const el = e.target;
        if (e.isIntersecting) el.style.setProperty('--rv-delay', `${Math.min(n++, 6) * 70}ms`);
        else el.classList.add('rv-instant'); // ya pasado (p. ej. salto con el ancla): sin animación
        el.classList.add('in');
        io.unobserve(el);
      });
    }, { threshold: 0 });
    items.forEach((el) => io.observe(el));
  }

  /* ---------- Efectos ligados al scroll ---------- */
  const progress = document.createElement('div');
  progress.className = 'scroll-progress';
  progress.setAttribute('aria-hidden', 'true');
  document.body.prepend(progress);

  const hero = document.querySelector('.hero, .page-hero');
  const heroMedia = hero?.querySelector('.hero-media');
  const heroContent = hero?.querySelector('.hero-content');

  // Fotos dentro de tarjetas que se desplazan un poco más lento que la página
  const parallaxCards = new Set();
  const cardsInView = new Set();
  if (!reduceMotion) {
    document.querySelectorAll('.gallery-card, .community-visual-card').forEach((card) => {
      if (card.querySelector('.card-media')) { card.classList.add('has-parallax'); parallaxCards.add(card); }
    });
  }
  // Tarjetas flotantes de la home (solo escritorio)
  const floating = reduceMotion ? [] : [...document.querySelectorAll('[data-parallax]')];

  // Marquee: se acelera con la velocidad de scroll y se pausa fuera de pantalla
  const marquee = document.querySelector('.marquee');
  const marqueeAnim = marquee?.querySelector('.marquee-track')?.getAnimations?.()[0];

  if ('IntersectionObserver' in window) {
    const viewIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.target === marquee) marquee.classList.toggle('is-paused', !e.isIntersecting);
        else if (e.isIntersecting) cardsInView.add(e.target);
        else cardsInView.delete(e.target);
      });
    }, { rootMargin: '10% 0px' });
    parallaxCards.forEach((c) => viewIO.observe(c));
    floating.forEach((c) => viewIO.observe(c));
    if (marquee) viewIO.observe(marquee);
  }

  let lastY = window.scrollY;
  let ticking = false;
  let boosting = false;

  const decayMarquee = () => {
    if (!marqueeAnim) { boosting = false; return; }
    const rate = 1 + (marqueeAnim.playbackRate - 1) * 0.92;
    if (rate > 1.02) { marqueeAnim.playbackRate = rate; requestAnimationFrame(decayMarquee); }
    else { marqueeAnim.playbackRate = 1; boosting = false; }
  };

  const update = () => {
    ticking = false;
    // 1) Lecturas
    const y = window.scrollY;
    const vh = window.innerHeight;
    const max = Math.max(1, doc.scrollHeight - vh);
    const delta = y - lastY;
    const heroH = hero ? hero.offsetHeight : 0;
    const cardRects = [];
    cardsInView.forEach((el) => cardRects.push([el, el.getBoundingClientRect()]));

    // 2) Escrituras
    progress.style.transform = `scaleX(${Math.min(1, Math.max(0, y / max)).toFixed(4)})`;

    if (header) {
      header.classList.toggle('is-scrolled', y > 40);
      if (y < 140 || delta < -4) header.classList.remove('is-hidden');
      else if (delta > 6 && !header.classList.contains('menu-open')) header.classList.add('is-hidden');
    }

    if (!reduceMotion && heroMedia && y <= heroH + 80) {
      const p = Math.min(1, Math.max(0, y / Math.max(1, heroH)));
      heroMedia.style.transform = `translate3d(0,${(y * 0.35).toFixed(1)}px,0) scale(${(1 + p * 0.08).toFixed(3)})`;
      if (heroContent) {
        heroContent.style.transform = `translate3d(0,${(y * -0.12).toFixed(1)}px,0)`;
        heroContent.style.opacity = Math.max(0, 1 - p * 1.35).toFixed(3);
      }
    }

    const isDesktop = desktop.matches;
    cardRects.forEach(([el, r]) => {
      const offset = (r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2); // -1 … 1
      if (el.hasAttribute('data-parallax')) {
        el.style.translate = isDesktop ? `0 ${(offset * parseFloat(el.dataset.parallax) * -100).toFixed(1)}px` : '';
      } else {
        const media = el.querySelector('.card-media');
        if (media) media.style.transform = `translate3d(0,${(offset * r.height * -0.07).toFixed(1)}px,0)`;
      }
    });

    if (marqueeAnim && !reduceMotion && Math.abs(delta) > 1) {
      marqueeAnim.playbackRate = Math.max(marqueeAnim.playbackRate, 1 + Math.min(4, Math.abs(delta) * 0.12));
      if (!boosting) { boosting = true; requestAnimationFrame(decayMarquee); }
    }

    lastY = y;
  };

  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
})();

/* ---------- Protección básica ---------- */
// Bloquear clic derecho
document.addEventListener('contextmenu', (event) => { event.preventDefault(); });

// Evitar arrastrar imágenes o elementos visuales
document.addEventListener('dragstart', (event) => { event.preventDefault(); });

// Bloquear algunos atajos típicos de copiar/guardar/inspeccionar
document.addEventListener('keydown', (event) => {
  const key = (event.key || '').toLowerCase();
  if (
    (event.ctrlKey && key === 'c') ||
    (event.ctrlKey && key === 's') ||
    (event.ctrlKey && key === 'u') ||
    (event.ctrlKey && event.shiftKey && key === 'i') ||
    (event.ctrlKey && event.shiftKey && key === 'j') ||
    key === 'f12'
  ) {
    event.preventDefault();
  }
});
