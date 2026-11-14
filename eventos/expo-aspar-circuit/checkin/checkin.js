/* Check-in en puerta — Expo Dub Edition × Aspar Circuit
   El QR del PDF lleva https://dubedition.es/eventos/expo-aspar-circuit/checkin/?t=TOKEN
   - Escaneado desde esta página (cámara integrada) → check-in directo.
   - Escaneado con la cámara normal del móvil → abre esta página con ?t= y hace el check-in
     (si el móvil ya tiene la clave de staff guardada). */
(() => {
  const $ = (s) => document.querySelector(s);
  const KEY_STORE = 'dubExpoKey';
  let key = localStorage.getItem(KEY_STORE) || '';
  let people = [];
  let filter = 'all';
  let query = '';
  let scanner = null;
  let busy = false;
  let lastScan = { text: '', at: 0 };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const thumb = (id) => `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w800`;
  const hhmm = (iso) => (iso ? new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '');
  const notice = (msg, type) => { const n = $('#notice'); n.textContent = msg || ''; n.className = 'notice' + (type ? ' ' + type : ''); };
  const urlToken = new URLSearchParams(location.search).get('t');

  /* ---------- Login ---------- */
  async function login(k) {
    const r = await window.dubApi('login', { key: k });
    key = k;
    localStorage.setItem(KEY_STORE, k);
    $('#login').hidden = true;
    $('#app').hidden = false;
    $('#headerActions').hidden = false;
    $('#adminLink').hidden = r.role !== 'admin';
    await load();
    if (urlToken) {
      history.replaceState(null, '', location.pathname);
      await doCheckin({ token: urlToken });
    }
  }
  $('#login').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#loginMsg').textContent = 'Comprobando…';
    try { await login($('#key').value.trim()); $('#loginMsg').textContent = ''; }
    catch (err) { $('#loginMsg').textContent = err.message; }
  });
  $('#logout').addEventListener('click', () => { localStorage.removeItem(KEY_STORE); location.reload(); });

  /* ---------- Lista ---------- */
  async function load() {
    try {
      const r = await window.dubApi('attendance', { key });
      people = r.items;
      notice('');
      render();
    } catch (err) { notice(err.message, 'error'); }
  }
  $('#refresh').addEventListener('click', load);
  setInterval(() => { if (key && !busy && document.visibilityState === 'visible') load(); }, 30000);

  function render() {
    $('#present').textContent = people.filter((p) => p.checkin).length;
    $('#total').textContent = people.length;
    const q = query.toLowerCase().replace(/[\s-]/g, '');
    const list = people
      .filter((p) => filter === 'all' || (filter === 'in' ? p.checkin : !p.checkin))
      .filter((p) => !q || [p.nombre, p.apellido, p.marca, p.modelo, p.matricula, p.instagram, p.id].join('').toLowerCase().replace(/[\s-]/g, '').includes(q))
      .sort((a, b) => String(a.matricula).localeCompare(String(b.matricula)));
    $('#list').innerHTML = list.length ? list.map((p) => `
      <div class="ci-row ${p.checkin ? 'in' : ''}" data-id="${esc(p.id)}">
        <span class="dot"></span>
        <div class="who"><b>${esc(p.nombre)} ${esc(p.apellido)}</b><small>${esc(p.marca)} ${esc(p.modelo)} · ${esc(p.id)}${p.checkin ? ' · ' + hhmm(p.checkin) : ''}</small></div>
        <span class="plate">${esc(p.matricula)}</span>
        ${p.checkin
          ? '<button class="p-btn small" data-undo type="button">Deshacer</button>'
          : '<button class="p-btn small green" data-in type="button">Entrar</button>'}
      </div>`).join('') : '<p class="empty">Sin resultados.</p>';
  }

  $('#list').addEventListener('click', async (e) => {
    const row = e.target.closest('.ci-row'); if (!row) return;
    if (e.target.hasAttribute('data-in')) await doCheckin({ id: row.dataset.id });
    if (e.target.hasAttribute('data-undo')) {
      const p = people.find((x) => x.id === row.dataset.id);
      if (confirm(`¿Quitar el check-in de ${p.nombre} (${p.matricula})?`)) await doCheckin({ id: row.dataset.id, undo: true }, true);
    }
  });
  $('#search').addEventListener('input', (e) => { query = e.target.value.trim(); render(); });
  $('#filters').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    filter = b.dataset.f;
    document.querySelectorAll('#filters .chip').forEach((c) => c.classList.toggle('active', c === b));
    render();
  });

  /* ---------- Check-in ---------- */
  async function doCheckin(params, silent) {
    if (busy) return;
    busy = true;
    try {
      const r = await window.dubApi('checkin', Object.assign({ key }, params));
      if (r.person) {
        const i = people.findIndex((p) => p.id === r.person.id);
        if (i >= 0) people[i] = r.person; else if (r.person.estado === 'Aceptado') people.push(r.person);
      }
      render();
      if (!silent) showResult(r);
    } catch (err) {
      showResult({ result: 'error', message: err.message });
    } finally { busy = false; }
  }

  function showResult(r) {
    const p = r.person || {};
    const map = {
      ok: ['ok', '✅', 'Acceso correcto'],
      already: ['already', '⚠️', 'Ya había entrado'],
      not_accepted: ['bad', '⛔', 'No aceptado'],
      invalid: ['bad', '❌', 'QR no válido'],
      undone: ['already', '↺', 'Check-in deshecho'],
      error: ['bad', '⚠️', 'Error']
    };
    const [cls, icon, title] = map[r.result] || map.error;
    $('#resultCard').className = 'ci-card ' + cls;
    $('#resultCard').innerHTML = `
      <div class="ci-icon">${icon}</div>
      <h2>${title}</h2>
      ${r.message ? `<p>${esc(r.message)}</p>` : ''}
      ${p.id ? `
        ${p.foto ? `<img src="${thumb(p.foto)}" alt="Coche">` : ''}
        <div class="plate">${esc(p.matricula)}</div>
        <p><b>${esc(p.nombre)} ${esc(p.apellido)}</b></p>
        <p>${esc(p.marca)} ${esc(p.modelo)}${p.instagram ? ' · ' + esc(p.instagram) : ''}</p>
        <p class="meta">${esc(p.id)}${p.checkin ? ' · Entrada ' + hhmm(p.checkin) : ''}</p>` : ''}
      <div class="ci-actions">
        <button class="p-btn white" data-close type="button">Siguiente</button>
        ${r.result === 'ok' ? `<button class="p-btn" data-undo-id="${esc(p.id)}" type="button">Deshacer</button>` : ''}
      </div>`;
    $('#result').hidden = false;
    feedback(cls);
  }

  $('#result').addEventListener('click', async (e) => {
    if (e.target.dataset.undoId) { const id = e.target.dataset.undoId; $('#result').hidden = true; await doCheckin({ id, undo: true }, true); return; }
    if (e.target.hasAttribute('data-close') || e.target.id === 'result') $('#result').hidden = true;
  });

  function feedback(cls) {
    try { navigator.vibrate && navigator.vibrate(cls === 'ok' ? 120 : [80, 60, 80]); } catch (e) {}
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = cls === 'ok' ? 880 : 220; o.connect(g); g.connect(ctx.destination);
      g.gain.value = 0.15; o.start(); o.stop(ctx.currentTime + (cls === 'ok' ? 0.15 : 0.35));
    } catch (e) {}
  }

  /* ---------- Cámara ---------- */
  function tokenFrom(text) {
    try { const u = new URL(text); return u.searchParams.get('t') || ''; }
    catch (e) { return /^[a-f0-9]{32}$/i.test(text.trim()) ? text.trim() : ''; }
  }

  $('#startCam').addEventListener('click', async () => {
    if (!window.Html5Qrcode) { notice('No se ha podido cargar el lector QR. Revisa la conexión.', 'error'); return; }
    scanner = scanner || new Html5Qrcode('reader');
    try {
      await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: (w, h) => { const s = Math.floor(Math.min(w, h) * 0.75); return { width: s, height: s }; } },
        async (text) => {
          const now = Date.now();
          if (busy || !$('#result').hidden || (text === lastScan.text && now - lastScan.at < 4000)) return;
          lastScan = { text, at: now };
          const token = tokenFrom(text);
          if (!token) { showResult({ result: 'invalid', message: 'Este QR no es una acreditación de la expo.' }); return; }
          await doCheckin({ token });
        });
      $('#startCam').hidden = true; $('#stopCam').hidden = false;
    } catch (err) {
      notice('No se pudo abrir la cámara: ' + (err.message || err) + '. Da permiso de cámara al navegador.', 'error');
    }
  });
  $('#stopCam').addEventListener('click', async () => {
    try { await scanner.stop(); } catch (e) {}
    $('#startCam').hidden = false; $('#stopCam').hidden = true;
  });

  /* ---------- Arranque ---------- */
  if (key) login(key).catch(() => { localStorage.removeItem(KEY_STORE); key = ''; });
  else if (urlToken) $('#loginMsg').textContent = 'Introduce la clave de staff para validar este QR.';
})();
