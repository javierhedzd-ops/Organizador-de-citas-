# Citas del tío de Fer

Micro app para ordenar las citas (rezos, misas, velorios) que llegan por WhatsApp.

- App: https://javierhedzd-ops.github.io/tio-fer/
- Todo pasa en el teléfono: sin cuentas, sin internet y sin claves.
- Para instalarla en Android: abrir el enlace en Chrome y elegir "Instalar aplicación".
  Con la app instalada, al compartir un mensaje de WhatsApp aparece "Citas Fer".

## Archivos

- `index.html` — la página entera (lleva dentro el lector de mensajes).
- `entender.js` — saca fecha, hora, lugar, cliente y tipo de un texto libre.
- `avisos.js` — el aviso del día y lo que viene en 7 días.
- `mover.js` — mover una cita de hora.
- `zonas.js` — ordenar por zona para no cruzar la ciudad.
- `manifest.json` + `icono.svg` — para instalarla y recibir mensajes compartidos.

El proyecto completo (con las pruebas) vive en el teléfono de Javi.
