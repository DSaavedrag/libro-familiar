// Pantalla "Mi cuenta": ingresos/egresos/saldo de una persona, el panel de
// Parametrizar (%), y el bloque de Gastos fijos + Tarjetas + Movimientos.
// La llama LibroFamiliar (menu.js), pasándole los datos y funciones que necesita.
import React, { useState, useEffect } from "react";
import { Pencil, Check, CreditCard } from "lucide-react";
import { CATEGORIAS, PERSONAS, fmt } from "./constants.js";
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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(settings);
  useEffect(() => {
    if (!editing) setDraft(settings);
  }, [settings, editing]);
  const draftBudgets = budgetsFrom(draft.pct, data.ingresos);
  const pctTotal = CATEGORIAS.reduce((s, c) => s + (Number(draft.pct[c.id]) || 0), 0);
  function startEditing() {
    setDraft(settings);
    setEditing(true);
  }
  // Cuánto puede valer como máximo el % de esta categoría: 100 menos lo que ya
  // ocupan las otras tres en el borrador actual. Así ninguna categoría puede
  // crecer más allá del espacio libre.
  function maxPctPara(catId) {
    const usadoPorOtras = CATEGORIAS.filter(c => c.id !== catId).reduce((s, c) => s + (Number(draft.pct[c.id]) || 0), 0);
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
    const limpio = Object.fromEntries(CATEGORIAS.map(c => [c.id, Number(draft.pct[c.id]) || 0]));
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
  const detalleTarjetaPorCategoria = CATEGORIAS.map(c => {
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
  }, "solo lectura")), !readOnly && /*#__PURE__*/React.createElement("button", {
    className: "lf-edit-btn lf-edit-btn-col",
    onClick: editing ? save : startEditing
  }, editing ? /*#__PURE__*/React.createElement(Check, {
    size: 13
  }) : /*#__PURE__*/React.createElement(Pencil, {
    size: 13
  }), editing ? "Guardar" : "Parametrizar")), /*#__PURE__*/React.createElement("div", {
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
  }, /*#__PURE__*/React.createElement(cat.Icon, {
    size: 12,
    style: {
      color: `var(${cat.cssVar})`
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: `var(${cat.cssVar})`
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
      onTogglePagado: onTogglePagado,
      onRemove: onRemoveEntry,
      readOnly: readOnly
    }))));
  }))))), editing && /*#__PURE__*/React.createElement("p", {
    className: "lf-base-note"
  }, "Se calcula siempre sobre tus ingresos de este mes:", " ", /*#__PURE__*/React.createElement("strong", null, fmt(data.ingresos)), ".", data.ingresos === 0 && " Cargá un ingreso para ver los montos en $."), /*#__PURE__*/React.createElement("div", {
    className: "lf-col-cats"
  }, CATEGORIAS.map(c => {
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
    }, /*#__PURE__*/React.createElement(c.Icon, {
      size: 13,
      style: {
        color: `var(${c.cssVar})`
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
        "--accent": `var(${c.cssVar})`,
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
    onTogglePagado: onTogglePagado,
    onRemove: onRemoveEntry,
    readOnly: readOnly
  }))))));
}
