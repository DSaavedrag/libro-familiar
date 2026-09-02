// Lógica de "Fijos" (gastos fijos personales y del hogar): calcular el monto
// en pesos de un fijo (puede estar cargado en USD, a la cotización del día),
// armar los movimientos que corresponden cuando se toca "Cargar en este mes",
// y actualizar los movimientos ya cargados cuando se edita la lista de
// fijos (nombre, monto o categoría cambiados después de haber "Cargado en
// este mes"). Igual que logica-tarjetas.js: son funciones puras, no tocan
// el estado de la app ni guardan nada — reciben lo que necesitan como
// parámetros y devuelven el resultado; quien las llama (menu.js) decide qué
// hacer con eso (guardarlo, actualizar la pantalla, etc.).

export function montoArsDeFijo(item, cotizacionDolar) {
  if (item.moneda === "USD") {
    return Math.round((Number(item.monto) || 0) * (Number(cotizacionDolar) || 0) * 100) / 100;
  }
  return Number(item.monto) || 0;
}

// Si algún fijo de `list` ya tiene un movimiento cargado este mes (por
// fijoId), lo actualiza con los valores nuevos (nombre/monto/categoría
// pueden haber cambiado al editar la lista). Devuelve null si no había nada
// que actualizar, para que quien llama sepa que no hace falta persistir.
export function entriesActualizadasPorFijos(entries, list, cotizacionDolar) {
  let changed = false;
  const next = entries.map(e => {
    if (!e.fijoId) return e;
    const item = list.find(f => f.id === e.fijoId);
    if (!item) return e;
    changed = true;
    return {
      ...e,
      monto: montoArsDeFijo(item, cotizacionDolar),
      categoria: item.categoria,
      descripcion: item.nombre || e.descripcion,
      montoUSD: item.moneda === "USD" ? Number(item.monto) || 0 : undefined,
      cotizacionUsada: item.moneda === "USD" ? Number(cotizacionDolar) || 0 : undefined,
      esTarjeta: Boolean(item.esTarjeta),
      pagado: item.esTarjeta ? e.pagado ?? false : e.pagado
    };
  });
  return changed ? next : null;
}

// Igual que entriesActualizadasPorFijos, pero para los fijos del Hogar
// (reparten el monto entre Diego/Yani según `split`, en vez de ser 100% de
// una sola persona).
export function entriesActualizadasPorHogar(entries, list, split) {
  let changed = false;
  const next = entries.map(e => {
    if (!e.hogarId) return e;
    const item = list.find(f => f.id === e.hogarId);
    if (!item) return e;
    changed = true;
    const pct = Number(split[e.person]) || 0;
    return {
      ...e,
      categoria: item.categoria,
      monto: Math.round((Number(item.monto) || 0) * pct / 100 * 100) / 100,
      descripcion: `${item.nombre || "Gasto fijo"} (hogar)`
    };
  });
  return changed ? next : null;
}

// Arma los movimientos nuevos para "Cargar en este mes" de los fijos
// personales que todavía no tengan un movimiento cargado este mes. Devuelve
// un array vacío si no hay nada pendiente.
export function armarEntriesFijosFaltantes({
  list,
  entries,
  personId,
  cotizacionDolar
}) {
  const faltantes = list.filter(f => !entries.some(e => e.fijoId === f.id));
  if (faltantes.length === 0) return [];
  const now = Date.now();
  return faltantes.map((f, i) => ({
    id: `fijo-${f.id}-${now}-${i}`,
    person: personId,
    tipo: "gasto",
    categoria: f.categoria,
    monto: montoArsDeFijo(f, cotizacionDolar),
    descripcion: f.nombre || "Gasto fijo",
    fijoId: f.id,
    montoUSD: f.moneda === "USD" ? Number(f.monto) || 0 : undefined,
    cotizacionUsada: f.moneda === "USD" ? Number(cotizacionDolar) || 0 : undefined,
    esTarjeta: Boolean(f.esTarjeta),
    pagado: f.esTarjeta ? false : undefined,
    ts: now - i
  }));
}

// Igual que armarEntriesFijosFaltantes, pero para los fijos del Hogar —
// genera DOS movimientos por fijo (uno para Diego, uno para Yani),
// repartidos según `split`.
export function armarEntriesHogarFaltantes({
  fijosHogar,
  entries,
  split
}) {
  const faltantes = fijosHogar.filter(f => !entries.some(e => e.hogarId === f.id));
  if (faltantes.length === 0) return [];
  const now = Date.now();
  const nuevas = [];
  faltantes.forEach((f, i) => {
    ["diego", "yani"].forEach((pid, j) => {
      nuevas.push({
        id: `hogar-${f.id}-${pid}-${now}-${i}-${j}`,
        person: pid,
        tipo: "gasto",
        categoria: f.categoria,
        monto: (Number(f.monto) || 0) * (Number(split[pid]) || 0) / 100,
        descripcion: `${f.nombre || "Gasto fijo"} (hogar)`,
        hogarId: f.id,
        ts: now - i
      });
    });
  });
  return nuevas;
}
