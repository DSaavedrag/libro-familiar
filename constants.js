// Datos fijos de la app (meses, personas) y funciones auxiliares puras
// (formato de moneda, cálculo de claves de mes, catálogo de íconos para
// agrupaciones). Sin dependencias de storage ni de componentes — separado
// para que se pueda mirar rápido "qué hay de datos fijos" sin nadar entre JSX.
//
// Ojo: desde que las agrupaciones (Ahorros/Necesidades/Liah/Placeres y lo que
// cada jugador arme) pasaron a ser editables por jugador, YA NO viven acá como
// una constante fija — viven en Firebase, bajo la clave `agrupaciones:{person}`
// (ver menu.js). Lo que queda acá es:
//   - CATEGORIAS_DEFAULT: el set con el que se "siembra" un jugador la primera
//     vez que entra (antes de que edite nada) — son las cuatro de siempre.
//   - El catálogo de íconos elegibles (ICONOS_AGRUPACION) y el helper para
//     resolver un ícono guardado (que ahora se guarda como string, ej.
//     "piggy-bank", no como el componente de React directamente — un string
//     es lo único que se puede guardar en Firebase).
//   - categoriaDe(): busca una agrupación por id dentro de una lista, con un
//     fallback prolijo ("Sin categoría") para cuando el id no aparece (por
//     ejemplo, un movimiento viejo con una categoría que ese jugador borró).
import { PiggyBank, Home, Sparkles, Baby, Utensils, Car, Plane, Gift, Heart, BookOpen, Dumbbell, Coffee, Shirt, Gamepad2, GraduationCap, Stethoscope, Wallet, ShoppingCart, Dog, Music, CircleDashed } from "lucide-react";

export const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// Catálogo de íconos que se pueden elegir para una agrupación. El id es lo
// que se guarda en Firebase (string); el Icon es el componente de lucide-react
// que se usa para dibujarlo. Si en el futuro hace falta sumar más, alcanza con
// agregar una entrada acá — no hay que tocar nada más.
export const ICONOS_AGRUPACION = [{
  id: "piggy-bank",
  label: "Alcancía",
  Icon: PiggyBank
}, {
  id: "home",
  label: "Casa",
  Icon: Home
}, {
  id: "baby",
  label: "Bebé",
  Icon: Baby
}, {
  id: "sparkles",
  label: "Destellos",
  Icon: Sparkles
}, {
  id: "utensils",
  label: "Comida",
  Icon: Utensils
}, {
  id: "car",
  label: "Auto",
  Icon: Car
}, {
  id: "plane",
  label: "Viajes",
  Icon: Plane
}, {
  id: "gift",
  label: "Regalos",
  Icon: Gift
}, {
  id: "heart",
  label: "Salud/afecto",
  Icon: Heart
}, {
  id: "book-open",
  label: "Estudio",
  Icon: BookOpen
}, {
  id: "dumbbell",
  label: "Gimnasio",
  Icon: Dumbbell
}, {
  id: "coffee",
  label: "Café/salidas",
  Icon: Coffee
}, {
  id: "shirt",
  label: "Ropa",
  Icon: Shirt
}, {
  id: "gamepad-2",
  label: "Juegos",
  Icon: Gamepad2
}, {
  id: "graduation-cap",
  label: "Educación",
  Icon: GraduationCap
}, {
  id: "stethoscope",
  label: "Médico",
  Icon: Stethoscope
}, {
  id: "wallet",
  label: "Billetera",
  Icon: Wallet
}, {
  id: "shopping-cart",
  label: "Compras",
  Icon: ShoppingCart
}, {
  id: "dog",
  label: "Mascota",
  Icon: Dog
}, {
  id: "music",
  label: "Música",
  Icon: Music
}];
const ICONO_POR_ID = Object.fromEntries(ICONOS_AGRUPACION.map(i => [i.id, i.Icon]));

// Devuelve el componente de ícono para un id guardado. Si ese id no está en
// el catálogo (por ejemplo, quedó de una versión vieja), cae a un ícono
// genérico en vez de romper el render.
export function iconoDe(iconId) {
  return ICONO_POR_ID[iconId] || CircleDashed;
}

// El set con el que arranca cada jugador la primera vez, antes de personalizar
// nada. A partir de acá, la lista real de cada uno vive en Firebase
// (`agrupaciones:{person}`) — esto es solo la semilla inicial.
export const CATEGORIAS_DEFAULT = [{
  id: "ahorros",
  label: "Ahorros",
  icon: "piggy-bank",
  color: "#4F7A5B"
}, {
  id: "necesidades",
  label: "Necesidades",
  icon: "home",
  color: "#7A6A3F"
}, {
  id: "liah",
  label: "Liah",
  icon: "baby",
  color: "#6B5490"
}, {
  id: "placeres",
  label: "Placeres",
  icon: "sparkles",
  color: "#B5502F"
}];

// Agrupación "vacía" que se usa cuando un movimiento tiene una categoría que
// ya no existe en la lista vigente (se borró, o es de otro jugador con otro
// set) — así el ícono/color no explotan, muestran un genérico neutro.
export const SIN_CATEGORIA = {
  id: null,
  label: "Sin categoría",
  icon: "circle-dashed",
  color: "#8A8A8A"
};
export function categoriaDe(categorias, id) {
  return (categorias || []).find(c => c.id === id) || SIN_CATEGORIA;
}

export const PERSONAS = {
  diego: {
    label: "Diego",
    cssVar: "--c-diego"
  },
  yani: {
    label: "Yani",
    cssVar: "--c-yani"
  }
};
export const fmt = n => {
  const num = Number(n) || 0;
  const neg = num < 0;
  const abs = Math.abs(num).toFixed(2);
  const [intPart, decPart] = abs.split(".");
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${neg ? "-" : ""}$ ${withThousands},${decPart}`;
};

// Fecha y hora en que se registró un movimiento (entry.ts, milisegundos),
// formateado corto para mostrar al lado de cada movimiento: "26/08 14:30".
// Sin año (no hace falta para movimientos del mes en curso) y en hora local
// del dispositivo que lo muestra. Devuelve null si no hay ts (movimientos
// viejos, cargados antes de que este campo se mostrara) — quien lo use debe
// simplemente no mostrar nada en ese caso, no inventar una fecha.
export function fmtFechaHora(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${dia}/${mes} ${hh}:${mm}`;
}
export const PCT_DEFAULT = {
  ahorros: 20,
  necesidades: 45,
  liah: 15,
  placeres: 20
};

// Reparto por defecto para cuando todavía no hay parametrización guardada
// (mes nuevo, o "Reiniciar mes"). Si el jugador sigue con el set original de
// 4 agrupaciones, usa el reparto de siempre (20/45/15/20). Si ya lo
// personalizó (agregó, sacó o renombró alguna), reparte 100% en partes
// iguales entre las que tenga — no hay forma de "adivinar" un reparto lindo
// para agrupaciones que Diego inventó, así que arranca parejo y cada uno lo
// ajusta en Parametrizar.
export function pctPorDefecto(agrupaciones) {
  const ids = (agrupaciones || []).map(a => a.id);
  const esElSetOriginal = ids.length === 4 && ["ahorros", "necesidades", "liah", "placeres"].every(id => ids.includes(id));
  if (esElSetOriginal || ids.length === 0) return {
    ...PCT_DEFAULT
  };
  const base = Math.floor(100 / ids.length);
  const resto = 100 - base * ids.length;
  const out = {};
  ids.forEach((id, i) => {
    out[id] = base + (i < resto ? 1 : 0);
  });
  return out;
}
export const ETIQUETAS_TARJETA_DEFAULT = [{
  id: "et-sube",
  nombre: "Sube"
}, {
  id: "et-viajes",
  nombre: "Viajes"
}];
export function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return `${MESES[m - 1]} ${y}`;
}
export function shiftMonth(key, delta) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d);
}
export function monthDiff(from, to) {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}
