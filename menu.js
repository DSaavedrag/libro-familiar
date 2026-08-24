// El "menú" de la app: LibroFamiliar. Maneja todo el estado (mes actual,
// persona activa, movimientos, configuración) y las funciones que guardan/
// cargan datos de Firebase. Decide qué pantalla mostrar (Registro o Ahorros)
// y arma la navegación — cada pantalla grande (Mi cuenta, Ahorros, Hogar) vive
// en su propio archivo y se la llama desde acá, como los .prg que colgaban de
// un sdmenu.prg.
//
// La lógica de "Tarjetas" (armar y guardar cuotas, tanto personales como de
// Hogar) vive aparte, en logica-tarjetas.js — acá solo quedan las funciones
// que tocan el estado de la app (guardar en Firebase, actualizar la
// pantalla, mostrar errores). Es el primer bloque de este tipo que se separó;
// la idea es ir sacando, de a poco, más bloques de lógica de este archivo.
import React, { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, RotateCcw, AlertTriangle, PiggyBank, Plus, ArrowDownCircle, ArrowUpCircle, CreditCard, TrendingUp, LogOut } from "lucide-react";
import { CATEGORIAS, PERSONAS, fmt, PCT_DEFAULT, ETIQUETAS_TARJETA_DEFAULT, monthKey, monthLabel, shiftMonth } from "./constants.js";
import { storageSetRetry, fetchCotizacionLive, arrayAMapaPorId, mapaAArray } from "./storage.js";
import { Shell, EtiquetasTarjetaPicker, CotizacionWidget } from "./components.js";
import { PersonColumn } from "./pantalla-mi-cuenta.js";
import { AhorrosSection } from "./pantalla-ahorros.js";
import { HogarSection } from "./pantalla-hogar.js";
import { escribirCuotas, removeInstallments, detectarCuotasFaltantes, reintentarCuotasFaltantes, calcularRegistrosTarjetaHogarAReparar } from "./logica-tarjetas.js";
import { entrarOCrearCuenta, suscribirseASesion, cerrarSesion, buscarJugadorPorUid, obtenerJugadoresVinculados, vincularJugadorPropio } from "./auth.js";

export function LibroFamiliar() {
  const [month, setMonth] = useState(monthKey(new Date()));

  // --- Sesión y jugador vinculado -------------------------------------------
  // `activePerson` ya no se elige a mano tocando un botón — sale de quién
  // inició sesión de verdad. `sesion` es el usuario de Firebase Auth (o null);
  // `jugadorActual` es lo que se encuentra en la clave "jugadores" de Firebase
  // para ese uid ({personKey, label, cssVar, email}). Ver auth.js.
  const [sesion, setSesion] = useState(null);
  const [sesionLista, setSesionLista] = useState(false);
  const [jugadorActual, setJugadorActual] = useState(null);
  const [buscandoJugador, setBuscandoJugador] = useState(false);
  const [emailForm, setEmailForm] = useState("");
  const [passwordForm, setPasswordForm] = useState("");
  const [enviandoLogin, setEnviandoLogin] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [personKeysLibres, setPersonKeysLibres] = useState(null);
  const [vinculando, setVinculando] = useState(false);
  const activePerson = jugadorActual ? jugadorActual.personKey : null;

  // `viewingPerson` es qué libro estás mirando en pantalla — arranca siendo el
  // tuyo (activePerson), pero se puede cambiar tocando tu nombre para ver el
  // libro del otro (de solo lectura: las reglas de Firebase ya bloquean que
  // edites lo ajeno, y la pantalla también oculta los botones de edición
  // cuando estás mirando un libro que no es el tuyo).
  const [viewingPersonRaw, setViewingPerson] = useState(null);
  useEffect(() => {
    if (activePerson) setViewingPerson(activePerson);
  }, [activePerson]);
  // Mientras el useEffect de arriba todavía no corrió (el primer render justo
  // después de loguearte), viewingPersonRaw sigue en null — este fallback evita
  // que ese render intermedio explote leyendo PERSONAS[null].
  const viewingPerson = viewingPersonRaw || activePerson;

  // Pantallas deslizables (en vez de todo apilado hacia abajo): Resumen+Fijos /
  // Tarjetas / Movimientos (estas tres las arma PersonColumn) y Grupo (Vista
  // grupal + Hogar, acá abajo). Con el dedo (celular de verdad) el scroll con
  // snap es 100% nativo del navegador, no hace falta nada de JS acá. Pero con
  // mouse — como al probar en "modo celular" del inspector de Chrome, que
  // simula la pantalla pero no manda eventos de touch reales — un div con
  // overflow-x no se mueve solo al arrastrar con el click, hay que manejarlo
  // a mano. Por eso este pointerdown/move/up: solo actúa cuando el puntero es
  // mouse (pointerType !== "touch"), así no interfiere en nada con el gesto
  // táctil real en un celular. En desktop esto no se nota: las 4 pantallas
  // quedan apiladas como siempre (ver @media en styles.css) y este handler ni
  // se activa porque no hay overflow-x que arrastrar.
  const swipeRef = useRef(null);
  const swipeDrag = useRef({
    arrastrando: false,
    xInicial: 0,
    scrollInicial: 0
  });
  function handleSwipePointerDown(e) {
    if (e.pointerType === "touch") return;
    const el = swipeRef.current;
    if (!el) return;
    swipeDrag.current = {
      arrastrando: true,
      xInicial: e.clientX,
      scrollInicial: el.scrollLeft
    };
    el.setPointerCapture(e.pointerId);
  }
  function handleSwipePointerMove(e) {
    if (!swipeDrag.current.arrastrando) return;
    const el = swipeRef.current;
    if (!el) return;
    el.scrollLeft = swipeDrag.current.scrollInicial - (e.clientX - swipeDrag.current.xInicial);
  }
  function handleSwipePointerUp() {
    swipeDrag.current.arrastrando = false;
  }
  useEffect(() => {
    const unsub = suscribirseASesion(user => {
      setSesion(user);
      setSesionLista(true);
    });
    return unsub;
  }, []);
  useEffect(() => {
    if (!sesion) {
      setJugadorActual(null);
      return;
    }
    let cancelado = false;
    setBuscandoJugador(true);
    buscarJugadorPorUid(sesion.uid).then(j => {
      if (!cancelado) {
        setJugadorActual(j);
        setBuscandoJugador(false);
      }
    });
    return () => {
      cancelado = true;
    };
  }, [sesion]);
  useEffect(() => {
    if (!sesion || buscandoJugador || jugadorActual) {
      setPersonKeysLibres(null);
      return;
    }
    let cancelado = false;
    obtenerJugadoresVinculados().then(vinculados => {
      if (cancelado) return;
      const tomados = new Set(Object.values(vinculados).map(j => j.personKey));
      setPersonKeysLibres(Object.keys(PERSONAS).filter(k => !tomados.has(k)));
    });
    return () => {
      cancelado = true;
    };
  }, [sesion, buscandoJugador, jugadorActual]);
  async function handleElegirJugador(personKey) {
    setVinculando(true);
    setLoginError("");
    const res = await vincularJugadorPropio(personKey, PERSONAS[personKey].label, PERSONAS[personKey].cssVar);
    if (!res.ok) {
      setLoginError(res.error);
      setVinculando(false);
      return;
    }
    setJugadorActual({
      personKey,
      label: PERSONAS[personKey].label,
      cssVar: PERSONAS[personKey].cssVar,
      email: sesion.email
    });
    setVinculando(false);
  }
  async function handleEnviarLogin() {
    const email = emailForm.trim();
    const password = passwordForm;
    if (!email || !password) return;
    setEnviandoLogin(true);
    setLoginError("");
    const res = await entrarOCrearCuenta(email, password);
    if (!res.ok) setLoginError(res.error);
    // si res.ok, la sesión llega sola por suscribirseASesion.
    setEnviandoLogin(false);
  }
  async function handleCerrarSesion() {
    await cerrarSesion();
    setJugadorActual(null);
    setEmailForm("");
    setPasswordForm("");
  }
  const [entries, setEntries] = useState([]);
  const [settings, setSettings] = useState({
    diego: {
      pct: PCT_DEFAULT
    },
    yani: {
      pct: PCT_DEFAULT
    }
  });
  const [fijos, setFijos] = useState({
    diego: [],
    yani: []
  });
  const [fijosHogar, setFijosHogar] = useState([]);
  const [splitHogar, setSplitHogar] = useState({
    diego: 50,
    yani: 50
  });
  const [tarjetas, setTarjetas] = useState({
    diego: [],
    yani: []
  });
  const [tarjetasHogar, setTarjetasHogar] = useState([]);
  const [etiquetasTarjeta, setEtiquetasTarjeta] = useState({
    diego: [],
    yani: []
  });
  const [cotizacionDolar, setCotizacionDolar] = useState(0);
  const [reservas, setReservas] = useState([]);
  const [activeTab, setActiveTab] = useState("registro");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [form, setForm] = useState({
    tipo: "gasto",
    categoria: "necesidades",
    monto: "",
    descripcion: "",
    esTarjeta: false,
    esRendimiento: false,
    tarjetaModo: "agrupable",
    etiquetaId: null,
    tarjetaCuotas: 1
  });
  const load = useCallback(async m => {
    setLoading(true);
    setErrorMsg("");
    try {
      let ent = [];
      try {
        const r = await window.storage.get(`entries:${m}`, true);
        ent = r ? mapaAArray(JSON.parse(r.value)) : [];
      } catch {
        ent = [];
      }
      const defaultSett = {
        diego: {
          pct: PCT_DEFAULT
        },
        yani: {
          pct: PCT_DEFAULT
        }
      };
      let sett = defaultSett;
      try {
        const r = await window.storage.get(`settings:${m}`, true);
        if (r) {
          const parsed = JSON.parse(r.value);
          sett = parsed.diego && parsed.yani ? parsed : defaultSett;
        } else {
          const prev = await window.storage.get(`settings:${shiftMonth(m, -1)}`, true).catch(() => null);
          if (prev) {
            const parsed = JSON.parse(prev.value);
            sett = parsed.diego && parsed.yani ? parsed : defaultSett;
          }
        }
      } catch {
        // sin parametrización guardada todavía, se usan los valores por defecto
      }
      setEntries(ent);
      setSettings(sett);
    } catch (e) {
      setErrorMsg("No se pudieron cargar los datos de este mes.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load(month);
  }, [month, load]);

  // Refresco silencioso: cada 25s, si la pantalla está visible, trae los movimientos
  // guardados por el otro (sin mostrar el loader ni interrumpir lo que estás escribiendo).
  const refreshEntriesSilent = useCallback(async m => {
    try {
      const r = await window.storage.get(`entries:${m}`, true);
      setEntries(r ? mapaAArray(JSON.parse(r.value)) : []);
    } catch {
      // si falla, no mostramos error — se reintenta solo en el próximo ciclo
    }
  }, []);
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        refreshEntriesSilent(month);
      }
    }, 25000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshEntriesSilent(month);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [month, refreshEntriesSilent]);
  useEffect(() => {
    (async () => {
      const next = {
        diego: [],
        yani: []
      };
      for (const pid of ["diego", "yani"]) {
        try {
          const r = await window.storage.get(`fijos:${pid}`, true);
          next[pid] = r ? JSON.parse(r.value) : [];
        } catch {
          next[pid] = [];
        }
      }
      setFijos(next);
      try {
        const r = await window.storage.get(`fijosHogar`, true);
        setFijosHogar(r ? JSON.parse(r.value) : []);
      } catch {
        setFijosHogar([]);
      }
      try {
        const r = await window.storage.get(`splitHogar`, true);
        if (r) {
          const parsed = JSON.parse(r.value);
          if (typeof parsed.diego === "number") setSplitHogar(parsed);
        }
      } catch {
        // sin split guardado, se usa 50/50 por defecto
      }
      const nextTarjetas = {
        diego: [],
        yani: []
      };
      for (const pid of ["diego", "yani"]) {
        try {
          const r = await window.storage.get(`tarjetas:${pid}`, true);
          nextTarjetas[pid] = r ? JSON.parse(r.value) : [];
        } catch {
          nextTarjetas[pid] = [];
        }
      }
      setTarjetas(nextTarjetas);
      try {
        const r = await window.storage.get(`tarjetasHogar`, true);
        setTarjetasHogar(r ? JSON.parse(r.value) : []);
      } catch {
        setTarjetasHogar([]);
      }
      const nextEtiquetas = {
        diego: [],
        yani: []
      };
      for (const pid of ["diego", "yani"]) {
        try {
          const r = await window.storage.get(`etiquetasTarjeta:${pid}`, true);
          if (r) {
            nextEtiquetas[pid] = JSON.parse(r.value);
          } else {
            nextEtiquetas[pid] = ETIQUETAS_TARJETA_DEFAULT;
            await storageSetRetry(`etiquetasTarjeta:${pid}`, JSON.stringify(ETIQUETAS_TARJETA_DEFAULT), true);
          }
        } catch {
          nextEtiquetas[pid] = ETIQUETAS_TARJETA_DEFAULT;
        }
      }
      setEtiquetasTarjeta(nextEtiquetas);
      try {
        const r = await window.storage.get(`cotizacionDolar`, true);
        if (r) {
          const parsed = JSON.parse(r.value);
          if (typeof parsed.valor === "number") setCotizacionDolar(parsed.valor);
        } else {
          const live = await fetchCotizacionLive();
          if (live) {
            setCotizacionDolar(live);
            await storageSetRetry(`cotizacionDolar`, JSON.stringify({
              valor: live,
              fuente: "banco nación (auto)"
            }), true);
          }
        }
      } catch {
        // sin cotización guardada ni disponible en vivo, queda en 0 hasta que la carguen a mano
      }
      try {
        const r = await window.storage.get(`reservas`, true);
        setReservas(r ? JSON.parse(r.value) : []);
      } catch {
        setReservas([]);
      }
    })();
  }, []);
  async function persistEntries(next) {
    setEntries(next);
    const res = await storageSetRetry(`entries:${month}`, JSON.stringify(arrayAMapaPorId(next)), true);
    if (!res) {
      setErrorMsg("No se pudo guardar el movimiento. Probá de nuevo.");
      return false;
    }
    return true;
  }
  async function saveSettingsFor(personId, personSettings) {
    const next = {
      ...settings,
      [personId]: personSettings
    };
    setSettings(next);
    const res = await storageSetRetry(`settings:${month}`, JSON.stringify(next), true);
    if (!res) setErrorMsg("No se pudo guardar la parametrización. Probá de nuevo.");
  }
  function montoArsDeFijo(item) {
    if (item.moneda === "USD") {
      return Math.round((Number(item.monto) || 0) * (Number(cotizacionDolar) || 0) * 100) / 100;
    }
    return Number(item.monto) || 0;
  }
  async function saveFijosFor(personId, list) {
    setFijos(prev => ({
      ...prev,
      [personId]: list
    }));
    const res = await storageSetRetry(`fijos:${personId}`, JSON.stringify(list), true);
    if (!res) {
      setErrorMsg("No se pudo guardar los gastos fijos. Probá de nuevo.");
      return;
    }
    // Si alguno de estos fijos ya está cargado este mes, actualizamos el movimiento con los valores nuevos.
    let changed = false;
    const nextEntries = entries.map(e => {
      if (!e.fijoId) return e;
      const item = list.find(f => f.id === e.fijoId);
      if (!item) return e;
      changed = true;
      return {
        ...e,
        monto: montoArsDeFijo(item),
        categoria: item.categoria,
        descripcion: item.nombre || e.descripcion,
        montoUSD: item.moneda === "USD" ? Number(item.monto) || 0 : undefined,
        cotizacionUsada: item.moneda === "USD" ? Number(cotizacionDolar) || 0 : undefined,
        esTarjeta: Boolean(item.esTarjeta),
        pagado: item.esTarjeta ? e.pagado ?? false : e.pagado
      };
    });
    if (changed) await persistEntries(nextEntries);
  }
  async function saveHogarConfig(list, diegoPct) {
    const newSplit = {
      diego: diegoPct,
      yani: 100 - diegoPct
    };
    setFijosHogar(list);
    setSplitHogar(newSplit);
    const r1 = await storageSetRetry(`fijosHogar`, JSON.stringify(list), true);
    const r2 = await storageSetRetry(`splitHogar`, JSON.stringify(newSplit), true);
    if (!r1 || !r2) {
      setErrorMsg("No se pudo guardar el hogar. Probá de nuevo.");
      return;
    }
    // Igual que con los fijos personales: si ya están cargados este mes, actualizamos esos movimientos.
    let changed = false;
    const nextEntries = entries.map(e => {
      if (!e.hogarId) return e;
      const item = list.find(f => f.id === e.hogarId);
      if (!item) return e;
      changed = true;
      const pct = Number(newSplit[e.person]) || 0;
      return {
        ...e,
        categoria: item.categoria,
        monto: Math.round((Number(item.monto) || 0) * pct / 100 * 100) / 100,
        descripcion: `${item.nombre || "Gasto fijo"} (hogar)`
      };
    });
    if (changed) await persistEntries(nextEntries);
  }
  async function saveReservas(list) {
    setReservas(list);
    const res = await storageSetRetry(`reservas`, JSON.stringify(list), true);
    if (!res) setErrorMsg("No se pudo guardar los ahorros. Probá de nuevo.");
  }
  async function guardarCotizacion(valor, fuente = "manual") {
    setCotizacionDolar(valor);
    await storageSetRetry(`cotizacionDolar`, JSON.stringify({
      valor,
      fuente
    }), true);
  }
  async function actualizarCotizacionLive() {
    const live = await fetchCotizacionLive();
    if (live) {
      await guardarCotizacion(live, "banco nación (auto)");
      return true;
    }
    return false;
  }
  function cargarFijosHogarDelMes() {
    const faltantes = fijosHogar.filter(f => !entries.some(e => e.hogarId === f.id));
    if (faltantes.length === 0) return;
    const now = Date.now();
    const nuevas = [];
    faltantes.forEach((f, i) => {
      ["diego", "yani"].forEach((pid, j) => {
        nuevas.push({
          id: `hogar-${f.id}-${pid}-${now}-${i}-${j}`,
          person: pid,
          tipo: "gasto",
          categoria: f.categoria,
          monto: (Number(f.monto) || 0) * (Number(splitHogar[pid]) || 0) / 100,
          descripcion: `${f.nombre || "Gasto fijo"} (hogar)`,
          hogarId: f.id,
          ts: now - i
        });
      });
    });
    persistEntries([...nuevas, ...entries]);
  }
  async function saveTarjetasFor(personId, list) {
    setTarjetas(prev => ({
      ...prev,
      [personId]: list
    }));
    const res = await storageSetRetry(`tarjetas:${personId}`, JSON.stringify(list), true);
    if (!res) setErrorMsg("No se pudo guardar el consumo de tarjeta. Probá de nuevo.");
  }
  async function saveEtiquetasTarjeta(personId, list) {
    setEtiquetasTarjeta(prev => ({
      ...prev,
      [personId]: list
    }));
    const res = await storageSetRetry(`etiquetasTarjeta:${personId}`, JSON.stringify(list), true);
    if (!res) setErrorMsg("No se pudieron guardar las etiquetas. Probá de nuevo.");
  }
  async function cargarConsumoTarjeta(personId, {
    descripcion,
    monto,
    categoria,
    cuotas
  }) {
    const cuotasNum = Math.max(1, Math.round(Number(cuotas)) || 1);
    const montoTotal = Number(monto) || 0;
    const montoCuota = Math.round(montoTotal / cuotasNum * 100) / 100;
    const purchaseId = `tarjeta-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const mesesFallidos = await escribirCuotas({
      purchaseId,
      personId,
      categoria,
      descripcion,
      cuotasNum,
      montoCuota,
      startMonth: month,
      writeEntriesForMonth,
      hogar: false
    });
    const registro = {
      id: purchaseId,
      descripcion,
      categoria,
      montoTotal,
      montoCuota,
      cuotasTotal: cuotasNum,
      mesInicio: month,
      mesesFallidos
    };
    await saveTarjetasFor(personId, [registro, ...(tarjetas[personId] || [])]);
    if (mesesFallidos.length > 0) {
      setErrorMsg(`"${descripcion}": se guardaron ${cuotasNum - mesesFallidos.length} de ${cuotasNum} cuotas. Faltan ${mesesFallidos.map(monthLabel).join(", ")} — reintentalo desde la lista de Tarjetas.`);
    }
  }
  async function editarConsumoTarjeta(personId, purchase, nuevosValores) {
    await removeInstallments({
      purchase,
      month,
      entries,
      persistEntries
    });
    const cuotasNum = Math.max(1, Math.round(Number(nuevosValores.cuotas)) || 1);
    const montoTotal = Number(nuevosValores.monto) || 0;
    const montoCuota = Math.round(montoTotal / cuotasNum * 100) / 100;
    const mesesFallidos = await escribirCuotas({
      purchaseId: purchase.id,
      personId,
      categoria: nuevosValores.categoria,
      descripcion: nuevosValores.descripcion,
      cuotasNum,
      montoCuota,
      startMonth: purchase.mesInicio,
      writeEntriesForMonth,
      hogar: false
    });
    const registro = {
      id: purchase.id,
      descripcion: nuevosValores.descripcion,
      categoria: nuevosValores.categoria,
      montoTotal,
      montoCuota,
      cuotasTotal: cuotasNum,
      mesInicio: purchase.mesInicio,
      mesesFallidos
    };
    await saveTarjetasFor(personId, (tarjetas[personId] || []).map(p => p.id === purchase.id ? registro : p));
    if (mesesFallidos.length > 0) {
      setErrorMsg(`"${nuevosValores.descripcion}": se guardaron ${cuotasNum - mesesFallidos.length} de ${cuotasNum} cuotas. Faltan ${mesesFallidos.map(monthLabel).join(", ")}.`);
    }
  }
  async function borrarConsumoTarjeta(personId, purchase) {
    await removeInstallments({
      purchase,
      month,
      entries,
      persistEntries
    });
    await saveTarjetasFor(personId, (tarjetas[personId] || []).filter(p => p.id !== purchase.id));
  }
  async function revisarCuotasTarjeta(personId, purchase) {
    const faltantes = await detectarCuotasFaltantes({
      purchase,
      month,
      entries,
      hogar: false
    });
    const patched = {
      ...purchase,
      mesesFallidos: faltantes
    };
    await saveTarjetasFor(personId, (tarjetas[personId] || []).map(p => p.id === purchase.id ? patched : p));
    if (faltantes.length > 0) {
      const nuevosFallidos = await reintentarCuotasFaltantes({
        purchase: patched,
        pendientes: faltantes,
        writeEntriesForMonth,
        hogar: false,
        personId
      });
      await saveTarjetasFor(personId, (tarjetas[personId] || []).map(p => p.id === purchase.id ? {
        ...p,
        mesesFallidos: nuevosFallidos
      } : p));
    }
  }
  async function saveTarjetasHogar(list) {
    setTarjetasHogar(list);
    const res = await storageSetRetry(`tarjetasHogar`, JSON.stringify(list), true);
    if (!res) setErrorMsg("No se pudo guardar el consumo de tarjeta del hogar. Probá de nuevo.");
  }

  // Reconstruye registros de "Tarjetas del hogar" que se perdieron: puede pasar que el guardado de
  // los movimientos (entries) funcione pero el guardado del registro maestro (tarjetasHogar) falle
  // por separado (dos llamadas de red distintas). El resultado es un consumo que aparece en el
  // detalle de tarjeta de cada persona pero no en la lista "Tarjetas del hogar". Esta función busca,
  // dentro de los movimientos del mes actual, cualquier consumo de tarjeta del hogar (identificado
  // por tener tarjetaId === hogarId, que es como los genera crearConsumoTarjetaHogar) cuyo id no
  // esté en la lista de registros, y lo reconstruye a partir de esos mismos movimientos.
  async function repararTarjetasHogar() {
    const nuevosRegistros = calcularRegistrosTarjetaHogarAReparar({
      entries,
      tarjetasHogar,
      month
    });
    if (nuevosRegistros.length === 0) {
      setErrorMsg("No se encontraron consumos de tarjeta del hogar para reparar este mes.");
      return;
    }
    await saveTarjetasHogar([...nuevosRegistros, ...tarjetasHogar]);
    setErrorMsg(`Reparado: se recuperaron ${nuevosRegistros.length} consumo(s) de tarjeta del hogar que faltaban en la lista.`);
  }

  // Escribe (o reemplaza si ya existe, por id) una entrada puntual en el mes que corresponda.
  // Escribe (o reemplaza, por id) un lote de entradas en el mes que corresponda, en un solo guardado.
  // Importante: nunca separar esto en llamadas de a una entrada cuando el mes es el actual, porque cada
  // llamada usaría una foto vieja de `entries` y se pisarían entre sí.
  async function writeEntriesForMonth(mKey, newEntries) {
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
  async function crearConsumoTarjetaHogar({
    descripcion,
    monto,
    categoria,
    cuotas
  }) {
    const cuotasNum = Math.max(1, Math.round(Number(cuotas)) || 1);
    const montoTotal = Number(monto) || 0;
    const montoCuotaTotal = Math.round(montoTotal / cuotasNum * 100) / 100;
    const purchaseId = `tarjetahogar-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const mesesFallidos = await escribirCuotas({
      purchaseId,
      categoria,
      descripcion,
      cuotasNum,
      montoCuotaTotal,
      startMonth: month,
      writeEntriesForMonth,
      hogar: true,
      splitHogar
    });
    const registro = {
      id: purchaseId,
      descripcion,
      categoria,
      montoTotal,
      montoCuota: montoCuotaTotal,
      cuotasTotal: cuotasNum,
      mesInicio: month,
      mesesFallidos
    };
    await saveTarjetasHogar([registro, ...tarjetasHogar]);
    if (mesesFallidos.length > 0) {
      setErrorMsg(`"${descripcion}" (hogar): faltan cuotas por guardar en ${mesesFallidos.map(monthLabel).join(", ")} — reintentalo desde la lista.`);
    }
  }
  async function editarConsumoTarjetaHogar(purchase, nuevosValores) {
    await removeInstallments({
      purchase,
      month,
      entries,
      persistEntries
    }); // filtra por tarjetaId, saca las dos entradas (Diego y Yani) de cada mes
    const cuotasNum = Math.max(1, Math.round(Number(nuevosValores.cuotas)) || 1);
    const montoTotal = Number(nuevosValores.monto) || 0;
    const montoCuotaTotal = Math.round(montoTotal / cuotasNum * 100) / 100;
    const mesesFallidos = await escribirCuotas({
      purchaseId: purchase.id,
      categoria: nuevosValores.categoria,
      descripcion: nuevosValores.descripcion,
      cuotasNum,
      montoCuotaTotal,
      startMonth: purchase.mesInicio,
      writeEntriesForMonth,
      hogar: true,
      splitHogar
    });
    const registro = {
      id: purchase.id,
      descripcion: nuevosValores.descripcion,
      categoria: nuevosValores.categoria,
      montoTotal,
      montoCuota: montoCuotaTotal,
      cuotasTotal: cuotasNum,
      mesInicio: purchase.mesInicio,
      mesesFallidos
    };
    await saveTarjetasHogar(tarjetasHogar.map(p => p.id === purchase.id ? registro : p));
  }
  async function borrarConsumoTarjetaHogar(purchase) {
    await removeInstallments({
      purchase,
      month,
      entries,
      persistEntries
    });
    await saveTarjetasHogar(tarjetasHogar.filter(p => p.id !== purchase.id));
  }
  async function revisarCuotasTarjetaHogar(purchase) {
    const faltantes = await detectarCuotasFaltantes({
      purchase,
      month,
      entries,
      hogar: true
    });
    if (faltantes.length === 0) {
      await saveTarjetasHogar(tarjetasHogar.map(p => p.id === purchase.id ? {
        ...p,
        mesesFallidos: []
      } : p));
      return;
    }
    const nuevosFallidos = await reintentarCuotasFaltantes({
      purchase,
      pendientes: faltantes,
      writeEntriesForMonth,
      hogar: true,
      splitHogar
    });
    await saveTarjetasHogar(tarjetasHogar.map(p => p.id === purchase.id ? {
      ...p,
      mesesFallidos: nuevosFallidos
    } : p));
  }
  function cargarFijosDelMes(personId) {
    const list = fijos[personId] || [];
    const faltantes = list.filter(f => !entries.some(e => e.fijoId === f.id));
    if (faltantes.length === 0) return;
    const now = Date.now();
    const nuevas = faltantes.map((f, i) => ({
      id: `fijo-${f.id}-${now}-${i}`,
      person: personId,
      tipo: "gasto",
      categoria: f.categoria,
      monto: montoArsDeFijo(f),
      descripcion: f.nombre || "Gasto fijo",
      fijoId: f.id,
      montoUSD: f.moneda === "USD" ? Number(f.monto) || 0 : undefined,
      cotizacionUsada: f.moneda === "USD" ? Number(cotizacionDolar) || 0 : undefined,
      esTarjeta: Boolean(f.esTarjeta),
      pagado: f.esTarjeta ? false : undefined,
      ts: now - i
    }));
    persistEntries([...nuevas, ...entries]);
  }
  async function addEntry() {
    if (!activePerson) return;
    const monto = parseFloat(form.monto);
    if (!monto || monto <= 0) return;
    const esTarjeta = form.tipo === "gasto" && form.esTarjeta;
    const esRendimiento = form.tipo === "gasto" && !form.esTarjeta && form.esRendimiento;
    const categoria = form.tipo === "ingreso" ? null : form.categoria;

    // Tarjeta - consumo único (con cuotas): reusa la misma lógica que Tarjetas > Nuevo consumo.
    if (esTarjeta && form.tarjetaModo === "unico") {
      const descripcionUnico = form.descripcion.trim();
      if (!descripcionUnico) return;
      await cargarConsumoTarjeta(activePerson, {
        descripcion: descripcionUnico,
        monto: form.monto,
        categoria,
        cuotas: form.tarjetaCuotas
      });
      setForm({
        ...form,
        monto: "",
        descripcion: "",
        tarjetaCuotas: 1
      });
      return;
    }
    let descripcion = form.descripcion.trim();

    // Tarjeta - agrupable: usa la etiqueta elegida (Sube, Viajes, etc.)
    if (esTarjeta) {
      const etiqueta = (etiquetasTarjeta[activePerson] || []).find(e => e.id === form.etiquetaId);
      if (!etiqueta) return; // hace falta elegir una etiqueta para cargar un consumo agrupable
      descripcion = etiqueta.nombre;
    }
    const entry = {
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
    persistEntries([entry, ...entries]);
    setForm({
      ...form,
      monto: "",
      descripcion: ""
    });
  }
  function removeEntry(id) {
    persistEntries(entries.filter(e => e.id !== id));
  }
  async function resetMonth() {
    const emptyEntries = [];
    const defaultSett = {
      diego: {
        pct: PCT_DEFAULT
      },
      yani: {
        pct: PCT_DEFAULT
      }
    };
    setEntries(emptyEntries);
    setSettings(defaultSett);
    setConfirmingReset(false);
    const r1 = await storageSetRetry(`entries:${month}`, JSON.stringify(arrayAMapaPorId(emptyEntries)), true);
    const r2 = await storageSetRetry(`settings:${month}`, JSON.stringify(defaultSett), true);
    if (!r1 || !r2) setErrorMsg("No se pudo reiniciar el mes del todo. Probá de nuevo.");
  }
  function togglePagado(id) {
    persistEntries(entries.map(e => e.id === id ? {
      ...e,
      pagado: !e.pagado
    } : e));
  }
  function pagarTarjeta(person) {
    const next = entries.map(e => e.person === person && (e.tarjetaId || e.esTarjeta) && !e.pagado ? {
      ...e,
      pagado: true
    } : e);
    persistEntries(next);
  }
  function totalsFor(person) {
    const list = entries.filter(e => e.person === person);
    const ingresos = list.filter(e => e.tipo === "ingreso").reduce((s, e) => s + e.monto, 0);
    const gastos = list.filter(e => e.tipo === "gasto").reduce((s, e) => s + e.monto, 0);
    const pendienteTarjeta = list.filter(e => e.tipo === "gasto" && (e.tarjetaId || e.esTarjeta) && !e.pagado).reduce((s, e) => s + e.monto, 0);
    const porCategoria = {};
    CATEGORIAS.forEach(c => {
      porCategoria[c.id] = list.filter(e => e.tipo === "gasto" && e.categoria === c.id).reduce((s, e) => s + e.monto, 0);
    });
    return {
      ingresos,
      gastos,
      saldo: ingresos - gastos,
      porCategoria,
      list,
      pendienteTarjeta
    };
  }
  function budgetsFor(pct, ingresos) {
    return Object.fromEntries(CATEGORIAS.map(c => [c.id, (Number(ingresos) || 0) * (Number(pct[c.id]) || 0) / 100]));
  }
  const diego = totalsFor("diego");
  const yani = totalsFor("yani");
  const budgetsDiego = budgetsFor(settings.diego.pct, diego.ingresos);
  const budgetsYani = budgetsFor(settings.yani.pct, yani.ingresos);
  const budgetsFamiliar = Object.fromEntries(CATEGORIAS.map(c => [c.id, (budgetsDiego[c.id] || 0) + (budgetsYani[c.id] || 0)]));
  const familiar = {
    ingresos: diego.ingresos + yani.ingresos,
    gastos: diego.gastos + yani.gastos,
    saldo: diego.ingresos + yani.ingresos - (diego.gastos + yani.gastos),
    porCategoria: Object.fromEntries(CATEGORIAS.map(c => [c.id, (diego.porCategoria[c.id] || 0) + (yani.porCategoria[c.id] || 0)]))
  };
  if (!sesionLista) {
    return /*#__PURE__*/React.createElement(Shell, null, /*#__PURE__*/React.createElement("div", {
      className: "lf-gate"
    }, /*#__PURE__*/React.createElement("div", {
      className: "lf-gate-card"
    }, /*#__PURE__*/React.createElement("p", {
      className: "lf-eyebrow"
    }, "Libro Familiar"), /*#__PURE__*/React.createElement("p", {
      className: "lf-sub"
    }, "Verificando tu sesión…"))));
  }
  if (!sesion) {
    return /*#__PURE__*/React.createElement(Shell, null, /*#__PURE__*/React.createElement("div", {
      className: "lf-gate"
    }, /*#__PURE__*/React.createElement("div", {
      className: "lf-gate-card"
    }, /*#__PURE__*/React.createElement("p", {
      className: "lf-eyebrow"
    }, "Libro Familiar"), /*#__PURE__*/React.createElement("h1", {
      className: "lf-h1"
    }, "¿Quién sos?"), /*#__PURE__*/React.createElement("p", {
      className: "lf-sub"
    }, "Entrá con tu email y contraseña. Si es la primera vez, se crea la cuenta sola."), /*#__PURE__*/React.createElement("div", {
      className: "lf-gate-form"
    }, /*#__PURE__*/React.createElement("input", {
      className: "lf-input",
      type: "email",
      placeholder: "tu@email.com",
      value: emailForm,
      onChange: e => setEmailForm(e.target.value),
      onKeyDown: e => e.key === "Enter" && handleEnviarLogin()
    }), /*#__PURE__*/React.createElement("input", {
      className: "lf-input",
      type: "password",
      placeholder: "contraseña",
      value: passwordForm,
      onChange: e => setPasswordForm(e.target.value),
      onKeyDown: e => e.key === "Enter" && handleEnviarLogin()
    }), /*#__PURE__*/React.createElement("button", {
      className: "lf-add-btn",
      onClick: handleEnviarLogin,
      disabled: enviandoLogin || !emailForm.trim() || !passwordForm
    }, enviandoLogin ? "Entrando…" : "Entrar")), loginError && /*#__PURE__*/React.createElement("p", {
      className: "lf-gate-error"
    }, loginError))));
  }
  if (buscandoJugador) {
    return /*#__PURE__*/React.createElement(Shell, null, /*#__PURE__*/React.createElement("div", {
      className: "lf-gate"
    }, /*#__PURE__*/React.createElement("div", {
      className: "lf-gate-card"
    }, /*#__PURE__*/React.createElement("p", {
      className: "lf-sub"
    }, "Buscando tu perfil…"))));
  }
  if (!jugadorActual) {
    if (personKeysLibres === null) {
      return /*#__PURE__*/React.createElement(Shell, null, /*#__PURE__*/React.createElement("div", {
        className: "lf-gate"
      }, /*#__PURE__*/React.createElement("div", {
        className: "lf-gate-card"
      }, /*#__PURE__*/React.createElement("p", {
        className: "lf-sub"
      }, "Buscando tu perfil…"))));
    }
    if (personKeysLibres.length > 0) {
      return /*#__PURE__*/React.createElement(Shell, null, /*#__PURE__*/React.createElement("div", {
        className: "lf-gate"
      }, /*#__PURE__*/React.createElement("div", {
        className: "lf-gate-card"
      }, /*#__PURE__*/React.createElement("p", {
        className: "lf-eyebrow"
      }, "Libro Familiar"), /*#__PURE__*/React.createElement("h1", {
        className: "lf-h1"
      }, "¿Quién sos?"), /*#__PURE__*/React.createElement("p", {
        className: "lf-sub"
      }, "Primera vez con ", /*#__PURE__*/React.createElement("strong", null, sesion.email), " — decinos cuál de los dos jugadores sos."), /*#__PURE__*/React.createElement("div", {
        className: "lf-gate-form"
      }, personKeysLibres.map(k => /*#__PURE__*/React.createElement("button", {
        key: k,
        className: "lf-add-btn",
        disabled: vinculando,
        onClick: () => handleElegirJugador(k)
      }, "Soy ", PERSONAS[k].label))), loginError && /*#__PURE__*/React.createElement("p", {
        className: "lf-gate-error"
      }, loginError), /*#__PURE__*/React.createElement("button", {
        className: "lf-reset-btn",
        onClick: handleCerrarSesion,
        style: {
          marginTop: 16
        }
      }, /*#__PURE__*/React.createElement(LogOut, {
        size: 13
      }), " Probar con otra cuenta"))));
    }
    return /*#__PURE__*/React.createElement(Shell, null, /*#__PURE__*/React.createElement("div", {
      className: "lf-gate"
    }, /*#__PURE__*/React.createElement("div", {
      className: "lf-gate-card"
    }, /*#__PURE__*/React.createElement("p", {
      className: "lf-eyebrow"
    }, "Libro Familiar"), /*#__PURE__*/React.createElement("h1", {
      className: "lf-h1"
    }, "Ya están todos los jugadores tomados"), /*#__PURE__*/React.createElement("p", {
      className: "lf-sub"
    }, "Entraste con ", /*#__PURE__*/React.createElement("strong", null, sesion.email), ", pero los jugadores de esta familia ya están vinculados a otras cuentas. Si esto es un error, avisale a quien administra la app (necesita este ID): "), /*#__PURE__*/React.createElement("code", {
      className: "lf-gate-uid"
    }, sesion.uid), /*#__PURE__*/React.createElement("button", {
      className: "lf-reset-btn",
      onClick: handleCerrarSesion,
      style: {
        marginTop: 16
      }
    }, /*#__PURE__*/React.createElement(LogOut, {
      size: 13
    }), " Probar con otra cuenta"))));
  }
  return /*#__PURE__*/React.createElement(Shell, null, /*#__PURE__*/React.createElement("header", {
    className: "lf-header"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    className: "lf-eyebrow"
  }, "Libro Familiar"), /*#__PURE__*/React.createElement("h1", {
    className: "lf-h1"
  }, "Cuenta compartida")), /*#__PURE__*/React.createElement("div", {
    className: "lf-header-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: "lf-switch",
    style: {
      "--accent": `var(${PERSONAS[viewingPerson].cssVar})`
    },
    onClick: () => setViewingPerson(viewingPerson === "diego" ? "yani" : "diego"),
    title: viewingPerson === activePerson ? "Ver el libro del otro" : "Volver a tu libro"
  }, PERSONAS[viewingPerson].label, viewingPerson !== activePerson && " (solo lectura)"), /*#__PURE__*/React.createElement("button", {
    className: "lf-logout-btn",
    onClick: handleCerrarSesion,
    title: "Cerrar sesión",
    "aria-label": "Cerrar sesión"
  }, /*#__PURE__*/React.createElement(LogOut, {
    size: 15
  })))), /*#__PURE__*/React.createElement("div", {
    className: "lf-tabbar"
  }, /*#__PURE__*/React.createElement("button", {
    className: "lf-tab-btn" + (activeTab === "registro" ? " on" : ""),
    onClick: () => setActiveTab("registro")
  }, "Registro"), /*#__PURE__*/React.createElement("button", {
    className: "lf-tab-btn" + (activeTab === "ahorros" ? " on" : ""),
    onClick: () => setActiveTab("ahorros")
  }, /*#__PURE__*/React.createElement(PiggyBank, {
    size: 14
  }), " Ahorros")), activeTab === "registro" && /*#__PURE__*/React.createElement("nav", {
    className: "lf-monthnav"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setMonth(shiftMonth(month, -1)),
    "aria-label": "Mes anterior"
  }, /*#__PURE__*/React.createElement(ChevronLeft, {
    size: 18
  })), /*#__PURE__*/React.createElement("span", null, monthLabel(month)), /*#__PURE__*/React.createElement("button", {
    onClick: () => setMonth(shiftMonth(month, 1)),
    "aria-label": "Mes siguiente"
  }, /*#__PURE__*/React.createElement(ChevronRight, {
    size: 18
  })), /*#__PURE__*/React.createElement("button", {
    className: "lf-reset-btn",
    onClick: () => setConfirmingReset(true),
    title: `Reiniciar ${monthLabel(month)}`
  }, /*#__PURE__*/React.createElement(RotateCcw, {
    size: 13
  }), " Reiniciar mes")), activeTab === "registro" && /*#__PURE__*/React.createElement(CotizacionWidget, {
    cotizacionDolar: cotizacionDolar,
    onGuardar: guardarCotizacion,
    onActualizarLive: actualizarCotizacionLive
  }), activeTab === "registro" && confirmingReset && /*#__PURE__*/React.createElement("div", {
    className: "lf-reset-confirm"
  }, /*#__PURE__*/React.createElement(AlertTriangle, {
    size: 16
  }), /*#__PURE__*/React.createElement("p", null, "Esto borra ", /*#__PURE__*/React.createElement("strong", null, "todos los movimientos y la parametrización de ", monthLabel(month)), " para los dos. No se puede deshacer. Los gastos fijos (personales y de hogar) no se tocan."), /*#__PURE__*/React.createElement("div", {
    className: "lf-reset-confirm-btns"
  }, /*#__PURE__*/React.createElement("button", {
    className: "lf-reset-confirm-yes",
    onClick: resetMonth
  }, "Sí, reiniciar ", monthLabel(month)), /*#__PURE__*/React.createElement("button", {
    className: "lf-reset-confirm-no",
    onClick: () => setConfirmingReset(false)
  }, "Cancelar"))), activeTab === "registro" && errorMsg && /*#__PURE__*/React.createElement("div", {
    className: "lf-error"
  }, errorMsg), activeTab === "registro" && viewingPerson !== activePerson && /*#__PURE__*/React.createElement("div", {
    className: "lf-viewing-other-note"
  }, "Estás viendo el libro de ", PERSONAS[viewingPerson].label, " — no podés cargar movimientos acá. Volvé a tu libro para agregar los tuyos."), activeTab === "registro" && viewingPerson === activePerson && /*#__PURE__*/React.createElement("section", {
    className: "lf-form-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lf-form-row"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lf-toggle"
  }, /*#__PURE__*/React.createElement("button", {
    className: form.tipo === "gasto" ? "on" : "",
    onClick: () => setForm({
      ...form,
      tipo: "gasto"
    })
  }, /*#__PURE__*/React.createElement(ArrowDownCircle, {
    size: 15
  }), " Gasto"), /*#__PURE__*/React.createElement("button", {
    className: form.tipo === "ingreso" ? "on" : "",
    onClick: () => setForm({
      ...form,
      tipo: "ingreso"
    })
  }, /*#__PURE__*/React.createElement(ArrowUpCircle, {
    size: 15
  }), " Ingreso")), /*#__PURE__*/React.createElement("input", {
    className: "lf-input lf-input-monto",
    type: "number",
    inputMode: "decimal",
    placeholder: "$ 0",
    value: form.monto,
    onChange: e => setForm({
      ...form,
      monto: e.target.value
    })
  })), form.tipo === "gasto" && /*#__PURE__*/React.createElement("div", {
    className: "lf-cat-row"
  }, CATEGORIAS.map(c => /*#__PURE__*/React.createElement("button", {
    key: c.id,
    className: "lf-cat-pill" + (form.categoria === c.id ? " on" : ""),
    style: {
      "--accent": `var(${c.cssVar})`
    },
    onClick: () => setForm({
      ...form,
      categoria: c.id
    })
  }, /*#__PURE__*/React.createElement(c.Icon, {
    size: 14
  }), " ", c.label))), form.tipo === "gasto" && /*#__PURE__*/React.createElement("label", {
    className: "lf-tarjeta-check"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: form.esTarjeta,
    onChange: e => setForm({
      ...form,
      esTarjeta: e.target.checked,
      esRendimiento: e.target.checked ? false : form.esRendimiento,
      tarjetaModo: "agrupable",
      etiquetaId: null,
      descripcion: "",
      tarjetaCuotas: 1
    })
  }), /*#__PURE__*/React.createElement(CreditCard, {
    size: 13
  }), "Es tarjeta"), form.tipo === "gasto" && /*#__PURE__*/React.createElement("label", {
    className: "lf-tarjeta-check"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: form.esRendimiento,
    onChange: e => setForm({
      ...form,
      esRendimiento: e.target.checked,
      esTarjeta: e.target.checked ? false : form.esTarjeta
    })
  }), /*#__PURE__*/React.createElement(TrendingUp, {
    size: 13
  }), "Es rendimiento (a favor)"), form.tipo === "gasto" && form.esTarjeta && /*#__PURE__*/React.createElement("div", {
    className: "lf-tarjeta-modo-toggle"
  }, /*#__PURE__*/React.createElement("button", {
    className: form.tarjetaModo === "agrupable" ? "on" : "",
    onClick: () => setForm({
      ...form,
      tarjetaModo: "agrupable",
      descripcion: ""
    })
  }, "Agrupable"), /*#__PURE__*/React.createElement("button", {
    className: form.tarjetaModo === "unico" ? "on" : "",
    onClick: () => setForm({
      ...form,
      tarjetaModo: "unico",
      etiquetaId: null
    })
  }, "Consumo único")), form.tipo === "gasto" && form.esTarjeta && form.tarjetaModo === "agrupable" && /*#__PURE__*/React.createElement(EtiquetasTarjetaPicker, {
    etiquetas: etiquetasTarjeta[activePerson] || [],
    seleccionada: form.etiquetaId,
    onSeleccionar: id => setForm({
      ...form,
      etiquetaId: id
    }),
    onGuardarEtiquetas: list => saveEtiquetasTarjeta(activePerson, list),
    categoriaActual: form.categoria,
    accentVar: `var(${PERSONAS[activePerson].cssVar})`
  }), form.tipo === "gasto" && form.esTarjeta && form.tarjetaModo === "unico" && /*#__PURE__*/React.createElement("div", {
    className: "lf-tarjeta-unico-row"
  }, /*#__PURE__*/React.createElement("input", {
    className: "lf-input",
    type: "text",
    placeholder: "Descripción (ej: Libro)",
    value: form.descripcion,
    onChange: e => setForm({
      ...form,
      descripcion: e.target.value
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
    value: form.tarjetaCuotas,
    onChange: e => setForm({
      ...form,
      tarjetaCuotas: e.target.value
    })
  }))), form.tipo === "gasto" && form.esTarjeta && form.tarjetaModo === "unico" && Number(form.tarjetaCuotas) > 1 && Number(form.monto) > 0 && /*#__PURE__*/React.createElement("p", {
    className: "lf-tarjeta-preview"
  }, form.tarjetaCuotas, " cuotas de ", fmt(Number(form.monto) / Number(form.tarjetaCuotas)), " — pega en", " ", monthLabel(month), " → ", monthLabel(shiftMonth(month, Number(form.tarjetaCuotas) - 1))), /*#__PURE__*/React.createElement("div", {
    className: "lf-form-row"
  }, !form.esTarjeta && /*#__PURE__*/React.createElement("input", {
    className: "lf-input",
    type: "text",
    placeholder: "Descripción (opcional)",
    value: form.descripcion,
    onChange: e => setForm({
      ...form,
      descripcion: e.target.value
    }),
    onKeyDown: e => e.key === "Enter" && addEntry()
  }), /*#__PURE__*/React.createElement("button", {
    className: "lf-add-btn",
    onClick: addEntry,
    disabled: form.esTarjeta && form.tarjetaModo === "agrupable" && !form.etiquetaId || form.esTarjeta && form.tarjetaModo === "unico" && !form.descripcion.trim()
  }, /*#__PURE__*/React.createElement(Plus, {
    size: 16
  }), " Registrar"))), loading ? /*#__PURE__*/React.createElement("div", {
    className: "lf-loading"
  }, "Cargando el mes…") : /*#__PURE__*/React.createElement(React.Fragment, null, activeTab === "registro" && /*#__PURE__*/React.createElement("div", {
    className: "lf-swipe-container",
    ref: swipeRef,
    onPointerDown: handleSwipePointerDown,
    onPointerMove: handleSwipePointerMove,
    onPointerUp: handleSwipePointerUp,
    onPointerLeave: handleSwipePointerUp,
    onPointerCancel: handleSwipePointerUp
  }, viewingPerson === "diego" ? /*#__PURE__*/React.createElement(PersonColumn, {
    person: "diego",
    data: diego,
    settings: settings.diego,
    budgets: budgetsDiego,
    onSave: s => saveSettingsFor("diego", s),
    fijos: fijos.diego,
    onSaveFijos: list => saveFijosFor("diego", list),
    onCargarFijos: () => cargarFijosDelMes("diego"),
    onTogglePagado: togglePagado,
    onRemoveEntry: removeEntry,
    tarjetas: tarjetas.diego,
    month: month,
    onCargarTarjeta: datos => cargarConsumoTarjeta("diego", datos),
    onBorrarTarjeta: p => borrarConsumoTarjeta("diego", p),
    onEditarTarjeta: (p, datos) => editarConsumoTarjeta("diego", p, datos),
    onRevisarTarjeta: p => revisarCuotasTarjeta("diego", p),
    onPagarTarjeta: () => pagarTarjeta("diego"),
    cotizacionDolar: cotizacionDolar,
    readOnly: activePerson !== "diego"
  }) : /*#__PURE__*/React.createElement(PersonColumn, {
    person: "yani",
    data: yani,
    settings: settings.yani,
    budgets: budgetsYani,
    onSave: s => saveSettingsFor("yani", s),
    fijos: fijos.yani,
    onSaveFijos: list => saveFijosFor("yani", list),
    onCargarFijos: () => cargarFijosDelMes("yani"),
    onTogglePagado: togglePagado,
    onRemoveEntry: removeEntry,
    tarjetas: tarjetas.yani,
    month: month,
    onCargarTarjeta: datos => cargarConsumoTarjeta("yani", datos),
    onBorrarTarjeta: p => borrarConsumoTarjeta("yani", p),
    onEditarTarjeta: (p, datos) => editarConsumoTarjeta("yani", p, datos),
    onRevisarTarjeta: p => revisarCuotasTarjeta("yani", p),
    onPagarTarjeta: () => pagarTarjeta("yani"),
    cotizacionDolar: cotizacionDolar,
    readOnly: activePerson !== "yani"
  }), /*#__PURE__*/React.createElement("div", {
    className: "lf-swipe-page"
  }, /*#__PURE__*/React.createElement("section", {
    className: "lf-familiar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "lf-familiar-head"
  }, /*#__PURE__*/React.createElement("h2", null, "Vista grupal — ", monthLabel(month))), /*#__PURE__*/React.createElement("div", {
    className: "lf-familiar-totals"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "lf-label"
  }, "Ingresos"), /*#__PURE__*/React.createElement("span", {
    className: "lf-num lf-pos"
  }, fmt(familiar.ingresos))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "lf-label"
  }, "Gastos"), /*#__PURE__*/React.createElement("span", {
    className: "lf-num lf-neg"
  }, fmt(familiar.gastos))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "lf-label"
  }, "Saldo"), /*#__PURE__*/React.createElement("span", {
    className: "lf-num " + (familiar.saldo >= 0 ? "lf-pos" : "lf-neg")
  }, fmt(familiar.saldo)))), /*#__PURE__*/React.createElement("div", {
    className: "lf-cat-bars"
  }, CATEGORIAS.map(c => {
    const gastado = familiar.porCategoria[c.id] || 0;
    const presu = budgetsFamiliar[c.id];
    const pct = presu > 0 ? Math.max(0, Math.min(100, gastado / presu * 100)) : 0;
    const excedido = presu > 0 && gastado > presu;
    return /*#__PURE__*/React.createElement("div", {
      className: "lf-cat-bar-row",
      key: c.id
    }, /*#__PURE__*/React.createElement("div", {
      className: "lf-cat-bar-label"
    }, /*#__PURE__*/React.createElement(c.Icon, {
      size: 14,
      style: {
        color: `var(${c.cssVar})`
      }
    }), /*#__PURE__*/React.createElement("span", null, c.label)), /*#__PURE__*/React.createElement("div", {
      className: "lf-bar-track" + (excedido ? " lf-bar-exceeded" : ""),
      title: `${Math.round(pct)}% usado`,
      style: {
        background: `linear-gradient(to right, ${c.color} ${Math.max(pct, 3)}%, rgba(35,48,59,0.08) ${Math.max(pct, 3)}%)`
      }
    }), /*#__PURE__*/React.createElement("span", {
      className: "lf-bar-nums"
    }, fmt(gastado), presu > 0 ? ` / ${fmt(presu)}` : ""));
  })), /*#__PURE__*/React.createElement("p", {
    className: "lf-pct-total"
  }, "Se arma sumando lo que cada uno parametrizó en su columna.")), activeTab === "registro" && /*#__PURE__*/React.createElement(HogarSection, {
    list: fijosHogar,
    split: splitHogar,
    entries: entries,
    onSaveAll: saveHogarConfig,
    onCargar: cargarFijosHogarDelMes,
    cotizacionDolar: cotizacionDolar,
    onGuardarCotizacion: guardarCotizacion,
    onActualizarCotizacionLive: actualizarCotizacionLive,
    tarjetasHogar: tarjetasHogar,
    month: month,
    onCargarTarjetaHogar: crearConsumoTarjetaHogar,
    onBorrarTarjetaHogar: borrarConsumoTarjetaHogar,
    onEditarTarjetaHogar: editarConsumoTarjetaHogar,
    onRevisarTarjetaHogar: revisarCuotasTarjetaHogar,
    onRepararTarjetaHogar: repararTarjetasHogar
  }))), activeTab === "ahorros" && /*#__PURE__*/React.createElement(AhorrosSection, {
    reservas: reservas,
    activePerson: activePerson,
    onSaveReservas: saveReservas
  })));
}
