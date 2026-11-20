/* Vota a tus mejores coches · Expo Dub Edition × Aspar Circuit */
(() => {
  const MAX = 4;
  const ORG_EMAIL = 'info@dubedition.es';
  const DEADLINE = new Date('2026-11-21T13:00:00+01:00').getTime();
  const LS_KEY = 'dubVoteAspar';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const photo = (f) => 'fotos/' + f;

  let cars = [], byId = {}, picked = [], voted = null, rankTimer = null;
  try { voted = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) {}
  const closed = () => Date.now() >= DEADLINE;

  /* ---------- Datos ---------- */
  fetch('coches.json?v=' + Date.now().toString().slice(0, -5))
    .then((r) => r.json())
    .then((d) => { cars = d.coches; cars.forEach((c) => (byId[c.id] = c)); renderGrid(); updateState(); })
    .catch(() => { $('#carGrid').innerHTML = '<p class="muted">No se han podido cargar los coches. Recarga la página.</p>'; });

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
    const locked = closed() || (voted && voted.tipo !== 'organizacion');
    document.querySelectorAll('.car').forEach((el) => {
      const on = picked.includes(el.dataset.id);
      el.classList.toggle('is-picked', on);
      const b = el.querySelector('.car-vote');
      b.textContent = on ? '✓ Elegido' : 'Votar';
      b.disabled = locked || (!on && picked.length >= MAX);
    });
    const hint = $('#voteHint');
    hint.innerHTML = picked.length >= MAX ? '<b>Ya tienes tus 4 coches.</b> Pulsa <b>Enviar voto</b> para confirmar.' :
      `Toca <b>Votar</b> en los coches que más te gusten. Te quedan <b>${MAX - picked.length}</b>.`;
    const notice = $('#voteNotice');
    if (closed()) { notice.hidden = false; notice.innerHTML = '<b>La votación está cerrada.</b> ¡Gracias por participar! Mira el ranking final en la pestaña <b>Ranking</b>.'; }
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
    btn.disabled = true; msg.className = 'vm-msg'; msg.textContent = 'Enviando tu voto…';
    try {
      let device = ''; try { device = localStorage.getItem('dubDev') || (Math.random().toString(36).slice(2) + Date.now().toString(36)); localStorage.setItem('dubDev', device); } catch (er) {}
      const r = await window.dubApi('vote', { nombre, email, cars: picked, pin: $('#vPin').value, website: $('#vWeb').value, device });
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
    try { renderRanking(await window.dubApi('results', {})); }
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
      return `<li class="rank-item ${i < 3 ? 'p' + (i + 1) : ''}">
        <span class="rank-pos">${i + 1}</span>
        ${c.fotos[0] ? `<img src="${photo(c.fotos[0])}" alt="" loading="lazy">` : '<span></span>'}
        <div class="rank-info"><b>${esc(c.marca)} ${esc(c.modelo)}</b><small>${esc(c.id)}${c.instagram ? ' · @' + esc(c.instagram) : ''}</small>
          <div class="rank-bar" aria-hidden="true"><span class="b-pub" style="width:${(wp * scale).toFixed(1)}%"></span><span class="b-org" style="width:${(wo * scale).toFixed(1)}%"></span></div></div>
        <span class="rank-pct">${r.pct.toLocaleString('es-ES', { maximumFractionDigits: 1 })}%</span>
      </li>`;
    }).join('');
  }

  /* ---------- Cuenta atrás de cierre ---------- */
  const vc = $('#voteClose');
  function tick() {
    const left = DEADLINE - Date.now();
    vc.hidden = false;
    if (left <= 0) { vc.classList.add('is-closed'); vc.querySelector('.vc-label').textContent = 'Votación cerrada'; updateState(); return; }
    const s = Math.floor(left / 1000), v = { h: Math.floor(s / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
    vc.querySelectorAll('[data-u]').forEach((el) => (el.textContent = String(v[el.dataset.u]).padStart(2, '0')));
    setTimeout(tick, 1000);
  }
  tick();
})();
