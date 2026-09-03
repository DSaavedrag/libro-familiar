// Componentes chicos y reutilizables: piezas de UI que usan menu.js y las
// pantallas (pantalla-mi-cuenta.js, pantalla-ahorros.js, pantalla-hogar.js)
// pero que no tienen estado "de la app" propio.
import React, { useState, useEffect } from "react";
import { Plus, Trash2, Pencil, Check, CreditCard, RefreshCw, X } from "lucide-react";
import { fmt, fmtFechaHora, monthLabel, monthDiff, shiftMonth, categoriaDe, iconoDe } from "./constants.js";

export function budgetsFrom(pct, ingresos, categorias) {
  return Object.fromEntries((categorias || []).map(c => [c.id, (Number(ingresos) || 0) * (Number(pct[c.id]) || 0) / 100]));
}
export function CategoryDots({
  value,
  onChange,
  categorias
}) {
  const cats = categorias || [];
  const maxIdx = Math.max(1, cats.length - 1);
  const idx = Math.max(0, cats.findIndex(c => c.id === value));
  const cat = cats[idx] || cats[0];
  if (!cat) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "lf-fijo-cat",
    style: {
      "--accent": cat.color
    }
  }, /*#__PURE__*/React.createElement("input", {
    className: "lf-fijo-cat-slider",
    style: {
      "--fill": `${idx / maxIdx * 100}%`
    },
    type: "range",
    min: 0,
    max: maxIdx,
    step: 1,
    value: idx,
    onChange: e => {
      const elegida = cats[Number(e.target.value)];
      if (elegida) onChange(elegida.id);
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "lf-fijo-cat-labels"
  }, cats.map((c, i) => /*#__PURE__*/React.createElement("button", {
    key: c.id,
    type: "button",
    className: "lf-fijo-cat-label" + (i === idx ? " on" : ""),
    style: {
      "--accent": c.color
    },
    onClick: () => onChange(c.id),
    title: c.label
  }, /*#__PURE__*/React.createElement(iconoDe(c.icon), {
    size: 12
  })))));
}
export function CotizacionWidget({
  cotizacionDolar,
  onGuardar,
  onActualizarLive
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cotizacionDolar);
  const [loadingLive, setLoadingLive] = useState(false);
  const [liveFailed, setLiveFailed] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(cotizacionDolar);
  }, [cotizacionDolar, editing]);
  async function refrescar() {
    setLoadingLive(true);
    setLiveFailed(false);
    const ok = await onActualizarLive();
    setLoadingLive(false);
    if (!ok) setLiveFailed(true);
  }
  function guardarManual() {
    onGuardar(Number(draft) || 0, "manual");
    setEditing(false);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "lf-cotizacion"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lf-cotizacion-left"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lf-label"
  }, "Cotización dólar (para suscripciones en u$s)"), editing ? /*#__PURE__*/React.createElement("div", {
    className: "lf-cotizacion-edit-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lf-cotizacion-prefix"
  }, "$"), /*#__PURE__*/React.createElement("input", {
    className: "lf-input lf-cotizacion-input",
    type: "number",
    value: draft,
    onChange: e => setDraft(e.target.value)
  }), /*#__PURE__*/React.createElement("span", {
    className: "lf-cotizacion-suffix"
  }, "/u$s")) : /*#__PURE__*/React.createElement("span", {
    className: "lf-cotizacion-valor"
  }, cotizacionDolar > 0 ? `${fmt(cotizacionDolar)} /u$s` : "Sin configurar")), /*#__PURE__*/React.createElement("div", {
    className: "lf-cotizacion-actions"
  }, editing ? /*#__PURE__*/React.createElement("button", {
    className: "lf-edit-btn lf-edit-btn-hogar",
    onClick: guardarManual
  }, /*#__PURE__*/React.createElement(Check, {
    size: 12
  }), " Guardar") : /*#__PURE__*/React.createElement("button", {
    className: "lf-edit-btn lf-edit-btn-hogar",
    onClick: () => setEditing(true)
  }, /*#__PURE__*/React.createElement(Pencil, {
    size: 12
  }), " Manual"), /*#__PURE__*/React.createElement("button", {
    className: "lf-cotizacion-live-btn",
    onClick: refrescar,
    disabled: loadingLive
  }, /*#__PURE__*/React.createElement(RefreshCw, {
    size: 12,
    className: loadingLive ? "lf-spin" : ""
  }), loadingLive ? "Buscando…" : "Actualizar en vivo")), liveFailed && /*#__PURE__*/React.createElement("p", {
    className: "lf-cotizacion-warn"
  }, "No se pudo traer la cotización en vivo (este entorno puede no tener acceso a internet). Cargala manual arriba."));
}
export function EtiquetasTarjetaPicker({
  etiquetas,
  seleccionada,
  onSeleccionar,
  onGuardarEtiquetas,
  categoriaActual,
  categorias,
  accentVar
}) {
  const categoriaActualLabel = categoriaDe(categorias, categoriaActual).label;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(etiquetas);
  useEffect(() => {
    if (!editing) setDraft(etiquetas);
  }, [etiquetas, editing]);
  function addTag() {
    setDraft([...draft, {
      id: `et-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      nombre: ""
    }]);
  }
  function updateTag(id, patch) {
    setDraft(draft.map(e => e.id === id ? {
      ...e,
      ...patch
    } : e));
  }
  function removeTag(id) {
    setDraft(draft.filter(e => e.id !== id));
  }
  function guardar() {
    const limpio = draft.filter(e => e.nombre.trim());
    onGuardarEtiquetas(limpio);
    setEditing(false);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "lf-etiquetas"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lf-etiquetas-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lf-label"
  }, "¿Cuál? (subgrupo dentro de ", categoriaActualLabel, ")"), /*#__PURE__*/React.createElement("button", {
    className: "lf-etiquetas-manage-btn",
    onClick: () => {
      if (editing) guardar();else {
        setDraft(etiquetas);
        setEditing(true);
      }
    }
  }, editing ? /*#__PURE__*/React.createElement(Check, {
    size: 11
  }) : /*#__PURE__*/React.createElement(Pencil, {
    size: 11
  }), editing ? "Guardar" : "Editar etiquetas")), editing ? /*#__PURE__*/React.createElement("div", {
    className: "lf-etiquetas-editor"
  }, draft.map(e => /*#__PURE__*/React.createElement("div", {
    className: "lf-etiqueta-row",
    key: e.id
  }, /*#__PURE__*/React.createElement("input", {
    className: "lf-input lf-etiqueta-nombre",
    type: "text",
    placeholder: "Nombre (ej: Sube)",
    value: e.nombre,
    onChange: ev => updateTag(e.id, {
      nombre: ev.target.value
    })
  }), /*#__PURE__*/React.createElement("button", {
    className: "lf-fijo-del",
    onClick: () => removeTag(e.id),
    "aria-label": "Eliminar etiqueta"
  }, /*#__PURE__*/React.createElement(Trash2, {
    size: 13
  })))), /*#__PURE__*/React.createElement("button", {
    className: "lf-fijo-add",
    onClick: addTag
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 13
  }), " Agregar etiqueta")) : etiquetas.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "lf-empty"
  }, "No tenés etiquetas todavía — tocá \"Editar etiquetas\" para crear las tuyas.") : /*#__PURE__*/React.createElement("div", {
    className: "lf-cat-row"
  }, etiquetas.map(e => /*#__PURE__*/React.createElement("button", {
    key: e.id,
    className: "lf-cat-pill" + (seleccionada === e.id ? " on" : ""),
    style: {
      "--accent": accentVar
    },
    onClick: () => onSeleccionar(e.id)
  }, e.nombre))));
}
export function TarjetasHogarSection({
  list,
  month,
  split,
  categorias,
  onCargar,
  onBorrar,
  onEditar,
  onRevisar,
  onReparar
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    descripcion: "",
    monto: "",
    categoria: (categorias && categorias[0] && categorias[0].id) || null,
    cuotas: 1
  });
  const [busy, setBusy] = useState(false);
  const [revisando, setRevisando] = useState(null);
  const [reparando, setReparando] = useState(false);
  // Antes el tacho de un consumo borraba directo, sin avisar — a diferencia
  // de Movimientos, que sí pide confirmar. Mismo patrón acá: primer toque
  // pide confirmar (✓/✗), segundo toque en el ✓ recién borra.
  const [confirmandoBorradoId, setConfirmandoBorradoId] = useState(null);
  async function reparar() {
    setReparando(true);
    await onReparar();
    setReparando(false);
  }
  const activas = list.filter(p => {
    const idx = monthDiff(p.mesInicio, month);
    return idx >= 0 && idx < p.cuotasTotal;
  });
  function empezarEdicion(p) {
    setEditingId(p.id);
    setForm({
      descripcion: p.descripcion,
      monto: p.montoTotal,
      categoria: p.categoria,
      cuotas: p.cuotasTotal
    });
    setShowForm(true);
  }
  function cancelar() {
    setShowForm(false);
    setEditingId(null);
    setForm({
      descripcion: "",
      monto: "",
      categoria: (categorias && categorias[0] && categorias[0].id) || null,
      cuotas: 1
    });
  }
  async function submit() {
    if (!form.descripcion.trim() || !(Number(form.monto) > 0)) return;
    setBusy(true);
    if (editingId) {
      const original = list.find(p => p.id === editingId);
      await onEditar(original, form);
    } else {
      await onCargar(form);
    }
    setBusy(false);
    cancelar();
  }
  async function revisar(p) {
    setRevisando(p.id);
    await onRevisar(p);
    setRevisando(null);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "lf-tarjetas lf-tarjetas-hogar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lf-col-head lf-fijos-head"
  }, /*#__PURE__*/React.createElement("h4", {
    className: "lf-fijos-title"
  }, /*#__PURE__*/React.createElement(CreditCard, {
    size: 13
  }), " Tarjetas del hogar"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "6px"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "lf-edit-btn lf-edit-btn-hogar",
    onClick: reparar,
    disabled: reparando,
    title: "Recupera consumos del hogar que quedaron sin registrar en esta lista pero ya están cargados en los movimientos"
  }, /*#__PURE__*/React.createElement(RefreshCw, {
    size: 12,
    className: reparando ? "lf-spin" : ""
  }), " Reparar"), /*#__PURE__*/React.createElement("button", {
    className: "lf-edit-btn lf-edit-btn-hogar",
    onClick: () => showForm ? cancelar() : setShowForm(true)
  }, showForm ? /*#__PURE__*/React.createElement(Check, {
    size: 12
  }) : /*#__PURE__*/React.createElement(Plus, {
    size: 12
  }), showForm ? "Cerrar" : "Nuevo consumo"))), showForm && /*#__PURE__*/React.createElement("div", {
    className: "lf-tarjeta-form"
  }, editingId && /*#__PURE__*/React.createElement("p", {
    className: "lf-tarjeta-editing-tag"
  }, "Editando consumo existente"), /*#__PURE__*/React.createElement("input", {
    className: "lf-input",
    type: "text",
    placeholder: "Descripción (ej: Regalo cumpleaños)",
    value: form.descripcion,
    onChange: e => setForm({
      ...form,
      descripcion: e.target.value
    })
  }), /*#__PURE__*/React.createElement("div", {
    className: "lf-tarjeta-form-row"
  }, /*#__PURE__*/React.createElement("input", {
    className: "lf-input lf-tarjeta-monto",
    type: "number",
    placeholder: "$ total",
    value: form.monto,
    onChange: e => setForm({
      ...form,
      monto: e.target.value
    })
  }), /*#__PURE__*/React.createElement("div", {
    className: "lf-tarjeta-cuotas"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lf-label"
  }, "Cuotas"), /*#__PURE__*/React.createElement("input", {
    className: "lf-input lf-tarjeta-cuotas-input",
    type: "number",
    min: 1,
    max: 48,
    value: form.cuotas,
    onChange: e => setForm({
      ...form,
      cuotas: e.target.value
    })
  }))), /*#__PURE__*/React.createElement(CategoryDots, {
    value: form.categoria,
    onChange: cat => setForm({
      ...form,
      categoria: cat
    })
  }), Number(form.monto) > 0 && /*#__PURE__*/React.createElement("p", {
    className: "lf-tarjeta-preview"
  }, "Se divide ", split.diego, "% Diego (", fmt(Number(form.monto) / Number(form.cuotas || 1) * (split.diego / 100)), "/cuota) · ", split.yani, "% Yani (", fmt(Number(form.monto) / Number(form.cuotas || 1) * (split.yani / 100)), "/cuota)", Number(form.cuotas) > 1 && ` — pega en ${monthLabel(editingId ? list.find(p => p.id === editingId)?.mesInicio || month : month)} → ${monthLabel(shiftMonth(editingId ? list.find(p => p.id === editingId)?.mesInicio || month : month, Number(form.cuotas) - 1))}`), /*#__PURE__*/React.createElement("div", {
    className: "lf-tarjeta-form-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "lf-add-btn lf-tarjeta-submit",
    onClick: submit,
    disabled: busy
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 14
  }), " ", busy ? "Guardando…" : editingId ? "Guardar cambios" : "Cargar consumo"), editingId && /*#__PURE__*/React.createElement("button", {
    className: "lf-tarjeta-cancel",
    onClick: cancelar
  }, "Cancelar"))), activas.length === 0 ? !showForm && /*#__PURE__*/React.createElement("p", {
    className: "lf-empty"
  }, "Sin consumos de tarjeta del hogar activos este mes.") : /*#__PURE__*/React.createElement("div", {
    className: "lf-tarjetas-list"
  }, activas.map(p => {
    const cat = categoriaDe(categorias, p.categoria);
    const idx = monthDiff(p.mesInicio, month);
    const tieneFallidos = (p.mesesFallidos || []).length > 0;
    const parteDiego = Math.round(p.montoCuota * (Number(split.diego) || 0) / 100 * 100) / 100;
    const parteYani = Math.round(p.montoCuota * (Number(split.yani) || 0) / 100 * 100) / 100;
    return /*#__PURE__*/React.createElement("div", {
      className: "lf-tarjeta-item-wrap",
      key: p.id
    }, /*#__PURE__*/React.createElement("div", {
      className: "lf-tarjeta-item"
    }, /*#__PURE__*/React.createElement(iconoDe(cat.icon), {
      size: 12,
      style: {
        color: cat.color
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "lf-tarjeta-item-text"
    }, /*#__PURE__*/React.createElement("span", {
      className: "lf-tarjeta-item-name"
    }, p.descripcion), /*#__PURE__*/React.createElement("span", {
      className: "lf-tarjeta-item-sub"
    }, /*#__PURE__*/React.createElement("span", {
      className: "lf-tarjeta-item-cat",
      style: {
        color: cat.color
      }
    }, cat.label), " · ", p.cuotasTotal > 1 ? `Cuota ${idx + 1}/${p.cuotasTotal}` : "Consumo único"), /*#__PURE__*/React.createElement("span", {
      className: "lf-tarjeta-item-split"
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--c-diego)"
      }
    }, "Diego ", fmt(parteDiego)), /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--c-yani)"
      }
    }, "Yani ", fmt(parteYani)))), /*#__PURE__*/React.createElement("button", {
      className: "lf-tarjeta-icon-btn",
      onClick: () => revisar(p),
      disabled: revisando === p.id,
      title: "Revisar que todas las cuotas estén guardadas para los dos"
    }, /*#__PURE__*/React.createElement(RefreshCw, {
      size: 12,
      className: revisando === p.id ? "lf-spin" : ""
    })), /*#__PURE__*/React.createElement("button", {
      className: "lf-tarjeta-icon-btn",
      onClick: () => empezarEdicion(p),
      "aria-label": "Editar consumo"
    }, /*#__PURE__*/React.createElement(Pencil, {
      size: 12
    })), confirmandoBorradoId === p.id ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
      className: "lf-entry-del-confirm-yes",
      onClick: () => onBorrar(p),
      "aria-label": "Confirmar: eliminar consumo",
      title: "Sí, eliminar"
    }, /*#__PURE__*/React.createElement(Check, {
      size: 12
    })), /*#__PURE__*/React.createElement("button", {
      className: "lf-entry-del-confirm-no",
      onClick: () => setConfirmandoBorradoId(null),
      "aria-label": "Cancelar",
      title: "Cancelar"
    }, /*#__PURE__*/React.createElement(X, {
      size: 12
    }))) : /*#__PURE__*/React.createElement("button", {
      className: "lf-fijo-del",
      onClick: () => setConfirmandoBorradoId(p.id),
      "aria-label": "Eliminar consumo"
    }, /*#__PURE__*/React.createElement(Trash2, {
      size: 13
    }))), tieneFallidos && /*#__PURE__*/React.createElement("p", {
      className: "lf-tarjeta-warn"
    }, "Faltan cuotas por guardar para alguno de los dos en ", p.mesesFallidos.map(monthLabel).join(", "), ". Tocá ", /*#__PURE__*/React.createElement(RefreshCw, {
      size: 10,
      style: {
        display: "inline",
        verticalAlign: "-1px"
      }
    }), " para reintentar."));
  })));
}
export function TarjetasSection({
  accentVar,
  list,
  month,
  categorias,
  onCargar,
  onBorrar,
  onEditar,
  onRevisar,
  readOnly
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    descripcion: "",
    monto: "",
    categoria: (categorias && categorias[0] && categorias[0].id) || null,
    cuotas: 1
  });
  const [busy, setBusy] = useState(false);
  const [revisando, setRevisando] = useState(null);
  // Mismo patrón que en Movimientos y en Tarjetas del hogar: primer toque
  // del tacho pide confirmar (✓/✗), no borra directo.
  const [confirmandoBorradoId, setConfirmandoBorradoId] = useState(null);
  const activas = list.filter(p => {
    const idx = monthDiff(p.mesInicio, month);
    return idx >= 0 && idx < p.cuotasTotal;
  });
  function empezarEdicion(p) {
    setEditingId(p.id);
    setForm({
      descripcion: p.descripcion,
      monto: p.montoTotal,
      categoria: p.categoria,
      cuotas: p.cuotasTotal
    });
    setShowForm(true);
  }
  function cancelar() {
    setShowForm(false);
    setEditingId(null);
    setForm({
      descripcion: "",
      monto: "",
      categoria: (categorias && categorias[0] && categorias[0].id) || null,
      cuotas: 1
    });
  }
  async function submit() {
    if (!form.descripcion.trim() || !(Number(form.monto) > 0)) return;
    setBusy(true);
    if (editingId) {
      const original = list.find(p => p.id === editingId);
      await onEditar(original, form);
    } else {
      await onCargar(form);
    }
    setBusy(false);
    cancelar();
  }
  async function revisar(p) {
    setRevisando(p.id);
    await onRevisar(p);
    setRevisando(null);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "lf-tarjetas",
    style: {
      "--accent": `var(${accentVar})`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "lf-col-head lf-fijos-head"
  }, /*#__PURE__*/React.createElement("h4", {
    className: "lf-fijos-title"
  }, /*#__PURE__*/React.createElement(CreditCard, {
    size: 13
  }), " Tarjetas"), !readOnly && /*#__PURE__*/React.createElement("button", {
    className: "lf-edit-btn lf-edit-btn-col",
    onClick: () => showForm ? cancelar() : setShowForm(true)
  }, showForm ? /*#__PURE__*/React.createElement(Check, {
    size: 12
  }) : /*#__PURE__*/React.createElement(Plus, {
    size: 12
  }), showForm ? "Cerrar" : "Nuevo consumo")), showForm && !readOnly && /*#__PURE__*/React.createElement("div", {
    className: "lf-tarjeta-form"
  }, editingId && /*#__PURE__*/React.createElement("p", {
    className: "lf-tarjeta-editing-tag"
  }, "Editando consumo existente"), /*#__PURE__*/React.createElement("input", {
    className: "lf-input",
    type: "text",
    placeholder: "Descripción (ej: Libro)",
    value: form.descripcion,
    onChange: e => setForm({
      ...form,
      descripcion: e.target.value
    })
  }), /*#__PURE__*/React.createElement("div", {
    className: "lf-tarjeta-form-row"
  }, /*#__PURE__*/React.createElement("input", {
    className: "lf-input lf-tarjeta-monto",
    type: "number",
    placeholder: "$ total",
    value: form.monto,
    onChange: e => setForm({
      ...form,
      monto: e.target.value
    })
  }), /*#__PURE__*/React.createElement("div", {
    className: "lf-tarjeta-cuotas"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lf-label"
  }, "Cuotas"), /*#__PURE__*/React.createElement("input", {
    className: "lf-input lf-tarjeta-cuotas-input",
    type: "number",
    min: 1,
    max: 48,
    value: form.cuotas,
    onChange: e => setForm({
      ...form,
      cuotas: e.target.value
    })
  }))), /*#__PURE__*/React.createElement(CategoryDots, {
    value: form.categoria,
    onChange: cat => setForm({
      ...form,
      categoria: cat
    })
  }), Number(form.cuotas) > 1 && Number(form.monto) > 0 && /*#__PURE__*/React.createElement("p", {
    className: "lf-tarjeta-preview"
  }, form.cuotas, " cuotas de ", fmt(Number(form.monto) / Number(form.cuotas)), " — pega en", " ", monthLabel(editingId ? list.find(p => p.id === editingId)?.mesInicio || month : month), " → ", monthLabel(shiftMonth(editingId ? list.find(p => p.id === editingId)?.mesInicio || month : month, Number(form.cuotas) - 1))), /*#__PURE__*/React.createElement("div", {
    className: "lf-tarjeta-form-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "lf-add-btn lf-tarjeta-submit",
    onClick: submit,
    disabled: busy
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 14
  }), " ", busy ? "Guardando…" : editingId ? "Guardar cambios" : "Cargar consumo"), editingId && /*#__PURE__*/React.createElement("button", {
    className: "lf-tarjeta-cancel",
    onClick: cancelar
  }, "Cancelar"))), activas.length === 0 ? !showForm && /*#__PURE__*/React.createElement("p", {
    className: "lf-empty"
  }, "Sin consumos de tarjeta activos este mes.") : /*#__PURE__*/React.createElement("div", {
    className: "lf-tarjetas-list"
  }, activas.map(p => {
    const cat = categoriaDe(categorias, p.categoria);
    const idx = monthDiff(p.mesInicio, month);
    const tieneFallidos = (p.mesesFallidos || []).length > 0;
    return /*#__PURE__*/React.createElement("div", {
      className: "lf-tarjeta-item-wrap",
      key: p.id
    }, /*#__PURE__*/React.createElement("div", {
      className: "lf-tarjeta-item"
    }, /*#__PURE__*/React.createElement(iconoDe(cat.icon), {
      size: 12,
      style: {
        color: cat.color
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "lf-tarjeta-item-text"
    }, /*#__PURE__*/React.createElement("span", {
      className: "lf-tarjeta-item-name"
    }, p.descripcion), /*#__PURE__*/React.createElement("span", {
      className: "lf-tarjeta-item-sub"
    }, /*#__PURE__*/React.createElement("span", {
      className: "lf-tarjeta-item-cat",
      style: {
        color: cat.color
      }
    }, cat.label), " · ", p.cuotasTotal > 1 ? `Cuota ${idx + 1}/${p.cuotasTotal} · ${fmt(p.montoCuota)}` : fmt(p.montoCuota))), !readOnly && /*#__PURE__*/React.createElement("button", {
      className: "lf-tarjeta-icon-btn",
      onClick: () => revisar(p),
      disabled: revisando === p.id,
      title: "Revisar que todas las cuotas estén guardadas"
    }, /*#__PURE__*/React.createElement(RefreshCw, {
      size: 12,
      className: revisando === p.id ? "lf-spin" : ""
    })), !readOnly && /*#__PURE__*/React.createElement("button", {
      className: "lf-tarjeta-icon-btn",
      onClick: () => empezarEdicion(p),
      "aria-label": "Editar consumo"
    }, /*#__PURE__*/React.createElement(Pencil, {
      size: 12
    })), !readOnly && (confirmandoBorradoId === p.id ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
      className: "lf-entry-del-confirm-yes",
      onClick: () => onBorrar(p),
      "aria-label": "Confirmar: eliminar consumo",
      title: "Sí, eliminar"
    }, /*#__PURE__*/React.createElement(Check, {
      size: 12
    })), /*#__PURE__*/React.createElement("button", {
      className: "lf-entry-del-confirm-no",
      onClick: () => setConfirmandoBorradoId(null),
      "aria-label": "Cancelar",
      title: "Cancelar"
    }, /*#__PURE__*/React.createElement(X, {
      size: 12
    }))) : /*#__PURE__*/React.createElement("button", {
      className: "lf-fijo-del",
      onClick: () => setConfirmandoBorradoId(p.id),
      "aria-label": "Eliminar consumo"
    }, /*#__PURE__*/React.createElement(Trash2, {
      size: 13
    })))), tieneFallidos && /*#__PURE__*/React.createElement("p", {
      className: "lf-tarjeta-warn"
    }, "Faltan ", p.mesesFallidos.length, " cuota(s) por guardar (", p.mesesFallidos.map(monthLabel).join(", "), "). Tocá ", /*#__PURE__*/React.createElement(RefreshCw, {
      size: 10,
      style: {
        display: "inline",
        verticalAlign: "-1px"
      }
    }), " para reintentar."));
  })));
}
export function FijosSection({
  accentVar,
  list,
  pendientes,
  entries,
  categorias,
  onSave,
  onCargar,
  cotizacionDolar,
  readOnly
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(list);
  useEffect(() => {
    if (!editing) setDraft(list);
  }, [list, editing]);
  function addRow() {
    setDraft([...draft, {
      id: `fijo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      nombre: "",
      monto: "",
      categoria: (categorias && categorias[0] && categorias[0].id) || null,
      moneda: "ARS"
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
    onSave(limpio);
    setEditing(false);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "lf-fijos",
    style: {
      "--accent": `var(${accentVar})`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "lf-col-head lf-fijos-head"
  }, /*#__PURE__*/React.createElement("h4", {
    className: "lf-fijos-title"
  }, "Gastos fijos"), !readOnly && /*#__PURE__*/React.createElement("button", {
    className: "lf-edit-btn lf-edit-btn-col",
    onClick: () => {
      if (editing) save();else {
        setDraft(list);
        setEditing(true);
      }
    }
  }, editing ? /*#__PURE__*/React.createElement(Check, {
    size: 12
  }) : /*#__PURE__*/React.createElement(Pencil, {
    size: 12
  }), editing ? "Guardar" : "Editar")), editing && !readOnly ? /*#__PURE__*/React.createElement("div", {
    className: "lf-fijos-editor"
  }, draft.map(f => /*#__PURE__*/React.createElement("div", {
    className: "lf-fijo-row",
    key: f.id
  }, /*#__PURE__*/React.createElement("div", {
    className: "lf-fijo-row-top"
  }, /*#__PURE__*/React.createElement("input", {
    className: "lf-input lf-fijo-nombre",
    type: "text",
    placeholder: "Nombre (ej: Alquiler)",
    value: f.nombre,
    onChange: e => updateRow(f.id, {
      nombre: e.target.value
    })
  }), /*#__PURE__*/React.createElement("input", {
    className: "lf-input lf-fijo-monto",
    type: "number",
    placeholder: f.moneda === "USD" ? "u$s 0" : "$ 0",
    value: f.monto,
    onChange: e => updateRow(f.id, {
      monto: e.target.value
    })
  }), /*#__PURE__*/React.createElement("div", {
    className: "lf-moneda-toggle"
  }, /*#__PURE__*/React.createElement("button", {
    className: (f.moneda || "ARS") === "ARS" ? "on" : "",
    onClick: () => updateRow(f.id, {
      moneda: "ARS"
    })
  }, "$"), /*#__PURE__*/React.createElement("button", {
    className: f.moneda === "USD" ? "on" : "",
    onClick: () => updateRow(f.id, {
      moneda: "USD"
    })
  }, "u$s")), /*#__PURE__*/React.createElement("button", {
    className: "lf-fijo-del",
    onClick: () => removeRow(f.id),
    "aria-label": "Eliminar"
  }, /*#__PURE__*/React.createElement(Trash2, {
    size: 14
  }))), f.moneda === "USD" && Number(f.monto) > 0 && /*#__PURE__*/React.createElement("p", {
    className: "lf-fijo-usd-preview"
  }, "≈ ", fmt((Number(f.monto) || 0) * (Number(cotizacionDolar) || 0)), " a la cotización actual (", fmt(cotizacionDolar), "/u$s)"), /*#__PURE__*/React.createElement(CategoryDots, {
    value: f.categoria,
    onChange: cat => updateRow(f.id, {
      categoria: cat
    })
  }), /*#__PURE__*/React.createElement("label", {
    className: "lf-fijo-tarjeta-check"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: Boolean(f.esTarjeta),
    onChange: e => updateRow(f.id, {
      esTarjeta: e.target.checked
    })
  }), /*#__PURE__*/React.createElement(CreditCard, {
    size: 12
  }), " Es tarjeta (entra en \"Tarjeta pendiente de pago\")"))), /*#__PURE__*/React.createElement("button", {
    className: "lf-fijo-add",
    onClick: addRow
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 13
  }), " Agregar gasto fijo")) : /*#__PURE__*/React.createElement(React.Fragment, null, list.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "lf-empty"
  }, "Todavía no cargaste gastos fijos.") : /*#__PURE__*/React.createElement("div", {
    className: "lf-fijos-list"
  }, list.map(f => {
    const cat = categoriaDe(categorias, f.categoria);
    const cargado = (entries || []).some(e => e.fijoId === f.id);
    return /*#__PURE__*/React.createElement("div", {
      className: "lf-fijo-item",
      key: f.id
    }, /*#__PURE__*/React.createElement(iconoDe(cat.icon), {
      size: 12,
      style: {
        color: cat.color
      }
    }), /*#__PURE__*/React.createElement("span", {
      className: "lf-fijo-item-name"
    }, f.nombre, f.esTarjeta && /*#__PURE__*/React.createElement(CreditCard, {
      size: 11,
      className: "lf-fijo-item-tarjeta-icon"
    })), /*#__PURE__*/React.createElement("span", {
      className: "lf-fijo-item-monto"
    }, f.moneda === "USD" ? `u$s ${f.monto} (≈ ${fmt((Number(f.monto) || 0) * (Number(cotizacionDolar) || 0))})` : fmt(f.monto)), !readOnly && (cargado ? /*#__PURE__*/React.createElement("span", {
      className: "lf-fijo-item-cargado",
      title: "Ya cargado este mes"
    }, "✓") : /*#__PURE__*/React.createElement("button", {
      className: "lf-fijo-item-cargar",
      onClick: () => onCargar(f.id)
    }, "Cargar")));
  })), !readOnly && list.length > 0 && /*#__PURE__*/React.createElement("button", {
    className: "lf-fijo-cargar",
    onClick: () => onCargar(),
    disabled: pendientes === 0
  }, pendientes === 0 ? "Ya cargados este mes ✓" : `Cargar todos (${pendientes})`)));
}
export function RowEntry({
  entry,
  onTogglePagado,
  onRemove,
  readOnly,
  categorias
}) {
  // Antes borraba directo al tocar el tacho — un toque de más y perdías el
  // movimiento sin aviso. Ahora el primer toque solo pide confirmar (mismo
  // patrón que "Reiniciar mes"): un segundo toque en el ✓ recién borra.
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const cat = entry.categoria ? categoriaDe(categorias, entry.categoria) : null;
  const esFijo = Boolean(entry.fijoId || entry.hogarId || entry.tarjetaId || entry.esTarjeta);
  const pendienteTarjeta = (entry.esTarjeta || entry.tarjetaId) && !entry.pagado;
  const esCredito = entry.tipo === "gasto" && Number(entry.monto) < 0;
  const esPositivo = entry.tipo === "ingreso" || esCredito;
  // Fecha y hora en que se cargó el movimiento (entry.ts, en milisegundos —
  // ya se venía guardando desde hace tiempo para poder ordenar, ahora
  // también se muestra). Los movimientos viejos que se cargaron antes de que
  // existiera este campo no van a tener ts — para esos, fechaHora da null y
  // simplemente no se muestra nada, en vez de una fecha inventada.
  const fechaHora = entry.ts ? fmtFechaHora(entry.ts) : null;
  // Se arma como lista y se unen con " · " al final, en vez de concatenar
  // strings condicionales a mano — así nunca queda un separador colgando al
  // principio cuando el primer dato (la categoría) no aplica, como pasa en
  // los ingresos (que no tienen categoría).
  const detalles = [cat && cat.label, fechaHora, entry.montoUSD ? `u$s ${entry.montoUSD} (cotiz. ${fmt(entry.cotizacionUsada)})` : null, esCredito ? "rendimiento (a favor)" : null, pendienteTarjeta ? "pendiente de pago" : null].filter(Boolean).join(" · ");
  return /*#__PURE__*/React.createElement("div", {
    className: "lf-entry" + (entry.pagado ? " lf-entry-pagado" : "") + (pendienteTarjeta ? " lf-entry-pendiente" : "")
  }, /*#__PURE__*/React.createElement("div", {
    className: "lf-entry-main"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lf-entry-dot " + (esPositivo ? "in" : "out")
  }), /*#__PURE__*/React.createElement("div", {
    className: "lf-entry-text"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lf-entry-desc"
  }, entry.descripcion || (entry.tipo === "ingreso" ? "Ingreso" : cat ? cat.label : "Gasto")), /*#__PURE__*/React.createElement("span", {
    className: "lf-entry-cat"
  }, detalles))), /*#__PURE__*/React.createElement("div", {
    className: "lf-entry-right"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lf-entry-amt-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lf-entry-amt " + (esPositivo ? "lf-pos" : "lf-neg")
  }, esPositivo ? "+" : "−", fmt(Math.abs(entry.monto))), !readOnly && (confirmandoBorrado ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    className: "lf-entry-del-confirm-yes",
    onClick: () => onRemove(entry.id),
    "aria-label": "Confirmar: eliminar movimiento",
    title: "Sí, eliminar"
  }, /*#__PURE__*/React.createElement(Check, {
    size: 12
  })), /*#__PURE__*/React.createElement("button", {
    className: "lf-entry-del-confirm-no",
    onClick: () => setConfirmandoBorrado(false),
    "aria-label": "Cancelar",
    title: "Cancelar"
  }, /*#__PURE__*/React.createElement(X, {
    size: 12
  }))) : /*#__PURE__*/React.createElement("button", {
    className: "lf-entry-del",
    onClick: () => setConfirmandoBorrado(true),
    "aria-label": "Eliminar movimiento"
  }, /*#__PURE__*/React.createElement(Trash2, {
    size: 12
  })))), esFijo && (readOnly ? /*#__PURE__*/React.createElement("span", {
    className: "lf-pagado-btn" + (entry.pagado ? " on" : ""),
    style: {
      cursor: "default"
    }
  }, /*#__PURE__*/React.createElement(Check, {
    size: 11
  }), entry.pagado ? "Pagado" : "No pagado") : /*#__PURE__*/React.createElement("button", {
    className: "lf-pagado-btn" + (entry.pagado ? " on" : ""),
    onClick: () => onTogglePagado(entry.id),
    title: entry.pagado ? "Marcar como no pagado" : "Marcar como pagado"
  }, /*#__PURE__*/React.createElement(Check, {
    size: 11
  }), entry.pagado ? "Pagado" : "Marcar pagado"))));
}
export function Shell({
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "lf-root"
  }, children);
}
