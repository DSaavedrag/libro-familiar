// Capa de guardado: reintentos contra window.storage (shim de Firebase
// definido en index.html) y el pedido de la cotización oficial del dólar.

export async function storageSetRetry(key, value, shared = true, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await window.storage.set(key, value, shared);
      if (res) return res;
    } catch {
      // reintenta
    }
    if (i < retries) await new Promise(r => setTimeout(r, 500 * (i + 1)));
  }
  return null;
}

// Igual que storageSetRetry, pero manda una actualización parcial (PATCH) en
// vez de reemplazar el nodo entero (PUT) — ver el comentario de
// "window.storage.update" en index.html para el motivo (permisos por
// movimiento individual en "entries:{mes}").
export async function storageUpdateRetry(key, value, shared = true, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await window.storage.update(key, value, shared);
      if (res) return res;
    } catch {
      // reintenta
    }
    if (i < retries) await new Promise(r => setTimeout(r, 500 * (i + 1)));
  }
  return null;
}

// Intenta traer la cotización oficial (Banco Nación) de una API pública. Si el entorno
// no permite el pedido de red, devuelve null y la app cae al valor manual.
export async function fetchCotizacionLive() {
  try {
    const res = await fetch("https://dolarapi.com/v1/dolares/oficial");
    if (!res.ok) return null;
    const data = await res.json();
    if (data && typeof data.venta === "number") return data.venta;
    return null;
  } catch {
    return null;
  }
}

// Intenta traer la cotización en pesos de una cripto (BTC, ETH, ...) desde
// CoinGecko (API pública, sin key, soporta "ars" como moneda de destino
// directamente). `coingeckoId` es el identificador que usa esa API, no el
// ticker (ej. "bitcoin", no "BTC") — ver MONEDAS en pantalla-ahorros.js para
// el mapeo. Si el entorno no permite el pedido de red, o la cripto no tiene
// un id conocido (cualquier "Otra" cargada a mano), devuelve null y la app
// cae al valor manual, igual que con el dólar.
export async function fetchCotizacionCripto(coingeckoId) {
  if (!coingeckoId) return null;
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=ars`);
    if (!res.ok) return null;
    const data = await res.json();
    const valor = data && data[coingeckoId] && data[coingeckoId].ars;
    return typeof valor === "number" ? valor : null;
  } catch {
    return null;
  }
}

// --- Movimientos: array <-> mapa por id -------------------------------------
// Los movimientos (entries) se guardan en Firebase como un objeto {id: entry},
// no como un array — así las reglas de seguridad pueden proteger cada
// movimiento por separado (solo su dueño lo edita o lo borra) en vez de tener
// que confiar en que quien manda el guardado no toque los ajenos. El resto de
// la app sigue trabajando con `entries` como array de siempre: estas dos
// funciones son la única frontera donde se convierte de un formato al otro,
// justo antes de mandar a Firebase y justo después de traer de ahí.
export function arrayAMapaPorId(arr) {
  const map = {};
  (arr || []).forEach(item => {
    if (item && item.id) map[item.id] = item;
  });
  return map;
}
export function mapaAArray(map) {
  if (!map) return [];
  return Object.values(map);
}

// Trae el mapeo de "quién es cada jugador" (uid de Firebase Auth -> persona
// de la app). Se guarda en la clave plana "jugadores" (sin prefijo de mes ni
// de persona, como fijosHogar o reservas). Ver auth.js para cómo se usa.
export async function obtenerJugadores() {
  try {
    const r = await window.storage.get("jugadores");
    return r ? JSON.parse(r.value) : {};
  } catch {
    return {};
  }
}
