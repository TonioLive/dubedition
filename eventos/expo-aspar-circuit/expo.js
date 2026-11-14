/* =========================================================
   EXPO DUB EDITION × ASPAR CIRCUIT — formulario de inscripción
   Las fotos se reducen en el navegador (máx. 1600 px, JPG) antes
   de enviarlas, así suben rápido aunque se hagan con el móvil.
   ========================================================= */
(() => {
  const form = document.getElementById('expoForm');
  if (!form) return;

  const cfg = window.DUB_EXPO || {};
  const MAX = cfg.maxPhotos || 5;
  const input = document.getElementById('expoPhotos');
  const drop = document.getElementById('photoDrop');
  const previews = document.getElementById('photoPreviews');
  const status = document.getElementById('formStatus');
  const submit = form.querySelector('button[type="submit"]');
  const success = document.getElementById('expoSuccess');
  let photos = []; // { name, data }

  if (cfg.inscripcionesAbiertas === false) {
    form.querySelectorAll('input,textarea,select,button').forEach((el) => (el.disabled = true));
    setStatus('Las inscripciones para la expo están cerradas. ¡Te esperamos en el circuito!', 'info');
  }

  /* ---------- Fotos ---------- */
  const compress = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 1600;
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se puede leer ' + file.name)); };
    img.src = url;
  });

  const render = () => {
    previews.innerHTML = '';
    photos.forEach((p, i) => {
      const fig = document.createElement('figure');
      fig.innerHTML = `<img src="${p.data}" alt="Foto ${i + 1} de tu coche"><button type="button" aria-label="Quitar foto ${i + 1}">✕</button>`;
      fig.querySelector('button').addEventListener('click', () => { photos.splice(i, 1); render(); });
      previews.appendChild(fig);
    });
    drop.querySelector('.photo-count').textContent = photos.length
      ? `${photos.length}/${MAX} fotos añadidas`
      : `Hasta ${MAX} fotos · JPG, PNG o HEIC del móvil`;
    drop.classList.toggle('is-full', photos.length >= MAX);
  };

  const addFiles = async (files) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    if (!list.length) return;
    const free = MAX - photos.length;
    if (free <= 0) { setStatus(`Máximo ${MAX} fotos.`, 'error'); return; }
    if (list.length > free) setStatus(`Solo se han añadido ${free} fotos (máximo ${MAX}).`, 'info');
    drop.classList.add('is-loading');
    for (const f of list.slice(0, free)) {
      try { photos.push({ name: f.name, data: await compress(f) }); }
      catch (err) { setStatus(`${err.message}. Prueba con una foto en JPG o PNG.`, 'error'); }
    }
    drop.classList.remove('is-loading');
    render();
  };

  input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-drag'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-drag'); }));
  drop.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));
  render();

  /* ---------- Envío ---------- */
  function setStatus(msg, type) {
    status.textContent = msg || '';
    status.className = 'form-status' + (type ? ' is-' + type : '');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStatus('');
    if (!form.reportValidity()) return;
    if (!photos.length) { setStatus('Añade al menos una foto de tu coche.', 'error'); drop.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }

    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());
    payload.privacidad = fd.get('privacidad') === 'on';
    payload.photos = photos.map((p) => ({ name: p.name, data: p.data }));

    submit.disabled = true;
    submit.textContent = 'ENVIANDO…';
    setStatus('Subiendo tu inscripción y las fotos. No cierres la página.', 'info');
    try {
      await window.dubApi('register', payload);
      form.hidden = true;
      success.hidden = false;
      success.querySelector('[data-email]').textContent = payload.email;
      success.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (window.gtag) window.gtag('event', 'expo_aspar_inscripcion', { marca: payload.marca });
    } catch (err) {
      setStatus(err.message, 'error');
      submit.disabled = false;
      submit.textContent = 'ENVIAR INSCRIPCIÓN';
    }
  });
})();
