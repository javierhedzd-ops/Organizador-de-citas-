// Los avisos del día: qué citas hay hoy y cuáles vienen, para que el tío de Fer
// no tenga que abrir nada. Sin internet y sin IA: solo compara fechas.
//
// Se usa desde la página (index.html) y desde Ari (src/whatsapp.js).

function aISO(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Suma días a una fecha ISO sin líos de zona horaria.
function sumarDias(iso, dias) {
  const [a, m, d] = iso.split('-').map(Number);
  const fecha = new Date(a, m - 1, d);
  fecha.setDate(fecha.getDate() + dias);
  return aISO(fecha);
}

// Las citas de un día concreto (ISO), ordenadas por hora.
function delDia(citas, iso) {
  return (citas || [])
    .filter((c) => c && c.fecha === iso)
    .sort((a, b) => String(a.orden || '').localeCompare(String(b.orden || '')));
}

// Las que vienen en los próximos N días (sin contar hoy), ordenadas.
function proximas(citas, hoyISO, dias = 7) {
  const hasta = sumarDias(hoyISO, dias);
  return (citas || [])
    .filter((c) => c && c.fecha && c.fecha > hoyISO && c.fecha <= hasta)
    .sort((a, b) => String(a.orden || '').localeCompare(String(b.orden || '')));
}

// El texto del aviso: corto, para leerlo en el bolsillo.
// Devuelve null si no hay nada que avisar (así no se manda un mensaje vacío).
function textoAviso(citas, hoyISO, opciones = {}) {
  const dias = opciones.dias === undefined ? 7 : opciones.dias;
  const hoy = delDia(citas, hoyISO);
  const luego = proximas(citas, hoyISO, dias);

  if (!hoy.length && !luego.length) return null;

  const lineas = [];
  if (hoy.length) {
    lineas.push(`🔔 Hoy tienes ${hoy.length === 1 ? '1 cita' : hoy.length + ' citas'}:`);
    for (const c of hoy) {
      const hora = c.horaBonita || 'sin hora';
      const quien = c.cliente || 'sin nombre';
      const donde = c.lugar || 'sin lugar';
      lineas.push(`• ${hora} · ${quien} · ${donde}`);
      if (c.maps) lineas.push(`  🗺️ ${c.maps}`);
    }
  } else {
    lineas.push('🔔 Hoy no tienes citas.');
  }

  if (luego.length) {
    lineas.push('');
    lineas.push(`📅 Lo que viene (${dias} días):`);
    for (const c of luego) {
      const cuando = [c.fechaBonita, c.horaBonita].filter(Boolean).join(' · ');
      lineas.push(`• ${cuando} · ${c.cliente || 'sin nombre'} · ${c.lugar || 'sin lugar'}`);
    }
  }

  return lineas.join('\n');
}

// --- Cuando se mueve o se cancela una cita ---
// El problema de verdad del tío: si mueve una cita, tiene que avisar a los demás
// del día. Esto arma ese mensaje. Sin IA: solo compara fechas y horas.

// Las citas del mismo día que la movida, sin contarla a ella.
// Se compara por referencia: dos citas a la misma hora son dos clientes distintos
// y a los dos hay que avisarles.
function companeras(citas, cita) {
  if (!cita || !cita.fecha) return [];
  return delDia(citas, cita.fecha).filter((c) => c !== cita && !c.cancelada);
}

// El mensaje para los demás clientes del día. Devuelve null si no hay a quién avisar.
function textoMover(citas, cita, antes, despues) {
  if (!cita || !antes || !despues) return null;
  const otras = companeras(citas, cita);
  if (!otras.length) return null;
  const lineas = [
    `Hola, le escribo del servicio de ${cita.tipo || 'música'}.`,
    `Se movió la cita de las ${antes.horaBonita || 'sin hora'} a las ${despues.horaBonita || 'sin hora'} del ${despues.fechaBonita || 'mismo día'}.`,
    '',
    'Su cita sigue igual:',
  ];
  for (const c of otras) {
    lineas.push(`• ${c.horaBonita || 'sin hora'} · ${c.cliente || 'sin nombre'} · ${c.lugar || 'sin lugar'}`);
  }
  lineas.push('');
  lineas.push('Si le afecta, avíseme y lo acomodamos. ¡Gracias!');
  return lineas.join('\n');
}

// El mensaje para el cliente de la cita cancelada.
function textoCancelar(cita) {
  if (!cita) return null;
  const cuando = [cita.fechaBonita, cita.horaBonita].filter(Boolean).join(' a las ');
  const lineas = [`Hola${cita.cliente ? ' ' + cita.cliente : ''}, le hablo del servicio de ${cita.tipo || 'música'}.`];
  lineas.push(`Lamento avisarle que se canceló su cita${cuando ? ' del ' + cuando : ''}.`);
  if (cita.anticipo) lineas.push('Le devuelvo su anticipo en cuanto me diga cómo prefiere.');
  lineas.push('');
  lineas.push('Disculpe las molestias. ¡Gracias por entender!');
  return lineas.join('\n');
}

module.exports = { delDia, proximas, textoAviso, sumarDias, companeras, textoMover, textoCancelar };

if (typeof window !== 'undefined') {
  window.Avisos = { delDia, proximas, textoAviso, sumarDias, companeras, textoMover, textoCancelar };
}
