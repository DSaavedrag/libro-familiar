// Capa de autenticación: login por email + contraseña con Firebase Authentication,
// y el mapeo entre "quién sos de verdad" (tu cuenta) y "qué jugador sos en la
// app" (Diego / Yani / a futuro otros).
//
// El mapeo vive en Firebase bajo la clave plana "jugadores" (mismo patrón que
// "fijosHogar" o "reservas" — no usa el prefijo con dos puntos porque no es
// algo que dependa del mes): { [uid]: { personKey, label, cssVar, email } }.
// Por ahora esa clave se carga a mano desde la consola de Firebase (no hay
// pantalla de administración todavía) — ver las instrucciones que Claude le
// da a Diego la primera vez que cada uno entra.
//
// Antes esto era login por enlace mágico (sin contraseña, por mail). Se
// cambió a usuario y contraseña porque el plan gratuito de Firebase limita a
// 5 los enlaces de login que se pueden mandar por día — molesto para probar
// en varios dispositivos/navegadores el mismo día. Con contraseña no se manda
// ningún mail para el login normal (solo si alguien usa "olvidé mi
// contraseña", que no está implementado todavía), así que ese límite deja de
// importar. De yapa, tampoco hace falta autorizar cada dominio/IP nueva desde
// donde se prueba (eso solo aplicaba al enlace mágico).
import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
const firebaseConfig = {
  apiKey: "AIzaSyAX7bmf-VxB30FiowmMMXtlH82JHUMTMJA",
  authDomain: "libro-saavedra-juarez.firebaseapp.com",
  databaseURL: "https://libro-saavedra-juarez-default-rtdb.firebaseio.com",
  projectId: "libro-saavedra-juarez",
  storageBucket: "libro-saavedra-juarez.firebasestorage.app",
  messagingSenderId: "318722384832",
  appId: "1:318722384832:web:6501e04ba79a657c7dde25"
};
export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
// Fuerza explícitamente que la sesión quede guardada en este navegador (IndexedDB)
// entre recargas de la página. En teoría es el comportamiento por defecto, pero
// en algunos entornos (CDN, dev server local) no queda seteado a tiempo antes de
// que el login se complete — por eso se pide de forma explícita acá. Ya se probó
// y confirmó que esto funciona: la sesión sobrevive a cerrar y reabrir pestañas.
const listosParaOperar = setPersistence(auth, browserLocalPersistence).catch(e => {
  console.error("No se pudo fijar la persistencia de sesión", e);
});

// Intenta entrar con email + contraseña. Si la cuenta todavía no existe (primera
// vez que esa persona entra), la crea con esa misma contraseña y queda logueada
// directamente — no hace falta una pantalla de "registro" separada. Si la cuenta
// ya existe pero la contraseña no coincide, devuelve el error para mostrarlo.
export async function entrarOCrearCuenta(email, password) {
  await listosParaOperar;
  try {
    await signInWithEmailAndPassword(auth, email, password);
    return {
      ok: true
    };
  } catch (e) {
    if (e.code === "auth/user-not-found" || e.code === "auth/invalid-credential") {
      // En SDKs nuevos, "usuario no existe" y "contraseña incorrecta" a veces
      // llegan como el mismo código genérico (invalid-credential) por seguridad.
      // Se intenta crear la cuenta; si en realidad ya existía con otra
      // contraseña, la creación va a fallar con "email-already-in-use" y ahí sí
      // se informa que la contraseña está mal.
      try {
        await createUserWithEmailAndPassword(auth, email, password);
        return {
          ok: true
        };
      } catch (e2) {
        if (e2.code === "auth/email-already-in-use") {
          return {
            ok: false,
            error: "Esa cuenta ya existe y la contraseña no coincide."
          };
        }
        return {
          ok: false,
          error: mensajeError(e2)
        };
      }
    }
    return {
      ok: false,
      error: mensajeError(e)
    };
  }
}
function mensajeError(e) {
  if (e.code === "auth/weak-password") return "La contraseña tiene que tener al menos 6 caracteres.";
  if (e.code === "auth/invalid-email") return "Ese email no es válido.";
  if (e.code === "auth/wrong-password") return "Contraseña incorrecta.";
  if (e.code === "auth/too-many-requests") return "Demasiados intentos — esperá un momento y probá de nuevo.";
  return e.message || "Error desconocido.";
}
export function suscribirseASesion(callback) {
  return onAuthStateChanged(auth, callback);
}
export async function cerrarSesion() {
  await signOut(auth);
}

// Busca en Firebase, dentro del nodo "jugadores", cuál corresponde al uid
// autenticado. Devuelve null si esa cuenta todavía no está vinculada a ningún
// jugador.
export async function buscarJugadorPorUid(uid) {
  try {
    const r = await window.storage.get("jugadores");
    const jugadores = r ? JSON.parse(r.value) : {};
    return jugadores[uid] || null;
  } catch {
    return null;
  }
}

// Trae el mapa completo de jugadores ya vinculados (para saber, por ejemplo,
// qué personKeys ya están tomados por otra cuenta).
export async function obtenerJugadoresVinculados() {
  try {
    const r = await window.storage.get("jugadores");
    return r ? JSON.parse(r.value) : {};
  } catch {
    return {};
  }
}

// Autovinculación: la propia cuenta recién logueada elige "quién es" (Diego o
// Yani) y la app guarda ese vínculo sola, sin que haga falta tocar la consola
// de Firebase a mano. Escribe directo en jugadores/{uid} (no en la clave
// "jugadores" completa) para no pisar lo que ya cargaron otras cuentas.
export async function vincularJugadorPropio(personKey, label, cssVar) {
  const user = auth.currentUser;
  if (!user) return {
    ok: false,
    error: "No hay sesión activa."
  };
  try {
    const token = await user.getIdToken();
    const authParam = `?auth=${encodeURIComponent(token)}`;
    const url = `${window.LF_FIREBASE_URL}/${window.LF_HOGAR_ID}/jugadores/${user.uid}.json${authParam}`;
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        personKey,
        label,
        cssVar,
        email: user.email
      })
    });
    if (!res.ok) return {
      ok: false,
      error: "No se pudo guardar el vínculo (revisá la conexión o las reglas de Firebase)."
    };
    return {
      ok: true
    };
  } catch (e) {
    return {
      ok: false,
      error: e.message || "Error desconocido."
    };
  }
}
