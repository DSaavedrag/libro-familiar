// Lógica de "Movimientos" (Registro): armar el objeto de un movimiento nuevo
// desde el formulario de carga, escribir/reemplazar movimientos en el mes
// que corresponda (lo usa tanto el formulario de arriba como Tarjetas, para
// escribir cada cuota — ver logica-tarjetas.js), y las operaciones simples
// sobre la lista (togglear pagado, borrar, marcar tarjeta como pagada).
// Igual que logica-tarjetas.js y logica-fijos.js: funciones puras que no
// tocan el estado de la app — reciben lo que necesitan como parámetros y
// devuelven el resultado; quien las llama (menu.js) decide qué hacer con eso.

import { storageSetRetry, arrayAMapaPorId, mapaAArray } from "./storage.js";

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
  let existing = [];
  try {
    const r = await window.storage.get(`entries:${mKey}`, true);
    existing = r ? mapaAArray(JSON.parse(r.value)) : [];
  } catch {
    existing = [];
  }
  const res = await storageSetRetry(`entries:${mKey}`, JSON.stringify(arrayAMapaPorId([...newEntries, ...existing.filter(e => !ids.has(e.id))])), true);
  return Boolean(res);
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
