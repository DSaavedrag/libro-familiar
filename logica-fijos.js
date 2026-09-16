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
// pueden haber cambiado al editar la lista, o cambió la cotización si es en
// USD). Devuelve null si no había nada que actualizar, para que quien llama
// sepa que no hace falta persistir.
//
// Un movimiento ya marcado "pagado" queda CONGELADO: no se sincroniza más,
// se queda con el monto que tenía al momento de pagarlo. Así es como se
// sabe el saldo real — mientras no está pagado, sigue el valor en vivo del
// fijo (y de la cotización si es en USD); en cuanto se paga, ese fue el
// monto final.
export function entriesActualizadasPorFijos(entries, list, cotizacionDolar) {
  let changed = false;
  const next = entries.map(e => {
    if (!e.fijoId || e.pagado) return e;
    const item = list.find(f => f.id === e.fijoId);
    if (!item) return e;
    const actualizado = {
      ...e,
      monto: montoArsDeFijo(item, cotizacionDolar),
      categoria: item.categoria,
      descripcion: item.nombre || e.descripcion,
      montoUSD: item.moneda === "USD" ? Number(item.monto) || 0 : undefined,
      cotizacionUsada: item.moneda === "USD" ? Number(cotizacionDolar) || 0 : undefined,
      esTarjeta: Boolean(item.esTarjeta)
    };
    // Importante: sólo cuenta como "changed" si algo realmente cambió de
    // valor — antes se marcaba changed=true con sólo encontrar el fijo
    // (aunque el resultado fuera idéntico al que ya tenía el movimiento),
    // así que esta función nunca podía devolver null mientras hubiera al
    // menos un fijo sin pagar. Eso hacía que cada llamada generara un
    // objeto "nuevo" (misma data, otra referencia) y volviera a persistir
    // en un loop apenas el efecto de menu.js empezó a depender también de
    // `entries` (ver ahí el porqué).
    if (JSON.stringify(actualizado) === JSON.stringify(e)) return e;
    changed = true;
    return actualizado;
  });
  return changed ? next : null;
}

// Igual que entriesActualizadasPorFijos, pero para los fijos del Hogar
// (reparten el monto entre Diego/Yani según `split`, en vez de ser 100% de
// una sola persona). Misma regla de congelado una vez pagado.
export function entriesActualizadasPorHogar(entries, list, split) {
  let changed = false;
  const next = entries.map(e => {
    if (!e.hogarId || e.pagado) return e;
    const item = list.find(f => f.id === e.hogarId);
    if (!item) return e;
    const pct = Number(split[e.person]) || 0;
    const actualizado = {
      ...e,
      categoria: item.categoria,
      monto: Math.round((Number(item.monto) || 0) * pct / 100 * 100) / 100,
      descripcion: `${item.nombre || "Gasto fijo"} (hogar)`
    };
    // Misma razón que en entriesActualizadasPorFijos: sólo cuenta como
    // "changed" si algo realmente cambió, si no esto nunca converge.
    if (JSON.stringify(actualizado) === JSON.stringify(e)) return e;
    changed = true;
    return actualizado;
  });
  return changed ? next : null;
}

// Arma los movimientos nuevos de los fijos personales que todavía no tengan
// un movimiento cargado este mes. Ahora esto se dispara solo (ver el
// useEffect en menu.js) apenas hay un fijo sin su movimiento del mes, así
// nunca hace falta acordarse de "cargarlo" a mano y no se escapa ningún
// gasto. Devuelve un array vacío si no hay nada pendiente.
//
// `soloId`: si se pasa, sólo arma el movimiento de ESE fijo (si está
// pendiente) en vez de todos los pendientes — lo sigue usando el botón
// "Cargar" manual de una fila individual como respaldo. Sin `soloId` se
// comporta igual que siempre (carga todos los pendientes de una).
//
// Todos arrancan con `pagado: false` (antes sólo los marcados "es tarjeta"
// tenían este campo) — así cualquier fijo, no sólo los de tarjeta, se puede
// marcar como pagado para congelar su monto (ver entriesActualizadasPorFijos).
export function armarEntriesFijosFaltantes({
  list,
  entries,
  personId,
  cotizacionDolar,
  soloId
}) {
  const base = soloId ? list.filter(f => f.id === soloId) : list;
  const faltantes = base.filter(f => !entries.some(e => e.fijoId === f.id));
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
    pagado: false,
    ts: now - i
  }));
}

// Igual que armarEntriesFijosFaltantes, pero para los fijos del Hogar —
// genera DOS movimientos por fijo (uno para Diego, uno para Yani),
// repartidos según `split`. También acepta `soloId` con el mismo sentido, y
// arranca en `pagado: false` por la misma razón.
export function armarEntriesHogarFaltantes({
  fijosHogar,
  entries,
  split,
  soloId
}) {
  const base = soloId ? fijosHogar.filter(f => f.id === soloId) : fijosHogar;
  const faltantes = base.filter(f => !entries.some(e => e.hogarId === f.id));
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
        pagado: false,
        ts: now - i
      });
    });
  });
  return nuevas;
}

// Colapsa movimientos de fijos duplicados: más de un movimiento con el mismo
// fijoId (o, para hogar, el mismo hogarId + person) en el mismo mes. Esto
// podía pasar porque el efecto que crea los fijos automáticamente (ver
// menu.js) leía `entries` de un render que todavía no reflejaba el
// movimiento que un disparo anterior del mismo efecto ya había creado — dos
// disparos casi simultáneos (por ejemplo, al cargar fijos/fijosHogar/
// cotización uno detrás del otro al abrir la app) podían creer los dos que
// "falta el movimiento" y crear cada uno el suyo, con ids distintos. Entre
// varios duplicados se queda con el que está "pagado" (si hay uno — es el
// que ya se congeló con un valor real) y, si no, con el más nuevo (mayor
// `ts`). Devuelve la lista sin los duplicados, en cualquier orden — quien
// llama la puede volver a ordenar si hace falta.
export function dedupeFijoEntries(entries) {
  function mejorDeLosDos(a, b) {
    if (Boolean(a.pagado) !== Boolean(b.pagado)) return a.pagado ? a : b;
    return (Number(b.ts) || 0) > (Number(a.ts) || 0) ? b : a;
  }
  const porFijo = new Map();
  const porHogar = new Map();
  const resto = [];
  for (const e of entries) {
    if (e.fijoId) {
      const previo = porFijo.get(e.fijoId);
      porFijo.set(e.fijoId, previo ? mejorDeLosDos(previo, e) : e);
    } else if (e.hogarId) {
      const clave = `${e.hogarId}:${e.person}`;
      const previo = porHogar.get(clave);
      porHogar.set(clave, previo ? mejorDeLosDos(previo, e) : e);
    } else {
      resto.push(e);
    }
  }
  return [...resto, ...porFijo.values(), ...porHogar.values()];
}
