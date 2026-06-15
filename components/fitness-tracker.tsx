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
type MealStatus = "pendiente"|"completo"|"salteado";
type WorkoutStatus = "pendiente"|"completo"|"descanso";
type Tab = "horarios"|"dieta"|"entreno"|"mealprep"|"inventario"|"compras"|"kpis";

interface Ingrediente { nombre:string; kcal:number; proteina:number; carbos:number; grasa:number; }
interface MealEntry {
  id:string; nombre:string; hora:string; kcal:number; proteina:number; carbos:number; grasa:number;
  status:MealStatus; nota?:string; ingredientes:Ingrediente[]; esPersonalizada?:boolean;
}
interface WorkoutBlock { titulo:string; tipo:"fuerza"|"cardio"|"tecnica"|"full body"|"recuperacion"; ejercicios:{nombre:string;detalle:string}[]; duracion:string; }
interface WorkoutEntry { nombre:string; tipo:"fuerza"|"metcon"|"cardio"|"descanso"|"tecnica"|"full body"; bloques:WorkoutBlock[]; status:WorkoutStatus; rounds?:string; }
interface DayKPIs { peso?:number; horas_sueno?:number; agua_litros?:number; energia:1|2|3|4|5; }
interface DayRecord { fecha:string; timestamp:string; responsable:string; comidas:MealEntry[]; entrenamiento:WorkoutEntry[]; kpis:DayKPIs; completado:boolean; }

// ─── MEAL PREP TYPES ──────────────────────────────────────────────────────────
interface TupperItem { ingrediente:string; grCocido:number; prot:number; kcal:number; carb:number; gras:number; }
interface Tupper {
  id:string; label:string; dia:string; tipo:"almuerzo"|"cena"|"snack"|"desayuno";
  color:string; items:TupperItem[]; totalProt:number; totalKcal:number; totalCarb:number; totalGras:number;
  consumidoEl?:string;
}
interface MealPrepPlan {
  kg_pollo_crudo:number; kg_papa_crudo:number; kg_zapallito_crudo:number;
  huevos:number; tuppers:Tupper[]; timestamp:string;
}

interface StockItem {
  nombre:string; unidad:string; stockActual:number; stockMinimo:number;
  consumoPorSemana:number;
  categoria:"proteina"|"cereal"|"lacteo"|"fruta"|"verdura"|"seco"|"condimento"|"bebida";
}
interface InventarioRecord { items:Record<string,StockItem>; ultimaActualizacion:string; }
interface CompraItem { nombre:string; cantidad:number; unidad:string; precio:number; fecha:string; }
interface ComprasRecord {
  historial:CompraItem[];
  precios:Record<string,{ultimo:number;promedio:number;veces:number}>;
  presupuestoMensual:number;
}

// ─── RENDIMIENTO DE COCCIÓN (factor crudo→cocido) ─────────────────────────────
const REND:Record<string,number> = {
  "pechuga de pollo":0.73, "papa":0.90, "zapallito":0.85,
  "morrón":0.80, "cebolla":0.75, "huevo":0.88,
};
// Macros por 100g CRUDO (corregidos con tabla nutricional)
const MACRO_CRUDO:Record<string,{prot:number;kcal:number;carb:number;gras:number}> = {
  "pechuga de pollo": {prot:23,  kcal:110, carb:0,    gras:1.5},
  "papa":             {prot:2.0, kcal:77,  carb:17,   gras:0.1},
  "zapallito":        {prot:1.2, kcal:17,  carb:3.1,  gras:0.3},
  "huevo":            {prot:13,  kcal:155, carb:1,    gras:11 },
  "avena":            {prot:17,  kcal:389, carb:66,   gras:7  },
  "morrón":           {prot:1.0, kcal:20,  carb:5,    gras:0.3},
  "cebolla":          {prot:1.1, kcal:40,  carb:9.3,  gras:0.1},
  "ricota descremada":{prot:11,  kcal:138, carb:3,    gras:9  },
  "leche entera":     {prot:3.2, kcal:61,  carb:4.8,  gras:3.3},
  "maní":             {prot:26,  kcal:567, carb:16,   gras:49 },
  "nueces":           {prot:15,  kcal:654, carb:14,   gras:65 },
  "almendras":        {prot:21,  kcal:579, carb:22,   gras:50 },
  "banana":           {prot:1.1, kcal:89,  carb:23,   gras:0.3},
  "manzana":          {prot:0.3, kcal:52,  carb:14,   gras:0.2},
  "pan integral":     {prot:13,  kcal:247, carb:41,   gras:3.4},
  "tomate":           {prot:0.9, kcal:18,  carb:3.9,  gras:0.2},
  "aceite de oliva":  {prot:0,   kcal:884, carb:0,    gras:100},
  "cacao amargo":     {prot:20,  kcal:228, carb:58,   gras:14 },
  "miel":             {prot:0.3, kcal:304, carb:82,   gras:0  },
  "café":             {prot:0.3, kcal:2,   carb:0,    gras:0  },
};

// Calcular macros de X gramos COCIDOS de un ingrediente
function macrosCocido(ing:string, grCocido:number):{prot:number;kcal:number;carb:number;gras:number}{
  const m=MACRO_CRUDO[ing]; if(!m) return {prot:0,kcal:0,carb:0,gras:0};
  const r=REND[ing]||1; const grCrudo=grCocido/r;
  return {
    prot:  parseFloat((grCrudo*m.prot/100).toFixed(1)),
    kcal:  Math.round(grCrudo*m.kcal/100),
    carb:  parseFloat((grCrudo*m.carb/100).toFixed(1)),
    gras:  parseFloat((grCrudo*m.gras/100).toFixed(1)),
  };
}

// ─── COLORES DE TUPPERS ───────────────────────────────────────────────────────
const TUPPER_COLORS:Record<string,{bg:string;border:string;txt:string;badge:string}> = {
  "almuerzo":  {bg:"#EAF3DE",border:"#C0DD97",txt:"#27500A",badge:"#639922"},
  "cena":      {bg:"#E6F1FB",border:"#B5D4F4",txt:"#0C447C",badge:"#185FA5"},
  "snack":     {bg:"#FAEEDA",border:"#FAC775",txt:"#633806",badge:"#854F0B"},
  "desayuno":  {bg:"#EEEDFE",border:"#CECBF6",txt:"#26215C",badge:"#534AB7"},
};
const DIA_LETRA = ["L","M","X","J","V","S","D"];
const DIA_NOMBRE = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];

// ─── GENERADOR DE MEAL PREP ───────────────────────────────────────────────────
function generarMealPrep(
  kg_pollo:number, kg_papa:number, kg_zap:number, huevos:number
): MealPrepPlan {
  const g_pollo = kg_pollo * 1000;
  const g_papa  = kg_papa  * 1000;
  const g_zap   = kg_zap   * 1000;

  // Cocido total disponible
  const cocido_pollo = Math.round(g_pollo * REND["pechuga de pollo"]);
  const cocido_papa  = Math.round(g_papa  * REND["papa"]);
  const cocido_zap   = Math.round(g_zap   * REND["zapallito"]);

  // Distribución semanal:
  // Almuerzos: L(WOD),M(WOD),X(desc),J(WOD),V(WOD) = 5 almuerzos con pollo
  // Cenas: L,M,X,J,V = 5 cenas (L,M,J,V con pollo, X con huevo)
  // Snacks fríos: 5 días con ricota (no van en tupper caliente)

  const dias_wod = [0,1,3,4]; // L,M,J,V
  const dias_desc = [2]; // X

  // Pollo por almuerzo WOD vs descanso
  const pollo_almuerzo_wod  = 185; // g cocido por porción
  const pollo_almuerzo_desc = 170;
  const pollo_cena_wod      = 200;
  const pollo_cena_desc     = 175;

  // Total pollo necesario
  const total_pollo_alm  = dias_wod.length * pollo_almuerzo_wod + dias_desc.length * pollo_almuerzo_desc;
  const total_pollo_cena = dias_wod.length * pollo_cena_wod + dias_desc.length * pollo_cena_desc;
  const total_pollo_need = total_pollo_alm + total_pollo_cena;
  const scale_pollo = Math.min(1, cocido_pollo / total_pollo_need);

  // Papa: WOD 200g, descanso 120g
  const papa_alm_wod  = 200; const papa_alm_desc = 120;
  const total_papa_need = dias_wod.length * papa_alm_wod + dias_desc.length * papa_alm_desc;
  const scale_papa = Math.min(1, cocido_papa / total_papa_need);

  // Zapallito: almuerzo 90g, cena 150g
  const zap_alm = 90; const zap_cena = 150;
  const total_zap_need = 5*zap_alm + 5*zap_cena;
  const scale_zap = Math.min(1, cocido_zap / total_zap_need);

  const tuppers: Tupper[] = [];

  // ── ALMUERZOS (L M X J V) ──
  [0,1,2,3,4].forEach((dia) => {
    const esWod = dia !== 2;
    const p_pollo = Math.round((esWod ? pollo_almuerzo_wod : pollo_almuerzo_desc) * scale_pollo);
    const p_papa  = Math.round((esWod ? papa_alm_wod : papa_alm_desc) * scale_papa);
    const p_zap   = Math.round(zap_alm * scale_zap);
    const m_pollo = macrosCocido("pechuga de pollo", p_pollo);
    const m_papa  = macrosCocido("papa", p_papa);
    const m_zap   = macrosCocido("zapallito", p_zap);
    const totalProt = parseFloat((m_pollo.prot+m_papa.prot+m_zap.prot).toFixed(1));
    const totalKcal = m_pollo.kcal+m_papa.kcal+m_zap.kcal;
    const totalCarb = parseFloat((m_pollo.carb+m_papa.carb+m_zap.carb).toFixed(1));
    const totalGras = parseFloat((m_pollo.gras+m_papa.gras+m_zap.gras).toFixed(1));
    tuppers.push({
      id:`alm_${dia}`,
      label:`ALM-${DIA_LETRA[dia]}`,
      dia:DIA_NOMBRE[dia], tipo:"almuerzo",
      color:TUPPER_COLORS["almuerzo"].bg,
      items:[
        {ingrediente:"Pechuga de pollo",grCocido:p_pollo,...m_pollo},
        {ingrediente:"Papa",            grCocido:p_papa, ...m_papa},
        {ingrediente:"Zapallito",       grCocido:p_zap,  ...m_zap},
      ],
      totalProt, totalKcal, totalCarb, totalGras,
    });
  });

  // ── CENAS (L M X J V) ──
  [0,1,2,3,4].forEach((dia) => {
    const esWod = dia !== 2;
    if(!esWod) {
      // Cena miércoles: huevos
      const n_huevos = Math.min(3, huevos > 15 ? 3 : 2);
      const g_huevo_total = n_huevos * 50;
      const m_h = macrosCocido("huevo", g_huevo_total);
      const p_zap = Math.round(zap_cena * scale_zap);
      const m_z = macrosCocido("zapallito", p_zap);
      tuppers.push({
        id:`cen_${dia}`,
        label:`CEN-${DIA_LETRA[dia]}`,
        dia:DIA_NOMBRE[dia], tipo:"cena",
        color:TUPPER_COLORS["cena"].bg,
        items:[
          {ingrediente:`Huevo duro (${n_huevos} un)`,grCocido:g_huevo_total,...m_h},
          {ingrediente:"Zapallito",grCocido:p_zap,...m_z},
        ],
        totalProt:parseFloat((m_h.prot+m_z.prot).toFixed(1)),
        totalKcal:m_h.kcal+m_z.kcal,
        totalCarb:parseFloat((m_h.carb+m_z.carb).toFixed(1)),
        totalGras:parseFloat((m_h.gras+m_z.gras).toFixed(1)),
      });
    } else {
      const p_pollo = Math.round(pollo_cena_wod * scale_pollo);
      const p_zap   = Math.round(zap_cena * scale_zap);
      const m_pollo = macrosCocido("pechuga de pollo", p_pollo);
      const m_zap   = macrosCocido("zapallito", p_zap);
      tuppers.push({
        id:`cen_${dia}`,
        label:`CEN-${DIA_LETRA[dia]}`,
        dia:DIA_NOMBRE[dia], tipo:"cena",
        color:TUPPER_COLORS["cena"].bg,
        items:[
          {ingrediente:"Pechuga de pollo",grCocido:p_pollo,...m_pollo},
          {ingrediente:"Zapallito",       grCocido:p_zap,  ...m_zap},
        ],
        totalProt:parseFloat((m_pollo.prot+m_zap.prot).toFixed(1)),
        totalKcal:m_pollo.kcal+m_zap.kcal,
        totalCarb:parseFloat((m_pollo.carb+m_zap.carb).toFixed(1)),
        totalGras:parseFloat((m_pollo.gras+m_zap.gras).toFixed(1)),
      });
    }
  });

  // Ordenar: almuerzos primero por día, luego cenas
  const almuerzos = tuppers.filter(t=>t.tipo==="almuerzo").sort((a,b)=>a.id.localeCompare(b.id));
  const cenas     = tuppers.filter(t=>t.tipo==="cena").sort((a,b)=>a.id.localeCompare(b.id));

  return {
    kg_pollo_crudo: kg_pollo,
    kg_papa_crudo:  kg_papa,
    kg_zapallito_crudo: kg_zap,
    huevos,
    tuppers: [...almuerzos, ...cenas],
    timestamp: new Date().toISOString(),
  };
}

// ─── STOCK BASE ───────────────────────────────────────────────────────────────
const STOCK_BASE:Record<string,StockItem>={
  "pechuga de pollo":  {nombre:"Pechuga de pollo",  unidad:"g",   stockActual:0,stockMinimo:500, consumoPorSemana:2575,categoria:"proteina"},
  "huevo":             {nombre:"Huevo",              unidad:"un",  stockActual:0,stockMinimo:6,   consumoPorSemana:15,  categoria:"proteina"},
  "ricota descremada": {nombre:"Ricota descremada",  unidad:"g",   stockActual:0,stockMinimo:200, consumoPorSemana:600, categoria:"lacteo"},
  "avena":             {nombre:"Avena",              unidad:"g",   stockActual:0,stockMinimo:200, consumoPorSemana:500, categoria:"cereal"},
  "leche entera":      {nombre:"Leche entera",       unidad:"ml",  stockActual:0,stockMinimo:500, consumoPorSemana:2000,categoria:"lacteo"},
  "banana":            {nombre:"Banana",             unidad:"un",  stockActual:0,stockMinimo:3,   consumoPorSemana:7,   categoria:"fruta"},
  "manzana":           {nombre:"Manzana",            unidad:"un",  stockActual:0,stockMinimo:2,   consumoPorSemana:4,   categoria:"fruta"},
  "papa":              {nombre:"Papa",               unidad:"g",   stockActual:0,stockMinimo:400, consumoPorSemana:989, categoria:"verdura"},
  "zapallito":         {nombre:"Zapallito",          unidad:"g",   stockActual:0,stockMinimo:300, consumoPorSemana:765, categoria:"verdura"},
  "morrón":            {nombre:"Morrón",             unidad:"g",   stockActual:0,stockMinimo:200, consumoPorSemana:400, categoria:"verdura"},
  "cebolla":           {nombre:"Cebolla",            unidad:"g",   stockActual:0,stockMinimo:200, consumoPorSemana:400, categoria:"verdura"},
  "maní":              {nombre:"Maní",               unidad:"g",   stockActual:0,stockMinimo:100, consumoPorSemana:125, categoria:"seco"},
  "nueces":            {nombre:"Nueces",             unidad:"g",   stockActual:0,stockMinimo:50,  consumoPorSemana:80,  categoria:"seco"},
  "almendras":         {nombre:"Almendras",          unidad:"g",   stockActual:0,stockMinimo:50,  consumoPorSemana:80,  categoria:"seco"},
  "pan integral":      {nombre:"Pan integral",       unidad:"g",   stockActual:0,stockMinimo:150, consumoPorSemana:240, categoria:"cereal"},
  "cacao amargo":      {nombre:"Cacao amargo",       unidad:"g",   stockActual:0,stockMinimo:50,  consumoPorSemana:40,  categoria:"condimento"},
  "miel":              {nombre:"Miel",               unidad:"g",   stockActual:0,stockMinimo:50,  consumoPorSemana:40,  categoria:"condimento"},
  "aceite de oliva":   {nombre:"Aceite de oliva",    unidad:"ml",  stockActual:0,stockMinimo:50,  consumoPorSemana:70,  categoria:"condimento"},
  "café":              {nombre:"Café",               unidad:"tazas",stockActual:0,stockMinimo:5,  consumoPorSemana:14,  categoria:"bebida"},
  "tomate":            {nombre:"Tomate",             unidad:"g",   stockActual:0,stockMinimo:100, consumoPorSemana:250, categoria:"verdura"},
};
const CAT_COLOR:Record<string,{bg:string;txt:string;icon:string}>={
  proteina:{bg:"#FAECE7",txt:"#993C1D",icon:"🍗"},cereal:{bg:"#FAEEDA",txt:"#854F0B",icon:"🌾"},
  lacteo:{bg:"#E6F1FB",txt:"#185FA5",icon:"🥛"},fruta:{bg:"#EAF3DE",txt:"#3B6D11",icon:"🍌"},
  verdura:{bg:"#E1F5EE",txt:"#0F6E56",icon:"🥦"},seco:{bg:"#EEEDFE",txt:"#534AB7",icon:"🥜"},
  condimento:{bg:"#F1EFE8",txt:"#5F5E5A",icon:"🫙"},bebida:{bg:"#FCF4F0",txt:"#854F0B",icon:"☕"},
};

// ─── ALIMENTOS DB (para carga libre de comidas) ───────────────────────────────
const ALIMENTOS_DB:Record<string,Omit<Ingrediente,"nombre">>={
  "pechuga de pollo":{kcal:151,proteina:31.5,carbos:0,grasa:2.1}, // COCIDO
  "avena":{kcal:389,proteina:17,carbos:66,grasa:7},
  "banana":{kcal:89,proteina:1.1,carbos:23,grasa:0.3},
  "papa":{kcal:85,proteina:2.2,carbos:18.9,grasa:0.1}, // COCIDO
  "huevo":{kcal:78,proteina:6.5,carbos:0.6,grasa:5},
  "leche entera":{kcal:61,proteina:3.2,carbos:4.8,grasa:3.3},
  "ricota descremada":{kcal:138,proteina:11,carbos:3,grasa:9},
  "maní":{kcal:567,proteina:26,carbos:16,grasa:49},
  "almendras":{kcal:579,proteina:21,carbos:22,grasa:50},
  "nueces":{kcal:654,proteina:15,carbos:14,grasa:65},
  "zapallito":{kcal:20,proteina:1.4,carbos:3.6,grasa:0.4}, // COCIDO
  "morrón":{kcal:20,proteina:1,carbos:5,grasa:0.3},
  "cebolla":{kcal:40,proteina:1.1,carbos:9.3,grasa:0.1},
  "pan integral":{kcal:247,proteina:13,carbos:41,grasa:3.4},
  "manzana":{kcal:52,proteina:0.3,carbos:14,grasa:0.2},
  "café":{kcal:2,proteina:0.3,carbos:0,grasa:0},
  "aceite de oliva":{kcal:884,proteina:0,carbos:0,grasa:100},
  "tomate":{kcal:18,proteina:0.9,carbos:3.9,grasa:0.2},
  "cacao amargo":{kcal:228,proteina:20,carbos:58,grasa:14},
  "miel":{kcal:304,proteina:0.3,carbos:82,grasa:0},
};
const UNIDADES_HINT:Record<string,string>={
  "huevo":"un","banana":"un","manzana":"un","café":"tazas",
  "leche entera":"ml","aceite de oliva":"ml",
};
const FACTOR:Record<string,number>={"huevo":1,"banana":1,"manzana":1,"café":1,"leche entera":0.01,"aceite de oliva":0.01};

function calcIngrediente(nombre:string,cantidad:number):Ingrediente{
  const key=nombre.toLowerCase().trim(); const base=ALIMENTOS_DB[key];
  if(!base) return{nombre,kcal:0,proteina:0,carbos:0,grasa:0};
  const f=FACTOR[key]!==undefined?FACTOR[key]:0.01;
  return{nombre,kcal:Math.round(base.kcal*cantidad*f),proteina:parseFloat((base.proteina*cantidad*f).toFixed(1)),carbos:parseFloat((base.carbos*cantidad*f).toFixed(1)),grasa:parseFloat((base.grasa*cantidad*f).toFixed(1))};
}

// ─── PLAN SEMANAL ─────────────────────────────────────────────────────────────
const NOMBRE_DIA=["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
const TIPO_DIA=["WOD 🔥","WOD 🔥","Descanso","WOD 🔥","WOD 🔥","Activo","Meal Prep"];
const ES_WOD=[true,true,false,true,true,false,false];
const HORARIOS_DIA=[
  {hora:"5:15",evento:"Despertarse + Desayuno",desc:"Avena overnight + café negro. Listo en 5 min.",tipo:"food"},
  {hora:"6:00",evento:"Entrada al trabajo",desc:"Llevás el almuerzo en tupper y snacks del día.",tipo:"work"},
  {hora:"9:00",evento:"Media mañana",desc:"Snack: Ricota + frutos secos + fruta.",tipo:"food"},
  {hora:"12:00",evento:"Almuerzo pre-entreno",desc:"Tupper del meal prep: pollo + papa + zapallito.",tipo:"food"},
  {hora:"14:45",evento:"Pre-entreno inmediato",desc:"1 banana + café negro. Camino al box.",tipo:"food"},
  {hora:"15:00",evento:"Salida trabajo → Box",desc:"15–20 min para llegar, cambiarse y calentar.",tipo:"train"},
  {hora:"15:30",evento:"CrossFit WOD 🔥",desc:"Calentamiento + Fuerza + WOD + vuelta a la calma.",tipo:"train"},
  {hora:"17:00",evento:"Post-entreno ⚡ CRÍTICO",desc:"Bowl ricota + banana + avena + cacao. Máxima absorción.",tipo:"food"},
  {hora:"20:00",evento:"Cena",desc:"Tupper del meal prep: pollo + zapallito asado.",tipo:"food"},
  {hora:"21:30",evento:"Pre-sueño opcional",desc:"Ricota sola o con cacao. Digestión lenta nocturna.",tipo:"sleep"},
  {hora:"22:00",evento:"A dormir — 7–8 hs",desc:"Levantarse a las 5:15 requiere dormir a las 22hs máximo.",tipo:"sleep"},
];

function makeMealId(){return "m_"+Date.now()+"_"+Math.random().toString(36).slice(2,6);}

function planComidasDia(idx:number):MealEntry[]{
  const wod=ES_WOD[idx];
  const base:Omit<MealEntry,"id">[]=wod?[
    {nombre:"Desayuno — Avena overnight",hora:"5:15",kcal:430,proteina:14,carbos:68,grasa:10,status:"pendiente",ingredientes:[calcIngrediente("avena",80),calcIngrediente("leche entera",200),calcIngrediente("banana",1),calcIngrediente("maní",15)]},
    {nombre:"Media mañana — Ricota + frutos secos",hora:"9:00",kcal:260,proteina:16,carbos:14,grasa:12,status:"pendiente",ingredientes:[calcIngrediente("ricota descremada",150),calcIngrediente("nueces",20),calcIngrediente("manzana",1)]},
    {nombre:"Almuerzo — Tupper pollo + papa + zapallito",hora:"12:00",kcal:540,proteina:56,carbos:44,grasa:7,status:"pendiente",ingredientes:[calcIngrediente("pechuga de pollo",185),calcIngrediente("papa",200),calcIngrediente("zapallito",90)]},
    {nombre:"Pre-entreno — Banana + café",hora:"14:45",kcal:115,proteina:1,carbos:29,grasa:0,status:"pendiente",ingredientes:[calcIngrediente("banana",1),calcIngrediente("café",1)]},
    {nombre:"Post-entreno ⚡ — Bowl recuperador",hora:"17:00",kcal:400,proteina:34,carbos:52,grasa:8,status:"pendiente",ingredientes:[calcIngrediente("ricota descremada",200),calcIngrediente("banana",1),calcIngrediente("avena",30),calcIngrediente("cacao amargo",10),calcIngrediente("miel",10)]},
    {nombre:"Cena — Tupper pollo + zapallito asado",hora:"20:00",kcal:430,proteina:50,carbos:11,grasa:10,status:"pendiente",ingredientes:[calcIngrediente("pechuga de pollo",200),calcIngrediente("zapallito",150)]},
  ]:[
    {nombre:"Desayuno — Avena con banana",hora:"7:00",kcal:400,proteina:13,carbos:66,grasa:8,status:"pendiente",ingredientes:[calcIngrediente("avena",70),calcIngrediente("leche entera",200),calcIngrediente("banana",1)]},
    {nombre:"Media mañana — Ricota + frutos secos",hora:"10:00",kcal:220,proteina:14,carbos:8,grasa:12,status:"pendiente",ingredientes:[calcIngrediente("ricota descremada",150),calcIngrediente("almendras",20)]},
    {nombre:"Almuerzo — Tupper pollo + papa + ensalada",hora:"13:00",kcal:420,proteina:46,carbos:22,grasa:8,status:"pendiente",ingredientes:[calcIngrediente("pechuga de pollo",170),calcIngrediente("papa",120),calcIngrediente("zapallito",90)]},
    {nombre:"Merienda — Licuado leche y banana",hora:"17:00",kcal:280,proteina:12,carbos:40,grasa:7,status:"pendiente",ingredientes:[calcIngrediente("leche entera",250),calcIngrediente("banana",1),calcIngrediente("maní",15)]},
    {nombre:"Cena — Tupper huevo + zapallito",hora:"20:00",kcal:350,proteina:22,carbos:10,grasa:14,status:"pendiente",ingredientes:[calcIngrediente("huevo",3),calcIngrediente("zapallito",150)]},
  ];
  return base.map(m=>({...m,id:makeMealId()}));
}

function planEntrenoDia(idx:number):WorkoutEntry[]{
  const wods:WorkoutEntry[]=[
    {nombre:"Lunes — Fuerza + AMRAP",tipo:"fuerza",status:"pendiente",bloques:[
      {titulo:"Calentamiento",tipo:"recuperacion",duracion:"10 min",ejercicios:[{nombre:"500m remo o bicicleta",detalle:"ritmo bajo"},{nombre:"Movilidad cadera y tobillo",detalle:"2 rondas"}]},
      {titulo:"Fuerza",tipo:"fuerza",duracion:"20 min",ejercicios:[{nombre:"Back squat",detalle:"5×5 @ 75–80% 1RM"},{nombre:"Press militar",detalle:"4×6 @ 70% 1RM"}]},
      {titulo:"WOD — AMRAP 15 min",tipo:"metcon",duracion:"15 min",ejercicios:[{nombre:"15 Wall balls (9kg)",detalle:"por ronda"},{nombre:"12 Box jumps (60cm)",detalle:"por ronda"},{nombre:"9 Burpees",detalle:"por ronda"}]},
    ]},
    {nombre:"Martes — Cardio + Core",tipo:"cardio",status:"pendiente",bloques:[
      {titulo:"WOD — For time",tipo:"cardio",duracion:"~30 min",ejercicios:[{nombre:"1.000m remo",detalle:"arranque"},{nombre:"50 KB swings 24kg",detalle:""},{nombre:"40 Sit-ups",detalle:""},{nombre:"30 Box jumps",detalle:""},{nombre:"20 Pull-ups",detalle:""}]},
      {titulo:"Finisher Tabata",tipo:"cardio",duracion:"10 min",ejercicios:[{nombre:"10 rondas: 20s sprint / 10s desc",detalle:"bici o remo"}]},
    ]},
    {nombre:"Miércoles — Descanso activo",tipo:"descanso",status:"descanso",bloques:[
      {titulo:"Recuperación",tipo:"recuperacion",duracion:"30 min",ejercicios:[{nombre:"Caminata suave o natación",detalle:"20–30 min"},{nombre:"Foam roller + elongación",detalle:"15 min"}]},
    ]},
    {nombre:"Jueves — Halterofilia + Metcon",tipo:"tecnica",status:"pendiente",bloques:[
      {titulo:"Fuerza",tipo:"fuerza",duracion:"20 min",ejercicios:[{nombre:"Deadlift",detalle:"5×4 @ 78% 1RM"},{nombre:"Push press",detalle:"4×8"}]},
      {titulo:"WOD — 5 rondas for time",tipo:"metcon",duracion:"~25 min",ejercicios:[{nombre:"12 Thrusters (42kg)",detalle:"por ronda"},{nombre:"10 Toes to bar",detalle:"por ronda"},{nombre:"200m carrera",detalle:"por ronda"}]},
    ]},
    {nombre:"Viernes — Full body + Resistencia",tipo:"full body",status:"pendiente",bloques:[
      {titulo:"WOD 'Cindy' — AMRAP 20 min",tipo:"full body",duracion:"20 min",ejercicios:[{nombre:"5 Pull-ups",detalle:"por ronda"},{nombre:"10 Push-ups",detalle:"por ronda"},{nombre:"15 Air squats",detalle:"por ronda"}]},
      {titulo:"Finisher core",tipo:"fuerza",duracion:"10 min",ejercicios:[{nombre:"3×1 min plancha",detalle:"30s desc"},{nombre:"3×15 GHD sit-ups",detalle:"con peso"}]},
    ]},
    {nombre:"Sábado — Cardio libre",tipo:"cardio",status:"pendiente",bloques:[
      {titulo:"Cardio",tipo:"cardio",duracion:"40 min",ejercicios:[{nombre:"WOD abierto o carrera",detalle:"40 min"},{nombre:"Movilidad post",detalle:"15 min"}]},
    ]},
    {nombre:"Domingo — Descanso + Meal Prep",tipo:"descanso",status:"descanso",bloques:[
      {titulo:"Meal Prep Dominical",tipo:"recuperacion",duracion:"~75 min",ejercicios:[{nombre:"Cocinar toda la semana",detalle:"pollo, papa, zapallito, huevos"},{nombre:"Armar y etiquetar tuppers",detalle:"10 tuppers (5 almuerzos + 5 cenas)"}]},
    ]},
  ];
  return [wods[idx]];
}

function initDayRecord(nombre:string,idx:number):DayRecord{
  return{fecha:getTodayStr(),timestamp:new Date().toISOString(),responsable:nombre,comidas:planComidasDia(idx),entrenamiento:planEntrenoDia(idx),kpis:{energia:3},completado:false};
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function getTodayIdx(){const d=new Date().getDay();return d===0?6:d-1;}
function getWeekId(){const n=new Date();const y=n.getFullYear();const w=Math.ceil(((n.getTime()-new Date(y,0,1).getTime())/86400000+1)/7);return`${y}_s${w}`;}
function getTodayStr(){const d=new Date();return`${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getFullYear()).slice(2)}`;}
function sumMacros(comidas:MealEntry[]){const c=comidas.filter(x=>x.status==="completo");return{kcal:c.reduce((s,x)=>s+x.kcal,0),proteina:c.reduce((s,x)=>s+x.proteina,0),carbos:c.reduce((s,x)=>s+x.carbos,0),grasa:c.reduce((s,x)=>s+x.grasa,0)};}
function fmtP(n:number){return n>=1000?`$${(n/1000).toFixed(1)}k`:`$${Math.round(n)}`;}

const TARGET={kcal:2350,proteina:195,carbos:230,grasa:65};
const TARGET_DESC={kcal:2000,proteina:195,carbos:160,grasa:65};

function calcSugerencia(comidas:MealEntry[],idx:number):string|null{
  const target=ES_WOD[idx]?TARGET:TARGET_DESC;
  if(!comidas.filter(c=>c.status==="pendiente").length)return null;
  const tot=sumMacros(comidas);
  const fp=target.proteina-tot.proteina,fk=target.kcal-tot.kcal,fc=target.carbos-tot.carbos;
  if(fp<10&&fk<200)return"✅ Macros del día casi completos.";
  const s:string[]=[];
  if(fp>40)s.push(`+${Math.round(fp)}g proteína`);
  if(fk>600)s.push(`~${Math.round(fk)} kcal pendientes`);
  if(fc>80&&ES_WOD[idx])s.push(`cargá carbos para el WOD`);
  return s.length?"💡 Próxima comida: "+s.join(" · "):"✅ Vas bien.";
}

// ─── ESTILOS ─────────────────────────────────────────────────────────────────
const S={
  page:{minHeight:"100vh",background:"#f8f7f4",fontFamily:"system-ui,sans-serif"} as React.CSSProperties,
  wrap:{maxWidth:560,margin:"0 auto",padding:"1rem"} as React.CSSProperties,
  card:{background:"white",border:"0.5px solid #e2e0d8",borderRadius:12,padding:"12px 16px",marginBottom:10} as React.CSSProperties,
  lbl:{fontSize:11,fontWeight:500 as const,color:"#888",textTransform:"uppercase" as const,letterSpacing:"0.06em",marginBottom:10,display:"block" as const},
  btn:(a:boolean,c?:string)=>({padding:"7px 14px",border:"0.5px solid",borderRadius:8,cursor:"pointer" as const,fontSize:13,fontWeight:a?500:400,borderColor:a?"transparent":"#e2e0d8",background:a?(c||"#EAF3DE"):"transparent",color:a?(c?"white":"#3B6D11"):"#777",fontFamily:"system-ui,sans-serif"}),
  input:{width:"100%",padding:"8px 10px",border:"0.5px solid #e2e0d8",borderRadius:8,fontSize:14,outline:"none",boxSizing:"border-box" as const,fontFamily:"system-ui,sans-serif"},
  tip:(c:string)=>({borderLeft:`3px solid ${c}`,background:c+"18",borderRadius:"0 8px 8px 0",padding:"9px 13px",fontSize:13,lineHeight:1.6,color:"#1a1a1a",marginBottom:10}),
};
const BC:Record<string,{bg:string;txt:string}>={
  fuerza:{bg:"#E6F1FB",txt:"#185FA5"},metcon:{bg:"#EAF3DE",txt:"#3B6D11"},cardio:{bg:"#FAEEDA",txt:"#854F0B"},
  descanso:{bg:"#F1EFE8",txt:"#5F5E5A"},tecnica:{bg:"#E6F1FB",txt:"#185FA5"},"full body":{bg:"#EEEDFE",txt:"#534AB7"},recuperacion:{bg:"#E1F5EE",txt:"#0F6E56"},
};

// ─── MODAL AGREGAR COMIDA ─────────────────────────────────────────────────────
function AgregarComidaModal({onAdd,onClose}:{onAdd:(m:MealEntry)=>void;onClose:()=>void}){
  const[nombre,setNombre]=useState("");const[hora,setHora]=useState("");
  const[query,setQuery]=useState("");const[cantidad,setCantidad]=useState("");
  const[ingredientes,setIngredientes]=useState<Ingrediente[]>([]);const[sugs,setSugs]=useState<string[]>([]);
  const buscar=(q:string)=>{setQuery(q);if(q.length<2){setSugs([]);return;}setSugs(Object.keys(ALIMENTOS_DB).filter(k=>k.includes(q.toLowerCase())).slice(0,6));};
  const agregar=(n:string,c:string)=>{const v=parseFloat(c);if(isNaN(v)||v<=0)return;setIngredientes(p=>[...p,calcIngrediente(n,v)]);setQuery("");setCantidad("");setSugs([]);};
  const tot=ingredientes.reduce((s,i)=>({kcal:s.kcal+i.kcal,proteina:s.proteina+i.proteina,carbos:s.carbos+i.carbos,grasa:s.grasa+i.grasa}),{kcal:0,proteina:0,carbos:0,grasa:0});
  const ok=nombre.trim();
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:"white",borderRadius:"16px 16px 0 0",width:"100%",maxWidth:560,maxHeight:"90vh",overflowY:"auto",padding:"1.5rem 1rem 2rem"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.25rem"}}>
          <h3 style={{fontSize:17,fontWeight:500,margin:0}}>Agregar comida</h3>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"#888"}}>×</button>
        </div>
        <span style={S.lbl}>Nombre</span>
        <input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="ej: Desayuno…" style={{...S.input,marginBottom:12}}/>
        <span style={S.lbl}>Hora</span>
        <input value={hora} onChange={e=>setHora(e.target.value)} placeholder="ej: 8:00" style={{...S.input,marginBottom:16}}/>
        <span style={S.lbl}>Ingredientes</span>
        <div style={{position:"relative",marginBottom:6}}>
          <input value={query} onChange={e=>buscar(e.target.value)} placeholder="Buscar ingrediente…" style={S.input}/>
          {sugs.length>0&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:"white",border:"0.5px solid #e2e0d8",borderRadius:8,zIndex:10,boxShadow:"0 4px 12px rgba(0,0,0,0.1)"}}>
            {sugs.map(s=><div key={s} onClick={()=>{setQuery(s);setSugs([]);}} style={{padding:"9px 12px",cursor:"pointer",fontSize:13,borderBottom:"0.5px solid #f0ede4"}}>{s} <span style={{color:"#aaa",fontSize:11}}>· {ALIMENTOS_DB[s].kcal} kcal/100g</span></div>)}
          </div>}
        </div>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <input value={cantidad} onChange={e=>setCantidad(e.target.value)} placeholder={`g / ${UNIDADES_HINT[query.toLowerCase()]||"g"}`} type="number" style={{...S.input,flex:1}}/>
          <button onClick={()=>agregar(query,cantidad)} style={{padding:"8px 14px",background:"#639922",color:"white",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:500,whiteSpace:"nowrap" as const}}>+ Agregar</button>
        </div>
        {ingredientes.length>0&&<div style={{...S.card,marginBottom:12}}>
          {ingredientes.map((ing,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"0.5px solid #f0ede4",fontSize:13}}>
            <span>{ing.nombre}</span>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{color:"#888",fontSize:12}}>{ing.kcal}kcal · {ing.proteina}g</span>
              <button onClick={()=>setIngredientes(p=>p.filter((_,j)=>j!==i))} style={{background:"none",border:"none",cursor:"pointer",color:"#D85A30",fontSize:16,padding:0}}>×</button>
            </div>
          </div>)}
          <div style={{marginTop:8,paddingTop:6,borderTop:"0.5px solid #e2e0d8",fontSize:13,fontWeight:500,display:"flex",gap:12,flexWrap:"wrap" as const}}>
            <span>🔥 {tot.kcal} kcal</span><span>🥩 {tot.proteina}g prot</span><span>🌾 {tot.carbos}g</span><span>🫒 {tot.grasa}g</span>
          </div>
        </div>}
        <button onClick={()=>{if(!ok)return;const m:MealEntry={id:makeMealId(),nombre,hora:hora||"—",...tot,status:"completo",ingredientes,esPersonalizada:true};onAdd(m);onClose();}}
          style={{width:"100%",padding:"13px",background:ok?"#639922":"#ccc",color:"white",border:"none",borderRadius:12,fontSize:15,fontWeight:500,cursor:ok?"pointer":"not-allowed"}}>
          Registrar como completada ✓
        </button>
      </div>
    </div>
  );
}

// ─── COMPONENTE TUPPER CARD ───────────────────────────────────────────────────
function TupperCard({t,expanded,onToggle}:{t:Tupper;expanded:boolean;onToggle:()=>void}){
  const tc=TUPPER_COLORS[t.tipo];
  const totalG=t.items.reduce((s,i)=>s+i.grCocido,0);
  return(
    <div style={{border:`1.5px solid ${tc.border}`,borderRadius:12,marginBottom:8,overflow:"hidden",background:"white"}}>
      <div onClick={onToggle} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",cursor:"pointer",background:expanded?tc.bg:"white"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:8,background:tc.bg,border:`1.5px solid ${tc.border}`,display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:9,fontWeight:700,color:tc.badge,letterSpacing:"0.02em",lineHeight:1}}>{t.label.split("-")[0]}</span>
            <span style={{fontSize:11,fontWeight:700,color:tc.txt}}>{t.label.split("-")[1]}</span>
          </div>
          <div>
            <div style={{fontSize:14,fontWeight:500,color:"#1a1a1a"}}>{t.dia}</div>
            <div style={{fontSize:11,color:"#888"}}>{t.tipo.charAt(0).toUpperCase()+t.tipo.slice(1)} · {totalG}g total</div>
          </div>
        </div>
        <div style={{textAlign:"right" as const}}>
          <div style={{display:"flex",gap:10,alignItems:"center",justifyContent:"flex-end"}}>
            <span style={{fontSize:13,fontWeight:500,color:tc.badge}}>{t.totalProt}g prot</span>
            <span style={{fontSize:12,color:"#888"}}>{t.totalKcal} kcal</span>
            <span style={{fontSize:13,color:"#aaa"}}>{expanded?"▲":"▼"}</span>
          </div>
        </div>
      </div>
      {expanded&&(
        <div style={{padding:"10px 14px",borderTop:`0.5px solid ${tc.border}`}}>
          {t.items.map((item,i)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"1fr auto auto auto auto",gap:8,alignItems:"center",padding:"7px 0",borderBottom:i<t.items.length-1?"0.5px solid #f0ede4":"none",fontSize:13}}>
              <span style={{fontWeight:500,color:"#1a1a1a"}}>{item.ingrediente}</span>
              <span style={{color:"#555",textAlign:"right" as const,fontWeight:500}}>{item.grCocido}g</span>
              <span style={{color:"#185FA5",fontSize:12,textAlign:"right" as const}}>{item.prot}g</span>
              <span style={{color:"#EF9F27",fontSize:12,textAlign:"right" as const}}>{item.kcal}kcal</span>
              <span style={{color:"#1D9E75",fontSize:12,textAlign:"right" as const}}>{item.carb}g</span>
            </div>
          ))}
          <div style={{marginTop:8,paddingTop:8,borderTop:"0.5px solid #e2e0d8",display:"flex",gap:12,fontSize:12,flexWrap:"wrap" as const}}>
            <span style={{color:"#185FA5",fontWeight:500}}>Prot total: {t.totalProt}g</span>
            <span style={{color:"#EF9F27",fontWeight:500}}>Kcal: {t.totalKcal}</span>
            <span style={{color:"#1D9E75",fontWeight:500}}>Carbos: {t.totalCarb}g</span>
            <span style={{color:"#854F0B",fontWeight:500}}>Grasas: {t.totalGras}g</span>
          </div>
          <div style={{marginTop:8,padding:"6px 10px",background:tc.bg,borderRadius:6,fontSize:11,color:tc.txt,fontWeight:500}}>
            Etiqueta: <strong>{t.label}</strong> · Usar el {t.dia} · Dura hasta el {t.tipo==="almuerzo"?"viernes si se preparó el domingo":"viernes"}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────
export default function FitnessTracker(){
  const[screen,setScreen]=useState<"login"|"app">("login");
  const[usuario,setUsuario]=useState("");const[usuarioInput,setUsuarioInput]=useState("");
  const[guardados,setGuardados]=useState<string[]>([]);
  const[dayRecord,setDayRecord]=useState<DayRecord|null>(null);
  const[saveMsg,setSaveMsg]=useState("");
  const[activeTab,setActiveTab]=useState<Tab>("horarios");
  const[showAddMeal,setShowAddMeal]=useState(false);
  const[expandedWod,setExpandedWod]=useState<number|null>(null);
  const[expandedTupper,setExpandedTupper]=useState<string|null>(null);
  const[mpFilter,setMpFilter]=useState<"todos"|"almuerzo"|"cena">("todos");
  // Meal prep
  const[mealPrep,setMealPrep]=useState<MealPrepPlan|null>(null);
  const[mpPollo,setMpPollo]=useState("2.6");
  const[mpPapa,setMpPapa]=useState("0.9");
  const[mpZap,setMpZap]=useState("0.8");
  const[mpHuevos,setMpHuevos]=useState("10");
  // Inventario
  const[inventario,setInventario]=useState<InventarioRecord>({items:{},ultimaActualizacion:""});
  // Compras
  const[compras,setCompras]=useState<ComprasRecord>({historial:[],precios:{},presupuestoMensual:58000});
  const[showCompraModal,setShowCompraModal]=useState(false);
  const[cItem,setCItem]=useState("");const[cCant,setCCant]=useState("");const[cPrecio,setCPrecio]=useState("");
  const[cQuery,setCQuery]=useState("");const[cSugs,setCSugs]=useState<string[]>([]);

  const todayIdx=getTodayIdx();
  const weekId=getWeekId();
  const dayPath=`semanas/${weekId}/dias/dia_${todayIdx}`;
  const invPath=`inventario/stock`;
  const comprasPath=`compras/registro`;
  const mpPath=`mealprep/semana_${weekId}`;

  useEffect(()=>{const r=localStorage.getItem("fitness_usuarios");if(r)setGuardados(JSON.parse(r));},[]);

  const saveData=useCallback(async(path:string,data:object)=>{
    try{const db=getFirestore(getFirebaseApp());await setDoc(doc(db,path),data);setSaveMsg("✓");setTimeout(()=>setSaveMsg(""),1500);}
    catch{setSaveMsg("Sin conexión");}
  },[]);

  const loadDay=useCallback(async(nombre:string)=>{
    try{const db=getFirestore(getFirebaseApp());const s=await getDoc(doc(db,dayPath));setDayRecord(s.exists()?s.data() as DayRecord:initDayRecord(nombre,todayIdx));}
    catch{setDayRecord(initDayRecord(nombre,todayIdx));}
  },[dayPath,todayIdx]);

  const loadAll=useCallback(async(nombre:string)=>{
    const db=getFirestore(getFirebaseApp());
    try{const s=await getDoc(doc(db,dayPath));setDayRecord(s.exists()?s.data() as DayRecord:initDayRecord(nombre,todayIdx));}catch{setDayRecord(initDayRecord(nombre,todayIdx));}
    try{const s=await getDoc(doc(db,invPath));if(s.exists())setInventario(s.data() as InventarioRecord);else{const init={items:JSON.parse(JSON.stringify(STOCK_BASE)),ultimaActualizacion:getTodayStr()};setInventario(init);await setDoc(doc(db,invPath),init);}}catch{}
    try{const s=await getDoc(doc(db,comprasPath));if(s.exists())setCompras(s.data() as ComprasRecord);}catch{}
    try{const s=await getDoc(doc(db,mpPath));if(s.exists())setMealPrep(s.data() as MealPrepPlan);}catch{}
  },[dayPath,invPath,comprasPath,mpPath,todayIdx]);

  const handleLogin=async(nombre:string)=>{
    if(!nombre.trim())return;const n=nombre.trim();setUsuario(n);
    const upd=[n,...guardados.filter(u=>u!==n)].slice(0,5);
    setGuardados(upd);localStorage.setItem("fitness_usuarios",JSON.stringify(upd));
    await loadAll(n);setScreen("app");
  };

  const updateAndSave=useCallback((updated:DayRecord)=>{setDayRecord(updated);saveData(dayPath,updated);},[dayPath,saveData]);

  const generarYGuardar=()=>{
    const plan=generarMealPrep(parseFloat(mpPollo)||2.6,parseFloat(mpPapa)||0.9,parseFloat(mpZap)||0.8,parseInt(mpHuevos)||10);
    setMealPrep(plan);saveData(mpPath,plan);
  };

  const updateComida=(id:string,status:MealStatus)=>{
    if(!dayRecord)return;
    const updated={...dayRecord,comidas:dayRecord.comidas.map(c=>c.id===id?{...c,status}:c)};
    updateAndSave(updated);
  };
  const updateEntreno=(i:number,status:WorkoutStatus)=>{
    if(!dayRecord)return;
    updateAndSave({...dayRecord,entrenamiento:dayRecord.entrenamiento.map((e,j)=>j===i?{...e,status}:e)});
  };
  const updateKPI=(key:keyof DayKPIs,val:number)=>{if(!dayRecord)return;updateAndSave({...dayRecord,kpis:{...dayRecord.kpis,[key]:val}});};
  const addMeal=(meal:MealEntry)=>{if(!dayRecord)return;updateAndSave({...dayRecord,comidas:[...dayRecord.comidas,meal]});};
  const removeMeal=(id:string)=>{if(!dayRecord)return;updateAndSave({...dayRecord,comidas:dayRecord.comidas.filter(c=>c.id!==id)});};
  const ajustarStock=(key:string,val:number)=>{
    const newInv={...inventario,items:{...inventario.items,[key]:{...inventario.items[key],stockActual:Math.max(0,val)}},ultimaActualizacion:getTodayStr()};
    setInventario(newInv);saveData(invPath,newInv);
  };
  const buscarCompra=(q:string)=>{setCQuery(q);setCItem(q);if(q.length<2){setCSugs([]);return;}setCSugs([...Object.keys(STOCK_BASE).filter(k=>k.includes(q.toLowerCase()))].slice(0,6));};
  const registrarCompra=()=>{
    if(!cItem.trim()||!cCant||!cPrecio)return;
    const key=cItem.toLowerCase().trim();const cant=parseFloat(cCant);const precio=parseFloat(cPrecio);
    const prev=compras.precios[key];
    const newPrecios={...compras.precios,[key]:{ultimo:precio,promedio:prev?Math.round((prev.promedio*prev.veces+precio)/(prev.veces+1)):precio,veces:(prev?.veces||0)+1}};
    const newHistorial=[{nombre:cItem,cantidad:cant,unidad:UNIDADES_HINT[key]||"g",precio,fecha:getTodayStr()},...compras.historial].slice(0,100);
    const nc={...compras,historial:newHistorial,precios:newPrecios};setCompras(nc);saveData(comprasPath,nc);
    if(inventario.items[key]){const ni={...inventario,items:{...inventario.items,[key]:{...inventario.items[key],stockActual:Math.round((inventario.items[key].stockActual+cant)*10)/10}},ultimaActualizacion:getTodayStr()};setInventario(ni);saveData(invPath,ni);}
    setCItem("");setCCant("");setCPrecio("");setCQuery("");setShowCompraModal(false);
  };

  // ── LOGIN ────────────────────────────────────────────────────────────────────
  if(screen==="login")return(
    <div style={{...S.page,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
      <div style={{background:"white",borderRadius:16,border:"0.5px solid #e2e0d8",padding:"2rem",width:"100%",maxWidth:400}}>
        <div style={{marginBottom:"1.5rem"}}>
          <div style={{width:48,height:48,borderRadius:12,background:"#EAF3DE",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:12,fontSize:24}}>💪</div>
          <h1 style={{fontSize:20,fontWeight:500,margin:0}}>Fitness Tracker</h1>
          <p style={{fontSize:13,color:"#888",marginTop:4}}>CrossFit · Dieta · Meal Prep · Inventario</p>
        </div>
        {guardados.length>0&&<><span style={S.lbl}>Acceso rápido</span>
          {guardados.map(u=><button key={u} onClick={()=>handleLogin(u)} style={{width:"100%",padding:"10px 14px",border:"0.5px solid #e2e0d8",borderRadius:10,background:"transparent",cursor:"pointer",textAlign:"left" as const,fontSize:14,color:"#1a1a1a",display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
            <span style={{width:30,height:30,borderRadius:"50%",background:"#EAF3DE",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:500,color:"#3B6D11"}}>{u[0].toUpperCase()}</span>{u}
          </button>)}
          <div style={{height:1,background:"#f0ede4",margin:"14px 0"}}/>
        </>}
        <span style={S.lbl}>Nombre</span>
        <input value={usuarioInput} onChange={e=>setUsuarioInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleLogin(usuarioInput)} placeholder="Tu nombre…" style={{...S.input,marginBottom:10}}/>
        <button onClick={()=>handleLogin(usuarioInput)} style={{width:"100%",padding:11,background:"#639922",color:"white",border:"none",borderRadius:10,fontSize:14,fontWeight:500,cursor:"pointer"}}>Entrar</button>
      </div>
    </div>
  );

  if(!dayRecord)return<div style={{...S.page,display:"flex",alignItems:"center",justifyContent:"center"}}><p style={{color:"#888"}}>Cargando…</p></div>;

  const totales=sumMacros(dayRecord.comidas);
  const target=ES_WOD[todayIdx]?TARGET:TARGET_DESC;
  const sugerencia=calcSugerencia(dayRecord.comidas,todayIdx);
  const itemsBajos=Object.entries(inventario.items).filter(([,v])=>v.stockActual<=v.stockMinimo);
  const gastadoMes=compras.historial.filter(c=>{const[d,m,y]=c.fecha.split("/");const f=new Date(2000+parseInt(y),parseInt(m)-1,parseInt(d));const n=new Date();return f.getMonth()===n.getMonth()&&f.getFullYear()===n.getFullYear();}).reduce((s,c)=>s+c.precio,0);

  // Tupper del día actual (si existe el meal prep)
  const tupperAlmHoy = mealPrep?.tuppers.find(t=>t.tipo==="almuerzo"&&t.dia===NOMBRE_DIA[todayIdx]);
  const tupperCenaHoy = mealPrep?.tuppers.find(t=>t.tipo==="cena"&&t.dia===NOMBRE_DIA[todayIdx]);

  const TABS:{id:Tab;label:string;icon:string;alert?:number}[]=[
    {id:"horarios",label:"Horarios",icon:"🕐"},
    {id:"dieta",label:"Dieta",icon:"🥗"},
    {id:"entreno",label:"WOD",icon:"🔥"},
    {id:"mealprep",label:"Meal Prep",icon:"🍱",alert:mealPrep?0:1},
    {id:"inventario",label:"Stock",icon:"📦",alert:itemsBajos.length||0},
    {id:"compras",label:"Compras",icon:"🛒"},
    {id:"kpis",label:"KPIs",icon:"📊"},
  ];

  // Modal compra
  const ModalCompra=showCompraModal?(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:"white",borderRadius:"16px 16px 0 0",width:"100%",maxWidth:560,padding:"1.5rem 1rem 2rem"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.25rem"}}>
          <h3 style={{fontSize:17,fontWeight:500,margin:0}}>Registrar compra</h3>
          <button onClick={()=>setShowCompraModal(false)} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"#888"}}>×</button>
        </div>
        <span style={S.lbl}>Producto</span>
        <div style={{position:"relative",marginBottom:12}}>
          <input value={cQuery} onChange={e=>buscarCompra(e.target.value)} placeholder="ej: pechuga de pollo…" style={S.input}/>
          {cSugs.length>0&&<div style={{position:"absolute",top:"100%",left:0,right:0,background:"white",border:"0.5px solid #e2e0d8",borderRadius:8,zIndex:10,boxShadow:"0 4px 12px rgba(0,0,0,0.1)"}}>
            {cSugs.map(s=>{const p=compras.precios[s];const st=inventario.items[s];return<div key={s} onClick={()=>{setCItem(s);setCQuery(s);setCSugs([]);if(p)setCPrecio(String(p.ultimo));}} style={{padding:"9px 12px",cursor:"pointer",fontSize:13,borderBottom:"0.5px solid #f0ede4"}}>
              <div style={{fontWeight:500}}>{s}</div>
              <div style={{fontSize:11,color:"#888",marginTop:1}}>{p?`Último: $${p.ultimo} · Prom: $${p.promedio.toFixed(0)}`:"Sin historial"}{st?` · Stock: ${st.stockActual}${st.unidad}`:""}{st&&st.stockActual<=st.stockMinimo?" ⚠️ BAJO":""}</div>
            </div>;})}
          </div>}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          <div><span style={S.lbl}>Cantidad</span><input value={cCant} onChange={e=>setCCant(e.target.value)} type="number" placeholder={inventario.items[cItem.toLowerCase()]?`consumo/sem: ${inventario.items[cItem.toLowerCase()].consumoPorSemana}`:"cantidad"} style={S.input}/></div>
          <div><span style={S.lbl}>Precio total $</span><input value={cPrecio} onChange={e=>setCPrecio(e.target.value)} type="number" placeholder="ej: 3500" style={S.input}/></div>
        </div>
        {cItem&&inventario.items[cItem.toLowerCase()]&&(
          <div style={{background:"#f8f7f4",borderRadius:8,padding:"9px 12px",marginBottom:12,fontSize:12,color:"#555",lineHeight:1.7}}>
            <b>Stock actual:</b> {inventario.items[cItem.toLowerCase()].stockActual} {inventario.items[cItem.toLowerCase()].unidad} ·{" "}
            <b>Mínimo:</b> {inventario.items[cItem.toLowerCase()].stockMinimo} {inventario.items[cItem.toLowerCase()].unidad} ·{" "}
            <b>Consumo/semana:</b> {inventario.items[cItem.toLowerCase()].consumoPorSemana} {inventario.items[cItem.toLowerCase()].unidad}
            {compras.precios[cItem.toLowerCase()]&&<><br/><b>Precio promedio histórico:</b> ${compras.precios[cItem.toLowerCase()].promedio.toFixed(0)} ({compras.precios[cItem.toLowerCase()].veces} compras)</>}
          </div>
        )}
        <button onClick={registrarCompra} disabled={!cItem||!cCant||!cPrecio} style={{width:"100%",padding:"13px",background:(cItem&&cCant&&cPrecio)?"#639922":"#ccc",color:"white",border:"none",borderRadius:12,fontSize:15,fontWeight:500,cursor:(cItem&&cCant&&cPrecio)?"pointer":"not-allowed"}}>
          Registrar y actualizar stock ✓
        </button>
      </div>
    </div>
  ):null;

  return(
    <div style={S.page}>
      {showAddMeal&&<AgregarComidaModal onAdd={addMeal} onClose={()=>setShowAddMeal(false)}/>}
      {ModalCompra}

      {/* HEADER */}
      <div style={{background:"white",borderBottom:"0.5px solid #e2e0d8",padding:"12px 1rem"}}>
        <div style={{maxWidth:560,margin:"0 auto",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <span style={{fontSize:16,fontWeight:500}}>Hola, {usuario.split(" ")[0]} 👋</span>
            <p style={{fontSize:12,color:"#888",margin:"2px 0 0"}}>{NOMBRE_DIA[todayIdx]} · {TIPO_DIA[todayIdx]} · {getTodayStr()}</p>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {saveMsg&&<span style={{fontSize:12,color:"#639922"}}>{saveMsg}</span>}
            {itemsBajos.length>0&&<span style={{fontSize:11,padding:"3px 8px",borderRadius:6,background:"#FAECE7",color:"#993C1D",fontWeight:500}}>⚠ {itemsBajos.length}</span>}
            <button onClick={()=>setScreen("login")} style={{padding:"5px 10px",border:"0.5px solid #e2e0d8",borderRadius:7,background:"transparent",cursor:"pointer",fontSize:12,color:"#888"}}>← Salir</button>
          </div>
        </div>
      </div>

      {/* MACROS */}
      <div style={{background:"white",borderBottom:"0.5px solid #f0ede4",padding:"10px 1rem"}}>
        <div style={{maxWidth:560,margin:"0 auto"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:8}}>
            {[
              {lbl:"Kcal",val:totales.kcal,meta:target.kcal,pct:Math.min(100,Math.round((totales.kcal/target.kcal)*100)),col:totales.kcal/target.kcal>=0.9?"#639922":"#EF9F27"},
              {lbl:"Proteína",val:`${totales.proteina}g`,meta:`${target.proteina}g`,pct:Math.min(100,Math.round((totales.proteina/target.proteina)*100)),col:totales.proteina/target.proteina>=0.9?"#185FA5":"#D85A30"},
              {lbl:"Carbos",val:`${totales.carbos}g`,meta:`${target.carbos}g`,pct:Math.min(100,Math.round((totales.carbos/target.carbos)*100)),col:"#1D9E75"},
              {lbl:"Grasas",val:`${totales.grasa}g`,meta:`${target.grasa}g`,pct:Math.min(100,Math.round((totales.grasa/target.grasa)*100)),col:"#BA7517"},
            ].map(m=>(
              <div key={m.lbl} style={{textAlign:"center" as const}}>
                <div style={{fontSize:11,color:"#888",marginBottom:2}}>{m.lbl}</div>
                <div style={{fontSize:15,fontWeight:500}}>{m.val}</div>
                <div style={{fontSize:10,color:"#bbb"}}>/{m.meta}</div>
                <div style={{height:3,background:"#f0ede4",borderRadius:2,marginTop:4}}>
                  <div style={{height:3,background:m.col,borderRadius:2,width:`${m.pct}%`,transition:"width .3s"}}/>
                </div>
              </div>
            ))}
          </div>
          {/* Tupper del día */}
          {(tupperAlmHoy||tupperCenaHoy)&&(
            <div style={{display:"flex",gap:6,marginBottom:6,flexWrap:"wrap" as const}}>
              {tupperAlmHoy&&<span style={{fontSize:11,padding:"3px 9px",borderRadius:6,background:"#EAF3DE",color:"#27500A",fontWeight:500}}>🍱 {tupperAlmHoy.label} — {tupperAlmHoy.totalProt}g prot · {tupperAlmHoy.totalKcal}kcal</span>}
              {tupperCenaHoy&&<span style={{fontSize:11,padding:"3px 9px",borderRadius:6,background:"#E6F1FB",color:"#0C447C",fontWeight:500}}>🌙 {tupperCenaHoy.label} — {tupperCenaHoy.totalProt}g prot · {tupperCenaHoy.totalKcal}kcal</span>}
            </div>
          )}
          {sugerencia&&<div style={{fontSize:12,padding:"7px 10px",background:sugerencia.startsWith("✅")?"#EAF3DE":"#FFF8EC",borderRadius:8,color:sugerencia.startsWith("✅")?"#3B6D11":"#854F0B",lineHeight:1.5}}>{sugerencia}</div>}
        </div>
      </div>

      {/* TABS */}
      <div style={{background:"white",borderBottom:"0.5px solid #e2e0d8",overflowX:"auto" as const}}>
        <div style={{maxWidth:560,margin:"0 auto",display:"flex",padding:"0 0.25rem"}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{padding:"10px 9px",background:"transparent",border:"none",cursor:"pointer",fontSize:11,position:"relative" as const,fontWeight:activeTab===t.id?500:400,color:activeTab===t.id?"#639922":"#777",borderBottom:activeTab===t.id?"2px solid #639922":"2px solid transparent",whiteSpace:"nowrap" as const,fontFamily:"system-ui,sans-serif"}}>
              {t.icon} {t.label}
              {t.alert&&t.alert>0?<span style={{position:"absolute" as const,top:5,right:2,width:14,height:14,borderRadius:"50%",background:"#D85A30",color:"white",fontSize:9,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:500}}>{t.alert}</span>:null}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENIDO */}
      <div style={{...S.wrap,paddingTop:"1.25rem"}}>

        {/* HORARIOS */}
        {activeTab==="horarios"&&(
          <div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:"1.25rem"}}>
              {NOMBRE_DIA.map((d,i)=>(
                <div key={i} style={{borderRadius:8,padding:"7px 4px",textAlign:"center" as const,border:"0.5px solid",borderColor:i===todayIdx?"transparent":ES_WOD[i]?"#F0997B":"#B4B2A9",background:i===todayIdx?"#639922":ES_WOD[i]?"#FAECE7":i===5?"#E1F5EE":"#F1EFE8"}}>
                  <div style={{fontSize:10,color:i===todayIdx?"rgba(255,255,255,0.8)":"#888",marginBottom:2}}>{d.slice(0,3)}</div>
                  <div style={{fontSize:10,fontWeight:500,color:i===todayIdx?"white":ES_WOD[i]?"#993C1D":i===5?"#0F6E56":"#5F5E5A"}}>{ES_WOD[i]?"WOD":i===5?"Act":"Desc"}</div>
                </div>
              ))}
            </div>
            <div style={S.card}>
              {HORARIOS_DIA.map((h,i)=>{
                const dotCol=h.tipo==="food"?"#1D9E75":h.tipo==="work"?"#378ADD":h.tipo==="train"?"#D85A30":"#534AB7";
                return<div key={i} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:i<HORARIOS_DIA.length-1?"0.5px solid #f0ede4":"none",alignItems:"flex-start"}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:dotCol,marginTop:6,flexShrink:0}}/>
                  <div style={{width:48,flexShrink:0}}><span style={{fontSize:12,fontWeight:500,color:"#555"}}>{h.hora}</span></div>
                  <div style={{flex:1}}><div style={{fontSize:14,fontWeight:500}}>{h.evento}</div><div style={{fontSize:12,color:"#888",lineHeight:1.5,marginTop:2}}>{h.desc}</div></div>
                </div>;
              })}
            </div>
          </div>
        )}

        {/* DIETA */}
        {activeTab==="dieta"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
              <span style={{...S.lbl,marginBottom:0}}>Comidas · {NOMBRE_DIA[todayIdx]}</span>
              <button onClick={()=>setShowAddMeal(true)} style={{padding:"7px 14px",background:"#639922",color:"white",border:"none",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:500}}>+ Agregar</button>
            </div>
            {dayRecord.comidas.map(c=>(
              <div key={c.id} style={{...S.card,borderColor:c.status==="completo"?"#9FE1CB":c.status==="salteado"?"#F5C4B3":"#e2e0d8",borderLeftWidth:3,borderLeftColor:c.status==="completo"?"#1D9E75":c.status==="salteado"?"#D85A30":"#e2e0d8"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" as const}}>
                      <span style={{fontSize:14,fontWeight:500}}>{c.nombre}</span>
                      {c.esPersonalizada&&<span style={{fontSize:10,padding:"2px 6px",borderRadius:4,background:"#EAF3DE",color:"#3B6D11"}}>tuya</span>}
                    </div>
                    <div style={{fontSize:12,color:"#888",marginTop:2}}>{c.hora} · {c.kcal} kcal · {c.proteina}g prot · {c.carbos}g C · {c.grasa}g G</div>
                  </div>
                  {c.esPersonalizada&&<button onClick={()=>removeMeal(c.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#D85A30",fontSize:18,padding:"0 0 0 8px"}}>×</button>}
                </div>
                {c.ingredientes.length>0&&<div style={{background:"#f8f7f4",borderRadius:8,padding:"6px 10px",marginBottom:8,fontSize:12,color:"#666",display:"flex",flexWrap:"wrap" as const,gap:5}}>
                  {c.ingredientes.map((ing,j)=><span key={j} style={{padding:"2px 6px",borderRadius:4,background:"#f0ede4"}}>{ing.nombre}</span>)}
                </div>}
                <div style={{display:"flex",gap:6,flexWrap:"wrap" as const}}>
                  {(["completo","salteado","pendiente"] as MealStatus[]).map(s=>(
                    <button key={s} onClick={()=>updateComida(c.id,s)} style={S.btn(c.status===s,s==="completo"?"#639922":s==="salteado"?"#D85A30":undefined)}>
                      {s==="completo"?"✓ Listo":s==="salteado"?"Salteado":"Pendiente"}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div style={{...S.card,background:"#f8f7f4",marginTop:6}}>
              <span style={S.lbl}>Balance del día</span>
              {[{lbl:"Calorías",val:totales.kcal,meta:target.kcal,unit:"kcal",col:"#EF9F27"},{lbl:"Proteína",val:totales.proteina,meta:target.proteina,unit:"g",col:"#185FA5"},{lbl:"Carbos",val:totales.carbos,meta:target.carbos,unit:"g",col:"#1D9E75"},{lbl:"Grasas",val:totales.grasa,meta:target.grasa,unit:"g",col:"#BA7517"}].map(m=>(
                <div key={m.lbl} style={{marginBottom:9}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:3}}><span>{m.lbl}</span><span style={{fontWeight:500}}>{m.val}{m.unit} <span style={{fontWeight:400,color:"#888"}}>/ {m.meta}{m.unit}</span></span></div>
                  <div style={{height:5,background:"#e2e0d8",borderRadius:3}}><div style={{height:5,borderRadius:3,background:m.col,width:`${Math.min(100,(m.val/m.meta)*100)}%`,transition:"width .3s"}}/></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ENTRENO */}
        {activeTab==="entreno"&&(
          <div>
            {dayRecord.entrenamiento.map((e,i)=>{
              const bc=BC[e.tipo]||BC.descanso;
              return<div key={i} style={S.card}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div><div style={{fontSize:15,fontWeight:500,marginBottom:4}}>{e.nombre}</div><span style={{fontSize:11,padding:"3px 8px",borderRadius:5,background:bc.bg,color:bc.txt,fontWeight:500}}>{e.tipo}</span></div>
                  <span style={{fontSize:13,padding:"4px 10px",borderRadius:8,background:e.status==="completo"?"#EAF3DE":e.status==="descanso"?"#F1EFE8":"#f8f7f4",color:e.status==="completo"?"#3B6D11":e.status==="descanso"?"#5F5E5A":"#888"}}>{e.status==="completo"?"✓ Hecho":e.status==="descanso"?"Descanso":"Pendiente"}</span>
                </div>
                {e.bloques.map((b,bi)=>{const bbc=BC[b.tipo]||BC.recuperacion;const isOpen=expandedWod===bi*100+i;
                  return<div key={bi} style={{border:"0.5px solid #f0ede4",borderRadius:10,marginBottom:6,overflow:"hidden"}}>
                    <div onClick={()=>setExpandedWod(isOpen?null:bi*100+i)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 12px",cursor:"pointer",background:isOpen?"#f8f7f4":"transparent"}}>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}><span style={{fontSize:13,fontWeight:500}}>{b.titulo}</span><span style={{fontSize:10,padding:"2px 7px",borderRadius:4,background:bbc.bg,color:bbc.txt}}>{b.duracion}</span></div>
                      <span style={{fontSize:12,color:"#aaa"}}>{isOpen?"▲":"▼"}</span>
                    </div>
                    {isOpen&&<div style={{padding:"0 12px 10px"}}>
                      {b.ejercicios.map((ej,j)=><div key={j} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"0.5px solid #f0ede4",fontSize:13}}><span>{ej.nombre}</span><span style={{color:"#888"}}>{ej.detalle}</span></div>)}
                    </div>}
                  </div>;
                })}
                {e.tipo!=="descanso"&&<input placeholder="Rounds / resultado / tiempo…" value={e.rounds||""} onChange={ev=>{const u={...dayRecord,entrenamiento:dayRecord.entrenamiento.map((x,j)=>j===i?{...x,rounds:ev.target.value}:x)};setDayRecord(u);}} onBlur={()=>saveData(dayPath,dayRecord)} style={{...S.input,background:"#f8f7f4",marginTop:8,marginBottom:8}}/>}
                <div style={{display:"flex",gap:6}}>
                  {e.tipo==="descanso"?<button onClick={()=>updateEntreno(i,"descanso")} style={S.btn(true)}>✓ Descanso</button>
                    :(["completo","pendiente"] as WorkoutStatus[]).map(s=><button key={s} onClick={()=>updateEntreno(i,s as WorkoutStatus)} style={S.btn(e.status===s,s==="completo"?"#639922":undefined)}>{s==="completo"?"✓ Completado":"Pendiente"}</button>)}
                </div>
              </div>;
            })}
          </div>
        )}

        {/* MEAL PREP */}
        {activeTab==="mealprep"&&(
          <div>

            {/* ── CONFIGURADOR ── */}
            <div style={S.card}>
              <span style={S.lbl}>Cantidades a cocinar el domingo</span>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                {[
                  {lbl:"Pollo crudo (kg)",val:mpPollo,set:setMpPollo,hint:"rec: 2.6 kg"},
                  {lbl:"Papa cruda (kg)",val:mpPapa,set:setMpPapa,hint:"rec: 0.9 kg"},
                  {lbl:"Zapallito crudo (kg)",val:mpZap,set:setMpZap,hint:"rec: 0.8 kg"},
                  {lbl:"Huevos a hervir (un)",val:mpHuevos,set:setMpHuevos,hint:"rec: 10 un"},
                ].map(f=>(
                  <div key={f.lbl}>
                    <span style={{...S.lbl,marginBottom:4}}>{f.lbl}</span>
                    <input type="number" step="0.1" value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.hint} style={S.input}/>
                    <div style={{fontSize:10,color:"#aaa",marginTop:2}}>{f.hint}</div>
                  </div>
                ))}
              </div>

              {/* Rendimiento preview */}
              <div style={{background:"#f8f7f4",borderRadius:8,padding:"9px 12px",marginBottom:12,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,textAlign:"center" as const}}>
                {[
                  {lbl:"Pollo cocido",val:`${Math.round((parseFloat(mpPollo)||2.6)*730)}g`,sub:`de ${mpPollo||2.6}kg crudo`,col:"#FAECE7",txt:"#993C1D"},
                  {lbl:"Papa cocida", val:`${Math.round((parseFloat(mpPapa)||0.9)*900)}g`,sub:`de ${mpPapa||0.9}kg crudo`,col:"#FAEEDA",txt:"#854F0B"},
                  {lbl:"Zapallito",   val:`${Math.round((parseFloat(mpZap)||0.8)*850)}g`,sub:`de ${mpZap||0.8}kg crudo`,col:"#EAF3DE",txt:"#3B6D11"},
                  {lbl:"Huevos",      val:`${mpHuevos||10} un`,sub:"duran 7 días",col:"#E6F1FB",txt:"#185FA5"},
                ].map(k=>(
                  <div key={k.lbl} style={{background:k.col,borderRadius:8,padding:"8px 4px"}}>
                    <div style={{fontSize:11,color:k.txt,marginBottom:2,fontWeight:500}}>{k.lbl}</div>
                    <div style={{fontSize:15,fontWeight:500,color:k.txt}}>{k.val}</div>
                    <div style={{fontSize:10,color:k.txt,opacity:0.7}}>{k.sub}</div>
                  </div>
                ))}
              </div>

              <button onClick={generarYGuardar}
                style={{width:"100%",padding:"11px",background:"#639922",color:"white",border:"none",borderRadius:10,fontSize:14,fontWeight:500,cursor:"pointer"}}>
                {mealPrep?"Recalcular tuppers ↺":"Generar plan de tuppers ✓"}
              </button>
            </div>

            {!mealPrep&&(
              <div style={{...S.tip("#639922"),marginTop:8}}>
                Ingresá las cantidades que vas a cocinar y presioná "Generar plan de tuppers" para ver exactamente qué va en cada contenedor, con etiquetas para identificarlos en la heladera.
              </div>
            )}

            {mealPrep&&(
              <>
                {/* ── RESUMEN DE COCCIÓN ── */}
                <div style={S.card}>
                  <span style={S.lbl}>Resumen de cocción — qué cocinar y cómo separar</span>
                  {[
                    {
                      alim:"🍗 Pechuga de pollo",
                      crudo:`${mealPrep.kg_pollo_crudo} kg crudo`,
                      cocido:`~${Math.round(mealPrep.kg_pollo_crudo*730)}g cocido`,
                      instruccion:"Al horno 200°C · 30-35 min · marinada: sal, pimienta, ajo, limón",
                      separar:`Separá ${Math.round(mealPrep.kg_pollo_crudo*730/10)}g por tupper (aprox). Los almuerzos llevan más que las cenas.`,
                      col:"#FAECE7",txt:"#993C1D",
                    },
                    {
                      alim:"🥔 Papa",
                      crudo:`${mealPrep.kg_papa_crudo} kg crudo`,
                      cocido:`~${Math.round(mealPrep.kg_papa_crudo*900)}g cocida`,
                      instruccion:"Hervida en cubos · 15-18 min · al dente (no pasada — dura más en heladera)",
                      separar:"Solo va en los tuppers de ALMUERZO. Días WOD: 200g, días descanso: 120g.",
                      col:"#FAEEDA",txt:"#854F0B",
                    },
                    {
                      alim:"🥒 Zapallito",
                      crudo:`${mealPrep.kg_zapallito_crudo} kg crudo`,
                      cocido:`~${Math.round(mealPrep.kg_zapallito_crudo*850)}g cocido`,
                      instruccion:"Salteado con ajo y aceite · 8-10 min · o al horno con el pollo",
                      separar:"Va en TODOS los tuppers. Almuerzo: 90g, Cena: 150g.",
                      col:"#EAF3DE",txt:"#3B6D11",
                    },
                    {
                      alim:"🥚 Huevos duros",
                      crudo:`${mealPrep.huevos} unidades`,
                      cocido:`${mealPrep.huevos} unidades`,
                      instruccion:"Hervidos 10 min · enfriar en agua fría · guardar CON CÁSCARA en heladera",
                      separar:"NO van en tupper cocido. Se guardan sueltos. Usás 3 un. el miércoles a la noche.",
                      col:"#E6F1FB",txt:"#185FA5",
                    },
                  ].map((r,i)=>(
                    <div key={i} style={{borderLeft:`3px solid ${r.txt}`,paddingLeft:12,marginBottom:14,paddingBottom:14,borderBottom:i<3?"0.5px solid #f0ede4":"none"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                        <span style={{fontSize:14,fontWeight:500}}>{r.alim}</span>
                        <div style={{display:"flex",gap:8}}>
                          <span style={{fontSize:11,padding:"2px 8px",borderRadius:4,background:r.col,color:r.txt}}>{r.crudo}</span>
                          <span style={{fontSize:11,padding:"2px 8px",borderRadius:4,background:"#f8f7f4",color:"#555"}}>→ {r.cocido}</span>
                        </div>
                      </div>
                      <div style={{fontSize:12,color:"#555",marginBottom:3}}>🍳 {r.instruccion}</div>
                      <div style={{fontSize:12,color:r.txt,fontWeight:500}}>📦 {r.separar}</div>
                    </div>
                  ))}
                </div>

                {/* ── FILTRO TUPPERS ── */}
                <div style={{display:"flex",gap:6,marginBottom:12,alignItems:"center"}}>
                  <span style={{fontSize:13,color:"#888",marginRight:4}}>Ver:</span>
                  {(["todos","almuerzo","cena"] as const).map(f=>(
                    <button key={f} onClick={()=>setMpFilter(f)}
                      style={S.btn(mpFilter===f, f==="almuerzo"?"#639922":f==="cena"?"#185FA5":undefined)}>
                      {f==="todos"?"Todos los tuppers":f==="almuerzo"?"Almuerzos (5)":"Cenas (5)"}
                    </button>
                  ))}
                </div>

                {/* ── LEYENDA DE ETIQUETAS ── */}
                <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap" as const}}>
                  {[
                    {tipo:"almuerzo",lbl:"ALM = Almuerzo",col:TUPPER_COLORS.almuerzo},
                    {tipo:"cena",lbl:"CEN = Cena",col:TUPPER_COLORS.cena},
                  ].map(l=>(
                    <div key={l.tipo} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:8,background:l.col.bg,border:`1.5px solid ${l.col.border}`}}>
                      <div style={{width:24,height:24,borderRadius:5,background:l.col.bg,border:`1.5px solid ${l.col.border}`,display:"flex",flexDirection:"column" as const,alignItems:"center",justifyContent:"center"}}>
                        <span style={{fontSize:7,fontWeight:700,color:l.col.badge,lineHeight:1}}>{l.tipo==="almuerzo"?"ALM":"CEN"}</span>
                        <span style={{fontSize:8,fontWeight:700,color:l.col.txt,lineHeight:1}}>L</span>
                      </div>
                      <span style={{fontSize:12,color:l.col.txt,fontWeight:500}}>{l.lbl} · L=Lunes M=Martes X=Miérc J=Jueves V=Viernes</span>
                    </div>
                  ))}
                </div>

                {/* ── TUPPERS ── */}
                <span style={S.lbl}>{mpFilter==="todos"?`${mealPrep.tuppers.length} tuppers para la semana`:mpFilter==="almuerzo"?"5 almuerzos":"5 cenas"}</span>
                {mealPrep.tuppers
                  .filter(t=>mpFilter==="todos"||t.tipo===mpFilter)
                  .map(t=>(
                    <TupperCard
                      key={t.id}
                      t={t}
                      expanded={expandedTupper===t.id}
                      onToggle={()=>setExpandedTupper(expandedTupper===t.id?null:t.id)}
                    />
                  ))
                }

                {/* ── RESUMEN NUTRICIONAL SEMANAL ── */}
                <div style={{...S.card,background:"#f8f7f4",marginTop:6}}>
                  <span style={S.lbl}>Nutrición total del meal prep</span>
                  {(()=>{
                    const alm=mealPrep.tuppers.filter(t=>t.tipo==="almuerzo");
                    const cen=mealPrep.tuppers.filter(t=>t.tipo==="cena");
                    const totalProt=mealPrep.tuppers.reduce((s,t)=>s+t.totalProt,0);
                    const totalKcal=mealPrep.tuppers.reduce((s,t)=>s+t.totalKcal,0);
                    return(
                      <div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
                          {[
                            {lbl:"Proteína total",val:`${Math.round(totalProt)}g`,sub:"en 10 tuppers",col:"#185FA5"},
                            {lbl:"Kcal total",val:`${totalKcal}`,sub:"en 10 tuppers",col:"#EF9F27"},
                            {lbl:"Prot/día (alm+cen)",val:`${Math.round(totalProt/5)}g`,sub:"5 días",col:"#639922"},
                          ].map(k=>(
                            <div key={k.lbl} style={{textAlign:"center" as const,background:"white",borderRadius:8,padding:"10px 6px",border:"0.5px solid #e2e0d8"}}>
                              <div style={{fontSize:11,color:"#888",marginBottom:4}}>{k.lbl}</div>
                              <div style={{fontSize:18,fontWeight:500,color:k.col}}>{k.val}</div>
                              <div style={{fontSize:10,color:"#aaa"}}>{k.sub}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{fontSize:12,color:"#555",lineHeight:1.8}}>
                          <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:"0.5px solid #e2e0d8"}}>
                            <span style={{color:"#27500A",fontWeight:500}}>Almuerzos (5)</span>
                            <span>prot: {Math.round(alm.reduce((s,t)=>s+t.totalProt,0))}g · kcal: {alm.reduce((s,t)=>s+t.totalKcal,0)}</span>
                          </div>
                          <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0"}}>
                            <span style={{color:"#0C447C",fontWeight:500}}>Cenas (5)</span>
                            <span>prot: {Math.round(cen.reduce((s,t)=>s+t.totalProt,0))}g · kcal: {cen.reduce((s,t)=>s+t.totalKcal,0)}</span>
                          </div>
                        </div>
                        <div style={{...S.tip("#1D9E75"),marginTop:8,marginBottom:0}}>
                          <strong>Durabilidad:</strong> Todos los tuppers duran 4–5 días en heladera. El pollo cocido no supera el viernes. Si cocinás el domingo, todo está cubierto de lunes a viernes sin problema.
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </>
            )}

          </div>
        )}

        {/* ── PLACEHOLDER para el bloque truncado original ── */}
        {false&&(
          <div>
            {/* Configurador */}
            <div style={S.card}>
              <span style={S.lbl}>Configurar cantidades a cocinar el domingo</span>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                {[
                  {lbl:"Pollo crudo (kg)",val:mpPollo,set:setMpPollo,hint:"Recomendado: 2.6 kg"},
                  {lbl:"Papa cruda (kg)",val:mpPapa,set:setMpPapa,hint:"Recomendado: 0.9 kg"},
                  {lbl:"Zapallito crudo (kg)",val:mpZap,set:setMpZap,hint:"Recomendado: 0.8 kg"},
                  {lbl:"Huevos (un)",val:mpHuevos,set:setMpHuevos,hint:"Recomendado: 10 un"},
                ].map(f=>(
                  <div key={f.lbl}>
                    <span style={{...S.lbl,marginBottom:4}}>{f.lbl}</span>
                    <input type="number" step="0.1" value={f.val} onChange={e=>f.set(e.target.value)} placeholder={f.hint} style={S.input}/>
                    <div style={{fontSize:10,color:"#aaa",marginTop:3}}>{f.hint}</div>
                  </div>
                ))}
              </div>
              {/* Preview rendimiento */}
              <div style={{background:"#f8f7f4",borderRadius:8,padding:"9px 12px",marginBottom:12,fontSize:12,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,textAlign:"center" as const}}>
                {[
                  {lbl:"Pollo cocido",
