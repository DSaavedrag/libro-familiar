// Pantalla "Ahorros": reservas de ahorro (personales o compartidas), sus
// totales y el detalle/edición de cada una. La llama LibroFamiliar (menu.js).
import React, { useState, useEffect } from "react";
import { PiggyBank, Plus, Trash2, Pencil } from "lucide-react";
import { PERSONAS, fmt } from "./constants.js";

export function AhorrosSection({
  reservas,
  activePerson,
  onSaveReservas
}) {
  const e = React.createElement;
  const [creating, setCreating] = useState(false);
  const [newNombre, setNewNombre] = useState("");
  const [newScope, setNewScope] = useState(activePerson || "diego");
  const [newMeta, setNewMeta] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [movMonto, setMovMonto] = useState("");
  const [movNota, setMovNota] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [editingReserva, setEditingReserva] = useState(false);
  const [editNombre, setEditNombre] = useState("");
  const [editScope, setEditScope] = useState("diego");
  const [editMeta, setEditMeta] = useState("");
  function totalDe(r) {
    return (r.movimientos || []).reduce((s, m) => s + (Number(m.monto) || 0), 0);
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
  const totalPersonal = reservas.filter(r => r.scope === activePerson).reduce((s, r) => s + totalDe(r), 0);
  const totalCompartida = reservas.filter(r => r.scope === "compartida").reduce((s, r) => s + totalDe(r), 0);
  const totalGeneral = totalPersonal + totalCompartida;
  function crearReserva() {
    const nombre = newNombre.trim();
    if (!nombre) return;
    const nueva = {
      id: `res-${Date.now()}`,
      nombre,
      scope: newScope,
      meta: newMeta ? Number(newMeta) || 0 : null,
      movimientos: []
    };
    onSaveReservas([...reservas, nueva]);
    setNewNombre("");
    setNewMeta("");
    setNewScope(activePerson || "diego");
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
    setEditingReserva(true);
  }
  function guardarEdicionReserva(reservaId) {
    const nombre = editNombre.trim();
    if (!nombre) return;
    const next = reservas.map(r => r.id === reservaId ? {
      ...r,
      nombre,
      scope: editScope,
      meta: editMeta ? Number(editMeta) || 0 : null
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
  }, "Compartida")), e("input", {
    type: "number",
    placeholder: "Meta en $ (opcional)",
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
    style: { color: "var(--ink)", opacity: 0.6 },
    onClick: () => iniciarEdicion(seleccionada),
    title: "Editar reserva"
  }, e(Pencil, {
    size: 13
  }))), editingReserva ? null : e("p", {
    className: "lf-reserva-total"
  }, fmt(totalDe(seleccionada)), seleccionada.meta ? ` / meta ${fmt(seleccionada.meta)}` : ""), editingReserva ? null : seleccionada.meta ? e("div", {
    className: "lf-bar-track",
    title: `${Math.round(Math.min(100, totalDe(seleccionada) / seleccionada.meta * 100))}% de la meta`,
    style: {
      background: `linear-gradient(to right, ${colorDe(seleccionada.scope) === "var(--c-diego)" ? "#33566C" : colorDe(seleccionada.scope) === "var(--c-yani)" ? "#8C3F52" : "#4F7A5B"} ${Math.max(3, Math.min(100, totalDe(seleccionada) / seleccionada.meta * 100))}%, rgba(35,48,59,0.08) ${Math.max(3, Math.min(100, totalDe(seleccionada) / seleccionada.meta * 100))}%)`
    }
  }) : null, e("div", {
    className: "lf-reserva-mov-form"
  }, e("input", {
    type: "number",
    placeholder: "Monto (+ para sumar, - para sacar)",
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
  }, fmt(m.monto)), e("span", {
    className: "lf-reserva-mov-nota"
  }, m.nota || "—"), e("button", {
    className: "lf-mini-del",
    onClick: () => borrarMovimiento(seleccionada.id, m.id),
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
    }, fmt(total)), r.meta ? e("div", {
      className: "lf-col-mini-track",
      title: `${Math.round(total / r.meta * 100)}% de la meta`,
      style: {
        background: `linear-gradient(to right, ${r.scope === "diego" ? "#33566C" : r.scope === "yani" ? "#8C3F52" : "#4F7A5B"} ${pct}%, rgba(237,230,214,0.15) ${pct}%)`
      }
    }) : null, r.meta ? e("span", {
      className: "lf-reserva-meta-label"
    }, "meta ", fmt(r.meta)) : null);
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
  }, "Compartida")), e("input", {
    type: "number",
    placeholder: "Meta en $ (opcional)",
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
