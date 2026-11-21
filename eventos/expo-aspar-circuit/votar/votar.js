/* Vota a tus mejores coches · Expo Dub Edition × Aspar Circuit */
(() => {
  const MAX = 4;
  const ORG_EMAIL = 'info@dubedition.es';
  const START = new Date('2026-11-21T09:00:00+01:00').getTime();
  const DEADLINE = new Date('2026-11-21T13:00:00+01:00').getTime();
  const LS_KEY = 'dubVoteAspar';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const photo = (f) => 'fotos/' + f;

  const getPos = () => new Promise((ok, ko) => {
    if (!navigator.geolocation) return ko(new Error('Tu navegador no permite compartir la ubicación. Prueba con Chrome o Safari.'));
    navigator.geolocation.getCurrentPosition((p) => ok(p.coords), (e) => ko(new Error(e.code === 1
      ? 'Necesitamos tu ubicación para comprobar que estás en Aspar Circuit. Permite el acceso a la ubicación en tu navegador y vuelve a intentarlo.'
      : 'No hemos podido obtener tu ubicación. Activa el GPS y vuelve a intentarlo.')), { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  });
  let openId = null;
  let cars = [], byId = {}, picked = [], voted = null, rankTimer = null;
  try { voted = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) {}
  const closed = () => Date.now() >= DEADLINE;
  const notOpen = () => Date.now() < START;

  /* ---------- Datos ---------- */
  fetch('coches.json?v=' + Date.now().toString().slice(0, -5))
    .then((r) => r.json())
    .then((d) => { cars = shuffle(d.coches.slice()); cars.forEach((c) => (byId[c.id] = c)); renderGrid(); updateState(); })
    .catch(() => { $('#carGrid').innerHTML = '<p class="muted">No se han podido cargar los coches. Recarga la página.</p>'; });

  /* Orden aleatorio en cada visita: ningún coche sale siempre el primero */
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  /* ---------- Rejilla ---------- */
  function carCard(c) {
    const fotos = c.fotos.length ? c.fotos : [];
    return `<article class="car" data-id="${esc(c.id)}">
      <div class="car-media">
        <div class="car-slides">${fotos.map((f, i) => `<img src="${photo(f)}" alt="${esc(c.marca + ' ' + c.modelo)} · foto ${i + 1}" loading="lazy" decoding="async" width="760" height="950">`).join('')}</div>
        ${fotos.length > 1 ? `<div class="car-dots">${fotos.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>` : ''}
        <span class="car-num">${esc(c.id)}</span><span class="car-check" aria-hidden="true">✓</span>
      </div>
      <div class="car-body">
        <h3 class="car-name">${esc(c.marca)} ${esc(c.modelo)}</h3>
        ${c.instagram ? `<a class="car-ig" href="https://instagram.com/${encodeURIComponent(c.instagram)}" target="_blank" rel="noopener">@${esc(c.instagram)}</a>` : ''}
        <button class="car-vote" type="button" data-vote="${esc(c.id)}">Votar</button>
      </div>
    </article>`;
  }
  function renderGrid() {
    const q = $('#carSearch').value.trim().toLowerCase();
    const list = cars.filter((c) => !q || `${c.id} ${c.marca} ${c.modelo} ${c.instagram}`.toLowerCase().includes(q));
    $('#carGrid').innerHTML = list.length ? list.map(carCard).join('') : '<p class="muted">No hay coches que coincidan con la búsqueda.</p>';
    $('#carGrid').querySelectorAll('.car-slides').forEach((sl) => sl.addEventListener('scroll', () => {
      const i = Math.round(sl.scrollLeft / sl.clientWidth);
      sl.parentElement.querySelectorAll('.car-dots i').forEach((d, n) => d.classList.toggle('on', n === i));
    }, { passive: true }));
    updateState();
  }
  $('#carSearch').addEventListener('input', renderGrid);

  $('#carGrid').addEventListener('click', (e) => {
    const b = e.target.closest('[data-vote]'); if (!b || b.disabled) return;
    const id = b.dataset.vote;
    if (picked.includes(id)) picked = picked.filter((x) => x !== id);
    else if (picked.length < MAX) picked.push(id);
    updateState();
  });

  function updateState() {
    const locked = notOpen() || closed() || (voted && voted.tipo !== 'organizacion');
    document.querySelectorAll('.car').forEach((el) => {
      const on = picked.includes(el.dataset.id);
      el.classList.toggle('is-picked', on);
      const b = el.querySelector('.car-vote');
      b.textContent = on ? '✓ Elegido' : (notOpen() ? 'Abre a las 9:00' : 'Votar');
      b.disabled = locked || (!on && picked.length >= MAX);
    });
    const hint = $('#voteHint'); hint.hidden = !!locked;
    hint.innerHTML = picked.length >= MAX ? '<b>Ya tienes tus 4 coches.</b> Pulsa <b>Enviar voto</b> para confirmar.' :
      `Toca <b>Votar</b> en los coches que más te gusten. Te quedan <b>${MAX - picked.length}</b>.`;
    const notice = $('#voteNotice');
    if (notOpen()) { notice.hidden = false; notice.innerHTML = '<b>La votación abre el sábado 21 de noviembre a las 9:00</b> y cierra a las 13:00. Mientras tanto, echa un vistazo a los coches y a sus Instagram.'; }
    else if (closed()) { notice.hidden = false; notice.innerHTML = '<b>La votación está cerrada.</b> ¡Gracias por participar! Mira el ranking final en la pestaña <b>Ranking</b>.'; }
    else if (locked) { notice.hidden = false; notice.innerHTML = `<b>Ya has votado desde este móvil.</b> ¡Gracias, ${esc(voted.nombre || '')}! Sigue el ranking en directo.`; }
    else notice.hidden = true;
    // barra inferior
    const bar = $('#voteBar');
    bar.hidden = locked || !picked.length || !$('#tab-votar').offsetParent;
    $('#vbSlots').innerHTML = Array.from({ length: MAX }, (_, i) => {
      const c = byId[picked[i]];
      return c && c.fotos[0] ? `<span class="full" style="background-image:url('${photo(c.fotos[0])}')" title="${esc(c.marca + ' ' + c.modelo)}"></span>` : '<span></span>';
    }).join('');
    $('#vbSend span').textContent = picked.length;
    $('#vbSend').disabled = !picked.length;
  }

  /* ---------- Envío ---------- */
  const modal = $('#voteModal');
  $('#vbSend').addEventListener('click', () => {
    $('#vmCars').innerHTML = picked.map((id) => { const c = byId[id];
      return `<li>${c.fotos[0] ? `<img src="${photo(c.fotos[0])}" alt="">` : ''}<div><b>${esc(c.marca)} ${esc(c.modelo)}</b><small>${esc(c.id)}${c.instagram ? ' · @' + esc(c.instagram) : ''}</small></div></li>`; }).join('');
    $('#vmMsg').textContent = ''; $('#vmMsg').className = 'vm-msg';
    modal.showModal();
  });
  $('#vEmail').addEventListener('input', () => {
    const org = $('#vEmail').value.trim().toLowerCase() === ORG_EMAIL;
    $('#pinWrap').hidden = !org; $('#vPin').required = org;
  });
  $('#voteForm').addEventListener('submit', async (e) => {
    if (e.submitter && e.submitter.value === 'cancel') return;
    e.preventDefault();
    const msg = $('#vmMsg'), btn = $('#vmSubmit');
    const nombre = $('#vNombre').value.trim(), email = $('#vEmail').value.trim();
    if (nombre.length < 2) { msg.className = 'vm-msg error'; msg.textContent = 'Escribe tu nombre.'; return; }
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) { msg.className = 'vm-msg error'; msg.textContent = 'Revisa tu correo electrónico.'; return; }
    btn.disabled = true; msg.className = 'vm-msg';
    try {
      const isOrg = email.toLowerCase() === ORG_EMAIL;
      let geo = {};
      if (!isOrg) { msg.textContent = '📍 Comprobando tu ubicación…'; const c = await getPos(); geo = { lat: c.latitude, lng: c.longitude, acc: Math.round(c.accuracy) }; }
      msg.textContent = 'Enviando tu voto…';
      let device = ''; try { device = localStorage.getItem('dubDev') || (Math.random().toString(36).slice(2) + Date.now().toString(36)); localStorage.setItem('dubDev', device); } catch (er) {}
      const r = await window.dubApi('vote', Object.assign({ nombre, email, cars: picked, pin: $('#vPin').value, website: $('#vWeb').value, device }, geo));
      voted = { nombre, tipo: r.tipo, cars: picked.slice(), at: Date.now() };
      try { if (r.tipo !== 'organizacion') localStorage.setItem(LS_KEY, JSON.stringify(voted)); } catch (er) {}
      msg.className = 'vm-msg ok'; msg.textContent = r.tipo === 'organizacion' ? '¡Voto de organización registrado!' : '¡Voto registrado! Gracias por participar.';
      if (r.results) renderRanking(r.results);
      setTimeout(() => { modal.close(); picked = []; if (r.tipo === 'organizacion') { $('#voteForm').reset(); $('#pinWrap').hidden = true; } updateState(); showTab('ranking'); }, 1300);
    } catch (err) {
      msg.className = 'vm-msg error'; msg.textContent = err.message;
    } finally { btn.disabled = false; }
  });

  /* ---------- Pestañas ---------- */
  function showTab(t) {
    document.querySelectorAll('.vt').forEach((b) => { const on = b.dataset.tab === t; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
    $('#tab-votar').hidden = t !== 'votar'; $('#tab-ranking').hidden = t !== 'ranking';
    clearInterval(rankTimer);
    if (t === 'ranking') { loadRanking(); rankTimer = setInterval(() => { if (!document.hidden) loadRanking(); }, 30000); }
    updateState();
    const panel = $('#tab-' + t), y = panel.getBoundingClientRect().top + window.scrollY - 150;
    if (window.scrollY > y) window.scrollTo({ top: y, behavior: 'smooth' });
  }
  document.querySelectorAll('.vt').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  if (location.hash === '#ranking' || (voted && voted.tipo !== 'organizacion') || closed()) setTimeout(() => showTab('ranking'), 0);

  /* ---------- Ranking ---------- */
  async function loadRanking() {
    try {
      if (emails) { try { await loadEmails(sessionStorage.getItem('dubVotePin') || ''); } catch (er) {} }
      renderRanking(await window.dubApi('results', {}));
    }
    catch (err) { $('#rankMeta').textContent = 'No se ha podido cargar el ranking. Lo reintentamos en unos segundos.'; }
  }
  function renderRanking(d) {
    const pub = d.votantes.publico, org = d.votantes.organizacion;
    const t = new Date(d.actualizado).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    $('#rankMeta').innerHTML = `${pub} ${pub === 1 ? 'voto' : 'votos'} del público · ${org} de la organización · actualizado a las ${t}${d.cerrada ? ' · <b>votación cerrada</b>' : ''}`;
    const list = d.ranking.filter((r) => byId[r.id]);
    if (!list.length) { $('#rankList').innerHTML = '<li class="rank-empty">Todavía no hay votos. ¡Sé el primero en votar!</li>'; return; }
    const both = pub > 0 && org > 0;
    $('#rankList').innerHTML = list.map((r, i) => {
      const c = byId[r.id];
      const wp = both ? r.publico / 2 : (pub ? r.publico : 0), wo = both ? r.organizacion / 2 : (org ? r.organizacion : 0);
      const scale = list[0].pct ? 100 / list[0].pct : 1;
      const np = r.nombres || [], nj = r.jurado || [];
      const total = r.votos || (np.length + nj.length);
      const chips = (arr, cls) => arr.map((n, k) => cls === 'p'
        ? `<button type="button" class="vchip p" data-car="${esc(r.id)}" data-k="${k}" data-n="${esc(n)}">${esc(n)}${shown.has(r.id + '|' + k) && emailFor(r.id, k, n) ? `<em>${esc(emailFor(r.id, k, n))}</em>` : ''}</button>`
        : `<span class="vchip ${cls}">${esc(n)}</span>`).join('');
      return `<li class="rank-item ${i < 3 ? 'p' + (i + 1) : ''}${openId === r.id ? ' open' : ''}" data-rid="${esc(r.id)}" tabindex="0" role="button" aria-expanded="${openId === r.id}">
        <span class="rank-pos">${i + 1}</span>
        ${c.fotos[0] ? `<img src="${photo(c.fotos[0])}" alt="" loading="lazy">` : '<span></span>'}
        <div class="rank-info"><b>${esc(c.marca)} ${esc(c.modelo)}</b><small>${esc(c.id)}${c.instagram ? ' · @' + esc(c.instagram) : ''} · <u>${total} ${total === 1 ? 'voto' : 'votos'}</u></small>
          <div class="rank-bar" aria-hidden="true"><span class="b-pub" style="width:${(wp * scale).toFixed(1)}%"></span><span class="b-org" style="width:${(wo * scale).toFixed(1)}%"></span></div></div>
        <span class="rank-pct">${r.pct.toLocaleString('es-ES', { maximumFractionDigits: 1 })}%</span>
        <div class="rank-voters">
          <p><b>${total} ${total === 1 ? 'persona ha' : 'personas han'} votado este coche</b> · ${np.length} del público · ${nj.length} de la organización</p>
          ${np.length ? `<div class="vgroup"><small>Público</small>${chips(np, 'p')}</div>` : ''}
          ${nj.length ? `<div class="vgroup"><small>Organización</small>${chips(nj, 'o')}</div>` : ''}
        </div>
      </li>`;
    }).join('');
  }
  /* Correos del público: solo para la organización (PIN del jurado) */
  let emails = null; const shown = new Set();
  function emailFor(id, k, n) {
    const l = emails && emails[id]; if (!l) return '';
    const hit = l[k] && l[k].n === n ? l[k] : l.find((x) => x.n === n);
    return hit ? hit.e : '';
  }
  async function loadEmails(pin) {
    const r = await window.dubApi('voteEmails', { pin });
    emails = r.coches; try { sessionStorage.setItem('dubVotePin', pin); } catch (er) {}
  }
  $('#rankList').addEventListener('click', async (e) => {
    const chip = e.target.closest('.vchip.p');
    if (chip) {
      e.stopPropagation();
      if (!emails) {
        let pin = ''; try { pin = sessionStorage.getItem('dubVotePin') || ''; } catch (er) {}
        if (!pin) pin = (window.prompt('Solo organización: introduce el PIN del jurado para ver los correos') || '').trim();
        if (!pin) return;
        try { await loadEmails(pin); } catch (err) { try { sessionStorage.removeItem('dubVotePin'); } catch (er) {} alert(err.message || 'PIN incorrecto'); return; }
      }
      const key = chip.dataset.car + '|' + chip.dataset.k;
      if (shown.has(key)) shown.delete(key); else shown.add(key);
      const em = chip.querySelector('em');
      if (em) em.remove();
      else { const v = emailFor(chip.dataset.car, +chip.dataset.k, chip.dataset.n); if (v) { const x = document.createElement('em'); x.textContent = v; chip.appendChild(x); } else shown.delete(key); }
      return;
    }
    const li = e.target.closest('.rank-item[data-rid]'); if (!li) return;
    const id = li.dataset.rid;
    openId = openId === id ? null : id;
    document.querySelectorAll('.rank-item[data-rid]').forEach((el) => { const on = el.dataset.rid === openId; el.classList.toggle('open', on); el.setAttribute('aria-expanded', on); });
  });
  $('#rankList').addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.rank-item')) { e.preventDefault(); e.target.click(); } });

  /* ---------- Cuenta atrás de cierre ---------- */
  const vc = $('#voteClose');
  function tick() {
    const left = DEADLINE - Date.now();
    vc.hidden = false;
    const pre = Date.now() < START;
    vc.querySelector('.vc-label').textContent = pre ? 'La votación abre en' : 'La votación cierra en';
    if (pre && START - Date.now() <= 1000) setTimeout(updateState, 1100);
    if (left <= 0) { vc.classList.add('is-closed'); vc.querySelector('.vc-label').textContent = 'Votación cerrada'; updateState(); return; }
    const s = Math.floor((pre ? START - Date.now() : left) / 1000), v = { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
    vc.querySelectorAll('[data-u]').forEach((el) => (el.textContent = String(v[el.dataset.u]).padStart(2, '0')));
    setTimeout(tick, 1000);
  }
  tick();
})();
