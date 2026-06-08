"use client";
import { useState, useEffect, useCallback } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

function getFirebaseApp() {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
}

// ─── TIPOS ────────────────────────────────────────────────────────────────────
type MealStatus = "pendiente" | "completo" | "salteado";
type WorkoutStatus = "pendiente" | "completo" | "descanso";
type Tab = "horarios" | "dieta" | "entreno" | "logistica" | "kpis";

interface Ingrediente { nombre: string; kcal: number; proteina: number; carbos: number; grasa: number; }
interface MealEntry {
  id: string; nombre: string; hora: string; kcal: number; proteina: number; carbos: number; grasa: number;
  status: MealStatus; nota?: string; ingredientes: Ingrediente[]; esPersonalizada?: boolean;
}
interface WorkoutBlock { titulo: string; tipo: "fuerza"|"cardio"|"tecnica"|"full body"|"recuperacion"; ejercicios: {nombre:string;detalle:string}[]; duracion: string; }
interface WorkoutEntry { nombre: string; tipo: "fuerza"|"metcon"|"cardio"|"descanso"|"tecnica"|"full body"; bloques: WorkoutBlock[]; status: WorkoutStatus; rounds?: string; nota?: string; }
interface DayKPIs { peso?: number; horas_sueno?: number; agua_litros?: number; energia: 1|2|3|4|5; }
interface DayRecord {
  fecha: string; timestamp: string; responsable: string;
  comidas: MealEntry[]; entrenamiento: WorkoutEntry[]; kpis: DayKPIs; completado: boolean;
}

// ─── BASE DE ALIMENTOS (kcal/100g o por unidad) ───────────────────────────────
const ALIMENTOS_DB: Record<string, Omit<Ingrediente,"nombre">> = {
  "pechuga de pollo": { kcal: 165, proteina: 31, carbos: 0, grasa: 3.6 },
  "avena": { kcal: 389, proteina: 17, carbos: 66, grasa: 7 },
  "banana": { kcal: 89, proteina: 1.1, carbos: 23, grasa: 0.3 },
  "papa": { kcal: 77, proteina: 2, carbos: 17, grasa: 0.1 },
  "huevo": { kcal: 78, proteina: 6, carbos: 0.6, grasa: 5 },
  "leche entera": { kcal: 61, proteina: 3.2, carbos: 4.8, grasa: 3.3 },
  "ricota descremada": { kcal: 138, proteina: 11, carbos: 3, grasa: 9 },
  "maní": { kcal: 567, proteina: 26, carbos: 16, grasa: 49 },
  "almendras": { kcal: 579, proteina: 21, carbos: 22, grasa: 50 },
  "nueces": { kcal: 654, proteina: 15, carbos: 14, grasa: 65 },
  "zapallito": { kcal: 17, proteina: 1.2, carbos: 3.1, grasa: 0.3 },
  "morrón": { kcal: 31, proteina: 1, carbos: 6, grasa: 0.3 },
  "cebolla": { kcal: 40, proteina: 1.1, carbos: 9.3, grasa: 0.1 },
  "pan integral": { kcal: 247, proteina: 13, carbos: 41, grasa: 3.4 },
  "arroz integral": { kcal: 111, proteina: 2.6, carbos: 23, grasa: 0.9 },
  "manzana": { kcal: 52, proteina: 0.3, carbos: 14, grasa: 0.2 },
  "café": { kcal: 2, proteina: 0.3, carbos: 0, grasa: 0 },
  "aceite de oliva": { kcal: 884, proteina: 0, carbos: 0, grasa: 100 },
  "tomate": { kcal: 18, proteina: 0.9, carbos: 3.9, grasa: 0.2 },
  "lechuga": { kcal: 15, proteina: 1.4, carbos: 2.9, grasa: 0.2 },
  "cacao amargo": { kcal: 228, proteina: 20, carbos: 58, grasa: 14 },
  "miel": { kcal: 304, proteina: 0.3, carbos: 82, grasa: 0 },
  "queso cremoso light": { kcal: 130, proteina: 14, carbos: 2, grasa: 7 },
  "clara de huevo": { kcal: 17, proteina: 3.6, carbos: 0.2, grasa: 0 },
};

const UNIDADES_HINT: Record<string,string> = {
  "huevo":"unidad(es)", "banana":"unidad(es)", "manzana":"unidad(es)",
  "café":"taza(s)", "leche entera":"ml", "aceite de oliva":"ml",
  "avena":"g", "arroz integral":"g", "pechuga de pollo":"g", "papa":"g",
  "ricota descremada":"g", "maní":"g", "almendras":"g", "nueces":"g",
  "zapallito":"g", "morrón":"g", "cebolla":"g", "pan integral":"g",
};

// Factor de conversión a 100g/unidad base
const FACTOR: Record<string,number> = {
  "huevo":1, "banana":1, "manzana":1, "café":1,
  "leche entera":0.01,"aceite de oliva":0.01,
};

function calcIngrediente(nombre: string, cantidad: number): Ingrediente {
  const key = nombre.toLowerCase().trim();
  const base = ALIMENTOS_DB[key];
  if (!base) return { nombre, kcal: 0, proteina: 0, carbos: 0, grasa: 0 };
  const factor = FACTOR[key] !== undefined ? FACTOR[key] : 0.01;
  return {
    nombre,
    kcal: Math.round(base.kcal * cantidad * factor),
    proteina: parseFloat((base.proteina * cantidad * factor).toFixed(1)),
    carbos: parseFloat((base.carbos * cantidad * factor).toFixed(1)),
    grasa: parseFloat((base.grasa * cantidad * factor).toFixed(1)),
  };
}

// ─── PLAN SEMANAL BASE ────────────────────────────────────────────────────────
const NOMBRE_DIA = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
const TIPO_DIA = ["WOD 🔥","WOD 🔥","Descanso","WOD 🔥","WOD 🔥","Activo","Meal Prep"];
const ES_WOD = [true,true,false,true,true,false,false];

const HORARIOS_DIA = [
  { hora:"5:15", evento:"Despertarse + Desayuno", desc:"Avena overnight + café negro. Listo en 5 min.", tipo:"food" },
  { hora:"6:00", evento:"Entrada al trabajo", desc:"Llevás el almuerzo en tupper y snacks del día.", tipo:"work" },
  { hora:"9:00", evento:"Media mañana", desc:"Snack: Ricota + frutos secos + fruta.", tipo:"food" },
  { hora:"12:00", evento:"Almuerzo pre-entreno", desc:"Tupper: pechuga de pollo + papa + vegetales (3hs antes del WOD).", tipo:"food" },
  { hora:"14:45", evento:"Pre-entreno inmediato", desc:"1 banana + café negro. Camino al box.", tipo:"food" },
  { hora:"15:00", evento:"Salida trabajo → Box", desc:"15–20 min para llegar, cambiarse y calentar.", tipo:"train" },
  { hora:"15:30", evento:"CrossFit WOD 🔥", desc:"Calentamiento + Fuerza + WOD + vuelta a la calma. ~60–70 min.", tipo:"train" },
  { hora:"17:00", evento:"Post-entreno ⚡ CRÍTICO", desc:"Ventana anabólica: bowl ricota + banana + avena + cacao. Máxima absorción.", tipo:"food" },
  { hora:"20:00", evento:"Cena", desc:"Proteína + vegetales + grasa saludable. Sin carbos altos.", tipo:"food" },
  { hora:"21:30", evento:"Pre-sueño opcional", desc:"Ricota sola o con cacao. Proteína de digestión lenta para recuperación nocturna.", tipo:"sleep" },
  { hora:"22:00", evento:"A dormir — 7–8 hs", desc:"Levantarse a las 5:15 requiere dormir a las 22hs máximo.", tipo:"sleep" },
];

function makeMealId() { return "m_"+Date.now()+"_"+Math.random().toString(36).slice(2,6); }

function planComidasDia(idx: number): MealEntry[] {
  const wod = ES_WOD[idx];
  const base: Omit<MealEntry,"id">[] = wod ? [
    { nombre:"Desayuno — Avena overnight", hora:"5:15", kcal:430, proteina:14, carbos:68, grasa:10, status:"pendiente", ingredientes:[
      calcIngrediente("avena",80), calcIngrediente("leche entera",200), calcIngrediente("banana",1), calcIngrediente("maní",15) ] },
    { nombre:"Media mañana — Ricota + frutos secos", hora:"9:00", kcal:260, proteina:16, carbos:14, grasa:12, status:"pendiente", ingredientes:[
      calcIngrediente("ricota descremada",150), calcIngrediente("nueces",20), calcIngrediente("manzana",1) ] },
    { nombre:"Almuerzo pre-entreno — Pollo + papa + vegetales", hora:"12:00", kcal:580, proteina:52, carbos:48, grasa:10, status:"pendiente", ingredientes:[
      calcIngrediente("pechuga de pollo",180), calcIngrediente("papa",200), calcIngrediente("zapallito",100), calcIngrediente("morrón",80) ] },
    { nombre:"Pre-entreno — Banana + café", hora:"14:45", kcal:115, proteina:1, carbos:29, grasa:0, status:"pendiente", ingredientes:[
      calcIngrediente("banana",1), calcIngrediente("café",1) ] },
    { nombre:"Post-entreno ⚡ — Bowl recuperador", hora:"17:00", kcal:400, proteina:34, carbos:52, grasa:8, status:"pendiente", ingredientes:[
      calcIngrediente("ricota descremada",200), calcIngrediente("banana",1), calcIngrediente("avena",30), calcIngrediente("cacao amargo",10), calcIngrediente("miel",10) ] },
    { nombre:"Cena — Pollo + vegetales asados", hora:"20:00", kcal:520, proteina:48, carbos:18, grasa:14, status:"pendiente", ingredientes:[
      calcIngrediente("pechuga de pollo",200), calcIngrediente("zapallito",150), calcIngrediente("cebolla",80), calcIngrediente("morrón",80), calcIngrediente("aceite de oliva",10) ] },
  ] : [
    { nombre:"Desayuno — Avena con banana", hora:"7:00", kcal:400, proteina:13, carbos:66, grasa:8, status:"pendiente", ingredientes:[
      calcIngrediente("avena",70), calcIngrediente("leche entera",200), calcIngrediente("banana",1) ] },
    { nombre:"Media mañana — Ricota + frutos secos", hora:"10:00", kcal:220, proteina:14, carbos:8, grasa:12, status:"pendiente", ingredientes:[
      calcIngrediente("ricota descremada",150), calcIngrediente("almendras",20) ] },
    { nombre:"Almuerzo — Pollo + ensalada", hora:"13:00", kcal:480, proteina:50, carbos:20, grasa:14, status:"pendiente", ingredientes:[
      calcIngrediente("pechuga de pollo",180), calcIngrediente("zapallito",150), calcIngrediente("tomate",100), calcIngrediente("aceite de oliva",10) ] },
    { nombre:"Merienda — Licuado de leche y banana", hora:"17:00", kcal:280, proteina:12, carbos:40, grasa:7, status:"pendiente", ingredientes:[
      calcIngrediente("leche entera",250), calcIngrediente("banana",1), calcIngrediente("maní",15) ] },
    { nombre:"Cena — Huevos + vegetales + pan", hora:"20:00", kcal:420, proteina:26, carbos:32, grasa:14, status:"pendiente", ingredientes:[
      calcIngrediente("huevo",3), calcIngrediente("zapallito",150), calcIngrediente("morrón",80), calcIngrediente("pan integral",60) ] },
  ];
  return base.map(m => ({ ...m, id: makeMealId() }));
}

function planEntrenoDia(idx: number): WorkoutEntry[] {
  const wods: WorkoutEntry[] = [
    { nombre:"Lunes — Fuerza + AMRAP", tipo:"fuerza", status:"pendiente", bloques:[
      { titulo:"Calentamiento", tipo:"recuperacion", duracion:"10 min", ejercicios:[{nombre:"500m remo o bicicleta",detalle:"ritmo bajo"},{nombre:"Movilidad cadera y tobillo",detalle:"2 rondas"}] },
      { titulo:"Fuerza", tipo:"fuerza", duracion:"20 min", ejercicios:[{nombre:"Back squat",detalle:"5×5 @ 75–80% 1RM"},{nombre:"Press militar",detalle:"4×6 @ 70% 1RM"}] },
      { titulo:"WOD — AMRAP 15 min", tipo:"metcon", duracion:"15 min", ejercicios:[{nombre:"15 Wall balls (9kg)",detalle:"por ronda"},{nombre:"12 Box jumps (60cm)",detalle:"por ronda"},{nombre:"9 Burpees",detalle:"por ronda"}] },
    ]},
    { nombre:"Martes — Cardio + Core", tipo:"cardio", status:"pendiente", bloques:[
      { titulo:"WOD — For time", tipo:"cardio", duracion:"~30 min", ejercicios:[{nombre:"1.000m remo",detalle:"arranque"},{nombre:"50 Kettlebell swings 24kg",detalle:""},{nombre:"40 Sit-ups",detalle:""},{nombre:"30 Box jumps",detalle:""},{nombre:"20 Pull-ups o ring rows",detalle:""}] },
      { titulo:"Finisher Tabata", tipo:"cardio", duracion:"10 min", ejercicios:[{nombre:"10 rondas: 20s sprint / 10s descanso",detalle:"bici o remo"}] },
    ]},
    { nombre:"Miércoles — Descanso activo", tipo:"descanso", status:"descanso", bloques:[
      { titulo:"Recuperación", tipo:"recuperacion", duracion:"30 min", ejercicios:[{nombre:"Caminata suave o natación",detalle:"20–30 min"},{nombre:"Foam roller + elongación global",detalle:"15 min"},{nombre:"Respiración diafragmática",detalle:"5 min"}] },
    ]},
    { nombre:"Jueves — Halterofilia + Metcon", tipo:"tecnica", status:"pendiente", bloques:[
      { titulo:"Fuerza", tipo:"fuerza", duracion:"20 min", ejercicios:[{nombre:"Deadlift",detalle:"5×4 @ 78% 1RM"},{nombre:"Push press",detalle:"4×8"}] },
      { titulo:"WOD — 5 rondas for time", tipo:"metcon", duracion:"~25 min", ejercicios:[{nombre:"12 Thrusters (42kg)",detalle:"por ronda"},{nombre:"10 Toes to bar",detalle:"por ronda"},{nombre:"200m carrera",detalle:"por ronda"}] },
    ]},
    { nombre:"Viernes — Full body + Resistencia", tipo:"full body", status:"pendiente", bloques:[
      { titulo:"WOD 'Cindy' modificado — AMRAP 20 min", tipo:"full body", duracion:"20 min", ejercicios:[{nombre:"5 Pull-ups",detalle:"por ronda"},{nombre:"10 Push-ups",detalle:"por ronda"},{nombre:"15 Air squats",detalle:"por ronda"}] },
      { titulo:"Finisher core", tipo:"fuerza", duracion:"10 min", ejercicios:[{nombre:"3×1 min plancha",detalle:"descanso 30s"},{nombre:"3×15 GHD sit-ups con peso",detalle:""}] },
    ]},
    { nombre:"Sábado — Sesión abierta / Cardio", tipo:"cardio", status:"pendiente", bloques:[
      { titulo:"Cardio libre", tipo:"cardio", duracion:"40 min", ejercicios:[{nombre:"WOD abierto o carrera continua",detalle:"40 min"},{nombre:"Movilidad post",detalle:"15 min"}] },
    ]},
    { nombre:"Domingo — Descanso + Meal Prep", tipo:"descanso", status:"descanso", bloques:[
      { titulo:"Descanso completo", tipo:"recuperacion", duracion:"—", ejercicios:[{nombre:"Meal prep dominical",detalle:"cocina para toda la semana"},{nombre:"Foam roller opcional",detalle:"10 min"}] },
    ]},
  ];
  return [wods[idx]];
}

function initDayRecord(nombre: string, idx: number): DayRecord {
  return {
    fecha: getTodayStr(), timestamp: new Date().toISOString(), responsable: nombre,
    comidas: planComidasDia(idx), entrenamiento: planEntrenoDia(idx),
    kpis: { energia: 3 }, completado: false,
  };
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function getTodayIdx() { const d=new Date().getDay(); return d===0?6:d-1; }
function getWeekId() { const n=new Date(); const y=n.getFullYear(); const w=Math.ceil(((n.getTime()-new Date(y,0,1).getTime())/86400000+1)/7); return `${y}_s${w}`; }
function getTodayStr() { const d=new Date(); return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getFullYear()).slice(2)}`; }
function sumMacros(comidas: MealEntry[]) {
  const c = comidas.filter(x=>x.status==="completo");
  return { kcal:c.reduce((s,x)=>s+x.kcal,0), proteina:c.reduce((s,x)=>s+x.proteina,0), carbos:c.reduce((s,x)=>s+x.carbos,0), grasa:c.reduce((s,x)=>s+x.grasa,0) };
}

// ─── SUGERENCIA INTELIGENTE ───────────────────────────────────────────────────
const TARGET = { kcal:2350, proteina:195, carbos:230, grasa:65 };
const TARGET_DESC = { kcal:2000, proteina:195, carbos:160, grasa:65 };

function calcSugerencia(comidas: MealEntry[], idx: number): string|null {
  const target = ES_WOD[idx] ? TARGET : TARGET_DESC;
  const completadas = comidas.filter(c=>c.status==="completo").length;
  const pendientes = comidas.filter(c=>c.status==="pendiente").length;
  if (pendientes === 0) return null;
  const tot = sumMacros(comidas);
  const faltaKcal = target.kcal - tot.kcal;
  const faltaProt = target.proteina - tot.proteina;
  const faltaCarbos = target.carbos - tot.carbos;
  const sugerencias: string[] = [];
  if (faltaProt > 40) sugerencias.push(`necesitás +${Math.round(faltaProt)}g de proteína — priorizá pechuga o huevos en la próxima comida`);
  if (faltaKcal > 600) sugerencias.push(`te faltan ~${Math.round(faltaKcal)} kcal`);
  if (faltaCarbos > 80 && ES_WOD[idx]) sugerencias.push(`cargá carbos (papa, avena, banana) para rendir en el WOD`);
  if (faltaProt < 10 && faltaKcal < 200) return "✅ Macros del día casi completos. Mantenés el plan perfectamente.";
  if (sugerencias.length === 0) return "✅ Vas bien con los macros del día.";
  return "💡 Próxima comida: " + sugerencias.join(" · ");
}

// ─── ESTILOS ──────────────────────────────────────────────────────────────────
const S = {
  page: { minHeight:"100vh", background:"#f8f7f4", fontFamily:"system-ui,sans-serif" } as React.CSSProperties,
  wrap: { maxWidth:560, margin:"0 auto", padding:"1rem" } as React.CSSProperties,
  card: { background:"white", border:"0.5px solid #e2e0d8", borderRadius:12, padding:"12px 16px", marginBottom:10 } as React.CSSProperties,
  sectionLbl: { fontSize:11, fontWeight:500 as const, color:"#888", textTransform:"uppercase" as const, letterSpacing:"0.06em", marginBottom:10, display:"block" as const },
  btn: (active:boolean, color?:string) => ({
    padding:"7px 14px", border:"0.5px solid", borderRadius:8, cursor:"pointer" as const, fontSize:13,
    fontWeight: active ? 500 : 400,
    borderColor: active ? "transparent" : "#e2e0d8",
    background: active ? (color||"#EAF3DE") : "transparent",
    color: active ? (color?"white":"#3B6D11") : "#777",
    fontFamily:"system-ui,sans-serif",
  }),
  input: { width:"100%", padding:"8px 10px", border:"0.5px solid #e2e0d8", borderRadius:8, fontSize:14, outline:"none", boxSizing:"border-box" as const, fontFamily:"system-ui,sans-serif" },
  tip: (color:string) => ({ borderLeft:`3px solid ${color}`, background: color+"18", borderRadius:"0 8px 8px 0", padding:"9px 13px", fontSize:13, lineHeight:1.6, color:"#1a1a1a", marginBottom:10 }),
};

const BADGE_COLOR: Record<string,{bg:string,txt:string}> = {
  fuerza:{bg:"#E6F1FB",txt:"#185FA5"}, metcon:{bg:"#EAF3DE",txt:"#3B6D11"},
  cardio:{bg:"#FAEEDA",txt:"#854F0B"}, descanso:{bg:"#F1EFE8",txt:"#5F5E5A"},
  tecnica:{bg:"#E6F1FB",txt:"#185FA5"}, "full body":{bg:"#EEEDFE",txt:"#534AB7"},
  recuperacion:{bg:"#E1F5EE",txt:"#0F6E56"},
};

// ─── COMPONENTE AGREGAR COMIDA ────────────────────────────────────────────────
function AgregarComidaModal({ onAdd, onClose }: { onAdd:(m:MealEntry)=>void; onClose:()=>void }) {
  const [nombre, setNombre] = useState("");
  const [hora, setHora] = useState("");
  const [query, setQuery] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [sugerencias, setSugerencias] = useState<string[]>([]);

  const buscar = (q: string) => {
    setQuery(q);
    if (q.length < 2) { setSugerencias([]); return; }
    const matches = Object.keys(ALIMENTOS_DB).filter(k=>k.includes(q.toLowerCase())).slice(0,6);
    setSugerencias(matches);
  };

  const agregarIng = (nombre: string, cant: string) => {
    const n = parseFloat(cant);
    if (isNaN(n) || n <= 0) return;
    const ing = calcIngrediente(nombre, n);
    setIngredientes(prev => [...prev, { ...ing, nombre }]);
    setQuery(""); setCantidad(""); setSugerencias([]);
  };

  const totales = ingredientes.reduce((s,i)=>({
    kcal:s.kcal+i.kcal, proteina:s.proteina+i.proteina, carbos:s.carbos+i.carbos, grasa:s.grasa+i.grasa
  }),{kcal:0,proteina:0,carbos:0,grasa:0});

  const confirmar = () => {
    if (!nombre.trim()) return;
    const meal: MealEntry = {
      id: makeMealId(), nombre, hora: hora||"—",
      ...totales, status:"completo", ingredientes, esPersonalizada:true,
    };
    onAdd(meal);
    onClose();
  };

  const unidadHint = UNIDADES_HINT[query.toLowerCase()] || "g";

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:"white",borderRadius:"16px 16px 0 0",width:"100%",maxWidth:560,maxHeight:"90vh",overflowY:"auto",padding:"1.5rem 1rem 2rem"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.25rem"}}>
          <h3 style={{fontSize:17,fontWeight:500,margin:0}}>Agregar comida</h3>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"#888",lineHeight:1}}>×</button>
        </div>

        <label style={S.sectionLbl}>Nombre de la comida</label>
        <input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="ej: Desayuno, Merienda..."
          style={{...S.input, marginBottom:12}} />

        <label style={S.sectionLbl}>Hora (opcional)</label>
        <input value={hora} onChange={e=>setHora(e.target.value)} placeholder="ej: 8:00"
          style={{...S.input, marginBottom:16}} />

        <label style={S.sectionLbl}>Agregar ingredientes</label>
        <div style={{position:"relative",marginBottom:6}}>
          <input value={query} onChange={e=>buscar(e.target.value)} placeholder="Buscar ingrediente..."
            style={{...S.input}} />
          {sugerencias.length > 0 && (
            <div style={{position:"absolute",top:"100%",left:0,right:0,background:"white",border:"0.5px solid #e2e0d8",borderRadius:8,zIndex:10,boxShadow:"0 4px 12px rgba(0,0,0,0.1)"}}>
              {sugerencias.map(s=>(
                <div key={s} onClick={()=>{setQuery(s);setSugerencias([]);}}
                  style={{padding:"9px 12px",cursor:"pointer",fontSize:13,borderBottom:"0.5px solid #f0ede4"}}
                  onMouseEnter={e=>(e.currentTarget.style.background="#f8f7f4")}
                  onMouseLeave={e=>(e.currentTarget.style.background="white")}>
                  {s} <span style={{color:"#aaa",fontSize:11}}>— {ALIMENTOS_DB[s].kcal} kcal/100g</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <input value={cantidad} onChange={e=>setCantidad(e.target.value)} placeholder={`Cantidad (${unidadHint})`}
            type="number" style={{...S.input,flex:1}} />
          <button onClick={()=>agregarIng(query,cantidad)}
            style={{padding:"8px 16px",background:"#639922",color:"white",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:500,whiteSpace:"nowrap" as const}}>
            + Agregar
          </button>
        </div>

        {ingredientes.length > 0 && (
          <div style={{...S.card,marginBottom:12}}>
            <span style={S.sectionLbl}>Ingredientes cargados</span>
            {ingredientes.map((ing,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"0.5px solid #f0ede4",fontSize:13}}>
                <span>{ing.nombre}</span>
                <div style={{display:"flex",gap:10,alignItems:"center"}}>
                  <span style={{color:"#888"}}>{ing.kcal} kcal · {ing.proteina}g prot</span>
                  <button onClick={()=>setIngredientes(prev=>prev.filter((_,j)=>j!==i))}
                    style={{background:"none",border:"none",cursor:"pointer",color:"#D85A30",fontSize:16,lineHeight:1,padding:0}}>×</button>
                </div>
              </div>
            ))}
            <div style={{marginTop:8,paddingTop:6,borderTop:"0.5px solid #e2e0d8",fontSize:13,fontWeight:500,display:"flex",gap:16}}>
              <span>🔥 {totales.kcal} kcal</span>
              <span>🥩 {totales.proteina}g</span>
              <span>🌾 {totales.carbos}g</span>
              <span>🫒 {totales.grasa}g</span>
            </div>
          </div>
        )}

        <button onClick={confirmar} disabled={!nombre.trim()}
          style={{width:"100%",padding:"13px",background: nombre.trim()?"#639922":"#ccc",color:"white",border:"none",borderRadius:12,fontSize:15,fontWeight:500,cursor: nombre.trim()?"pointer":"not-allowed"}}>
          Registrar comida como completada ✓
        </button>
      </div>
    </div>
  );
}

// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────
export default function FitnessTracker() {
  const [screen, setScreen] = useState<"login"|"app">("login");
  const [usuario, setUsuario] = useState("");
  const [usuarioInput, setUsuarioInput] = useState("");
  const [guardados, setGuardados] = useState<string[]>([]);
  const [dayRecord, setDayRecord] = useState<DayRecord|null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("horarios");
  const [showAddMeal, setShowAddMeal] = useState(false);
  const [expandedWod, setExpandedWod] = useState<number|null>(null);
  const todayIdx = getTodayIdx();
  const weekId = getWeekId();
  const dayPath = `semanas/${weekId}/dias/dia_${todayIdx}`;

  useEffect(()=>{
    const raw = localStorage.getItem("fitness_usuarios");
    if (raw) setGuardados(JSON.parse(raw));
  },[]);

  const loadDay = useCallback(async(nombre:string)=>{
    try {
      const db = getFirestore(getFirebaseApp());
      const snap = await getDoc(doc(db,dayPath));
      setDayRecord(snap.exists() ? snap.data() as DayRecord : initDayRecord(nombre,todayIdx));
    } catch { setDayRecord(initDayRecord(nombre,todayIdx)); }
  },[dayPath,todayIdx]);

  const saveDay = useCallback(async(record:DayRecord)=>{
    setSaving(true);
    try {
      const db = getFirestore(getFirebaseApp());
      await setDoc(doc(db,dayPath),record);
      setSaveMsg("Guardado ✓"); setTimeout(()=>setSaveMsg(""),2000);
    } catch { setSaveMsg("Sin conexión"); }
    setSaving(false);
  },[dayPath]);

  const updateAndSave = useCallback((updated:DayRecord)=>{ setDayRecord(updated); saveDay(updated); },[saveDay]);

  const handleLogin = async(nombre:string)=>{
    if(!nombre.trim()) return;
    const n = nombre.trim();
    setUsuario(n);
    const upd = [n,...guardados.filter(u=>u!==n)].slice(0,5);
    setGuardados(upd); localStorage.setItem("fitness_usuarios",JSON.stringify(upd));
    await loadDay(n);
    setScreen("app");
  };

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  if (screen==="login") return (
    <div style={{...S.page,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
      <div style={{background:"white",borderRadius:16,border:"0.5px solid #e2e0d8",padding:"2rem",width:"100%",maxWidth:400}}>
        <div style={{marginBottom:"1.5rem"}}>
          <div style={{width:48,height:48,borderRadius:12,background:"#EAF3DE",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:12,fontSize:24}}>💪</div>
          <h1 style={{fontSize:20,fontWeight:500,margin:0}}>Fitness Tracker</h1>
          <p style={{fontSize:13,color:"#888",marginTop:4}}>CrossFit · Dieta · KPIs · Jornada 6–15hs</p>
        </div>
        {guardados.length>0 && <>
          <span style={S.sectionLbl}>Acceso rápido</span>
          {guardados.map(u=>(
            <button key={u} onClick={()=>handleLogin(u)}
              style={{width:"100%",padding:"10px 14px",border:"0.5px solid #e2e0d8",borderRadius:10,background:"transparent",cursor:"pointer",textAlign:"left",fontSize:14,color:"#1a1a1a",display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
              <span style={{width:30,height:30,borderRadius:"50%",background:"#EAF3DE",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:500,color:"#3B6D11"}}>{u[0].toUpperCase()}</span>{u}
            </button>
          ))}
          <div style={{height:1,background:"#f0ede4",margin:"14px 0"}} />
        </>}
        <span style={S.sectionLbl}>Nombre</span>
        <input value={usuarioInput} onChange={e=>setUsuarioInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin(usuarioInput)}
          placeholder="Tu nombre..." style={{...S.input,marginBottom:10}} />
        <button onClick={()=>handleLogin(usuarioInput)}
          style={{width:"100%",padding:11,background:"#639922",color:"white",border:"none",borderRadius:10,fontSize:14,fontWeight:500,cursor:"pointer"}}>
          Entrar
        </button>
      </div>
    </div>
  );

  if (!dayRecord) return <div style={{...S.page,display:"flex",alignItems:"center",justifyContent:"center"}}><p style={{color:"#888"}}>Cargando...</p></div>;

  const totales = sumMacros(dayRecord.comidas);
  const target = ES_WOD[todayIdx] ? TARGET : TARGET_DESC;
  const sugerencia = calcSugerencia(dayRecord.comidas, todayIdx);
  const pctKcal = Math.min(100, Math.round((totales.kcal/target.kcal)*100));
  const pctProt = Math.min(100, Math.round((totales.proteina/target.proteina)*100));
  const pctCarb = Math.min(100, Math.round((totales.carbos/target.carbos)*100));
  const pctGrasa = Math.min(100, Math.round((totales.grasa/target.grasa)*100));

  const TABS: {id:Tab,label:string,icon:string}[] = [
    {id:"horarios",label:"Horarios",icon:"🕐"},
    {id:"dieta",label:"Dieta",icon:"🥗"},
    {id:"entreno",label:"WOD",icon:"🔥"},
    {id:"logistica",label:"Logística",icon:"🎒"},
    {id:"kpis",label:"KPIs",icon:"📊"},
  ];

  // helpers UI
  const updateComida = (id:string, status:MealStatus) => {
    const updated = {...dayRecord, comidas: dayRecord.comidas.map(c=>c.id===id?{...c,status}:c)};
    updateAndSave(updated);
  };
  const updateEntreno = (i:number, status:WorkoutStatus, rounds?:string) => {
    const updated = {...dayRecord, entrenamiento: dayRecord.entrenamiento.map((e,j)=>j===i?{...e,status,...(rounds!==undefined?{rounds}:{})}:e)};
    updateAndSave(updated);
  };
  const updateKPI = (key:keyof DayKPIs, val:number) => {
    updateAndSave({...dayRecord, kpis:{...dayRecord.kpis,[key]:val}});
  };
  const addMealPersonalizada = (meal:MealEntry) => {
    const updated = {...dayRecord, comidas:[...dayRecord.comidas, meal]};
    updateAndSave(updated);
  };
  const removeMeal = (id:string) => {
    updateAndSave({...dayRecord, comidas: dayRecord.comidas.filter(c=>c.id!==id)});
  };

  return (
    <div style={S.page}>
      {showAddMeal && <AgregarComidaModal onAdd={addMealPersonalizada} onClose={()=>setShowAddMeal(false)} />}

      {/* HEADER */}
      <div style={{background:"white",borderBottom:"0.5px solid #e2e0d8",padding:"12px 1rem"}}>
        <div style={{maxWidth:560,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <span style={{fontSize:16,fontWeight:500}}>Hola, {usuario.split(" ")[0]} 👋</span>
            <p style={{fontSize:12,color:"#888",margin:"2px 0 0"}}>{NOMBRE_DIA[todayIdx]} · {TIPO_DIA[todayIdx]} · {getTodayStr()}</p>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {saveMsg && <span style={{fontSize:12,color:"#639922"}}>{saveMsg}</span>}
            <button onClick={()=>setScreen("login")} style={{padding:"5px 10px",border:"0.5px solid #e2e0d8",borderRadius:7,background:"transparent",cursor:"pointer",fontSize:12,color:"#888"}}>← Salir</button>
          </div>
        </div>
      </div>

      {/* MACROS SIEMPRE VISIBLE */}
      <div style={{background:"white",borderBottom:"0.5px solid #f0ede4",padding:"10px 1rem"}}>
        <div style={{maxWidth:560,margin:"0 auto"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:8}}>
            {[
              {lbl:"Kcal",val:totales.kcal,meta:target.kcal,pct:pctKcal,col:pctKcal>=90?"#639922":"#EF9F27"},
              {lbl:"Proteína",val:`${totales.proteina}g`,meta:`${target.proteina}g`,pct:pctProt,col:pctProt>=90?"#185FA5":"#D85A30"},
              {lbl:"Carbos",val:`${totales.carbos}g`,meta:`${target.carbos}g`,pct:pctCarb,col:"#1D9E75"},
              {lbl:"Grasas",val:`${totales.grasa}g`,meta:`${target.grasa}g`,pct:pctGrasa,col:"#BA7517"},
            ].map(m=>(
              <div key={m.lbl} style={{textAlign:"center"}}>
                <div style={{fontSize:11,color:"#888",marginBottom:2}}>{m.lbl}</div>
                <div style={{fontSize:15,fontWeight:500}}>{m.val}</div>
                <div style={{fontSize:10,color:"#bbb"}}>/{m.meta}</div>
                <div style={{height:3,background:"#f0ede4",borderRadius:2,marginTop:4}}>
                  <div style={{height:3,background:m.col,borderRadius:2,width:`${m.pct}%`,transition:"width .3s"}} />
                </div>
              </div>
            ))}
          </div>
          {sugerencia && (
            <div style={{fontSize:12,padding:"7px 10px",background: sugerencia.startsWith("✅")?"#EAF3DE":"#FFF8EC",borderRadius:8,color: sugerencia.startsWith("✅")?"#3B6D11":"#854F0B",lineHeight:1.5}}>
              {sugerencia}
            </div>
          )}
        </div>
      </div>

      {/* TABS */}
      <div style={{background:"white",borderBottom:"0.5px solid #e2e0d8",overflowX:"auto"}}>
        <div style={{maxWidth:560,margin:"0 auto",display:"flex",padding:"0 0.5rem"}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)}
              style={{padding:"12px 14px",background:"transparent",border:"none",cursor:"pointer",fontSize:13,
                fontWeight:activeTab===t.id?500:400,
                color:activeTab===t.id?"#639922":"#777",
                borderBottom:activeTab===t.id?"2px solid #639922":"2px solid transparent",
                whiteSpace:"nowrap" as const, fontFamily:"system-ui,sans-serif"}}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENIDO */}
      <div style={{...S.wrap,paddingTop:"1.25rem"}}>

        {/* TAB: HORARIOS */}
        {activeTab==="horarios" && (
          <div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:"1.25rem"}}>
              {NOMBRE_DIA.map((d,i)=>(
                <div key={i} style={{borderRadius:8,padding:"7px 4px",textAlign:"center",border:"0.5px solid",
                  borderColor: i===todayIdx?"transparent": ES_WOD[i]?"#F0997B":"#B4B2A9",
                  background: i===todayIdx?"#639922": ES_WOD[i]?"#FAECE7":i===5?"#E1F5EE":"#F1EFE8"}}>
                  <div style={{fontSize:10,color: i===todayIdx?"rgba(255,255,255,0.8)":"#888",marginBottom:2}}>{d.slice(0,3)}</div>
                  <div style={{fontSize:10,fontWeight:500,color: i===todayIdx?"white": ES_WOD[i]?"#993C1D":i===5?"#0F6E56":"#5F5E5A"}}>
                    {i===5?"Activo": ES_WOD[i]?"WOD":"Desc"}
                  </div>
                </div>
              ))}
            </div>
            <span style={S.sectionLbl}>Cronograma días de entreno</span>
            <div style={S.card}>
              {HORARIOS_DIA.map((h,i)=>{
                const dotCol = h.tipo==="food"?"#1D9E75":h.tipo==="work"?"#378ADD":h.tipo==="train"?"#D85A30":"#534AB7";
                return (
                  <div key={i} style={{display:"flex",gap:12,padding:"10px 0",borderBottom: i<HORARIOS_DIA.length-1?"0.5px solid #f0ede4":"none",alignItems:"flex-start"}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:dotCol,marginTop:6,flexShrink:0}} />
                    <div style={{width:52,flexShrink:0}}>
                      <div style={{fontSize:12,fontWeight:500,color:"#555"}}>{h.hora}</div>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:500,color:"#1a1a1a"}}>{h.evento}</div>
                      <div style={{fontSize:12,color:"#888",lineHeight:1.5,marginTop:2}}>{h.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB: DIETA */}
        {activeTab==="dieta" && (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
              <span style={{...S.sectionLbl,marginBottom:0}}>Comidas de hoy · {NOMBRE_DIA[todayIdx]}</span>
              <button onClick={()=>setShowAddMeal(true)}
                style={{padding:"7px 14px",background:"#639922",color:"white",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:500}}>
                + Agregar comida
              </button>
            </div>

            {dayRecord.comidas.map((c)=>(
              <div key={c.id} style={{...S.card,
                borderColor: c.status==="completo"?"#9FE1CB":c.status==="salteado"?"#F5C4B3":"#e2e0d8",
                borderLeftWidth:3,
                borderLeftColor: c.status==="completo"?"#1D9E75":c.status==="salteado"?"#D85A30":"#e2e0d8"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:14,fontWeight:500}}>{c.nombre}</span>
                      {c.esPersonalizada && <span style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:"#EAF3DE",color:"#3B6D11"}}>tuya</span>}
                    </div>
                    <div style={{fontSize:12,color:"#888",marginTop:2}}>{c.hora} · {c.kcal} kcal · {c.proteina}g prot · {c.carbos}g carbos · {c.grasa}g grasas</div>
                  </div>
                  {c.esPersonalizada && (
                    <button onClick={()=>removeMeal(c.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#D85A30",fontSize:18,padding:"0 0 0 8px",lineHeight:1}}>×</button>
                  )}
                </div>
                {c.ingredientes.length>0 && (
                  <div style={{background:"#f8f7f4",borderRadius:8,padding:"8px 10px",marginBottom:8,fontSize:12,color:"#666"}}>
                    {c.ingredientes.map((ing,j)=>(
                      <span key={j} style={{marginRight:10}}>{ing.nombre}</span>
                    ))}
                  </div>
                )}
                <div style={{display:"flex",gap:6}}>
                  {(["completo","salteado","pendiente"] as MealStatus[]).map(s=>(
                    <button key={s} onClick={()=>updateComida(c.id,s)}
                      style={S.btn(c.status===s, s==="completo"?"#639922":s==="salteado"?"#D85A30":undefined)}>
                      {s==="completo"?"✓ Listo":s==="salteado"?"Salteado":"Pendiente"}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Resumen macro fin de día */}
            <div style={{...S.card,background:"#f8f7f4",border:"0.5px solid #e2e0d8"}}>
              <span style={S.sectionLbl}>Balance del día</span>
              {[
                {lbl:"Calorías",val:totales.kcal,meta:target.kcal,unit:"kcal",col:"#EF9F27"},
                {lbl:"Proteína",val:totales.proteina,meta:target.proteina,unit:"g",col:"#185FA5"},
                {lbl:"Carbohidratos",val:totales.carbos,meta:target.carbos,unit:"g",col:"#1D9E75"},
                {lbl:"Grasas",val:totales.grasa,meta:target.grasa,unit:"g",col:"#BA7517"},
              ].map(m=>(
                <div key={m.lbl} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}>
                    <span>{m.lbl}</span>
                    <span style={{fontWeight:500}}>{m.val}{m.unit} <span style={{fontWeight:400,color:"#888"}}>/ {m.meta}{m.unit}</span></span>
                  </div>
                  <div style={{height:5,background:"#e2e0d8",borderRadius:3}}>
                    <div style={{height:5,borderRadius:3,background:m.col,width:`${Math.min(100,(m.val/m.meta)*100)}%`,transition:"width .3s"}} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: ENTRENO */}
        {activeTab==="entreno" && (
          <div>
            {dayRecord.entrenamiento.map((e,i)=>{
              const bc = BADGE_COLOR[e.tipo]||BADGE_COLOR.descanso;
              return (
                <div key={i}>
                  <div style={{...S.card,marginBottom:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <div>
                        <div style={{fontSize:15,fontWeight:500}}>{e.nombre}</div>
                        <span style={{fontSize:11,padding:"3px 8px",borderRadius:5,background:bc.bg,color:bc.txt,fontWeight:500}}>{e.tipo}</span>
                      </div>
                      <span style={{fontSize:13,padding:"4px 10px",borderRadius:8,
                        background:e.status==="completo"?"#EAF3DE":e.status==="descanso"?"#F1EFE8":"#f8f7f4",
                        color:e.status==="completo"?"#3B6D11":e.status==="descanso"?"#5F5E5A":"#888"}}>
                        {e.status==="completo"?"✓ Hecho":e.status==="descanso"?"Descanso":"Pendiente"}
                      </span>
                    </div>

                    {/* Bloques del WOD */}
                    {e.bloques.map((b,bi)=>{
                      const bbc = BADGE_COLOR[b.tipo]||BADGE_COLOR.recuperacion;
                      const isOpen = expandedWod===bi*100+i;
                      return (
                        <div key={bi} style={{border:"0.5px solid #f0ede4",borderRadius:10,marginBottom:6,overflow:"hidden"}}>
                          <div onClick={()=>setExpandedWod(isOpen?null:bi*100+i)}
                            style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 12px",cursor:"pointer",background:isOpen?"#f8f7f4":"transparent"}}>
                            <div style={{display:"flex",gap:8,alignItems:"center"}}>
                              <span style={{fontSize:13,fontWeight:500}}>{b.titulo}</span>
                              <span style={{fontSize:10,padding:"2px 7px",borderRadius:4,background:bbc.bg,color:bbc.txt}}>{b.duracion}</span>
                            </div>
                            <span style={{fontSize:12,color:"#aaa"}}>{isOpen?"▲":"▼"}</span>
                          </div>
                          {isOpen && (
                            <div style={{padding:"0 12px 10px"}}>
                              {b.ejercicios.map((ej,ej_i)=>(
                                <div key={ej_i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"0.5px solid #f0ede4",fontSize:13}}>
                                  <span>{ej.nombre}</span>
                                  <span style={{color:"#888"}}>{ej.detalle}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {e.tipo!=="descanso" && (
                      <input placeholder="Rounds / resultado / observación..."
                        value={e.rounds||""}
                        onChange={ev=>{ const u={...dayRecord,entrenamiento:dayRecord.entrenamiento.map((x,j)=>j===i?{...x,rounds:ev.target.value}:x)}; setDayRecord(u); }}
                        onBlur={()=>saveDay(dayRecord)}
                        style={{...S.input,background:"#f8f7f4",marginTop:8,marginBottom:8}} />
                    )}

                    <div style={{display:"flex",gap:6}}>
                      {e.tipo==="descanso"
                        ? <button onClick={()=>updateEntreno(i,"descanso")} style={S.btn(true)}> ✓ Descanso</button>
                        : (["completo","pendiente"] as WorkoutStatus[]).map(s=>(
                          <button key={s} onClick={()=>updateEntreno(i,s)} style={S.btn(e.status===s,s==="completo"?"#639922":undefined)}>
                            {s==="completo"?"✓ Completado":"Pendiente"}
                          </button>
                        ))
                      }
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB: LOGISTICA */}
        {activeTab==="logistica" && (
          <div>
            <div style={S.tip("#1D9E75")}>
              <strong>Meal prep dominical — la clave del éxito:</strong> Cocinás pechuga de pollo (1.2kg), papas y vegetales para toda la semana en ~75 min. De lunes a viernes solo armás los tuppers en 5 min.
            </div>
            <span style={S.sectionLbl}>Qué llevar al trabajo cada día</span>
            <div style={S.card}>
              {[
                {item:"Tupper 1 — snack 9am",desc:"Ricota + fruta + nueces"},
                {item:"Tupper 2 — almuerzo 12pm",desc:"Pechuga + papa + vegetales"},
                {item:"1 banana suelta",desc:"Pre-entreno 14:45"},
                {item:"Botella 750ml mínimo",desc:"Hidratación en el trabajo"},
                {item:"Ropa de entreno en mochila",desc:"Ir directo al box al salir"},
              ].map((r,i,arr)=>(
                <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:i<arr.length-1?"0.5px solid #f0ede4":"none",fontSize:13}}>
                  <span style={{fontWeight:500}}>{r.item}</span>
                  <span style={{color:"#888"}}>{r.desc}</span>
                </div>
              ))}
            </div>
            <div style={S.tip("#EF9F27")}>
              <strong>Desayuno en 5 min (5:15am):</strong> Avena overnight — la noche anterior mezclás avena + leche + banana aplastada + canela en un frasco y lo dejás en la heladera. A las 5:15 lo sacás directo.
            </div>
            <div style={S.tip("#D85A30")}>
              <strong>Post-entreno sin complicaciones:</strong> Al llegar del box (17hs) tenés ricota en la heladera. Solo agregás banana + cacao + miel. No necesita cocción. Es la comida más importante del día.
            </div>
            <div style={S.tip("#185FA5")}>
              <strong>Sueño obligatorio a las 22hs:</strong> Con levantarte a las 5:15 y entrenar intenso, menos de 7 horas bloquea la quema de grasa y frena la recuperación muscular. Poné una alarma a las 21:30.
            </div>
          </div>
        )}

        {/* TAB: KPIs */}
        {activeTab==="kpis" && (
          <div>
            <span style={S.sectionLbl}>Registros del día</span>
            {[
              {key:"peso",lbl:"Peso corporal",unit:"kg",placeholder:"ej: 89.5",step:"0.1"},
              {key:"horas_sueno",lbl:"Horas de sueño",unit:"hs",placeholder:"ej: 7.5",step:"0.5"},
              {key:"agua_litros",lbl:"Agua consumida",unit:"L",placeholder:"ej: 2.5",step:"0.1"},
            ].map(f=>(
              <div key={f.key} style={{...S.card,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontSize:14,fontWeight:500}}>{f.lbl}</div>
                  <div style={{fontSize:12,color:"#888"}}>{f.unit}</div>
                </div>
                <input type="number" step={f.step} placeholder={f.placeholder}
                  value={(dayRecord.kpis as Record<string,number|undefined>)[f.key]??""} 
                  onChange={e=>updateKPI(f.key as keyof DayKPIs, parseFloat(e.target.value))}
                  style={{...S.input,width:110,textAlign:"right" as const}} />
              </div>
            ))}
            <div style={S.card}>
              <div style={{fontSize:14,fontWeight:500,marginBottom:10}}>Nivel de energía: {dayRecord.kpis.energia}/5</div>
              <div style={{display:"flex",gap:8}}>
                {[1,2,3,4,5].map(n=>(
                  <button key={n} onClick={()=>updateKPI("energia",n as 1|2|3|4|5)}
                    style={{flex:1,padding:"11px 0",borderRadius:8,border:"0.5px solid",cursor:"pointer",fontSize:18,
                      borderColor:dayRecord.kpis.energia>=n?"transparent":"#e2e0d8",
                      background:dayRecord.kpis.energia>=n?"#EAF3DE":"transparent"}}>
                    ⚡
                  </button>
                ))}
              </div>
            </div>
            <button onClick={()=>updateAndSave({...dayRecord,completado:true})}
              style={{width:"100%",padding:13,background: dayRecord.completado?"#639922":"#378ADD",color:"white",border:"none",borderRadius:12,fontSize:14,fontWeight:500,cursor:"pointer",marginTop:8}}>
              {dayRecord.completado?"✓ Día completado":"Marcar día como completo"}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
