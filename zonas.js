// Zonas de Mérida: para ordenar el día sin andar cruzando la ciudad.
// Sin internet y sin IA: una lista de colonias y fraccionamientos con su zona.
//
// Lo que pidió Javi (27/10/2026): el tío de Fer pierde tiempo yendo de una cita
// en el sur a otra en el norte. Con esto, el día sale ordenado por zona y se ve
// de un golpe cuánto va a manejar.
//
// Si una colonia no está en la lista, se queda en "sin zona" y se avisa: nunca
// se inventa dónde está. Javi puede añadir colonias a ZONAS sin tocar el resto.

// El orden en que se recorre la ciudad: de sur a norte (y el centro en medio).
const ORDEN_ZONAS = ['sur', 'oriente', 'centro', 'poniente', 'norte', 'sin zona'];

// Cada zona con las colonias que se conocen. Se busca sin acentos y en minúsculas.
const ZONAS = {
  sur: [
    'chuburna', 'chuburna de hidalgo', 'las americas', 'las americas sur', 'el sur', 'san jose tec',
    'santa rosa', 'serdan', 'morelos', 'oriente', 'san antonio xluch', 'xluch',
    'san sebastian', 'la ermita', 'el vergel', 'san ramon', 'los reyes',
    'melchor ocampo', 'castilla camara', 'san jose', 'el fenix', 'la guadalupana',
    'san pedro chimay', 'chimay', 'leandro valle', 'nueva chuburna', 'chuburna puerto',
    'progreso', 'el porvenir', 'san miguel', 'los heroes', 'juan pablo',
  ],
  oriente: [
    'cordemex', 'pensiones', 'los pinos', 'las brisas', 'el country', 'country',
    'montebello', 'montecristo', 'altabrisa', 'los hidalgos', 'las quintas',
    'diaz ordaz', 'vergel', 'san esteban', 'el rosario', 'los alamos',
    'los sauces', 'las aguilas', 'vista alegre', 'el mayab', 'los robles',
    'conkal', 'chablekal', 'dzitya', 'xcanatun', 'temozon', 'sodzil',
  ],
  centro: [
    'centro', 'centro historico', 'merida centro', 'la mejorada', 'santiago',
    'santa lucia', 'santa ana', 'la merced', 'san cristobal', 'san juan',
    'san marcos', 'la capilla', 'san jose de la montana', 'la catedral',
  ],
  poniente: [
    'caucel', 'las americas caucel', 'los héroes caucel', 'ciudad caucel',
    'gran santa fe', 'santa fe', 'las fincas', 'susula', 'xoclán', 'xoclan',
    'el anikabil', 'anikabil', 'los molinos', 'san pedro chuburna',
    'la ceiba', 'el poniente', 'umán', 'uman', 'los laureles', 'las palmas',
    'el pedregal', 'pedregal', 'san antonio', 'la joya', 'los cometas',
  ],
  norte: [
    'las americas norte', 'francisco de montejo', 'montejo', 'montebello norte',
    'las quintas norte', 'cordemex norte', 'el norte', 'los dos torres',
    'torres', 'las brisas norte', 'progreso norte', 'chicxulub', 'chicxulub puerto',
    'conkal norte', 'la ceiba norte', 'los pinos norte', 'el country norte',
    'santa gertrudis', 'santa gertrudis copo', 'copo', 'temozon norte',
    'dzitya norte', 'xcanatun norte', 'sodzil norte', 'montejo norte',
    'los alamos norte', 'el mayab norte', 'los hidalgos norte',
  ],
};

// Quita acentos y deja todo en minúsculas, para comparar.
function normalizarZona(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/^(colonia|col\.?|fraccionamiento|fracc\.?|barrio|comisaria|comisaria|rancho|hacienda)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// La zona de un lugar escrito como sea. Devuelve 'sur', 'norte'... o 'sin zona'.
// Si el texto trae la zona escrita ("colonia X, norte"), esa manda.
function zonaDe(lugar) {
  const t = normalizarZona(lugar);
  if (!t) return 'sin zona';

  // "..., norte" o "zona norte" al final: se respeta lo que escribió Javi.
  const escrita = t.match(/\b(zona\s+)?(sur|oriente|centro|poniente|norte)\b\s*$/);
  if (escrita) return escrita[2];

  // La colonia más larga que aparezca en el texto (para que "las americas norte"
  // gane a "las americas").
  let mejor = null;
  let mejorLargo = 0;
  for (const [zona, colonias] of Object.entries(ZONAS)) {
    for (const colonia of colonias) {
      if (colonia.length > mejorLargo && t.includes(colonia)) {
        mejor = zona;
        mejorLargo = colonia.length;
      }
    }
  }
  return mejor || 'sin zona';
}

// El número de la zona para ordenar (0 = sur, primero).
function pesoZona(zona) {
  const i = ORDEN_ZONAS.indexOf(zona);
  return i < 0 ? ORDEN_ZONAS.length : i;
}

// Ordena las citas de un mismo día por zona y, dentro de la zona, por hora.
// No cambia las citas: devuelve una lista nueva.
function ordenarPorZona(citas) {
  return [...citas].sort((a, b) => {
    const za = pesoZona(a.zona || zonaDe(a.lugar));
    const zb = pesoZona(b.zona || zonaDe(b.lugar));
    if (za !== zb) return za - zb;
    return String(a.orden || '').localeCompare(String(b.orden || ''));
  });
}

// Cuántas zonas distintas hay en un día (para avisar de los cruces).
function zonasDelDia(citas) {
  const vistas = [];
  for (const c of citas) {
    const z = c.zona || zonaDe(c.lugar);
    if (z !== 'sin zona' && !vistas.includes(z)) vistas.push(z);
  }
  return vistas.sort((a, b) => pesoZona(a) - pesoZona(b));
}

// Un aviso corto si el día obliga a cruzar la ciudad.
function avisoDeZonas(citas) {
  const zonas = zonasDelDia(citas);
  if (zonas.length < 2) return null;
  const nombres = zonas.map((z) => z.charAt(0).toUpperCase() + z.slice(1));
  return `Ese día cruzas ${zonas.length} zonas: ${nombres.join(' → ')}.`;
}

// En la página no existe 'module': solo se exporta cuando corre en Node.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { zonaDe, ordenarPorZona, zonasDelDia, avisoDeZonas, pesoZona, normalizarZona, ORDEN_ZONAS, ZONAS };
}

// Para usarlo en la página (index.html) además de en Node.
if (typeof window !== 'undefined') {
  window.Zonas = { zonaDe, ordenarPorZona, zonasDelDia, avisoDeZonas, pesoZona, normalizarZona, ORDEN_ZONAS, ZONAS };
}
