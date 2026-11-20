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
  EVENT_ARRIVAL: '9:00 – 10:00',  // entrada de coches a la expo
  EVENT_AWARDS: '13:30',          // entrega de premios
  EVENT_URL: 'https://dubedition.es/eventos/expo-aspar-circuit/',
  CHECKIN_URL: 'https://dubedition.es/eventos/expo-aspar-circuit/checkin/?t=',
  LOGO_BLACK: 'https://dubedition.es/assets/dub-edition-logo-black-sm.png',
  LOGO_MAIL: 'https://dubedition.es/assets/dub-edition-logo-mail.png',   // logo con fondo blanco sólido (aguanta el modo oscuro)
  INSTAGRAM: 'https://www.instagram.com/dubeditionvlc',
  SENDER_NAME: 'Dub Edition VLC',
  FROM: 'info@dubedition.es',     // remitente si está añadido en Gmail como alias "Enviar como"; si no, se usa la cuenta propietaria
  REPLY_TO: 'info@dubedition.es', // las respuestas de los inscritos llegan aquí
  REQUIRE_FROM: true,             // true = no envía nada si FROM no está configurado (nunca muestra la cuenta propietaria)
  SHEET_ID: '1Q659YDYRJJdrC7A6kpNdG-85cJ5WQKyif9II40DnQA0', // hoja de inscripciones
  SHEET_NAME: 'Inscripciones',
  FOLDER_NAME: 'DUB EDITION · Expo Aspar 21-11 · Fotos',
  AUTO_THANKS: true,         // envía el correo de "gracias por inscribirte" al recibir el formulario
  MAX_PHOTOS: 5,
  MAX_PHOTO_BYTES: 4 * 1024 * 1024,
  SEND_BATCH: 20,            // correos con PDF por llamada (evita el límite de 6 min)
  EXPO_SPOTS: 60,
  MAP_IMG: 'https://dubedition.es/assets/mail/plano-expo-aspar.jpg',
  MAPS_URL: 'https://maps.app.goo.gl/pXrFuxaSXsFm1w6R7',
  ADDRESS: 'Polígono 28, Parcela 26 · 46610 Guadassuar (Valencia)',
  TOTAL_SIGNUPS_TEXT: 'más de 400 coches',   // texto del correo de agradecimiento a no seleccionados
  REG_DEADLINE: '2026-11-19T21:00:00+01:00',   // cierre de inscripciones (hora de Madrid)            // plazas de la expo (se menciona en el correo de no seleccionado)
  // Open Track Day del circuito (se reserva y se paga con Aspar Circuit, no con nosotros)
  TRACKDAY_BOOK_URL: 'https://booking.prod.pixelcom.io/event/253B12041CF03725783D697150F940DB/register',
  TRACKDAY_INFO_URL: 'https://asparcircuit.com/particulares/track-day-de-coches/',
  TRACKDAY_HOURS: '9:00 – 13:00 y 14:00 – 17:00',
  TRACKDAY_PRICE: '99 € reservando online (119 € pagando en recepción el mismo día)',
  ASPAR_PHONE: '+34 96 311 51 55',
  ASPAR_WHATSAPP: '+34 663 56 78 72',
  ASPAR_EMAIL: 'reservas@asparcircuit.com'
};
const TANDAS_YES = ['Sí', 'Puede'];   // respuestas del formulario que reciben la info de tandas

const STATUS = { PENDING: 'Pendiente', ACCEPTED: 'Aceptado', REJECTED: 'Rechazado' };

const HEADERS = [
  'ID', 'Fecha inscripción', 'Estado', 'Email', 'Nombre', 'Apellido', 'Marca', 'Modelo',
  'Matrícula', 'Instagram', 'Descripción', 'Interés tandas', 'Fotos (IDs)', 'Carpeta fotos',
  'Token QR', 'Gracias enviado', 'Respuesta enviada', 'Check-in', 'Notas', 'Info tandas enviada', 'Agradecimiento enviado', 'Info día enviada'
];
const COL = HEADERS.reduce((o, h, i) => (o[h] = i, o), {});

/* =========================================================
   SETUP (ejecutar una vez desde el editor)
   ========================================================= */
function setup() {
  const props = PropertiesService.getScriptProperties();
  const ss = SpreadsheetApp.getActiveSpreadsheet() || (CFG.SHEET_ID && SpreadsheetApp.openById(CFG.SHEET_ID));
  if (!ss) throw new Error('Crea el script desde la Hoja de cálculo (Extensiones → Apps Script) o rellena CFG.SHEET_ID.');
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
    .addItem('Enviar info de tandas', 'menuTandas_')
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
function menuTandas_() {
  let total = 0, r;
  do { r = sendTandas_(); total += r.sent; } while (r.remaining > 0 && r.sent > 0);
  SpreadsheetApp.getUi().alert('Info de tandas enviada: ' + total + (r.remaining ? ' · Quedan ' + r.remaining : ''));
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
      case 'sendTandas': requireRole_(body.key, 'admin'); return json_(sendTandas_(body.id));
      case 'sendDayInfo': requireRole_(body.key, 'admin'); return json_(sendDayInfo_(body.id));
      case 'sendRejectedThanks': requireRole_(body.key, 'admin'); return json_(sendRejectedThanks_());
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
  if (CFG.REG_DEADLINE && Date.now() >= new Date(CFG.REG_DEADLINE).getTime())
    return { ok: false, error: 'Las inscripciones para la expo ya están cerradas. ¡Te esperamos el sábado! La entrada es gratis.' };
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
  ensureHeaders_();
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
      gracias: r.gracias, respuesta: r.respuesta, checkin: r.checkin, notas: r.notas, infoTandas: r.infoTandas
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
  checkSender_();
  eachRow_(r => {
    if (r.values[COL['Gracias enviado']]) return;
    sendThanksMail_(rowObj_(r.values));
    r.set('Gracias enviado', new Date());
    sent++;
  });
  return { ok: true, sent };
}

function checkSender_() {
  if (CFG.REQUIRE_FROM && GmailApp.getAliases().indexOf(CFG.FROM) < 0) {
    fail_('No se envía nada: falta configurar ' + CFG.FROM + ' en Gmail (Configuración → Cuentas → Enviar como).');
  }
}

function sendReplies_() {
  checkSender_();
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
  checkSender_();
  const r = findRow_(x => x[COL['ID']] === id) || fail_('Inscripción no encontrada.');
  const o = rowObj_(r.values);
  if (o.estado === STATUS.ACCEPTED) sendAcceptedMail_(o);
  else if (o.estado === STATUS.REJECTED) sendRejectedMail_(o);
  else sendThanksMail_(o);
  r.set(o.estado === STATUS.PENDING ? 'Gracias enviado' : 'Respuesta enviada', new Date());
  return { ok: true };
}

/** Info de tandas: a todos los que marcaron Sí / Puede (sin importar si están aceptados en la expo).
 *  Sin id → envío masivo a los que aún no la tienen. Con id → (re)envío a esa persona. */
function sendTandas_(id) {
  checkSender_();
  ensureHeaders_();
  if (id) {
    const r = findRow_(x => x[COL['ID']] === id) || fail_('Inscripción no encontrada.');
    sendTandasMail_(rowObj_(r.values));
    r.set('Info tandas enviada', new Date());
    return { ok: true, sent: 1, remaining: 0 };
  }
  const t0 = Date.now();
  let sent = 0, remaining = 0;
  eachRow_(r => {
    const o = rowObj_(r.values);
    if (o.infoTandas || TANDAS_YES.indexOf(String(o.tandas)) < 0) return;
    if (sent >= 40 || Date.now() - t0 > 4.5 * 60 * 1000) { remaining++; return; }
    sendTandasMail_(o);
    r.set('Info tandas enviada', new Date());
    sent++;
  });
  return { ok: true, sent, remaining };
}

/** Agradecimiento + invitación a todos los Rechazados que aún no lo han recibido (una sola vez por persona). */
function sendRejectedThanks_() {
  checkSender_();
  ensureHeaders_();
  const t0 = Date.now();
  let sent = 0, remaining = 0, failed = [];
  eachRow_(r => {
    const o = rowObj_(r.values);
    if (o.estado !== STATUS.REJECTED || r.values[COL['Agradecimiento enviado']]) return;
    if (sent >= 40 || Date.now() - t0 > 4.5 * 60 * 1000) { remaining++; return; }
    try { sendRejectedThanksMail_(o); r.set('Agradecimiento enviado', new Date()); sent++; }
    catch (e) { failed.push(o.id + ': ' + e.message); }
  });
  return { ok: true, sent, remaining, failed };
}

/** Añade a la hoja las columnas nuevas si aún no están (no mueve las existentes). */
function ensureHeaders_() {
  const sh = sheet_();
  const cur = sh.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  HEADERS.forEach((h, i) => {
    if (cur[i] !== h) sh.getRange(1, i + 1).setValue(h).setFontWeight('bold').setBackground('#000000').setFontColor('#ffffff');
  });
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
     <p>Para que lo vayas apuntando: la entrada de coches a la expo será de ${CFG.EVENT_ARRIVAL} y la entrega de premios, a las ${CFG.EVENT_AWARDS}.</p>
     <p>Mientras tanto, síguenos en Instagram para no perderte ninguna novedad del evento.</p>`,
    { label: 'VER EL EVENTO', url: CFG.EVENT_URL }
  );
  mail_(o.email, 'Inscripción recibida · ' + CFG.EVENT_NAME, html);
}

function sendAcceptedMail_(o) {
  const pdf = buildPdf_(o);
  const qr = qrBlob_(o.token).setName('qr.png');
  const html = mailLayout_(
    '¡Tu coche está dentro!',
    `<p>Hola ${esc_(o.nombre)},</p>
     <p>Enhorabuena: tu <b>${esc_(o.marca)} ${esc_(o.modelo)}</b> (${esc_(o.matricula)}) ha sido <b>seleccionado</b>
     para exponer en la <b>${CFG.EVENT_NAME}</b>.</p>
     <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;width:100%;background:#f6f6f6;border:1px solid #e6e6e6;border-radius:14px">
       <tr><td style="padding:16px 20px;color:#333333;font-size:15px;line-height:1.8">
         <span style="color:#888888;font-size:12px;text-transform:uppercase;letter-spacing:1px">Fecha</span><br><b style="color:#111111">${CFG.EVENT_DATE}</b><br>
         <span style="color:#888888;font-size:12px;text-transform:uppercase;letter-spacing:1px">Lugar</span><br><b style="color:#111111">${CFG.EVENT_PLACE}</b><br>
         <span style="color:#888888;font-size:12px;text-transform:uppercase;letter-spacing:1px">Entrada de coches a la expo</span><br><b style="color:#111111">De ${CFG.EVENT_ARRIVAL}</b><br>
         <span style="color:#888888;font-size:12px;text-transform:uppercase;letter-spacing:1px">Acceso</span><br><b style="color:#111111">${esc_(o.id)} &middot; ${esc_(o.matricula)}</b>
       </td></tr>
     </table>
     <p><b>Llega entre las ${CFG.EVENT_ARRIVAL}</b>: es la franja de entrada de coches a la zona de exposición. A las ${CFG.EVENT_AWARDS} haremos la entrega de premios, ¡no te la pierdas!</p>
     <p><b>IMPORTANTE:</b> te adjuntamos un PDF con tu acreditación. <b>Imprímelo y colócalo en el salpicadero</b>
     (lado del copiloto). En la entrada escanearemos el código QR para darte acceso a la zona de exposición.</p>
     <p style="text-align:center;margin:24px 0"><img src="cid:qr" width="200" height="200" alt="Código QR de acceso"
       style="background:#ffffff;padding:10px;border:1px solid #e6e6e6;border-radius:12px"></p>
     <p>Si no puedes imprimirlo, enséñanos el QR desde el móvil. Y si al final no puedes venir, respóndenos a este
     correo para liberar la plaza.</p>
     <p>Ese día también hay <b>Open Track Day</b> (${CFG.TRACKDAY_HOURS}): si quieres rodar, la reserva se hace directamente con Aspar Circuit en <a href="${CFG.TRACKDAY_INFO_URL}" style="color:#111111">su web</a>.</p>`,
    { label: 'INFO DEL EVENTO', url: CFG.EVENT_URL }
  );
  mail_(o.email, 'Aceptado · ' + CFG.EVENT_NAME, html, { attachments: [pdf], inlineImages: { qr: qr } });
}

function sendRejectedMail_(o) {
  const html = mailLayout_(
    'Esta vez no has sido seleccionado',
    `<p>Hola ${esc_(o.nombre)},</p>
     <p>Gracias de corazón por inscribir tu <b>${esc_(o.marca)} ${esc_(o.modelo)}</b> en la <b>${CFG.EVENT_NAME}</b>.</p>
     <p>Hemos recibido <b>muchísimas inscripciones</b> y la expo es solo para <b>${CFG.EXPO_SPOTS} coches</b>, así que nos ha tocado
     elegir y esta vez tu coche no ha entrado en la selección. Es una pena no poder cogeros a todos: había un nivelazo.</p>
     <p><b>Igualmente te esperamos en el evento para pasar un día genial.</b> Ven a ver la expo, disfrutar del ambiente
     de circuito y, si quieres, almorzar en el restaurante del circuito con vistas a la pista.</p>
     <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;width:100%;background:#f6f6f6;border:1px solid #e6e6e6;border-radius:14px">
       <tr><td style="padding:16px 20px;color:#333333;font-size:15px;line-height:1.8">
         <span style="color:#888888;font-size:12px;text-transform:uppercase;letter-spacing:1px">Cuándo</span><br><b style="color:#111111">${CFG.EVENT_DATE} &middot; desde las 9:00</b><br>
         <span style="color:#888888;font-size:12px;text-transform:uppercase;letter-spacing:1px">Dónde</span><br><b style="color:#111111">${CFG.EVENT_PLACE}</b><br>
         <span style="color:#888888;font-size:12px;text-transform:uppercase;letter-spacing:1px">Entrega de premios</span><br><b style="color:#111111">${CFG.EVENT_AWARDS}</b>
       </td></tr>
     </table>
     <p>Y si te apetece rodar, ese día hay <b>Open Track Day</b> (${CFG.TRACKDAY_HOURS}). La reserva se hace directamente con
     Aspar Circuit en <a href="${CFG.TRACKDAY_INFO_URL}" style="color:#111111">su web</a>.</p>
     <p>Seguiremos organizando KDDs, rutas y eventos, así que estate atento a nuestro Instagram: habrá más ocasiones.</p>
     <p>¡Nos vemos el sábado!</p>`,
    { label: 'VER EL EVENTO', url: CFG.EVENT_URL }
  );
  mail_(o.email, 'Respuesta a tu inscripción · ' + CFG.EVENT_NAME, html);
}

/** Segundo aviso a los no seleccionados: agradecimiento + invitación al evento (se envía desde el panel). */
function sendRejectedThanksMail_(o) {
  const row = (k, v) => `<tr><td style="padding:7px 0;color:#888888;font-size:13px;width:92px;vertical-align:top"><b style="color:#111111;font-size:15px">${k}</b></td><td style="padding:7px 0;color:#333333;font-size:15px">${v}</td></tr>`;
  const html = mailLayout_(
    'Gracias por inscribirte',
    `<p>Hola ${esc_(o.nombre)},</p>
     <p>Queremos darte las gracias por inscribir tu <b>${esc_(o.marca)} ${esc_(o.modelo)}</b> en la <b>${CFG.EVENT_NAME}</b>.</p>
     <p>Habéis sido <b>${CFG.TOTAL_SIGNUPS_TEXT}</b> y solo teníamos <b>${CFG.EXPO_SPOTS} plazas</b> para la expo, así que es una pena
     no haberos podido coger a todos. De verdad, gracias por el apoyo: no esperábamos una respuesta así.</p>
     <p><b>Igualmente, te invitamos a pasar un día genial con nosotros en el Aspar Circuit.</b> La entrada para el público es
     <b>gratis</b>: ven con tu coche, tus amigos o tu familia a ver la expo, el track day y la entrega de premios.</p>
     <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;width:100%;background:#f6f6f6;border:1px solid #e6e6e6;border-radius:14px">
       <tr><td style="padding:14px 20px">
         <p style="margin:0 0 6px;color:#888888;font-size:12px;text-transform:uppercase;letter-spacing:1px">${CFG.EVENT_DATE} · ${CFG.EVENT_PLACE}</p>
         <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%">
           ${row('9:00', 'Arranca la expo de Dub Edition y el Open Track Day')}
           ${row('9:00', 'Almuerzos en el restaurante del circuito, con vistas a la pista (hasta las 11:30)')}
           ${row('13:30', 'Entrega de premios a los mejores coches de la expo')}
           ${row('14:00', 'Sesión de tarde: vuelven las tandas a pista')}
           ${row('17:00', 'Fin de la actividad')}
         </table>
       </td></tr>
     </table>
     <p>¿Te apetece rodar? El <b>Open Track Day</b> se reserva directamente con Aspar Circuit en
     <a href="${CFG.TRACKDAY_INFO_URL}" style="color:#111111">su web</a> (${CFG.TRACKDAY_PRICE}).</p>
     <p>Seguiremos organizando KDDs, rutas y eventos, así que estate atento a nuestro Instagram: habrá más ocasiones de ver tu coche con nosotros.</p>
     <p>¡Nos vemos el sábado!</p>`,
    { label: 'VER EL EVENTO', url: CFG.EVENT_URL }
  );
  mail_(o.email, 'Gracias por inscribirte · Te esperamos el sábado en Aspar Circuit', html);
}

/* =========================================================
   CORREO "TODO SOBRE EL DÍA" (aceptados)
   ========================================================= */
function sendDayInfo_(id) {
  checkSender_();
  ensureHeaders_();
  if (id) {
    const r = findRow_(x => x[COL['ID']] === id) || fail_('Inscripción no encontrada.');
    sendDayInfoMail_(rowObj_(r.values)); r.set('Info día enviada', new Date());
    return { ok: true, sent: 1, remaining: 0, failed: [] };
  }
  const t0 = Date.now();
  let sent = 0, remaining = 0; const failed = [];
  eachRow_(r => {
    const o = rowObj_(r.values);
    if (o.estado !== STATUS.ACCEPTED || r.values[COL['Info día enviada']]) return;
    if (sent >= CFG.SEND_BATCH || Date.now() - t0 > 4.5 * 60 * 1000) { remaining++; return; }
    try { sendDayInfoMail_(o); r.set('Info día enviada', new Date()); sent++; }
    catch (e) { failed.push(o.id + ': ' + e.message); }
  });
  return { ok: true, sent, remaining, failed };
}

function sendDayInfoMail_(o) {
  const H = (t, sub) => `<h2 style="margin:30px 0 4px;color:#111111;font-size:19px;line-height:1.25;text-transform:uppercase;letter-spacing:.5px">${t}</h2>${sub ? `<p style="margin:0 0 12px;color:#777777;font-size:13px">${sub}</p>` : ''}`;
  const tag = (txt, bg, fg) => `<span style="display:inline-block;background:${bg};color:${fg || '#111111'};font-size:10px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;padding:3px 8px;border-radius:999px;white-space:nowrap">${txt}</span>`;
  const EXPO = tag('Expo', '#ffcf3d'), TD = tag('Track day', '#ff7a1a', '#ffffff'), REST = tag('Restaurante', '#e9e9e9');
  const step = (h, title, desc, t, hi) => `<tr>
      <td style="padding:10px 12px;border-bottom:1px solid #eeeeee;${hi ? 'background:#fff8e1;' : ''}width:78px;vertical-align:top"><b style="font-size:18px;color:#111111">${h}</b></td>
      <td style="padding:10px 12px 10px 0;border-bottom:1px solid #eeeeee;${hi ? 'background:#fff8e1;' : ''}vertical-align:top"><b style="color:#111111;font-size:14px">${title}</b><br><span style="color:#666666;font-size:13px">${desc}</span></td>
      <td style="padding:10px 12px 10px 0;border-bottom:1px solid #eeeeee;${hi ? 'background:#fff8e1;' : ''}vertical-align:top;text-align:right">${t}</td></tr>`;
  const zone = (color, name, desc) => `<tr><td style="padding:5px 10px 5px 0;vertical-align:top;width:18px"><span style="display:inline-block;width:14px;height:14px;border-radius:4px;background:${color};border:1px solid rgba(0,0,0,.12)"></span></td><td style="padding:4px 0;font-size:14px;color:#333333"><b style="color:#111111">${name}</b> &middot; ${desc}</td></tr>`;
  const box = (inner, bg) => `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:10px 0;background:${bg || '#f6f6f6'};border:1px solid #e6e6e6;border-radius:14px"><tr><td style="padding:16px 18px;font-size:14px;line-height:1.6;color:#333333">${inner}</td></tr></table>`;

  const html = mailLayout_(
    'Mañana nos vemos en el Aspar Circuit',
    `<p>Hola ${esc_(o.nombre)},</p>
     <p>¡Ya está aquí! Mañana tu <b>${esc_(o.marca)} ${esc_(o.modelo)}</b> forma parte de la <b>${CFG.EVENT_NAME}</b>.
     Te dejamos todo lo que necesitas saber para que el día salga redondo.</p>

     ${box(`<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%"><tr>
       <td style="vertical-align:top;font-size:14px;color:#333333">
         <span style="color:#888888;font-size:11px;letter-spacing:1px;text-transform:uppercase">Tu acreditación</span><br>
         <b style="color:#111111;font-size:17px">${esc_(o.nombre)} ${esc_(o.apellido)}</b><br>
         ${esc_(o.marca)} ${esc_(o.modelo)} &middot; <b style="color:#111111">${esc_(o.matricula)}</b> &middot; ${esc_(o.id)}
       </td>
       <td style="vertical-align:top;text-align:right;white-space:nowrap"><span style="display:inline-block;background:#111111;color:#ffffff;font-size:11px;font-weight:bold;letter-spacing:1px;padding:6px 12px;border-radius:999px">EXPOSITOR</span></td>
     </tr></table>
     <p style="margin:10px 0 0">Te adjuntamos de nuevo tu <b>acreditación en PDF con el QR</b>. Llévala <b>impresa y visible en el salpicadero</b>
     (o en el móvil): el staff la escaneará en la entrada.</p>`, '#fff8e1')}

     ${H('Llegada de los coches de la expo', 'Respeta la franja para que podamos colocar todos los coches a tiempo')}
     ${box(`<b style="font-size:26px;color:#111111">${CFG.EVENT_ARRIVAL}</b><br>
       Entra por la <b>ENTRADA</b> del recinto, enseña tu QR y sigue las indicaciones del staff hasta la <b>zona Expo</b>.
       Ven con el coche limpio y listo para exponer: la entrega de premios es a las <b>${CFG.EVENT_AWARDS}</b>.`)}

     ${H('Cómo llegar')}
     <p style="margin:6px 0">1. Por la <b>CV-525</b> (Alginet &ndash; Algemesí) hasta la <b>rotonda de la CV-522</b>.<br>
     2. Sigue el camino que <b>bordea el circuito</b>.<br>
     3. Entra por la <b>ENTRADA</b> (en rojo en el plano).</p>
     <p style="margin:6px 0;color:#666666;font-size:13px">${CFG.ADDRESS}</p>
     <p style="margin:12px 0 4px"><a href="${CFG.MAPS_URL}" style="display:inline-block;background:#ffffff;color:#111111;border:2px solid #111111;text-decoration:none;font-weight:bold;font-size:12px;letter-spacing:1.2px;padding:11px 20px;border-radius:999px">ABRIR EN GOOGLE MAPS</a></p>

     ${H('Plano del recinto')}
     <a href="${CFG.MAP_IMG}"><img src="${CFG.MAP_IMG}" alt="Plano del recinto: entrada, zona expo, parkings y stands" width="540" style="display:block;width:100%;max-width:540px;height:auto;border-radius:14px;border:1px solid #e6e6e6;margin:10px 0"></a>
     <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:6px 0 0">
       ${zone('#ff3b30', 'Entrada', 'acceso único para todos los vehículos')}
       ${zone('#ffcc00', 'Expo', 'aquí colocamos tu coche')}
       ${zone('#34c759', 'Parking tandas', 'solo para participantes del track day')}
       ${zone('#f2f2f2', 'Parking público', 'para tus acompañantes y visitantes')}
       ${zone('#af52de', 'Stands', 'junto al edificio del circuito')}
       ${zone('#0a84ff', 'Parking PMR', 'personas con movilidad reducida')}
     </table>

     ${H('Horario del sábado', 'Expo Dub Edition + Open Track Day de Aspar Circuit')}
     <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e6e6e6;border-radius:14px;border-collapse:separate;overflow:hidden">
       ${step('8:00', 'Venta de tickets e inscripciones', 'Open Track Day, en recepción del circuito', TD)}
       ${step('8:45', 'Verificaciones técnicas y briefing', 'Para los pilotos del track day', TD)}
       ${step('9:00', 'Arranca todo: expo + pista', 'Entrada de coches a la expo de 9:00 a 10:00 e inicio del track day', EXPO, true)}
       ${step('9:00', 'Almuerzos con vistas a la pista', 'Restaurante y terraza del circuito, hasta las 11:30', REST)}
       ${step('13:00', 'Parada para comer', 'Pausa de la actividad en pista', TD)}
       ${step('13:30', 'Entrega de premios', 'A los mejores coches de la expo', EXPO, true)}
       ${step('14:00', 'Sesión de tarde', 'Vuelven las tandas a la pista', TD)}
       ${step('17:00', 'Fin de la actividad', 'Cierre del Open Track Day', TD)}
     </table>

     ${H('Bueno saber')}
     <ul style="margin:8px 0 0;padding-left:18px">
       <li><b>Entrada gratis para el público:</b> trae a tus amigos y familia. Ellos aparcan en el parking público.</li>
       <li><b>¿Quieres rodar?</b> El Open Track Day se reserva con Aspar Circuit en <a href="${CFG.TRACKDAY_INFO_URL}" style="color:#111111">su web</a> (${CFG.TRACKDAY_PRICE}). Casco, gancho de remolque y seguro obligatorios (el seguro se puede contratar allí por 15 €).</li>
       <li><b>Restaurante:</b> almuerzos de 9:00 a 11:30 y comidas de 12:00 a 15:30, con terraza sobre la pista.</li>
       <li><b>Comparte el día:</b> sube tus fotos y stories etiquetando a <a href="${CFG.INSTAGRAM}" style="color:#111111">@dubeditionvlc</a> con #seguimosenlonuestro.</li>
     </ul>
     <p style="margin-top:22px">Si tienes cualquier duda, responde a este correo. ¡Nos vemos mañana!</p>`,
    { label: 'VER EL EVENTO', url: CFG.EVENT_URL }
  );
  mail_(o.email, 'Mañana nos vemos · Todo sobre el día de la ' + CFG.EVENT_NAME, html, { attachments: [buildPdf_(o)] });
}

function sendTandasMail_(o) {
  const row = (k, v) => `<span style="color:#888888;font-size:12px;text-transform:uppercase;letter-spacing:1px">${k}</span><br><b style="color:#111111">${v}</b><br>`;
  const html = mailLayout_(
    'Cómo apuntarte a las tandas',
    `<p>Hola ${esc_(o.nombre)},</p>
     <p>En tu inscripción nos dijiste que te interesa <b>rodar en pista</b> el sábado 21. Te dejamos toda la información.</p>
     <p style="background:#fff4d6;border:1px solid #f0d58a;border-radius:12px;padding:14px 16px;color:#5a4500">
       <b>Importante:</b> las tandas <b>no las gestiona Dub Edition</b>. Son el <b>Open Track Day del Aspar Circuit</b> y la plaza
       se reserva y se paga directamente con el circuito. Tu inscripción en la expo <b>no incluye</b> las tandas
       (y para rodar no hace falta estar en la expo).</p>
     <table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;width:100%;background:#f6f6f6;border:1px solid #e6e6e6;border-radius:14px">
       <tr><td style="padding:16px 20px;color:#333333;font-size:15px;line-height:1.8">
         ${row('Día', CFG.EVENT_DATE)}
         ${row('Horario de pista', CFG.TRACKDAY_HOURS + ' (7 horas, rueda de forma ilimitada)')}
         ${row('Precio', CFG.TRACKDAY_PRICE)}
         ${row('Plazas', 'Limitadas · máximo 20 coches a la vez en pista')}
       </td></tr>
     </table>
     <p><b>Requisitos del circuito:</b></p>
     <ul style="margin:0 0 14px;padding-left:20px">
       <li>Seguro obligatorio (se puede contratar en el circuito por 15 €).</li>
       <li>Casco obligatorio.</li>
       <li>Gancho de remolque obligatorio.</li>
       <li>Máximo piloto y copiloto.</li>
       <li>Verificación técnica del coche antes de salir a pista.</li>
       <li>Ventanillas cerradas o totalmente abiertas.</li>
     </ul>
     <p><b>Cómo reservar:</b> pulsa el botón de abajo y completa la reserva en la web de Aspar Circuit. Te recomendamos
     hacerlo cuanto antes porque las plazas son limitadas y online sale más barato.</p>
     <p>Si tienes dudas sobre las tandas, escribe al circuito: ${CFG.ASPAR_PHONE} &middot; WhatsApp ${CFG.ASPAR_WHATSAPP}
     &middot; ${CFG.ASPAR_EMAIL}. Para cualquier cosa de la expo, respóndenos a este correo.</p>`,
    { label: 'RESERVAR TANDAS EN ASPAR', url: CFG.TRACKDAY_BOOK_URL }
  );
  mail_(o.email, 'Info para hacer tandas · ' + CFG.EVENT_NAME, html);
}

function mail_(to, subject, html, extra) {
  const opts = Object.assign({ htmlBody: html, name: CFG.SENDER_NAME }, extra || {});
  if (CFG.REPLY_TO) opts.replyTo = CFG.REPLY_TO;
  if (CFG.FROM && GmailApp.getAliases().indexOf(CFG.FROM) >= 0) opts.from = CFG.FROM;
  else if (CFG.REQUIRE_FROM) throw new Error('Correo no enviado: falta configurar ' + CFG.FROM + ' en Gmail (Configuración → Cuentas → Enviar como).');
  GmailApp.sendEmail(to, subject, stripHtml_(html), opts);
}

function mailLayout_(title, inner, cta) {
  // Diseño claro: se ve bien en modo claro y en modo oscuro (sin emojis: se corrompen por SMTP externo)
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"></head>
  <body style="margin:0;padding:0;background:#f2f2f2;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2"><tr><td align="center" style="padding:28px 12px">
   <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e3e3e3;border-radius:20px">
    <tr><td style="padding:32px 30px 8px;text-align:center">
      <img src="${CFG.LOGO_MAIL}" alt="Dub Edition VLC" width="230" style="max-width:230px;height:auto;display:inline-block">
      <p style="margin:16px 0 0;color:#777777;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:bold">${CFG.EVENT_NAME} &middot; ${CFG.EVENT_DATE_SHORT}</p>
    </td></tr>
    <tr><td style="padding:12px 30px 0"><h1 style="margin:14px 0 8px;color:#111111;font-size:26px;line-height:1.2">${title}</h1></td></tr>
    <tr><td style="padding:0 30px;color:#333333;font-size:15px;line-height:1.7">${inner}</td></tr>
    ${cta ? `<tr><td align="center" style="padding:18px 30px 32px"><a href="${cta.url}" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-weight:bold;font-size:13px;letter-spacing:1.5px;padding:15px 28px;border-radius:999px">${cta.label}</a></td></tr>` : ''}
    <tr><td style="padding:18px 30px;border-top:1px solid #eeeeee;text-align:center;color:#888888;font-size:12px;line-height:1.6">
      Dub Edition VLC &middot; <a href="${CFG.INSTAGRAM}" style="color:#111111">@dubeditionvlc</a> &middot; #seguimosenlonuestro<br>
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
    <div class="pass">EXPOSITOR · ENTRADA ${CFG.EVENT_ARRIVAL}</div>
    <div class="plate">${esc_(o.matricula)}</div>
    <p class="name">${esc_(o.nombre)} ${esc_(o.apellido)}</p>
    <p class="car">${esc_(o.marca)} ${esc_(o.modelo)}${o.instagram ? ' · ' + esc_(o.instagram) : ''}</p>
    <div class="qr"><img src="${qr}" style="width:250px;height:250px"></div>
    <p class="id">${esc_(o.id)}</p>
    <div class="foot">${CFG.EVENT_DATE} · ${CFG.EVENT_PLACE}<br>
      Entrada de coches a la expo: ${CFG.EVENT_ARRIVAL} · Entrega de premios: ${CFG.EVENT_AWARDS}<br>
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
    checkin: iso(r[COL['Check-in']]), notas: r[COL['Notas']], infoTandas: iso(r[COL['Info tandas enviada']])
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
