// Entiende una cita escrita libre, como la mandaría el tío de Fer por WhatsApp.
// "sábado 3pm, colonia Chuburná, doña Mari" -> {fecha, hora, lugar, cliente, ...}
// Sin internet y sin IA: reglas. Si algo no se entiende, se marca como duda.

const DIAS = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, miércoles: 3, mier: 3,
  jueves: 4, jue: 4, viernes: 5, vier: 5, sabado: 6, sábado: 6, sab: 6, sabadito: 6,
};

const MESES = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5, julio: 6,
  agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

const TIPOS = [
  { tipo: 'velorio', palabras: ['velorio', 'velacion', 'velación', 'velando'] },
  { tipo: 'novena', palabras: ['novena', 'novenario'] },
  { tipo: 'misa', palabras: ['misa', 'funeral', 'entierro', 'sepelio'] },
  { tipo: 'rezo', palabras: ['rezo', 'rosario', 'rezadera', 'oracion', 'oración'] },
  { tipo: 'bautizo', palabras: ['bautizo', 'bautismo'] },
  { tipo: 'cumpleanos', palabras: ['cumpleanos', 'cumpleaños', 'cumple'] },
  { tipo: 'fiesta', palabras: ['fiesta', 'quinceanera', 'quinceañera', 'xv anos', 'xv años', 'boda', 'graduacion', 'graduación'] },
];

function sinAcentos(s) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizar(texto) {
  return sinAcentos(String(texto || ''))
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// "3pm", "3 pm", "15:30", "3:30 de la tarde", "a las 4", "mediodía"
function sacarHora(t) {
  let m = t.match(/\b(\d{1,2})[:.](\d{2})\s*(am|pm|a\.m\.|p\.m\.)?/);
  if (m) {
    let h = Number(m[1]);
    const min = Number(m[2]);
    const suf = (m[3] || '').replace(/\./g, '');
    if (suf === 'pm' && h < 12) h += 12;
    if (suf === 'am' && h === 12) h = 0;
    if (h >= 0 && h <= 23 && min <= 59) return { hora: h, minuto: min, texto: m[0].trim() };
  }

  m = t.match(/\b(\d{1,2})\s*(am|pm|a\.m\.|p\.m\.)\b/);
  if (m) {
    let h = Number(m[1]);
    const suf = m[2].replace(/\./g, '');
    if (suf === 'pm' && h < 12) h += 12;
    if (suf === 'am' && h === 12) h = 0;
    if (h >= 0 && h <= 23) return { hora: h, minuto: 0, texto: m[0].trim() };
  }

  m = t.match(/\b(?:a las|alas|a la|por la|de la)\s+(\d{1,2})\b(?:\s*(?:de la\s+)?(tarde|noche|manana|mañana))?/);
  if (m) {
    let h = Number(m[1]);
    const parte = m[2] || '';
    if (parte === 'tarde' || parte === 'noche') {
      if (h < 12) h += 12;
    } else if (h <= 7) {
      // "a las 4" en un rezo casi siempre es por la tarde
      h += 12;
    }
    if (h >= 0 && h <= 23) return { hora: h, minuto: 0, texto: m[0].trim() };
  }

  if (/\bmediodia\b/.test(t)) return { hora: 12, minuto: 0, texto: 'mediodía' };
  if (/\bmedianoche\b/.test(t)) return { hora: 0, minuto: 0, texto: 'medianoche' };

  return null;
}

function aISO(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Devuelve {fecha:'YYYY-MM-DD', comoSeDijo, dudosa}
function sacarFecha(t, hoy) {
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  // "26 de octubre", "3 de nov"
  let m = t.match(/\b(\d{1,2})\s+de\s+([a-z]+)/);
  if (m && MESES[m[2]] !== undefined) {
    const d = new Date(base.getFullYear(), MESES[m[2]], Number(m[1]));
    if (d < base) d.setFullYear(d.getFullYear() + 1);
    return { fecha: aISO(d), comoSeDijo: m[0], dudosa: false };
  }

  // "26/10", "26-10-2026"
  m = t.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (m) {
    const dia = Number(m[1]);
    const mes = Number(m[2]) - 1;
    let anio = m[3] ? Number(m[3]) : base.getFullYear();
    if (anio < 100) anio += 2000;
    const d = new Date(anio, mes, dia);
    if (!m[3] && d < base) d.setFullYear(d.getFullYear() + 1);
    if (!isNaN(d)) return { fecha: aISO(d), comoSeDijo: m[0], dudosa: false };
  }

  // "hoy", "mañana", "pasado mañana"
  if (/\bpasado manana\b/.test(t)) {
    const d = new Date(base); d.setDate(d.getDate() + 2);
    return { fecha: aISO(d), comoSeDijo: 'pasado mañana', dudosa: false };
  }
  if (/\bmanana\b/.test(t)) {
    const d = new Date(base); d.setDate(d.getDate() + 1);
    return { fecha: aISO(d), comoSeDijo: 'mañana', dudosa: false };
  }
  if (/\bhoy\b/.test(t)) {
    return { fecha: aISO(base), comoSeDijo: 'hoy', dudosa: false };
  }

  // "el sábado", "este sábado", "el próximo sábado", "sábado 3"
  for (const [nombre, num] of Object.entries(DIAS)) {
    const re = new RegExp(`\\b(?:el\\s+|este\\s+|proximo\\s+|próximo\\s+)?${nombre}\\b`);
    if (re.test(t)) {
      const proximo = /\b(proximo|próximo)\b/.test(t);
      const d = new Date(base);
      let delta = (num - d.getDay() + 7) % 7;
      if (delta === 0) delta = 7; // "el sábado" dicho en sábado = el que viene
      if (proximo && delta < 7) delta += 7;
      d.setDate(d.getDate() + delta);
      return { fecha: aISO(d), comoSeDijo: nombre, dudosa: false };
    }
  }

  return { fecha: null, comoSeDijo: null, dudosa: true };
}

// ¿El texto es en realidad una hora o una parte del día? ("a las 8 de la noche")
function esHoraTexto(trozo) {
  const t = normalizar(trozo);
  if (/^\d{1,2}([:.]\d{2})?\s*(am|pm)?$/.test(t)) return true;
  if (/^\d{1,2}\s+de\s+/.test(t)) return true;
  if (/^(?:a\s+)?(?:la\s+)?(tarde|noche|manana|mañana)\b/.test(t)) return true;
  if (/^(?:a\s+)?las?\s+\d{1,2}/.test(t)) return true;
  if (/^\d{1,2}\s+(?:de\s+la\s+)?(tarde|noche)/.test(t)) return true;
  return false;
}

// El lugar: lo que va después de "en", "colonia", "fracc", "calle"...
function sacarLugar(t, original) {
  // "colonia Chuburná", "fracc. Las Américas", "calle 60 norte" (con o sin "en" delante)
  let m = t.match(/\b(?:en\s+|por\s+)?(?:la\s+)?(colonia|col\.?|fraccionamiento|fracc\.?|calle|avenida|ave\.?|barrio|comisaria|comisaría|rancho|hacienda|centro)\s+([^,;]+)/);
  if (m) {
    const primera = m[2].trim().split(' ')[0];
    const idx = normalizar(original).indexOf(primera);
    const limpio = idx >= 0 ? original.slice(idx).split(/[,;]/)[0].trim() : m[2].trim();
    // "fracc. Las Américas" -> "Las Américas" (el tipo ya se guarda aparte)
    const sinTipo = limpio.replace(/^(colonia|col\.?|fraccionamiento|fracc\.?|calle|avenida|ave\.?|barrio|comisaria|comisaría|rancho|hacienda)\s+/i, '').trim();
    const candidato = sinTipo || limpio;
    // si lo que salió es en realidad una hora ("a las 8 de la noche"), no es lugar
    if (!esHoraTexto(candidato)) return { lugar: candidato, tipoLugar: m[1] };
  }

  // "en Chuburná", "en el centro" (sin la palabra colonia/calle)
  m = t.match(/\b(?:en|por)\s+([^,;]+)/);
  if (m) {
    const trozo = m[1].trim();
    // que no sea una hora ("a las 8 de la noche") ni una fecha ("3 de noviembre")
    const esHora = /^\d{1,2}([:.]\d{2})?\s*(am|pm)?$/.test(trozo) || /^\d{1,2}\s+de\s+/.test(trozo);
    const esParteDelDia = /^(?:la\s+)?(tarde|noche|manana|mañana)\b/.test(trozo) || /^\d{1,2}\s+(?:de\s+la\s+)?(tarde|noche)/.test(trozo);
    if (!esHora && !esParteDelDia) {
      const idx = normalizar(original).indexOf(trozo.split(' ')[0]);
      const limpio = idx >= 0 ? original.slice(idx).split(/[,;]/)[0].trim() : trozo;
      return { lugar: limpio, tipoLugar: null };
    }
  }

  // "calle 60 norte" sin "en" delante
  m = t.match(/\b(calle|avenida|ave\.?)\s+([^,;]+)/);
  if (m) {
    const idx = normalizar(original).indexOf(m[1]);
    const limpio = idx >= 0 ? original.slice(idx).split(/[,;]/)[0].trim() : m[0].trim();
    return { lugar: limpio, tipoLugar: m[1] };
  }

  // "fracc. Las Américas" sin "en" delante
  m = t.match(/\b(colonia|col\.?|fraccionamiento|fracc\.?|barrio|comisaria|comisaría|rancho|hacienda)\s+([^,;]+)/);
  if (m) {
    const idx = normalizar(original).indexOf(m[1]);
    const limpio = idx >= 0 ? original.slice(idx).split(/[,;]/)[0].trim() : m[0].trim();
    const sinTipo = limpio.replace(/^(colonia|col\.?|fraccionamiento|fracc\.?|barrio|comisaria|comisaría|rancho|hacienda)\s+/i, '').trim();
    const candidato = sinTipo || limpio;
    if (!esHoraTexto(candidato)) return { lugar: candidato, tipoLugar: m[1] };
  }
  return { lugar: null, tipoLugar: null };
}

// El cliente: "doña Mari", "Sra. López", "familia Pérez", "para Juan"
function sacarCliente(original) {
  // "Sra. López" (con punto) o "doña Mari" (sin punto). La i es porque "Sra" va en mayúscula.
  const m = original.match(/\b(doña|dona|don|señora|senora|sra|sr|familia|fam)\.?\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/i);
  if (m) {
    const tratamiento = m[1];
    const conPunto = /^(sra|sr|fam)$/i.test(tratamiento) ? tratamiento + '.' : tratamiento;
    return `${conPunto} ${m[2]}`.trim();
  }

  const p = original.match(/\bpara\s+([A-ZÁÉÍÓÚÑ][\wáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)?)/);
  if (p) return p[1].trim();

  return null;
}

function sacarTelefono(original) {
  const m = original.match(/(\+?52\s?)?(\d{10})|(\d{3}[\s-]\d{3}[\s-]\d{4})/);
  if (!m) return null;
  return m[0].replace(/[\s-]/g, '');
}

function sacarTipo(t) {
  for (const { tipo, palabras } of TIPOS) {
    if (palabras.some((p) => t.includes(p))) return tipo;
  }
  return null;
}

function sacarPrecio(original) {
  const m = original.match(/\$\s?(\d{2,5})|(\d{2,5})\s*(?:pesos|varos|mil)\b/);
  if (!m) return null;
  return Number(m[1] || m[2]);
}

const DIAS_NOMBRE = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES_NOMBRE = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function fechaBonita(iso) {
  if (!iso) return null;
  const [a, m, d] = iso.split('-').map(Number);
  const fecha = new Date(a, m - 1, d);
  return `${DIAS_NOMBRE[fecha.getDay()]} ${d} de ${MESES_NOMBRE[m - 1]}`;
}

function horaBonita(hora, minuto) {
  if (hora === null || hora === undefined) return null;
  const h12 = hora % 12 === 0 ? 12 : hora % 12;
  const suf = hora < 12 ? 'am' : 'pm';
  return `${h12}:${String(minuto || 0).padStart(2, '0')} ${suf}`;
}

function enlaceMaps(cita) {
  const partes = [cita.lugar, 'Mérida', 'Yucatán'].filter(Boolean);
  const q = encodeURIComponent(partes.join(', '));
  // Con "dir" Maps abre la navegación con la ruta puesta: solo falta tocar "Iniciar".
  return `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`;
}

// Lee las líneas con etiqueta del mensaje del formulario:
// "Lugar: Chuburná", "A nombre de: doña Mari", "Mi teléfono: 9991234567",
// "Rezo: sábado 31 de octubre a las 3 de la tarde", "Precio: $1500",
// "Anticipo: 500", "Fecha: 2026-11-03", "Hora: 15:30".
// Devuelve lo que encontró y el texto sin esas líneas (para leerlo como cita libre).
function sacarCamposConEtiqueta(original) {
  const datos = {
    lugar: null, cliente: null, telefono: null, precio: null, anticipo: null,
    fecha: null, hora: null, tipo: null, resto: original,
  };
  const sobran = [];

  const lineas = original.split(/\r?\n/);
  for (const linea of lineas) {
    const m = linea.match(/^\s*([^:]{2,30}):\s*(.+?)\s*$/);
    if (!m) continue;
    const etiqueta = normalizar(m[1]).replace(/\s+/g, ' ').trim();
    const valor = m[2].trim();
    if (!valor) continue;

    if (/^(lugar|direccion|donde|ubicacion)$/.test(etiqueta)) {
      datos.lugar = valor;
      sobran.push(linea);
    } else if (/^(a nombre de|nombre|cliente|para)$/.test(etiqueta)) {
      datos.cliente = valor;
      sobran.push(linea);
    } else if (/^(mi telefono|telefono|tel|cel|whatsapp)$/.test(etiqueta)) {
      datos.telefono = valor.replace(/[\s\-().+]/g, '');
      sobran.push(linea);
    } else if (/^(precio|costo|cuanto)$/.test(etiqueta)) {
      const n = valor.match(/\d{2,5}/);
      if (n) datos.precio = Number(n[0]);
      sobran.push(linea);
    } else if (/^(anticipo|abono|enganche)$/.test(etiqueta)) {
      const n = valor.match(/\d{1,5}/);
      if (n) datos.anticipo = Number(n[0]);
      sobran.push(linea);
    } else if (/^(fecha|dia)$/.test(etiqueta)) {
      // "2026-11-03" (como la escribe el formulario) o "3 de noviembre" o "sábado".
      const iso = valor.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (iso) {
        const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
        const existe = d.getFullYear() === Number(iso[1]) && d.getMonth() === Number(iso[2]) - 1
          && d.getDate() === Number(iso[3]);
        if (existe) datos.fecha = aISO(d);
        else datos.fechaInvalida = valor; // "2026-13-45": se avisa, no se inventa
      } else {
        const f = sacarFecha(normalizar(valor), new Date());
        if (f.fecha) datos.fecha = f.fecha;
      }
      sobran.push(linea);
    } else if (/^hora$/.test(etiqueta)) {
      const h = sacarHora(normalizar(valor));
      if (h) datos.hora = h;
      sobran.push(linea);
    } else if (/^(servicio|tipo|evento)$/.test(etiqueta)) {
      const t = sacarTipo(normalizar(valor));
      if (t) datos.tipo = t;
      sobran.push(linea);
    }
  }

  // Lo que no era una etiqueta conocida se queda para leerlo como cita libre.
  datos.resto = lineas.filter((l) => !sobran.includes(l)).join('\n').trim();
  return datos;
}

// La función principal.
function entender(texto, opciones = {}) {
  const hoy = opciones.hoy || new Date();
  const original = String(texto || '').trim();
  const t = normalizar(original);

  // El mensaje del formulario viene en varias líneas ("Lugar: Chuburná",
  // "A nombre de: doña Mari"...). Se sacan primero esos datos y lo que sobra
  // se lee como una cita escrita a mano.
  const campos = sacarCamposConEtiqueta(original);
  const resto = campos.resto;
  const tResto = normalizar(resto);

  // Lo que venga en una línea con etiqueta ("Fecha:", "Hora:") manda sobre lo
  // que se adivine del texto libre.
  const hora = campos.hora || sacarHora(t) || sacarHora(tResto);
  const fecha = campos.fecha
    ? { fecha: campos.fecha, comoSeDijo: 'Fecha:', dudosa: false }
    : campos.fechaInvalida
      ? { fecha: null, comoSeDijo: null, dudosa: true }
      : (sacarFecha(t, hoy).fecha ? sacarFecha(t, hoy) : sacarFecha(tResto, hoy));
  const lugar = campos.lugar
    ? { lugar: campos.lugar, tipoLugar: null }
    : sacarLugar(t, original);
  const cliente = campos.cliente || sacarCliente(original);
  const telefono = campos.telefono || sacarTelefono(original);
  const tipo = campos.tipo || sacarTipo(t) || sacarTipo(tResto);
  const precio = campos.precio || sacarPrecio(original);
  const anticipo = campos.anticipo || 0;

  const dudas = [];
  if (campos.fechaInvalida) dudas.push(`La fecha "${campos.fechaInvalida}" no existe. Escríbela así: 2026-11-03.`);
  else if (!fecha.fecha) dudas.push('No entendí la fecha. Escríbela así: "sábado" o "3 de noviembre".');
  if (!hora) dudas.push('No entendí la hora. Escríbela así: "3pm" o "a las 4 de la tarde".');
  if (!lugar.lugar) dudas.push('No entendí el lugar. Escríbelo después de "en": "en colonia Chuburná".');

  const cita = {
    textoOriginal: original,
    fecha: fecha.fecha,
    fechaBonita: fechaBonita(fecha.fecha),
    hora: hora ? hora.hora : null,
    minuto: hora ? hora.minuto : 0,
    horaBonita: hora ? horaBonita(hora.hora, hora.minuto) : null,
    lugar: lugar.lugar,
    tipoLugar: lugar.tipoLugar,
    cliente,
    telefono,
    tipo: tipo || 'rezo',
    precio,
    anticipo,
    dudas,
    completa: dudas.length === 0,
  };

  cita.maps = cita.lugar ? enlaceMaps(cita) : null;
  cita.orden = `${cita.fecha || '9999-99-99'} ${String(cita.hora ?? 99).padStart(2, '0')}:${String(cita.minuto).padStart(2, '0')}`;
  return cita;
}

// Ordena una lista de citas por fecha y hora.
function ordenar(citas) {
  return [...citas].sort((a, b) => a.orden.localeCompare(b.orden));
}

module.exports = { entender, ordenar, fechaBonita, horaBonita, enlaceMaps, normalizar };

// Para usarlo en la página (index.html) además de en Node.
if (typeof window !== "undefined") {
  window.Entender = { entender, ordenar, fechaBonita, horaBonita, enlaceMaps };
}
