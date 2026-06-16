"use client";
// ═══════════════════════════════════════════════════════════════════════════════
// MÓDULO: SISTEMA DE VIDA PERSONAL — "UN NUEVO COMIENZO" (TAPAS 2)
// Integrar en tu app existente reemplazando el <App> root o como pantalla extra.
//
// CÓMO INTEGRAR:
//   1. Copiá este archivo al proyecto.
//   2. En tu App root (checklist_medialunas_v2.jsx), después del login,
//      mostrá <AppSelector> antes de renderizar el sistema de medialunas.
//   3. Compartí el mismo `db` de Firebase pasándolo como prop o importándolo.
//   4. Las colecciones Firestore usadas: "vida_personal/{fecha}/pilares/{id}"
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from "react";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs } from "firebase/firestore";

// ── Firebase (reutiliza la instancia ya inicializada de tu app) ───────────────
let db = null;
try {
  const { getApps } = require("firebase/app");
  const app = getApps()[0];
  if (app) db = getFirestore(app);
} catch(e) {}

// ── Paleta de colores ─────────────────────────────────────────────────────────
const C = {
  fe:      { bg:"#FAEEDA", border:"#BA7517", text:"#633806", dot:"#EF9F27" },
  trading: { bg:"#E1F5EE", border:"#1D9E75", text:"#085041", dot:"#1D9E75" },
  hogar:   { bg:"#E6F1FB", border:"#378ADD", text:"#0C447C", dot:"#378ADD" },
  nutricion:{ bg:"#FCEBEB", border:"#E24B4A", text:"#A32D2D", dot:"#E24B4A" },
  vision:  { bg:"#EEEDFE", border:"#7F77DD", text:"#3C3489", dot:"#7F77DD" },
};

// ── Datos de los 5 pilares ────────────────────────────────────────────────────
const PILARES = [
  {
    id: "fe",
    emoji: "✝️",
    titulo: "Fe & Propósito",
    subtitulo: "Salmos 119:97 · Jarvis Wake Up",
    color: C.fe,
    descripcion: "La constancia nace de un propósito mayor. Cada día registrás tu ritual matutino y tu versículo guía como ancla espiritual.",
    habitos: [
      { id:"jarvis", label:"Jarvis Wake Up — ritual matutino completado" },
      { id:"versiculo", label:"Leí / medité Salmos 119:97" },
      { id:"intencion", label:"Definí una intención clara para el día" },
    ],
    nota_campo: "Escribí una palabra o frase de tu meditación de hoy",
    codigo: "FE",
  },
  {
    id: "trading",
    emoji: "📈",
    titulo: "Finanzas & Trading",
    subtitulo: "Cuenta de fondeo EUR/DOL",
    color: C.trading,
    descripcion: "El camino a la libertad financiera se construye operación por operación. Registrás tu actividad diaria, estado de la cuenta y aprendizajes.",
    habitos: [
      { id:"revise_mercado", label:"Revisé el mercado antes de operar" },
      { id:"opere", label:"Realicé al menos una operación planificada" },
      { id:"registro_op", label:"Registré resultado de la operación del día" },
      { id:"efectivo", label:"Gestioné ingreso de efectivo (si corresponde)" },
    ],
    nota_campo: "Resultado / aprendizaje del día en trading",
    codigo: "TRADING",
  },
  {
    id: "hogar",
    emoji: "🏠",
    titulo: "Hogar & Orden",
    subtitulo: "Orden y limpieza como base",
    color: C.hogar,
    descripcion: "Un espacio ordenado es un espacio que piensa. El orden físico refleja y genera orden mental.",
    habitos: [
      { id:"orden_am", label:"Ordené y limpié el espacio al levantarme" },
      { id:"heladera", label:"Revisé heladera / stock de alimentos" },
      { id:"prep_mañana", label:"Preparé el entorno para el día siguiente" },
    ],
    nota_campo: "Tarea de hogar pendiente o completada hoy",
    codigo: "HOGAR",
  },
  {
    id: "nutricion",
    emoji: "🍗",
    titulo: "Fitness & Nutrición",
    subtitulo: "CrossFit · Meal Prep · Macros",
    color: C.nutricion,
    descripcion: "Cuerpo fuerte, mente fuerte. Registrás tu entrenamiento, los tuppers del día y tus macros reales vs objetivo.",
    habitos: [
      { id:"entrenamiento", label:"Completé mi sesión de CrossFit / WOD" },
      { id:"tupper1", label:"Comí Tupper 1 (almuerzo)" },
      { id:"tupper2", label:"Comí Tupper 2 (cena)" },
      { id:"desayuno", label:"Desayuno: avena + leche + banana + huevos" },
      { id:"hidratacion", label:"Hidratación adecuada durante el día" },
    ],
    nota_campo: "Cómo fue el entrenamiento / cómo me sentí físicamente",
    codigo: "FIT",
    esFitness: true,
  },
  {
    id: "vision",
    emoji: "🃏",
    titulo: '"El Loco" — Visión',
    subtitulo: "Tapas 2 · Un Nuevo Comienzo",
    color: C.vision,
    descripcion: "El Loco actúa sin paralizarse. Cada día registrás un paso hacia tu visión. El arcano 0: el viajero que parte libre.",
    habitos: [
      { id:"accion_clave", label:"Realicé al menos UNA acción hacia mi visión" },
      { id:"gratitud", label:"Escribí 1 cosa por la que estoy agradecido" },
      { id:"no_procrastine", label:"No postergué lo importante por lo urgente" },
    ],
    nota_campo: "La acción más importante que hice hoy",
    codigo: "VISION",
  },
];

// ── Plan de tuppers ───────────────────────────────────────────────────────────
const TUPPERS = {
  base: {
    nombre: "Estándar (entreno)",
    pollo: 300, papa: 200, verduras: 150, huevo: 1,
    kcal: 620, prot: 72, carbs: 38, grasas: 11,
  },
  descanso: {
    nombre: "Descanso",
    pollo: 250, papa: 150, verduras: 130, huevo: 1,
    kcal: 540, prot: 61, carbs: 29, grasas: 10,
  },
  cena_entreno: {
    nombre: "Cena (entreno)",
    pollo: 250, papa: 200, verduras: 150, huevo: 2,
    kcal: 600, prot: 67, carbs: 38, grasas: 15,
  },
  cena_descanso: {
    nombre: "Cena (descanso)",
    pollo: 220, papa: 100, verduras: 130, huevo: 2,
    kcal: 500, prot: 58, carbs: 22, grasas: 15,
  },
};

const DESAYUNO = { avena: 70, leche: 250, banana: 120, huevos: 3, kcal: 520, prot: 32, carbs: 74, grasas: 26 };

// ── Estilos compartidos (mismos que tu app) ───────────────────────────────────
const S = {
  card: { border:"1px solid #e2e8f0", borderRadius:10, padding:"1rem", background:"#fff", marginBottom:8 },
  btn: (p,d) => ({ padding:"8px 14px", fontSize:12, border:`1px solid ${p?"#185FA5":"#cbd5e1"}`,
    borderRadius:8, background:p?"#185FA5":"#f8fafc", color:p?"#E6F1FB":"#1e293b",
    cursor:d?"default":"pointer", opacity:d?.4:1, fontWeight:p?500:400 }),
  btnSm: (p) => ({ padding:"5px 10px", fontSize:11, border:`1px solid ${p?"#185FA5":"#e2e8f0"}`,
    borderRadius:6, background:p?"#185FA5":"#f8fafc", color:p?"#E6F1FB":"#64748b",
    cursor:"pointer", fontWeight:p?500:400 }),
  inp: () => ({ width:"100%", fontSize:13, padding:"7px 10px", border:"1px solid #cbd5e1",
    borderRadius:8, background:"#fff", boxSizing:"border-box", color:"#1e293b" }),
};

// ── Utilidades ────────────────────────────────────────────────────────────────
function hoy() {
  const d = new Date();
  return d.toISOString().slice(0,10); // "2026-06-15"
}

function docPath(fecha, pilarId) {
  return `vida_personal/${fecha}/pilares/${pilarId}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PANTALLA DE SELECCIÓN — 5 PILARES
// ═══════════════════════════════════════════════════════════════════════════════
export function AppSelector({ onSelectApp }) {
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const [codigoActivo, setCodigoActivo] = useState(null);

  // Código de acceso por pilar (tipo PIN — podés personalizar)
  const CODIGOS = {
    "FE": "fe",
    "TRADING": "trading",
    "HOGAR": "hogar",
    "FIT": "nutricion",
    "VISION": "vision",
    "MEDIA": "medialunas", // acceso al sistema de medialunas
  };

  function handleCodigo() {
    const key = codigo.toUpperCase().trim();
    if (CODIGOS[key]) {
      setCodigoActivo(CODIGOS[key]);
      setError("");
      onSelectApp(CODIGOS[key]);
    } else {
      setError("Código no reconocido. Probá: FE · TRADING · HOGAR · FIT · VISION · MEDIA");
    }
  }

  return (
    <div style={{ minHeight:"100vh", background:"#0f0f1a", display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center", padding:20, fontFamily:"system-ui,sans-serif" }}>

      {/* Header */}
      <div style={{ textAlign:"center", marginBottom:28 }}>
        <div style={{ fontSize:32, marginBottom:8 }}>🃏</div>
        <div style={{ fontSize:20, fontWeight:600, color:"#fff", marginBottom:4 }}>Un Nuevo Comienzo</div>
        <div style={{ fontSize:12, color:"#666", letterSpacing:2 }}>TAPAS 2 · 14/06/2026</div>
      </div>

      {/* Pilares */}
      <div style={{ width:"100%", maxWidth:400, marginBottom:24 }}>
        {PILARES.map(p => (
          <div key={p.id}
            style={{ borderRadius:12, marginBottom:8, overflow:"hidden",
              border:`1px solid ${p.color.border}33`, background:`${p.color.bg}22` }}>
            <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px" }}>
              <span style={{ fontSize:20 }}>{p.emoji}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:500, color:"#fff" }}>{p.titulo}</div>
                <div style={{ fontSize:11, color:"#888", marginTop:1 }}>{p.subtitulo}</div>
              </div>
              <div style={{ fontSize:10, background:`${p.color.bg}44`, color:p.color.text,
                border:`1px solid ${p.color.border}55`, borderRadius:4, padding:"2px 8px",
                fontWeight:600, letterSpacing:1 }}>
                {p.codigo}
              </div>
            </div>
            <div style={{ fontSize:11, color:"#aaa", padding:"0 16px 12px", lineHeight:1.5 }}>
              {p.descripcion}
            </div>
          </div>
        ))}

        {/* Medialunas */}
        <div style={{ borderRadius:12, marginBottom:8, border:"1px solid #ffffff22",
          background:"#ffffff08", padding:"12px 16px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ fontSize:20 }}>🥐</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:500, color:"#fff" }}>Control de Proceso</div>
              <div style={{ fontSize:11, color:"#888" }}>Medialunas · Sabores Express</div>
            </div>
            <div style={{ fontSize:10, background:"#ffffff15", color:"#ccc",
              border:"1px solid #ffffff30", borderRadius:4, padding:"2px 8px",
              fontWeight:600, letterSpacing:1 }}>
              MEDIA
            </div>
          </div>
        </div>
      </div>

      {/* Input de código */}
      <div style={{ width:"100%", maxWidth:400 }}>
        <div style={{ fontSize:12, color:"#888", marginBottom:8, textAlign:"center" }}>
          Ingresá el código del módulo que querés abrir
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <input
            value={codigo}
            onChange={e => setCodigo(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && handleCodigo()}
            placeholder="Ej: FIT · FE · TRADING..."
            style={{ ...S.inp(), background:"#1a1a2e", border:"1px solid #333",
              color:"#fff", flex:1, fontSize:14, letterSpacing:2 }}
          />
          <button onClick={handleCodigo}
            style={{ padding:"8px 16px", borderRadius:8, background:"#534AB7",
              border:"none", color:"#fff", fontSize:14, cursor:"pointer", fontWeight:500 }}>
            →
          </button>
        </div>
        {error && (
          <div style={{ fontSize:11, color:"#E24B4A", marginTop:8, textAlign:"center" }}>
            {error}
          </div>
        )}
        <div style={{ fontSize:10, color:"#555", marginTop:12, textAlign:"center", lineHeight:1.6 }}>
          Desarrollamos Fe · Trading · Hogar · Fitness · Visión<br/>
          Un registro diario · Una constancia construida
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MÓDULO FITNESS & NUTRICIÓN
// ═══════════════════════════════════════════════════════════════════════════════
function NutricionDia({ fecha, datos, onChange }) {
  const [tipoDia, setTipoDia] = useState(datos?.tipoDia || "entreno");
  const [macrosReales, setMacrosReales] = useState(datos?.macrosReales || { prot:"", carbs:"", grasas:"", kcal:"" });
  const [tupper1, setTupper1] = useState(datos?.tupper1 || "base");
  const [tupper2, setTupper2] = useState(datos?.tupper2 || "cena_entreno");
  const [wod, setWod] = useState(datos?.wod || "");
  const [pesoActual, setPesoActual] = useState(datos?.pesoActual || "");

  const t1 = TUPPERS[tupper1];
  const t2 = TUPPERS[tupper2];
  const totalProt  = (DESAYUNO.prot  + t1.prot  + t2.prot);
  const totalCarbs = (DESAYUNO.carbs + t1.carbs + t2.carbs);
  const totalGrasas= (DESAYUNO.grasas+ t1.grasas+ t2.grasas);
  const totalKcal  = (DESAYUNO.kcal  + t1.kcal  + t2.kcal);

  useEffect(() => {
    onChange({ tipoDia, macrosReales, tupper1, tupper2, wod, pesoActual,
      planKcal: totalKcal, planProt: totalProt });
  }, [tipoDia, macrosReales, tupper1, tupper2, wod, pesoActual]);

  const TIPOS_DIA = [["entreno","🏋️ Entreno"],["descanso","😴 Descanso"]];
  const VARIANTES_T1 = [["base","Estándar"],["descanso","Reducido"]];
  const VARIANTES_T2 = [["cena_entreno","Estándar"],["cena_descanso","Reducido"]];

  function BarraMacro({ label, valor, objetivo, color }) {
    const pct = Math.min(100, Math.round((valor / objetivo) * 100));
    return (
      <div style={{ marginBottom:8 }}>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:11,
          color:"#64748b", marginBottom:3 }}>
          <span>{label}</span>
          <span style={{ fontWeight:500, color:"#1e293b" }}>{valor}g / {objetivo}g</span>
        </div>
        <div style={{ height:6, background:"#f1f5f9", borderRadius:3, overflow:"hidden" }}>
          <div style={{ height:6, width:`${pct}%`, background:color, borderRadius:3, transition:"width .3s" }}/>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Tipo de día */}
      <div style={{ ...S.card }}>
        <div style={{ fontSize:12, color:"#64748b", marginBottom:6 }}>Tipo de día</div>
        <div style={{ display:"flex", gap:6 }}>
          {TIPOS_DIA.map(([id,label]) => (
            <button key={id} onClick={() => setTipoDia(id)}
              style={{ flex:1, padding:"8px", fontSize:12, borderRadius:8, cursor:"pointer",
                border:`1px solid ${tipoDia===id?"#E24B4A":"#e2e8f0"}`,
                background:tipoDia===id?"#FCEBEB":"#f8fafc",
                color:tipoDia===id?"#A32D2D":"#64748b", fontWeight:tipoDia===id?500:400 }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* WOD del día */}
      {tipoDia === "entreno" && (
        <div style={{ ...S.card }}>
          <div style={{ fontSize:12, color:"#64748b", marginBottom:4 }}>WOD / Entrenamiento de hoy</div>
          <textarea value={wod} onChange={e=>setWod(e.target.value)}
            placeholder="Ej: Fran 21-15-9 Thrusters + Pull-ups · Tiempo: 8:42"
            style={{ ...S.inp(), height:52, resize:"none" }}/>
        </div>
      )}

      {/* Desayuno fijo */}
      <div style={{ ...S.card }}>
        <div style={{ fontSize:13, fontWeight:500, marginBottom:8 }}>🥣 Desayuno (fijo)</div>
        {[
          ["Avena cocida", `${DESAYUNO.avena}g`],
          ["Leche entera", `${DESAYUNO.leche}ml`],
          ["Banana", `${DESAYUNO.banana}g`],
          ["Huevos enteros", "3 unidades"],
        ].map(([n,v]) => (
          <div key={n} style={{ display:"flex", justifyContent:"space-between",
            fontSize:12, padding:"5px 0", borderBottom:"1px solid #f1f5f9" }}>
            <span style={{ color:"#64748b" }}>{n}</span>
            <span style={{ fontWeight:500 }}>{v}</span>
          </div>
        ))}
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:11,
          color:"#94a3b8", marginTop:6 }}>
          <span>{DESAYUNO.prot}g prot · {DESAYUNO.carbs}g carbs · {DESAYUNO.grasas}g grasas</span>
          <span style={{ fontWeight:500, color:"#1e293b" }}>{DESAYUNO.kcal} kcal</span>
        </div>
      </div>

      {/* Tupper 1 */}
      <div style={{ ...S.card }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <div style={{ fontSize:13, fontWeight:500 }}>📦 Tupper 1 — Almuerzo</div>
          <div style={{ display:"flex", gap:4 }}>
            {VARIANTES_T1.map(([id,label]) => (
              <button key={id} onClick={() => setTupper1(id)} style={{ ...S.btnSm(tupper1===id) }}>{label}</button>
            ))}
          </div>
        </div>
        {[
          ["🍗 Pollo (pechuga)", `${t1.pollo}g`],
          ["🥔 Papa cocida", `${t1.papa}g`],
          ["🥦 Verduras mix", `${t1.verduras}g`],
          ["🥚 Huevo duro", `${t1.huevo} unidad`],
        ].map(([n,v]) => (
          <div key={n} style={{ display:"flex", justifyContent:"space-between",
            fontSize:12, padding:"5px 0", borderBottom:"1px solid #f1f5f9" }}>
            <span style={{ color:"#64748b" }}>{n}</span>
            <span style={{ fontWeight:500 }}>{v}</span>
          </div>
        ))}
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:11,
          color:"#94a3b8", marginTop:6 }}>
          <span>{t1.prot}g prot · {t1.carbs}g carbs · {t1.grasas}g grasas</span>
          <span style={{ fontWeight:500, color:"#1e293b" }}>{t1.kcal} kcal</span>
        </div>
      </div>

      {/* Tupper 2 */}
      <div style={{ ...S.card }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <div style={{ fontSize:13, fontWeight:500 }}>📦 Tupper 2 — Cena</div>
          <div style={{ display:"flex", gap:4 }}>
            {VARIANTES_T2.map(([id,label]) => (
              <button key={id} onClick={() => setTupper2(id)} style={{ ...S.btnSm(tupper2===id) }}>{label}</button>
            ))}
          </div>
        </div>
        {[
          ["🍗 Pollo (pechuga)", `${t2.pollo}g`],
          ["🥔 Papa cocida", `${t2.papa}g`],
          ["🥦 Verduras mix", `${t2.verduras}g`],
          ["🥚 Huevos revueltos", `${t2.huevo} unidades`],
        ].map(([n,v]) => (
          <div key={n} style={{ display:"flex", justifyContent:"space-between",
            fontSize:12, padding:"5px 0", borderBottom:"1px solid #f1f5f9" }}>
            <span style={{ color:"#64748b" }}>{n}</span>
            <span style={{ fontWeight:500 }}>{v}</span>
          </div>
        ))}
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:11,
          color:"#94a3b8", marginTop:6 }}>
          <span>{t2.prot}g prot · {t2.carbs}g carbs · {t2.grasas}g grasas</span>
          <span style={{ fontWeight:500, color:"#1e293b" }}>{t2.kcal} kcal</span>
        </div>
      </div>

      {/* Totales del plan */}
      <div style={{ ...S.card, background:"#f8fafc" }}>
        <div style={{ fontSize:13, fontWeight:500, marginBottom:10 }}>📊 Plan del día</div>
        <BarraMacro label="Proteína" valor={totalProt} objetivo={185} color="#378ADD" />
        <BarraMacro label="Carbohidratos" valor={totalCarbs} objetivo={245} color="#BA7517" />
        <BarraMacro label="Grasas" valor={totalGrasas} objetivo={82} color="#3B6D11" />
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:8, fontSize:13 }}>
          <span style={{ color:"#64748b" }}>Total calorías del plan</span>
          <span style={{ fontWeight:600, color: totalKcal > 2600 ? "#A32D2D" : "#085041" }}>
            {totalKcal} kcal
          </span>
        </div>
      </div>

      {/* Macros reales registrados */}
      <div style={{ ...S.card }}>
        <div style={{ fontSize:12, color:"#64748b", marginBottom:8 }}>
          Macros reales del día (opcional — si los medís)
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {[["prot","Proteína (g)"],["carbs","Carbos (g)"],["grasas","Grasas (g)"],["kcal","Calorías"]].map(([k,label])=>(
            <div key={k}>
              <div style={{ fontSize:11, color:"#94a3b8", marginBottom:3 }}>{label}</div>
              <input type="number" value={macrosReales[k]}
                onChange={e=>setMacrosReales(prev=>({...prev,[k]:e.target.value}))}
                placeholder="—" style={{ ...S.inp(), textAlign:"center", fontSize:14, fontWeight:500 }}/>
            </div>
          ))}
        </div>
      </div>

      {/* Peso corporal */}
      <div style={{ ...S.card }}>
        <div style={{ fontSize:12, color:"#64748b", marginBottom:4 }}>Peso corporal hoy (kg)</div>
        <input type="number" step="0.1" value={pesoActual}
          onChange={e=>setPesoActual(e.target.value)}
          placeholder="95.0" style={{ ...S.inp(), fontSize:16, textAlign:"center", fontWeight:500 }}/>
        <div style={{ fontSize:11, color:"#94a3b8", marginTop:4 }}>
          Registrá en ayunas, mismo horario siempre
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MÓDULO PILAR GENÉRICO (Fe, Trading, Hogar, Visión)
// ═══════════════════════════════════════════════════════════════════════════════
function PilarGenerico({ pilar, datos, onChange }) {
  const [habitos, setHabitos] = useState(datos?.habitos || {});
  const [nota, setNota] = useState(datos?.nota || "");

  useEffect(() => {
    onChange({ habitos, nota });
  }, [habitos, nota]);

  function toggleHabito(id) {
    setHabitos(prev => ({ ...prev, [id]: !prev[id] }));
  }

  const completados = pilar.habitos.filter(h => habitos[h.id]).length;
  const pct = Math.round((completados / pilar.habitos.length) * 100);
  const c = pilar.color;

  return (
    <div>
      {/* Progreso */}
      <div style={{ ...S.card, background:c.bg, border:`1px solid ${c.border}44` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <div style={{ fontSize:13, fontWeight:500, color:c.text }}>
            {pilar.emoji} {pilar.titulo}
          </div>
          <div style={{ fontSize:20, fontWeight:600, color:c.text }}>{pct}%</div>
        </div>
        <div style={{ height:6, background:"#ffffff60", borderRadius:3, overflow:"hidden" }}>
          <div style={{ height:6, width:`${pct}%`, background:c.dot, borderRadius:3, transition:"width .3s" }}/>
        </div>
        <div style={{ fontSize:11, color:c.text, marginTop:6, opacity:.8 }}>
          {completados} de {pilar.habitos.length} hábitos completados hoy
        </div>
      </div>

      {/* Hábitos */}
      <div style={{ ...S.card }}>
        <div style={{ fontSize:12, color:"#64748b", marginBottom:8 }}>Hábitos del día</div>
        {pilar.habitos.map(h => (
          <div key={h.id} onClick={() => toggleHabito(h.id)}
            style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 10px",
              border:`1px solid ${habitos[h.id]?c.border:"#e2e8f0"}`,
              borderRadius:8, marginBottom:6, cursor:"pointer",
              background:habitos[h.id]?c.bg:"#fff" }}>
            <div style={{ width:18, height:18, borderRadius:4, flexShrink:0, display:"flex",
              alignItems:"center", justifyContent:"center", fontSize:12,
              border:`1.5px solid ${habitos[h.id]?c.dot:"#cbd5e1"}`,
              background:habitos[h.id]?c.dot:"transparent", color:"#fff" }}>
              {habitos[h.id] && "✓"}
            </div>
            <span style={{ fontSize:13, color:habitos[h.id]?c.text:"#1e293b", lineHeight:1.4 }}>
              {h.label}
            </span>
          </div>
        ))}
      </div>

      {/* Nota del día */}
      <div style={{ ...S.card }}>
        <div style={{ fontSize:12, color:"#64748b", marginBottom:4 }}>{pilar.nota_campo}</div>
        <textarea value={nota} onChange={e => setNota(e.target.value)}
          placeholder="Escribí tu nota del día..."
          style={{ ...S.inp(), height:72, resize:"none" }}/>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VISTA DIARIA — TODOS LOS PILARES
// ═══════════════════════════════════════════════════════════════════════════════
function VidaPersonalDia({ pilarInicial = "nutricion", onBack }) {
  const [pilarActivo, setPilarActivo] = useState(pilarInicial);
  const [datos, setDatos] = useState({});
  const [saveStatus, setSaveStatus] = useState("idle");
  const fecha = hoy();

  // Cargar datos del día desde Firebase
  useEffect(() => {
    if (!db) return;
    Promise.all(
      PILARES.map(p =>
        getDoc(doc(db, docPath(fecha, p.id)))
          .then(snap => ({ id: p.id, data: snap.exists() ? snap.data() : {} }))
      )
    ).then(results => {
      const loaded = {};
      results.forEach(r => { loaded[r.id] = r.data; });
      setDatos(loaded);
    });
  }, [fecha]);

  async function guardar(pilarId, nuevoDato) {
    const updated = { ...datos, [pilarId]: nuevoDato };
    setDatos(updated);
    if (!db) return;
    setSaveStatus("saving");
    try {
      await setDoc(doc(db, docPath(fecha, pilarId)),
        { ...nuevoDato, timestamp: new Date().toISOString() });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch(e) { setSaveStatus("error"); }
  }

  const pilar = PILARES.find(p => p.id === pilarActivo);
  const c = pilar?.color || C.fe;

  // Score general del día
  const scoreTotal = PILARES.reduce((acc, p) => {
    const d = datos[p.id] || {};
    if (p.esFitness) {
      const habitos = d.habitos || {};
      return acc + p.habitos.filter(h => habitos[h.id]).length;
    }
    const habitos = d.habitos || {};
    return acc + p.habitos.filter(h => habitos[h.id]).length;
  }, 0);
  const totalHabitos = PILARES.reduce((acc, p) => acc + p.habitos.length, 0);

  return (
    <div style={{ fontFamily:"system-ui,sans-serif", maxWidth:430, margin:"0 auto",
      color:"#1e293b", paddingBottom:40, minHeight:"100vh", background:"#f8fafc" }}>

      {/* Header */}
      <div style={{ padding:"1rem 1rem .75rem", borderBottom:"1px solid #e2e8f0",
        background:"#fff", marginBottom:8 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <div>
            <div style={{ fontSize:15, fontWeight:500 }}>🃏 Un Nuevo Comienzo</div>
            <div style={{ fontSize:11, color:"#64748b" }}>
              {fecha} · {scoreTotal}/{totalHabitos} hábitos hoy
            </div>
          </div>
          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
            <span style={{ fontSize:11, padding:"3px 8px", borderRadius:5,
              background:saveStatus==="saving"?"#FAEEDA":saveStatus==="saved"?"#E1F5EE":"#f8fafc",
              color:saveStatus==="saving"?"#633806":saveStatus==="saved"?"#085041":"#94a3b8",
              border:"1px solid #e2e8f0" }}>
              {saveStatus==="saving"?"Guardando...":saveStatus==="saved"?"✓ Guardado":"Automático"}
            </span>
            {onBack && (
              <button onClick={onBack}
                style={{ fontSize:11, border:"1px solid #e2e8f0", borderRadius:6,
                  padding:"4px 8px", background:"#f8fafc", cursor:"pointer", color:"#64748b" }}>
                ← Inicio
              </button>
            )}
          </div>
        </div>

        {/* Barra de progreso general */}
        <div style={{ height:4, background:"#f1f5f9", borderRadius:2, overflow:"hidden", marginBottom:8 }}>
          <div style={{ height:4, background:"#534AB7",
            width:`${Math.round((scoreTotal/totalHabitos)*100)}%`, borderRadius:2, transition:"width .3s" }}/>
        </div>

        {/* Tabs de pilares */}
        <div style={{ display:"flex", overflowX:"auto", gap:4, scrollbarWidth:"none" }}>
          {PILARES.map(p => {
            const d = datos[p.id] || {};
            const habs = d.habitos || {};
            const comp = p.habitos.filter(h => habs[h.id]).length;
            const isActive = pilarActivo === p.id;
            return (
              <button key={p.id} onClick={() => setPilarActivo(p.id)}
                style={{ whiteSpace:"nowrap", padding:"5px 10px", fontSize:11, cursor:"pointer",
                  border:`1px solid ${isActive?p.color.border:"#e2e8f0"}`,
                  borderBottom:"none", borderRadius:"6px 6px 0 0",
                  background:isActive?"#fff":"#f8fafc",
                  color:isActive?p.color.text:"#64748b", fontWeight:isActive?500:400 }}>
                {p.emoji} {p.titulo.split(" ")[0]}
                {comp > 0 && (
                  <span style={{ marginLeft:4, fontSize:10, background:p.color.bg,
                    color:p.color.text, borderRadius:3, padding:"1px 4px" }}>
                    {comp}/{p.habitos.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenido del pilar */}
      <div style={{ padding:"0 1rem" }}>
        {pilar?.esFitness ? (
          <>
            {/* Hábitos fitness arriba */}
            <PilarGenerico
              pilar={pilar}
              datos={datos[pilarActivo]}
              onChange={d => guardar(pilarActivo, d)}
            />
            {/* Módulo de nutrición */}
            <div style={{ ...S.card, marginTop:8, background:"#fff8f8",
              border:"1px solid #E24B4A33" }}>
              <div style={{ fontSize:13, fontWeight:500, color:"#A32D2D", marginBottom:12 }}>
                🍽️ Plan de alimentación del día
              </div>
              <NutricionDia
                fecha={fecha}
                datos={datos[pilarActivo]?.nutricion}
                onChange={nd => guardar(pilarActivo, { ...(datos[pilarActivo]||{}), nutricion: nd })}
              />
            </div>
          </>
        ) : (
          <PilarGenerico
            pilar={pilar}
            datos={datos[pilarActivo]}
            onChange={d => guardar(pilarActivo, d)}
          />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT PRINCIPAL — Pantalla de selección que enruta a cada módulo
// ═══════════════════════════════════════════════════════════════════════════════
export default function SistemaVidaPersonal({ onGoMedialunas }) {
  const [modulo, setModulo] = useState(null); // null = selector

  function handleSelect(mod) {
    if (mod === "medialunas") {
      onGoMedialunas?.();
      return;
    }
    setModulo(mod);
  }

  if (!modulo) {
    return <AppSelector onSelectApp={handleSelect} />;
  }

  return (
    <VidaPersonalDia
      pilarInicial={modulo}
      onBack={() => setModulo(null)}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INSTRUCCIONES DE INTEGRACIÓN EN TU APP EXISTENTE
// ───────────────────────────────────────────────────────────────────────────────
//
// En tu checklist_medialunas_v2.jsx, modificá el App root así:
//
//   import SistemaVidaPersonal from "./modulo_vida_personal";
//
//   export default function App() {
//     const [usuario, setUsuario] = useState(null);
//     const [modulo, setModulo] = useState("selector"); // "selector" | "medialunas"
//
//     if (!usuario) return <LoginScreen onLogin={u => setUsuario(u)} />;
//
//     if (modulo === "selector") {
//       return (
//         <SistemaVidaPersonal
//           onGoMedialunas={() => setModulo("medialunas")}
//         />
//       );
//     }
//
//     // Tu app de medialunas original va acá:
//     return (
//       <div style={{...}}>
//         {/* tu header y nav existentes */}
//         {/* Botón para volver al selector: */}
//         <button onClick={() => setModulo("selector")}>← Inicio</button>
//       </div>
//     );
//   }
//
// COLECCIÓN FIRESTORE:
//   vida_personal/{YYYY-MM-DD}/pilares/{pilarId}
//   Ejemplo: vida_personal/2026-06-15/pilares/nutricion
//
// ═══════════════════════════════════════════════════════════════════════════════
