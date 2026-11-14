# Expo Dub Edition × Aspar Circuit — backend (Google Apps Script)

Formulario web → Google Sheets (datos) + Google Drive (fotos) + Gmail (correos) + PDF con QR + check-in.
Gratis y sin servidor: todo corre en la cuenta de Google que lo instala.

## Puesta en marcha (≈5 min)

1. Con la cuenta de Google del club, crea una **Hoja de cálculo** nueva: `Expo Aspar 21-11 · Inscripciones`.
2. **Extensiones → Apps Script**. Borra el contenido de `Código.gs` y pega `apps-script/Code.gs`. Guarda.
3. Arriba, selecciona la función **`setup`** → **Ejecutar**. Acepta los permisos
   (Google avisa de "app no verificada": *Configuración avanzada → Ir a … (no seguro)*; es tu propio script).
4. En **Registro de ejecución** aparecen:
   - **CLAVE ADMIN** → panel de admisión (solo organizadores).
   - **CLAVE STAFF** → solo check-in en puerta (para los que escanean).
   Puedes volver a verlas con la función `verClaves` o desde el menú **DUB EDITION** de la hoja.
5. **Implementar → Nueva implementación** → tipo **Aplicación web**:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
   Copia la URL que termina en `/exec`.
6. Pega esa URL en `eventos/expo-aspar-circuit/config.js` → `apiUrl: 'https://script.google.com/macros/s/…/exec'` y publica la web.

> Si cambias `Code.gs` más adelante: **Implementar → Gestionar implementaciones → editar → Versión: nueva**. Así la URL no cambia.

## URLs

| Para qué | URL |
|---|---|
| Página pública + formulario | `https://dubedition.es/eventos/expo-aspar-circuit/` |
| Panel de admisión (clave ADMIN) | `https://dubedition.es/eventos/expo-aspar-circuit/admin/` |
| Check-in en puerta (clave STAFF o ADMIN) | `https://dubedition.es/eventos/expo-aspar-circuit/checkin/` |

## Flujo

1. **Inscripción**: se guarda la fila en la hoja (estado *Pendiente*), las fotos en una subcarpeta de Drive
   y se envía automáticamente el correo de *"gracias, pronto te avisamos"* (`AUTO_THANKS`).
   El botón *Enviar agradecimientos* del panel envía el correo a quien aún no lo tenga.
2. **Selección**: en el panel, *Aceptar / Rechazar* (o cambiando la columna *Estado* en la hoja).
3. **Enviar respuestas**: un botón manda a los aceptados el correo con el **PDF de acreditación**
   (matrícula, nombre, coche y QR) y a los rechazados un correo invitándoles a venir y hacer tandas.
   Cada persona se notifica una sola vez; si le cambias el estado, se le vuelve a notificar.
4. **Día del evento**: en el check-in, *Activar cámara* y escanear el QR del salpicadero. Muestra foto,
   matrícula y datos, y avisa si ya había entrado o no está aceptado. También funciona escaneando con la
   cámara normal del móvil (abre la página de check-in), y buscando por matrícula si un QR no lee.

## Límites a tener en cuenta

- **Correos**: Gmail gratuito ≈ **100 destinatarios/día**; Google Workspace ≈ 1.500. El panel muestra los que quedan.
  Si hay muchas inscripciones, envía las respuestas en tandas o desactiva `AUTO_THANKS` y usa el botón.
- El QR se genera con `quickchart.io` (respaldo: `api.qrserver.com`).
- Las fotos se comparten "con enlace" para verse en el panel. Si la cuenta es de Workspace y lo bloquea,
  se ven igualmente estando logueado con la cuenta propietaria.
- Datos personales: la hoja es privada de la cuenta del club. Bórralas cuando termine el evento.
