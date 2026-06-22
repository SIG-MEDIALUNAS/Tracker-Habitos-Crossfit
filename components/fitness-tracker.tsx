"use client";
import { useState, useEffect, useRef } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "firebase/firestore";

// ─── FIREBASE CONFIG ──────────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
let db = null, firebaseOk = false;
try {
  const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
  db = getFirestore(app);
  firebaseOk = true;
} catch(e) { console.warn("Firebase no inicializado", e); }

const DIAS   = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
const MESES  = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const YEARS  = [2026,2027];
const ALL_MONTHS = YEARS.flatMap(y=>MESES.map((m,i)=>({label:`${m} ${y}`,id:`${m.toLowerCase()}_${y}`,year:y,monthIdx:i})));

// ─── TOKEN DE DISEÑO GLOBAL — negro · dorado · blanco ────────────────────────
// Negro base: #0a0a0a  Superficie: #111111  Borde: #1e1e1e  Borde activo: #C9A84C
// Dorado puro: #C9A84C  Dorado suave: #A8843C  Dorado tenue: #C9A84C22
// Texto primario: #F0E6CC  Texto secundario: #888  Texto terciario: #444
// Acento ok: #5C8A4A (verde oscuro, no brillante)  Acento error: #8A3A2A
const G = {
  bg:      "#0a0a0a",
  surf:    "#111111",
  surf2:   "#161616",
  border:  "#1e1e1e",
  borderA: "#C9A84C",
  gold:    "#C9A84C",
  goldSoft:"#A8843C",
  goldDim: "#C9A84C18",
  goldMid: "#C9A84C44",
  text:    "#F0E6CC",
  textSec: "#888888",
  textDim: "#444444",
  ok:      "#5C8A4A",
  okBg:    "#1a2a14",
  err:     "#8A3A2A",
  errBg:   "#2a1010",
};

// ─── STYLES ──────────────────────────────────────────────────────────────────
const S={
  inp:(e)=>({
    width:"100%",fontSize:13,padding:"8px 12px",boxSizing:"border-box",
    border:`1px solid ${e?G.err:G.border}`,borderRadius:4,
    background:e?G.errBg:G.surf2,color:G.text,outline:"none",
    fontFamily:"inherit",
  }),
  bpcc:{fontSize:10,background:G.errBg,color:"#C9724C",border:`1px solid #8A3A2A55`,borderRadius:2,padding:"1px 6px",fontWeight:600,letterSpacing:.5},
  bpc: {fontSize:10,background:G.goldDim,color:G.gold,border:`1px solid ${G.goldMid}`,borderRadius:2,padding:"1px 6px"},
  bok: {fontSize:10,background:G.okBg,color:"#7AB85A",border:`1px solid #5C8A4A55`,borderRadius:2,padding:"2px 7px",fontWeight:500},
  ber: {fontSize:10,background:G.errBg,color:"#C9724C",border:`1px solid #8A3A2A55`,borderRadius:2,padding:"2px 7px",fontWeight:500},
  card:{border:`1px solid ${G.border}`,borderRadius:6,padding:"1rem",background:G.surf,marginBottom:8},
  btn:(p,d)=>({
    padding:"8px 14px",fontSize:12,borderRadius:4,cursor:d?"default":"pointer",
    border:`1px solid ${p?G.gold:G.border}`,
    background:p?G.gold:G.surf2,
    color:p?G.bg:G.textSec,
    opacity:d?.4:1,fontWeight:p?600:400,letterSpacing:p?.5:0,
    fontFamily:"inherit",
  }),
  btnSm:(p)=>({
    padding:"5px 10px",fontSize:11,borderRadius:3,cursor:"pointer",
    border:`1px solid ${p?G.gold:G.border}`,
    background:p?G.gold:G.surf2,
    color:p?G.bg:G.textSec,
    fontWeight:p?600:400,fontFamily:"inherit",
  }),
};

// ─── MENSAJES MOTIVACIONALES (Cristo) ─────────────────────────────────────────
const MENSAJES_CRISTO = [
  "Álvaro, todo lo puedes en Cristo que te fortalece. Hoy es un nuevo día para avanzar.",
  "Álvaro, el Señor es tu pastor. Nada te faltará. Levantate y conquistá el día.",
  "Álvaro, no temas porque yo estoy contigo. No desmayes, porque yo soy tu Dios.",
  "Álvaro, el que comenzó en ti la buena obra, la perfeccionará. Seguí adelante.",
  "Álvaro, encomienda tus obras al Señor y tus pensamientos serán afirmados.",
  "Álvaro, buscá primero el reino de Dios y lo demás será añadido. Empezá por la fe.",
  "Álvaro, la fe sin obras está muerta. Hoy actuás. Hoy avanzás. Hoy ganás.",
  "Álvaro, eres más que vencedor por medio de Aquel que te amó. Que ese poder guíe tu día.",
  "Álvaro, el Señor renovará tus fuerzas. Correrás sin cansarte, caminarás sin fatigarte.",
  "Álvaro, confía en el Señor con todo tu corazón y no te apoyes en tu propia prudencia.",
  "Álvaro, este es el día que hizo el Señor. Alégrense y gócense en él. Aprovechalo al máximo.",
  "Álvaro, pon todo en sus manos. Él cuida de ti. Avanzá con paz y propósito hoy.",
];

// ─── VERSÍCULOS DIARIOS (base Salmos 119) ────────────────────────────────────
const VERSICULOS_BASE = [
  { ref:"Sal 119:97",  texto:"¡Cuánto amo yo tu ley! Todo el día es ella mi meditación." },
  { ref:"Sal 119:105", texto:"Lámpara es a mis pies tu palabra, y lumbrera a mi camino." },
  { ref:"Fil 4:13",    texto:"Todo lo puedo en Cristo que me fortalece." },
  { ref:"Sal 119:11",  texto:"En mi corazón he guardado tus dichos, para no pecar contra ti." },
  { ref:"Rom 8:28",    texto:"Sabemos que a los que aman a Dios, todas las cosas les ayudan a bien." },
  { ref:"Sal 119:165", texto:"Mucha paz tienen los que aman tu ley, y no hay para ellos tropiezo." },
  { ref:"Prov 3:5-6",  texto:"Confía en el Señor con todo tu corazón. Él enderezará tus veredas." },
  { ref:"Sal 23:1",    texto:"El Señor es mi pastor; nada me faltará." },
  { ref:"Is 40:31",    texto:"Los que esperan en el Señor renovarán sus fuerzas." },
  { ref:"Sal 119:133", texto:"Ordena mis pasos con tu palabra, y ninguna iniquidad se enseñoree de mí." },
  { ref:"Mat 6:33",    texto:"Buscad primero el reino de Dios y su justicia, y lo demás será añadido." },
  { ref:"Sal 119:2",   texto:"Bienaventurados los que guardan sus testimonios y le buscan de todo corazón." },
];

// ─── JARVIS WAKE UP — PANTALLA SAGRADA/TECNOLÓGICA ───────────────────────────
function LoginScreen({ onLogin }) {
  const [fase, setFase]           = useState("wake");   // "wake" | "versiculo" | "ready"
  const [versiculo, setVersiculo] = useState("");
  const [mostrarInput, setMostrarInput] = useState(false);
  const [typing, setTyping]       = useState("");
  const [cargandoVers, setCargandoVers] = useState(true);
  const [msgIdx]                  = useState(() => new Date().getDate() % MENSAJES_CRISTO.length);
  const [versBase]                = useState(() => {
    const d = new Date();
    return VERSICULOS_BASE[d.getDate() % VERSICULOS_BASE.length];
  });
  const [versiculoGuardado, setVersiculoGuardado] = useState("");

  // Cargar versículo personal de hoy — Firebase primero, localStorage como fallback
  useEffect(() => {
    const d = new Date();
    const keyLocal = `versiculo_custom_${d.toISOString().slice(0,10)}`;
    const { mesId, wIdx, dIdx } = hoyVp();

    async function cargar() {
      if (firebaseOk) {
        try {
          const snap = await getDoc(doc(db, vpDayPath(mesId, wIdx, dIdx)));
          const vers = snap.exists() ? snap.data().pilares?.fe?.versiculoDelDia : "";
          if (vers) { setVersiculoGuardado(vers); setCargandoVers(false); return; }
        } catch(e) {}
      }
      try { setVersiculoGuardado(localStorage.getItem(keyLocal) || ""); } catch(e) {}
      setCargandoVers(false);
    }
    cargar();
  }, []);

  // Efecto typing para "JARVIS WAKE UP"
  useEffect(() => {
    if (fase !== "wake") return;
    const txt = "JARVIS  WAKE  UP";
    let i = 0;
    const iv = setInterval(() => {
      setTyping(txt.slice(0, i + 1));
      i++;
      if (i >= txt.length) clearInterval(iv);
    }, 80);
    return () => clearInterval(iv);
  }, [fase]);

  async function guardarVersiculo() {
    const d = new Date();
    const keyLocal = `versiculo_custom_${d.toISOString().slice(0,10)}`;
    try { localStorage.setItem(keyLocal, versiculo); } catch(e){}

    if (firebaseOk) {
      const { mesId, wIdx, dIdx } = hoyVp();
      try {
        const path = vpDayPath(mesId, wIdx, dIdx);
        const snap = await getDoc(doc(db, path));
        const pilaresActuales = snap.exists() ? snap.data().pilares || {} : {};
        const feActual = pilaresActuales.fe || {};
        await setDoc(doc(db, path), {
          pilares: { ...pilaresActuales, fe: { ...feActual, versiculoDelDia: versiculo } }
        }, { merge: true });
      } catch(e) {}
    }
    setVersiculoGuardado(versiculo);
    setMostrarInput(false);
  }

  function handleComenzar() {
    onLogin({ nombre:"Álvaro", rol:"vida", turno:"—" });
  }

  const fechaHoy = new Date().toLocaleDateString("es-AR", {
    weekday:"long", day:"numeric", month:"long", year:"numeric"
  });

  // ── FASE 1: JARVIS WAKE UP ──────────────────────────────────────────────────
  if (fase === "wake") {
    return (
      <div style={{
        minHeight:"100vh", background:"#000",
        display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        fontFamily:"'Courier New', monospace", padding:24,
        position:"relative", overflow:"hidden",
      }}>
        {/* Grid de fondo */}
        <div style={{
          position:"absolute", inset:0, opacity:.07,
          backgroundImage:"linear-gradient(#C9A84C 1px, transparent 1px), linear-gradient(90deg, #C9A84C 1px, transparent 1px)",
          backgroundSize:"40px 40px",
          pointerEvents:"none",
        }}/>
        {/* Glow central */}
        <div style={{
          position:"absolute", width:320, height:320,
          background:"radial-gradient(circle, #C9A84C22 0%, transparent 70%)",
          borderRadius:"50%", top:"50%", left:"50%",
          transform:"translate(-50%,-50%)",
          pointerEvents:"none",
        }}/>

        {/* Cruz minimalista */}
        <div style={{position:"relative", marginBottom:32}}>
          <div style={{width:2, height:60, background:"linear-gradient(to bottom, transparent, #C9A84C, transparent)", margin:"0 auto"}}/>
          <div style={{width:36, height:2, background:"linear-gradient(to right, transparent, #C9A84C, transparent)", margin:"-30px auto 0"}}/>
        </div>

        {/* Typing effect */}
        <div style={{
          fontSize:28, fontWeight:700, letterSpacing:8,
          color:"#C9A84C", textAlign:"center", minHeight:40,
          textShadow:"0 0 30px #C9A84C88",
        }}>
          {typing}
          <span style={{opacity: typing.length < 16 ? 1 : 0, transition:"opacity .3s"}}>▋</span>
        </div>

        <div style={{
          fontSize:11, color:"#555", letterSpacing:4,
          marginTop:12, textAlign:"center",
        }}>
          SISTEMA ACTIVO · {fechaHoy.toUpperCase()}
        </div>

        {/* Botón continuar — aparece después del typing */}
        <div style={{
          marginTop:48,
          opacity: typing.length >= 16 ? 1 : 0,
          pointerEvents: typing.length >= 16 ? "auto" : "none",
          transition:"opacity .8s",
          position:"relative",
          zIndex:10,
        }}>
          <button
            type="button"
            onClick={() => setFase("versiculo")}
            style={{
              background:G.goldDim, border:`1px solid ${G.gold}88`,
              color:G.gold, fontSize:13, letterSpacing:3,
              padding:"14px 36px", borderRadius:2, cursor:"pointer",
              fontFamily:"'Courier New', monospace",
              transition:"background .2s, border-color .2s",
              WebkitTapHighlightColor:"transparent",
              touchAction:"manipulation",
              userSelect:"none",
              position:"relative",
              zIndex:10,
              minWidth:160,
              minHeight:48,
            }}
            onMouseOver={e=>{e.currentTarget.style.background=G.goldMid; e.currentTarget.style.borderColor=G.gold;}}
            onMouseOut={e=>{e.currentTarget.style.background=G.goldDim; e.currentTarget.style.borderColor=`${G.gold}88`;}}>
            INICIAR ›
          </button>
        </div>

        {/* Línea inferior */}
        <div style={{position:"absolute", bottom:24, fontSize:9, color:"#333", letterSpacing:2}}>
          UN NUEVO COMIENZO · TAPAS 2 · 14.06.2026
        </div>
      </div>
    );
  }

  // ── FASE 2: VERSÍCULO + MENSAJE ─────────────────────────────────────────────
  if (fase === "versiculo") {
    const versHoy = versiculoGuardado || versBase.texto;
    const refHoy  = versiculoGuardado ? "— Mi versículo de hoy" : `— ${versBase.ref}`;

    return (
      <div style={{
        minHeight:"100vh",
        background:"linear-gradient(160deg, #0a0a0a 0%, #0f0c00 50%, #0a0a0a 100%)",
        display:"flex", flexDirection:"column",
        fontFamily:"system-ui, sans-serif", position:"relative", overflow:"hidden",
      }}>
        {/* Partículas decorativas */}
        {[...Array(6)].map((_,i) => (
          <div key={i} style={{
            position:"absolute",
            width: i%2===0 ? 1 : 2,
            height: [80,120,60,100,90,70][i],
            background:`linear-gradient(to bottom, transparent, #C9A84C${["44","33","55","22","44","33"][i]}, transparent)`,
            left:`${[8,20,40,60,78,92][i]}%`,
            top:`${[10,30,15,60,20,45][i]}%`,
            borderRadius:1,
          }}/>
        ))}

        {/* Contenido */}
        <div style={{flex:1, display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center", padding:"32px 24px"}}>

          {/* Símbolo */}
          <div style={{marginBottom:20, textAlign:"center"}}>
            <div style={{
              width:56, height:56, borderRadius:"50%",
              border:"1px solid #C9A84C55",
              display:"flex", alignItems:"center", justifyContent:"center",
              margin:"0 auto 12px",
              background:"radial-gradient(circle, #C9A84C18, transparent)",
              boxShadow:"0 0 20px #C9A84C22",
            }}>
              <span style={{fontSize:22}}>✝</span>
            </div>
            <div style={{fontSize:9, color:"#C9A84C88", letterSpacing:4}}>
              {fechaHoy.toUpperCase()}
            </div>
          </div>

          {/* Versículo del día */}
          <div style={{
            maxWidth:360, width:"100%",
            border:"1px solid #C9A84C33",
            borderRadius:2,
            background:"#C9A84C08",
            padding:"20px 20px 16px",
            marginBottom:20,
            position:"relative",
          }}>
            {/* Comillas decorativas */}
            <div style={{
              position:"absolute", top:-14, left:16,
              fontSize:40, color:"#C9A84C44",
              fontFamily:"Georgia, serif", lineHeight:1,
            }}>"</div>

            <p style={{
              fontSize:15, lineHeight:1.7, color:"#e8e0cc",
              textAlign:"center", margin:"8px 0 12px",
              fontStyle:"italic", fontWeight:300,
            }}>
              {versHoy}
            </p>
            <div style={{
              fontSize:10, color:"#C9A84C", letterSpacing:2,
              textAlign:"right", fontStyle:"normal",
            }}>
              {refHoy}
            </div>

            {/* Botón editar */}
            {!cargandoVers && (
              <button onClick={() => { setVersiculo(versiculoGuardado); setMostrarInput(v => !v); }}
                style={{
                  display:"block", margin:"10px auto 0",
                  fontSize:10, color:"#C9A84C88", background:"none",
                  border:"1px solid #C9A84C33", borderRadius:2,
                  padding:"4px 12px", cursor:"pointer",
                  letterSpacing:1, fontFamily:"inherit",
                }}>
                {mostrarInput ? "CANCELAR" : versiculoGuardado ? "EDITAR VERSÍCULO" : "ESCRIBIR VERSÍCULO DE HOY"}
              </button>
            )}

            {/* Input de versículo */}
            {mostrarInput && (
              <div style={{marginTop:12}}>
                <textarea
                  value={versiculo}
                  onChange={e => setVersiculo(e.target.value)}
                  placeholder="Escribí el versículo que el Señor puso en tu corazón hoy..."
                  style={{
                    width:"100%", boxSizing:"border-box",
                    background:"#0a0a0a", border:"1px solid #C9A84C44",
                    color:"#e8e0cc", borderRadius:2, padding:"10px",
                    fontSize:13, fontStyle:"italic", lineHeight:1.6,
                    resize:"none", height:80, outline:"none",
                    fontFamily:"inherit",
                  }}
                />
                <button onClick={guardarVersiculo}
                  style={{
                    width:"100%", marginTop:6, padding:"8px",
                    background:"#C9A84C", color:"#000",
                    border:"none", borderRadius:2, cursor:"pointer",
                    fontSize:11, letterSpacing:2, fontWeight:600,
                  }}>
                  GUARDAR
                </button>
              </div>
            )}
          </div>

          {/* Mensaje motivacional */}
          <div style={{
            maxWidth:360, width:"100%",
            padding:"16px 20px",
            marginBottom:28,
            textAlign:"center",
          }}>
            <div style={{
              fontSize:9, color:"#C9A84C", letterSpacing:3,
              marginBottom:10,
            }}>
              MENSAJE DE HOY
            </div>
            <p style={{
              fontSize:14, lineHeight:1.8, color:"#ccc",
              margin:0, fontWeight:300,
            }}>
              {MENSAJES_CRISTO[msgIdx]}
            </p>
          </div>

          {/* Botón COMENZAR */}
          <button onClick={handleComenzar}
            style={{
              width:"100%", maxWidth:300,
              padding:"16px",
              background:"linear-gradient(135deg, #C9A84C, #A8843C)",
              border:"none", borderRadius:2,
              color:"#000", fontSize:14,
              fontWeight:700, letterSpacing:4,
              cursor:"pointer",
              boxShadow:"0 0 30px #C9A84C44",
              fontFamily:"inherit",
              transition:"all .2s",
            }}
            onMouseOver={e=>e.target.style.boxShadow="0 0 50px #C9A84C77"}
            onMouseOut={e=>e.target.style.boxShadow="0 0 30px #C9A84C44"}>
            COMENZAR
          </button>

          <div style={{
            fontSize:9, color:"#333", letterSpacing:3,
            marginTop:20, textAlign:"center",
          }}>
            UN NUEVO COMIENZO · TAPAS 2
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ─── IMPORTS EXTRA PARA VIDA PERSONAL ───────────────────────────────────────
// getDoc ya importado, agregar si falta:
// ═══════════════════════════════════════════════════════════════════════════════
// MÓDULO: VIDA PERSONAL — "UN NUEVO COMIENZO" (TAPAS 2)
// Registro diario por semanas + resumen mensual 2026
// Colección Firestore: vida_personal/{mesId}/semanas/semana_{N}/dias/dia_{D}
// ═══════════════════════════════════════════════════════════════════════════════

// ── Paleta unificada — negro/dorado, un tono dorado distinto por pilar ────────
const VP_C = {
  fe:       { bg:"#0f0c00", border:"#C9A84C", text:"#C9A84C", dot:"#C9A84C", dim:"#C9A84C22", emoji:"✝️"  },
  trading:  { bg:"#001a0f", border:"#7AB85A", text:"#7AB85A", dot:"#7AB85A", dim:"#7AB85A22", emoji:"📈"  },
  hogar:    { bg:"#00091a", border:"#6FA3D4", text:"#6FA3D4", dot:"#6FA3D4", dim:"#6FA3D422", emoji:"🏠"  },
  fitness:  { bg:"#1a0500", border:"#C9724C", text:"#C9724C", dot:"#C9724C", dim:"#C9724C22", emoji:"🏋️"  },
  nutricion:{ bg:"#1a1000", border:"#D4A35C", text:"#D4A35C", dot:"#D4A35C", dim:"#D4A35C22", emoji:"🍗"  },
  vision:   { bg:"#0d0014", border:"#A07AC9", text:"#A07AC9", dot:"#A07AC9", dim:"#A07AC922", emoji:"🃏"  },
};

// ── 6 Pilares ─────────────────────────────────────────────────────────────────
const VP_PILARES = [
  { id:"fe", label:"Fe & Propósito", color:VP_C.fe, habitos:[
    { id:"jarvis",    label:"Jarvis Wake Up completado" },
    { id:"versiculo", label:"Meditación Salmos 119:97" },
    { id:"intencion", label:"Intención del día definida" },
  ], notaLabel:"Palabra o frase de meditación de hoy" },

  { id:"trading", label:"Finanzas & Trading", color:VP_C.trading, habitos:[
    { id:"mercado",   label:"Revisé el mercado antes de operar" },
    { id:"opere",     label:"Operación planificada ejecutada" },
    { id:"registro",  label:"Registré resultado / aprendizaje" },
    { id:"efectivo",  label:"Gestioné ingreso de efectivo (si corresponde)" },
  ], notaLabel:"Resultado o aprendizaje del día en trading", esTrading:true },

  { id:"hogar", label:"Hogar & Orden", color:VP_C.hogar, habitos:[
    { id:"orden_am",  label:"Ordené y limpié el espacio al levantarme" },
    { id:"heladera",  label:"Revisé heladera / stock de alimentos" },
    { id:"prep_manana",label:"Preparé el entorno para mañana" },
  ], notaLabel:"Tarea de hogar completada o pendiente hoy" },

  { id:"fitness", label:"Fitness", color:VP_C.fitness, habitos:[
    { id:"wod",        label:"Completé sesión de CrossFit / WOD" },
    { id:"hidratacion",label:"Hidratación adecuada durante el día" },
  ], notaLabel:"Cómo fue el entrenamiento / cómo me sentí", esFitness:true },

  { id:"nutricion", label:"Nutrición", color:VP_C.nutricion, habitos:[
    { id:"desayuno",   label:"Desayuno: avena + leche + banana + huevos" },
    { id:"tupper1",    label:"Tupper 1 (almuerzo) comido" },
    { id:"tupper2",    label:"Tupper 2 (cena) comido" },
  ], notaLabel:"Cómo fue la alimentación del día", esNutricion:true },

  { id:"vision", label:'"El Loco" — Visión', color:VP_C.vision, habitos:[
    { id:"accion",     label:"Realicé al menos UNA acción hacia mi visión" },
    { id:"gratitud",   label:"Escribí 1 cosa por la que estoy agradecido" },
    { id:"foco",       label:"No postergué lo importante por lo urgente" },
  ], notaLabel:"La acción más importante que hice hoy" },
];

// ── Tuppers ───────────────────────────────────────────────────────────────────
const VP_TUPPERS = {
  base:          { label:"Almuerzo estándar (entreno)", pollo:300, papa:200, verduras:150, huevo:1, kcal:620, prot:72 },
  almuerzo_desc: { label:"Almuerzo reducido (descanso)", pollo:250, papa:150, verduras:130, huevo:1, kcal:540, prot:61 },
  cena_entreno:  { label:"Cena estándar (entreno)",    pollo:250, papa:200, verduras:150, huevo:2, kcal:600, prot:67 },
  cena_descanso: { label:"Cena reducida (descanso)",   pollo:220, papa:100, verduras:130, huevo:2, kcal:500, prot:58 },
};
const VP_DESAYUNO = { avena:70, leche:250, banana:120, huevos:3, kcal:520, prot:32 };

// ═══════════════════════════════════════════════════════════════════════════════
// BASE DE EJERCICIOS — CrossFit (WOD) + Fuerza (rutina fija)
// ═══════════════════════════════════════════════════════════════════════════════
// tipo: "tiempo" (for time), "amrap" (rondas+reps), "fuerza" (peso x reps)
const VP_EJERCICIOS_CROSSFIT = [
  // Movimientos olímpicos / barra
  { id:"clean",          label:"Clean",                 unidad:"kg" },
  { id:"power_clean",    label:"Power Clean",            unidad:"kg" },
  { id:"clean_jerk",     label:"Clean & Jerk",           unidad:"kg" },
  { id:"snatch",         label:"Snatch",                 unidad:"kg" },
  { id:"power_snatch",   label:"Power Snatch",           unidad:"kg" },
  { id:"thruster",       label:"Thruster",                unidad:"kg" },
  { id:"front_squat",    label:"Front Squat",             unidad:"kg" },
  { id:"overhead_squat",  label:"Overhead Squat",          unidad:"kg" },
  { id:"push_press",     label:"Push Press",               unidad:"kg" },
  { id:"push_jerk",      label:"Push Jerk",                 unidad:"kg" },
  { id:"deadlift",       label:"Deadlift",                   unidad:"kg" },
  { id:"sumo_deadlift_hp",label:"Sumo Deadlift High Pull",     unidad:"kg" },
  // Gimnásticos
  { id:"pull_up",        label:"Pull-up",                unidad:"reps" },
  { id:"chest_to_bar",   label:"Chest-to-Bar",           unidad:"reps" },
  { id:"muscle_up",      label:"Muscle-up",              unidad:"reps" },
  { id:"toes_to_bar",    label:"Toes-to-Bar",            unidad:"reps" },
  { id:"push_up",        label:"Push-up",                unidad:"reps" },
  { id:"hspu",           label:"Handstand Push-up",       unidad:"reps" },
  { id:"handstand_walk", label:"Handstand Walk",         unidad:"m" },
  { id:"ring_dip",       label:"Ring Dip",                unidad:"reps" },
  { id:"pistol",         label:"Pistol Squat",           unidad:"reps" },
  { id:"burpee",         label:"Burpee",                  unidad:"reps" },
  { id:"burpee_box_jump",label:"Burpee Box Jump-over",     unidad:"reps" },
  { id:"box_jump",       label:"Box Jump",                unidad:"reps" },
  { id:"wall_ball",      label:"Wall Ball",               unidad:"kg" },
  { id:"kb_swing",       label:"KB Swing",                unidad:"kg" },
  { id:"double_under",   label:"Double Under",            unidad:"reps" },
  { id:"row",            label:"Row (cal/m)",             unidad:"cal" },
  { id:"bike",           label:"Bike (cal)",              unidad:"cal" },
  { id:"run",            label:"Run",                     unidad:"m" },
  { id:"air_squat",      label:"Air Squat",               unidad:"reps" },
  { id:"sit_up",         label:"Sit-up",                  unidad:"reps" },
  { id:"gtoh",           label:"Ground to Overhead",      unidad:"kg" },
  // WODs nombrados (benchmarks clásicos)
  { id:"wod_fran",       label:"Fran (21-15-9 Thruster/Pull-up)", unidad:"tiempo" },
  { id:"wod_grace",      label:"Grace (30 Clean & Jerk)",         unidad:"tiempo" },
  { id:"wod_helen",      label:"Helen (3RD Run/KB/Pull-up)",      unidad:"tiempo" },
  { id:"wod_diane",      label:"Diane (21-15-9 Deadlift/HSPU)",   unidad:"tiempo" },
  { id:"wod_amanda",     label:"Amanda (9-7-5 MU/Snatch)",        unidad:"tiempo" },
  { id:"wod_murph",      label:"Murph (Run+Pull/Push/Squat+Run)", unidad:"tiempo" },
  { id:"wod_cindy",      label:"Cindy (AMRAP Pull/Push/Squat)",   unidad:"amrap" },
  { id:"wod_mary",       label:"Mary (AMRAP HSPU/Pistol/Pull-up)",unidad:"amrap" },
  { id:"otro_wod",       label:"Otro WOD / personalizado",        unidad:"libre" },
];

const VP_EJERCICIOS_FUERZA = [
  { id:"sentadilla",       label:"Sentadilla (Back Squat)",  unidad:"kg" },
  { id:"sentadilla_frontal",label:"Sentadilla Frontal",       unidad:"kg" },
  { id:"press_banca",      label:"Press de Banca",           unidad:"kg" },
  { id:"press_militar",    label:"Press Militar",            unidad:"kg" },
  { id:"peso_muerto",      label:"Peso Muerto",               unidad:"kg" },
  { id:"peso_muerto_rumano",label:"Peso Muerto Rumano",        unidad:"kg" },
  { id:"remo_barra",       label:"Remo con Barra",            unidad:"kg" },
  { id:"dominadas_lastre", label:"Dominadas con Lastre",       unidad:"kg" },
  { id:"hip_thrust",       label:"Hip Thrust",                 unidad:"kg" },
  { id:"zancadas",         label:"Zancadas (Lunges)",          unidad:"kg" },
];

// ── Paths Firestore — registros y logros (globales, no atados a un día) ──────
function vpEjercicioPath(ejercicioId) {
  return `vida_personal/_ejercicios/historial/${ejercicioId}`;
}
function vpLogrosPath() {
  return `vida_personal/_logros/lista/actual`;
}

// ── Trofeos — catálogo visual por categoría ───────────────────────────────────
const VP_TROFEOS = {
  peso:    { emoji:"🏆", color:"#C9A84C", label:"Récord de Peso" },
  tiempo:  { emoji:"⏱️", color:"#6FA3D4", label:"Récord de Tiempo" },
  reps:    { emoji:"🔥", color:"#C9724C", label:"Récord de Reps" },
  rondas:  { emoji:"🌀", color:"#A07AC9", label:"Récord de Rondas" },
  fe:      { emoji:"✝️", color:"#C9A84C", label:"Hito de Fe" },
  manual:  { emoji:"⭐", color:"#7AB85A", label:"Logro Personal" },
};

// Convierte "MM:SS" a segundos para comparar tiempos (menor = mejor)
function vpTiempoASegundos(str) {
  if (!str) return null;
  const m = str.match(/^(\d+):(\d{1,2})$/);
  if (m) return parseInt(m[1])*60 + parseInt(m[2]);
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
}

// Compara marca nueva vs mejor histórica y determina si es PR
// tipoMejor: "mayor" (peso/reps/rondas, más es mejor) o "menor" (tiempo, menos es mejor)
function vpEsRecordPersonal(valorNuevo, mejorAnterior, tipoMejor) {
  if (valorNuevo == null || isNaN(valorNuevo)) return false;
  if (mejorAnterior == null) return true; // primera carga = siempre logro
  return tipoMejor === "menor" ? valorNuevo < mejorAnterior : valorNuevo > mejorAnterior;
}

function vpFormatoFechaHora(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"}) +
    " · " + d.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
}

function vpDayPath(mesId, wIdx, dIdx) {
  return `vida_personal/${mesId}/semanas/semana_${wIdx+1}/dias/dia_${dIdx}`;
}

// ── Mapeo fecha real ↔ {mesId, wIdx, dIdx} ────────────────────────────────────
// Convención: Semana 1 = días 1-7 del mes, Semana 2 = días 8-14, etc.
// dIdx 0=Lunes...6=Domingo (alineado a DIAS), usando el día de calendario real.
const MESES_ID = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

function fechaAVp(fecha) {
  const dia = fecha.getDate();             // 1-31
  const wIdx = Math.min(3, Math.floor((dia - 1) / 7)); // semana 1-4 (clamp semana 5+ a la 4)
  // getDay(): 0=Domingo..6=Sábado → convertir a 0=Lunes..6=Domingo
  const dowRaw = fecha.getDay();
  const dIdx = dowRaw === 0 ? 6 : dowRaw - 1;
  const mesId = `${MESES_ID[fecha.getMonth()]}_${fecha.getFullYear()}`;
  return { mesId, wIdx, dIdx };
}

function hoyVp() {
  return fechaAVp(new Date());
}

function vpVersiculoPath(mesId, wIdx, dIdx) {
  return `vida_personal/${mesId}/semanas/semana_${wIdx+1}/dias/dia_${dIdx}`;
}

// ── Lista de compras — transversal, no pertenece a un día ni a un pilar ──────
function vpComprasPath() {
  return `vida_personal/_compras/lista/actual`;
}

// ── Stock de alimentos — se alimenta automáticamente desde Compras ──────────
function vpStockPath() {
  return `vida_personal/_stock/items/actual`;
}

// ── Recetas — base de platos con ingredientes e info nutricional ────────────
function vpRecetasPath() {
  return `vida_personal/_recetas/lista/actual`;
}

// ── Tuppers preparados — historial de lo que salió de Cocina, listo para comer ──
function vpTuppersPreparadosPath() {
  return `vida_personal/_tuppers/preparados/actual`;
}

// Unidades de medida disponibles para Stock/Compras
const VP_UNIDADES = [
  { id:"kg", label:"Kg" },
  { id:"u",  label:"U." },
  { id:"lts",label:"Lts" },
];

// Normaliza el nombre de un producto para agruparlo en Stock
// (ignora mayúsculas/espacios extra, así "Tomate" y "tomate " son el mismo item)
function vpNormalizarNombre(texto) {
  return texto.trim().toLowerCase().replace(/\s+/g," ");
}

// Sectores de compra que efectivamente alimentan el Stock de alimentos
// (Auto y Pendientes no son comida, así que no impactan en Stock/Nutrición)
const VP_SECTORES_ALIMENTO = ["verduleria","carniceria","supermercado"];

// ═══════════════════════════════════════════════════════════════════════════════
// TABLA NUTRICIONAL BASE — valores por 100g en crudo/fresco
// Fuente: TABLA_NUTRICIONAL.xlsx (plan nutricional personal)
// Se usa para auto-calcular kcal/carbs/prot/grasas de cualquier receta
// ═══════════════════════════════════════════════════════════════════════════════
const VP_TABLA_NUTRICIONAL = [
  { nombre:"Pechuga de Pollo (sin piel)", prot:23,   kcal:110, carbs:0,    grasas:1  },
  { nombre:"Lomo / Solomillo Vacuno",      prot:22,   kcal:135, carbs:0,    grasas:5  },
  { nombre:"Lomo de Cerdo",                prot:22,   kcal:145, carbs:0,    grasas:6  },
  { nombre:"Solomillo de Cerdo",           prot:21,   kcal:120, carbs:0,    grasas:4  },
  { nombre:"Carne picada (magra 5%)",      prot:21,   kcal:150, carbs:0,    grasas:5  },
  { nombre:"Pechuga de Pollo (con piel)",  prot:20,   kcal:170, carbs:0,    grasas:9  },
  { nombre:"Bife de Chorizo / Entrecot",   prot:20,   kcal:220, carbs:0,    grasas:15 },
  { nombre:"Muslo de Pollo (sin piel)",    prot:19,   kcal:160, carbs:0,    grasas:9  },
  { nombre:"Chuleta de Cerdo",             prot:19,   kcal:200, carbs:0,    grasas:12 },
  { nombre:"Alitas de Pollo (con piel)",   prot:18,   kcal:200, carbs:0,    grasas:15 },
  { nombre:"Tira de asado / Costilla",     prot:17,   kcal:280, carbs:0,    grasas:25 },
  { nombre:"Huevo",                        prot:13,   kcal:155, carbs:0,    grasas:11 },
  { nombre:"Panceta / Tocino",             prot:9,    kcal:540, carbs:0,    grasas:50 },
  { nombre:"Champiñones / Setas",          prot:3.1,  kcal:22,  carbs:3,    grasas:0  },
  { nombre:"Espinacas",                    prot:2.9,  kcal:23,  carbs:3.6,  grasas:0  },
  { nombre:"Brócoli",                      prot:2.8,  kcal:34,  carbs:7,    grasas:0  },
  { nombre:"Espárragos",                   prot:2.2,  kcal:20,  carbs:4,    grasas:0  },
  { nombre:"Papa",                         prot:2.0,  kcal:77,  carbs:17,   grasas:0  },
  { nombre:"Coliflor",                     prot:1.9,  kcal:25,  carbs:5,    grasas:0  },
  { nombre:"Zapallito verde (Calabacín)",  prot:1.2,  kcal:17,  carbs:3,    grasas:0  },
  { nombre:"Cebolla",                      prot:1.1,  kcal:40,  carbs:9,    grasas:0  },
  { nombre:"Morrón (Pimiento)",            prot:1.0,  kcal:20,  carbs:5,    grasas:0  },
  { nombre:"Banana",                       prot:1.1,  kcal:89,  carbs:23,   grasas:0  },
  { nombre:"Naranja",                      prot:0.9,  kcal:47,  carbs:12,   grasas:0  },
  { nombre:"Frutillas (Fresas)",           prot:0.7,  kcal:32,  carbs:8,    grasas:0  },
  { nombre:"Pera",                         prot:0.4,  kcal:57,  carbs:15,   grasas:0  },
  { nombre:"Manzana",                      prot:0.3,  kcal:52,  carbs:14,   grasas:0  },
  // Adicionales del sistema de tuppers (no estaban en la tabla, valores estándar)
  { nombre:"Avena",                        prot:13,   kcal:389, carbs:66,   grasas:7  },
  { nombre:"Leche entera",                 prot:3.2,  kcal:61,  carbs:4.8,  grasas:3.3},
  { nombre:"Verduras mix",                 prot:2,    kcal:30,  carbs:5,    grasas:0  },
];

// Sinónimos comunes para mejorar el matching (clave: lo que escribís → valor: nombre en la tabla)
const VP_SINONIMOS_NUTRICION = {
  "pollo":"Pechuga de Pollo (sin piel)", "pechuga de pollo":"Pechuga de Pollo (sin piel)",
  "carne":"Lomo / Solomillo Vacuno", "carne picada":"Carne picada (magra 5%)",
  "huevos":"Huevo", "huevo":"Huevo",
  "papa":"Papa", "papas":"Papa", "patata":"Papa", "patatas":"Papa",
  "verdura":"Verduras mix", "verduras":"Verduras mix",
  "banana":"Banana", "bananas":"Banana",
  "avena":"Avena",
  "leche":"Leche entera",
  "cebolla":"Cebolla", "cebollas":"Cebolla",
  "morron":"Morrón (Pimiento)", "morrón":"Morrón (Pimiento)", "pimiento":"Morrón (Pimiento)",
  "brocoli":"Brócoli", "brócoli":"Brócoli",
};

// Busca el alimento más parecido en la tabla nutricional (match exacto → sinónimo → substring)
function vpBuscarAlimento(nombreIngrediente) {
  const key = vpNormalizarNombre(nombreIngrediente);
  // 1. Match exacto
  let match = VP_TABLA_NUTRICIONAL.find(a => vpNormalizarNombre(a.nombre)===key);
  if (match) return match;
  // 2. Sinónimo directo
  if (VP_SINONIMOS_NUTRICION[key]) {
    match = VP_TABLA_NUTRICIONAL.find(a => a.nombre===VP_SINONIMOS_NUTRICION[key]);
    if (match) return match;
  }
  // 3. Substring — el ingrediente contiene o está contenido en el nombre de la tabla
  match = VP_TABLA_NUTRICIONAL.find(a => {
    const an = vpNormalizarNombre(a.nombre);
    return an.includes(key) || key.includes(an.split(" (")[0]);
  });
  return match || null;
}

// Calcula la info nutricional de un ingrediente según su cantidad real (no 100g)
// unidad "kg" → cantidad en kg, se convierte a gramos para el cálculo (base es por 100g)
// unidad "u" → unidad, intenta asumir un peso promedio razonable; "lts" → asume como kg
function vpCalcularNutricionIngrediente(nombreIngrediente, cantidad, unidad) {
  const alimento = vpBuscarAlimento(nombreIngrediente);
  if (!alimento || cantidad == null) return null;

  let gramos;
  if (unidad === "kg" || unidad === "lts") gramos = cantidad * 1000;
  else gramos = cantidad * 100; // unidades sueltas (ej: huevos) — aproximación 100g c/u

  const factor = gramos / 100;
  return {
    kcal: alimento.kcal * factor,
    carbs: alimento.carbs * factor,
    prot: alimento.prot * factor,
    grasas: alimento.grasas * factor,
    encontrado: true,
    alimentoUsado: alimento.nombre,
  };
}

// ── Notas persistentes por pilar — viven fuera del día, no se pisan ─────────
// Cada pilar tiene su propia colección de notas (texto + fecha), independiente
// del registro diario de hábitos. Sirven para recordar cosas entre días.
function vpNotasPath(pilarId) {
  return `vida_personal/_notas/${pilarId}/lista`;
}

// ── Calcular racha de días consecutivos con al menos 1 hábito marcado ────────
// Recorre hacia atrás desde hoy. Se detiene en el primer día sin registro o sin
// ningún hábito del pilar marcado. Tope de búsqueda: 90 días, para no disparar
// cientos de lecturas si nunca se registró nada.
async function calcularRacha(pilarId) {
  if (!firebaseOk) return 0;
  let racha = 0;
  let cursor = new Date();
  for (let i = 0; i < 90; i++) {
    const { mesId, wIdx, dIdx } = fechaAVp(cursor);
    try {
      const snap = await getDoc(doc(db, vpDayPath(mesId, wIdx, dIdx)));
      if (!snap.exists()) break;
      const pilares = snap.data().pilares || {};
      const habitos = pilares[pilarId]?.habitos || {};
      const comp = Object.values(habitos).filter(Boolean).length;
      if (comp === 0) break;
      racha++;
      cursor.setDate(cursor.getDate() - 1);
    } catch(e) { break; }
  }
  return racha;
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTAS PERSISTENTES POR PILAR — agregar, editar, eliminar. No se pisan entre días.
// Viven en su propio documento Firebase (independiente del registro diario),
// así que una nota de hace 3 semanas sigue ahí hasta que la borres a propósito.
// ═══════════════════════════════════════════════════════════════════════════════
function VpNotasPilar({ pilar }) {
  const c = pilar.color;
  const [notas, setNotas]   = useState([]); // [{ id, texto, fecha }]
  const [nuevo, setNuevo]   = useState("");
  const [editId, setEditId] = useState(null);
  const [editTxt, setEditTxt] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("idle");

  useEffect(() => {
    if (!firebaseOk) { setLoading(false); return; }
    getDoc(doc(db, vpNotasPath(pilar.id))).then(snap => {
      setNotas(snap.exists() ? snap.data().notas || [] : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [pilar.id]);

  async function persistir(nuevaLista) {
    setNotas(nuevaLista);
    if (!firebaseOk) return;
    setSaveStatus("saving");
    try {
      await setDoc(doc(db, vpNotasPath(pilar.id)), { notas: nuevaLista });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1500);
    } catch(e) { setSaveStatus("error"); }
  }

  function agregar() {
    const texto = nuevo.trim();
    if (!texto) return;
    const item = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      texto,
      fecha: new Date().toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit",year:"2-digit"}),
    };
    persistir([item, ...notas]); // más reciente arriba
    setNuevo("");
  }

  function empezarEdicion(n) {
    setEditId(n.id);
    setEditTxt(n.texto);
  }

  function guardarEdicion() {
    const texto = editTxt.trim();
    if (!texto) { setEditId(null); return; }
    persistir(notas.map(n => n.id===editId ? { ...n, texto } : n));
    setEditId(null);
  }

  function eliminar(id) {
    persistir(notas.filter(n => n.id !== id));
    if (editId === id) setEditId(null);
  }

  return (
    <div style={{border:`1px solid ${G.border}`,borderRadius:4,padding:"12px",background:G.surf,marginBottom:8}}>
      <div onClick={() => setAbierto(v => !v)}
        style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}>
        <div style={{fontSize:9,color:G.gold,letterSpacing:2}}>
          NOTAS GUARDADAS {notas.length > 0 && `(${notas.length})`}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {saveStatus==="saving" && (
            <span style={{fontSize:9,color:G.gold,letterSpacing:.5}}>GUARDANDO…</span>
          )}
          <span style={{fontSize:11,color:G.textDim,transform:abierto?"rotate(90deg)":"none",
            transition:"transform .2s",display:"inline-block"}}>›</span>
        </div>
      </div>

      {abierto && (
        <div style={{marginTop:10}}>
          {/* Agregar nota nueva */}
          <div style={{display:"flex",gap:6,marginBottom:10}}>
            <input value={nuevo} onChange={e=>setNuevo(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&agregar()}
              placeholder="Nueva nota para recordar..."
              style={{...S.inp(false),fontFamily:"system-ui,sans-serif"}}/>
            <button onClick={agregar}
              style={{padding:"8px 14px",borderRadius:3,background:c.dot,
                border:"none",color:G.bg,fontSize:16,cursor:"pointer",fontWeight:700,lineHeight:1}}>
              +
            </button>
          </div>

          {loading ? (
            <div style={{fontSize:10,color:G.textDim,textAlign:"center",padding:10,letterSpacing:1}}>
              CARGANDO...
            </div>
          ) : notas.length === 0 ? (
            <div style={{fontSize:11,color:G.textDim,textAlign:"center",padding:14,fontFamily:"system-ui,sans-serif"}}>
              Sin notas guardadas todavía. Agregá la primera arriba.
            </div>
          ) : (
            notas.map(n => (
              <div key={n.id}
                style={{border:`1px solid ${c.border}33`,borderRadius:3,padding:"9px 10px",
                  marginBottom:5,background:c.bg}}>
                {editId === n.id ? (
                  <div>
                    <textarea value={editTxt} onChange={e=>setEditTxt(e.target.value)}
                      autoFocus
                      style={{...S.inp(false),height:56,resize:"none",fontFamily:"system-ui,sans-serif",marginBottom:6}}/>
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={guardarEdicion}
                        style={{flex:1,padding:"6px",borderRadius:3,background:c.dot,
                          border:"none",color:G.bg,fontSize:11,fontWeight:700,cursor:"pointer"}}>
                        Guardar
                      </button>
                      <button onClick={()=>setEditId(null)}
                        style={{flex:1,padding:"6px",borderRadius:3,background:G.surf2,
                          border:`1px solid ${G.border}`,color:G.textSec,fontSize:11,cursor:"pointer"}}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,color:c.text,lineHeight:1.5,fontFamily:"system-ui,sans-serif",
                        wordBreak:"break-word"}}>
                        {n.texto}
                      </div>
                      <div style={{fontSize:9,color:G.textDim,marginTop:4,letterSpacing:.5}}>
                        {n.fecha}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:4,flexShrink:0}}>
                      <button onClick={()=>empezarEdicion(n)}
                        style={{background:"none",border:"none",color:c.text,fontSize:13,
                          cursor:"pointer",padding:"2px 4px",opacity:.7}}>
                        ✎
                      </button>
                      <button onClick={()=>eliminar(n.id)}
                        style={{background:"none",border:"none",color:G.textDim,fontSize:15,
                          cursor:"pointer",padding:"2px 4px",lineHeight:1}}>
                        ×
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LISTA DE COMPRAS — agregar, tachar, eliminar. Transversal a los 5 pilares.
// ═══════════════════════════════════════════════════════════════════════════════
// ── Sectores de compras ────────────────────────────────────────────────────
const VP_SECTORES_COMPRA = [
  { id:"verduleria",   label:"Verdulería",    emoji:"🥦", color:"#7AB85A" },
  { id:"carniceria",   label:"Carnicería",    emoji:"🥩", color:"#C9724C" },
  { id:"supermercado", label:"Supermercado",  emoji:"🛒", color:"#6FA3D4" },
  { id:"auto",         label:"Auto",          emoji:"🚗", color:"#A07AC9" },
  { id:"pendientes",   label:"Pendientes",    emoji:"📌", color:"#C9A84C" },
];

function vpSemanaActual() {
  const d = new Date();
  const ini = new Date(d); ini.setDate(d.getDate() - d.getDay());
  ini.setHours(0,0,0,0);
  return ini.getTime();
}
function vpMesActualTs() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

function VpListaCompras({ onBack, onAbrirStock }) {
  const [items, setItems]     = useState([]); // [{ id, texto, monto, cantidad, unidad, sector, comprado, fechaComprado }]
  const [nuevo, setNuevo]     = useState("");
  const [cantidadNueva, setCantidadNueva] = useState("");
  const [unidadNueva, setUnidadNueva] = useState("kg");
  const [montoNuevo, setMontoNuevo] = useState("");
  const [sectorActivo, setSectorActivo] = useState("verduleria");
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("idle");

  useEffect(() => {
    if (!firebaseOk) { setLoading(false); return; }
    getDoc(doc(db, vpComprasPath())).then(snap => {
      setItems(snap.exists() ? snap.data().items || [] : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function persistir(nuevaLista) {
    setItems(nuevaLista);
    if (!firebaseOk) return;
    setSaveStatus("saving");
    try {
      await setDoc(doc(db, vpComprasPath()), { items: nuevaLista });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1500);
    } catch(e) { setSaveStatus("error"); }
  }

  // Suma (o crea) un producto en el Stock global, agrupado por nombre normalizado.
  // Si ya existe el producto con la misma unidad, suma cantidades y promedia precio.
  async function sumarAlStock(item) {
    if (!firebaseOk) return;
    if (!VP_SECTORES_ALIMENTO.includes(item.sector)) return; // Auto/Pendientes no son comida
    if (item.cantidad == null) return; // sin cantidad no hay nada que stockear

    try {
      const snap = await getDoc(doc(db, vpStockPath()));
      const stockActual = snap.exists() ? snap.data().items || [] : [];
      const key = vpNormalizarNombre(item.texto);
      const idx = stockActual.findIndex(s => vpNormalizarNombre(s.nombre)===key && s.unidad===item.unidad);

      let nuevoStock;
      if (idx >= 0) {
        const existente = stockActual[idx];
        const cantidadTotal = (existente.cantidad||0) + item.cantidad;
        // Precio promedio ponderado si hay monto nuevo
        let precioU = existente.precioUnitario || null;
        if (item.monto != null && item.cantidad > 0) {
          const precioNuevo = item.monto / item.cantidad;
          precioU = precioU != null
            ? ((precioU*(existente.cantidad||0)) + (precioNuevo*item.cantidad)) / cantidadTotal
            : precioNuevo;
        }
        nuevoStock = [...stockActual];
        nuevoStock[idx] = { ...existente, cantidad: cantidadTotal, precioUnitario: precioU,
          sector: item.sector, actualizado: Date.now() };
      } else {
        const precioU = (item.monto != null && item.cantidad > 0) ? item.monto/item.cantidad : null;
        nuevoStock = [...stockActual, {
          id:`${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
          nombre: item.texto, cantidad: item.cantidad, unidad: item.unidad,
          precioUnitario: precioU, sector: item.sector, actualizado: Date.now(),
        }];
      }
      await setDoc(doc(db, vpStockPath()), { items: nuevoStock });
    } catch(e) {}
  }

  function agregar() {
    const texto = nuevo.trim();
    if (!texto) return;
    const monto = montoNuevo.trim() ? parseFloat(montoNuevo.replace(",",".")) : null;
    const cantidad = cantidadNueva.trim() ? parseFloat(cantidadNueva.replace(",",".")) : null;
    const item = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      texto, monto: (monto && !isNaN(monto)) ? monto : null,
      cantidad: (cantidad && !isNaN(cantidad)) ? cantidad : null,
      unidad: unidadNueva,
      sector: sectorActivo, comprado:false, fechaComprado:null,
    };
    persistir([...items, item]);
    setNuevo(""); setMontoNuevo(""); setCantidadNueva("");
  }

  function toggleComprado(id) {
    const item = items.find(it=>it.id===id);
    if (!item) return;
    const marcandoComprado = !item.comprado;
    persistir(items.map(it => it.id===id
      ? { ...it, comprado: marcandoComprado, fechaComprado: marcandoComprado ? Date.now() : null }
      : it));
    // Al marcar como comprado, sumamos automáticamente al Stock
    if (marcandoComprado) sumarAlStock(item);
  }

  function eliminar(id) {
    persistir(items.filter(it => it.id !== id));
  }

  function limpiarComprados(sectorId) {
    persistir(items.filter(it => !(it.comprado && it.sector===sectorId)));
  }

  function editarMonto(id, valor) {
    const monto = valor.trim() ? parseFloat(valor.replace(",",".")) : null;
    persistir(items.map(it => it.id===id
      ? { ...it, monto:(monto&&!isNaN(monto))?monto:null }
      : it));
  }

  const itemsSector = items.filter(it => it.sector === sectorActivo);
  const pendientesSector = itemsSector.filter(it => !it.comprado);
  const compradosSector  = itemsSector.filter(it => it.comprado);
  const totalSector = compradosSector.reduce((a,it)=>a+(it.monto||0),0);
  const esSectorAlimento = VP_SECTORES_ALIMENTO.includes(sectorActivo);

  // KPIs globales
  const inicioSemana = vpSemanaActual();
  const inicioMes    = vpMesActualTs();
  const totalSemanal = items
    .filter(it => it.comprado && it.fechaComprado && it.fechaComprado >= inicioSemana)
    .reduce((a,it)=>a+(it.monto||0),0);
  const totalMensual = items
    .filter(it => it.comprado && it.fechaComprado && it.fechaComprado >= inicioMes)
    .reduce((a,it)=>a+(it.monto||0),0);

  // Ranking por sector — total comprado por sector (todo el tiempo)
  const rankingSectores = VP_SECTORES_COMPRA.map(s => {
    const itsS = items.filter(it => it.sector===s.id && it.comprado);
    const total = itsS.reduce((a,it)=>a+(it.monto||0),0);
    const pend  = items.filter(it=>it.sector===s.id && !it.comprado).length;
    return { ...s, total, pend, count: itsS.length };
  }).sort((a,b)=>b.total-a.total);

  const fmt = n => n.toLocaleString("es-AR",{minimumFractionDigits:0,maximumFractionDigits:2});

  return (
    <div style={{minHeight:"100vh",background:G.bg,fontFamily:"system-ui,sans-serif",
      padding:"24px 16px 56px",maxWidth:430,margin:"0 auto"}}>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
        <button onClick={onBack} style={S.btn(false,false)}>← Pilares</button>
        <div style={{flex:1,textAlign:"right",display:"flex",gap:6,justifyContent:"flex-end"}}>
          {onAbrirStock && (
            <button onClick={onAbrirStock}
              style={{fontSize:10,padding:"5px 10px",borderRadius:3,letterSpacing:.5,
                background:G.surf2,color:G.textSec,border:`1px solid ${G.border}`,
                cursor:"pointer",fontWeight:600}}>
              📦 VER STOCK
            </button>
          )}
          <span style={{fontSize:10,padding:"5px 8px",borderRadius:3,letterSpacing:.5,
            background:saveStatus==="saving"?G.goldDim:saveStatus==="saved"?G.okBg:G.surf2,
            color:saveStatus==="saving"?G.gold:saveStatus==="saved"?"#7AB85A":G.textDim,
            border:`1px solid ${G.border}`}}>
            {saveStatus==="saving"?"GUARDANDO…":saveStatus==="saved"?"✓ GUARDADO":"AUTO"}
          </span>
        </div>
      </div>

      <div style={{textAlign:"center",marginBottom:16}}>
        <div style={{fontSize:28,marginBottom:6}}>🛒</div>
        <div style={{fontSize:14,fontWeight:700,color:G.text,letterSpacing:1,fontFamily:"'Courier New',monospace"}}>
          LISTA DE COMPRAS
        </div>
      </div>

      {/* KPIs semanal / mensual */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
        <div style={{border:`1px solid ${G.border}`,borderRadius:4,padding:"12px",background:G.surf,textAlign:"center"}}>
          <div style={{fontSize:9,color:G.textDim,letterSpacing:1,marginBottom:4}}>GASTO SEMANAL</div>
          <div style={{fontSize:18,fontWeight:700,color:G.gold}}>${fmt(totalSemanal)}</div>
        </div>
        <div style={{border:`1px solid ${G.border}`,borderRadius:4,padding:"12px",background:G.surf,textAlign:"center"}}>
          <div style={{fontSize:9,color:G.textDim,letterSpacing:1,marginBottom:4}}>GASTO MENSUAL</div>
          <div style={{fontSize:18,fontWeight:700,color:G.gold}}>${fmt(totalMensual)}</div>
        </div>
      </div>

      {/* Ranking de sectores (estilo KPI) */}
      <div style={{border:`1px solid ${G.border}`,borderRadius:4,background:G.surf,
        padding:"12px",marginBottom:16}}>
        <div style={{fontSize:9,color:G.gold,letterSpacing:2,marginBottom:10}}>RANKING POR SECTOR</div>
        {rankingSectores.map((s,i) => (
          <div key={s.id} onClick={()=>setSectorActivo(s.id)}
            style={{display:"flex",alignItems:"center",gap:8,padding:"7px 8px",
              borderRadius:3,marginBottom:3,cursor:"pointer",
              border:`1px solid ${s.color}22`,background:`${s.color}11`}}>
            <span style={{fontSize:9,color:G.textDim,width:14,textAlign:"center",
              fontFamily:"'Courier New',monospace"}}>{["I","II","III","IV","V"][i]}</span>
            <span style={{fontSize:14}}>{s.emoji}</span>
            <span style={{flex:1,fontSize:11,color:G.textSec}}>{s.label}</span>
            {s.pend>0 && (
              <span style={{fontSize:9,color:G.textDim}}>{s.pend} pend.</span>
            )}
            <span style={{fontSize:12,fontWeight:700,color:s.color,minWidth:60,textAlign:"right"}}>
              ${fmt(s.total)}
            </span>
          </div>
        ))}
      </div>

      {/* Tabs de sectores */}
      <div style={{display:"flex",gap:4,marginBottom:12,overflowX:"auto"}}>
        {VP_SECTORES_COMPRA.map(s => {
          const active = sectorActivo===s.id;
          return (
            <button key={s.id} onClick={()=>setSectorActivo(s.id)}
              style={{flex:1,whiteSpace:"nowrap",padding:"8px 6px",fontSize:11,cursor:"pointer",
                border:`1px solid ${active?s.color:G.border}`,borderRadius:4,
                background:active?`${s.color}18`:G.surf2,
                color:active?s.color:G.textSec,fontWeight:active?600:400}}>
              {s.emoji} {s.label}
            </button>
          );
        })}
      </div>

      {/* Input agregar — producto + cantidad/unidad + monto */}
      <div style={{display:"flex",gap:6,marginBottom:6}}>
        <input value={nuevo} onChange={e=>setNuevo(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&agregar()}
          placeholder={`Agregar a ${VP_SECTORES_COMPRA.find(s=>s.id===sectorActivo)?.label}...`}
          style={{...S.inp(false),flex:1}}/>
        <button onClick={agregar}
          style={{padding:"8px 14px",borderRadius:3,background:G.gold,
            border:"none",color:G.bg,fontSize:18,cursor:"pointer",fontWeight:700,
            lineHeight:1}}>
          +
        </button>
      </div>
      {esSectorAlimento && (
        <div style={{display:"flex",gap:6,marginBottom:10}}>
          <input value={cantidadNueva} onChange={e=>setCantidadNueva(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&agregar()}
            placeholder="Cant." type="text" inputMode="decimal"
            style={{...S.inp(false),flex:1,textAlign:"center"}}/>
          <select value={unidadNueva} onChange={e=>setUnidadNueva(e.target.value)}
            style={{...S.inp(false),flex:1,cursor:"pointer",textAlign:"center"}}>
            {VP_UNIDADES.map(u=> <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
          <input value={montoNuevo} onChange={e=>setMontoNuevo(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&agregar()}
            placeholder="$" type="text" inputMode="decimal"
            style={{...S.inp(false),flex:1,textAlign:"right"}}/>
        </div>
      )}
      {!esSectorAlimento && (
        <div style={{marginBottom:10}}>
          <input value={montoNuevo} onChange={e=>setMontoNuevo(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&agregar()}
            placeholder="$ monto (opcional)" type="text" inputMode="decimal"
            style={S.inp(false)}/>
        </div>
      )}

      {/* Total del sector activo */}
      {compradosSector.length > 0 && (
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
          padding:"8px 12px",marginBottom:10,border:`1px solid ${G.border}`,borderRadius:4,
          background:G.surf2}}>
          <span style={{fontSize:11,color:G.textSec}}>Total comprado en este sector</span>
          <span style={{fontSize:14,fontWeight:700,color:G.gold}}>${fmt(totalSector)}</span>
        </div>
      )}

      {loading ? (
        <div style={{textAlign:"center",color:G.textDim,fontSize:11,padding:20,letterSpacing:1,
          fontFamily:"'Courier New',monospace"}}>CARGANDO...</div>
      ) : itemsSector.length === 0 ? (
        <div style={{textAlign:"center",color:G.textDim,fontSize:12,padding:30}}>
          Sin productos en este sector. Agregá el primero.
        </div>
      ) : (
        <>
          {/* Pendientes primero */}
          {pendientesSector.map(it => (
            <div key={it.id}
              style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",
                border:`1px solid ${G.border}`,borderRadius:4,marginBottom:5,background:G.surf}}>
              <div onClick={()=>toggleComprado(it.id)}
                style={{width:18,height:18,borderRadius:2,flexShrink:0,cursor:"pointer",
                  border:`1.5px solid ${G.textDim}`,background:"transparent"}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,color:G.text}}>{it.texto}</div>
                {it.cantidad!=null && (
                  <div style={{fontSize:10,color:G.textDim,marginTop:1}}>
                    {it.cantidad} {VP_UNIDADES.find(u=>u.id===it.unidad)?.label}
                  </div>
                )}
              </div>
              <input
                defaultValue={it.monto ?? ""}
                onBlur={e=>editarMonto(it.id, e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter"){ editarMonto(it.id, e.target.value); e.target.blur(); }}}
                placeholder="$" type="text" inputMode="decimal"
                style={{width:64,fontSize:12,padding:"4px 6px",textAlign:"right",
                  border:`1px solid ${G.border}`,borderRadius:3,background:G.surf2,
                  color:G.gold,outline:"none",fontFamily:"inherit"}}/>
              <button onClick={()=>eliminar(it.id)}
                style={{background:"none",border:"none",color:G.textDim,fontSize:16,
                  cursor:"pointer",padding:"0 4px",lineHeight:1}}>
                ×
              </button>
            </div>
          ))}

          {/* Comprados — tachados */}
          {compradosSector.length > 0 && (
            <>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                margin:"16px 0 8px"}}>
                <div style={{fontSize:9,color:G.textDim,letterSpacing:2}}>COMPRADOS</div>
                <button onClick={()=>limpiarComprados(sectorActivo)}
                  style={{fontSize:10,color:G.textDim,background:"none",border:"none",
                    cursor:"pointer",textDecoration:"underline",letterSpacing:.5}}>
                  Limpiar comprados
                </button>
              </div>
              {compradosSector.map(it => (
                <div key={it.id}
                  style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",
                    border:`1px solid ${G.border}`,borderRadius:4,marginBottom:5,
                    background:G.surf2,opacity:.6}}>
                  <div onClick={()=>toggleComprado(it.id)}
                    style={{width:18,height:18,borderRadius:2,flexShrink:0,cursor:"pointer",
                      border:`1.5px solid ${G.gold}`,background:G.gold,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:11,color:G.bg,fontWeight:700}}>✓</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,color:G.textSec,textDecoration:"line-through"}}>{it.texto}</div>
                    {it.cantidad!=null && (
                      <div style={{fontSize:10,color:G.textDim,marginTop:1}}>
                        {it.cantidad} {VP_UNIDADES.find(u=>u.id===it.unidad)?.label}
                      </div>
                    )}
                  </div>
                  {it.monto!=null && (
                    <span style={{fontSize:12,color:G.gold,fontWeight:600}}>${fmt(it.monto)}</span>
                  )}
                  <button onClick={()=>eliminar(it.id)}
                    style={{background:"none",border:"none",color:G.textDim,fontSize:16,
                      cursor:"pointer",padding:"0 4px",lineHeight:1}}>
                    ×
                  </button>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STOCK — visualización de productos disponibles, editable manualmente
// Se alimenta automáticamente desde Compras al marcar items como comprados.
// ═══════════════════════════════════════════════════════════════════════════════
function VpStock({ onBack }) {
  const [items, setItems]     = useState([]); // [{ id, nombre, cantidad, unidad, precioUnitario, sector, actualizado }]
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [sectorActivo, setSectorActivo] = useState("todos");
  const [editandoId, setEditandoId] = useState(null);
  const [edCantidad, setEdCantidad] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevaCantidad, setNuevaCantidad] = useState("");
  const [nuevaUnidad, setNuevaUnidad] = useState("kg");
  const [nuevoSector, setNuevoSector] = useState("verduleria");

  useEffect(() => {
    if (!firebaseOk) { setLoading(false); return; }
    getDoc(doc(db, vpStockPath())).then(snap => {
      setItems(snap.exists() ? snap.data().items || [] : []);
      setLoading(false);
    }).catch(()=>setLoading(false));
  }, []);

  async function persistir(nuevaLista) {
    setItems(nuevaLista);
    if (!firebaseOk) return;
    setSaveStatus("saving");
    try {
      await setDoc(doc(db, vpStockPath()), { items: nuevaLista });
      setSaveStatus("saved");
      setTimeout(()=>setSaveStatus("idle"), 1500);
    } catch(e) { setSaveStatus("error"); }
  }

  function guardarEdicion(id) {
    const cant = parseFloat(edCantidad.replace(",","."));
    persistir(items.map(it => it.id===id ? { ...it, cantidad: isNaN(cant)?0:cant, actualizado:Date.now() } : it));
    setEditandoId(null); setEdCantidad("");
  }

  function eliminarItem(id) {
    persistir(items.filter(it=>it.id!==id));
  }

  function agregarManual() {
    const nombre = nuevoNombre.trim();
    if (!nombre) return;
    const cantidad = parseFloat(nuevaCantidad.replace(",","."));
    persistir([...items, {
      id:`${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      nombre, cantidad: isNaN(cantidad)?0:cantidad, unidad:nuevaUnidad,
      precioUnitario:null, sector:nuevoSector, actualizado:Date.now(),
    }]);
    setNuevoNombre(""); setNuevaCantidad("");
  }

  const sectoresConTodos = [{id:"todos",label:"Todos",emoji:"📦",color:G.gold}, ...VP_SECTORES_COMPRA.filter(s=>VP_SECTORES_ALIMENTO.includes(s.id))];
  const itemsFiltrados = sectorActivo==="todos" ? items : items.filter(it=>it.sector===sectorActivo);
  const fmt = n => (n??0).toLocaleString("es-AR",{minimumFractionDigits:0,maximumFractionDigits:2});

  return (
    <div style={{minHeight:"100vh",background:G.bg,fontFamily:"system-ui,sans-serif",
      padding:"24px 16px 56px",maxWidth:430,margin:"0 auto"}}>

      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
        <button onClick={onBack} style={S.btn(false,false)}>← Volver</button>
        <div style={{flex:1,textAlign:"right"}}>
          <span style={{fontSize:10,padding:"5px 8px",borderRadius:3,letterSpacing:.5,
            background:saveStatus==="saving"?G.goldDim:saveStatus==="saved"?G.okBg:G.surf2,
            color:saveStatus==="saving"?G.gold:saveStatus==="saved"?"#7AB85A":G.textDim,
            border:`1px solid ${G.border}`}}>
            {saveStatus==="saving"?"GUARDANDO…":saveStatus==="saved"?"✓ GUARDADO":"AUTO"}
          </span>
        </div>
      </div>

      <div style={{textAlign:"center",marginBottom:16}}>
        <div style={{fontSize:28,marginBottom:6}}>📦</div>
        <div style={{fontSize:14,fontWeight:700,color:G.text,letterSpacing:1,fontFamily:"'Courier New',monospace"}}>
          STOCK DE ALIMENTOS
        </div>
        <div style={{fontSize:10,color:G.textDim,marginTop:4}}>
          Se actualiza automáticamente desde Compras
        </div>
      </div>

      {/* Tabs sector */}
      <div style={{display:"flex",gap:4,marginBottom:14,overflowX:"auto"}}>
        {sectoresConTodos.map(s => {
          const active = sectorActivo===s.id;
          return (
            <button key={s.id} onClick={()=>setSectorActivo(s.id)}
              style={{flex:1,whiteSpace:"nowrap",padding:"8px 6px",fontSize:11,cursor:"pointer",
                border:`1px solid ${active?s.color:G.border}`,borderRadius:4,
                background:active?`${s.color}18`:G.surf2,
                color:active?s.color:G.textSec,fontWeight:active?600:400}}>
              {s.emoji} {s.label}
            </button>
          );
        })}
      </div>

      {/* Agregar manual */}
      <div style={{border:`1px solid ${G.border}`,borderRadius:4,padding:"12px",background:G.surf,marginBottom:14}}>
        <div style={{fontSize:9,color:G.gold,letterSpacing:2,marginBottom:8}}>AGREGAR / AJUSTAR MANUAL</div>
        <input value={nuevoNombre} onChange={e=>setNuevoNombre(e.target.value)}
          placeholder="Nombre del producto" style={{...S.inp(false),marginBottom:6}}/>
        <div style={{display:"flex",gap:6}}>
          <input value={nuevaCantidad} onChange={e=>setNuevaCantidad(e.target.value)}
            placeholder="Cant." type="text" inputMode="decimal"
            style={{...S.inp(false),flex:1,textAlign:"center"}}/>
          <select value={nuevaUnidad} onChange={e=>setNuevaUnidad(e.target.value)}
            style={{...S.inp(false),flex:1,cursor:"pointer",textAlign:"center"}}>
            {VP_UNIDADES.map(u=><option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
          <select value={nuevoSector} onChange={e=>setNuevoSector(e.target.value)}
            style={{...S.inp(false),flex:1.4,cursor:"pointer",fontSize:11}}>
            {VP_SECTORES_COMPRA.filter(s=>VP_SECTORES_ALIMENTO.includes(s.id)).map(s=>
              <option key={s.id} value={s.id}>{s.emoji} {s.label}</option>)}
          </select>
        </div>
        <button onClick={agregarManual}
          style={{width:"100%",marginTop:6,padding:"8px",borderRadius:3,background:G.gold,
            border:"none",color:G.bg,fontSize:11,fontWeight:700,cursor:"pointer"}}>
          + AGREGAR AL STOCK
        </button>
      </div>

      {loading ? (
        <div style={{textAlign:"center",color:G.textDim,fontSize:11,padding:20,letterSpacing:1,
          fontFamily:"'Courier New',monospace"}}>CARGANDO STOCK...</div>
      ) : itemsFiltrados.length===0 ? (
        <div style={{textAlign:"center",color:G.textDim,fontSize:12,padding:30}}>
          Sin productos en stock. Comprá algo en {sectorActivo==="todos"?"Verdulería, Carnicería o Supermercado":"este sector"} para que aparezca aquí.
        </div>
      ) : (
        itemsFiltrados.sort((a,b)=>a.nombre.localeCompare(b.nombre)).map(it => {
          const sectorInfo = VP_SECTORES_COMPRA.find(s=>s.id===it.sector);
          const bajo = it.cantidad <= 0;
          return (
            <div key={it.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",
              border:`1px solid ${bajo?"#C9724C44":G.border}`,borderRadius:4,marginBottom:5,
              background:bajo?"#1a050008":G.surf}}>
              <span style={{fontSize:16}}>{sectorInfo?.emoji||"📦"}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,color:G.text,textTransform:"capitalize"}}>{it.nombre}</div>
                {it.precioUnitario!=null && (
                  <div style={{fontSize:10,color:G.textDim,marginTop:1}}>
                    ${fmt(it.precioUnitario)} por {VP_UNIDADES.find(u=>u.id===it.unidad)?.label}
                  </div>
                )}
              </div>
              {editandoId===it.id ? (
                <>
                  <input autoFocus value={edCantidad} onChange={e=>setEdCantidad(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&guardarEdicion(it.id)}
                    type="text" inputMode="decimal"
                    style={{width:60,fontSize:13,padding:"4px 6px",textAlign:"center",
                      border:`1px solid ${G.gold}`,borderRadius:3,background:G.surf2,
                      color:G.gold,outline:"none",fontFamily:"inherit"}}/>
                  <button onClick={()=>guardarEdicion(it.id)}
                    style={{background:"none",border:"none",color:G.gold,fontSize:14,cursor:"pointer"}}>✓</button>
                </>
              ) : (
                <div onClick={()=>{setEditandoId(it.id);setEdCantidad(String(it.cantidad));}}
                  style={{textAlign:"right",cursor:"pointer"}}>
                  <div style={{fontSize:15,fontWeight:700,color:bajo?"#C9724C":G.gold}}>
                    {fmt(it.cantidad)}
                  </div>
                  <div style={{fontSize:9,color:G.textDim}}>{VP_UNIDADES.find(u=>u.id===it.unidad)?.label}</div>
                </div>
              )}
              <button onClick={()=>eliminarItem(it.id)}
                style={{background:"none",border:"none",color:G.textDim,fontSize:16,
                  cursor:"pointer",padding:"0 4px",lineHeight:1}}>×</button>
            </div>
          );
        })
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECETAS — base de platos: ingredientes + cantidades + info nutricional
// Carga manual o automática (sube PDF/imagen y la IA extrae los datos)
// ═══════════════════════════════════════════════════════════════════════════════
function VpRecetaForm({ recetaInicial, onGuardar, onCancelar }) {
  const [nombre, setNombre] = useState(recetaInicial?.nombre || "");
  const [porcionesBase, setPorcionesBase] = useState(recetaInicial?.porcionesBase || "4");
  const [ingredientes, setIngredientes] = useState(recetaInicial?.ingredientes || [{nombre:"",cantidad:"",unidad:"kg"}]);
  const [kcal, setKcal] = useState(recetaInicial?.nutricion?.kcal || "");
  const [carbs, setCarbs] = useState(recetaInicial?.nutricion?.carbs || "");
  const [prot, setProt] = useState(recetaInicial?.nutricion?.prot || "");
  const [grasas, setGrasas] = useState(recetaInicial?.nutricion?.grasas || "");
  const [archivo, setArchivo] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [errorIA, setErrorIA] = useState("");
  const [nutricionManual, setNutricionManual] = useState(!!recetaInicial); // si ya tenía datos, no auto-sobreescribir
  const fileInputRef = useRef(null);

  // Auto-cálculo: cada vez que cambian los ingredientes, recalculamos la nutrición total
  // sumando lo que reconocemos en la tabla nutricional. No pisa valores si el usuario
  // ya tocó los campos manualmente (nutricionManual=true).
  const nutricionCalculada = ingredientes.reduce((acc, ing) => {
    if (!ing.nombre.trim() || !ing.cantidad) return acc;
    const cant = parseFloat(String(ing.cantidad).replace(",","."));
    if (isNaN(cant)) return acc;
    const calc = vpCalcularNutricionIngrediente(ing.nombre, cant, ing.unidad);
    if (!calc) return acc;
    return {
      kcal: acc.kcal + calc.kcal, carbs: acc.carbs + calc.carbs,
      prot: acc.prot + calc.prot, grasas: acc.grasas + calc.grasas,
      reconocidos: acc.reconocidos + 1,
    };
  }, { kcal:0, carbs:0, prot:0, grasas:0, reconocidos:0 });

  const ingredientesConNombre = ingredientes.filter(i=>i.nombre.trim()).length;
  const todosReconocidos = ingredientesConNombre > 0 && nutricionCalculada.reconocidos === ingredientesConNombre;

  useEffect(() => {
    if (nutricionManual) return; // el usuario ya editó a mano, no lo pisamos
    if (nutricionCalculada.reconocidos === 0) return;
    setKcal(String(Math.round(nutricionCalculada.kcal)));
    setCarbs(String(Math.round(nutricionCalculada.carbs)));
    setProt(String(Math.round(nutricionCalculada.prot)));
    setGrasas(String(Math.round(nutricionCalculada.grasas)));
  }, [JSON.stringify(ingredientes)]);

  function agregarIngrediente() {
    setIngredientes([...ingredientes, {nombre:"",cantidad:"",unidad:"kg"}]);
  }
  function actualizarIngrediente(i, campo, valor) {
    setIngredientes(ingredientes.map((ing,idx)=>idx===i?{...ing,[campo]:valor}:ing));
  }
  function eliminarIngrediente(i) {
    setIngredientes(ingredientes.filter((_,idx)=>idx!==i));
  }

  // Convierte el archivo a base64 y pide a la IA que extraiga la receta estructurada
  async function procesarConIA(file) {
    setProcesando(true); setErrorIA("");
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(",")[1]);
        r.onerror = () => rej(new Error("No se pudo leer el archivo"));
        r.readAsDataURL(file);
      });
      const esPdf = file.type === "application/pdf";
      const mediaType = file.type || (esPdf ? "application/pdf" : "image/jpeg");

      const contentBlock = esPdf
        ? { type:"document", source:{ type:"base64", media_type:mediaType, data:base64 } }
        : { type:"image", source:{ type:"base64", media_type:mediaType, data:base64 } };

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
          model:"claude-sonnet-4-6",
          max_tokens:1000,
          messages:[{
            role:"user",
            content:[
              contentBlock,
              { type:"text", text:
                "Extraé de esta receta: nombre del plato, porciones base que rinde la receta tal como está escrita, " +
                "lista de ingredientes con cantidad numérica y unidad (kg, u o lts), e información nutricional total " +
                "de toda la receta (kcal, carbohidratos en g, proteína en g, grasas en g) si está disponible o se puede estimar. " +
                "Respondé ÚNICAMENTE con un JSON válido, sin texto adicional, sin markdown, con esta forma exacta: " +
                '{"nombre":"...","porcionesBase":4,"ingredientes":[{"nombre":"...","cantidad":0,"unidad":"kg"}],' +
                '"nutricion":{"kcal":0,"carbs":0,"prot":0,"grasas":0}}'
              }
            ]
          }]
        })
      });
      const data = await response.json();
      const textBlock = (data.content||[]).find(c=>c.type==="text");
      if (!textBlock) throw new Error("La IA no devolvió texto");
      const limpio = textBlock.text.replace(/```json|```/g,"").trim();
      const parsed = JSON.parse(limpio);

      setNombre(parsed.nombre || "");
      setPorcionesBase(String(parsed.porcionesBase || 4));
      setIngredientes((parsed.ingredientes||[]).map(i=>({
        nombre:i.nombre||"", cantidad:String(i.cantidad??""), unidad:i.unidad||"kg"
      })));
      setKcal(String(parsed.nutricion?.kcal??""));
      setCarbs(String(parsed.nutricion?.carbs??""));
      setProt(String(parsed.nutricion?.prot??""));
      setGrasas(String(parsed.nutricion?.grasas??""));
      setNutricionManual(true);
    } catch(e) {
      setErrorIA("No se pudo procesar el archivo automáticamente. Cargá los datos manualmente abajo.");
    } finally {
      setProcesando(false);
    }
  }

  function handleArchivo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setArchivo(file);
    procesarConIA(file);
  }

  function guardar() {
    if (!nombre.trim()) return;
    const ingredientesLimpios = ingredientes
      .filter(i=>i.nombre.trim())
      .map(i=>({ nombre:i.nombre.trim(), cantidad:parseFloat(i.cantidad)||0, unidad:i.unidad }));
    onGuardar({
      id: recetaInicial?.id || `${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      nombre: nombre.trim(),
      porcionesBase: parseInt(porcionesBase)||4,
      ingredientes: ingredientesLimpios,
      nutricion: {
        kcal: parseFloat(kcal)||0, carbs: parseFloat(carbs)||0,
        prot: parseFloat(prot)||0, grasas: parseFloat(grasas)||0,
      },
      creado: recetaInicial?.creado || Date.now(),
    });
  }

  return (
    <div style={{border:`1px solid ${G.gold}`,borderRadius:4,padding:"14px",background:G.surf,marginBottom:14}}>
      <div style={{fontSize:9,color:G.gold,letterSpacing:2,marginBottom:10}}>
        {recetaInicial ? "EDITAR RECETA" : "NUEVA RECETA"}
      </div>

      {/* Carga por archivo */}
      <div style={{border:`1px dashed ${G.border}`,borderRadius:4,padding:"12px",marginBottom:12,textAlign:"center"}}>
        <input ref={fileInputRef} type="file" accept="image/*,application/pdf" onChange={handleArchivo} style={{display:"none"}}/>
        <button onClick={()=>fileInputRef.current?.click()} disabled={procesando}
          style={{padding:"8px 16px",borderRadius:3,background:procesando?G.surf2:G.goldDim,
            border:`1px solid ${G.goldMid}`,color:G.gold,fontSize:11,fontWeight:600,
            cursor:procesando?"default":"pointer"}}>
          {procesando ? "ANALIZANDO ARCHIVO…" : "📷 SUBIR FOTO O PDF DE LA RECETA"}
        </button>
        {archivo && !procesando && <div style={{fontSize:10,color:G.textDim,marginTop:6}}>{archivo.name}</div>}
        {errorIA && <div style={{fontSize:10,color:"#C9724C",marginTop:6}}>{errorIA}</div>}
        <div style={{fontSize:9,color:G.textDim,marginTop:6}}>o completá los datos manualmente abajo ↓</div>
      </div>

      <div style={{fontSize:9,color:G.textDim,marginBottom:3}}>NOMBRE DEL PLATO</div>
      <input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Ej: Pollo al horno con papas"
        style={{...S.inp(false),marginBottom:8}}/>

      <div style={{fontSize:9,color:G.textDim,marginBottom:3}}>PORCIONES QUE RINDE LA RECETA</div>
      <input value={porcionesBase} onChange={e=>setPorcionesBase(e.target.value)} type="number"
        style={{...S.inp(false),marginBottom:10,width:80}}/>

      <div style={{fontSize:9,color:G.gold,letterSpacing:2,marginBottom:6}}>INGREDIENTES</div>
      {ingredientes.map((ing,i)=>(
        <div key={i} style={{display:"flex",gap:4,marginBottom:5}}>
          <input value={ing.nombre} onChange={e=>actualizarIngrediente(i,"nombre",e.target.value)}
            placeholder="Ingrediente" style={{...S.inp(false),flex:2}}/>
          <input value={ing.cantidad} onChange={e=>actualizarIngrediente(i,"cantidad",e.target.value)}
            placeholder="Cant." type="text" inputMode="decimal" style={{...S.inp(false),flex:1,textAlign:"center"}}/>
          <select value={ing.unidad} onChange={e=>actualizarIngrediente(i,"unidad",e.target.value)}
            style={{...S.inp(false),flex:1,cursor:"pointer"}}>
            {VP_UNIDADES.map(u=><option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
          <button onClick={()=>eliminarIngrediente(i)}
            style={{background:"none",border:"none",color:G.textDim,fontSize:16,cursor:"pointer",padding:"0 4px"}}>×</button>
        </div>
      ))}
      <button onClick={agregarIngrediente}
        style={{fontSize:10,color:G.textSec,background:"none",border:`1px dashed ${G.border}`,
          borderRadius:3,padding:"6px 10px",cursor:"pointer",marginBottom:12}}>
        + Agregar ingrediente
      </button>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <div style={{fontSize:9,color:G.gold,letterSpacing:2}}>INFO NUTRICIONAL (TOTAL DE LA RECETA)</div>
        {nutricionManual && nutricionCalculada.reconocidos>0 && (
          <button onClick={()=>setNutricionManual(false)}
            style={{fontSize:9,color:G.textDim,background:"none",border:"none",
              cursor:"pointer",textDecoration:"underline"}}>
            recalcular automático
          </button>
        )}
      </div>
      {ingredientesConNombre > 0 && (
        <div style={{fontSize:10,marginBottom:8,padding:"6px 10px",borderRadius:3,
          background: todosReconocidos ? G.okBg : nutricionCalculada.reconocidos>0 ? G.goldDim : "#1a050008",
          color: todosReconocidos ? "#7AB85A" : nutricionCalculada.reconocidos>0 ? G.gold : "#C9724C",
          border:`1px solid ${todosReconocidos?"#5C8A4A55":nutricionCalculada.reconocidos>0?G.goldMid:"#C9724C44"}`}}>
          {todosReconocidos
            ? `✓ ${nutricionCalculada.reconocidos}/${ingredientesConNombre} ingredientes calculados automáticamente`
            : nutricionCalculada.reconocidos>0
              ? `${nutricionCalculada.reconocidos}/${ingredientesConNombre} ingredientes reconocidos · revisá los demás manualmente`
              : `Ningún ingrediente coincide con la base nutricional · cargá los valores manualmente`
          }
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:12}}>
        {[["Kcal",kcal,setKcal],["Carbohidratos (g)",carbs,setCarbs],
          ["Proteína (g)",prot,setProt],["Grasas (g)",grasas,setGrasas]].map(([lbl,val,setter])=>(
          <div key={lbl}>
            <div style={{fontSize:9,color:G.textDim,marginBottom:3}}>{lbl.toUpperCase()}</div>
            <input value={val} onChange={e=>{setter(e.target.value);setNutricionManual(true);}}
              type="text" inputMode="decimal"
              style={{...S.inp(false),textAlign:"center"}}/>
          </div>
        ))}
      </div>

      <div style={{display:"flex",gap:6}}>
        <button onClick={guardar}
          style={{flex:1,padding:"10px",borderRadius:3,background:G.gold,border:"none",
            color:G.bg,fontSize:12,fontWeight:700,cursor:"pointer"}}>GUARDAR RECETA</button>
        <button onClick={onCancelar}
          style={{flex:1,padding:"10px",borderRadius:3,background:G.surf2,
            border:`1px solid ${G.border}`,color:G.textSec,fontSize:12,cursor:"pointer"}}>CANCELAR</button>
      </div>
    </div>
  );
}

function VpRecetasScreen({ onBack, onUsarReceta }) {
  const [recetas, setRecetas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState(null);

  useEffect(() => {
    if (!firebaseOk) { setLoading(false); return; }
    getDoc(doc(db, vpRecetasPath())).then(snap => {
      setRecetas(snap.exists() ? snap.data().items || [] : []);
      setLoading(false);
    }).catch(()=>setLoading(false));
  }, []);

  async function persistir(nuevaLista) {
    setRecetas(nuevaLista);
    if (!firebaseOk) return;
    try { await setDoc(doc(db, vpRecetasPath()), { items: nuevaLista }); } catch(e) {}
  }

  function guardarReceta(receta) {
    const existe = recetas.some(r=>r.id===receta.id);
    persistir(existe ? recetas.map(r=>r.id===receta.id?receta:r) : [...recetas, receta]);
    setMostrarForm(false); setEditando(null);
  }

  function eliminarReceta(id) {
    persistir(recetas.filter(r=>r.id!==id));
  }

  return (
    <div style={{minHeight:"100vh",background:G.bg,fontFamily:"system-ui,sans-serif",
      padding:"24px 16px 56px",maxWidth:430,margin:"0 auto"}}>

      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
        <button onClick={onBack} style={S.btn(false,false)}>← Cocina</button>
      </div>

      <div style={{textAlign:"center",marginBottom:16}}>
        <div style={{fontSize:28,marginBottom:6}}>📖</div>
        <div style={{fontSize:14,fontWeight:700,color:G.text,letterSpacing:1,fontFamily:"'Courier New',monospace"}}>
          RECETAS
        </div>
      </div>

      {mostrarForm ? (
        <VpRecetaForm recetaInicial={editando}
          onGuardar={guardarReceta}
          onCancelar={()=>{setMostrarForm(false);setEditando(null);}}/>
      ) : (
        <button onClick={()=>setMostrarForm(true)}
          style={{width:"100%",padding:"12px",marginBottom:14,borderRadius:3,
            border:`1px dashed ${G.border}`,background:"transparent",
            color:G.textSec,fontSize:12,cursor:"pointer"}}>
          + Agregar nueva receta
        </button>
      )}

      {loading ? (
        <div style={{textAlign:"center",color:G.textDim,fontSize:11,padding:20,letterSpacing:1,
          fontFamily:"'Courier New',monospace"}}>CARGANDO RECETAS...</div>
      ) : recetas.length===0 ? (
        <div style={{textAlign:"center",color:G.textDim,fontSize:12,padding:30}}>
          Sin recetas todavía. Subí una foto o cargala manual.
        </div>
      ) : (
        recetas.map(r => (
          <div key={r.id} style={{border:`1px solid ${G.border}`,borderRadius:4,padding:"12px",
            background:G.surf,marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
              <div style={{fontSize:13,fontWeight:600,color:G.text}}>{r.nombre}</div>
              <div style={{display:"flex",gap:4}}>
                <button onClick={()=>{setEditando(r);setMostrarForm(true);}}
                  style={{background:"none",border:"none",color:G.textDim,fontSize:13,cursor:"pointer"}}>✎</button>
                <button onClick={()=>eliminarReceta(r.id)}
                  style={{background:"none",border:"none",color:G.textDim,fontSize:15,cursor:"pointer"}}>×</button>
              </div>
            </div>
            <div style={{fontSize:10,color:G.textDim,marginBottom:8}}>
              Rinde {r.porcionesBase} porciones · {r.ingredientes.length} ingredientes
            </div>
            <div style={{display:"flex",gap:10,fontSize:10,color:G.textSec,marginBottom:10}}>
              <span>{r.nutricion.kcal} kcal</span>
              <span>{r.nutricion.prot}g prot</span>
              <span>{r.nutricion.carbs}g carb</span>
              <span>{r.nutricion.grasas}g grasa</span>
            </div>
            {onUsarReceta && (
              <button onClick={()=>onUsarReceta(r)}
                style={{width:"100%",padding:"8px",borderRadius:3,background:G.goldDim,
                  border:`1px solid ${G.goldMid}`,color:G.gold,fontSize:11,fontWeight:600,cursor:"pointer"}}>
                🍳 COCINAR ESTA RECETA
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COCINA — calculador de porciones, info nutricional escalada, verificación de Stock
// ═══════════════════════════════════════════════════════════════════════════════
function VpCocina({ onBack, onVerRecetas, recetaSeleccionada, onLimpiarSeleccion }) {
  const [receta, setReceta] = useState(recetaSeleccionada || null);
  const [porcionesDeseadas, setPorcionesDeseadas] = useState(String(recetaSeleccionada?.porcionesBase || 4));
  const [cantTuppers, setCantTuppers] = useState(String(recetaSeleccionada?.porcionesBase || 4));
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [descontado, setDescontado] = useState(false);

  useEffect(() => {
    if (!firebaseOk) { setLoading(false); return; }
    getDoc(doc(db, vpStockPath())).then(snap => {
      setStock(snap.exists() ? snap.data().items || [] : []);
      setLoading(false);
    }).catch(()=>setLoading(false));
  }, []);

  useEffect(() => {
    if (recetaSeleccionada) {
      setReceta(recetaSeleccionada);
      setPorcionesDeseadas(String(recetaSeleccionada.porcionesBase || 4));
      setCantTuppers(String(recetaSeleccionada.porcionesBase || 4));
      setDescontado(false);
    }
  }, [recetaSeleccionada]);

  if (!receta) {
    return (
      <div style={{minHeight:"100vh",background:G.bg,fontFamily:"system-ui,sans-serif",
        padding:"24px 16px 56px",maxWidth:430,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
          <button onClick={onBack} style={S.btn(false,false)}>← Nutrición</button>
        </div>
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:28,marginBottom:6}}>🍳</div>
          <div style={{fontSize:14,fontWeight:700,color:G.text,letterSpacing:1,fontFamily:"'Courier New',monospace"}}>
            COCINA
          </div>
          <div style={{fontSize:11,color:G.textDim,marginTop:6}}>
            Elegí una receta para calcular porciones y verificar tu stock
          </div>
        </div>
        <button onClick={onVerRecetas}
          style={{width:"100%",padding:"12px",borderRadius:3,background:G.goldDim,
            border:`1px solid ${G.goldMid}`,color:G.gold,fontSize:12,fontWeight:600,cursor:"pointer"}}>
          📖 IR A RECETAS
        </button>
      </div>
    );
  }

  const porciones = parseFloat(porcionesDeseadas) || 0;
  const tuppers = parseInt(cantTuppers) || 1;
  const factor = receta.porcionesBase > 0 ? porciones / receta.porcionesBase : 0;

  const nutricionTotal = {
    kcal: receta.nutricion.kcal * factor,
    carbs: receta.nutricion.carbs * factor,
    prot: receta.nutricion.prot * factor,
    grasas: receta.nutricion.grasas * factor,
  };
  const nutricionPorPorcion = porciones > 0 ? {
    kcal: nutricionTotal.kcal / porciones,
    carbs: nutricionTotal.carbs / porciones,
    prot: nutricionTotal.prot / porciones,
    grasas: nutricionTotal.grasas / porciones,
  } : { kcal:0, carbs:0, prot:0, grasas:0 };

  // Reparto por tupper — divide la nutrición total y cada ingrediente entre la cantidad de tuppers
  const nutricionPorTupper = tuppers > 0 ? {
    kcal: nutricionTotal.kcal / tuppers,
    carbs: nutricionTotal.carbs / tuppers,
    prot: nutricionTotal.prot / tuppers,
    grasas: nutricionTotal.grasas / tuppers,
  } : { kcal:0, carbs:0, prot:0, grasas:0 };

  const ingredientesPorTupper = receta.ingredientes.map(ing => ({
    nombre: ing.nombre,
    cantidad: tuppers > 0 ? (ing.cantidad * factor) / tuppers : 0,
    unidad: ing.unidad,
  }));

  // Verificación contra Stock — cuánto necesito vs cuánto tengo
  const verificacion = receta.ingredientes.map(ing => {
    const necesario = ing.cantidad * factor;
    const key = vpNormalizarNombre(ing.nombre);
    const enStock = stock.find(s => vpNormalizarNombre(s.nombre)===key && s.unidad===ing.unidad);
    const disponible = enStock?.cantidad || 0;
    const falta = Math.max(0, necesario - disponible);
    return { ...ing, necesario, disponible, falta, alcanza: falta===0 };
  });
  const faltantes = verificacion.filter(v=>!v.alcanza);
  const todoDisponible = faltantes.length===0;

  async function descontarDeStock() {
    if (!firebaseOk || descontado) return;
    let nuevoStock = [...stock];
    verificacion.forEach(v => {
      const key = vpNormalizarNombre(v.nombre);
      const idx = nuevoStock.findIndex(s=>vpNormalizarNombre(s.nombre)===key && s.unidad===v.unidad);
      if (idx>=0) {
        nuevoStock[idx] = { ...nuevoStock[idx], cantidad: Math.max(0, nuevoStock[idx].cantidad - v.necesario), actualizado:Date.now() };
      }
    });
    setStock(nuevoStock);
    try { await setDoc(doc(db, vpStockPath()), { items: nuevoStock }); } catch(e) {}

    // Guardamos el resultado de cocinar — qué tuppers quedaron listos, con su info,
    // para poder verlos después desde el registro diario de Nutrición.
    // Se agrega al historial consolidado de tuppers preparados (no se pisa lo anterior).
    if (firebaseOk) {
      try {
        const snapT = await getDoc(doc(db, vpTuppersPreparadosPath()));
        const preparadosAct = snapT.exists() ? snapT.data().items || [] : [];
        const nuevoTupperLote = {
          id: `${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
          recetaNombre: receta.nombre, porciones, cantTuppers: tuppers,
          nutricionPorTupper, ingredientesPorTupper, fecha: Date.now(), consumidos: 0,
        };
        await setDoc(doc(db, vpTuppersPreparadosPath()), { items: [...preparadosAct, nuevoTupperLote] });
      } catch(e) {}
    }

    setDescontado(true);
  }

  const fmt = n => n.toLocaleString("es-AR",{minimumFractionDigits:0,maximumFractionDigits:1});

  return (
    <div style={{minHeight:"100vh",background:G.bg,fontFamily:"system-ui,sans-serif",
      padding:"24px 16px 56px",maxWidth:430,margin:"0 auto"}}>

      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
        <button onClick={()=>{setReceta(null);onLimpiarSeleccion?.();}} style={S.btn(false,false)}>← Recetas</button>
        <button onClick={onBack} style={{...S.btn(false,false),marginLeft:"auto"}}>Salir</button>
      </div>

      <div style={{textAlign:"center",marginBottom:16}}>
        <div style={{fontSize:28,marginBottom:6}}>🍳</div>
        <div style={{fontSize:14,fontWeight:700,color:G.text,letterSpacing:1}}>{receta.nombre.toUpperCase()}</div>
      </div>

      {/* Selector de porciones */}
      <div style={{border:`1px solid ${G.border}`,borderRadius:4,padding:"14px",background:G.surf,marginBottom:8}}>
        <div style={{fontSize:9,color:G.gold,letterSpacing:2,marginBottom:8}}>PORCIONES A COCINAR</div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={()=>setPorcionesDeseadas(String(Math.max(1,porciones-1)))}
            style={{width:36,height:36,borderRadius:3,background:G.surf2,border:`1px solid ${G.border}`,
              color:G.text,fontSize:18,cursor:"pointer"}}>−</button>
          <input value={porcionesDeseadas} onChange={e=>setPorcionesDeseadas(e.target.value)}
            type="text" inputMode="decimal"
            style={{flex:1,fontSize:22,fontWeight:700,textAlign:"center",
              border:`1px solid ${G.border}`,borderRadius:3,padding:"8px",
              background:G.surf2,color:G.gold,outline:"none",fontFamily:"inherit"}}/>
          <button onClick={()=>setPorcionesDeseadas(String(porciones+1))}
            style={{width:36,height:36,borderRadius:3,background:G.surf2,border:`1px solid ${G.border}`,
              color:G.text,fontSize:18,cursor:"pointer"}}>+</button>
        </div>
        <div style={{fontSize:10,color:G.textDim,marginTop:6,textAlign:"center"}}>
          Receta original rinde {receta.porcionesBase} porciones
        </div>
      </div>

      {/* Selector de tuppers */}
      <div style={{border:`1px solid ${G.border}`,borderRadius:4,padding:"14px",background:G.surf,marginBottom:14}}>
        <div style={{fontSize:9,color:G.gold,letterSpacing:2,marginBottom:8}}>REPARTIR EN CUÁNTOS TUPPERS</div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <button onClick={()=>setCantTuppers(String(Math.max(1,tuppers-1)))}
            style={{width:36,height:36,borderRadius:3,background:G.surf2,border:`1px solid ${G.border}`,
              color:G.text,fontSize:18,cursor:"pointer"}}>−</button>
          <input value={cantTuppers} onChange={e=>setCantTuppers(e.target.value)}
            type="text" inputMode="numeric"
            style={{flex:1,fontSize:22,fontWeight:700,textAlign:"center",
              border:`1px solid ${G.border}`,borderRadius:3,padding:"8px",
              background:G.surf2,color:G.gold,outline:"none",fontFamily:"inherit"}}/>
          <button onClick={()=>setCantTuppers(String(tuppers+1))}
            style={{width:36,height:36,borderRadius:3,background:G.surf2,border:`1px solid ${G.border}`,
              color:G.text,fontSize:18,cursor:"pointer"}}>+</button>
        </div>
        <div style={{fontSize:10,color:G.textDim,marginTop:6,textAlign:"center"}}>
          📦 {tuppers} tupper{tuppers!==1?"s":""} · {fmt(porciones/tuppers)} porción{porciones/tuppers!==1?"es":""} cada uno
        </div>
      </div>

      {/* Información nutricional */}
      <div style={{border:`1px solid ${G.border}`,borderRadius:4,padding:"14px",background:G.surf,marginBottom:14}}>
        <div style={{fontSize:9,color:G.gold,letterSpacing:2,marginBottom:10}}>INFORMACIÓN NUTRICIONAL</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
          <div>
            <div style={{fontSize:9,color:G.textDim,marginBottom:6,letterSpacing:1}}>POR PORCIÓN</div>
            {[["Kcal",nutricionPorPorcion.kcal,""],["Carbs",nutricionPorPorcion.carbs,"g"],
              ["Prot",nutricionPorPorcion.prot,"g"],["Grasas",nutricionPorPorcion.grasas,"g"]].map(([lbl,val,u])=>(
              <div key={lbl} style={{display:"flex",justifyContent:"space-between",fontSize:10,padding:"3px 0"}}>
                <span style={{color:G.textSec}}>{lbl}</span>
                <span style={{color:G.text,fontWeight:600}}>{fmt(val)}{u}</span>
              </div>
            ))}
          </div>
          <div>
            <div style={{fontSize:9,color:G.gold,marginBottom:6,letterSpacing:1}}>POR TUPPER</div>
            {[["Kcal",nutricionPorTupper.kcal,""],["Carbs",nutricionPorTupper.carbs,"g"],
              ["Prot",nutricionPorTupper.prot,"g"],["Grasas",nutricionPorTupper.grasas,"g"]].map(([lbl,val,u])=>(
              <div key={lbl} style={{display:"flex",justifyContent:"space-between",fontSize:10,padding:"3px 0"}}>
                <span style={{color:G.textSec}}>{lbl}</span>
                <span style={{color:G.gold,fontWeight:700}}>{fmt(val)}{u}</span>
              </div>
            ))}
          </div>
          <div>
            <div style={{fontSize:9,color:G.textDim,marginBottom:6,letterSpacing:1}}>TOTAL</div>
            {[["Kcal",nutricionTotal.kcal,""],["Carbs",nutricionTotal.carbs,"g"],
              ["Prot",nutricionTotal.prot,"g"],["Grasas",nutricionTotal.grasas,"g"]].map(([lbl,val,u])=>(
              <div key={lbl} style={{display:"flex",justifyContent:"space-between",fontSize:10,padding:"3px 0"}}>
                <span style={{color:G.textSec}}>{lbl}</span>
                <span style={{color:G.text,fontWeight:600}}>{fmt(val)}{u}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ingredientes por tupper */}
      <div style={{border:`1px solid ${G.goldMid}`,borderRadius:4,padding:"14px",background:G.goldDim,marginBottom:14}}>
        <div style={{fontSize:9,color:G.gold,letterSpacing:2,marginBottom:10}}>📦 CADA TUPPER LLEVA</div>
        {ingredientesPorTupper.map((ing,i) => (
          <div key={i} style={{display:"flex",justifyContent:"space-between",
            padding:"6px 0",borderBottom:i<ingredientesPorTupper.length-1?`1px solid ${G.goldMid}`:"none"}}>
            <span style={{fontSize:12,color:G.text,textTransform:"capitalize"}}>{ing.nombre}</span>
            <span style={{fontSize:12,color:G.gold,fontWeight:600}}>
              {fmt(ing.cantidad)} {VP_UNIDADES.find(u=>u.id===ing.unidad)?.label}
            </span>
          </div>
        ))}
      </div>

      {/* Verificación de stock */}
      <div style={{border:`1px solid ${todoDisponible?"#7AB85A44":"#C9724C44"}`,borderRadius:4,
        padding:"14px",background:todoDisponible?G.okBg:"#1a050008",marginBottom:14}}>
        <div style={{fontSize:9,color:todoDisponible?"#7AB85A":"#C9724C",letterSpacing:2,marginBottom:10}}>
          {todoDisponible ? "✓ TENÉS TODO EN STOCK" : `⚠ FALTAN ${faltantes.length} INGREDIENTE${faltantes.length>1?"S":""}`}
        </div>
        {verificacion.map((v,i) => (
          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
            padding:"6px 0",borderBottom:i<verificacion.length-1?`1px solid ${G.border}`:"none"}}>
            <span style={{fontSize:12,color:G.text,textTransform:"capitalize"}}>{v.nombre}</span>
            <div style={{textAlign:"right"}}>
              <span style={{fontSize:11,color:v.alcanza?"#7AB85A":"#C9724C",fontWeight:600}}>
                {fmt(v.necesario)} {VP_UNIDADES.find(u=>u.id===v.unidad)?.label}
              </span>
              {!v.alcanza && (
                <div style={{fontSize:9,color:"#C9724C"}}>
                  faltan {fmt(v.falta)} {VP_UNIDADES.find(u=>u.id===v.unidad)?.label}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Botón cocinar — descuenta del stock y guarda los tuppers preparados */}
      <button onClick={descontarDeStock} disabled={descontado}
        style={{width:"100%",padding:"12px",borderRadius:3,
          background:descontado?G.surf2:G.gold,
          border:descontado?`1px solid ${G.border}`:"none",
          color:descontado?G.textDim:G.bg,fontSize:13,fontWeight:700,letterSpacing:1,
          cursor:descontado?"default":"pointer"}}>
        {descontado ? `✓ ${tuppers} TUPPER${tuppers!==1?"S":""} LISTO${tuppers!==1?"S":""}` : "🍳 COCINAR Y ARMAR TUPPERS"}
      </button>
      <div style={{fontSize:10,color:G.textDim,marginTop:8,textAlign:"center"}}>
        Si algo no coincide, podés ajustarlo manualmente después en 📦 Stock
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PANTALLA DE SELECCIÓN — 5 PILARES
// ═══════════════════════════════════════════════════════════════════════════════
function VpSelector({ onSelect, onSelectHoy, onSelectCompras, onSelectLogros }) {
  const [codigo, setCodigo] = useState("");
  const [err, setErr]       = useState("");
  const [scores, setScores] = useState({});
  const [rachas, setRachas] = useState({});
  const [mesActual]         = useState(() => hoyVp().mesId);
  const CODIGOS = { FE:"fe", TRADING:"trading", HOGAR:"hogar", FIT:"fitness", NUTR:"nutricion", VISION:"vision" };

  useEffect(() => {
    if (!firebaseOk) return;
    Promise.all(
      [0,1,2,3].flatMap(wi =>
        DIAS.map((_, di) =>
          getDoc(doc(db, vpDayPath(mesActual, wi, di))).then(snap => ({
            pilares: snap.exists() ? snap.data().pilares || {} : null
          }))
        )
      )
    ).then(results => {
      const st = {};
      VP_PILARES.forEach(p => { st[p.id] = { logrado:0, total:0, dias:0 }; });
      results.forEach(({ pilares }) => {
        if (!pilares) return;
        VP_PILARES.forEach(p => {
          const h = pilares[p.id]?.habitos || {};
          const comp = p.habitos.filter(hab => h[hab.id]).length;
          if (comp > 0 || Object.keys(h).length > 0) {
            st[p.id].logrado += comp;
            st[p.id].total   += p.habitos.length;
            st[p.id].dias++;
          }
        });
      });
      const final = {};
      VP_PILARES.forEach(p => {
        const s = st[p.id];
        final[p.id] = {
          pct: s.total > 0 ? Math.round((s.logrado/s.total)*100) : 0,
          diasCon: s.dias, logrado: s.logrado, total: s.total,
        };
      });
      setScores(final);
    });

    // Calcular racha real de días consecutivos por pilar
    Promise.all(VP_PILARES.map(p => calcularRacha(p.id).then(r => ({ id: p.id, r }))))
      .then(results => {
        const rmap = {};
        results.forEach(({ id, r }) => { rmap[id] = r; });
        setRachas(rmap);
      });
  }, [mesActual]);

  function entrar() {
    const k = codigo.toUpperCase().trim();
    if (CODIGOS[k]) { onSelect(CODIGOS[k]); setErr(""); }
    else setErr("Código no válido · FE · TRADING · HOGAR · FIT · NUTR · VISION");
  }

  const DESC = {
    fe:"Jarvis Wake Up · Salmos 119:97 · Intención del día",
    trading:"Cuenta de fondeo EUR/DOL · Registro de operaciones",
    hogar:"Orden, limpieza y preparación del entorno",
    fitness:"CrossFit · WOD · Fuerza · Peso corporal",
    nutricion:"2 Tuppers + Desayuno · Macros · Cocina · Stock",
    vision:'"El Loco" · Acción diaria · Tapas 2',
  };

  const ranking = [...VP_PILARES]
    .map(p => ({ ...p, pct: scores[p.id]?.pct || 0 }))
    .sort((a,b) => b.pct - a.pct);

  return (
    <div style={{minHeight:"100vh",background:G.bg,fontFamily:"'Courier New',monospace",
      padding:"28px 16px 56px",maxWidth:430,margin:"0 auto",position:"relative",overflow:"hidden"}}>

      {/* Grid de fondo */}
      <div style={{position:"fixed",inset:0,opacity:.04,pointerEvents:"none",
        backgroundImage:`linear-gradient(${G.gold} 1px,transparent 1px),linear-gradient(90deg,${G.gold} 1px,transparent 1px)`,
        backgroundSize:"36px 36px"}}/>

      {/* Header */}
      <div style={{textAlign:"center",marginBottom:20,position:"relative"}}>
        <div style={{width:1,height:36,background:`linear-gradient(to bottom,transparent,${G.gold})`,margin:"0 auto 12px"}}/>
        <div style={{fontSize:11,color:G.gold,letterSpacing:5,marginBottom:4}}>UN NUEVO COMIENZO</div>
        <div style={{fontSize:18,fontWeight:700,color:G.text,letterSpacing:2,marginBottom:2}}>
          TAPAS 2
        </div>
        <div style={{fontSize:9,color:G.textDim,letterSpacing:3}}>14.06.2026 · SISTEMA ACTIVO</div>
        <div style={{width:1,height:20,background:`linear-gradient(to bottom,${G.gold},transparent)`,margin:"12px auto 0"}}/>
      </div>

      {/* Botón HOY — acceso directo al día actual sin navegar mes/semana */}
      <div style={{display:"flex",gap:6,marginBottom:20}}>
        {onSelectHoy && (
          <button onClick={onSelectHoy}
            style={{
              flex:1, padding:"12px 6px",
              background:G.goldDim, border:`1px solid ${G.goldMid}`,
              borderRadius:4, color:G.gold, fontSize:10, letterSpacing:1,
              fontFamily:"'Courier New',monospace", fontWeight:700,
              cursor:"pointer", touchAction:"manipulation",
              WebkitTapHighlightColor:"transparent",
            }}>
            ⚡ HOY
          </button>
        )}
        {onSelectCompras && (
          <button onClick={onSelectCompras}
            style={{
              flex:1, padding:"12px 6px",
              background:G.surf, border:`1px solid ${G.border}`,
              borderRadius:4, color:G.textSec, fontSize:10, letterSpacing:1,
              fontFamily:"'Courier New',monospace", fontWeight:700,
              cursor:"pointer", touchAction:"manipulation",
              WebkitTapHighlightColor:"transparent",
            }}>
            🛒 COMPRAS
          </button>
        )}
        {onSelectLogros && (
          <button onClick={onSelectLogros}
            style={{
              flex:1, padding:"12px 6px",
              background:G.surf, border:`1px solid ${G.border}`,
              borderRadius:4, color:G.textSec, fontSize:10, letterSpacing:1,
              fontFamily:"'Courier New',monospace", fontWeight:700,
              cursor:"pointer", touchAction:"manipulation",
              WebkitTapHighlightColor:"transparent",
            }}>
            🏆 TROFEOS
          </button>
        )}
      </div>


      {/* Pilares */}
      {VP_PILARES.map(p => {
        const sc = scores[p.id];
        const pct = sc?.pct || 0;
        const cod = p.id==="fitness"?"FIT":p.id==="nutricion"?"NUTR":p.id.toUpperCase();
        const pctColor = pct===0?G.textDim:pct<50?"#C9724C":pct<80?G.gold:G.ok;
        const racha = rachas[p.id] || 0;
        return (
          <div key={p.id} onClick={() => onSelect(p.id)}
            style={{borderRadius:4,marginBottom:6,cursor:"pointer",overflow:"hidden",
              border:`1px solid ${p.color.border}33`,background:p.color.bg,
              transition:"border-color .15s,transform .1s"}}
            onMouseOver={e=>{e.currentTarget.style.borderColor=p.color.border;e.currentTarget.style.transform="translateX(2px)";}}
            onMouseOut={e=>{e.currentTarget.style.borderColor=`${p.color.border}33`;e.currentTarget.style.transform="none";}}>

            <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px 6px"}}>
              {/* Icono con vela de racha */}
              <div style={{position:"relative",flexShrink:0}}>
                <div style={{width:34,height:34,borderRadius:3,display:"flex",
                  alignItems:"center",justifyContent:"center",fontSize:18,
                  border:`1px solid ${p.color.border}44`,background:`${p.color.border}11`}}>
                  {p.color.emoji}
                </div>
                {racha > 0 && (
                  <div title={`${racha} días consecutivos`}
                    style={{position:"absolute",bottom:-6,right:-6,
                      width:18,height:18,borderRadius:"50%",
                      background:G.bg,border:`1px solid ${G.goldMid}`,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      boxShadow:`0 0 ${4+Math.min(8,racha)}px ${G.gold}`}}>
                    <span style={{fontSize:9}}>🔥</span>
                  </div>
                )}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,color:p.color.text,letterSpacing:1,marginBottom:2}}>
                  {p.label.toUpperCase()}
                </div>
                <div style={{fontSize:10,color:G.textSec,fontFamily:"system-ui,sans-serif"}}>{DESC[p.id]}</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:3,flexShrink:0}}>
                <div style={{fontSize:9,color:p.color.text,border:`1px solid ${p.color.border}55`,
                  borderRadius:2,padding:"1px 6px",letterSpacing:2,fontWeight:700}}>{cod}</div>
                <div style={{fontSize:15,fontWeight:700,color:pctColor,fontFamily:"system-ui,sans-serif"}}>
                  {sc?`${pct}%`:"—"}
                </div>
              </div>
            </div>

            {/* Barra */}
            <div style={{margin:"0 14px 6px"}}>
              <div style={{height:2,background:"#ffffff08",borderRadius:1,overflow:"hidden"}}>
                <div style={{height:2,width:`${pct}%`,background:p.color.dot,
                  borderRadius:1,transition:"width .6s ease",
                  boxShadow:`0 0 6px ${p.color.dot}`}}/>
              </div>
            </div>

            {/* Stats */}
            <div style={{display:"flex",gap:12,padding:"2px 14px 10px",fontFamily:"system-ui,sans-serif"}}>
              <div style={{fontSize:10,color:G.textDim}}>
                <span style={{color:pctColor,fontWeight:600}}>{sc?.logrado||0}</span>
                <span>/{sc?.total||0} hábitos</span>
              </div>
              {racha>0&&(
                <div style={{fontSize:10,color:G.textDim}}>
                  <span style={{color:G.gold,fontWeight:600}}>🔥 {racha}</span>
                  <span> {racha===1?"día":"días"} seguidos</span>
                </div>
              )}
              {sc?.diasCon>0&&(
                <div style={{fontSize:10,color:G.textDim}}>
                  <span style={{color:p.color.text,fontWeight:600}}>{sc.diasCon}</span>
                  <span> días</span>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Ranking */}
      {Object.keys(scores).length > 0 && (
        <div style={{border:`1px solid ${G.border}`,borderRadius:4,background:G.surf,
          padding:"14px",marginTop:10,marginBottom:14}}>
          <div style={{fontSize:9,color:G.gold,letterSpacing:3,marginBottom:10}}>
            RANKING · {mesActual.replace("_"," ").toUpperCase()}
          </div>
          {ranking.map((p, i) => {
            const pct = p.pct;
            const medal = i===0?"I":i===1?"II":i===2?"III":i===3?"IV":"V";
            const pctColor = pct===0?G.textDim:pct<50?"#C9724C":pct<80?G.gold:G.ok;
            return (
              <div key={p.id} onClick={() => onSelect(p.id)}
                style={{display:"flex",alignItems:"center",gap:8,padding:"7px 8px",
                  borderRadius:3,marginBottom:3,cursor:"pointer",
                  border:`1px solid ${p.color.border}22`,background:p.color.bg,
                  fontFamily:"system-ui,sans-serif"}}>
                <span style={{fontSize:9,color:G.textDim,width:18,textAlign:"center",
                  fontFamily:"'Courier New',monospace",letterSpacing:1}}>{medal}</span>
                <span style={{fontSize:14}}>{p.color.emoji}</span>
                <span style={{flex:1,fontSize:11,color:G.textSec}}>{p.label}</span>
                <div style={{width:48,height:3,background:"#ffffff08",borderRadius:1,overflow:"hidden"}}>
                  <div style={{height:3,width:`${pct}%`,background:p.color.dot,borderRadius:1}}/>
                </div>
                <span style={{fontSize:11,fontWeight:600,color:pctColor,minWidth:30,textAlign:"right"}}>
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Código */}
      <div style={{marginTop:8}}>
        <div style={{fontSize:9,color:G.textDim,marginBottom:8,textAlign:"center",letterSpacing:2}}>
          O INGRESÁ EL CÓDIGO
        </div>
        <div style={{display:"flex",gap:6}}>
          <input value={codigo} onChange={e=>setCodigo(e.target.value.toUpperCase())}
            onKeyDown={e=>e.key==="Enter"&&entrar()}
            placeholder="FE · TRADING · HOGAR · FIT · NUTR · VISION"
            style={{...S.inp(false),letterSpacing:2,fontSize:12}}/>
          <button onClick={entrar}
            style={{padding:"8px 16px",borderRadius:3,background:G.gold,
              border:"none",color:G.bg,fontSize:13,cursor:"pointer",fontWeight:700,
              fontFamily:"'Courier New',monospace"}}>
            →
          </button>
        </div>
        {err&&<div style={{fontSize:10,color:"#C9724C",marginTop:6,textAlign:"center",letterSpacing:1}}>{err}</div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTRO DE EJERCICIO — carga marca, detecta PR automático, permite marcar manual
// ═══════════════════════════════════════════════════════════════════════════════
function VpRegistroEjercicio({ baseEjercicios, onLogroNuevo }) {
  const [ejercicioId, setEjercicioId] = useState(baseEjercicios[0]?.id || "");
  const [reps, setReps]     = useState("");
  const [kg, setKg]         = useState("");
  const [rondas, setRondas] = useState("");
  const [tiempo, setTiempo] = useState(""); // "MM:SS"
  const [notaLibre, setNotaLibre] = useState("");
  const [forzarLogro, setForzarLogro] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [ultimoResultado, setUltimoResultado] = useState(null); // {esPR, trofeo}

  const ejercicio = baseEjercicios.find(e => e.id === ejercicioId);

  async function registrar() {
    if (!ejercicio) return;
    setGuardando(true);
    const path = vpEjercicioPath(ejercicioId);

    let historial = [];
    if (firebaseOk) {
      try {
        const snap = await getDoc(doc(db, path));
        historial = snap.exists() ? snap.data().marcas || [] : [];
      } catch(e) {}
    }

    // Determinar valor relevante según unidad del ejercicio
    const esTiempo = ejercicio.unidad === "tiempo";
    const esAmrap  = ejercicio.unidad === "amrap";
    const valorPeso   = kg ? parseFloat(kg.replace(",",".")) : null;
    const valorReps   = reps ? parseInt(reps) : null;
    const valorRondas = rondas ? parseInt(rondas) : null;
    const valorTiempoSeg = vpTiempoASegundos(tiempo);

    // Mejores marcas anteriores por tipo
    const mejorPesoAnt   = historial.filter(h=>h.kg!=null).reduce((m,h)=>Math.max(m??-Infinity,h.kg),null);
    const mejorRepsAnt   = historial.filter(h=>h.reps!=null).reduce((m,h)=>Math.max(m??-Infinity,h.reps),null);
    const mejorRondasAnt = historial.filter(h=>h.rondas!=null).reduce((m,h)=>Math.max(m??-Infinity,h.rondas),null);
    const mejorTiempoAnt = historial.filter(h=>h.tiempoSeg!=null).reduce((m,h)=>Math.min(m??Infinity,h.tiempoSeg),null);

    const prPeso   = valorPeso!=null   && vpEsRecordPersonal(valorPeso, mejorPesoAnt, "mayor");
    const prReps   = valorReps!=null   && vpEsRecordPersonal(valorReps, mejorRepsAnt, "mayor");
    const prRondas = valorRondas!=null && vpEsRecordPersonal(valorRondas, mejorRondasAnt, "mayor");
    const prTiempo = valorTiempoSeg!=null && vpEsRecordPersonal(valorTiempoSeg, mejorTiempoAnt, "menor");

    const esPR = prPeso || prReps || prRondas || prTiempo || forzarLogro;

    const marca = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      fecha: Date.now(),
      kg: valorPeso, reps: valorReps, rondas: valorRondas,
      tiempo: tiempo || null, tiempoSeg: valorTiempoSeg,
      nota: notaLibre || null, esPR, manual: forzarLogro,
    };

    historial = [...historial, marca];
    if (firebaseOk) {
      try { await setDoc(doc(db, path), { marcas: historial }); } catch(e) {}
    }

    // Si es PR, registrar logro/trofeo
    if (esPR) {
      let tipoTrofeo = "manual";
      if (prPeso) tipoTrofeo = "peso";
      else if (prTiempo) tipoTrofeo = "tiempo";
      else if (prRondas) tipoTrofeo = "rondas";
      else if (prReps) tipoTrofeo = "reps";

      const detalle = [
        valorPeso!=null?`${valorPeso}kg`:null,
        valorReps!=null?`${valorReps} reps`:null,
        valorRondas!=null?`${valorRondas} rondas`:null,
        tiempo?`${tiempo}`:null,
      ].filter(Boolean).join(" · ");

      const logro = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
        fecha: Date.now(),
        ejercicioId, ejercicioLabel: ejercicio.label,
        tipo: tipoTrofeo, detalle,
        manual: forzarLogro && !(prPeso||prReps||prRondas||prTiempo),
      };

      if (firebaseOk) {
        try {
          const snapL = await getDoc(doc(db, vpLogrosPath()));
          const logrosAct = snapL.exists() ? snapL.data().items || [] : [];
          await setDoc(doc(db, vpLogrosPath()), { items: [...logrosAct, logro] });
        } catch(e) {}
      }
      onLogroNuevo?.(logro);
    }

    setUltimoResultado({ esPR, ejercicio: ejercicio.label });
    setReps(""); setKg(""); setRondas(""); setTiempo(""); setNotaLibre(""); setForzarLogro(false);
    setGuardando(false);
    setTimeout(()=>setUltimoResultado(null), 4000);
  }

  return (
    <div style={{border:`1px solid ${G.border}`,borderRadius:4,padding:"12px",background:G.surf,marginBottom:8}}>
      <div style={{fontSize:9,color:G.gold,letterSpacing:2,marginBottom:8}}>REGISTRAR EJERCICIO</div>

      <select value={ejercicioId} onChange={e=>setEjercicioId(e.target.value)}
        style={{...S.inp(false),marginBottom:8,cursor:"pointer"}}>
        {baseEjercicios.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
      </select>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
        <div>
          <div style={{fontSize:9,color:G.textDim,marginBottom:3}}>KG</div>
          <input value={kg} onChange={e=>setKg(e.target.value)} placeholder="0" type="text" inputMode="decimal"
            style={{...S.inp(false),textAlign:"center"}}/>
        </div>
        <div>
          <div style={{fontSize:9,color:G.textDim,marginBottom:3}}>REPS</div>
          <input value={reps} onChange={e=>setReps(e.target.value)} placeholder="0" type="text" inputMode="numeric"
            style={{...S.inp(false),textAlign:"center"}}/>
        </div>
        <div>
          <div style={{fontSize:9,color:G.textDim,marginBottom:3}}>RONDAS</div>
          <input value={rondas} onChange={e=>setRondas(e.target.value)} placeholder="0" type="text" inputMode="numeric"
            style={{...S.inp(false),textAlign:"center"}}/>
        </div>
        <div>
          <div style={{fontSize:9,color:G.textDim,marginBottom:3}}>TIEMPO (MM:SS)</div>
          <input value={tiempo} onChange={e=>setTiempo(e.target.value)} placeholder="8:42"
            style={{...S.inp(false),textAlign:"center"}}/>
        </div>
      </div>

      <input value={notaLibre} onChange={e=>setNotaLibre(e.target.value)}
        placeholder="Nota (RX, escalado, sensación...)"
        style={{...S.inp(false),marginBottom:8,fontSize:12}}/>

      <div onClick={()=>setForzarLogro(v=>!v)}
        style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",marginBottom:8,
          border:`1px solid ${forzarLogro?G.gold:G.border}`,borderRadius:3,cursor:"pointer",
          background:forzarLogro?G.goldDim:G.surf2}}>
        <div style={{width:16,height:16,borderRadius:2,flexShrink:0,display:"flex",
          alignItems:"center",justifyContent:"center",fontSize:10,
          border:`1.5px solid ${forzarLogro?G.gold:G.textDim}`,
          background:forzarLogro?G.gold:"transparent",color:G.bg,fontWeight:700}}>
          {forzarLogro&&"✓"}
        </div>
        <span style={{fontSize:11,color:forzarLogro?G.gold:G.textSec}}>
          ⭐ Marcar como logro manual (aunque no sea PR automático)
        </span>
      </div>

      <button onClick={registrar} disabled={guardando}
        style={{width:"100%",padding:"10px",borderRadius:3,background:G.gold,
          border:"none",color:G.bg,fontSize:12,fontWeight:700,letterSpacing:1,
          cursor:guardando?"default":"pointer",opacity:guardando?.6:1}}>
        {guardando?"GUARDANDO…":"REGISTRAR MARCA"}
      </button>

      {ultimoResultado && (
        <div style={{marginTop:10,padding:"10px",borderRadius:3,textAlign:"center",
          border:`1px solid ${ultimoResultado.esPR?G.gold:G.border}`,
          background:ultimoResultado.esPR?G.goldDim:G.surf2,
          animation:ultimoResultado.esPR?"none":"none"}}>
          {ultimoResultado.esPR ? (
            <div style={{fontSize:12,color:G.gold,fontWeight:700}}>
              🏆 ¡SUPERACIÓN PERSONAL! · {ultimoResultado.ejercicio}
            </div>
          ) : (
            <div style={{fontSize:11,color:G.textSec}}>Marca registrada · {ultimoResultado.ejercicio}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PANTALLA DE LOGROS — Trofeos, hitos con fecha/hora, ramas por categoría
// ═══════════════════════════════════════════════════════════════════════════════
function VpLogrosScreen({ onBack }) {
  const [logros, setLogros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("todos");
  const [nuevoTexto, setNuevoTexto] = useState("");
  const [mostrarAgregar, setMostrarAgregar] = useState(false);

  useEffect(() => {
    if (!firebaseOk) { setLoading(false); return; }
    getDoc(doc(db, vpLogrosPath())).then(snap => {
      setLogros(snap.exists() ? (snap.data().items || []).sort((a,b)=>b.fecha-a.fecha) : []);
      setLoading(false);
    }).catch(()=>setLoading(false));
  }, []);

  async function agregarLogroLibre() {
    const texto = nuevoTexto.trim();
    if (!texto) return;
    const logro = {
      id:`${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      fecha:Date.now(), ejercicioId:null, ejercicioLabel:null,
      tipo:"manual", detalle:texto, manual:true,
    };
    const nuevos = [logro, ...logros];
    setLogros(nuevos);
    setNuevoTexto(""); setMostrarAgregar(false);
    if (firebaseOk) {
      try { await setDoc(doc(db, vpLogrosPath()), { items: nuevos }); } catch(e) {}
    }
  }

  async function eliminarLogro(id) {
    const nuevos = logros.filter(l=>l.id!==id);
    setLogros(nuevos);
    if (firebaseOk) {
      try { await setDoc(doc(db, vpLogrosPath()), { items: nuevos }); } catch(e) {}
    }
  }

  const categorias = [
    { id:"todos",  label:"Todos", emoji:"🏆" },
    { id:"peso",   label:"Peso",  emoji:"🏆" },
    { id:"tiempo", label:"Tiempo",emoji:"⏱️" },
    { id:"reps",   label:"Reps",  emoji:"🔥" },
    { id:"rondas", label:"Rondas",emoji:"🌀" },
    { id:"manual", label:"Personal",emoji:"⭐" },
  ];

  const logrosFiltrados = filtro==="todos" ? logros : logros.filter(l=>l.tipo===filtro);

  // Conteo por categoría para el resumen
  const conteos = {};
  Object.keys(VP_TROFEOS).forEach(k => { conteos[k] = logros.filter(l=>l.tipo===k).length; });

  return (
    <div style={{minHeight:"100vh",background:G.bg,fontFamily:"system-ui,sans-serif",
      padding:"24px 16px 56px",maxWidth:430,margin:"0 auto"}}>

      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
        <button onClick={onBack} style={S.btn(false,false)}>← Pilares</button>
      </div>

      <div style={{textAlign:"center",marginBottom:20}}>
        <div style={{fontSize:30,marginBottom:6}}>🏆</div>
        <div style={{fontSize:14,fontWeight:700,color:G.gold,letterSpacing:2,fontFamily:"'Courier New',monospace"}}>
          MIS TROFEOS
        </div>
        <div style={{fontSize:10,color:G.textDim,marginTop:4,letterSpacing:1}}>
          "NO COMPITO CON NADIE MÁS, SOLO CONMIGO MISMO"
        </div>
      </div>

      {/* Resumen por rama */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:16}}>
        {Object.entries(VP_TROFEOS).filter(([k])=>k!=="fe").map(([k,t]) => (
          <div key={k} style={{border:`1px solid ${t.color}33`,borderRadius:4,padding:"10px 6px",
            background:`${t.color}11`,textAlign:"center"}}>
            <div style={{fontSize:18,marginBottom:3}}>{t.emoji}</div>
            <div style={{fontSize:16,fontWeight:700,color:t.color}}>{conteos[k]||0}</div>
            <div style={{fontSize:8,color:G.textDim,letterSpacing:.5,marginTop:2}}>{t.label.toUpperCase()}</div>
          </div>
        ))}
      </div>

      {/* Tabs filtro */}
      <div style={{display:"flex",gap:4,marginBottom:14,overflowX:"auto"}}>
        {categorias.map(c => {
          const active = filtro===c.id;
          return (
            <button key={c.id} onClick={()=>setFiltro(c.id)}
              style={{whiteSpace:"nowrap",padding:"6px 10px",fontSize:11,cursor:"pointer",
                border:`1px solid ${active?G.gold:G.border}`,borderRadius:3,
                background:active?G.goldDim:G.surf2,
                color:active?G.gold:G.textSec,fontWeight:active?600:400}}>
              {c.emoji} {c.label}
            </button>
          );
        })}
      </div>

      {/* Botón agregar logro libre */}
      {!mostrarAgregar ? (
        <button onClick={()=>setMostrarAgregar(true)}
          style={{width:"100%",padding:"10px",marginBottom:14,borderRadius:3,
            border:`1px dashed ${G.border}`,background:"transparent",
            color:G.textSec,fontSize:11,cursor:"pointer"}}>
          + Agregar logro personal (no físico)
        </button>
      ) : (
        <div style={{border:`1px solid ${G.gold}`,borderRadius:4,padding:"10px",marginBottom:14,background:G.surf}}>
          <textarea value={nuevoTexto} onChange={e=>setNuevoTexto(e.target.value)}
            placeholder='Ej: "Hoy recibí el Espíritu Santo, nuevamente bautizado"'
            style={{...S.inp(false),height:60,resize:"none",marginBottom:8}}/>
          <div style={{display:"flex",gap:6}}>
            <button onClick={agregarLogroLibre}
              style={{flex:1,padding:"8px",borderRadius:3,background:G.gold,border:"none",
                color:G.bg,fontSize:11,fontWeight:700,cursor:"pointer"}}>GUARDAR</button>
            <button onClick={()=>{setMostrarAgregar(false);setNuevoTexto("");}}
              style={{flex:1,padding:"8px",borderRadius:3,background:G.surf2,
                border:`1px solid ${G.border}`,color:G.textSec,fontSize:11,cursor:"pointer"}}>CANCELAR</button>
          </div>
        </div>
      )}

      {/* Línea de tiempo de logros */}
      {loading ? (
        <div style={{textAlign:"center",color:G.textDim,fontSize:11,padding:20,letterSpacing:1,
          fontFamily:"'Courier New',monospace"}}>CARGANDO TROFEOS...</div>
      ) : logrosFiltrados.length===0 ? (
        <div style={{textAlign:"center",color:G.textDim,fontSize:12,padding:30}}>
          Todavía no hay trofeos en esta rama.<br/>Cada superación va a quedar registrada aquí.
        </div>
      ) : (
        logrosFiltrados.map(l => {
          const t = VP_TROFEOS[l.tipo] || VP_TROFEOS.manual;
          return (
            <div key={l.id} style={{display:"flex",gap:10,marginBottom:10,
              border:`1px solid ${t.color}33`,borderRadius:4,padding:"12px",background:`${t.color}0d`}}>
              <div style={{fontSize:24,flexShrink:0}}>{t.emoji}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:t.color,marginBottom:2}}>
                  {l.ejercicioLabel || "Logro Personal"}
                  {l.manual && <span style={{fontSize:9,marginLeft:6,color:G.textDim}}>(manual)</span>}
                </div>
                <div style={{fontSize:12,color:G.text,marginBottom:4}}>{l.detalle}</div>
                <div style={{fontSize:10,color:G.textDim,letterSpacing:.5}}>{vpFormatoFechaHora(l.fecha)}</div>
              </div>
              <button onClick={()=>eliminarLogro(l.id)}
                style={{background:"none",border:"none",color:G.textDim,fontSize:14,
                  cursor:"pointer",padding:"0 2px",alignSelf:"flex-start"}}>×</button>
            </div>
          );
        })
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TUPPERS REALES — los preparados desde Cocina, con sus ingredientes e info exacta
// ═══════════════════════════════════════════════════════════════════════════════
function VpTuppersReales() {
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseOk) { setLoading(false); return; }
    getDoc(doc(db, vpTuppersPreparadosPath())).then(snap => {
      setLotes(snap.exists() ? snap.data().items || [] : []);
      setLoading(false);
    }).catch(()=>setLoading(false));
  }, []);

  async function marcarConsumido(loteId) {
    const nuevos = lotes.map(l => l.id===loteId ? { ...l, consumidos: Math.min(l.cantTuppers, l.consumidos+1) } : l);
    setLotes(nuevos);
    if (!firebaseOk) return;
    try { await setDoc(doc(db, vpTuppersPreparadosPath()), { items: nuevos }); } catch(e) {}
  }

  const fmt = n => n.toLocaleString("es-AR",{minimumFractionDigits:0,maximumFractionDigits:1});
  // Solo mostramos lotes que todavía tienen tuppers disponibles (no consumidos del todo)
  const lotesDisponibles = lotes.filter(l => l.consumidos < l.cantTuppers);

  if (loading) return null;
  if (lotesDisponibles.length===0) return (
    <div style={{border:`1px dashed ${G.border}`,borderRadius:4,padding:"12px",marginBottom:8,textAlign:"center"}}>
      <div style={{fontSize:10,color:G.textDim}}>
        No hay tuppers preparados todavía. Cociná una receta en 🍳 Cocina para que aparezcan acá.
      </div>
    </div>
  );

  return (
    <div style={{marginBottom:8}}>
      <div style={{fontSize:9,color:G.gold,letterSpacing:2,marginBottom:8}}>📦 TUPPERS PREPARADOS (DESDE COCINA)</div>
      {lotesDisponibles.map(lote => {
        const disponibles = lote.cantTuppers - lote.consumidos;
        return (
          <div key={lote.id} style={{border:`1px solid ${G.goldMid}`,borderRadius:4,
            padding:"12px",background:G.goldDim,marginBottom:6}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{fontSize:13,fontWeight:600,color:G.text,textTransform:"capitalize"}}>{lote.recetaNombre}</div>
              <div style={{fontSize:11,fontWeight:700,color:G.gold}}>{disponibles} disp.</div>
            </div>
            <div style={{display:"flex",gap:10,fontSize:10,color:G.textSec,marginBottom:8}}>
              <span>{fmt(lote.nutricionPorTupper.kcal)} kcal</span>
              <span>{fmt(lote.nutricionPorTupper.prot)}g prot</span>
              <span>{fmt(lote.nutricionPorTupper.carbs)}g carb</span>
              <span>{fmt(lote.nutricionPorTupper.grasas)}g grasa</span>
            </div>
            <div style={{fontSize:10,color:G.textDim,marginBottom:8}}>
              {lote.ingredientesPorTupper.map((ing,i)=>(
                <span key={i}>
                  {ing.nombre} {fmt(ing.cantidad)}{VP_UNIDADES.find(u=>u.id===ing.unidad)?.label}
                  {i<lote.ingredientesPorTupper.length-1?" · ":""}
                </span>
              ))}
            </div>
            <button onClick={()=>marcarConsumido(lote.id)}
              style={{width:"100%",padding:"7px",borderRadius:3,background:G.gold,
                border:"none",color:G.bg,fontSize:11,fontWeight:700,cursor:"pointer"}}>
              ✓ COMÍ ESTE TUPPER
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGISTRO DIARIO DE UN PILAR
// ═══════════════════════════════════════════════════════════════════════════════
function VpPilarDia({ pilar, datos, onChange, onAbrirCocina, onAbrirStock }) {
  const [habitos, setHabitos] = useState(datos?.habitos || {});
  const [nota, setNota]       = useState(datos?.nota || "");
  // fitness extras
  const [tipoDia,  setTipoDia]  = useState(datos?.tipoDia || "entreno");
  const [tupper1,  setTupper1]  = useState(datos?.tupper1 || "base");
  const [tupper2,  setTupper2]  = useState(datos?.tupper2 || "cena_entreno");
  const [peso,     setPeso]     = useState(datos?.peso || "");
  const [wod,      setWod]      = useState(datos?.wod || "");
  // trading extras
  const [resultadoUSD, setResultadoUSD] = useState(datos?.resultadoUSD || "");
  const [equityCuenta, setEquityCuenta] = useState(datos?.equityCuenta || "");
  const [cantOperaciones, setCantOperaciones] = useState(datos?.cantOperaciones || "");
  // control de sincronización — evita pisar datos reales con un guardado prematuro
  const [listo, setListo] = useState(false);
  const datosRef = useRef(null);

  // Si "datos" llega o cambia desde afuera (ej: Firebase respondió después del montaje),
  // sincronizamos el estado local UNA SOLA VEZ por cada "datos" distinto que llegue,
  // así nunca pisamos con el valor inicial vacío.
  useEffect(() => {
    if (datos !== datosRef.current) {
      datosRef.current = datos;
      setHabitos(datos?.habitos || {});
      setNota(datos?.nota || "");
      setTipoDia(datos?.tipoDia || "entreno");
      setTupper1(datos?.tupper1 || "base");
      setTupper2(datos?.tupper2 || "cena_entreno");
      setPeso(datos?.peso || "");
      setWod(datos?.wod || "");
      setResultadoUSD(datos?.resultadoUSD || "");
      setEquityCuenta(datos?.equityCuenta || "");
      setCantOperaciones(datos?.cantOperaciones || "");
      setListo(true);
    }
  }, [datos]);

  useEffect(() => {
    if (!listo) return; // no guardar hasta que el estado esté sincronizado con datos reales
    const payload = { habitos, nota };
    if (pilar.esFitness) Object.assign(payload, { tipoDia, tupper1, tupper2, peso, wod });
    if (pilar.esTrading) Object.assign(payload, { resultadoUSD, equityCuenta, cantOperaciones });
    onChange(payload);
  }, [listo, habitos, nota, tipoDia, tupper1, tupper2, peso, wod, resultadoUSD, equityCuenta, cantOperaciones]);

  function toggleH(id) { setHabitos(p => ({ ...p, [id]: !p[id] })); }


  const completados = pilar.habitos.filter(h => habitos[h.id]).length;
  const pct = Math.round((completados / pilar.habitos.length) * 100);
  const c = pilar.color;

  const t1 = VP_TUPPERS[tupper1];
  const t2 = VP_TUPPERS[tupper2];
  const totalKcal = pilar.esFitness ? VP_DESAYUNO.kcal + t1.kcal + t2.kcal : 0;
  const totalProt = pilar.esFitness ? VP_DESAYUNO.prot + t1.prot + t2.prot : 0;

  return (
    <div>
      {/* Progreso del pilar */}
      <div style={{borderRadius:4,padding:"14px",background:c.bg,
        border:`1px solid ${c.border}55`,marginBottom:8}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{fontSize:12,fontWeight:600,color:c.text,letterSpacing:1,fontFamily:"system-ui,sans-serif"}}>
            {c.emoji} {pilar.label.toUpperCase()}
          </div>
          <div style={{fontSize:18,fontWeight:700,color:c.text}}>{pct}%</div>
        </div>
        <div style={{height:4,background:"#ffffff10",borderRadius:2,overflow:"hidden"}}>
          <div style={{height:4,width:`${pct}%`,background:c.dot,borderRadius:2,transition:"width .3s",
            boxShadow:`0 0 6px ${c.dot}`}}/>
        </div>
        <div style={{fontSize:11,color:c.text,marginTop:6,opacity:.75,fontFamily:"system-ui,sans-serif"}}>
          {completados} de {pilar.habitos.length} hábitos completados
        </div>
      </div>

      {/* Hábitos */}
      <div style={{border:`1px solid ${G.border}`,borderRadius:4,padding:"12px",background:G.surf,marginBottom:8}}>
        <div style={{fontSize:9,color:G.gold,letterSpacing:2,marginBottom:8}}>HÁBITOS DEL DÍA</div>
        {pilar.habitos.map(h => (
          <div key={h.id} onClick={() => toggleH(h.id)}
            style={{display:"flex",alignItems:"center",gap:10,padding:"10px",
              border:`1px solid ${habitos[h.id]?c.border:G.border}`,
              borderRadius:3,marginBottom:5,cursor:"pointer",
              background:habitos[h.id]?c.bg:G.surf2}}>
            <div style={{width:18,height:18,borderRadius:2,flexShrink:0,display:"flex",
              alignItems:"center",justifyContent:"center",fontSize:11,
              border:`1.5px solid ${habitos[h.id]?c.dot:G.textDim}`,
              background:habitos[h.id]?c.dot:"transparent",color:G.bg,fontWeight:700}}>
              {habitos[h.id]&&"✓"}
            </div>
            <span style={{fontSize:12,color:habitos[h.id]?c.text:G.textSec,lineHeight:1.4,
              fontFamily:"system-ui,sans-serif"}}>
              {h.label}
            </span>
          </div>
        ))}
      </div>

      {/* Nota del día */}
      <div style={{border:`1px solid ${G.border}`,borderRadius:4,padding:"12px",background:G.surf,marginBottom:8}}>
        <div style={{fontSize:9,color:G.gold,letterSpacing:2,marginBottom:6}}>{pilar.notaLabel.toUpperCase()}</div>
        <textarea value={nota} onChange={e=>setNota(e.target.value)}
          placeholder="Escribí tu nota del día..."
          style={{...S.inp(false),height:72,resize:"none",fontFamily:"system-ui,sans-serif"}}/>
      </div>

      {/* Notas persistentes — biblioteca de recordatorios del pilar, no se pisan entre días */}
      <VpNotasPilar pilar={pilar} />

      {/* ── TRADING EXTRA ───────────────────────────────────────────────────── */}
      {pilar.esTrading && (
        <>
          <div style={{border:`1px solid ${G.border}`,borderRadius:4,padding:"12px",background:G.surf,marginBottom:8}}>
            <div style={{fontSize:9,color:G.gold,letterSpacing:2,marginBottom:8}}>RESULTADO DEL DÍA</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <div>
                <div style={{fontSize:10,color:G.textSec,marginBottom:4,fontFamily:"system-ui,sans-serif"}}>Resultado (USD)</div>
                <input type="number" step="0.01" value={resultadoUSD}
                  onChange={e=>setResultadoUSD(e.target.value)}
                  placeholder="+0.00 / -0.00"
                  style={{...S.inp(false),textAlign:"center",fontWeight:600,
                    color: resultadoUSD==="" ? G.text : parseFloat(resultadoUSD)>=0 ? "#7AB85A" : "#C9724C"}}/>
              </div>
              <div>
                <div style={{fontSize:10,color:G.textSec,marginBottom:4,fontFamily:"system-ui,sans-serif"}}>Operaciones</div>
                <input type="number" value={cantOperaciones}
                  onChange={e=>setCantOperaciones(e.target.value)}
                  placeholder="0"
                  style={{...S.inp(false),textAlign:"center",fontWeight:600}}/>
              </div>
            </div>
            <div>
              <div style={{fontSize:10,color:G.textSec,marginBottom:4,fontFamily:"system-ui,sans-serif"}}>
                Equity de la cuenta hoy (USD) — saldo total al cierre
              </div>
              <input type="number" step="0.01" value={equityCuenta}
                onChange={e=>setEquityCuenta(e.target.value)}
                placeholder="Ej: 10250.00"
                style={{...S.inp(false),textAlign:"center",fontSize:16,fontWeight:700,color:G.gold}}/>
              <div style={{fontSize:10,color:G.textDim,marginTop:5,fontFamily:"system-ui,sans-serif"}}>
                Registrarlo todos los días construye tu curva de equity en el resumen mensual
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── FITNESS EXTRA ───────────────────────────────────────────────────── */}
      {pilar.esFitness && (
        <>
          {/* Tipo de día */}
          <div style={{border:`1px solid ${G.border}`,borderRadius:4,padding:"12px",background:G.surf,marginBottom:8}}>
            <div style={{fontSize:9,color:G.gold,letterSpacing:2,marginBottom:6}}>TIPO DE DÍA</div>
            <div style={{display:"flex",gap:6}}>
              {[["entreno","🏋️ Entreno"],["descanso","😴 Descanso"]].map(([id,lbl])=>(
                <button key={id} onClick={()=>setTipoDia(id)}
                  style={{flex:1,padding:"8px",fontSize:12,borderRadius:3,cursor:"pointer",
                    border:`1px solid ${tipoDia===id?c.border:G.border}`,
                    background:tipoDia===id?c.bg:G.surf2,
                    color:tipoDia===id?c.text:G.textSec,fontWeight:tipoDia===id?600:400,
                    fontFamily:"system-ui,sans-serif"}}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* WOD — descripción libre + registro estructurado */}
          {tipoDia==="entreno"&&(
            <>
              <div style={{border:`1px solid ${G.border}`,borderRadius:4,padding:"12px",background:G.surf,marginBottom:8}}>
                <div style={{fontSize:9,color:G.gold,letterSpacing:2,marginBottom:6}}>WOD DEL DÍA</div>
                <textarea value={wod} onChange={e=>setWod(e.target.value)}
                  placeholder="Ej: Fran 21-15-9 Thruster/Pull-up · RX"
                  style={{...S.inp(false),height:52,resize:"none",fontFamily:"system-ui,sans-serif"}}/>
              </div>

              <VpRegistroEjercicio baseEjercicios={VP_EJERCICIOS_CROSSFIT} />

              <div style={{border:`1px solid ${G.border}`,borderRadius:4,padding:"12px",background:G.surf,marginBottom:8}}>
                <div style={{fontSize:9,color:G.gold,letterSpacing:2,marginBottom:8}}>FUERZA — RUTINA</div>
                <VpRegistroEjercicio baseEjercicios={VP_EJERCICIOS_FUERZA} />
              </div>
            </>
          )}

          {/* Peso */}
          <div style={{border:`1px solid ${G.border}`,borderRadius:4,padding:"12px",background:G.surf,marginBottom:8}}>
            <div style={{fontSize:9,color:G.gold,letterSpacing:2,marginBottom:6}}>PESO CORPORAL HOY (KG)</div>
            <input type="number" step="0.1" value={peso} onChange={e=>setPeso(e.target.value)}
              placeholder="95.0"
              style={{...S.inp(false),fontSize:18,textAlign:"center",fontWeight:600,color:G.gold}}/>
            <div style={{fontSize:10,color:G.textDim,marginTop:6,fontFamily:"system-ui,sans-serif"}}>
              Registrá en ayunas, mismo horario siempre
            </div>
          </div>
        </>
      )}

      {/* ── NUTRICIÓN EXTRA ─────────────────────────────────────────────────── */}
      {pilar.esNutricion && (
        <>
          {/* Accesos a Cocina / Recetas / Stock */}
          <div style={{display:"flex",gap:6,marginBottom:8}}>
            <button onClick={()=>onAbrirCocina?.()}
              style={{flex:1,padding:"10px 6px",borderRadius:3,
                border:`1px solid ${G.border}`,background:G.surf,
                color:G.textSec,fontSize:11,fontWeight:600,cursor:"pointer",
                touchAction:"manipulation",WebkitTapHighlightColor:"transparent"}}>
              🍳 COCINA
            </button>
            <button onClick={()=>onAbrirStock?.()}
              style={{flex:1,padding:"10px 6px",borderRadius:3,
                border:`1px solid ${G.border}`,background:G.surf,
                color:G.textSec,fontSize:11,fontWeight:600,cursor:"pointer",
                touchAction:"manipulation",WebkitTapHighlightColor:"transparent"}}>
              📦 STOCK
            </button>
          </div>

          {/* Tuppers reales preparados desde Cocina — fuente principal de info */}
          <VpTuppersReales />

          {/* Desayuno fijo */}
          <div style={{border:`1px solid ${G.border}`,borderRadius:4,padding:"12px",background:G.surf,marginBottom:8}}>
            <div style={{fontSize:13,fontWeight:600,color:G.text,marginBottom:8,fontFamily:"system-ui,sans-serif"}}>🥣 Desayuno (fijo)</div>
            {[["Avena cocida",`${VP_DESAYUNO.avena}g`],["Leche entera",`${VP_DESAYUNO.leche}ml`],
              ["Banana",`${VP_DESAYUNO.banana}g`],["Huevos enteros","3 unidades"]].map(([n,v])=>(
              <div key={n} style={{display:"flex",justifyContent:"space-between",fontSize:12,
                padding:"5px 0",borderBottom:`1px solid ${G.border}`,fontFamily:"system-ui,sans-serif"}}>
                <span style={{color:G.textSec}}>{n}</span>
                <span style={{fontWeight:500,color:G.text}}>{v}</span>
              </div>
            ))}
            <div style={{fontSize:11,color:G.textDim,marginTop:5,fontFamily:"system-ui,sans-serif"}}>
              {VP_DESAYUNO.prot}g prot · {VP_DESAYUNO.kcal} kcal
            </div>
          </div>

          {/* Tuppers plantilla — referencia fija, no descuentan stock ni vienen de una receta */}
          <div style={{fontSize:9,color:G.textDim,letterSpacing:2,marginTop:12,marginBottom:6}}>
            PLANTILLA MANUAL (referencia, sin conexión a Stock)
          </div>

          {/* Tupper 1 */}
          <div style={{border:`1px solid ${G.border}`,borderRadius:4,padding:"12px",background:G.surf,marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{fontSize:13,fontWeight:600,color:G.text,fontFamily:"system-ui,sans-serif"}}>📦 Tupper 1 — Almuerzo</div>
              <div style={{display:"flex",gap:4}}>
                {[["base","Est."],["almuerzo_desc","Red."]].map(([id,lbl])=>(
                  <button key={id} onClick={()=>setTupper1(id)} style={S.btnSm(tupper1===id)}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
            {[["🍗 Pollo",`${t1.pollo}g`],["🥔 Papa",`${t1.papa}g`],["🥦 Verduras",`${t1.verduras}g`],["🥚 Huevo",`${t1.huevo} u.`]].map(([n,v])=>(
              <div key={n} style={{display:"flex",justifyContent:"space-between",fontSize:12,
                padding:"5px 0",borderBottom:`1px solid ${G.border}`,fontFamily:"system-ui,sans-serif"}}>
                <span style={{color:G.textSec}}>{n}</span><span style={{fontWeight:500,color:G.text}}>{v}</span>
              </div>
            ))}
            <div style={{fontSize:11,color:G.textDim,marginTop:5,fontFamily:"system-ui,sans-serif"}}>{t1.prot}g prot · {t1.kcal} kcal</div>
          </div>

          {/* Tupper 2 */}
          <div style={{border:`1px solid ${G.border}`,borderRadius:4,padding:"12px",background:G.surf,marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{fontSize:13,fontWeight:600,color:G.text,fontFamily:"system-ui,sans-serif"}}>📦 Tupper 2 — Cena</div>
              <div style={{display:"flex",gap:4}}>
                {[["cena_entreno","Est."],["cena_descanso","Red."]].map(([id,lbl])=>(
                  <button key={id} onClick={()=>setTupper2(id)} style={S.btnSm(tupper2===id)}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
            {[["🍗 Pollo",`${t2.pollo}g`],["🥔 Papa",`${t2.papa}g`],["🥦 Verduras",`${t2.verduras}g`],["🥚 Huevos",`${t2.huevo} u.`]].map(([n,v])=>(
              <div key={n} style={{display:"flex",justifyContent:"space-between",fontSize:12,
                padding:"5px 0",borderBottom:`1px solid ${G.border}`,fontFamily:"system-ui,sans-serif"}}>
                <span style={{color:G.textSec}}>{n}</span><span style={{fontWeight:500,color:G.text}}>{v}</span>
              </div>
            ))}
            <div style={{fontSize:11,color:G.textDim,marginTop:5,fontFamily:"system-ui,sans-serif"}}>{t2.prot}g prot · {t2.kcal} kcal</div>
          </div>

          {/* Totales */}
          <div style={{border:`1px solid ${G.border}`,borderRadius:4,padding:"12px",background:G.surf2,marginBottom:8}}>
            <div style={{fontSize:9,color:G.gold,letterSpacing:2,marginBottom:8}}>TOTAL DEL DÍA</div>
            {[["Proteína",totalProt,185,G.gold],["Calorías",totalKcal,2450,"#A07AC9"]].map(([lbl,val,obj,col])=>(
              <div key={lbl} style={{marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:G.textSec,marginBottom:3,fontFamily:"system-ui,sans-serif"}}>
                  <span>{lbl}</span>
                  <span style={{fontWeight:500,color:G.text}}>{val}{lbl==="Proteína"?"g":" kcal"} / {obj}{lbl==="Proteína"?"g":" kcal"}</span>
                </div>
                <div style={{height:4,background:"#ffffff08",borderRadius:2,overflow:"hidden"}}>
                  <div style={{height:4,width:`${Math.min(100,Math.round(val/obj*100))}%`,background:col,borderRadius:2,boxShadow:`0 0 6px ${col}`}}/>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DÍA COMPLETO — todos los pilares con tabs
// ═══════════════════════════════════════════════════════════════════════════════
function VpDayView({ mesId, wIdx, dIdx, pilarInicial, onBack, onAbrirCocina, onAbrirStock }) {
  const [pilarActivo, setPilarActivo] = useState(pilarInicial || "fe");
  const [datos, setDatos]             = useState({});
  const [loading, setLoading]         = useState(true);
  const [saveStatus, setSaveStatus]   = useState("idle");
  const path = vpDayPath(mesId, wIdx, dIdx);

  useEffect(() => {
    if (!firebaseOk) { setLoading(false); return; }
    getDoc(doc(db, path)).then(snap => {
      setDatos(snap.exists() ? snap.data().pilares || {} : {});
      setLoading(false);
    });
  }, [path]);

  async function guardar(pilarId, nuevoDato) {
    const updated = { ...datos, [pilarId]: nuevoDato };
    setDatos(updated);
    if (!firebaseOk) return;
    setSaveStatus("saving");
    try {
      await setDoc(doc(db, path), { pilares: updated }, { merge: true });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch(e) { setSaveStatus("error"); }
  }

  // Score general
  const scoreTotal = VP_PILARES.reduce((acc, p) => {
    const h = datos[p.id]?.habitos || {};
    return acc + p.habitos.filter(hab => h[hab.id]).length;
  }, 0);
  const totalHabs = VP_PILARES.reduce((acc, p) => acc + p.habitos.length, 0);

  if (loading) return <div style={{padding:20,textAlign:"center",color:G.textSec,fontFamily:"'Courier New',monospace",fontSize:11,letterSpacing:1}}>CARGANDO REGISTROS...</div>;

  const pilar = VP_PILARES.find(p => p.id === pilarActivo);

  return (
    <div>
      {/* Mini header */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
        <button onClick={onBack} style={S.btn(false,false)}>← Semana</button>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:600,color:G.text,fontFamily:"system-ui,sans-serif"}}>{DIAS[dIdx]}</div>
          <div style={{fontSize:11,color:G.textSec,fontFamily:"system-ui,sans-serif"}}>{scoreTotal}/{totalHabs} hábitos</div>
        </div>
        <span style={{fontSize:10,padding:"3px 8px",borderRadius:3,letterSpacing:1,
          background:saveStatus==="saving"?G.goldDim:saveStatus==="saved"?G.okBg:G.surf2,
          color:saveStatus==="saving"?G.gold:saveStatus==="saved"?"#7AB85A":G.textDim,
          border:`1px solid ${G.border}`}}>
          {saveStatus==="saving"?"GUARDANDO…":saveStatus==="saved"?"✓ GUARDADO":"AUTO"}
        </span>
      </div>

      {/* Barra general */}
      <div style={{height:3,background:"#ffffff08",borderRadius:2,overflow:"hidden",marginBottom:8}}>
        <div style={{height:3,background:G.gold,
          width:`${Math.round((scoreTotal/totalHabs)*100)}%`,borderRadius:2,transition:"width .3s",
          boxShadow:`0 0 6px ${G.gold}`}}/>
      </div>

      {/* Tabs de pilares */}
      <div style={{display:"flex",overflowX:"auto",gap:3,scrollbarWidth:"none",marginBottom:8}}>
        {VP_PILARES.map(p => {
          const h = datos[p.id]?.habitos || {};
          const comp = p.habitos.filter(hab => h[hab.id]).length;
          const active = pilarActivo === p.id;
          return (
            <button key={p.id} onClick={() => setPilarActivo(p.id)}
              style={{whiteSpace:"nowrap",padding:"6px 10px",fontSize:11,cursor:"pointer",
                border:`1px solid ${active?p.color.border:G.border}`,
                borderBottom:active?`1px solid ${G.surf}`:"none",borderRadius:"4px 4px 0 0",
                background:active?G.surf:G.bg,
                color:active?p.color.text:G.textSec,fontWeight:active?600:400,
                fontFamily:"system-ui,sans-serif"}}>
              {p.color.emoji}
              {comp > 0 && (
                <span style={{marginLeft:4,fontSize:9,background:p.color.bg,
                  color:p.color.text,borderRadius:2,padding:"1px 4px",border:`1px solid ${p.color.border}33`}}>
                  {comp}/{p.habitos.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Contenido */}
      {pilar && (
        <VpPilarDia
          pilar={pilar}
          datos={datos[pilarActivo]}
          onChange={d => guardar(pilarActivo, d)}
          onAbrirCocina={onAbrirCocina}
          onAbrirStock={onAbrirStock}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEMANA VIEW — grilla de 7 días + tab resumen
// ═══════════════════════════════════════════════════════════════════════════════
function VpWeekView({ mesId, wIdx, pilarInicial, onDaySelect, onBack }) {
  const [tab, setTab] = useState("dias");
  const [scores, setScores] = useState({});

  useEffect(() => {
    if (!firebaseOk) return;
    Promise.all(
      DIAS.map((_, di) =>
        getDoc(doc(db, vpDayPath(mesId, wIdx, di))).then(snap => {
          if (!snap.exists()) return { di, score: 0, total: 0 };
          const pilares = snap.data().pilares || {};
          const score = VP_PILARES.reduce((acc, p) => {
            const h = pilares[p.id]?.habitos || {};
            return acc + p.habitos.filter(hab => h[hab.id]).length;
          }, 0);
          const total = VP_PILARES.reduce((acc, p) => acc + p.habitos.length, 0);
          return { di, score, total };
        })
      )
    ).then(results => {
      const s = {};
      results.forEach(r => { s[r.di] = { score: r.score, total: r.total }; });
      setScores(s);
    });
  }, [mesId, wIdx]);

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
        <button onClick={onBack} style={S.btn(false,false)}>← Mes</button>
        <span style={{fontSize:13,fontWeight:600,color:G.text,letterSpacing:1,flex:1,fontFamily:"system-ui,sans-serif"}}>
          SEMANA {wIdx+1}
        </span>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:6,marginBottom:10}}>
        {[["dias","📋 Días"],["resumen","📊 Resumen"]].map(([id,lbl])=>(
          <button key={id} onClick={()=>setTab(id)} style={{flex:1,...S.btn(tab===id,false),textAlign:"center"}}>
            {lbl}
          </button>
        ))}
      </div>

      {tab==="dias" ? (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {DIAS.map((dia, di) => {
            const sc = scores[di];
            const pct = sc && sc.total > 0 ? Math.round((sc.score/sc.total)*100) : 0;
            const color = pct===0?G.textDim:pct<50?"#C9724C":pct<80?G.gold:G.ok;
            return (
              <div key={di} onClick={() => onDaySelect(di)}
                style={{border:`1px solid ${G.border}`,borderRadius:4,padding:"12px",
                  background:G.surf,cursor:"pointer"}}>
                <div style={{fontSize:12,fontWeight:600,color:G.text,marginBottom:6,fontFamily:"system-ui,sans-serif"}}>{dia}</div>
                {sc && sc.total > 0 ? (
                  <>
                    <div style={{height:3,background:"#ffffff08",borderRadius:2,overflow:"hidden",marginBottom:5}}>
                      <div style={{height:3,width:`${pct}%`,background:color,borderRadius:2,boxShadow:`0 0 5px ${color}`}}/>
                    </div>
                    <div style={{fontSize:10,color,fontFamily:"system-ui,sans-serif"}}>
                      {sc.score}/{sc.total} hábitos · {pct}%
                    </div>
                  </>
                ) : (
                  <div style={{fontSize:10,color:G.textDim,fontFamily:"system-ui,sans-serif"}}>Sin registros →</div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <VpResumenSemanal mesId={mesId} wIdx={wIdx} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESUMEN SEMANAL
// ═══════════════════════════════════════════════════════════════════════════════
function VpResumenSemanal({ mesId, wIdx }) {
  const [diasData, setDiasData] = useState({});
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!firebaseOk) { setLoading(false); return; }
    Promise.all(
      DIAS.map((_, di) =>
        getDoc(doc(db, vpDayPath(mesId, wIdx, di)))
          .then(snap => ({ di, data: snap.exists() ? snap.data().pilares || {} : null }))
      )
    ).then(results => {
      const d = {};
      results.forEach(r => { if (r.data) d[r.di] = r.data; });
      setDiasData(d);
      setLoading(false);
    });
  }, [mesId, wIdx]);

  if (loading) return <div style={{padding:20,textAlign:"center",color:G.textSec,fontFamily:"'Courier New',monospace",fontSize:11,letterSpacing:1}}>CARGANDO RESUMEN...</div>;

  return (
    <div>
      <div style={{fontSize:9,color:G.gold,letterSpacing:2,marginBottom:12}}>RESUMEN SEMANAL POR PILAR</div>
      {VP_PILARES.map(p => {
        const c = p.color;
        let total = 0, logrado = 0, diasCon = 0;
        DIAS.forEach((_, di) => {
          const d = diasData[di];
          if (!d) return;
          diasCon++;
          const h = d[p.id]?.habitos || {};
          logrado += p.habitos.filter(hab => h[hab.id]).length;
          total   += p.habitos.length;
        });
        const pct = total > 0 ? Math.round((logrado/total)*100) : 0;
        const color = pct===0?G.textDim:pct<50?"#C9724C":pct<80?G.gold:G.ok;
        return (
          <div key={p.id} style={{border:`1px solid ${c.border}44`,borderRadius:4,
            padding:"12px",background:c.bg,marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{fontSize:12,fontWeight:600,color:c.text,letterSpacing:1,fontFamily:"system-ui,sans-serif"}}>{c.emoji} {p.label.toUpperCase()}</div>
              <div style={{fontSize:16,fontWeight:700,color}}>{pct}%</div>
            </div>
            <div style={{height:4,background:"#ffffff08",borderRadius:2,overflow:"hidden",marginBottom:6}}>
              <div style={{height:4,width:`${pct}%`,background:c.dot,borderRadius:2,boxShadow:`0 0 6px ${c.dot}`}}/>
            </div>
            <div style={{fontSize:11,color:c.text,opacity:.75,fontFamily:"system-ui,sans-serif"}}>
              {logrado}/{total} hábitos completados · {diasCon} días registrados
            </div>
          </div>
        );
      })}

      {/* Peso semanal fitness */}
      {Object.keys(diasData).length > 0 && (() => {
        const pesos = DIAS.map((_, di) =>
          diasData[di]?.nutricion?.peso ? parseFloat(diasData[di].nutricion.peso) : null
        ).filter(Boolean);
        if (pesos.length === 0) return null;
        const promedio = (pesos.reduce((a,b)=>a+b,0)/pesos.length).toFixed(1);
        return (
          <div style={{border:"1px solid #C9724C44",borderRadius:4,padding:"12px",
            background:"#1a0500",marginBottom:8}}>
            <div style={{fontSize:12,fontWeight:600,color:"#C9724C",marginBottom:8,letterSpacing:1,fontFamily:"system-ui,sans-serif"}}>
              ⚖️ PESO CORPORAL — SEMANA
            </div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {DIAS.map((dia, di) => {
                const p = diasData[di]?.nutricion?.peso;
                return p ? (
                  <div key={di} style={{fontSize:11,padding:"4px 8px",background:G.surf2,
                    border:"1px solid #C9724C44",borderRadius:3,color:"#C9724C",fontFamily:"system-ui,sans-serif"}}>
                    {dia.slice(0,3)}: <strong>{p}kg</strong>
                  </div>
                ) : null;
              })}
            </div>
            <div style={{fontSize:12,color:"#C9724C",fontWeight:600,marginTop:8,fontFamily:"system-ui,sans-serif"}}>
              Promedio: {promedio} kg
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MES VIEW — 4 semanas
// ═══════════════════════════════════════════════════════════════════════════════
function VpMonthView({ mesId, mesLabel, onWeekSelect }) {
  const [scores, setScores] = useState({});

  useEffect(() => {
    if (!firebaseOk) return;
    Promise.all(
      [0,1,2,3].flatMap(wi =>
        DIAS.map((_, di) =>
          getDoc(doc(db, vpDayPath(mesId, wi, di))).then(snap => {
            if (!snap.exists()) return { wi, di, score:0, total:0 };
            const pilares = snap.data().pilares || {};
            const score = VP_PILARES.reduce((acc,p)=>{
              const h = pilares[p.id]?.habitos||{};
              return acc + p.habitos.filter(hab=>h[hab.id]).length;
            },0);
            return { wi, di, score, total: VP_PILARES.reduce((a,p)=>a+p.habitos.length,0) };
          })
        )
      )
    ).then(results => {
      const s = {};
      results.forEach(r => {
        if (!s[r.wi]) s[r.wi] = { score:0, total:0, dias:0 };
        if (r.total > 0) { s[r.wi].score += r.score; s[r.wi].total += r.total; s[r.wi].dias++; }
      });
      setScores(s);
    });
  }, [mesId]);

  return (
    <div>
      <div style={{fontSize:9,color:G.gold,letterSpacing:3,marginBottom:4}}>🃏 {mesLabel.toUpperCase()}</div>
      <div style={{fontSize:11,color:G.textSec,marginBottom:14,fontFamily:"system-ui,sans-serif"}}>Un Nuevo Comienzo · Tapas 2</div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {[0,1,2,3].map(wi => {
          const sc = scores[wi];
          const pct = sc && sc.total > 0 ? Math.round((sc.score/sc.total)*100) : 0;
          const color = pct===0?G.textDim:pct<50?"#C9724C":pct<80?G.gold:G.ok;
          return (
            <div key={wi} onClick={() => onWeekSelect(wi)}
              style={{border:`1px solid ${G.border}`,borderRadius:4,padding:"16px 12px",
                background:G.surf,cursor:"pointer",textAlign:"center"}}>
              <div style={{fontSize:20,marginBottom:6}}>🃏</div>
              <div style={{fontSize:12,fontWeight:600,color:G.text,marginBottom:6,letterSpacing:1,fontFamily:"system-ui,sans-serif"}}>SEMANA {wi+1}</div>
              {sc && sc.dias > 0 ? (
                <>
                  <div style={{height:3,background:"#ffffff08",borderRadius:2,overflow:"hidden",margin:"0 4px 6px"}}>
                    <div style={{height:3,width:`${pct}%`,background:color,borderRadius:2,boxShadow:`0 0 5px ${color}`}}/>
                  </div>
                  <div style={{fontSize:10,color,fontFamily:"system-ui,sans-serif"}}>{pct}% · {sc.dias}d</div>
                </>
              ) : (
                <div style={{fontSize:10,color:G.textDim,marginTop:4,fontFamily:"system-ui,sans-serif"}}>Sin registros</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Resumen mensual por pilar */}
      <VpResumenMensual mesId={mesId} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESUMEN MENSUAL
// ═══════════════════════════════════════════════════════════════════════════════
function VpResumenMensual({ mesId }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseOk) { setLoading(false); return; }
    Promise.all(
      [0,1,2,3].flatMap(wi =>
        DIAS.map((_, di) =>
          getDoc(doc(db, vpDayPath(mesId, wi, di))).then(snap => ({
            pilares: snap.exists() ? snap.data().pilares || {} : null
          }))
        )
      )
    ).then(results => {
      const pilarStats = {};
      VP_PILARES.forEach(p => { pilarStats[p.id] = { logrado:0, total:0, dias:0 }; });
      const pesos = [];
      const equity = []; // { dia: number, valor: number }
      const resultados = [];

      results.forEach(({ pilares }, idx) => {
        if (!pilares) return;
        VP_PILARES.forEach(p => {
          const h = pilares[p.id]?.habitos || {};
          const comp = p.habitos.filter(hab => h[hab.id]).length;
          pilarStats[p.id].logrado += comp;
          pilarStats[p.id].total   += p.habitos.length;
          pilarStats[p.id].dias++;
        });
        if (pilares.nutricion?.peso) pesos.push(parseFloat(pilares.nutricion.peso));
        if (pilares.trading?.equityCuenta) equity.push({ idx, valor: parseFloat(pilares.trading.equityCuenta) });
        if (pilares.trading?.resultadoUSD !== undefined && pilares.trading?.resultadoUSD !== "") {
          resultados.push(parseFloat(pilares.trading.resultadoUSD));
        }
      });

      setData({ pilarStats, pesos, equity, resultados });
      setLoading(false);
    });
  }, [mesId]);

  if (loading || !data) return null;

  const pesoMin  = data.pesos.length ? Math.min(...data.pesos).toFixed(1) : null;
  const pesoMax  = data.pesos.length ? Math.max(...data.pesos).toFixed(1) : null;
  const pesoProm = data.pesos.length ? (data.pesos.reduce((a,b)=>a+b,0)/data.pesos.length).toFixed(1) : null;

  const equitySorted = [...data.equity].sort((a,b)=>a.idx-b.idx);
  const equityInicial = equitySorted.length ? equitySorted[0].valor : null;
  const equityActual  = equitySorted.length ? equitySorted[equitySorted.length-1].valor : null;
  const equityCambio  = (equityInicial!==null && equityActual!==null) ? (equityActual - equityInicial) : null;
  const resultadoTotal = data.resultados.length ? data.resultados.reduce((a,b)=>a+b,0) : null;

  return (
    <div style={{marginTop:16}}>
      <div style={{fontSize:9,color:G.gold,letterSpacing:2,marginBottom:10}}>
        📊 RESUMEN MENSUAL — 5 PILARES
      </div>

      {VP_PILARES.map(p => {
        const st = data.pilarStats[p.id];
        const pct = st.total > 0 ? Math.round((st.logrado/st.total)*100) : 0;
        const color = pct===0?G.textDim:pct<50?"#C9724C":pct<80?G.gold:G.ok;
        const c = p.color;
        return (
          <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,
            padding:"10px 12px",border:`1px solid ${c.border}33`,borderRadius:4,
            background:c.bg,marginBottom:6}}>
            <span style={{fontSize:16}}>{c.emoji}</span>
            <div style={{flex:1}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                <span style={{fontSize:11,fontWeight:600,color:c.text,letterSpacing:.5,fontFamily:"system-ui,sans-serif"}}>{p.label}</span>
                <span style={{fontSize:13,fontWeight:700,color}}>{pct}%</span>
              </div>
              <div style={{height:3,background:"#ffffff08",borderRadius:2,overflow:"hidden"}}>
                <div style={{height:3,width:`${pct}%`,background:c.dot,borderRadius:2,boxShadow:`0 0 5px ${c.dot}`}}/>
              </div>
            </div>
          </div>
        );
      })}

      {/* Evolución de peso */}
      {pesoProm && (
        <div style={{border:"1px solid #C9724C44",borderRadius:4,padding:"12px",
          background:"#1a0500",marginTop:8}}>
          <div style={{fontSize:12,fontWeight:600,color:"#C9724C",marginBottom:8,letterSpacing:1,fontFamily:"system-ui,sans-serif"}}>
            ⚖️ PESO CORPORAL — RESUMEN MENSUAL
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            {[["Mínimo",`${pesoMin}kg`],["Promedio",`${pesoProm}kg`],["Máximo",`${pesoMax}kg`]].map(([lbl,val])=>(
              <div key={lbl} style={{textAlign:"center",padding:"8px",background:G.surf2,
                border:"1px solid #C9724C44",borderRadius:3}}>
                <div style={{fontSize:9,color:G.textDim,marginBottom:4,fontFamily:"system-ui,sans-serif"}}>{lbl}</div>
                <div style={{fontSize:15,fontWeight:700,color:"#C9724C"}}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize:10,color:"#C9724C",marginTop:8,opacity:.75,fontFamily:"system-ui,sans-serif"}}>
            {data.pesos.length} registros en el mes
          </div>
        </div>
      )}
      {/* Evolución de cuenta de trading */}
      {equityActual !== null && (
        <div style={{border:"1px solid #7AB85A44",borderRadius:4,padding:"12px",
          background:"#001a0f",marginTop:8}}>
          <div style={{fontSize:12,fontWeight:600,color:"#7AB85A",marginBottom:8,letterSpacing:1,fontFamily:"system-ui,sans-serif"}}>
            📈 CUENTA DE TRADING — EVOLUCIÓN MENSUAL
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div style={{textAlign:"center",padding:"8px",background:G.surf2,
              border:"1px solid #7AB85A44",borderRadius:3}}>
              <div style={{fontSize:9,color:G.textDim,marginBottom:4,fontFamily:"system-ui,sans-serif"}}>Equity actual</div>
              <div style={{fontSize:16,fontWeight:700,color:"#7AB85A"}}>${equityActual.toFixed(2)}</div>
            </div>
            <div style={{textAlign:"center",padding:"8px",background:G.surf2,
              border:"1px solid #7AB85A44",borderRadius:3}}>
              <div style={{fontSize:9,color:G.textDim,marginBottom:4,fontFamily:"system-ui,sans-serif"}}>Cambio en el mes</div>
              <div style={{fontSize:16,fontWeight:700,color:equityCambio>=0?"#7AB85A":"#C9724C"}}>
                {equityCambio>=0?"+":""}{equityCambio.toFixed(2)}
              </div>
            </div>
          </div>
          {resultadoTotal !== null && (
            <div style={{fontSize:11,color:G.textSec,marginBottom:8,fontFamily:"system-ui,sans-serif"}}>
              Resultado acumulado de operaciones registradas:{" "}
              <span style={{fontWeight:700,color:resultadoTotal>=0?"#7AB85A":"#C9724C"}}>
                {resultadoTotal>=0?"+":""}{resultadoTotal.toFixed(2)} USD
              </span>
            </div>
          )}
          {/* Mini gráfico de barras de equity por día registrado */}
          {equitySorted.length > 1 && (() => {
            const max = Math.max(...equitySorted.map(e=>e.valor));
            const min = Math.min(...equitySorted.map(e=>e.valor));
            const rango = max - min || 1;
            return (
              <div style={{display:"flex",gap:2,alignItems:"flex-end",height:40,marginTop:4}}>
                {equitySorted.map((e,i) => {
                  const h = Math.max(3, Math.round(((e.valor-min)/rango)*36));
                  return (
                    <div key={i} title={`$${e.valor.toFixed(2)}`}
                      style={{flex:1,height:h,background:"#7AB85A",borderRadius:1,opacity:.7}}/>
                  );
                })}
              </div>
            );
          })()}
          <div style={{fontSize:10,color:"#7AB85A",marginTop:8,opacity:.75,fontFamily:"system-ui,sans-serif"}}>
            {equitySorted.length} registros de equity en el mes
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// APP ROOT VIDA PERSONAL — mes → semana → día
// ═══════════════════════════════════════════════════════════════════════════════
function VpApp() {
  const [pilarInicial, setPilarInicial] = useState(null);
  const [mostrarCompras, setMostrarCompras] = useState(false);
  const [mostrarLogros, setMostrarLogros]   = useState(false);
  const [mostrarStock, setMostrarStock]     = useState(false);
  const [mostrarCocina, setMostrarCocina]   = useState(false);
  const [mostrarRecetas, setMostrarRecetas] = useState(false);
  const [recetaParaCocinar, setRecetaParaCocinar] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [nav, setNav]     = useState("month"); // month | week | day
  const [wIdx, setWIdx]   = useState(0);
  const [dIdx, setDIdx]   = useState(0);

  function irAHoy(pilarId) {
    const { mesId, wIdx: wHoy, dIdx: dHoy } = hoyVp();
    const mes = ALL_MONTHS.find(m => m.id === mesId);
    setPilarInicial(pilarId);
    setSelectedMonth(mes || null);
    setWIdx(wHoy);
    setDIdx(dHoy);
    setNav("day");
  }

  // Lista de compras — pantalla independiente, transversal a los pilares
  if (mostrarCompras) {
    return <VpListaCompras
      onBack={() => setMostrarCompras(false)}
      onAbrirStock={() => { setMostrarCompras(false); setMostrarStock(true); }}
    />;
  }

  // Stock de alimentos — pantalla independiente
  if (mostrarStock) {
    return <VpStock onBack={() => setMostrarStock(false)} />;
  }

  // Recetas — pantalla independiente, conecta hacia Cocina al elegir "cocinar esta receta"
  if (mostrarRecetas) {
    return <VpRecetasScreen
      onBack={() => setMostrarRecetas(false)}
      onUsarReceta={(r) => { setRecetaParaCocinar(r); setMostrarRecetas(false); setMostrarCocina(true); }}
    />;
  }

  // Cocina — calculador de porciones + verificación de stock
  if (mostrarCocina) {
    return <VpCocina
      onBack={() => { setMostrarCocina(false); setRecetaParaCocinar(null); }}
      onVerRecetas={() => { setMostrarCocina(false); setMostrarRecetas(true); }}
      recetaSeleccionada={recetaParaCocinar}
      onLimpiarSeleccion={() => setRecetaParaCocinar(null)}
    />;
  }

  // Trofeos / logros — pantalla independiente, transversal a los pilares
  if (mostrarLogros) {
    return <VpLogrosScreen onBack={() => setMostrarLogros(false)} />;
  }

  // Mostrar selector si no hay pilar elegido
  if (!pilarInicial) {
    return (
      <VpSelector
        onSelect={p => setPilarInicial(p)}
        onSelectHoy={() => irAHoy("fe")}
        onSelectCompras={() => setMostrarCompras(true)}
        onSelectLogros={() => setMostrarLogros(true)}
      />
    );
  }

  const pilarActual = VP_PILARES.find(p => p.id === pilarInicial);

  return (
    <div style={{fontFamily:"system-ui,sans-serif",maxWidth:430,margin:"0 auto",
      color:G.text,paddingBottom:40,minHeight:"100vh",background:G.bg}}>

      {/* HEADER */}
      <div style={{padding:"1rem 1rem .75rem",borderBottom:`1px solid ${G.border}`,
        background:G.surf,marginBottom:8}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div>
            <div style={{fontSize:13,fontWeight:600,color:G.gold,letterSpacing:1,fontFamily:"'Courier New',monospace"}}>
              🃏 UN NUEVO COMIENZO
            </div>
            <div style={{fontSize:11,color:G.textSec,marginTop:2}}>
              {pilarActual && `${pilarActual.color.emoji} ${pilarActual.label}`}
            </div>
          </div>
          <button onClick={()=>setPilarInicial(null)} style={S.btnSm(false)}>
            ☰ Pilares
          </button>
        </div>

        {/* Firebase status */}
        <div style={{fontSize:10,padding:"3px 8px",borderRadius:3,display:"inline-flex",
          alignItems:"center",gap:5,marginBottom:10,letterSpacing:.5,
          background:firebaseOk?G.okBg:G.goldDim,
          color:firebaseOk?"#7AB85A":G.gold,
          border:`1px solid ${firebaseOk?"#5C8A4A55":G.goldMid}`}}>
          <span style={{width:5,height:5,borderRadius:"50%",display:"inline-block",
            background:firebaseOk?"#7AB85A":G.gold}}/>
          {firebaseOk?"FIREBASE CONECTADO":"MODO LOCAL"}
        </div>

        {/* Selector de mes */}
        <select value={selectedMonth?.id||""} onChange={e=>{
          const m=ALL_MONTHS.find(x=>x.id===e.target.value);
          setSelectedMonth(m||null); setNav("month");
        }} style={{...S.inp(false),marginBottom:8,cursor:"pointer"}}>
          <option value="">— Seleccionar mes —</option>
          {ALL_MONTHS.filter(m=>m.year===2026).map(m=>(
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>

        {/* Breadcrumb */}
        {selectedMonth&&(
          <div style={{display:"flex",gap:4,fontSize:12,alignItems:"center",flexWrap:"wrap"}}>
            <button onClick={()=>setNav("month")} style={S.btnSm(nav==="month")}>
              {selectedMonth.label}
            </button>
            {(nav==="week"||nav==="day")&&<>
              <span style={{color:G.textDim}}>›</span>
              <button onClick={()=>setNav("week")} style={S.btnSm(nav==="week")}>
                Sem. {wIdx+1}
              </button>
            </>}
            {nav==="day"&&<>
              <span style={{color:G.textDim}}>›</span>
              <button style={S.btnSm(true)}>
                {DIAS[dIdx].substring(0,3)}
              </button>
            </>}
          </div>
        )}
      </div>

      {/* Contenido */}
      <div style={{padding:"0 1rem"}}>
        {!selectedMonth ? (
          <div style={{textAlign:"center",padding:"48px 20px",color:G.textDim}}>
            <div style={{fontSize:28,marginBottom:12,opacity:.6}}>📅</div>
            <div style={{fontSize:13,marginBottom:4,color:G.textSec,fontFamily:"system-ui,sans-serif"}}>Seleccioná un mes para comenzar</div>
            <div style={{fontSize:11,letterSpacing:1}}>2026 DISPONIBLE · 12 MESES</div>
          </div>
        ) : nav==="month" ? (
          <VpMonthView
            mesId={selectedMonth.id}
            mesLabel={selectedMonth.label}
            onWeekSelect={i=>{ setWIdx(i); setNav("week"); }}
          />
        ) : nav==="week" ? (
          <VpWeekView
            mesId={selectedMonth.id}
            wIdx={wIdx}
            pilarInicial={pilarInicial}
            onDaySelect={i=>{ setDIdx(i); setNav("day"); }}
            onBack={()=>setNav("month")}
          />
        ) : (
          <VpDayView
            mesId={selectedMonth.id}
            wIdx={wIdx}
            dIdx={dIdx}
            pilarInicial={pilarInicial}
            onBack={()=>setNav("week")}
            onAbrirCocina={()=>setMostrarCocina(true)}
            onAbrirStock={()=>setMostrarStock(true)}
          />
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════════
// APP ROOT — Jarvis Wake Up → Un Nuevo Comienzo
// ═══════════════════════════════════════════════════════════════════════════════
export default function App(){
  const [activo,setActivo]=useState(false);

  if(!activo) return <LoginScreen onLogin={()=>setActivo(true)}/>;

  return <VpApp />;
}
