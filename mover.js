// Mover una cita y avisar a los demás. Sin internet y sin IA: solo compara fechas.
//
// Lo que pidió el tío de Fer (27/10/2026): "si cancelan, mover fechas; para cambiar
// la fecha de un cliente hay que avisar a otros". Esto hace justo eso: le dice a
// quién hay que avisar y le deja el mensaje hecho para cada uno.

// En Node se pide a entender.js; en la página ya está cargado antes que este archivo.
// En la página no se desestructura: eso choca con las funciones de entender.js, que
// viven en el mismo ámbito global. Se usan como Entender.fechaBonita.
const Entender = (typeof module !== 'undefined' && module.exports)
  ? require('./entender')
  : window.Entender;
// Sin 'const': en la página, fechaBonita ya existe como función global de entender.js.
var fechaBonita = Entender.fechaBonita;

// Cuántos días de margen se considera "el mismo día" para avisar.
// Si mueves una cita del sábado y otro cliente tiene rezo el sábado, hay que avisarle.
function mismoDia(a, b) {
  return Boolean(a && b && a === b);
}

// A quién hay que avisar cuando se mueve una cita.
// - Los que tienen cita el día viejo (se les puede cruzar o quedar el hueco).
// - Los que tienen cita el día nuevo (por si se le empalma).
// - El propio cliente de la cita movida (para confirmarle la fecha nueva).
// Devuelve una lista de { motivo, cita } sin repetir a nadie.
function aQuienAvisar(citas, movida, fechaVieja, fechaNueva) {
  const avisos = [];
  const vistos = new Set();

  const meter = (cita, motivo) => {
    if (!cita) return;
    const llave = `${cita.cliente || ''}|${cita.telefono || ''}|${cita.fecha || ''}|${cita.hora ?? ''}`;
    if (vistos.has(llave)) return;
    vistos.add(llave);
    avisos.push({ motivo, cita });
  };

  // 1. El cliente de la cita movida.
  meter(movida, 'confirmar');

  // 2. Los demás del día viejo y del día nuevo.
  for (const c of citas || []) {
    if (!c || c === movida) continue;
    if (mismoDia(c.fecha, fechaVieja)) meter(c, 'dia-viejo');
    else if (mismoDia(c.fecha, fechaNueva)) meter(c, 'dia-nuevo');
  }

  return avisos;
}

// El mensaje para cada quien, listo para copiar y pegar en WhatsApp.
function textoParaAviso(aviso, movida, fechaVieja, fechaNueva) {
  const quien = movida.cliente || 'un cliente';
  const vieja = fechaBonita(fechaVieja) || 'el día de antes';
  const nueva = fechaBonita(fechaNueva) || 'el día nuevo';
  const hora = movida.horaBonita ? ` a las ${movida.horaBonita}` : '';

  if (aviso.motivo === 'confirmar') {
    return `Hola ${quien}, le confirmo su rezo: quedó para el ${nueva}${hora}. ` +
      `Cualquier cosa me avisa.`;
  }

  const nombre = aviso.cita.cliente ? `Hola ${aviso.cita.cliente}, ` : 'Hola, ';
  const suHora = aviso.cita.horaBonita ? ` a las ${aviso.cita.horaBonita}` : '';

  if (aviso.motivo === 'dia-viejo') {
    return `${nombre}le aviso de un cambio: el rezo de ${quien} que era el ${vieja} ` +
      `se movió al ${nueva}. Su rezo del ${vieja}${suHora} sigue igual.`;
  }

  // dia-nuevo
  return `${nombre}le aviso que el ${nueva} también tengo el rezo de ${quien}${hora}. ` +
    `Su rezo${suHora} sigue igual, solo le aviso por si necesita saberlo.`;
}

// Todo junto: mueve la cita y devuelve los mensajes hechos.
// No toca la lista original: devuelve una copia con la cita ya movida.
function moverCita(citas, indice, fechaNueva, opciones = {}) {
  const lista = (citas || []).map((c) => ({ ...c }));
  const movida = lista[indice];
  if (!movida) return { ok: false, error: 'No encontré esa cita.' };
  if (!fechaNueva) return { ok: false, error: 'Falta la fecha nueva.' };

  const fechaVieja = movida.fecha;
  if (fechaVieja === fechaNueva) {
    return { ok: false, error: 'La fecha nueva es la misma que ya tenía.' };
  }

  // Si el día nuevo ya tiene otra cita a la misma hora, se avisa (no se impide:
  // el tío de Fer decide, el sistema solo le dice que se le empalma).
  const empalme = lista.find((c, i) => i !== indice && c.fecha === fechaNueva &&
    c.hora === movida.hora && c.hora !== null && c.hora !== undefined);

  movida.fecha = fechaNueva;
  movida.fechaBonita = fechaBonita(fechaNueva);
  movida.orden = `${fechaNueva} ${String(movida.hora ?? 99).padStart(2, '0')}:${String(movida.minuto || 0).padStart(2, '0')}`;
  movida.movidaDe = fechaVieja || null;

  const avisos = aQuienAvisar(lista, movida, fechaVieja, fechaNueva).map((a) => ({
    ...a,
    texto: textoParaAviso(a, movida, fechaVieja, fechaNueva),
  }));

  return {
    ok: true,
    citas: lista,
    movida,
    fechaVieja,
    fechaNueva,
    empalme: empalme || null,
    avisos,
  };
}

// El anticipo: cuánto falta por cobrar de una cita.
// Devuelve null si no hay precio (no se inventa nada).
function faltaPorCobrar(cita) {
  if (!cita || cita.precio === null || cita.precio === undefined || cita.precio === '') return null;
  const precio = Number(cita.precio);
  const anticipo = Number(cita.anticipo || 0);
  if (Number.isNaN(precio)) return null;
  return Math.max(0, precio - (Number.isNaN(anticipo) ? 0 : anticipo));
}

// El texto corto del anticipo, para la tarjeta.
function textoAnticipo(cita) {
  const falta = faltaPorCobrar(cita);
  if (falta === null) return null;
  const anticipo = Number(cita.anticipo || 0);
  if (anticipo > 0 && falta > 0) return `Anticipo $${anticipo} · faltan $${falta}`;
  if (anticipo > 0 && falta === 0) return `Pagado (anticipo $${anticipo})`;
  return `Sin anticipo · cobrar $${falta}`;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { moverCita, aQuienAvisar, textoParaAviso, faltaPorCobrar, textoAnticipo };
}

if (typeof window !== 'undefined') {
  window.Mover = { moverCita, aQuienAvisar, textoParaAviso, faltaPorCobrar, textoAnticipo };
}
