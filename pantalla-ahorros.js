// Pantalla "Ahorros": reservas de ahorro (personales o compartidas), sus
// totales y el detalle/edición de cada una. La llama LibroFamiliar (menu.js).
//
// Cada reserva puede ahorrarse en una divisa distinta a pesos (dólares,
// BTC, o cualquier otra que se le ocurra escribir) — ver MONEDAS más abajo.
// Los movimientos de una reserva siempre están en SU propia divisa (ej: una
// reserva en BTC guarda 0.0023, no su equivalente en pesos); para poder
// sumar reservas de distintas divisas en los totales generales, cada una
// (salvo la de pesos) guarda también su propia cotización (cuántos pesos
// vale 1 unidad), cargada a mano — no hay forma de traer en vivo la
// cotización de cualquier cripto que alguien pueda llegar a escribir acá,
// así que es siempre manual (la de dólares arranca precargada con la
// cotización que ya usa el resto de la app, como punto de partida).
import React, { useState, useEffect } from "react";
import { PiggyBank, Plus, Trash2, Pencil, Check, X, RefreshCw } from "lucide-react";
import { PERSONAS, fmt } from "./constants.js";
import { fetchCotizacionCripto } from "./storage.js";

// `coingeckoId` es el identificador que usa la API de CoinGecko para traer
// la cotización en vivo (ver fetchCotizacionCripto en storage.js) — solo
// las presets de abajo lo tienen; una divisa cargada a mano con "Otra"
// siempre queda en modo manual, porque no hay forma confiable de adivinar
// qué id de CoinGecko corresponde a un ticker arbitrario.
const MONEDAS = [{
  id: "ARS",
  label: "$ ARS"
}, {
  id: "USD",
  label: "u$s USD"
}, {
  id: "BTC",
  label: "₿ BTC",
  coingeckoId: "bitcoin"
}, {
  id: "ETH",
  label: "Ξ ETH",
  coingeckoId: "ethereum"
}];

// Formatea un monto en SU propia divisa (no en pesos): para pesos usa el
// mismo `fmt` de siempre ("$ 1.234,56"); para cualquier otra, el número tal
// cual (sin forzar 2 decimales — una cripto puede necesitar bastantes más,
// ej 0.00032154) seguido del código de la divisa.
function fmtNativo(monto, moneda) {
  if (!moneda || moneda === "ARS") return fmt(monto);
  const num = Number(monto) || 0;
  return `${num} ${moneda}`;
}

export function AhorrosSection({
  reservas,
  activePerson,
  onSaveReservas,
  cotizacionDolar
}) {
  const e = React.createElement;
  const [creating, setCreating] = useState(false);
  const [newNombre, setNewNombre] = useState("");
  const [newScope, setNewScope] = useState(activePerson || "diego");
  const [newMeta, setNewMeta] = useState("");
  const [newMoneda, setNewMoneda] = useState("ARS");
  const [newMonedaOtra, setNewMonedaOtra] = useState("");
  const [newCotizacion, setNewCotizacion] = useState("");
  const [loadingLiveNew, setLoadingLiveNew] = useState(false);
  const [liveFailedNew, setLiveFailedNew] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [movMonto, setMovMonto] = useState("");
  const [movNota, setMovNota] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  // El tacho de un movimiento de reserva borraba directo, sin avisar — a
  // diferencia de "Borrar reserva" (unas líneas más abajo) que ya pedía
  // confirmar. Mismo patrón que Movimientos/Tarjetas: primer toque pide
  // confirmar (✓/✗).
  const [confirmDeleteMovId, setConfirmDeleteMovId] = useState(null);
  const [editingReserva, setEditingReserva] = useState(false);
  const [editNombre, setEditNombre] = useState("");
  const [editScope, setEditScope] = useState("diego");
  const [editMeta, setEditMeta] = useState("");
  const [editMoneda, setEditMoneda] = useState("ARS");
  const [editMonedaOtra, setEditMonedaOtra] = useState("");
  const [editCotizacion, setEditCotizacion] = useState("");
  const [loadingLiveEdit, setLoadingLiveEdit] = useState(false);
  const [liveFailedEdit, setLiveFailedEdit] = useState(false);
  // Total en la divisa PROPIA de la reserva (lo que ya hacía totalDe antes
  // de poder elegir divisa) — para una reserva en BTC, por ejemplo, da BTC.
  function totalDe(r) {
    return (r.movimientos || []).reduce((s, m) => s + (Number(m.monto) || 0), 0);
  }
  // Total convertido a pesos — para una reserva en pesos es lo mismo que
  // totalDe; para cualquier otra divisa, usa la cotización guardada en la
  // reserva (0 si todavía no cargó ninguna). Es lo que hace falta para
  // poder sumar reservas de distintas divisas en un solo total general.
  function totalArsDe(r) {
    const total = totalDe(r);
    if (!r.moneda || r.moneda === "ARS") return total;
    return total * (Number(r.cotizacion) || 0);
  }
  function colorDe(scope) {
    if (scope === "diego") return "var(--c-diego)";
    if (scope === "yani") return "var(--c-yani)";
    return "var(--c-ahorros)";
  }
  function labelScope(scope) {
    if (scope === "compartida") return "Compartida";
    return PERSONAS[scope] ? PERSONAS[scope].label : scope;
  }
  const reservasVisibles = reservas.filter(r => r.scope === activePerson || r.scope === "compartida");
  const totalPersonal = reservas.filter(r => r.scope === activePerson).reduce((s, r) => s + totalArsDe(r), 0);
  const totalCompartida = reservas.filter(r => r.scope === "compartida").reduce((s, r) => s + totalArsDe(r), 0);
  const totalGeneral = totalPersonal + totalCompartida;
  async function traerCotizacionLiveNew() {
    const m = MONEDAS.find(x => x.id === newMoneda);
    if (!m || !m.coingeckoId) return;
    setLoadingLiveNew(true);
    setLiveFailedNew(false);
    const valor = await fetchCotizacionCripto(m.coingeckoId);
    setLoadingLiveNew(false);
    if (valor) setNewCotizacion(String(valor));
    else setLiveFailedNew(true);
  }
  async function traerCotizacionLiveEdit() {
    const m = MONEDAS.find(x => x.id === editMoneda);
    if (!m || !m.coingeckoId) return;
    setLoadingLiveEdit(true);
    setLiveFailedEdit(false);
    const valor = await fetchCotizacionCripto(m.coingeckoId);
    setLoadingLiveEdit(false);
    if (valor) setEditCotizacion(String(valor));
    else setLiveFailedEdit(true);
  }
  function crearReserva() {
    const nombre = newNombre.trim();
    if (!nombre) return;
    const moneda = newMoneda === "OTRA" ? newMonedaOtra.trim().toUpperCase() : newMoneda;
    if (!moneda) return;
    const nueva = {
      id: `res-${Date.now()}`,
      nombre,
      scope: newScope,
      meta: newMeta ? Number(newMeta) || 0 : null,
      moneda,
      cotizacion: moneda === "ARS" ? null : Number(newCotizacion) || 0,
      movimientos: []
    };
    onSaveReservas([...reservas, nueva]);
    setNewNombre("");
    setNewMeta("");
    setNewScope(activePerson || "diego");
    setNewMoneda("ARS");
    setNewMonedaOtra("");
    setNewCotizacion("");
    setCreating(false);
    setSelectedId(nueva.id);
  }
  function borrarReserva(id) {
    onSaveReservas(reservas.filter(r => r.id !== id));
    setConfirmDeleteId(null);
    if (selectedId === id) setSelectedId(null);
  }
  function agregarMovimiento(reservaId) {
    const monto = Number(movMonto);
    if (!monto) return;
    const nuevoMov = {
      id: `mov-${Date.now()}`,
      monto,
      nota: movNota.trim(),
      ts: Date.now()
    };
    const next = reservas.map(r => r.id === reservaId ? {
      ...r,
      movimientos: [nuevoMov, ...(r.movimientos || [])]
    } : r);
    onSaveReservas(next);
    setMovMonto("");
    setMovNota("");
  }
  function borrarMovimiento(reservaId, movId) {
    const next = reservas.map(r => r.id === reservaId ? {
      ...r,
      movimientos: (r.movimientos || []).filter(m => m.id !== movId)
    } : r);
    onSaveReservas(next);
  }
  function iniciarEdicion(r) {
    setEditNombre(r.nombre);
    setEditScope(r.scope);
    setEditMeta(r.meta ? String(r.meta) : "");
    const monedaActual = r.moneda || "ARS";
    const esPreset = MONEDAS.some(m => m.id === monedaActual);
    setEditMoneda(esPreset ? monedaActual : "OTRA");
    setEditMonedaOtra(esPreset ? "" : monedaActual);
    setEditCotizacion(r.cotizacion ? String(r.cotizacion) : "");
    setEditingReserva(true);
  }
  function guardarEdicionReserva(reservaId) {
    const nombre = editNombre.trim();
    if (!nombre) return;
    const moneda = editMoneda === "OTRA" ? editMonedaOtra.trim().toUpperCase() : editMoneda;
    if (!moneda) return;
    const next = reservas.map(r => r.id === reservaId ? {
      ...r,
      nombre,
      scope: editScope,
      meta: editMeta ? Number(editMeta) || 0 : null,
      moneda,
      cotizacion: moneda === "ARS" ? null : Number(editCotizacion) || 0
    } : r);
    onSaveReservas(next);
    setEditingReserva(false);
  }
  useEffect(() => {
    setEditingReserva(false);
    setMovMonto("");
    setMovNota("");
    setConfirmDeleteId(null);
  }, [selectedId]);
  const seleccionada = selectedId ? reservas.find(r => r.id === selectedId) : null;
  return e("section", {
    className: "lf-ahorros"
  }, e("div", {
    className: "lf-ahorros-head"
  }, e("h2", null, "Ahorros")), e("div", {
    className: "lf-ahorros-totals"
  }, e("div", null, e("span", {
    className: "lf-label"
  }, "Tu ahorro personal"), e("span", {
    className: "lf-num lf-pos"
  }, fmt(totalPersonal))), e("div", null, e("span", {
    className: "lf-label"
  }, "Ahorro compartido"), e("span", {
    className: "lf-num lf-pos"
  }, fmt(totalCompartida))), e("div", null, e("span", {
    className: "lf-label"
  }, "Total"), e("span", {
    className: "lf-num lf-pos"
  }, fmt(totalGeneral)))), seleccionada ? e("div", {
    className: "lf-reserva-detalle"
  }, e("button", {
    className: "lf-reserva-back",
    onClick: () => setSelectedId(null)
  }, "← Volver a mis ahorros"), editingReserva ? e("div", {
    className: "lf-reserva-nueva-form"
  }, e("input", {
    type: "text",
    placeholder: "Nombre",
    value: editNombre,
    onChange: ev => setEditNombre(ev.target.value)
  }), e("div", {
    className: "lf-scope-toggle"
  }, e("button", {
    className: editScope === "diego" ? "on" : "",
    style: editScope === "diego" ? { background: "var(--c-diego)", color: "var(--paper)", borderColor: "var(--c-diego)" } : undefined,
    onClick: () => setEditScope("diego")
  }, "Diego"), e("button", {
    className: editScope === "yani" ? "on" : "",
    style: editScope === "yani" ? { background: "var(--c-yani)", color: "var(--paper)", borderColor: "var(--c-yani)" } : undefined,
    onClick: () => setEditScope("yani")
  }, "Yani"), e("button", {
    className: editScope === "compartida" ? "on" : "",
    style: editScope === "compartida" ? { background: "var(--c-ahorros)", color: "var(--paper)", borderColor: "var(--c-ahorros)" } : undefined,
    onClick: () => setEditScope("compartida")
  }, "Compartida")), e("div", {
    className: "lf-moneda-toggle"
  }, MONEDAS.map(m => e("button", {
    key: m.id,
    className: editMoneda === m.id ? "on" : "",
    onClick: () => {
      setEditMoneda(m.id);
      if (m.id === "USD" && !editCotizacion && cotizacionDolar) setEditCotizacion(String(cotizacionDolar));
    }
  }, m.label)), e("button", {
    className: editMoneda === "OTRA" ? "on" : "",
    onClick: () => setEditMoneda("OTRA")
  }, "Otra")), editMoneda === "OTRA" ? e("input", {
    type: "text",
    placeholder: "Código de la divisa (ej: SOL, DOGE)",
    value: editMonedaOtra,
    onChange: ev => setEditMonedaOtra(ev.target.value)
  }) : null, editMoneda !== "ARS" ? e("div", {
    className: "lf-cotizacion-edit-row"
  }, e("input", {
    type: "number",
    placeholder: `Cotización (1 ${editMoneda === "OTRA" ? editMonedaOtra.trim().toUpperCase() || "?" : editMoneda} = $ X ARS)`,
    value: editCotizacion,
    onChange: ev => setEditCotizacion(ev.target.value)
  }), MONEDAS.find(m => m.id === editMoneda && m.coingeckoId) ? e("button", {
    type: "button",
    className: "lf-cotizacion-live-btn",
    onClick: traerCotizacionLiveEdit,
    disabled: loadingLiveEdit,
    title: "Traer cotización en vivo"
  }, e(RefreshCw, {
    size: 13,
    className: loadingLiveEdit ? "lf-spin" : ""
  }), " Traer en vivo") : null) : null, editMoneda !== "ARS" && liveFailedEdit ? e("p", {
    className: "lf-empty"
  }, "No se pudo traer la cotización en vivo. Cargala a mano.") : null, e("input", {
    type: "number",
    placeholder: "Meta (opcional)",
    value: editMeta,
    onChange: ev => setEditMeta(ev.target.value)
  }), e("div", {
    className: "lf-reserva-nueva-btns"
  }, e("button", {
    className: "lf-reset-confirm-yes",
    onClick: () => guardarEdicionReserva(seleccionada.id),
    disabled: !editNombre.trim()
  }, "Guardar cambios"), e("button", {
    className: "lf-reset-confirm-no",
    onClick: () => setEditingReserva(false)
  }, "Cancelar"))) : e("div", {
    className: "lf-reserva-detalle-head"
  }, e("h3", null, seleccionada.nombre), e("span", {
    className: "lf-reserva-scope-badge",
    style: {
      color: colorDe(seleccionada.scope)
    }
  }, labelScope(seleccionada.scope)), e("button", {
    className: "lf-mini-del",
    style: { color: "var(--paper)", opacity: 0.6 },
    onClick: () => iniciarEdicion(seleccionada),
    title: "Editar reserva"
  }, e(Pencil, {
    size: 13
  }))), editingReserva ? null : e("p", {
    className: "lf-reserva-total"
  }, fmtNativo(totalDe(seleccionada), seleccionada.moneda), seleccionada.moneda && seleccionada.moneda !== "ARS" ? ` (≈ ${fmt(totalArsDe(seleccionada))})` : "", seleccionada.meta ? ` / meta ${fmtNativo(seleccionada.meta, seleccionada.moneda)}` : ""), editingReserva ? null : seleccionada.meta ? e("div", {
    className: "lf-bar-track",
    title: `${Math.round(Math.min(100, totalDe(seleccionada) / seleccionada.meta * 100))}% de la meta`,
    style: {
      background: `linear-gradient(to right, ${colorDe(seleccionada.scope) === "var(--c-diego)" ? "#C31015" : colorDe(seleccionada.scope) === "var(--c-yani)" ? "#9C6408" : "#F2E5DC"} ${Math.max(3, Math.min(100, totalDe(seleccionada) / seleccionada.meta * 100))}%, rgba(36,20,18,0.08) ${Math.max(3, Math.min(100, totalDe(seleccionada) / seleccionada.meta * 100))}%)`
    }
  }) : null, e("div", {
    className: "lf-reserva-mov-form"
  }, e("input", {
    type: "number",
    placeholder: `Monto en ${seleccionada.moneda || "ARS"} (+ para sumar, - para sacar)`,
    value: movMonto,
    onChange: ev => setMovMonto(ev.target.value)
  }), e("input", {
    type: "text",
    placeholder: "Nota (opcional)",
    value: movNota,
    onChange: ev => setMovNota(ev.target.value)
  }), e("button", {
    onClick: () => agregarMovimiento(seleccionada.id),
    disabled: !movMonto
  }, e(Plus, {
    size: 14
  }), " Registrar")), e("div", {
    className: "lf-reserva-mov-list"
  }, (seleccionada.movimientos || []).length === 0 ? e("p", {
    className: "lf-empty"
  }, "Todavía no cargaste movimientos en esta reserva.") : (seleccionada.movimientos || []).map(m => e("div", {
    className: "lf-reserva-mov-row",
    key: m.id
  }, e("span", {
    className: "lf-num " + (m.monto >= 0 ? "lf-pos" : "lf-neg")
  }, fmtNativo(m.monto, seleccionada.moneda)), e("span", {
    className: "lf-reserva-mov-nota"
  }, m.nota || "—"), confirmDeleteMovId === m.id ? e(React.Fragment, null, e("button", {
    className: "lf-entry-del-confirm-yes",
    onClick: () => {
      borrarMovimiento(seleccionada.id, m.id);
      setConfirmDeleteMovId(null);
    },
    "aria-label": "Confirmar: borrar movimiento",
    title: "Sí, borrar"
  }, e(Check, {
    size: 12
  })), e("button", {
    className: "lf-entry-del-confirm-no",
    onClick: () => setConfirmDeleteMovId(null),
    "aria-label": "Cancelar",
    title: "Cancelar"
  }, e(X, {
    size: 12
  }))) : e("button", {
    className: "lf-mini-del",
    onClick: () => setConfirmDeleteMovId(m.id),
    title: "Borrar movimiento"
  }, e(Trash2, {
    size: 12
  }))))), e("div", {
    className: "lf-reserva-detalle-footer"
  }, confirmDeleteId === seleccionada.id ? e(React.Fragment, null, e("span", null, "¿Borrar esta reserva y todo su historial?"), e("button", {
    className: "lf-reset-confirm-yes",
    onClick: () => borrarReserva(seleccionada.id)
  }, "Sí, borrar"), e("button", {
    className: "lf-reset-confirm-no",
    onClick: () => setConfirmDeleteId(null)
  }, "Cancelar")) : e("button", {
    className: "lf-reserva-del-btn",
    onClick: () => setConfirmDeleteId(seleccionada.id)
  }, e(Trash2, {
    size: 13
  }), " Borrar reserva"))) : e(React.Fragment, null, e("div", {
    className: "lf-reservas-list"
  }, reservasVisibles.map(r => {
    const total = totalDe(r);
    const pct = r.meta ? Math.max(3, Math.min(100, total / r.meta * 100)) : 0;
    return e("button", {
      key: r.id,
      className: "lf-reserva-card",
      onClick: () => setSelectedId(r.id),
      style: {
        "--accent": colorDe(r.scope)
      }
    }, e("div", {
      className: "lf-reserva-card-head"
    }, e(PiggyBank, {
      size: 16,
      style: {
        color: colorDe(r.scope)
      }
    }), e("span", {
      className: "lf-reserva-card-nombre"
    }, r.nombre), e("span", {
      className: "lf-reserva-scope-badge",
      style: {
        color: colorDe(r.scope)
      }
    }, labelScope(r.scope))), e("span", {
      className: "lf-num lf-pos"
    }, fmtNativo(total, r.moneda), r.moneda && r.moneda !== "ARS" ? e("span", {
      className: "lf-reserva-card-ars"
    }, ` ≈ ${fmt(totalArsDe(r))}`) : null), r.meta ? e("div", {
      className: "lf-col-mini-track",
      title: `${Math.round(total / r.meta * 100)}% de la meta`,
      style: {
        background: `linear-gradient(to right, ${r.scope === "diego" ? "#C31015" : r.scope === "yani" ? "#9C6408" : "#F2E5DC"} ${pct}%, rgba(242,229,220,0.15) ${pct}%)`
      }
    }) : null, r.meta ? e("span", {
      className: "lf-reserva-meta-label"
    }, "meta ", fmtNativo(r.meta, r.moneda)) : null);
  })), reservasVisibles.length === 0 && !creating ? e("p", {
    className: "lf-empty"
  }, "Todavía no creaste ninguna reserva de ahorro.") : null, creating ? e("div", {
    className: "lf-reserva-nueva-form"
  }, e("input", {
    type: "text",
    placeholder: "Nombre (ej: Vacaciones, Auto, Emergencia)",
    value: newNombre,
    onChange: ev => setNewNombre(ev.target.value)
  }), e("div", {
    className: "lf-scope-toggle"
  }, e("button", {
    className: newScope === "diego" ? "on" : "",
    style: newScope === "diego" ? { background: "var(--c-diego)", color: "var(--paper)", borderColor: "var(--c-diego)" } : undefined,
    onClick: () => setNewScope("diego")
  }, "Diego"), e("button", {
    className: newScope === "yani" ? "on" : "",
    style: newScope === "yani" ? { background: "var(--c-yani)", color: "var(--paper)", borderColor: "var(--c-yani)" } : undefined,
    onClick: () => setNewScope("yani")
  }, "Yani"), e("button", {
    className: newScope === "compartida" ? "on" : "",
    style: newScope === "compartida" ? { background: "var(--c-ahorros)", color: "var(--paper)", borderColor: "var(--c-ahorros)" } : undefined,
    onClick: () => setNewScope("compartida")
  }, "Compartida")), e("div", {
    className: "lf-moneda-toggle"
  }, MONEDAS.map(m => e("button", {
    key: m.id,
    className: newMoneda === m.id ? "on" : "",
    onClick: () => {
      setNewMoneda(m.id);
      if (m.id === "USD" && !newCotizacion && cotizacionDolar) setNewCotizacion(String(cotizacionDolar));
    }
  }, m.label)), e("button", {
    className: newMoneda === "OTRA" ? "on" : "",
    onClick: () => setNewMoneda("OTRA")
  }, "Otra")), newMoneda === "OTRA" ? e("input", {
    type: "text",
    placeholder: "Código de la divisa (ej: SOL, DOGE)",
    value: newMonedaOtra,
    onChange: ev => setNewMonedaOtra(ev.target.value)
  }) : null, newMoneda !== "ARS" ? e("div", {
    className: "lf-cotizacion-edit-row"
  }, e("input", {
    type: "number",
    placeholder: `Cotización (1 ${newMoneda === "OTRA" ? newMonedaOtra.trim().toUpperCase() || "?" : newMoneda} = $ X ARS)`,
    value: newCotizacion,
    onChange: ev => setNewCotizacion(ev.target.value)
  }), MONEDAS.find(m => m.id === newMoneda && m.coingeckoId) ? e("button", {
    type: "button",
    className: "lf-cotizacion-live-btn",
    onClick: traerCotizacionLiveNew,
    disabled: loadingLiveNew,
    title: "Traer cotización en vivo"
  }, e(RefreshCw, {
    size: 13,
    className: loadingLiveNew ? "lf-spin" : ""
  }), " Traer en vivo") : null) : null, newMoneda !== "ARS" && liveFailedNew ? e("p", {
    className: "lf-empty"
  }, "No se pudo traer la cotización en vivo. Cargala a mano.") : null, e("input", {
    type: "number",
    placeholder: "Meta (opcional)",
    value: newMeta,
    onChange: ev => setNewMeta(ev.target.value)
  }), e("div", {
    className: "lf-reserva-nueva-btns"
  }, e("button", {
    className: "lf-reset-confirm-yes",
    onClick: crearReserva,
    disabled: !newNombre.trim()
  }, "Crear reserva"), e("button", {
    className: "lf-reset-confirm-no",
    onClick: () => setCreating(false)
  }, "Cancelar"))) : e("button", {
    className: "lf-reserva-add-btn",
    onClick: () => setCreating(true)
  }, e(Plus, {
    size: 15
  }), " Nueva reserva")));
}
