// Lógica de "Tarjetas" (consumos en cuotas): tanto las tarjetas personales de
// Diego/Yani como las tarjetas del Hogar (compartidas) usan exactamente la
// misma lógica de cuotas — la única diferencia real es que una tarjeta de
// Hogar genera DOS movimientos por cuota (uno para Diego y otro para Yani,
// repartidos según splitHogar) en vez de uno solo.
//
// Antes había funciones duplicadas para "tarjeta normal" y "tarjeta de
// hogar" (buildCuotaEntry / buildCuotaEntryHogar, writeInstallments /
// writeInstallmentsHogar, etc.), cada una con su propia copia de la misma
// lógica. Acá quedaron unificadas: una sola función que hace lo mismo, con
// un parámetro `hogar` (true/false) que cambia el comportamiento donde
// realmente hace falta.
//
// Estas funciones no tocan el estado de la app directamente (no hacen
// setTarjetas/setTarjetasHogar) — reciben lo que necesitan como parámetros
// (mes actual, movimientos actuales, y la función writeEntriesForMonth para
// guardar) y devuelven el resultado. Quien las llama (menu.js) es el que
// decide qué hacer con ese resultado (guardarlo, avisar un error, etc.).

import { shiftMonth, monthDiff } from "./constants.js";
import { storageSetRetry } from "./storage.js";

// Arma UNA cuota (un movimiento) de una compra en cuotas.
export function buildCuotaEntry({
  purchaseId,
  personId,
  categoria,
  descripcion,
  montoCuota,
  cuotasNum,
  idx,
  hogar
}) {
  const sufijoIdHogar = hogar ? `-${personId}` : "";
  const sufijoTextoHogar = hogar ? ", hogar" : "";
  const sufijoTextoHogarSolo = hogar ? " (hogar)" : "";
  return {
    id: `${purchaseId}-c${idx}${sufijoIdHogar}`,
    person: personId,
    tipo: "gasto",
    categoria,
    monto: montoCuota,
    descripcion: cuotasNum > 1 ? `${descripcion} (cuota ${idx + 1}/${cuotasNum}${sufijoTextoHogar})` : `${descripcion}${sufijoTextoHogarSolo}`,
    tarjetaId: purchaseId,
    ...(hogar ? {
      hogarId: purchaseId
    } : {}),
    cuotaIndex: idx + 1,
    cuotasTotal: cuotasNum,
    ts: Date.now() - idx
  };
}

// Arma y escribe TODAS las cuotas de una compra, mes por mes, usando
// writeEntriesForMonth (que ya sabe guardar en el mes actual o en uno
// futuro/pasado, y evita pisar movimientos existentes). Para tarjetas
// personales escribe 1 movimiento por mes; para tarjetas de hogar escribe 2
// (Diego y Yani), repartidos según splitHogar. Devuelve la lista de meses
// (YYYY-MM) que no se pudieron guardar, para poder avisar y reintentar después.
export async function escribirCuotas({
  purchaseId,
  personId,
  categoria,
  descripcion,
  cuotasNum,
  montoCuota,
  montoCuotaTotal,
  startMonth,
  writeEntriesForMonth,
  hogar,
  splitHogar
}) {
  const fallidos = [];
  for (let i = 0; i < cuotasNum; i++) {
    const mKey = shiftMonth(startMonth, i);
    const entriesParaEsteMes = hogar ? ["diego", "yani"].map(pid => buildCuotaEntry({
      purchaseId,
      personId: pid,
      categoria,
      descripcion,
      montoCuota: Math.round(montoCuotaTotal * (Number(splitHogar[pid]) || 0) / 100 * 100) / 100,
      cuotasNum,
      idx: i,
      hogar: true
    })) : [buildCuotaEntry({
      purchaseId,
      personId,
      categoria,
      descripcion,
      montoCuota,
      cuotasNum,
      idx: i,
      hogar: false
    })];
    const ok = await writeEntriesForMonth(mKey, entriesParaEsteMes);
    if (!ok) fallidos.push(mKey);
    if (i < cuotasNum - 1) await new Promise(r => setTimeout(r, 150));
  }
  return fallidos;
}

// Borra del mes que corresponda (donde sea, no solo el actual) todos los
// movimientos que ya se hayan guardado de una compra en cuotas — se usa
// antes de reescribirla al editarla, y al borrarla del todo.
async function removeEntryFromOtherMonth(mKey, tarjetaId) {
  try {
    const r = await window.storage.get(`entries:${mKey}`, true);
    const existing = r ? JSON.parse(r.value) : [];
    const filtered = existing.filter(e => e.tarjetaId !== tarjetaId);
    await storageSetRetry(`entries:${mKey}`, JSON.stringify(filtered), true);
  } catch {
    // si no hay nada guardado para ese mes, no hay nada que borrar
  }
}
export async function removeInstallments({
  purchase,
  month,
  entries,
  persistEntries
}) {
  for (let i = 0; i < purchase.cuotasTotal; i++) {
    const mKey = shiftMonth(purchase.mesInicio, i);
    if (mKey === month) {
      await persistEntries(entries.filter(e => e.tarjetaId !== purchase.id));
    } else {
      await removeEntryFromOtherMonth(mKey, purchase.id);
    }
    if (i < purchase.cuotasTotal - 1) await new Promise(r => setTimeout(r, 100));
  }
}

// Chequea, mes por mes, si las cuotas de una compra realmente están
// guardadas en ese período (no solo en el registro de la tarjeta). Para
// tarjetas de hogar, un mes solo cuenta como "completo" si están los
// movimientos de Diego Y de Yani.
export async function detectarCuotasFaltantes({
  purchase,
  month,
  entries,
  hogar
}) {
  const faltantes = [];
  for (let i = 0; i < purchase.cuotasTotal; i++) {
    const mKey = shiftMonth(purchase.mesInicio, i);
    let existing;
    if (mKey === month) {
      existing = entries;
    } else {
      try {
        const r = await window.storage.get(`entries:${mKey}`, true);
        existing = r ? JSON.parse(r.value) : [];
      } catch {
        existing = [];
      }
    }
    if (hogar) {
      const tieneDiego = existing.some(e => e.tarjetaId === purchase.id && e.cuotaIndex === i + 1 && e.person === "diego");
      const tieneYani = existing.some(e => e.tarjetaId === purchase.id && e.cuotaIndex === i + 1 && e.person === "yani");
      if (!tieneDiego || !tieneYani) faltantes.push(mKey);
    } else {
      if (!existing.some(e => e.tarjetaId === purchase.id && e.cuotaIndex === i + 1)) faltantes.push(mKey);
    }
  }
  return faltantes;
}

// Reescribe únicamente los meses que detectarCuotasFaltantes marcó como
// faltantes. Devuelve la lista de meses que, después de reintentar, siguen sin poder guardarse.
export async function reintentarCuotasFaltantes({
  purchase,
  pendientes,
  writeEntriesForMonth,
  hogar,
  personId,
  splitHogar
}) {
  if (!pendientes || pendientes.length === 0) return [];
  const nuevosFallidos = [];
  for (const mKey of pendientes) {
    const idx = monthDiff(purchase.mesInicio, mKey);
    const entriesParaEsteMes = hogar ? ["diego", "yani"].map(pid => buildCuotaEntry({
      purchaseId: purchase.id,
      personId: pid,
      categoria: purchase.categoria,
      descripcion: purchase.descripcion,
      montoCuota: Math.round(purchase.montoCuota * (Number(splitHogar[pid]) || 0) / 100 * 100) / 100,
      cuotasNum: purchase.cuotasTotal,
      idx,
      hogar: true
    })) : [buildCuotaEntry({
      purchaseId: purchase.id,
      personId,
      categoria: purchase.categoria,
      descripcion: purchase.descripcion,
      montoCuota: purchase.montoCuota,
      cuotasNum: purchase.cuotasTotal,
      idx,
      hogar: false
    })];
    const ok = await writeEntriesForMonth(mKey, entriesParaEsteMes);
    if (!ok) nuevosFallidos.push(mKey);
    await new Promise(r => setTimeout(r, 150));
  }
  return nuevosFallidos;
}

// Reconstruye registros de "Tarjetas del hogar" que se perdieron: puede pasar que el guardado de
// los movimientos (entries) funcione pero el guardado del registro maestro (tarjetasHogar) falle
// por separado (dos llamadas de red distintas). El resultado es un consumo que aparece en el
// detalle de tarjeta de cada persona pero no en la lista "Tarjetas del hogar". Esta función busca,
// dentro de los movimientos del mes actual, cualquier consumo de tarjeta del hogar (identificado
// por tener tarjetaId === hogarId, que es como los genera crearConsumoTarjetaHogar) cuyo id no
// esté en la lista de registros, y lo reconstruye a partir de esos mismos movimientos. Es pura
// (no guarda nada) — quien la llama decide si guardar el resultado.
export function calcularRegistrosTarjetaHogarAReparar({
  entries,
  tarjetasHogar,
  month
}) {
  const candidatos = entries.filter(e => e.tarjetaId && e.hogarId && e.tarjetaId === e.hogarId);
  const porId = {};
  candidatos.forEach(e => {
    if (!porId[e.tarjetaId]) porId[e.tarjetaId] = [];
    porId[e.tarjetaId].push(e);
  });
  const idsExistentes = new Set(tarjetasHogar.map(p => p.id));
  const nuevosRegistros = [];
  Object.entries(porId).forEach(([id, grupo]) => {
    if (idsExistentes.has(id)) return;
    const base = grupo[0];
    const montoCuotaTotal = Math.round(grupo.reduce((s, e) => s + e.monto, 0) * 100) / 100;
    const cuotasTotal = base.cuotasTotal || 1;
    const cuotaIndex = base.cuotaIndex || 1;
    const mesInicio = shiftMonth(month, -(cuotaIndex - 1));
    const descripcionBase = (base.descripcion || "").replace(/\s*\(cuota \d+\/\d+, hogar\)\s*$/, "").replace(/\s*\(hogar\)\s*$/, "").trim();
    nuevosRegistros.push({
      id,
      descripcion: descripcionBase || "Consumo del hogar",
      categoria: base.categoria,
      montoTotal: Math.round(montoCuotaTotal * cuotasTotal * 100) / 100,
      montoCuota: montoCuotaTotal,
      cuotasTotal,
      mesInicio,
      mesesFallidos: []
    });
  });
  return nuevosRegistros;
}
