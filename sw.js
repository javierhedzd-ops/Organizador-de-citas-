// Service worker: guarda la app en el teléfono para que abra sin internet.
// Estrategia: primero lo guardado (rápido y funciona en la calle), y si no está,
// se pide a la red. Al cambiar la versión, se borra lo viejo.
const CACHE = 'citas-tio-v4';
const ARCHIVOS = [
  './',
  './index.html',
  './cliente.html',
  './entender.js',
  './avisos.js',
  './zonas.js',
  './manifest.json',
  './icono.svg',
];

self.addEventListener('install', (evento) => {
  // Archivo por archivo: si uno falla, los demás se guardan igual y la app
  // sigue abriendo sin internet.
  evento.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(ARCHIVOS.map((a) => c.add(a))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(nombres.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;
  if (peticion.method !== 'GET') return;

  evento.respondWith(
    caches.match(peticion).then((guardado) => {
      if (guardado) return guardado;
      return fetch(peticion)
        .then((respuesta) => {
          // Solo se guarda lo que es de la propia app.
          if (respuesta.ok && new URL(peticion.url).origin === self.location.origin) {
            const copia = respuesta.clone();
            caches.open(CACHE).then((c) => c.put(peticion, copia));
          }
          return respuesta;
        })
        .catch(() => {
          // Sin red: solo se devuelve la página cuando lo que se pide es abrir la app.
          // Para un icono o un JSON, devolver HTML rompería las cosas.
          if (peticion.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        });
    })
  );
});
