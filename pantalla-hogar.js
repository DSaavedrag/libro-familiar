// Pantalla "Hogar — gastos compartidos": gastos fijos del hogar, el reparto
// Diego/Yani, la cotización del dólar y las tarjetas del hogar. La llama
// LibroFamiliar (menu.js).
import React, { useState, useEffect } from "react";
import { Plus, Trash2, Pencil, Check } from "lucide-react";
import { CATEGORIAS, fmt } from "./constants.js";
import { CategoryDots, TarjetasHogarSection } from "./components.js";

export function HogarSection({
  list,
  split,
  entries,
  onSaveAll,
  onCargar,
  cotizacionDolar,
  onGuardarCotizacion,
  onActualizarCotizacionLive,
  tarjetasHogar,
  month,
  onCargarTarjetaHogar,
  onBorrarTarjetaHogar,
  onEditarTarjetaHogar,
  onRevisarTarjetaHogar,
  onRepararTarjetaHogar
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(list);
  const [splitDraft, setSplitDraft] = useState(split.diego);
  useEffect(() => {
    if (!editing) {
      setDraft(list);
      setSplitDraft(split.diego);
    }
  }, [list, split, editing]);
  const pendientes = list.filter(f => !entries.some(e => e.hogarId === f.id)).length;
  function addRow() {
    setDraft([...draft, {
      id: `hogar-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      nombre: "",
      monto: "",
      categoria: "necesidades"
    }]);
  }
  function updateRow(id, patch) {
    setDraft(draft.map(f => f.id === id ? {
      ...f,
      ...patch
    } : f));
  }
  function removeRow(id) {
    setDraft(draft.filter(f => f.id !== id));
  }
  function save() {
    const limpio = draft.filter(f => f.nombre.trim()).map(f => ({
      ...f,
      monto: Number(f.monto) || 0
    }));
    onSaveAll(limpio, Number(splitDraft) || 0);
    setEditing(false);
  }
  return /*#__PURE__*/React.createElement("section", {
    className: "lf-hogar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lf-col-head lf-fijos-head"
  }, /*#__PURE__*/React.createElement("h2", {
    className: "lf-hogar-title"
  }, "Hogar — gastos compartidos"), /*#__PURE__*/React.createElement("button", {
    className: "lf-edit-btn lf-edit-btn-hogar",
    onClick: () => {
      if (editing) save();else {
        setDraft(list);
        setSplitDraft(split.diego);
        setEditing(true);
      }
    }
  }, editing ? /*#__PURE__*/React.createElement(Check, {
    size: 13
  }) : /*#__PURE__*/React.createElement(Pencil, {
    size: 13
  }), editing ? "Guardar" : "Editar")), /*#__PURE__*/React.createElement("div", {
    className: "lf-hogar-split"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lf-label"
  }, "Reparto del hogar"), editing ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "lf-hogar-split-nums"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--c-diego)"
    }
  }, "Diego", " ", /*#__PURE__*/React.createElement("input", {
    className: "lf-input lf-hogar-split-input",
    type: "number",
    min: 0,
    max: 100,
    value: splitDraft,
    onChange: e => setSplitDraft(Math.min(100, Math.max(0, Number(e.target.value) || 0)))
  }), "%"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--c-yani)"
    }
  }, "Yani ", 100 - Math.round(splitDraft), "%")), /*#__PURE__*/React.createElement("input", {
    className: "lf-hogar-split-slider",
    style: {
      "--fill": `${splitDraft}%`
    },
    type: "range",
    min: 0,
    max: 100,
    step: 1,
    value: splitDraft,
    onChange: e => setSplitDraft(Number(e.target.value))
  })) : /*#__PURE__*/React.createElement("div", {
    className: "lf-hogar-split-nums lf-hogar-split-readonly"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--c-diego)"
    }
  }, "Diego ", split.diego, "%"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--c-yani)"
    }
  }, "Yani ", split.yani, "%"))), editing ? /*#__PURE__*/React.createElement("div", {
    className: "lf-fijos-editor"
  }, draft.map(f => /*#__PURE__*/React.createElement("div", {
    className: "lf-fijo-row",
    key: f.id
  }, /*#__PURE__*/React.createElement("div", {
    className: "lf-fijo-row-top"
  }, /*#__PURE__*/React.createElement("input", {
    className: "lf-input lf-fijo-nombre",
    type: "text",
    placeholder: "Nombre (ej: Alquiler, Servicios, Niñera)",
    value: f.nombre,
    onChange: e => updateRow(f.id, {
      nombre: e.target.value
    })
  }), /*#__PURE__*/React.createElement("input", {
    className: "lf-input lf-fijo-monto",
    type: "number",
    placeholder: "$ 0",
    value: f.monto,
    onChange: e => updateRow(f.id, {
      monto: e.target.value
    })
  }), /*#__PURE__*/React.createElement("button", {
    className: "lf-fijo-del",
    onClick: () => removeRow(f.id),
    "aria-label": "Eliminar"
  }, /*#__PURE__*/React.createElement(Trash2, {
    size: 14
  }))), /*#__PURE__*/React.createElement(CategoryDots, {
    value: f.categoria,
    onChange: cat => updateRow(f.id, {
      categoria: cat
    })
  }))), /*#__PURE__*/React.createElement("button", {
    className: "lf-fijo-add",
    onClick: addRow
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 13
  }), " Agregar gasto fijo del hogar")) : /*#__PURE__*/React.createElement(React.Fragment, null, list.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "lf-empty"
  }, "Todavía no cargaste gastos fijos del hogar.") : /*#__PURE__*/React.createElement("div", {
    className: "lf-fijos-list"
  }, list.map(f => {
    const cat = CATEGORIAS.find(c => c.id === f.categoria) || CATEGORIAS[0];
    const partDiego = (Number(f.monto) || 0) * (Number(split.diego) || 0) / 100;
    const partYani = (Number(f.monto) || 0) * (Number(split.yani) || 0) / 100;
    return /*#__PURE__*/React.createElement("div", {
      className: "lf-hogar-item",
      key: f.id
    }, /*#__PURE__*/React.createElement("div", {
      className: "lf-fijo-item"
    }, /*#__PURE__*/React.createElement(cat.Icon, {
      size: 12,
      style: {
        color: `var(${cat.cssVar})`
      }
    }), /*#__PURE__*/React.createElement("span", {
      className: "lf-fijo-item-name"
    }, f.nombre), /*#__PURE__*/React.createElement("span", {
      className: "lf-fijo-item-monto"
    }, fmt(f.monto))), /*#__PURE__*/React.createElement("div", {
      className: "lf-hogar-item-split"
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--c-diego)"
      }
    }, "Diego ", fmt(partDiego)), /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--c-yani)"
      }
    }, "Yani ", fmt(partYani))));
  })), list.length > 0 && /*#__PURE__*/React.createElement("button", {
    className: "lf-fijo-cargar lf-hogar-cargar",
    onClick: onCargar,
    disabled: pendientes === 0
  }, pendientes === 0 ? "Ya cargados este mes ✓" : `Cargar en este mes (${pendientes})`)), /*#__PURE__*/React.createElement(TarjetasHogarSection, {
    list: tarjetasHogar,
    month: month,
    split: split,
    onCargar: onCargarTarjetaHogar,
    onBorrar: onBorrarTarjetaHogar,
    onEditar: onEditarTarjetaHogar,
    onRevisar: onRevisarTarjetaHogar,
    onReparar: onRepararTarjetaHogar
  }));
}
