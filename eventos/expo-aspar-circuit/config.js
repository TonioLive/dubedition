/* =========================================================
   EXPO DUB EDITION × ASPAR CIRCUIT — configuración
   Pega aquí la URL de la aplicación web de Google Apps Script
   (termina en /exec). Ver apps-script/README.md
   ========================================================= */
window.DUB_EXPO = {
  apiUrl: '',
  maxPhotos: 5,
  inscripcionesAbiertas: true
};

/* Llamada a la API (POST text/plain para evitar preflight CORS con Apps Script) */
window.dubApi = async function (action, data) {
  if (!window.DUB_EXPO.apiUrl) throw new Error('El formulario aún no está conectado (falta la URL de Apps Script en config.js).');
  const res = await fetch(window.DUB_EXPO.apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(Object.assign({ action }, data || {}))
  });
  if (!res.ok) throw new Error('Error de conexión (' + res.status + ').');
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Error desconocido.');
  return json;
};
