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
