"use client";

import { useState, useEffect, useCallback } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
} from "firebase/firestore";

// ─── Firebase init ───────────────────────────────────────────────────────────
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

// ─── Types ───────────────────────────────────────────────────────────────────
type MealStatus = "pendiente" | "completo" | "salteado";
type WorkoutStatus = "pendiente" | "completo" | "descanso";

interface MealEntry {
  nombre: string;
  kcal: number;
  proteina: number;
  carbos: number;
  grasa: number;
  status: MealStatus;
  hora?: string;
  nota?: string;
}

interface WorkoutEntry {
  nombre: string;
  tipo: "fuerza" | "metcon" | "cardio" | "descanso";
  duracion?: number; // min
  status: WorkoutStatus;
  rounds?: string;
  nota?: string;
}

interface DayKPIs {
  peso?: number;
  horas_sueno?: number;
  agua_litros?: number;
  energia: 1 | 2 | 3 | 4 | 5;
}

interface DayRecord {
  fecha: string; // dd/mm/yy
  timestamp: string;
  responsable: string;
  comidas: MealEntry[];
  entrenamiento: WorkoutEntry[];
  kpis: DayKPIs;
  completado: boolean;
}

// ─── Plan semanal base ───────────────────────────────────────────────────────
const PLAN_COMIDAS: Record<number, MealEntry[]> = {
  0: [ // Lunes WOD
    { nombre: "Avena overnight con banana y maní", kcal: 430, proteina: 14, carbos: 68, grasa: 10, status: "pendiente" },
    { nombre: "Ricota descremada + nueces + manzana", kcal: 260, proteina: 16, carbos: 22, grasa: 10, status: "pendiente" },
    { nombre: "Pollo grillado + papa + zapallito", kcal: 580, proteina: 52, carbos: 48, grasa: 10, status: "pendiente" },
    { nombre: "Banana + café negro (pre-entreno)", kcal: 110, proteina: 1, carbos: 27, grasa: 0, status: "pendiente" },
    { nombre: "Bowl ricota + banana + avena (post)", kcal: 400, proteina: 32, carbos: 52, grasa: 8, status: "pendiente" },
    { nombre: "Pollo al horno + zapallito + cebolla", kcal: 520, proteina: 48, carbos: 18, grasa: 14, status: "pendiente" },
  ],
  1: [ // Martes WOD
    { nombre: "Tostadas integrales + huevo + banana", kcal: 420, proteina: 24, carbos: 54, grasa: 10, status: "pendiente" },
    { nombre: "Avena con leche y frutos secos", kcal: 270, proteina: 12, carbos: 36, grasa: 9, status: "pendiente" },
    { nombre: "Guiso liviano pollo + papa + cebolla", kcal: 600, proteina: 50, carbos: 52, grasa: 10, status: "pendiente" },
    { nombre: "Banana + maní (pre-entreno)", kcal: 130, proteina: 4, carbos: 22, grasa: 5, status: "pendiente" },
    { nombre: "Licuado leche + banana + avena + cacao", kcal: 380, proteina: 18, carbos: 58, grasa: 8, status: "pendiente" },
    { nombre: "Omelette claras + zapallito + morrón", kcal: 420, proteina: 38, carbos: 16, grasa: 14, status: "pendiente" },
  ],
  2: [ // Miércoles descanso
    { nombre: "Avena con leche y banana", kcal: 400, proteina: 14, carbos: 68, grasa: 8, status: "pendiente" },
    { nombre: "Ricota descremada + frutos secos", kcal: 220, proteina: 16, carbos: 8, grasa: 13, status: "pendiente" },
    { nombre: "Ensalada pollo + huevo + vegetales", kcal: 480, proteina: 50, carbos: 20, grasa: 14, status: "pendiente" },
    { nombre: "Licuado de leche y banana", kcal: 280, proteina: 12, carbos: 40, grasa: 7, status: "pendiente" },
    { nombre: "Pollo al horno + vegetales asados", kcal: 500, proteina: 46, carbos: 22, grasa: 12, status: "pendiente" },
  ],
  3: [ // Jueves WOD
    { nombre: "Avena overnight + leche + maní + banana", kcal: 450, proteina: 16, carbos: 70, grasa: 12, status: "pendiente" },
    { nombre: "Ricota + banana + miel", kcal: 250, proteina: 14, carbos: 32, grasa: 8, status: "pendiente" },
    { nombre: "Pollo + papa al horno + morrón", kcal: 610, proteina: 54, carbos: 52, grasa: 10, status: "pendiente" },
    { nombre: "Banana + café (pre-entreno)", kcal: 110, proteina: 1, carbos: 27, grasa: 0, status: "pendiente" },
    { nombre: "Bowl recuperador avena + ricota", kcal: 420, proteina: 34, carbos: 52, grasa: 8, status: "pendiente" },
    { nombre: "Milanesa pollo al horno + zapallito", kcal: 500, proteina: 48, carbos: 24, grasa: 12, status: "pendiente" },
  ],
  4: [ // Viernes WOD
    { nombre: "Batido avena + leche + banana + cacao", kcal: 430, proteina: 14, carbos: 70, grasa: 9, status: "pendiente" },
    { nombre: "Ricota + frutos secos + manzana", kcal: 250, proteina: 14, carbos: 20, grasa: 12, status: "pendiente" },
    { nombre: "Pollo + vegetales salteados + papa", kcal: 580, proteina: 50, carbos: 48, grasa: 10, status: "pendiente" },
    { nombre: "Banana + maní (pre-entreno)", kcal: 130, proteina: 4, carbos: 22, grasa: 5, status: "pendiente" },
    { nombre: "Licuado leche + avena + banana + maní", kcal: 380, proteina: 16, carbos: 58, grasa: 9, status: "pendiente" },
    { nombre: "Revuelto pollo + huevo + vegetales", kcal: 480, proteina: 46, carbos: 16, grasa: 14, status: "pendiente" },
  ],
  5: [ // Sábado activo
    { nombre: "Tostadas + huevo + banana + café", kcal: 460, proteina: 24, carbos: 56, grasa: 12, status: "pendiente" },
    { nombre: "Frutos secos + manzana", kcal: 200, proteina: 6, carbos: 22, grasa: 10, status: "pendiente" },
    { nombre: "Pollo asado + papa + ensalada", kcal: 560, proteina: 52, carbos: 44, grasa: 12, status: "pendiente" },
    { nombre: "Licuado casero leche + banana + avena", kcal: 300, proteina: 12, carbos: 48, grasa: 7, status: "pendiente" },
    { nombre: "Cazuela liviana pollo + zapallito", kcal: 520, proteina: 46, carbos: 24, grasa: 12, status: "pendiente" },
  ],
  6: [ // Domingo descanso/meal prep
    { nombre: "Avena + leche + banana + nueces", kcal: 430, proteina: 14, carbos: 68, grasa: 11, status: "pendiente" },
    { nombre: "Ricota + miel + banana", kcal: 230, proteina: 12, carbos: 30, grasa: 8, status: "pendiente" },
    { nombre: "Pollo hervido (meal prep) + verduras", kcal: 500, proteina: 48, carbos: 24, grasa: 10, status: "pendiente" },
    { nombre: "Café con leche + banana", kcal: 220, proteina: 10, carbos: 32, grasa: 6, status: "pendiente" },
    { nombre: "Huevos + vegetales + tostadas integrales", kcal: 420, proteina: 26, carbos: 32, grasa: 14, status: "pendiente" },
  ],
};

const PLAN_ENTRENO: Record<number, WorkoutEntry[]> = {
  0: [
    { nombre: "Back squat 5×5 @ 70%", tipo: "fuerza", duracion: 20, status: "pendiente" },
    { nombre: "Metcon: 4 rondas — 400m run + 15 pull-ups + 10 push press", tipo: "metcon", duracion: 20, status: "pendiente" },
  ],
  1: [
    { nombre: "Deadlift 4×4 @ 75%", tipo: "fuerza", duracion: 20, status: "pendiente" },
    { nombre: "AMRAP 20min: 10 KB swing + 10 box jump + 200m run", tipo: "metcon", duracion: 20, status: "pendiente" },
  ],
  2: [{ nombre: "Descanso activo — movilidad 30min + caminata", tipo: "descanso", duracion: 30, status: "descanso" }],
  3: [
    { nombre: "Press banca + remo 4×6", tipo: "fuerza", duracion: 25, status: "pendiente" },
    { nombre: "21-15-9: Thruster 43kg + Pull-ups", tipo: "metcon", duracion: 15, status: "pendiente" },
  ],
  4: [
    { nombre: "Snatch técnico 5×3", tipo: "fuerza", duracion: 20, status: "pendiente" },
    { nombre: "Cindy: AMRAP 20min — 5 pull-ups, 10 push-ups, 15 air squats", tipo: "metcon", duracion: 20, status: "pendiente" },
  ],
  5: [{ nombre: "WOD Sábado — sesión abierta o cardio 40min", tipo: "cardio", duracion: 40, status: "pendiente" }],
  6: [{ nombre: "Descanso completo — meal prep dominical", tipo: "descanso", duracion: 0, status: "descanso" }],
};

const DIA_NOMBRES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DIA_TIPO = ["WOD", "WOD", "Descanso", "WOD", "WOD", "Activo", "Meal Prep"];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getTodayIdx() {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
}

function getWeekId() {
  const now = new Date();
  const year = now.getFullYear();
  const week = Math.ceil(((now.getTime() - new Date(year, 0, 1).getTime()) / 86400000 + 1) / 7);
  return `${year}_semana_${week}`;
}

function getTodayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getFullYear()).slice(2)}`;
}

function initDayRecord(nombre: string, dayIdx: number): DayRecord {
  return {
    fecha: getTodayStr(),
    timestamp: new Date().toISOString(),
    responsable: nombre,
    comidas: JSON.parse(JSON.stringify(PLAN_COMIDAS[dayIdx] ?? PLAN_COMIDAS[0])),
    entrenamiento: JSON.parse(JSON.stringify(PLAN_ENTRENO[dayIdx] ?? PLAN_ENTRENO[0])),
    kpis: { energia: 3 },
    completado: false,
  };
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function FitnessTracker() {
  const [screen, setScreen] = useState<"login" | "home" | "day" | "semana">("login");
  const [usuario, setUsuario] = useState("");
  const [usuarioInput, setUsuarioInput] = useState("");
  const [guardados, setGuardados] = useState<string[]>([]);
  const [dayRecord, setDayRecord] = useState<DayRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [semanaData, setSemanaData] = useState<Record<string, DayRecord>>({});
  const [loadingSemana, setLoadingSemana] = useState(false);
  const [activeTab, setActiveTab] = useState<"comidas" | "entreno" | "kpis">("comidas");

  const todayIdx = getTodayIdx();
  const weekId = getWeekId();
  const dayPath = `semanas/${weekId}/dias/dia_${todayIdx}`;

  // Load saved users
  useEffect(() => {
    const raw = localStorage.getItem("fitness_usuarios");
    if (raw) setGuardados(JSON.parse(raw));
  }, []);

  const saveUsuario = (nombre: string) => {
    const updated = [nombre, ...guardados.filter(u => u !== nombre)].slice(0, 5);
    setGuardados(updated);
    localStorage.setItem("fitness_usuarios", JSON.stringify(updated));
  };

  // Load day from Firestore
  const loadDay = useCallback(async (nombre: string) => {
    const db = getFirestore(getFirebaseApp());
    const ref = doc(db, dayPath);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      setDayRecord(snap.data() as DayRecord);
    } else {
      setDayRecord(initDayRecord(nombre, todayIdx));
    }
  }, [dayPath, todayIdx]);

  const handleLogin = async (nombre: string) => {
    if (!nombre.trim()) return;
    setUsuario(nombre.trim());
    saveUsuario(nombre.trim());
    await loadDay(nombre.trim());
    setScreen("home");
  };

  // Save to Firestore
  const saveDay = async (record: DayRecord) => {
    setSaving(true);
    try {
      const db = getFirestore(getFirebaseApp());
      await setDoc(doc(db, dayPath), record);
      setSaveMsg("Guardado ✓");
      setTimeout(() => setSaveMsg(""), 2000);
    } catch {
      setSaveMsg("Error al guardar");
    }
    setSaving(false);
  };

  const updateAndSave = (updated: DayRecord) => {
    setDayRecord(updated);
    saveDay(updated);
  };

  // KPIs calculados
  const calcTotales = (comidas: MealEntry[]) => {
    const completadas = comidas.filter(c => c.status === "completo");
    return {
      kcal: completadas.reduce((s, c) => s + c.kcal, 0),
      proteina: completadas.reduce((s, c) => s + c.proteina, 0),
      carbos: completadas.reduce((s, c) => s + c.carbos, 0),
      grasa: completadas.reduce((s, c) => s + c.grasa, 0),
    };
  };

  const targetKcal = todayIdx === 2 || todayIdx === 6 ? 2000 : 2350;
  const targetProt = 195;

  // Semana view
  const loadSemana = async () => {
    setLoadingSemana(true);
    setScreen("semana");
    try {
      const db = getFirestore(getFirebaseApp());
      const result: Record<string, DayRecord> = {};
      for (let i = 0; i < 7; i++) {
        const ref = doc(db, `semanas/${weekId}/dias/dia_${i}`);
        const snap = await getDoc(ref);
        if (snap.exists()) result[`dia_${i}`] = snap.data() as DayRecord;
      }
      setSemanaData(result);
    } catch {}
    setLoadingSemana(false);
  };

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  if (screen === "login") {
    return (
      <div style={{minHeight:"100vh",background:"#f8f7f4",display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem",fontFamily:"system-ui,sans-serif"}}>
        <div style={{background:"white",borderRadius:16,border:"0.5px solid #e2e0d8",padding:"2rem",width:"100%",maxWidth:400}}>
          <div style={{marginBottom:"1.5rem"}}>
            <div style={{width:44,height:44,borderRadius:12,background:"#EAF3DE",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:"1rem"}}>
              <span style={{fontSize:22}}>💪</span>
            </div>
            <h1 style={{fontSize:20,fontWeight:500,margin:0,color:"#1a1a1a"}}>Fitness Tracker</h1>
            <p style={{fontSize:13,color:"#888",marginTop:4}}>CrossFit · Dieta · KPIs diarios</p>
          </div>

          {guardados.length > 0 && (
            <div style={{marginBottom:"1.5rem"}}>
              <p style={{fontSize:11,fontWeight:500,color:"#888",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8}}>Acceso rápido</p>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {guardados.map(u => (
                  <button key={u} onClick={() => handleLogin(u)}
                    style={{padding:"10px 14px",border:"0.5px solid #e2e0d8",borderRadius:10,background:"transparent",cursor:"pointer",textAlign:"left",fontSize:14,color:"#1a1a1a",display:"flex",alignItems:"center",gap:8}}>
                    <span style={{width:28,height:28,borderRadius:"50%",background:"#EAF3DE",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:500,color:"#3B6D11",flexShrink:0}}>{u[0].toUpperCase()}</span>
                    {u}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p style={{fontSize:11,fontWeight:500,color:"#888",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:8}}>Nombre</p>
          <input
            value={usuarioInput}
            onChange={e => setUsuarioInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin(usuarioInput)}
            placeholder="Tu nombre..."
            style={{width:"100%",padding:"10px 12px",border:"0.5px solid #e2e0d8",borderRadius:8,fontSize:14,outline:"none",marginBottom:10,boxSizing:"border-box"}}
          />
          <button onClick={() => handleLogin(usuarioInput)}
            style={{width:"100%",padding:"11px",background:"#639922",color:"white",border:"none",borderRadius:10,fontSize:14,fontWeight:500,cursor:"pointer"}}>
            Entrar
          </button>
        </div>
      </div>
    );
  }

  // ── SEMANA VIEW ────────────────────────────────────────────────────────────
  if (screen === "semana") {
    const diasConDatos = Object.entries(semanaData);
    const totalKcalSem = diasConDatos.reduce((s,[,d]) => s + calcTotales(d.comidas).kcal, 0);
    const totalProtSem = diasConDatos.reduce((s,[,d]) => s + calcTotales(d.comidas).proteina, 0);
    const entrenosCompletos = diasConDatos.filter(([,d]) => d.entrenamiento.some(e => e.status === "completo")).length;
    const energiaPromedio = diasConDatos.length > 0
      ? Math.round(diasConDatos.reduce((s,[,d]) => s + (d.kpis.energia || 3), 0) / diasConDatos.length)
      : 0;

    return (
      <div style={{minHeight:"100vh",background:"#f8f7f4",fontFamily:"system-ui,sans-serif",padding:"1rem"}}>
        <div style={{maxWidth:520,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:"1.5rem"}}>
            <button onClick={() => setScreen("home")} style={{padding:"6px 12px",border:"0.5px solid #e2e0d8",borderRadius:8,background:"white",cursor:"pointer",fontSize:13,color:"#555"}}>← Volver</button>
            <h2 style={{fontSize:18,fontWeight:500,margin:0}}>Resumen semanal</h2>
          </div>

          {loadingSemana ? (
            <p style={{color:"#888",fontSize:14}}>Cargando datos...</p>
          ) : (
            <>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:"1.5rem"}}>
                {[
                  {lbl:"Kcal totales",val:`${totalKcalSem.toLocaleString()}`,sub:"esta semana"},
                  {lbl:"Proteína total",val:`${totalProtSem}g`,sub:`meta: ${targetProt * diasConDatos.length}g`},
                  {lbl:"Entrenamientos",val:`${entrenosCompletos}`,sub:`de ${diasConDatos.length} días`},
                  {lbl:"Energía promedio",val:`${"⚡".repeat(energiaPromedio)}`,sub:`${energiaPromedio}/5`},
                ].map(k => (
                  <div key={k.lbl} style={{background:"#f8f7f4",borderRadius:10,padding:"12px 14px"}}>
                    <div style={{fontSize:11,color:"#888",marginBottom:4}}>{k.lbl}</div>
                    <div style={{fontSize:20,fontWeight:500,color:"#1a1a1a"}}>{k.val}</div>
                    <div style={{fontSize:11,color:"#888"}}>{k.sub}</div>
                  </div>
                ))}
              </div>

              <p style={{fontSize:11,fontWeight:500,color:"#888",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:10}}>Días registrados</p>
              {DIA_NOMBRES.map((dia, i) => {
                const key = `dia_${i}`;
                const rec = semanaData[key];
                if (!rec) return (
                  <div key={i} style={{border:"0.5px solid #e2e0d8",borderRadius:12,padding:"12px 14px",marginBottom:8,background:"white",opacity:0.5}}>
                    <div style={{display:"flex",justifyContent:"space-between"}}>
                      <span style={{fontSize:14,color:"#888"}}>{dia}</span>
                      <span style={{fontSize:11,color:"#bbb"}}>Sin datos</span>
                    </div>
                  </div>
                );
                const tot = calcTotales(rec.comidas);
                const wok = rec.entrenamiento.filter(e => e.status === "completo").length;
                return (
                  <div key={i} style={{border:"0.5px solid #e2e0d8",borderRadius:12,padding:"12px 14px",marginBottom:8,background:"white"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <div>
                        <span style={{fontSize:14,fontWeight:500,color:"#1a1a1a"}}>{dia}</span>
                        <span style={{fontSize:11,color:"#888",marginLeft:8}}>{DIA_TIPO[i]}</span>
                      </div>
                      <span style={{fontSize:11,padding:"3px 8px",borderRadius:6,background: rec.completado ? "#EAF3DE":"#f8f7f4",color: rec.completado ? "#3B6D11":"#888"}}>
                        {rec.completado ? "Completado" : "En progreso"}
                      </span>
                    </div>
                    <div style={{display:"flex",gap:16,fontSize:12,color:"#555"}}>
                      <span>🔥 {tot.kcal} kcal</span>
                      <span>🥩 {tot.proteina}g prot</span>
                      <span>💪 {wok} ejerc.</span>
                      <span>⚡ {rec.kpis.energia}/5</span>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    );
  }

  if (!dayRecord) return null;
  const totales = calcTotales(dayRecord.comidas);
  const pctKcal = Math.min(100, Math.round((totales.kcal / targetKcal) * 100));
  const pctProt = Math.min(100, Math.round((totales.proteina / targetProt) * 100));

  // ── HOME ───────────────────────────────────────────────────────────────────
  if (screen === "home") {
    const wokDone = dayRecord.entrenamiento.filter(e => e.status === "completo").length;
    const wokTotal = dayRecord.entrenamiento.filter(e => e.tipo !== "descanso").length;
    const comidasOk = dayRecord.comidas.filter(c => c.status === "completo").length;

    return (
      <div style={{minHeight:"100vh",background:"#f8f7f4",fontFamily:"system-ui,sans-serif",padding:"1rem"}}>
        <div style={{maxWidth:520,margin:"0 auto"}}>
          {/* Header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.5rem"}}>
            <div>
              <h1 style={{fontSize:20,fontWeight:500,margin:0,color:"#1a1a1a"}}>Hola, {usuario.split(" ")[0]} 👋</h1>
              <p style={{fontSize:13,color:"#888",margin:"2px 0 0"}}>{DIA_NOMBRES[todayIdx]} · {DIA_TIPO[todayIdx]} · {getTodayStr()}</p>
            </div>
            <button onClick={loadSemana}
              style={{padding:"7px 12px",border:"0.5px solid #e2e0d8",borderRadius:8,background:"white",cursor:"pointer",fontSize:12,color:"#555"}}>
              Semana
            </button>
          </div>

          {/* KPI Cards */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:"1.5rem"}}>
            <div style={{background:"#f8f7f4",borderRadius:10,padding:"12px 14px"}}>
              <div style={{fontSize:11,color:"#888",marginBottom:4}}>Kcal consumidas</div>
              <div style={{fontSize:22,fontWeight:500,color:"#1a1a1a"}}>{totales.kcal}</div>
              <div style={{height:4,background:"#e2e0d8",borderRadius:2,marginTop:6}}>
                <div style={{height:4,borderRadius:2,background: pctKcal >= 90 ? "#639922":"#EF9F27",width:`${pctKcal}%`,transition:"width .3s"}} />
              </div>
              <div style={{fontSize:11,color:"#888",marginTop:3}}>Meta: {targetKcal} kcal</div>
            </div>
            <div style={{background:"#f8f7f4",borderRadius:10,padding:"12px 14px"}}>
              <div style={{fontSize:11,color:"#888",marginBottom:4}}>Proteína</div>
              <div style={{fontSize:22,fontWeight:500,color:"#1a1a1a"}}>{totales.proteina}g</div>
              <div style={{height:4,background:"#e2e0d8",borderRadius:2,marginTop:6}}>
                <div style={{height:4,borderRadius:2,background: pctProt >= 90 ? "#378ADD":"#D85A30",width:`${pctProt}%`,transition:"width .3s"}} />
              </div>
              <div style={{fontSize:11,color:"#888",marginTop:3}}>Meta: {targetProt}g</div>
            </div>
            <div style={{background:"#f8f7f4",borderRadius:10,padding:"12px 14px"}}>
              <div style={{fontSize:11,color:"#888",marginBottom:4}}>Comidas</div>
              <div style={{fontSize:22,fontWeight:500,color:"#1a1a1a"}}>{comidasOk}/{dayRecord.comidas.length}</div>
              <div style={{fontSize:11,color:"#888",marginTop:3}}>completadas hoy</div>
            </div>
            <div style={{background:"#f8f7f4",borderRadius:10,padding:"12px 14px"}}>
              <div style={{fontSize:11,color:"#888",marginBottom:4}}>Entrenamiento</div>
              <div style={{fontSize:22,fontWeight:500,color: wokTotal === 0 ? "#639922":"#1a1a1a"}}>
                {wokTotal === 0 ? "Descanso" : `${wokDone}/${wokTotal}`}
              </div>
              <div style={{fontSize:11,color:"#888",marginTop:3}}>{wokTotal === 0 ? "día de recuperación" : "ejercicios"}</div>
            </div>
          </div>

          {/* Botón principal */}
          <button onClick={() => setScreen("day")}
            style={{width:"100%",padding:"14px",background:"#639922",color:"white",border:"none",borderRadius:12,fontSize:15,fontWeight:500,cursor:"pointer",marginBottom:"1rem"}}>
            Registrar día de hoy →
          </button>

          {/* Macros rápidos */}
          <div style={{background:"white",border:"0.5px solid #e2e0d8",borderRadius:12,padding:"1rem 1.25rem"}}>
            <p style={{fontSize:11,fontWeight:500,color:"#888",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:10}}>Macros de hoy</p>
            {[
              {lbl:"Carbohidratos",val:totales.carbos,meta:230,color:"#1D9E75"},
              {lbl:"Grasas",val:totales.grasa,meta:65,color:"#BA7517"},
            ].map(m => (
              <div key={m.lbl} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}>
                  <span style={{color:"#555"}}>{m.lbl}</span>
                  <span style={{fontWeight:500}}>{m.val}g <span style={{fontWeight:400,color:"#888"}}>/ {m.meta}g</span></span>
                </div>
                <div style={{height:4,background:"#f0ede4",borderRadius:2}}>
                  <div style={{height:4,borderRadius:2,background:m.color,width:`${Math.min(100,(m.val/m.meta)*100)}%`,transition:"width .3s"}} />
                </div>
              </div>
            ))}
          </div>

          <p style={{fontSize:12,color:"#aaa",textAlign:"center",marginTop:"1rem"}}>{saveMsg || " "}</p>
        </div>
      </div>
    );
  }

  // ── DAY VIEW ───────────────────────────────────────────────────────────────
  const updateComida = (idx: number, status: MealStatus, nota?: string) => {
    const updated = { ...dayRecord, comidas: dayRecord.comidas.map((c, i) => i === idx ? { ...c, status, ...(nota !== undefined ? {nota} : {}) } : c) };
    updateAndSave(updated);
  };

  const updateEntreno = (idx: number, status: WorkoutStatus, nota?: string) => {
    const updated = { ...dayRecord, entrenamiento: dayRecord.entrenamiento.map((e, i) => i === idx ? { ...e, status, ...(nota !== undefined ? {nota} : {}) } : e) };
    updateAndSave(updated);
  };

  const updateKPI = (key: keyof DayKPIs, val: number | string) => {
    const updated = { ...dayRecord, kpis: { ...dayRecord.kpis, [key]: val } };
    updateAndSave(updated);
  };

  const marcarCompleto = () => {
    updateAndSave({ ...dayRecord, completado: true });
    setScreen("home");
  };

  const MEAL_STATUS_LABELS: Record<MealStatus, string> = { pendiente: "Pendiente", completo: "✓ Listo", salteado: "Salteado" };
  const WOD_STATUS_LABELS: Record<WorkoutStatus, string> = { pendiente: "Pendiente", completo: "✓ Hecho", descanso: "Descanso" };
  const WOD_TIPO_COLOR: Record<string, string> = { fuerza:"#E6F1FB", metcon:"#EAF3DE", cardio:"#FAEEDA", descanso:"#F1EFE8" };
  const WOD_TIPO_TEXT: Record<string, string> = { fuerza:"#185FA5", metcon:"#3B6D11", cardio:"#854F0B", descanso:"#5F5E5A" };

  return (
    <div style={{minHeight:"100vh",background:"#f8f7f4",fontFamily:"system-ui,sans-serif",padding:"1rem"}}>
      <div style={{maxWidth:520,margin:"0 auto"}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:"1.5rem"}}>
          <button onClick={() => setScreen("home")} style={{padding:"6px 12px",border:"0.5px solid #e2e0d8",borderRadius:8,background:"white",cursor:"pointer",fontSize:13,color:"#555"}}>← Volver</button>
          <div>
            <h2 style={{fontSize:17,fontWeight:500,margin:0}}>{DIA_NOMBRES[todayIdx]} — {DIA_TIPO[todayIdx]}</h2>
            <p style={{fontSize:12,color:"#888",margin:0}}>{getTodayStr()} · {usuario}</p>
          </div>
          {saveMsg && <span style={{fontSize:12,color:"#639922",marginLeft:"auto"}}>{saveMsg}</span>}
        </div>

        {/* Tabs */}
        <div style={{display:"flex",gap:6,marginBottom:"1.25rem"}}>
          {(["comidas","entreno","kpis"] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              style={{padding:"7px 16px",border:"0.5px solid",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight: activeTab===t ? 500:400,
                borderColor: activeTab===t ? "transparent":"#e2e0d8",
                background: activeTab===t ? "#EAF3DE":"transparent",
                color: activeTab===t ? "#3B6D11":"#555"}}>
              {t === "comidas" ? "Comidas" : t === "entreno" ? "Entreno" : "KPIs"}
            </button>
          ))}
        </div>

        {/* COMIDAS TAB */}
        {activeTab === "comidas" && (
          <div>
            <div style={{background:"#f8f7f4",borderRadius:10,padding:"10px 14px",marginBottom:"1rem",display:"flex",gap:20}}>
              <div style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:500}}>{totales.kcal}</div><div style={{fontSize:11,color:"#888"}}>kcal</div></div>
              <div style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:500}}>{totales.proteina}g</div><div style={{fontSize:11,color:"#888"}}>prot</div></div>
              <div style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:500}}>{totales.carbos}g</div><div style={{fontSize:11,color:"#888"}}>carbos</div></div>
              <div style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:500}}>{totales.grasa}g</div><div style={{fontSize:11,color:"#888"}}>grasas</div></div>
            </div>
            {dayRecord.comidas.map((c, i) => (
              <div key={i} style={{background:"white",border:`0.5px solid ${c.status==="completo"?"#9FE1CB":c.status==="salteado"?"#F5C4B3":"#e2e0d8"}`,borderRadius:12,padding:"12px 14px",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8,marginBottom:6}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:500,color:"#1a1a1a"}}>{c.nombre}</div>
                    <div style={{fontSize:12,color:"#888",marginTop:2}}>{c.kcal} kcal · {c.proteina}g prot · {c.carbos}g carbos</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:6}}>
                  {(["completo","salteado","pendiente"] as MealStatus[]).map(s => (
                    <button key={s} onClick={() => updateComida(i, s)}
                      style={{padding:"5px 10px",border:"0.5px solid",borderRadius:6,cursor:"pointer",fontSize:12,
                        borderColor: c.status===s ? "transparent":"#e2e0d8",
                        background: c.status===s ? (s==="completo"?"#EAF3DE":s==="salteado"?"#FAECE7":"#f8f7f4"):"transparent",
                        color: c.status===s ? (s==="completo"?"#3B6D11":s==="salteado"?"#993C1D":"#555"):"#888"}}>
                      {MEAL_STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ENTRENO TAB */}
        {activeTab === "entreno" && (
          <div>
            {dayRecord.entrenamiento.map((e, i) => (
              <div key={i} style={{background:"white",border:`0.5px solid ${e.status==="completo"?"#9FE1CB":"#e2e0d8"}`,borderRadius:12,padding:"12px 14px",marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:500,color:"#1a1a1a",marginBottom:4}}>{e.nombre}</div>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{fontSize:11,padding:"2px 8px",borderRadius:5,background:WOD_TIPO_COLOR[e.tipo],color:WOD_TIPO_TEXT[e.tipo],fontWeight:500}}>{e.tipo}</span>
                      {e.duracion ? <span style={{fontSize:12,color:"#888"}}>{e.duracion} min</span> : null}
                    </div>
                  </div>
                </div>
                {e.tipo !== "descanso" && (
                  <div style={{marginBottom:8}}>
                    <input placeholder="Rounds / resultado / observación..."
                      value={e.rounds || ""}
                      onChange={ev => {
                        const updated = { ...dayRecord, entrenamiento: dayRecord.entrenamiento.map((x, j) => j === i ? { ...x, rounds: ev.target.value } : x) };
                        setDayRecord(updated);
                      }}
                      onBlur={() => saveDay(dayRecord)}
                      style={{width:"100%",padding:"7px 10px",border:"0.5px solid #e2e0d8",borderRadius:8,fontSize:13,outline:"none",boxSizing:"border-box",background:"#f8f7f4"}} />
                  </div>
                )}
                <div style={{display:"flex",gap:6}}>
                  {(e.tipo === "descanso" ? ["descanso"] : ["completo","pendiente"] as WorkoutStatus[]).map(s => (
                    <button key={s} onClick={() => updateEntreno(i, s as WorkoutStatus)}
                      style={{padding:"5px 10px",border:"0.5px solid",borderRadius:6,cursor:"pointer",fontSize:12,
                        borderColor: e.status===s ? "transparent":"#e2e0d8",
                        background: e.status===s ? (s==="completo"?"#EAF3DE":s==="descanso"?"#F1EFE8":"#f8f7f4"):"transparent",
                        color: e.status===s ? (s==="completo"?"#3B6D11":"#5F5E5A"):"#888"}}>
                      {WOD_STATUS_LABELS[s as WorkoutStatus]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* KPIs TAB */}
        {activeTab === "kpis" && (
          <div>
            {[
              {key:"peso",lbl:"Peso corporal (kg)",placeholder:"ej: 89.5",type:"number",step:"0.1"},
              {key:"horas_sueno",lbl:"Horas de sueño",placeholder:"ej: 7.5",type:"number",step:"0.5"},
              {key:"agua_litros",lbl:"Agua consumida (litros)",placeholder:"ej: 2.5",type:"number",step:"0.1"},
            ].map(f => (
              <div key={f.key} style={{background:"white",border:"0.5px solid #e2e0d8",borderRadius:12,padding:"12px 14px",marginBottom:8}}>
                <div style={{fontSize:13,fontWeight:500,color:"#1a1a1a",marginBottom:6}}>{f.lbl}</div>
                <input type={f.type} step={f.step} placeholder={f.placeholder}
                  value={(dayRecord.kpis as Record<string,number|string>)[f.key] ?? ""}
                  onChange={e => updateKPI(f.key as keyof DayKPIs, parseFloat(e.target.value))}
                  style={{width:"100%",padding:"8px 10px",border:"0.5px solid #e2e0d8",borderRadius:8,fontSize:14,outline:"none",boxSizing:"border-box"}} />
              </div>
            ))}
            <div style={{background:"white",border:"0.5px solid #e2e0d8",borderRadius:12,padding:"12px 14px",marginBottom:8}}>
              <div style={{fontSize:13,fontWeight:500,color:"#1a1a1a",marginBottom:8}}>Nivel de energía: {dayRecord.kpis.energia}/5</div>
              <div style={{display:"flex",gap:8}}>
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => updateKPI("energia", n as 1|2|3|4|5)}
                    style={{flex:1,padding:"10px 0",borderRadius:8,border:"0.5px solid",cursor:"pointer",fontSize:16,
                      borderColor: dayRecord.kpis.energia >= n ? "transparent":"#e2e0d8",
                      background: dayRecord.kpis.energia >= n ? "#EAF3DE":"transparent"}}>
                    ⚡
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Cerrar día */}
        <div style={{marginTop:"1.5rem",paddingTop:"1rem",borderTop:"0.5px solid #e2e0d8"}}>
          <button onClick={marcarCompleto}
            style={{width:"100%",padding:"13px",background: dayRecord.completado?"#639922":"#378ADD",color:"white",border:"none",borderRadius:12,fontSize:14,fontWeight:500,cursor:"pointer"}}>
            {dayRecord.completado ? "✓ Día completado" : "Marcar día como completo"}
          </button>
        </div>
      </div>
    </div>
  );
}
