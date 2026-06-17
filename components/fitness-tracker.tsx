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
  nutricion:{ bg:"#1a0500", border:"#C9724C", text:"#C9724C", dot:"#C9724C", dim:"#C9724C22", emoji:"🍗"  },
  vision:   { bg:"#0d0014", border:"#A07AC9", text:"#A07AC9", dot:"#A07AC9", dim:"#A07AC922", emoji:"🃏"  },
};

// ── 5 Pilares ─────────────────────────────────────────────────────────────────
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

  { id:"nutricion", label:"Fitness & Nutrición", color:VP_C.nutricion, habitos:[
    { id:"wod",        label:"Completé sesión de CrossFit / WOD" },
    { id:"desayuno",   label:"Desayuno: avena + leche + banana + huevos" },
    { id:"tupper1",    label:"Tupper 1 (almuerzo) comido" },
    { id:"tupper2",    label:"Tupper 2 (cena) comido" },
    { id:"hidratacion",label:"Hidratación adecuada durante el día" },
  ], notaLabel:"Cómo fue el entrenamiento / cómo me sentí", esFitness:true },

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
// PANTALLA DE SELECCIÓN — 5 PILARES
// ═══════════════════════════════════════════════════════════════════════════════
function VpSelector({ onSelect, onSelectHoy }) {
  const [codigo, setCodigo] = useState("");
  const [err, setErr]       = useState("");
  const [scores, setScores] = useState({});
  const [rachas, setRachas] = useState({});
  const [mesActual]         = useState(() => hoyVp().mesId);
  const CODIGOS = { FE:"fe", TRADING:"trading", HOGAR:"hogar", FIT:"nutricion", VISION:"vision" };

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
    else setErr("Código no válido · FE · TRADING · HOGAR · FIT · VISION");
  }

  const DESC = {
    fe:"Jarvis Wake Up · Salmos 119:97 · Intención del día",
    trading:"Cuenta de fondeo EUR/DOL · Registro de operaciones",
    hogar:"Orden, limpieza y preparación del entorno",
    nutricion:"CrossFit · 2 Tuppers + Desayuno · Macros · Peso",
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
      {onSelectHoy && (
        <button onClick={onSelectHoy}
          style={{
            width:"100%", marginBottom:20, padding:"12px",
            background:G.goldDim, border:`1px solid ${G.goldMid}`,
            borderRadius:4, color:G.gold, fontSize:12, letterSpacing:3,
            fontFamily:"'Courier New',monospace", fontWeight:700,
            cursor:"pointer", touchAction:"manipulation",
            WebkitTapHighlightColor:"transparent",
          }}>
          ⚡ IR A HOY
        </button>
      )}

      {/* Pilares */}
      {VP_PILARES.map(p => {
        const sc = scores[p.id];
        const pct = sc?.pct || 0;
        const cod = p.id==="nutricion"?"FIT":p.id.toUpperCase();
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
            placeholder="FE · TRADING · HOGAR · FIT · VISION"
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
// REGISTRO DIARIO DE UN PILAR
// ═══════════════════════════════════════════════════════════════════════════════
function VpPilarDia({ pilar, datos, onChange }) {
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

  useEffect(() => {
    const payload = { habitos, nota };
    if (pilar.esFitness) Object.assign(payload, { tipoDia, tupper1, tupper2, peso, wod });
    if (pilar.esTrading) Object.assign(payload, { resultadoUSD, equityCuenta, cantOperaciones });
    onChange(payload);
  }, [habitos, nota, tipoDia, tupper1, tupper2, peso, wod, resultadoUSD, equityCuenta, cantOperaciones]);

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

          {/* WOD */}
          {tipoDia==="entreno"&&(
            <div style={{border:`1px solid ${G.border}`,borderRadius:4,padding:"12px",background:G.surf,marginBottom:8}}>
              <div style={{fontSize:9,color:G.gold,letterSpacing:2,marginBottom:6}}>WOD DEL DÍA</div>
              <textarea value={wod} onChange={e=>setWod(e.target.value)}
                placeholder="Ej: Fran 21-15-9 · Tiempo: 8:42"
                style={{...S.inp(false),height:52,resize:"none",fontFamily:"system-ui,sans-serif"}}/>
            </div>
          )}

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
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DÍA COMPLETO — todos los pilares con tabs
// ═══════════════════════════════════════════════════════════════════════════════
function VpDayView({ mesId, wIdx, dIdx, pilarInicial, onBack }) {
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

  // Mostrar selector si no hay pilar elegido
  if (!pilarInicial) {
    return (
      <VpSelector
        onSelect={p => setPilarInicial(p)}
        onSelectHoy={() => irAHoy("fe")}
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
