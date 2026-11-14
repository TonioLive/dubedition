/* Panel de admisión — Expo Dub Edition × Aspar Circuit */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const KEY_STORE = 'dubExpoKey';
  let key = localStorage.getItem(KEY_STORE) || '';
  let items = [];
  let filter = 'all';
  let query = '';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const thumb = (id, w = 800) => `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${w}`;
  const fdate = (iso) => (iso ? new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
  const notice = (msg, type) => { const n = $('#notice'); n.textContent = msg || ''; n.className = 'notice' + (type ? ' ' + type : ''); };

  /* ---------- Login ---------- */
  async function login(k) {
    const r = await window.dubApi('login', { key: k });
    if (r.role !== 'admin') throw new Error('Esta clave solo sirve para el check-in.');
    key = k;
    localStorage.setItem(KEY_STORE, k);
    $('#login').hidden = true;
    $('#app').hidden = false;
    $('#headerActions').hidden = false;
    await load();
  }
  $('#login').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#loginMsg').textContent = 'Comprobando…';
    try { await login($('#key').value.trim()); $('#loginMsg').textContent = ''; }
    catch (err) { $('#loginMsg').textContent = err.message; }
  });
  $('#logout').addEventListener('click', () => { localStorage.removeItem(KEY_STORE); location.reload(); });

  /* ---------- Datos ---------- */
  async function load(keepNotice) {
    if (!keepNotice) notice('Cargando inscripciones…');
    try {
      const r = await window.dubApi('list', { key });
      items = r.items.reverse();
      $('#sheetLink').href = r.sheetUrl;
      $('#folderLink').href = r.folderUrl;
      $('#quota').textContent = `Correos disponibles hoy: ${r.quota}`;
      if (!keepNotice) notice('');
      render();
    } catch (err) { notice(err.message, 'error'); }
  }
  $('#refresh').addEventListener('click', () => load());

  function counts() {
    const c = { total: items.length, pend: 0, acc: 0, rej: 0, tandas: 0, in: 0, thanks: 0, replies: 0 };
    items.forEach((i) => {
      if (i.estado === 'Aceptado') c.acc++; else if (i.estado === 'Rechazado') c.rej++; else c.pend++;
      if (i.tandas === 'Sí' || i.tandas === 'Puede') c.tandas++;
      if (i.checkin) c.in++;
      if (!i.gracias) c.thanks++;
      if (!i.respuesta && (i.estado === 'Aceptado' || i.estado === 'Rechazado')) c.replies++;
    });
    return c;
  }

  function render() {
    const c = counts();
    document.querySelectorAll('[data-s]').forEach((el) => (el.textContent = c[el.dataset.s]));
    $('#sendThanks span').textContent = c.thanks;
    $('#sendThanks').disabled = !c.thanks;
    $('#sendReplies span').textContent = c.replies;
    $('#sendReplies').disabled = !c.replies;

    const q = query.toLowerCase();
    const list = items.filter((i) => (filter === 'all' || i.estado === filter) &&
      (!q || [i.nombre, i.apellido, i.marca, i.modelo, i.matricula, i.instagram, i.email, i.id].join(' ').toLowerCase().includes(q)));

    const box = $('#cards');
    if (!list.length) { box.innerHTML = '<p class="empty">No hay inscripciones con este filtro.</p>'; return; }
    box.innerHTML = list.map(card).join('');
  }

  function card(i) {
    const ig = String(i.instagram || '').replace(/^@/, '');
    const cls = i.estado === 'Aceptado' ? 'is-acc' : i.estado === 'Rechazado' ? 'is-rej' : '';
    const fotos = i.fotos || [];
    return `<article class="card ${cls}" data-id="${esc(i.id)}">
      <div class="card-photos">
        ${fotos[0] ? `<img src="${thumb(fotos[0])}" alt="Foto del coche" loading="lazy" data-full="${esc(fotos[0])}">` : ''}
        <span class="pill ${esc(i.estado)}">${esc(i.estado)}</span><span class="card-id">${esc(i.id)}</span>
        ${fotos.length > 1 ? `<div class="thumbs">${fotos.map((f, n) => `<img src="${thumb(f, 120)}" alt="Foto ${n + 1}" data-photo="${esc(f)}" class="${n ? '' : 'on'}" loading="lazy">`).join('')}</div>` : ''}
      </div>
      <div class="card-body">
        <h3>${esc(i.nombre)} ${esc(i.apellido)}</h3>
        <div class="card-car">${esc(i.marca)} ${esc(i.modelo)} <span class="plate">${esc(i.matricula)}</span></div>
        <div class="meta">
          ${ig ? `<a href="https://instagram.com/${encodeURIComponent(ig)}" target="_blank" rel="noopener">@${esc(ig)}</a> · ` : ''}${esc(i.email)}<br>
          Inscrito: ${fdate(i.fecha)}${i.tandas ? ` · Tandas: <b>${esc(i.tandas)}</b>` : ''}
          ${i.carpeta ? ` · <a href="${esc(i.carpeta)}" target="_blank" rel="noopener">carpeta</a>` : ''}
        </div>
        <div class="desc">${esc(i.descripcion)}</div>
        <div class="flags">
          <span class="flag ${i.gracias ? 'on' : ''}">${i.gracias ? '✓' : '·'} Gracias</span>
          <span class="flag ${i.respuesta ? 'on' : ''}">${i.respuesta ? '✓ Respuesta ' + fdate(i.respuesta) : '· Respuesta sin enviar'}</span>
          ${i.checkin ? `<span class="flag on">✓ Check-in ${fdate(i.checkin)}</span>` : ''}
        </div>
      </div>
      <div class="card-actions">
        <button class="p-btn small green" data-act="Aceptado" type="button" ${i.estado === 'Aceptado' ? 'disabled' : ''}>✓ Aceptar</button>
        <button class="p-btn small red" data-act="Rechazado" type="button" ${i.estado === 'Rechazado' ? 'disabled' : ''}>✕ Rechazar</button>
        ${i.estado !== 'Pendiente' ? '<button class="p-btn small" data-act="Pendiente" type="button">↺ Pendiente</button>' : ''}
        ${i.estado === 'Aceptado' ? '<button class="p-btn small" data-pdf type="button">PDF</button>' : ''}
        ${i.estado !== 'Pendiente' && i.respuesta ? '<button class="p-btn small" data-resend type="button">Reenviar</button>' : ''}
      </div>
    </article>`;
  }

  /* ---------- Acciones por tarjeta ---------- */
  $('#cards').addEventListener('click', async (e) => {
    const el = e.target;
    const cardEl = el.closest('.card');
    if (!cardEl) return;
    const item = items.find((x) => x.id === cardEl.dataset.id);

    if (el.dataset.photo) {
      const main = cardEl.querySelector('.card-photos>img');
      main.src = thumb(el.dataset.photo); main.dataset.full = el.dataset.photo;
      cardEl.querySelectorAll('.thumbs img').forEach((t) => t.classList.toggle('on', t === el));
      return;
    }
    if (el.dataset.full) { openLightbox(el.dataset.full); return; }

    if (el.dataset.act) {
      const prev = { estado: item.estado, respuesta: item.respuesta };
      item.estado = el.dataset.act;
      if (prev.estado !== item.estado) item.respuesta = '';
      render();
      try { await window.dubApi('setStatus', { key, id: item.id, status: item.estado }); }
      catch (err) { Object.assign(item, prev); render(); notice(err.message, 'error'); }
      return;
    }
    if (el.hasAttribute('data-pdf')) {
      el.disabled = true; el.textContent = 'Generando…';
      const win = window.open('', '_blank'); // se abre antes del await para que no lo bloquee el navegador
      try {
        const r = await window.dubApi('pdf', { key, id: item.id });
        const bytes = Uint8Array.from(atob(r.base64), (ch) => ch.charCodeAt(0));
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        if (win) win.location.href = url; else window.location.href = url;
      } catch (err) { if (win) win.close(); notice(err.message, 'error'); }
      el.disabled = false; el.textContent = 'PDF';
      return;
    }
    if (el.hasAttribute('data-resend')) {
      if (!confirm(`¿Reenviar el correo de "${item.estado}" a ${item.email}?`)) return;
      el.disabled = true;
      try { await window.dubApi('resend', { key, id: item.id }); notice(`Correo reenviado a ${item.email}.`, 'ok'); }
      catch (err) { notice(err.message, 'error'); }
      el.disabled = false;
    }
  });

  /* ---------- Envíos masivos ---------- */
  $('#sendThanks').addEventListener('click', async (e) => {
    const n = counts().thanks;
    if (!confirm(`Se enviará el correo de agradecimiento a ${n} inscrito(s) que aún no lo han recibido. ¿Continuar?`)) return;
    e.currentTarget.disabled = true;
    notice('Enviando agradecimientos…');
    try { const r = await window.dubApi('sendThanks', { key }); notice(`Agradecimientos enviados: ${r.sent}.`, 'ok'); }
    catch (err) { notice(err.message, 'error'); }
    load(true);
  });

  $('#sendReplies').addEventListener('click', async (e) => {
    const c = items.filter((i) => !i.respuesta);
    const acc = c.filter((i) => i.estado === 'Aceptado').length;
    const rej = c.filter((i) => i.estado === 'Rechazado').length;
    if (!confirm(`Se enviarán ${acc} correo(s) de ACEPTADO (con PDF y QR) y ${rej} de NO SELECCIONADO. Los pendientes no reciben nada. ¿Continuar?`)) return;
    e.currentTarget.disabled = true;
    let total = 0;
    try {
      for (let guard = 0; guard < 50; guard++) {
        notice(`Enviando respuestas… ${total} enviadas`);
        const r = await window.dubApi('sendReplies', { key });
        total += r.sent;
        if (!r.remaining || !r.sent) break;
      }
      notice(`Respuestas enviadas: ${total}.`, 'ok');
    } catch (err) { notice(`Enviadas ${total}. Error: ${err.message}`, 'error'); }
    load(true);
  });

  /* ---------- Filtros ---------- */
  $('#filters').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    filter = b.dataset.f;
    document.querySelectorAll('#filters .chip').forEach((c) => c.classList.toggle('active', c === b));
    render();
  });
  $('#search').addEventListener('input', (e) => { query = e.target.value.trim(); render(); });

  /* ---------- Lightbox ---------- */
  const lb = $('#lightbox');
  function openLightbox(id) { lb.querySelector('img').src = thumb(id, 1600); lb.hidden = false; }
  lb.addEventListener('click', () => (lb.hidden = true));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') lb.hidden = true; });

  /* ---------- Arranque ---------- */
  if (key) login(key).catch(() => { localStorage.removeItem(KEY_STORE); key = ''; });
})();
