/* Cuenta atrás de cierre de inscripciones (Expo Dub Edition × Aspar Circuit).
   Uso: <div data-countdown data-deadline="ISO"> con <b data-u="h|m|s">, .cd-closed
   Al llegar a cero: añade .is-closed, oculta [data-open-only], muestra [data-closed-only]
   y lanza el evento "dub:inscripciones-cerradas". */
(() => {
  const boxes = [...document.querySelectorAll('[data-countdown]')];
  if (!boxes.length) return;
  const deadline = new Date(boxes[0].dataset.deadline).getTime();
  const pad = (n) => String(n).padStart(2, '0');
  let closed = false;
  function close() {
    if (closed) return; closed = true;
    document.documentElement.classList.add('inscripciones-cerradas');
    boxes.forEach((b) => b.classList.add('is-closed'));
    document.querySelectorAll('[data-open-only]').forEach((el) => (el.hidden = true));
    document.querySelectorAll('[data-closed-only]').forEach((el) => (el.hidden = false));
    window.dispatchEvent(new Event('dub:inscripciones-cerradas'));
  }
  function tick() {
    const left = deadline - Date.now();
    if (left <= 0) { close(); return; }
    const s = Math.floor(left / 1000);
    const v = { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
    boxes.forEach((b) => {
      b.querySelectorAll('[data-u]').forEach((el) => (el.textContent = pad(v[el.dataset.u])));
      b.classList.toggle('is-urgent', left < 3600 * 1000);
    });
    setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
  }
  window.DUB_DEADLINE = deadline;
  tick();
})();
