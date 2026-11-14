/**
 * DUB EDITION · EXPO ASPAR CIRCUIT (21/11/2026)
 * Backend en Google Apps Script: Google Sheets (inscripciones) + Google Drive (fotos)
 * + Gmail (correos) + PDF con QR para el acceso + check-in el día del evento.
 *
 * Puesta en marcha: ver apps-script/README.md
 *  1. Crea una Hoja de cálculo de Google → Extensiones → Apps Script → pega este archivo.
 *  2. Ejecuta setup() una vez (te pide permisos y escribe las claves en el registro).
 *  3. Implementar → Nueva implementación → Aplicación web
 *     (Ejecutar como: Yo · Quién tiene acceso: Cualquier usuario).
 *  4. Copia la URL /exec en eventos/expo-aspar-circuit/config.js
 */

const CFG = {
  EVENT_NAME: 'Expo Dub Edition × Aspar Circuit',
  EVENT_DATE: 'Sábado 21 de noviembre de 2026',
  EVENT_DATE_SHORT: '21.11.2026',
  EVENT_PLACE: 'Aspar Circuit · Guadassuar (Valencia)',
  EVENT_URL: 'https://dubedition.es/eventos/expo-aspar-circuit/',
  CHECKIN_URL: 'https://dubedition.es/eventos/expo-aspar-circuit/checkin/?t=',
  LOGO_BLACK: 'https://dubedition.es/assets/dub-edition-logo-black-sm.png',
  LOGO_WHITE: 'https://dubedition.es/assets/dub-edition-logo-white-sm.png',
  INSTAGRAM: 'https://www.instagram.com/dubeditionvlc',
  SENDER_NAME: 'Dub Edition VLC',
  FROM: 'info@dubedition.es',     // remitente si está añadido en Gmail como alias "Enviar como"; si no, se usa la cuenta propietaria
  REPLY_TO: 'info@dubedition.es', // las respuestas de los inscritos llegan aquí
  SHEET_NAME: 'Inscripciones',
  FOLDER_NAME: 'DUB EDITION · Expo Aspar 21-11 · Fotos',
  AUTO_THANKS: true,         // envía el correo de "gracias por inscribirte" al recibir el formulario
  MAX_PHOTOS: 5,
  MAX_PHOTO_BYTES: 4 * 1024 * 1024,
  SEND_BATCH: 20             // correos con PDF por llamada (evita el límite de 6 min)
};

const STATUS = { PENDING: 'Pendiente', ACCEPTED: 'Aceptado', REJECTED: 'Rechazado' };

const HEADERS = [
  'ID', 'Fecha inscripción', 'Estado', 'Email', 'Nombre', 'Apellido', 'Marca', 'Modelo',
  'Matrícula', 'Instagram', 'Descripción', 'Interés tandas', 'Fotos (IDs)', 'Carpeta fotos',
  'Token QR', 'Gracias enviado', 'Respuesta enviada', 'Check-in', 'Notas'
];
const COL = HEADERS.reduce((o, h, i) => (o[h] = i, o), {});

/* =========================================================
   SETUP (ejecutar una vez desde el editor)
   ========================================================= */
function setup() {
  const props = PropertiesService.getScriptProperties();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Este script debe crearse desde la Hoja de cálculo (Extensiones → Apps Script).');
  props.setProperty('SHEET_ID', ss.getId());

  let sh = ss.getSheetByName(CFG.SHEET_NAME);
  if (!sh) sh = ss.insertSheet(CFG.SHEET_NAME);
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS])
    .setFontWeight('bold').setBackground('#000000').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList([STATUS.PENDING, STATUS.ACCEPTED, STATUS.REJECTED], true).build();
  sh.getRange(2, COL['Estado'] + 1, 1000, 1).setDataValidation(rule);
  sh.setColumnWidth(COL['Descripción'] + 1, 320);
  const def = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(def);

  if (!props.getProperty('FOLDER_ID')) {
    props.setProperty('FOLDER_ID', DriveApp.createFolder(CFG.FOLDER_NAME).getId());
  }
  if (!props.getProperty('ADMIN_KEY')) props.setProperty('ADMIN_KEY', 'adm-' + randomKey_(18));
  if (!props.getProperty('STAFF_KEY')) props.setProperty('STAFF_KEY', 'staff-' + randomKey_(12));

  // Fuerza los permisos de Gmail/UrlFetch durante el setup
  MailApp.getRemainingDailyQuota();
  UrlFetchApp.fetch(CFG.LOGO_BLACK, { muteHttpExceptions: true });

  const msg = [
    'SETUP COMPLETADO',
    'Hoja: ' + ss.getUrl(),
    'Carpeta fotos: https://drive.google.com/drive/folders/' + props.getProperty('FOLDER_ID'),
    'CLAVE ADMIN (panel de admisión): ' + props.getProperty('ADMIN_KEY'),
    'CLAVE STAFF (solo check-in en puerta): ' + props.getProperty('STAFF_KEY'),
    'Correos restantes hoy: ' + MailApp.getRemainingDailyQuota(),
    'Remitente: ' + (GmailApp.getAliases().indexOf(CFG.FROM) >= 0 ? CFG.FROM : Session.getActiveUser().getEmail() + ' (alias ' + CFG.FROM + ' no configurado; respuestas a ' + CFG.REPLY_TO + ')')
  ].join('\n');
  Logger.log(msg);
  return msg;
}

/** Muestra de nuevo las claves en el registro de ejecución. */
function verClaves() {
  const p = PropertiesService.getScriptProperties();
  Logger.log('ADMIN: ' + p.getProperty('ADMIN_KEY') + '\nSTAFF: ' + p.getProperty('STAFF_KEY'));
}

/** Menú dentro de la Hoja de cálculo (alternativa al panel web). */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('DUB EDITION')
    .addItem('Enviar agradecimientos pendientes', 'menuThanks_')
    .addItem('Enviar respuestas (aceptados / rechazados)', 'menuReplies_')
    .addSeparator()
    .addItem('Ver claves de acceso', 'menuKeys_')
    .addToUi();
}
function menuThanks_() { const r = sendThanks_(); SpreadsheetApp.getUi().alert('Agradecimientos enviados: ' + r.sent); }
function menuReplies_() {
  let total = 0, r;
  do { r = sendReplies_(); total += r.sent; } while (r.remaining > 0 && r.sent > 0);
  SpreadsheetApp.getUi().alert('Respuestas enviadas: ' + total + (r.remaining ? ' · Quedan ' + r.remaining + ' (vuelve a ejecutarlo)' : ''));
}
function menuKeys_() {
  const p = PropertiesService.getScriptProperties();
  SpreadsheetApp.getUi().alert('ADMIN: ' + p.getProperty('ADMIN_KEY') + '\nSTAFF: ' + p.getProperty('STAFF_KEY'));
}

/* =========================================================
   API WEB
   ========================================================= */
function doGet() {
  return json_({ ok: true, service: CFG.EVENT_NAME, date: CFG.EVENT_DATE });
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); }
  catch (err) { return json_({ ok: false, error: 'Petición no válida.' }); }

  try {
    switch (body.action) {
      case 'register':   return json_(register_(body));
      case 'login':      return json_({ ok: true, role: role_(body.key) || fail_('Clave incorrecta.') });
      case 'list':       requireRole_(body.key, 'admin'); return json_(list_());
      case 'setStatus':  requireRole_(body.key, 'admin'); return json_(setStatus_(body.id, body.status, body.note));
      case 'sendThanks': requireRole_(body.key, 'admin'); return json_(sendThanks_());
      case 'sendReplies':requireRole_(body.key, 'admin'); return json_(sendReplies_());
      case 'resend':     requireRole_(body.key, 'admin'); return json_(resend_(body.id));
      case 'pdf':        requireRole_(body.key, 'admin'); return json_(pdfFor_(body.id));
      case 'checkin':    requireRole_(body.key, 'staff'); return json_(checkin_(body.token, body.id, body.undo));
      case 'attendance': requireRole_(body.key, 'staff'); return json_(attendance_());
      default: return json_({ ok: false, error: 'Acción desconocida.' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

/* =========================================================
   INSCRIPCIÓN
   ========================================================= */
function register_(b) {
  if (b.website) return { ok: true }; // honeypot anti-spam
  const d = {
    email: clean_(b.email, 120).toLowerCase(),
    nombre: clean_(b.nombre, 60),
    apellido: clean_(b.apellido, 80),
    marca: clean_(b.marca, 40),
    modelo: clean_(b.modelo, 60),
    matricula: clean_(b.matricula, 15).toUpperCase().replace(/\s+/g, ' '),
    instagram: normalizeIg_(clean_(b.instagram, 60)),
    descripcion: clean_(b.descripcion, 1200),
    tandas: clean_(b.tandas, 30)
  };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) return { ok: false, error: 'El email no es válido.' };
  for (const k of ['nombre', 'apellido', 'marca', 'modelo', 'matricula', 'instagram', 'descripcion']) {
    if (!d[k]) return { ok: false, error: 'Falta completar el campo: ' + k + '.' };
  }
  if (!b.privacidad) return { ok: false, error: 'Debes aceptar la política de privacidad.' };
  const photos = Array.isArray(b.photos) ? b.photos.slice(0, CFG.MAX_PHOTOS) : [];
  if (!photos.length) return { ok: false, error: 'Sube al menos una foto de tu coche.' };

  const token = Utilities.getUuid().replace(/-/g, '');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sh = sheet_();
    const rows = data_(sh);
    const plateKey = d.matricula.replace(/[\s-]/g, '');
    if (rows.some(r => String(r[COL['Matrícula']]).replace(/[\s-]/g, '') === plateKey &&
                       String(r[COL['Email']]).toLowerCase() === d.email)) {
      return { ok: false, error: 'Ya tenemos una inscripción con este email y esta matrícula.' };
    }
    const next = rows.reduce((m, r) => Math.max(m, parseInt(String(r[COL['ID']]).replace(/\D/g, ''), 10) || 0), 0) + 1;
    const id = 'DUB-' + ('000' + next).slice(-3);

    // Fotos → Drive (una subcarpeta por inscripción)
    const parent = DriveApp.getFolderById(prop_('FOLDER_ID'));
    const folder = parent.createFolder(id + ' · ' + d.nombre + ' ' + d.apellido + ' · ' + d.matricula);
    const ids = [];
    photos.forEach((p, i) => {
      const m = /^data:(image\/(jpeg|png|webp|heic|heif));base64,(.+)$/.exec(p.data || '');
      if (!m) return;
      const bytes = Utilities.base64Decode(m[3]);
      if (bytes.length > CFG.MAX_PHOTO_BYTES) return;
      const ext = m[2] === 'jpeg' ? 'jpg' : m[2];
      const f = folder.createFile(Utilities.newBlob(bytes, m[1], id + '-' + (i + 1) + '.' + ext));
      try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (err) {}
      ids.push(f.getId());
    });
    if (!ids.length) { folder.setTrashed(true); return { ok: false, error: 'No se han podido leer las fotos. Prueba con JPG o PNG.' }; }

    const row = new Array(HEADERS.length).fill('');
    row[COL['ID']] = id;
    row[COL['Fecha inscripción']] = new Date();
    row[COL['Estado']] = STATUS.PENDING;
    row[COL['Email']] = d.email;
    row[COL['Nombre']] = d.nombre;
    row[COL['Apellido']] = d.apellido;
    row[COL['Marca']] = d.marca;
    row[COL['Modelo']] = d.modelo;
    row[COL['Matrícula']] = d.matricula;
    row[COL['Instagram']] = d.instagram;
    row[COL['Descripción']] = d.descripcion;
    row[COL['Interés tandas']] = d.tandas;
    row[COL['Fotos (IDs)']] = ids.join(',');
    row[COL['Carpeta fotos']] = folder.getUrl();
    row[COL['Token QR']] = token;
    sh.appendRow(row.map(v => (typeof v === 'string' && /^[=+\-]/.test(v) ? "'" + v : v)));
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  if (CFG.AUTO_THANKS) {
    try {
      const r = findRow_(x => x[COL['Token QR']] === token);
      if (r) { sendThanksMail_(rowObj_(r.values)); r.set('Gracias enviado', new Date()); }
    } catch (err) { /* la inscripción queda guardada aunque falle el correo */ }
  }
  return { ok: true };
}

/* =========================================================
   ADMIN
   ========================================================= */
function list_() {
  const rows = data_(sheet_()).map(rowObj_);
  return {
    ok: true,
    sheetUrl: SpreadsheetApp.openById(prop_('SHEET_ID')).getUrl(),
    folderUrl: 'https://drive.google.com/drive/folders/' + prop_('FOLDER_ID'),
    quota: MailApp.getRemainingDailyQuota(),
    items: rows.map(r => ({
      id: r.id, fecha: r.fecha, estado: r.estado, email: r.email, nombre: r.nombre, apellido: r.apellido,
      marca: r.marca, modelo: r.modelo, matricula: r.matricula, instagram: r.instagram,
      descripcion: r.descripcion, tandas: r.tandas, fotos: r.fotos, carpeta: r.carpeta,
      gracias: r.gracias, respuesta: r.respuesta, checkin: r.checkin, notas: r.notas
    }))
  };
}

function setStatus_(id, status, note) {
  if ([STATUS.PENDING, STATUS.ACCEPTED, STATUS.REJECTED].indexOf(status) < 0) fail_('Estado no válido.');
  const r = findRow_(x => x[COL['ID']] === id) || fail_('Inscripción no encontrada.');
  const prev = r.values[COL['Estado']];
  r.set('Estado', status);
  if (prev !== status) r.set('Respuesta enviada', ''); // si cambias de opinión, se vuelve a notificar
  if (note !== undefined) r.set('Notas', clean_(note, 500));
  return { ok: true };
}

function sendThanks_() {
  let sent = 0;
  eachRow_(r => {
    if (r.values[COL['Gracias enviado']]) return;
    sendThanksMail_(rowObj_(r.values));
    r.set('Gracias enviado', new Date());
    sent++;
  });
  return { ok: true, sent };
}

function sendReplies_() {
  const t0 = Date.now();
  let sent = 0, remaining = 0;
  eachRow_(r => {
    const o = rowObj_(r.values);
    if (o.respuesta || (o.estado !== STATUS.ACCEPTED && o.estado !== STATUS.REJECTED)) return;
    if (sent >= CFG.SEND_BATCH || Date.now() - t0 > 4.5 * 60 * 1000) { remaining++; return; }
    if (o.estado === STATUS.ACCEPTED) sendAcceptedMail_(o); else sendRejectedMail_(o);
    r.set('Respuesta enviada', new Date());
    sent++;
  });
  return { ok: true, sent, remaining };
}

function resend_(id) {
  const r = findRow_(x => x[COL['ID']] === id) || fail_('Inscripción no encontrada.');
  const o = rowObj_(r.values);
  if (o.estado === STATUS.ACCEPTED) sendAcceptedMail_(o);
  else if (o.estado === STATUS.REJECTED) sendRejectedMail_(o);
  else sendThanksMail_(o);
  r.set(o.estado === STATUS.PENDING ? 'Gracias enviado' : 'Respuesta enviada', new Date());
  return { ok: true };
}

function pdfFor_(id) {
  const r = findRow_(x => x[COL['ID']] === id) || fail_('Inscripción no encontrada.');
  const blob = buildPdf_(rowObj_(r.values));
  return { ok: true, name: blob.getName(), base64: Utilities.base64Encode(blob.getBytes()) };
}

/* =========================================================
   CHECK-IN
   ========================================================= */
function checkin_(token, id, undo) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const r = findRow_(x => (token && x[COL['Token QR']] === token) || (id && x[COL['ID']] === id));
    if (!r) return { ok: true, result: 'invalid', message: 'QR no reconocido.' };
    const o = rowObj_(r.values);
    const person = publicPerson_(o);
    if (o.estado !== STATUS.ACCEPTED) {
      return { ok: true, result: 'not_accepted', person, message: 'Inscripción en estado: ' + o.estado };
    }
    if (undo) { r.set('Check-in', ''); person.checkin = ''; return { ok: true, result: 'undone', person }; }
    if (o.checkin) return { ok: true, result: 'already', person, message: 'Ya registrado a las ' + fmtTime_(o.checkin) };
    const now = new Date();
    r.set('Check-in', now);
    person.checkin = now.toISOString();
    return { ok: true, result: 'ok', person };
  } finally {
    lock.releaseLock();
  }
}

function attendance_() {
  const items = data_(sheet_()).map(rowObj_).filter(o => o.estado === STATUS.ACCEPTED).map(publicPerson_);
  return { ok: true, items, total: items.length, present: items.filter(i => i.checkin).length };
}

function publicPerson_(o) {
  return {
    id: o.id, nombre: o.nombre, apellido: o.apellido, marca: o.marca, modelo: o.modelo,
    matricula: o.matricula, instagram: o.instagram, email: o.email, estado: o.estado,
    checkin: o.checkin ? new Date(o.checkin).toISOString() : '', foto: (o.fotos[0] || '')
  };
}

/* =========================================================
   CORREOS
   ========================================================= */
function sendThanksMail_(o) {
  const html = mailLayout_(
    '¡Inscripción recibida!',
    `<p>Hola ${esc_(o.nombre)},</p>
     <p>Gracias por inscribir tu <b>${esc_(o.marca)} ${esc_(o.modelo)}</b> (${esc_(o.matricula)}) en la
     <b>${CFG.EVENT_NAME}</b>, el <b>${CFG.EVENT_DATE}</b> en ${CFG.EVENT_PLACE}.</p>
     <p>Las plazas de exposición son limitadas, así que vamos a revisar todas las solicitudes y las fotos con calma.
     <b>Muy pronto te escribiremos para decirte si tu coche ha sido seleccionado.</b></p>
     <p>Mientras tanto, síguenos en Instagram para no perderte ninguna novedad del evento.</p>`,
    { label: 'VER EL EVENTO', url: CFG.EVENT_URL }
  );
  mail_(o.email, 'Inscripción recibida · ' + CFG.EVENT_NAME, html);
}

function sendAcceptedMail_(o) {
  const pdf = buildPdf_(o);
  const qr = qrBlob_(o.token).setName('qr.png');
  const html = mailLayout_(
    '¡Tu coche está dentro! 🏁',
    `<p>Hola ${esc_(o.nombre)},</p>
     <p>Enhorabuena: tu <b>${esc_(o.marca)} ${esc_(o.modelo)}</b> (${esc_(o.matricula)}) ha sido <b>seleccionado</b>
     para exponer en la <b>${CFG.EVENT_NAME}</b>.</p>
     <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;width:100%;background:#111;border:1px solid #2a2a2a;border-radius:16px">
       <tr><td style="padding:18px 20px;color:#ddd;font-size:15px;line-height:1.7">
         📅 <b style="color:#fff">${CFG.EVENT_DATE}</b><br>
         📍 <b style="color:#fff">${CFG.EVENT_PLACE}</b><br>
         🎟️ Acceso: <b style="color:#fff">${esc_(o.id)}</b>
       </td></tr>
     </table>
     <p><b>IMPORTANTE:</b> te adjuntamos un PDF con tu acreditación. <b>Imprímelo y colócalo en el salpicadero</b>
     (lado del copiloto). En la entrada escanearemos el código QR para darte acceso a la zona de exposición.</p>
     <p style="text-align:center;margin:24px 0"><img src="cid:qr" width="200" height="200" alt="Código QR de acceso"
       style="background:#fff;padding:10px;border-radius:12px"></p>
     <p>Si no puedes imprimirlo, enséñanos el QR desde el móvil. Y si al final no puedes venir, respóndenos a este
     correo para liberar la plaza.</p>
     <p>Ese día también podrás rodar en pista: si te apetece hacer tandas, el circuito estará abierto para todo el que quiera.</p>`,
    { label: 'INFO DEL EVENTO', url: CFG.EVENT_URL }
  );
  mail_(o.email, '✅ Aceptado · ' + CFG.EVENT_NAME, html, { attachments: [pdf], inlineImages: { qr: qr } });
}

function sendRejectedMail_(o) {
  const html = mailLayout_(
    'Gracias por tu inscripción',
    `<p>Hola ${esc_(o.nombre)},</p>
     <p>Hemos recibido muchísimas solicitudes para la <b>${CFG.EVENT_NAME}</b> y el espacio de exposición es limitado.
     Esta vez tu ${esc_(o.marca)} ${esc_(o.modelo)} no ha entrado en la selección de la expo.</p>
     <p>Aun así, <b>nos encantaría verte allí</b>: el ${CFG.EVENT_DATE} puedes venir a disfrutar del ambiente y,
     si quieres, <b>rodar en pista haciendo tandas</b> en el circuito.</p>
     <p>Seguiremos organizando KDDs, rutas y eventos: estate atento a nuestro Instagram.</p>`,
    { label: 'VER EL EVENTO', url: CFG.EVENT_URL }
  );
  mail_(o.email, CFG.EVENT_NAME + ' · Respuesta a tu inscripción', html);
}

function mail_(to, subject, html, extra) {
  const opts = Object.assign({ htmlBody: html, name: CFG.SENDER_NAME }, extra || {});
  if (CFG.REPLY_TO) opts.replyTo = CFG.REPLY_TO;
  if (CFG.FROM && GmailApp.getAliases().indexOf(CFG.FROM) >= 0) opts.from = CFG.FROM;
  GmailApp.sendEmail(to, subject, stripHtml_(html), opts);
}

function mailLayout_(title, inner, cta) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#050505;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050505"><tr><td align="center" style="padding:28px 12px">
   <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#0d0d0d;border:1px solid #222;border-radius:24px">
    <tr><td style="padding:30px 30px 6px;text-align:center">
      <img src="${CFG.LOGO_WHITE}" alt="Dub Edition VLC" width="220" style="max-width:220px;height:auto">
      <p style="margin:18px 0 0;color:#9a9a9a;font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:bold">${CFG.EVENT_NAME} · ${CFG.EVENT_DATE_SHORT}</p>
    </td></tr>
    <tr><td style="padding:10px 30px 4px"><h1 style="margin:10px 0 6px;color:#fff;font-size:28px;line-height:1.15">${title}</h1></td></tr>
    <tr><td style="padding:0 30px;color:#cfcfcf;font-size:15px;line-height:1.7">${inner}</td></tr>
    ${cta ? `<tr><td align="center" style="padding:14px 30px 30px"><a href="${cta.url}" style="display:inline-block;background:#fff;color:#000;text-decoration:none;font-weight:bold;font-size:13px;letter-spacing:1.5px;padding:15px 26px;border-radius:999px">${cta.label}</a></td></tr>` : ''}
    <tr><td style="padding:20px 30px;border-top:1px solid #222;text-align:center;color:#777;font-size:12px;line-height:1.6">
      Dub Edition VLC · <a href="${CFG.INSTAGRAM}" style="color:#bbb">@dubeditionvlc</a> · #seguimosenlonuestro<br>
      Recibes este correo porque te inscribiste en ${CFG.EVENT_URL.replace('https://', '')}
    </td></tr>
   </table>
  </td></tr></table></body></html>`;
}

/* =========================================================
   PDF + QR
   ========================================================= */
function qrBlob_(token) {
  const data = encodeURIComponent(CFG.CHECKIN_URL + token);
  const urls = [
    'https://quickchart.io/qr?size=600&margin=2&ecLevel=M&format=png&text=' + data,
    'https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=10&ecc=M&format=png&data=' + data
  ];
  for (const u of urls) {
    try {
      const res = UrlFetchApp.fetch(u, { muteHttpExceptions: true });
      if (res.getResponseCode() === 200) return res.getBlob().setContentType('image/png');
    } catch (err) {}
  }
  throw new Error('No se pudo generar el QR (servicio externo no disponible).');
}

function logoDataUri_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('logo_b64');
  if (hit) return 'data:image/png;base64,' + hit;
  const b64 = Utilities.base64Encode(UrlFetchApp.fetch(CFG.LOGO_BLACK).getBlob().getBytes());
  if (b64.length < 90000) cache.put('logo_b64', b64, 21600);
  return 'data:image/png;base64,' + b64;
}

function buildPdf_(o) {
  const qr = 'data:image/png;base64,' + Utilities.base64Encode(qrBlob_(o.token).getBytes());
  const html = `<html><head><meta charset="utf-8"><style>
    @page{size:A4;margin:14mm}
    body{font-family:Arial,Helvetica,sans-serif;color:#000;margin:0}
    .top{text-align:center;border-bottom:3px solid #000;padding-bottom:10px}
    .tag{font-size:11px;letter-spacing:4px;text-transform:uppercase;font-weight:bold;color:#444;margin:8px 0 0}
    .pass{margin:14px auto 0;text-align:center;background:#000;color:#fff;font-size:15px;letter-spacing:6px;font-weight:bold;padding:9px 0}
    .plate{margin:22px auto 0;width:86%;border:5px solid #000;border-radius:14px;text-align:center;font-size:74px;font-weight:bold;letter-spacing:6px;padding:14px 0}
    .name{text-align:center;font-size:34px;font-weight:bold;margin:20px 0 4px;text-transform:uppercase}
    .car{text-align:center;font-size:20px;color:#333;margin:0}
    .qr{text-align:center;margin:20px 0 6px}
    .id{text-align:center;font-size:14px;letter-spacing:3px;font-weight:bold}
    .foot{margin-top:16px;border-top:3px solid #000;padding-top:10px;text-align:center;font-size:12px;color:#333;line-height:1.6}
  </style></head><body>
    <div class="top">
      <img src="${logoDataUri_()}" style="width:300px">
      <p class="tag">${CFG.EVENT_NAME} · ${CFG.EVENT_DATE_SHORT}</p>
    </div>
    <div class="pass">EXPOSITOR · ACCESO EXPO</div>
    <div class="plate">${esc_(o.matricula)}</div>
    <p class="name">${esc_(o.nombre)} ${esc_(o.apellido)}</p>
    <p class="car">${esc_(o.marca)} ${esc_(o.modelo)}${o.instagram ? ' · ' + esc_(o.instagram) : ''}</p>
    <div class="qr"><img src="${qr}" style="width:250px;height:250px"></div>
    <p class="id">${esc_(o.id)}</p>
    <div class="foot">${CFG.EVENT_DATE} · ${CFG.EVENT_PLACE}<br>
      Coloca esta hoja en el salpicadero (lado copiloto) y enséñala en la entrada. Acreditación personal e intransferible.</div>
  </body></html>`;
  return Utilities.newBlob(html, 'text/html', 'acreditacion.html')
    .getAs('application/pdf')
    .setName('Acreditacion-Expo-Aspar-' + o.matricula.replace(/[^A-Z0-9]/gi, '') + '.pdf');
}

/* =========================================================
   UTILIDADES
   ========================================================= */
function sheet_() { return SpreadsheetApp.openById(prop_('SHEET_ID')).getSheetByName(CFG.SHEET_NAME); }
function prop_(k) {
  const v = PropertiesService.getScriptProperties().getProperty(k);
  if (!v) throw new Error('Falta configurar ' + k + '. Ejecuta setup() en el editor de Apps Script.');
  return v;
}
function data_(sh) {
  const n = sh.getLastRow() - 1;
  return n > 0 ? sh.getRange(2, 1, n, HEADERS.length).getValues() : [];
}
function eachRow_(fn) {
  const sh = sheet_();
  data_(sh).forEach((values, i) => fn(rowRef_(sh, i + 2, values)));
}
function findRow_(pred) {
  const sh = sheet_();
  const rows = data_(sh);
  for (let i = 0; i < rows.length; i++) if (pred(rows[i])) return rowRef_(sh, i + 2, rows[i]);
  return null;
}
function rowRef_(sh, rowNum, values) {
  return {
    values,
    set(col, val) { sh.getRange(rowNum, COL[col] + 1).setValue(val); values[COL[col]] = val; }
  };
}
function rowObj_(r) {
  const iso = v => (v instanceof Date ? v.toISOString() : (v || ''));
  return {
    id: r[COL['ID']], fecha: iso(r[COL['Fecha inscripción']]), estado: r[COL['Estado']] || STATUS.PENDING,
    email: r[COL['Email']], nombre: r[COL['Nombre']], apellido: r[COL['Apellido']],
    marca: r[COL['Marca']], modelo: r[COL['Modelo']], matricula: String(r[COL['Matrícula']]),
    instagram: r[COL['Instagram']], descripcion: r[COL['Descripción']], tandas: r[COL['Interés tandas']],
    fotos: String(r[COL['Fotos (IDs)']] || '').split(',').filter(Boolean), carpeta: r[COL['Carpeta fotos']],
    token: r[COL['Token QR']], gracias: iso(r[COL['Gracias enviado']]), respuesta: iso(r[COL['Respuesta enviada']]),
    checkin: iso(r[COL['Check-in']]), notas: r[COL['Notas']]
  };
}
function role_(key) {
  if (!key) return null;
  const p = PropertiesService.getScriptProperties();
  if (key === p.getProperty('ADMIN_KEY')) return 'admin';
  if (key === p.getProperty('STAFF_KEY')) return 'staff';
  return null;
}
function requireRole_(key, needed) {
  const r = role_(key);
  if (!r || (needed === 'admin' && r !== 'admin')) fail_('Acceso no autorizado.');
}
function fail_(msg) { throw new Error(msg); }
function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function clean_(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max); }
function normalizeIg_(v) { v = v.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[/?].*$/, '').replace(/^@+/, ''); return v ? '@' + v : ''; }
function esc_(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function stripHtml_(h) { return h.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<br\s*\/?>/g, '\n').replace(/<\/p>/g, '\n\n').replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim(); }
function fmtTime_(v) { return Utilities.formatDate(new Date(v), 'Europe/Madrid', 'HH:mm'); }
function randomKey_(n) {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
