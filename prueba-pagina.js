// Prueba de la página sin navegador: monta un DOM mínimo y corre el script de index.
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync(process.argv[2] || 'index-nuevo.html', 'utf8');
const codigo = html.match(/<script>([\s\S]*?)<\/script>/)[1];

let fallos = 0;
function ok(nombre, cond, extra) {
  if (cond) console.log('  ok   ' + nombre);
  else { fallos++; console.log('  FALLA ' + nombre + (extra ? ' -> ' + extra : '')); }
}

// --- DOM de mentira ---
function crearEl(id) {
  const el = {
    id, value: '', textContent: '', innerHTML: '', style: {}, dataset: {}, open: false,
    tagName: 'DIV', files: null, children: [],
    classList: { add() {}, remove() {}, contains() { return false; } },
    addEventListener(tipo, fn) { (el._ev = el._ev || {})[tipo] = fn; },
    appendChild(c) { el.children.push(c); el.innerHTML += c.innerHTML; return c; },
    remove() {}, click() { if (el._ev && el._ev.click) el._ev.click(); },
    querySelectorAll() { return []; },
    focus() {}, scrollIntoView() {},
  };
  return el;
}
const elementos = {};
const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
ids.forEach((id) => { elementos[id] = crearEl(id); });

const avisos = [];
const confirmaciones = [];
let respuestaConfirm = true;
const descargas = [];
const pendientes = []; // temporizadores que no se disparan solos (para ver el aviso antes de que se esconda)

const document = {
  getElementById: (id) => elementos[id] || (elementos[id] = crearEl(id)),
  createElement: (tag) => { const e = crearEl('nuevo-' + tag); e.tagName = tag.toUpperCase(); return e; },
  body: { appendChild() {} },
  addEventListener() {},
};
const almacen = {};
const localStorage = {
  getItem: (k) => (k in almacen ? almacen[k] : null),
  setItem: (k, v) => { almacen[k] = String(v); },
  removeItem: (k) => { delete almacen[k]; },
};
class Blob { constructor(partes, op) { this.partes = partes; this.tipo = op && op.type; } }
const URLfalso = { createObjectURL: (b) => { descargas.push(b); return 'blob:x'; }, revokeObjectURL() {} };

const sandbox = {
  document, localStorage, Blob, URL: URLfalso, console,
  confirm: (t) => { confirmaciones.push(t); return respuestaConfirm; },
  prompt: () => null,
  alert: (t) => avisos.push(t),
  setTimeout: (fn) => { pendientes.push(fn); return pendientes.length; },
  clearTimeout() {},
  navigator: { serviceWorker: { register: () => Promise.resolve() } },
  location: { protocol: 'https:', href: 'https://ejemplo/index.html' },
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  addEventListener() {},
  window: {},
  Date, Math, JSON, Number, String, Array, Object, Set, FileReader: function () {}, module: { exports: {} },
};
sandbox.window = sandbox;
vm.createContext(sandbox);

// Los tres archivos del cerebro, tal cual.
// Cada archivo en su propio contexto de función, como un <script> aparte.
for (const f of ['entender.js', 'avisos.js', 'zonas.js']) {
  vm.runInContext('(function(){' + fs.readFileSync(f, 'utf8') + '\n})()', sandbox, { filename: f });
}
vm.runInContext(codigo, sandbox, { filename: 'index.html' });

// --- Pruebas ---
console.log('Página: carga y arranca');
ok('la página arrancó sin errores', true);

function agregarTexto(texto) {
  elementos.entrada.value = texto;
  elementos.agregar._ev.click();
}

console.log('Página: agregar citas');
agregarTexto('sábado 3pm, colonia Chuburná, doña Mari');
let guardadas = JSON.parse(almacen['citas-tio-fer'] || '[]');
ok('se guarda la cita', guardadas.length === 1, JSON.stringify(guardadas));
ok('la cita tiene cliente', guardadas[0] && guardadas[0].cliente === 'doña Mari', guardadas[0] && guardadas[0].cliente);

ok('avisa que se agregó', /Agregada: doña Mari/.test(elementos['aviso-arriba'].textContent), elementos['aviso-arriba'].textContent);
ok('el aviso de arriba se ve', elementos['aviso-arriba'].style.display !== 'none', String(elementos['aviso-arriba'].style.display));

console.log('Página: choque de horario');
const fecha = guardadas[0].fecha;
respuestaConfirm = false;
confirmaciones.length = 0;
agregarTexto(`sábado 3:30pm, colonia Chuburná, don Pedro`);
guardadas = JSON.parse(almacen['citas-tio-fer'] || '[]');
ok('avisa del choque', confirmaciones.length === 1, confirmaciones.join(' | '));
ok('si dice que no, no se agrega', guardadas.length === 1, 'quedaron ' + guardadas.length);
respuestaConfirm = true;
agregarTexto(`sábado 3:30pm, colonia Chuburná, don Pedro`);
guardadas = JSON.parse(almacen['citas-tio-fer'] || '[]');
ok('si dice que sí, se agrega', guardadas.length === 2, 'quedaron ' + guardadas.length);

console.log('Página: marcar hecha');
const botonHecha = { dataset: { i: '0' }, addEventListener(t, f) { this._f = f; } };
// Se busca el listener real de la tarjeta a través de la lista pintada.
ok('la tarjeta trae botón de hecha', /class="hecha/.test(elementos.lista.innerHTML), 'no aparece en el HTML de la lista');
ok('la tarjeta trae botón de calendario', /class="calendario/.test(elementos.lista.innerHTML));

console.log('Página: historial');
const ayer = new Date(); ayer.setDate(ayer.getDate() - 3);
const iso = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, '0')}-${String(ayer.getDate()).padStart(2, '0')}`;
guardadas.push({ textoOriginal: 'x', fecha: iso, fechaBonita: 'hace 3 días', hora: 10, minuto: 0, horaBonita: '10:00', lugar: 'Centro', cliente: 'doña Rosa', tipo: 'rezo', precio: 1200, anticipo: 0, dudas: [], completa: true, orden: iso + ' 10:00', maps: null });
almacen['citas-tio-fer'] = JSON.stringify(guardadas);
elementos.entrada.value = 'domingo 1pm, colonia Centro, don Luis';
elementos.agregar._ev.click(); // repinta
ok('la cita pasada va al historial', /doña Rosa/.test(elementos['lista-pasadas'].innerHTML), 'no aparece');
ok('la cita pasada no sale en la lista de arriba', !/doña Rosa/.test(elementos.lista.innerHTML));
ok('el historial dice cuántas hay', /1 cita/.test(elementos['resumen-historial'].textContent), elementos['resumen-historial'].textContent);
ok('el historial dice bien el plural', !/1 cita que ya pasaron/.test(elementos['resumen-historial'].textContent), elementos['resumen-historial'].textContent);

console.log('Página: respaldo');
descargas.length = 0;
elementos.exportar._ev.click();
ok('descarga el respaldo', descargas.length === 1, 'descargas: ' + descargas.length);
const contenido = descargas[0] ? descargas[0].partes.join('') : '';
let json = null;
try { json = JSON.parse(contenido); } catch (e) {}
ok('el respaldo es JSON con las citas', json && Array.isArray(json.citas) && json.citas.length === 4, contenido.slice(0, 80));

console.log('Página: calendario (.ics)');
descargas.length = 0;
// Se llama a la función interna a través de un botón de la lista.
const m = codigo.match(/function descargarICS[\s\S]*?\n  \}/);
ok('existe descargarICS', !!m);
vm.runInContext('descargarICS(' + JSON.stringify(guardadas[0]) + ')', sandbox);
ok('descarga el .ics', descargas.length === 1, 'descargas: ' + descargas.length);
const ics = descargas[0] ? descargas[0].partes.join('') : '';
ok('el .ics tiene inicio y fin', /DTSTART;TZID=America\/Merida:\d{8}T\d{6}/.test(ics) && /DTEND/.test(ics), ics.slice(0, 200));
ok('el .ics lleva el lugar', /LOCATION:/.test(ics));

console.log('Página: sumarDias');
ok('sumarDias cruza de mes', vm.runInContext("sumarDias('2026-10-31', 1)", sandbox) === '2026-11-01');
ok('sumarDias cruza de año', vm.runInContext("sumarDias('2026-12-31', 1)", sandbox) === '2027-01-01');

console.log(`\ntests ${fallos === 0 ? 'OK' : 'CON FALLOS'} / fail ${fallos}`);
process.exit(fallos ? 1 : 0);
