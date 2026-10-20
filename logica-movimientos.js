// Lógica de "Movimientos" (Registro): armar el objeto de un movimiento nuevo
// desde el formulario de carga, escribir/reemplazar movimientos en el mes
// que corresponda (lo usa tanto el formulario de arriba como Tarjetas, para
// escribir cada cuota — ver logica-tarjetas.js), y las operaciones simples
// sobre la lista (togglear pagado, borrar, marcar tarjeta como pagada).
// Igual que logica-tarjetas.js y logica-fijos.js: funciones puras que no
// tocan el estado de la app — reciben lo que necesitan como parámetros y
// devuelven el resultado; quien las llama (menu.js) decide qué hacer con eso.

import { storageUpdateRetry, arrayAMapaPorId } from "./storage.js";

// Arma el movimiento nuevo a partir del formulario de carga (form de
// menu.js), para el caso "normal" (ingreso, gasto suelto, o consumo de
// tarjeta "agrupable" con etiqueta). El caso de tarjeta "único" con cuotas
// no pasa por acá — reusa cargarConsumoTarjeta (ver logica-tarjetas.js),
// porque es exactamente la misma lógica que "Tarjetas > Nuevo consumo".
// Devuelve null si falta algo para poder armarlo (monto inválido, o
// consumo agrupable sin etiqueta elegida) — quien llama no debe guardar nada.
export function armarMovimientoDesdeForm({
  form,
  activePerson,
  etiquetasDePersona
}) {
  const monto = parseFloat(form.monto);
  if (!monto || monto <= 0) return null;
  const esTarjeta = form.tipo === "gasto" && form.esTarjeta;
  const esRendimiento = form.tipo === "gasto" && !form.esTarjeta && form.esRendimiento;
  const categoria = form.tipo === "ingreso" ? null : form.categoria;
  let descripcion = form.descripcion.trim();
  if (esTarjeta) {
    const etiqueta = (etiquetasDePersona || []).find(e => e.id === form.etiquetaId);
    if (!etiqueta) return null; // hace falta elegir una etiqueta para cargar un consumo agrupable
    descripcion = etiqueta.nombre;
  }
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    person: activePerson,
    tipo: form.tipo,
    categoria,
    monto: esRendimiento ? -monto : monto,
    descripcion,
    esTarjeta,
    esRendimiento,
    etiquetaId: esTarjeta ? form.etiquetaId : undefined,
    pagado: esTarjeta ? false : undefined,
    ts: Date.now()
  };
}

// Escribe (o reemplaza, por id) un lote de movimientos en el mes que
// corresponda, en un solo guardado. Importante: nunca separar esto en
// llamadas de a un movimiento cuando el mes es el actual, porque cada
// llamada usaría una foto vieja de `entries` y se pisarían entre sí — por
// eso `persistEntries` se llama una sola vez acá adentro con la lista ya
// combinada, en vez de dejar que cada llamador haga la suya.
export async function escribirEntriesEnMes({
  mKey,
  newEntries,
  month,
  entries,
  persistEntries
}) {
  const ids = new Set(newEntries.map(e => e.id));
  if (mKey === month) {
    return await persistEntries([...newEntries, ...entries.filter(e => !ids.has(e.id))]);
  }
  // Mes distinto al actual (ej. cuotas futuras): no hace falta traer lo que
  // ya había ahí ni recalcular la lista completa — PATCH solo toca los ids
  // que se le pasan, así que alcanza con mandar exactamente los nuevos.
  const res = await storageUpdateRetry(`entries:${mKey}`, JSON.stringify(arrayAMapaPorId(newEntries)), true);
  return Boolean(res);
}

// Busca el monto más reciente que esta persona cargó con la misma
// descripción (sin importar mayúsculas ni espacios) — para sugerirlo cuando
// se repite algo seguido con (casi) siempre el mismo valor, como la SUBE.
// Sólo mira gastos sueltos (no tarjeta, no fijo/hogar, que tienen su propia
// lógica de monto) del mismo tipo que se está por cargar. Devuelve null si
// no hay nada que sugerir, para que quien llama no toque el monto.
export function sugerirMontoPorDescripcion(entries, personId, tipo, descripcion) {
  const buscada = (descripcion || "").trim().toLowerCase();
  if (!buscada) return null;
  const candidatos = (entries || []).filter(e => e.person === personId && e.tipo === tipo && !e.esTarjeta && !e.fijoId && !e.hogarId && (e.descripcion || "").trim().toLowerCase() === buscada);
  if (candidatos.length === 0) return null;
  const masReciente = candidatos.reduce((a, b) => (b.ts || 0) > (a.ts || 0) ? b : a);
  return masReciente.monto;
}
// Igual que sugerirMontoPorDescripcion, pero para el otro circuito de carga:
// gasto de tarjeta "agrupable" con etiqueta (ej: "Es tarjeta" + etiqueta
// "Sube") — Diego la usa así para la SUBE, no como gasto suelto con
// descripción libre. Acá conviene sugerir el monto MÁS COMÚN (no el último),
// porque a veces carga dos boletos juntos y ese valor puntual no es el que
// quiere que se repita solo; ante un empate en frecuencia, gana el más
// reciente de esos montos empatados.
export function sugerirMontoTarjetaPorEtiqueta(entries, personId, etiquetaId) {
  if (!etiquetaId) return null;
  const candidatos = (entries || []).filter(e => e.person === personId && e.esTarjeta && e.etiquetaId === etiquetaId);
  if (candidatos.length === 0) return null;
  const stats = new Map(); // monto -> { count, ultimoTs }
  candidatos.forEach(e => {
    const prev = stats.get(e.monto) || {
      count: 0,
      ultimoTs: 0
    };
    prev.count += 1;
    prev.ultimoTs = Math.max(prev.ultimoTs, e.ts || 0);
    stats.set(e.monto, prev);
  });
  let mejorMonto = null;
  let mejorCount = -1;
  let mejorTs = -1;
  stats.forEach((info, monto) => {
    if (info.count > mejorCount || info.count === mejorCount && info.ultimoTs > mejorTs) {
      mejorMonto = monto;
      mejorCount = info.count;
      mejorTs = info.ultimoTs;
    }
  });
  return mejorMonto;
}
export function entriesSinId(entries, id) {
  return entries.filter(e => e.id !== id);
}
export function entriesConPagadoToggleado(entries, id) {
  return entries.map(e => e.id === id ? {
    ...e,
    pagado: !e.pagado
  } : e);
}
export function entriesConTarjetaPagada(entries, person) {
  return entries.map(e => e.person === person && (e.tarjetaId || e.esTarjeta) && !e.pagado ? {
    ...e,
    pagado: true
  } : e);
}

// "Trabajar con saldos": Yani no tiene el hábito de cargar cada consumo —
// cada tanto, lo único que hace es anotar cuánto le queda en cada
// categoría. Hasta ahora, para que esos números cierren, había que hacer la
// cuenta a mano e inventar un gasto suelto con el monto justo para que el
// restante diera lo que ella anotó. Esto hace esa cuenta sola: a partir del
// saldo que queda que la persona tipeó, arma (o actualiza) un único
// movimiento "de ajuste" por categoría y por mes — el que hace falta para
// que presupuesto - gastado dé exactamente ese número.
//
// El id es siempre el mismo para una persona+categoría+mes
// ("ajuste-{person}-{categoria}-{mes}"), a propósito: volver a guardar un
// saldo para la misma categoría este mes no apila ajustes nuevos, reemplaza
// al anterior (ver idAjusteSaldo, que arma ese mismo id para poder sacarlo
// de la cuenta de "gastado real" y para poder borrarlo si ya no hace falta).
export function idAjusteSaldo(personId, categoriaId, month) {
  return `ajuste-${personId}-${categoriaId}-${month}`;
}

// Un gasto fijo, de tarjeta o de hogar que todavía NO se marcó "pagado" es
// un compromiso pendiente — se sabe que hay que pagarlo, pero esa plata
// todavía no salió de la cuenta de verdad. Ej: el sueldo de la niñera se
// carga solo apenas abrís el mes (gasto fijo automático), pero hasta que no
// lo pagás y lo marcás, seguís teniendo esa plata en el bolsillo.
function esPendienteDePago(e) {
  return Boolean(e.fijoId || e.hogarId || e.tarjetaId || e.esTarjeta) && !e.pagado;
}
// Lo que YA está cargado en una categoría, pero sólo contando lo que de
// verdad ya salió de la cuenta — deja afuera los compromisos pendientes
// (ver esPendienteDePago). Esto es a propósito distinto de lo que usa el
// resto de la app (Resumen, Hogar: ver totalsFor en menu.js), que cuenta
// TODO lo fijo/tarjeta como ya gastado esté pagado o no — ahí es el
// criterio que Diego prefiere para su propio uso. Acá, en cambio, es
// específicamente para "Trabajar con saldos": cuando alguien anota "me
// quedan $300.000", está pensando en la plata que tiene de verdad
// disponible AHORA, sin restar todavía lo que es un compromiso a futuro —
// si se restara también lo pendiente, el número que esa persona anotó (que
// ya es "lo que me queda sin pagar eso todavía") quedaría contado dos
// veces y el resultado da mal (gastos que terminan en negativo).
export function gastadoParaSaldos(entries, personId, categoriaId, idAIgnorar) {
  return (entries || []).filter(e => e.id !== idAIgnorar && e.tipo === "gasto" && e.person === personId && e.categoria === categoriaId && !esPendienteDePago(e)).reduce((s, e) => s + (Number(e.monto) || 0), 0);
}
// Lo pendiente de pago de una categoría (ver esPendienteDePago) — se usa
// sólo para mostrarlo como referencia en "Trabajar con saldos" (algo como
// "tenés $250.000 pendientes de pago acá"), nunca para restarlo del saldo.
export function pendienteParaSaldos(entries, personId, categoriaId) {
  return (entries || []).filter(e => e.tipo === "gasto" && e.person === personId && e.categoria === categoriaId && esPendienteDePago(e)).reduce((s, e) => s + (Number(e.monto) || 0), 0);
}

// Devuelve:
//  - undefined si `nuevoSaldo` está vacío o no es un número — no hay nada
//    que guardar para esta categoría, quien llama no debe tocarla.
//  - null si, haciendo la cuenta, no hace falta ningún ajuste (lo que ya
//    está cargado alcanza para que el restante dé ese número solo) — quien
//    llama debe sacar cualquier ajuste viejo de esta categoría, si había.
//  - el movimiento de ajuste (objeto) si hace falta uno nuevo o actualizado.
export function armarAjusteSaldo({
  entries,
  personId,
  categoriaId,
  nuevoSaldo,
  presupuesto,
  month
}) {
  if (nuevoSaldo === "" || nuevoSaldo === null || nuevoSaldo === undefined || isNaN(Number(nuevoSaldo))) return undefined;
  const id = idAjusteSaldo(personId, categoriaId, month);
  // Lo ya cargado "de verdad" en esta categoría, sin contar un ajuste previo
  // (si no, el ajuste viejo se sumaría a sí mismo al recalcularlo) y sin
  // contar lo pendiente de pago (ver gastadoParaSaldos, arriba).
  const gastadoReal = gastadoParaSaldos(entries, personId, categoriaId, id);
  const gastoNecesario = (Number(presupuesto) || 0) - Number(nuevoSaldo);
  const plug = Math.round((gastoNecesario - gastadoReal) * 100) / 100;
  // Menos de 50 centavos de diferencia: redondeo, no hace falta inventar un
  // movimiento por eso — y si había uno de antes, ya no corresponde.
  if (Math.abs(plug) < 0.5) return null;
  return {
    id,
    person: personId,
    tipo: "gasto",
    categoria: categoriaId,
    monto: plug,
    descripcion: "Ajuste de saldo",
    esAjusteSaldo: true,
    ts: Date.now()
  };
}
