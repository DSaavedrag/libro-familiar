// Pantalla "Mi cuenta": ingresos/egresos/saldo de una persona, el panel de
// Parametrizar (%), y el bloque de Gastos fijos + Tarjetas + Movimientos.
// La llama LibroFamiliar (menu.js), pasándole los datos y funciones que necesita.
import React, { useState, useEffect } from "react";
import { Pencil, Check, CreditCard, Tags, Trash2, Plus, X } from "lucide-react";
import { PERSONAS, fmt, ICONOS_AGRUPACION, iconoDe } from "./constants.js";
import { FijosSection, TarjetasSection, budgetsFrom, RowEntry } from "./components.js";

// Marcas de referencia debajo de cada slider de Parametrizar: 0, 5, 10, 15... 100.
// Los múltiplos de 10 se dibujan más largos (ver .lf-pct-tick-major en styles.css).
const PCT_TICKS = Array.from({ length: 21 }, (_, i) => i * 5);

export function PersonColumn({
  person,
  data,
  settings,
  budgets,
  onSave,
  categorias,
  onSaveAgrupaciones,
  fijos,
  onSaveFijos,
  onCargarFijos,
  onTogglePagado,
  onRemoveEntry,
  tarjetas,
  month,
  onCargarTarjeta,
  onBorrarTarjeta,
  onEditarTarjeta,
  onRevisarTarjeta,
  onPagarTarjeta,
  cotizacionDolar,
  readOnly
}) {
  const p = PERSONAS[person];
  const cats = categorias || [];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(settings);
  const [editingAgrupaciones, setEditingAgrupaciones] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(settings);
  }, [settings, editing]);
  const draftBudgets = budgetsFrom(draft.pct, data.ingresos, cats);
  const pctTotal = cats.reduce((s, c) => s + (Number(draft.pct[c.id]) || 0), 0);
  function startEditing() {
    setDraft(settings);
    setEditing(true);
  }
  // Cuánto puede valer como máximo el % de esta categoría: 100 menos lo que ya
  // ocupan las demás en el borrador actual. Así ninguna categoría puede
  // crecer más allá del espacio libre.
  function maxPctPara(catId) {
    const usadoPorOtras = cats.filter(c => c.id !== catId).reduce((s, c) => s + (Number(draft.pct[c.id]) || 0), 0);
    return Math.max(0, 100 - usadoPorOtras);
  }
  function setPctClamped(catId, rawValue) {
    const max = maxPctPara(catId);
    const clamped = Math.min(max, Math.max(0, Number(rawValue) || 0));
    setDraft({
      ...draft,
      pct: {
        ...draft.pct,
        [catId]: clamped
      }
    });
  }
  function save() {
    const limpio = Object.fromEntries(cats.map(c => [c.id, Number(draft.pct[c.id]) || 0]));
    const total = Object.values(limpio).reduce((s, v) => s + v, 0);
    if (total > 100) return; // red de seguridad, no debería pasar gracias al clamp de arriba
    onSave({
      pct: limpio
    });
    setEditing(false);
  }
  const pendientesFijos = (fijos || []).filter(f => !data.list.some(e => e.fijoId === f.id)).length;
  const [verDetalleTarjeta, setVerDetalleTarjeta] = useState(false);

  // Qué etiqueta de tarjeta ("Sube", "Viajes", etc.) y qué categoría están
  // desplegadas mostrando sus movimientos uno por uno, en vez de solo el
  // total. Guardamos una sola clave abierta de cada tipo (como un acordeón),
  // no hace falta más para el caso de uso ("me olvido si ya cargué tal cosa").
  const [etiquetaAbierta, setEtiquetaAbierta] = useState(null);
  const [categoriaAbierta, setCategoriaAbierta] = useState(null);
  const tarjetaEntriesMes = data.list.filter(e => e.tipo === "gasto" && (e.tarjetaId || e.esTarjeta));
  const totalTarjetaMes = tarjetaEntriesMes.reduce((s, e) => s + e.monto, 0);
  const detalleTarjetaPorCategoria = cats.map(c => {
    const items = tarjetaEntriesMes.filter(e => e.categoria === c.id);
    if (items.length === 0) return null;
    const porEtiqueta = {};
    items.forEach(e => {
      if (!porEtiqueta[e.descripcion]) porEtiqueta[e.descripcion] = {
        total: 0,
        items: []
      };
      porEtiqueta[e.descripcion].total += e.monto;
      porEtiqueta[e.descripcion].items.push(e);
    });
    return {
      cat: c,
      total: items.reduce((s, e) => s + e.monto, 0),
      porEtiqueta
    };
  }).filter(Boolean);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "lf-swipe-page"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lf-col",
    style: {
      "--accent": `var(${p.cssVar})`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "lf-col-head"
  }, /*#__PURE__*/React.createElement("h3", {
    className: "lf-col-title"
  }, p.label, readOnly && /*#__PURE__*/React.createElement("span", {
    className: "lf-readonly-badge"
  }, "solo lectura")), !readOnly && /*#__PURE__*/React.createElement("div", {
    className: "lf-col-head-btns"
  }, !editingAgrupaciones && /*#__PURE__*/React.createElement("button", {
    className: "lf-edit-btn lf-edit-btn-col",
    onClick: editing ? save : startEditing
  }, editing ? /*#__PURE__*/React.createElement(Check, {
    size: 13
  }) : /*#__PURE__*/React.createElement(Pencil, {
    size: 13
  }), editing ? "Guardar" : "Parametrizar"), !editing && /*#__PURE__*/React.createElement("button", {
    className: "lf-edit-btn lf-edit-btn-col",
    onClick: () => setEditingAgrupaciones(v => !v)
  }, editingAgrupaciones ? /*#__PURE__*/React.createElement(Check, {
    size: 13
  }) : /*#__PURE__*/React.createElement(Tags, {
    size: 13
  }), editingAgrupaciones ? "Listo" : "Agrupaciones"))), editingAgrupaciones && /*#__PURE__*/React.createElement(AgrupacionesEditor, {
    categorias: cats,
    onGuardar: list => {
      onSaveAgrupaciones(list);
      setEditingAgrupaciones(false);
    },
    onCancelar: () => setEditingAgrupaciones(false)
  }), /*#__PURE__*/React.createElement("div", {
    className: "lf-col-totals"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "lf-label"
  }, "Ingresos"), /*#__PURE__*/React.createElement("span", {
    className: "lf-num lf-pos"
  }, fmt(data.ingresos))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "lf-label"
  }, "Gastos"), /*#__PURE__*/React.createElement("span", {
    className: "lf-num lf-neg"
  }, fmt(data.gastos))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "lf-label"
  }, "Saldo"), /*#__PURE__*/React.createElement("span", {
    className: "lf-num " + (data.saldo >= 0 ? "lf-pos" : "lf-neg")
  }, fmt(data.saldo)))), data.pendienteTarjeta > 0 && /*#__PURE__*/React.createElement("div", {
    className: "lf-pendiente-tarjeta"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(CreditCard, {
    size: 13
  }), /*#__PURE__*/React.createElement("span", null, "Tarjeta pendiente de pago (cuotas + consumos tildados)")), /*#__PURE__*/React.createElement("div", {
    className: "lf-pendiente-tarjeta-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lf-num lf-neg"
  }, fmt(data.pendienteTarjeta)), !readOnly && /*#__PURE__*/React.createElement("button", {
    className: "lf-pagar-tarjeta-btn",
    onClick: onPagarTarjeta
  }, "Pagar tarjeta"))), totalTarjetaMes > 0 && /*#__PURE__*/React.createElement("div", {
    className: "lf-tarjeta-detalle"
  }, /*#__PURE__*/React.createElement("button", {
    className: "lf-tarjeta-detalle-toggle",
    onClick: () => setVerDetalleTarjeta(v => !v)
  }, /*#__PURE__*/React.createElement(CreditCard, {
    size: 12
  }), "Consumo de tarjeta este mes: ", /*#__PURE__*/React.createElement("strong", null, fmt(totalTarjetaMes)), /*#__PURE__*/React.createElement("span", {
    className: "lf-tarjeta-detalle-arrow"
  }, verDetalleTarjeta ? "▲" : "▼")), verDetalleTarjeta && /*#__PURE__*/React.createElement("div", {
    className: "lf-tarjeta-detalle-body"
  }, detalleTarjetaPorCategoria.map(({
    cat,
    total,
    porEtiqueta
  }) => /*#__PURE__*/React.createElement("div", {
    className: "lf-tarjeta-detalle-cat",
    key: cat.id
  }, /*#__PURE__*/React.createElement("div", {
    className: "lf-tarjeta-detalle-cat-head"
  }, /*#__PURE__*/React.createElement(iconoDe(cat.icon), {
    size: 12,
    style: {
      color: cat.color
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: cat.color
    }
  }, cat.label), /*#__PURE__*/React.createElement("span", {
    className: "lf-tarjeta-detalle-cat-total"
  }, fmt(total))), Object.entries(porEtiqueta).map(([nombre, {
    total: totalEtiqueta,
    items
  }]) => {
    const key = `${cat.id}::${nombre}`;
    const abierta = etiquetaAbierta === key;
    return /*#__PURE__*/React.createElement("div", {
      className: "lf-tarjeta-detalle-item-wrap",
      key: nombre
    }, /*#__PURE__*/React.createElement("button", {
      className: "lf-tarjeta-detalle-item lf-tarjeta-detalle-item-toggle",
      onClick: () => setEtiquetaAbierta(abierta ? null : key)
    }, /*#__PURE__*/React.createElement("span", null, nombre, " ", /*#__PURE__*/React.createElement("span", {
      className: "lf-tarjeta-detalle-item-count"
    }, "(", items.length, ")")), /*#__PURE__*/React.createElement("span", null, fmt(totalEtiqueta), " ", /*#__PURE__*/React.createElement("span", {
      className: "lf-tarjeta-detalle-arrow"
    }, abierta ? "▲" : "▼"))), abierta && /*#__PURE__*/React.createElement("div", {
      className: "lf-tarjeta-detalle-item-list"
    }, items.map(e => /*#__PURE__*/React.createElement(RowEntry, {
      key: e.id,
      entry: e,
      categorias: cats,
      onTogglePagado: onTogglePagado,
      onRemove: onRemoveEntry,
      readOnly: readOnly
    }))));
  }))))), editing && /*#__PURE__*/React.createElement("p", {
    className: "lf-base-note"
  }, "Se calcula siempre sobre tus ingresos de este mes:", " ", /*#__PURE__*/React.createElement("strong", null, fmt(data.ingresos)), ".", data.ingresos === 0 && " Cargá un ingreso para ver los montos en $."), /*#__PURE__*/React.createElement("div", {
    className: "lf-col-cats"
  }, cats.map(c => {
    const gastado = data.porCategoria[c.id] || 0;
    const presu = editing ? draftBudgets[c.id] : budgets[c.id];
    const pct = presu > 0 ? Math.max(0, Math.min(100, gastado / presu * 100)) : 0;
    const restante = presu - gastado;
    const catAbierta = categoriaAbierta === c.id;
    const movsCategoria = data.list.filter(e => e.tipo === "gasto" && e.categoria === c.id);
    return /*#__PURE__*/React.createElement(React.Fragment, {
      key: c.id
    }, /*#__PURE__*/React.createElement("div", {
      className: "lf-col-cat-row" + (!editing ? " lf-col-cat-row-clickable" : ""),
      onClick: () => {
        if (!editing) setCategoriaAbierta(catAbierta ? null : c.id);
      }
    }, /*#__PURE__*/React.createElement(iconoDe(c.icon), {
      size: 13,
      style: {
        color: c.color
      }
    }), /*#__PURE__*/React.createElement("span", {
      className: "lf-col-cat-label"
    }, c.label), editing ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
      className: "lf-col-pct-edit"
    }, /*#__PURE__*/React.createElement("input", {
      className: "lf-input lf-col-pct-input",
      type: "number",
      value: draft.pct[c.id],
      onChange: e => setPctClamped(c.id, e.target.value)
    }), "%"), /*#__PURE__*/React.createElement("span", {
      className: "lf-col-pct-amount"
    }, "= ", fmt(draftBudgets[c.id])), /*#__PURE__*/React.createElement("div", {
      className: "lf-col-pct-slider-wrap"
    }, /*#__PURE__*/React.createElement("input", {
      className: "lf-col-pct-slider",
      style: {
        "--accent": c.color,
        "--fill": `${Math.min(100, Number(draft.pct[c.id]) || 0)}%`
      },
      type: "range",
      min: 0,
      max: 100, // fijo en 100 a propósito: si esto fuera maxPctPara(c.id) el punto del
      // slider queda pegado al final apenas se achica el espacio libre, aunque el
      // color de fondo (--fill) sí muestre el % real — quedaba confuso. El tope de
      // 100% entre categorías lo sigue haciendo setPctClamped más abajo, no el max.
      step: 5,
      value: Number(draft.pct[c.id]) || 0,
      onChange: e => setPctClamped(c.id, e.target.value)
    }), /*#__PURE__*/React.createElement("div", {
      className: "lf-pct-ticks",
      "aria-hidden": "true"
    }, PCT_TICKS.map(v => /*#__PURE__*/React.createElement("span", {
      key: v,
      className: "lf-pct-tick" + (v % 10 === 0 ? " lf-pct-tick-major" : ""),
      style: {
        left: `${v}%`
      }
    }))))) : /*#__PURE__*/React.createElement("span", {
      className: "lf-col-cat-num-wrap"
    }, /*#__PURE__*/React.createElement("span", {
      className: "lf-col-cat-num"
    }, fmt(gastado)), presu > 0 && /*#__PURE__*/React.createElement("span", {
      className: "lf-col-cat-restante " + (restante >= 0 ? "lf-pos" : "lf-neg")
    }, restante >= 0 ? `Quedan ${fmt(restante)}` : `Excedido ${fmt(Math.abs(restante))}`), /*#__PURE__*/React.createElement("span", {
      className: "lf-col-cat-arrow"
    }, catAbierta ? "▲" : "▼")), !editing && presu > 0 && /*#__PURE__*/React.createElement("div", {
      className: "lf-col-mini-track" + (restante < 0 ? " lf-bar-exceeded" : ""),
      title: `${Math.round(pct)}% usado`,
      style: {
        background: `linear-gradient(to right, ${c.color} ${Math.max(pct, 3)}%, rgba(237,230,214,0.15) ${Math.max(pct, 3)}%)`
      }
    })), !editing && catAbierta && /*#__PURE__*/React.createElement("div", {
      className: "lf-col-cat-mov-list"
    }, movsCategoria.length === 0 ? /*#__PURE__*/React.createElement("p", {
      className: "lf-empty"
    }, "Sin movimientos en ", c.label, " este mes.") : movsCategoria.map(e => /*#__PURE__*/React.createElement(RowEntry, {
      key: e.id,
      entry: e,
      categorias: cats,
      onTogglePagado: onTogglePagado,
      onRemove: onRemoveEntry,
      readOnly: readOnly
    }))));
  }), editing && /*#__PURE__*/React.createElement("p", {
    className: "lf-pct-total lf-pct-total-col" + (pctTotal !== 100 ? " lf-pct-warn" : "")
  }, "Total: ", pctTotal, "% ", pctTotal !== 100 && "— debería sumar 100%"))), /*#__PURE__*/React.createElement("div", {
    className: "lf-col-outer-light"
  }, /*#__PURE__*/React.createElement(FijosSection, {
    accentVar: p.cssVar,
    list: fijos || [],
    pendientes: pendientesFijos,
    categorias: cats,
    onSave: onSaveFijos,
    onCargar: onCargarFijos,
    cotizacionDolar: cotizacionDolar,
    readOnly: readOnly
  }))), /*#__PURE__*/React.createElement("div", {
    className: "lf-swipe-page"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lf-col-outer-light"
  }, /*#__PURE__*/React.createElement(TarjetasSection, {
    accentVar: p.cssVar,
    list: tarjetas || [],
    month: month,
    categorias: cats,
    onCargar: onCargarTarjeta,
    onBorrar: onBorrarTarjeta,
    onEditar: onEditarTarjeta,
    onRevisar: onRevisarTarjeta,
    readOnly: readOnly
  }))), /*#__PURE__*/React.createElement("div", {
    className: "lf-swipe-page"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lf-col-outer-light"
  }, /*#__PURE__*/React.createElement("h4", {
    className: "lf-movs-title"
  }, "Movimientos"), /*#__PURE__*/React.createElement("div", {
    className: "lf-col-list"
  }, data.list.length === 0 && /*#__PURE__*/React.createElement("p", {
    className: "lf-empty"
  }, "Todavía no hay movimientos."), data.list.map(e => /*#__PURE__*/React.createElement(RowEntry, {
    key: e.id,
    entry: e,
    categorias: cats,
    onTogglePagado: onTogglePagado,
    onRemove: onRemoveEntry,
    readOnly: readOnly
  }))))));
}

// Editor de "Agrupaciones" (Ahorros/Necesidades/Liah/Placeres, o lo que cada
// jugador arme): totalmente personalizable — cada jugador tiene su propia
// lista guardada en Firebase (`agrupaciones:{person}`), no hay ninguna fija
// en el código. Acá se puede renombrar, cambiar color e ícono, agregar una
// nueva, o borrar una existente. Nada se guarda en Firebase hasta tocar
// "Guardar" — "Cancelar" descarta todo lo tocado en este panel.
//
// Ojo para quien retome esto: los movimientos ya cargados con una agrupación
// que después se borra o renombra NO se migran ni se pierden — siguen
// guardados con el id viejo, simplemente dejan de encontrar una agrupación
// que les corresponda y se muestran como "Sin categoría" (ver categoriaDe en
// constants.js). Es el mismo criterio que ya usa el resto de la app (no
// migrar datos existentes cuando cambia algo).
function AgrupacionesEditor({
  categorias,
  onGuardar,
  onCancelar
}) {
  const [draft, setDraft] = useState(categorias);
  const [pickerAbierto, setPickerAbierto] = useState(null);
  function addRow() {
    const id = `cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setDraft([...draft, {
      id,
      label: "Nueva agrupación",
      icon: "circle-dashed",
      color: "#5B7A8C"
    }]);
    setPickerAbierto(id);
  }
  function updateRow(id, patch) {
    setDraft(draft.map(c => c.id === id ? {
      ...c,
      ...patch
    } : c));
  }
  function removeRow(id) {
    if (draft.length <= 1) return; // no puede quedar sin ninguna agrupación
    setDraft(draft.filter(c => c.id !== id));
    if (pickerAbierto === id) setPickerAbierto(null);
  }
  function guardar() {
    const limpio = draft.map(c => ({
      ...c,
      label: c.label.trim() || "Sin nombre"
    }));
    onGuardar(limpio);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "lf-agrup-editor"
  }, /*#__PURE__*/React.createElement("p", {
    className: "lf-agrup-hint"
  }, "Son tuyas: nombre, color e ícono, sin límite de cuántas armes. No afectan las agrupaciones de ", /*#__PURE__*/React.createElement("strong", null, "el otro jugador"), " — cada uno arma las suyas."), draft.map(c => /*#__PURE__*/React.createElement("div", {
    className: "lf-agrup-row",
    key: c.id
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "lf-agrup-icon-current",
    style: {
      "--accent": c.color
    },
    onClick: () => setPickerAbierto(pickerAbierto === c.id ? null : c.id),
    "aria-label": "Elegir ícono"
  }, /*#__PURE__*/React.createElement(iconoDe(c.icon), {
    size: 15
  })), /*#__PURE__*/React.createElement("input", {
    className: "lf-input lf-agrup-nombre",
    type: "text",
    placeholder: "Nombre (ej: Vacaciones)",
    value: c.label,
    onChange: e => updateRow(c.id, {
      label: e.target.value
    })
  }), /*#__PURE__*/React.createElement("input", {
    className: "lf-agrup-color-input",
    type: "color",
    value: c.color,
    onChange: e => updateRow(c.id, {
      color: e.target.value
    }),
    "aria-label": "Elegir color"
  }), /*#__PURE__*/React.createElement("button", {
    className: "lf-fijo-del",
    onClick: () => removeRow(c.id),
    disabled: draft.length <= 1,
    title: draft.length <= 1 ? "Tiene que quedar al menos una agrupación" : "Eliminar",
    "aria-label": "Eliminar agrupación"
  }, /*#__PURE__*/React.createElement(Trash2, {
    size: 14
  })), pickerAbierto === c.id && /*#__PURE__*/React.createElement("div", {
    className: "lf-agrup-icon-grid"
  }, ICONOS_AGRUPACION.map(i => /*#__PURE__*/React.createElement("button", {
    key: i.id,
    type: "button",
    className: "lf-agrup-icon-opt" + (i.id === c.icon ? " on" : ""),
    title: i.label,
    onClick: () => {
      updateRow(c.id, {
        icon: i.id
      });
      setPickerAbierto(null);
    }
  }, /*#__PURE__*/React.createElement(i.Icon, {
    size: 15
  })))))), /*#__PURE__*/React.createElement("button", {
    className: "lf-fijo-add",
    onClick: addRow
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 13
  }), " Agregar agrupación"), /*#__PURE__*/React.createElement("div", {
    className: "lf-agrup-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "lf-add-btn",
    onClick: guardar
  }, /*#__PURE__*/React.createElement(Check, {
    size: 14
  }), " Guardar"), /*#__PURE__*/React.createElement("button", {
    className: "lf-agrup-cancel",
    onClick: onCancelar
  }, /*#__PURE__*/React.createElement(X, {
    size: 14
  }), " Cancelar")));
}
