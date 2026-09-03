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
import { PERSONAS, fmt, CATEGORIAS_DEFAULT, pctPorDefecto, iconoDe, ETIQUETAS_TARJETA_DEFAULT, monthKey, monthLabel, shiftMonth } from "./constants.js";
import { storageSetRetry, fetchCotizacionLive, arrayAMapaPorId, mapaAArray } from "./storage.js";
import { Shell, EtiquetasTarjetaPicker, CotizacionWidget } from "./components.js";
import { PersonColumn } from "./pantalla-mi-cuenta.js";
import { AhorrosSection } from "./pantalla-ahorros.js";
import { HogarSection } from "./pantalla-hogar.js";
import { escribirCuotas, removeInstallments, detectarCuotasFaltantes, reintentarCuotasFaltantes, calcularRegistrosTarjetaHogarAReparar } from "./logica-tarjetas.js";
import { montoArsDeFijo, entriesActualizadasPorFijos, entriesActualizadasPorHogar, armarEntriesFijosFaltantes, armarEntriesHogarFaltantes } from "./logica-fijos.js";
import { armarMovimientoDesdeForm, escribirEntriesEnMes, entriesSinId, entriesConPagadoToggleado, entriesConTarjetaPagada } from "./logica-movimientos.js";
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
    // "posible": el botón está apretado pero todavía no sabemos si es un
    // click o el inicio de un arrastre. "arrastrando": ya se confirmó que es
    // un arrastre (se movió lo suficiente) y ahí recién capturamos el
    // puntero. Antes esto capturaba el puntero apenas se apretaba el botón
    // del mouse, sin esperar ningún movimiento — eso hacía que el navegador
    // le mandara TODO el gesto al contenedor en vez de al botón que se tocó,
    // y como el pointerup nunca "cerraba" sobre el botón original, ningún
    // click adentro del carrusel funcionaba (Parametrizar, tachos,
    // desplegables, etc. — un desastre). Ahora un simple click (sin mover el
    // mouse) nunca dispara la captura, así que llega normal al botón.
    posible: false,
    arrastrando: false,
    xInicial: 0,
    yInicial: 0,
    scrollInicial: 0,
    pointerId: null
  });
  function handleSwipePointerDown(e) {
    if (e.pointerType === "touch") return;
    const el = swipeRef.current;
    if (!el) return;
    swipeDrag.current = {
      posible: true,
      arrastrando: false,
      xInicial: e.clientX,
      yInicial: e.clientY,
      scrollInicial: el.scrollLeft,
      pointerId: e.pointerId
    };
  }
  function handleSwipePointerMove(e) {
    const d = swipeDrag.current;
    if (!d.posible && !d.arrastrando) return;
    const el = swipeRef.current;
    if (!el) return;
    const dx = e.clientX - d.xInicial;
    if (!d.arrastrando) {
      const dy = e.clientY - d.yInicial;
      // Todavía no se movió lo suficiente para saber si es un click o un
      // arrastre — esperamos. Si el movimiento es más vertical que horizontal,
      // no lo tomamos como swipe (para no robarle un scroll con mouse/trackpad).
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        d.posible = false;
        return;
      }
      d.arrastrando = true;
      el.setPointerCapture(d.pointerId);
    }
    el.scrollLeft = d.scrollInicial - dx;
  }
  function handleSwipePointerUp() {
    swipeDrag.current.posible = false;
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
  // Agrupaciones (Ahorros/Necesidades/Liah/Placeres, o lo que cada uno arme):
  // totalmente personalizables, cada jugador tiene la suya propia guardada en
  // Firebase bajo `agrupaciones:{person}` — no hay ninguna fija en el código,
  // CATEGORIAS_DEFAULT solo se usa para "sembrar" a un jugador la primera vez
  // que entra (ver el useEffect de carga más abajo). Arranca en `null` (no
  // `[]`) para poder distinguir "todavía no se cargó de Firebase" de
  // "se cargó y este jugador se quedó sin ninguna agrupación" (caso que ni
  // debería poder pasar, AgrupacionesEditor no deja borrar la última).
  const [agrupaciones, setAgrupaciones] = useState({
    diego: null,
    yani: null
  });
  const [settings, setSettings] = useState({
    diego: {
      pct: pctPorDefecto(CATEGORIAS_DEFAULT)
    },
    yani: {
      pct: pctPorDefecto(CATEGORIAS_DEFAULT)
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
    categoria: null,
    monto: "",
    descripcion: "",
    esTarjeta: false,
    esRendimiento: false,
    tarjetaModo: "agrupable",
    etiquetaId: null,
    tarjetaCuotas: 1
  });
  // Si la categoría elegida en el formulario ya no existe en las agrupaciones
  // del jugador activo (todavía no cargaron de Firebase, o la borró/renombró
  // desde el editor de agrupaciones), la reemplaza por la primera disponible.
  useEffect(() => {
    const propias = (activePerson && agrupaciones[activePerson]) || [];
    if (propias.length === 0) return;
    if (!propias.some(c => c.id === form.categoria)) {
      setForm(f => ({
        ...f,
        categoria: propias[0].id
      }));
    }
  }, [activePerson, agrupaciones]);
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
          pct: pctPorDefecto(agrupaciones.diego)
        },
        yani: {
          pct: pctPorDefecto(agrupaciones.yani)
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
  }, [agrupaciones]);
  useEffect(() => {
    load(month);
  }, [month, load]);

  // Cada pantalla del carrusel (Resumen, Tarjetas, Movimientos, Grupo) puede
  // tener una altura de contenido distinta, y como el carrusel es un flex
  // row, el contenedor por default toma la altura de la pantalla MÁS ALTA
  // (Movimientos, que ahora crece libre) — eso deja espacio en blanco abajo
  // en las pantallas más cortas. Para evitarlo, medimos la altura real de la
  // pantalla actualmente visible y se la aplicamos como altura fija al
  // contenedor, así el resto del documento no reserva espacio de más. Solo
  // aplica en mobile (max-width: 640px, el mismo breakpoint del swipe); en
  // desktop se limpia cualquier altura inline para que quede en "auto" como
  // siempre.
  useEffect(() => {
    const el = swipeRef.current;
    if (!el) return;
    const mq = window.matchMedia("(max-width: 640px)");
    function ajustarAlturaSwipe() {
      if (!mq.matches) {
        el.style.height = "";
        return;
      }
      const ancho = el.clientWidth || 1;
      const idx = Math.max(0, Math.min(el.children.length - 1, Math.round(el.scrollLeft / ancho)));
      const pagina = el.children[idx];
      if (pagina) {
        el.style.height = pagina.scrollHeight + "px";
      }
      // Por más que el CSS ya use "overflow-y: hidden" (no "auto") para que el
      // navegador no arme un scroll vertical propio acá adentro, esto es un
      // resguardo extra: si por algún desfasaje momentáneo de altura llegara a
      // moverse el scroll interno de este contenedor, lo volvemos a 0 — todo
      // el scroll vertical tiene que ser siempre el de la página, nunca el de
      // este contenedor.
      if (el.scrollTop !== 0) el.scrollTop = 0;
    }
    ajustarAlturaSwipe();
    el.addEventListener("scroll", ajustarAlturaSwipe, {
      passive: true
    });
    window.addEventListener("resize", ajustarAlturaSwipe);
    if (mq.addEventListener) mq.addEventListener("change", ajustarAlturaSwipe);else mq.addListener(ajustarAlturaSwipe);
    let ro = null;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(ajustarAlturaSwipe);
      Array.from(el.children).forEach(hijo => ro.observe(hijo));
    }
    return () => {
      el.removeEventListener("scroll", ajustarAlturaSwipe);
      window.removeEventListener("resize", ajustarAlturaSwipe);
      if (mq.removeEventListener) mq.removeEventListener("change", ajustarAlturaSwipe);else mq.removeListener(ajustarAlturaSwipe);
      if (ro) ro.disconnect();
    };
  }, [viewingPerson, activeTab, entries, fijos, fijosHogar, tarjetas, tarjetasHogar, etiquetasTarjeta, reservas]);

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
      // Agrupaciones de cada jugador. Si todavía no tiene ninguna guardada
      // (primera vez que entra), se la "siembra" con el set original de
      // siempre (Ahorros/Necesidades/Liah/Placeres) y se guarda esa semilla
      // en Firebase — mismo patrón que ETIQUETAS_TARJETA_DEFAULT más abajo.
      const nextAgrupaciones = {
        diego: null,
        yani: null
      };
      for (const pid of ["diego", "yani"]) {
        try {
          const r = await window.storage.get(`agrupaciones:${pid}`, true);
          if (r) {
            const parsed = JSON.parse(r.value);
            nextAgrupaciones[pid] = Array.isArray(parsed) && parsed.length > 0 ? parsed : CATEGORIAS_DEFAULT;
          } else {
            nextAgrupaciones[pid] = CATEGORIAS_DEFAULT;
            await storageSetRetry(`agrupaciones:${pid}`, JSON.stringify(CATEGORIAS_DEFAULT), true);
          }
        } catch {
          nextAgrupaciones[pid] = CATEGORIAS_DEFAULT;
        }
      }
      setAgrupaciones(nextAgrupaciones);
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
  // Guarda la lista de agrupaciones de un jugador (Ahorros/Necesidades/Liah/
  // Placeres, o lo que haya armado). No migra ni toca movimientos ya
  // cargados con una categoría que se borró o renombró — ver la nota en
  // AgrupacionesEditor (pantalla-mi-cuenta.js) sobre por qué eso es
  // intencional. Sí limpia, dentro de la parametrización guardada de este
  // mes, los porcentajes de categorías que ya no existen (para que "Total: X%"
  // no arrastre un número fantasma de una categoría borrada).
  async function saveAgrupacionesFor(personId, list) {
    setAgrupaciones(prev => ({
      ...prev,
      [personId]: list
    }));
    const res = await storageSetRetry(`agrupaciones:${personId}`, JSON.stringify(list), true);
    if (!res) {
      setErrorMsg("No se pudieron guardar las agrupaciones. Probá de nuevo.");
      return;
    }
    const idsVigentes = new Set(list.map(c => c.id));
    const pctViejo = (settings[personId] && settings[personId].pct) || {};
    const pctLimpio = Object.fromEntries(Object.entries(pctViejo).filter(([id]) => idsVigentes.has(id)));
    await saveSettingsFor(personId, {
      ...settings[personId],
      pct: pctLimpio
    });
  }
  // El cálculo del monto en pesos de un fijo, y la lógica de qué movimientos
  // hay que actualizar cuando se edita la lista, viven en logica-fijos.js.
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
    const nextEntries = entriesActualizadasPorFijos(entries, list, cotizacionDolar);
    if (nextEntries) await persistEntries(nextEntries);
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
    const nextEntries = entriesActualizadasPorHogar(entries, list, newSplit);
    if (nextEntries) await persistEntries(nextEntries);
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
  function cargarFijosHogarDelMes(fijoId) {
    const nuevas = armarEntriesHogarFaltantes({
      fijosHogar,
      entries,
      split: splitHogar,
      soloId: fijoId
    });
    if (nuevas.length === 0) return;
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

  // El detalle de cómo se escribe un lote de movimientos en un mes (actual o
  // no) vive en logica-movimientos.js — acá solo se le pasa el estado actual.
  async function writeEntriesForMonth(mKey, newEntries) {
    return escribirEntriesEnMes({
      mKey,
      newEntries,
      month,
      entries,
      persistEntries
    });
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
  function cargarFijosDelMes(personId, fijoId) {
    const nuevas = armarEntriesFijosFaltantes({
      list: fijos[personId] || [],
      entries,
      personId,
      cotizacionDolar,
      soloId: fijoId
    });
    if (nuevas.length === 0) return;
    persistEntries([...nuevas, ...entries]);
  }
  async function addEntry() {
    if (!activePerson) return;
    const esTarjeta = form.tipo === "gasto" && form.esTarjeta;
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

    // Resto de los casos (ingreso, gasto suelto, o tarjeta "agrupable" con
    // etiqueta): armar el movimiento vive en logica-movimientos.js.
    const entry = armarMovimientoDesdeForm({
      form,
      activePerson,
      etiquetasDePersona: etiquetasTarjeta[activePerson]
    });
    if (!entry) return;
    persistEntries([entry, ...entries]);
    setForm({
      ...form,
      monto: "",
      descripcion: ""
    });
  }
  function removeEntry(id) {
    persistEntries(entriesSinId(entries, id));
  }
  async function resetMonth() {
    const emptyEntries = [];
    const defaultSett = {
      diego: {
        pct: pctPorDefecto(agrupaciones.diego)
      },
      yani: {
        pct: pctPorDefecto(agrupaciones.yani)
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
    persistEntries(entriesConPagadoToggleado(entries, id));
  }
  function pagarTarjeta(person) {
    persistEntries(entriesConTarjetaPagada(entries, person));
  }
  function totalsFor(person) {
    const list = entries.filter(e => e.person === person);
    const ingresos = list.filter(e => e.tipo === "ingreso").reduce((s, e) => s + e.monto, 0);
    const gastos = list.filter(e => e.tipo === "gasto").reduce((s, e) => s + e.monto, 0);
    const pendienteTarjeta = list.filter(e => e.tipo === "gasto" && (e.tarjetaId || e.esTarjeta) && !e.pagado).reduce((s, e) => s + e.monto, 0);
    const porCategoria = {};
    (agrupaciones[person] || []).forEach(c => {
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
  function budgetsFor(pct, ingresos, categorias) {
    return Object.fromEntries((categorias || []).map(c => [c.id, (Number(ingresos) || 0) * (Number(pct[c.id]) || 0) / 100]));
  }
  const diego = totalsFor("diego");
  const yani = totalsFor("yani");
  const budgetsDiego = budgetsFor(settings.diego.pct, diego.ingresos, agrupaciones.diego);
  const budgetsYani = budgetsFor(settings.yani.pct, yani.ingresos, agrupaciones.yani);
  // Antes "Vista grupal" armaba una sola barra por categoría sumando lo de
  // Diego y Yani, porque las dos usaban el mismo set fijo de 4 categorías.
  // Ahora que cada uno arma las suyas (pueden no coincidir en ids ni en
  // cantidad), ya no hay una forma correcta de "sumar" categoría con
  // categoría entre los dos — Vista grupal muestra el desglose de cada uno
  // por separado (ver más abajo, sección "Vista grupal"). Acá solo queda el
  // total combinado (ingresos/gastos/saldo), que sí es válido sumarlo.
  const familiar = {
    ingresos: diego.ingresos + yani.ingresos,
    gastos: diego.gastos + yani.gastos,
    saldo: diego.ingresos + yani.ingresos - (diego.gastos + yani.gastos)
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
  }, /*#__PURE__*/React.createElement("div", {
    className: "lf-brand"
  }, /*#__PURE__*/React.createElement("img", {
    src: "logo-liah.png",
    alt: "Líah — gestión de gastos del hogar",
    className: "lf-brand-logo"
  })), /*#__PURE__*/React.createElement("div", {
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
  }, (agrupaciones[activePerson] || []).map(c => /*#__PURE__*/React.createElement("button", {
    key: c.id,
    className: "lf-cat-pill" + (form.categoria === c.id ? " on" : ""),
    style: {
      "--accent": c.color
    },
    onClick: () => setForm({
      ...form,
      categoria: c.id
    })
  }, /*#__PURE__*/React.createElement(iconoDe(c.icon), {
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
    categorias: agrupaciones[activePerson] || [],
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
    categorias: agrupaciones.diego || [],
    onSaveAgrupaciones: list => saveAgrupacionesFor("diego", list),
    fijos: fijos.diego,
    onSaveFijos: list => saveFijosFor("diego", list),
    onCargarFijos: fijoId => cargarFijosDelMes("diego", fijoId),
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
    categorias: agrupaciones.yani || [],
    onSaveAgrupaciones: list => saveAgrupacionesFor("yani", list),
    fijos: fijos.yani,
    onSaveFijos: list => saveFijosFor("yani", list),
    onCargarFijos: fijoId => cargarFijosDelMes("yani", fijoId),
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
  },
  // Antes esto era una sola barra por categoría, sumando Diego + Yani —
  // funcionaba porque los dos usaban el mismo set fijo de 4 categorías. Ahora
  // que cada uno arma las suyas (con sus propios ids, nombres, colores),
  // sumar "categoría con categoría" ya no tiene sentido garantizado — así que
  // se muestra el desglose de cada uno por separado, con su propia
  // parametrización.
  [{
    personId: "diego",
    persona: diego,
    budgetsPersona: budgetsDiego,
    cats: agrupaciones.diego || []
  }, {
    personId: "yani",
    persona: yani,
    budgetsPersona: budgetsYani,
    cats: agrupaciones.yani || []
  }].map(({
    personId,
    persona,
    budgetsPersona,
    cats
  }) => /*#__PURE__*/React.createElement("div", {
    className: "lf-familiar-persona",
    key: personId
  }, /*#__PURE__*/React.createElement("p", {
    className: "lf-familiar-sub",
    style: {
      color: `var(${PERSONAS[personId].cssVar})`
    }
  }, PERSONAS[personId].label), cats.map(c => {
    const gastado = persona.porCategoria[c.id] || 0;
    const presu = budgetsPersona[c.id];
    const pct = presu > 0 ? Math.max(0, Math.min(100, gastado / presu * 100)) : 0;
    const excedido = presu > 0 && gastado > presu;
    return /*#__PURE__*/React.createElement("div", {
      className: "lf-cat-bar-row",
      key: c.id
    }, /*#__PURE__*/React.createElement("div", {
      className: "lf-cat-bar-label"
    }, /*#__PURE__*/React.createElement(iconoDe(c.icon), {
      size: 14,
      style: {
        color: c.color
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
  })))), /*#__PURE__*/React.createElement("p", {
    className: "lf-pct-total"
  }, "Cada uno con sus propias agrupaciones y su propia parametrización.")), activeTab === "registro" && /*#__PURE__*/React.createElement(HogarSection, {
    list: fijosHogar,
    split: splitHogar,
    entries: entries,
    categorias: agrupaciones[activePerson] || [],
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
