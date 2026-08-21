// Datos fijos de la app (categorías, personas, meses) y funciones auxiliares
// puras (formato de moneda, cálculo de claves de mes). Sin dependencias de
// storage ni de componentes — separado para que se pueda mirar rápido
// "qué hay de datos fijos" sin nadar entre JSX.
import { PiggyBank, Home, Sparkles, Baby } from "lucide-react";

export const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
export const CATEGORIAS = [{
  id: "ahorros",
  label: "Ahorros",
  Icon: PiggyBank,
  cssVar: "--c-ahorros",
  color: "#4F7A5B"
}, {
  id: "necesidades",
  label: "Necesidades",
  Icon: Home,
  cssVar: "--c-necesidades",
  color: "#7A6A3F"
}, {
  id: "liah",
  label: "Liah",
  Icon: Baby,
  cssVar: "--c-liah",
  color: "#6B5490"
}, {
  id: "placeres",
  label: "Placeres",
  Icon: Sparkles,
  cssVar: "--c-placeres",
  color: "#B5502F"
}];
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
export const IMPORT_AGOSTO_2026 = [{
  person: "diego",
  tipo: "ingreso",
  categoria: null,
  monto: 3029864,
  descripcion: "Sueldo (importado de Excel)"
}, {
  person: "diego",
  tipo: "gasto",
  categoria: "ahorros",
  monto: 606442.8,
  descripcion: "Ahorros de agosto (importado)"
}, {
  person: "diego",
  tipo: "gasto",
  categoria: "necesidades",
  monto: 1114093.25,
  descripcion: "Necesidades de agosto (importado)"
}, {
  person: "diego",
  tipo: "gasto",
  categoria: "liah",
  monto: 451727.86,
  descripcion: "Liah de agosto (importado)"
}, {
  person: "diego",
  tipo: "gasto",
  categoria: "placeres",
  monto: 509580.92,
  descripcion: "Placeres de agosto (importado)"
}];
export const PCT_DEFAULT = {
  ahorros: 20,
  necesidades: 45,
  liah: 15,
  placeres: 20
};
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
