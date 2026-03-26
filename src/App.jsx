import { useState, useMemo, useEffect, useCallback } from "react";
// 1. IMPORTAMOS LAS HERRAMIENTAS DE FIREBASE
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue } from "firebase/database";

// 2. TUS CREDENCIALES (DE LA FOTO QUE ME PASASTE)
const firebaseConfig = {
  apiKey: "AIzaSyC9voyk8cV05JeRdKKyCZ0csTuKM9TY0rU",
  authDomain: "mi-presupuesto-2d275.firebaseapp.com",
  databaseURL: "https://mi-presupuesto-2d275-default-rtdb.firebaseio.com",
  projectId: "mi-presupuesto-2d275",
  storageBucket: "mi-presupuesto-2d275.firebasestorage.app",
  messagingSenderId: "127612527439",
  appId: "1:127612527439:web:5342901f09448d31a51b3a",
  measurementId: "G-51DBGVFW65"
};

// Inicializamos la conexión
const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const CATEGORIAS = ["Necesidad","Deseo","Ahorro"];
const REGLA = { Necesidad: 0.5, Deseo: 0.3, Ahorro: 0.2 };
const ICONOS = { Necesidad: "🏠", Deseo: "🎉", Ahorro: "💰" };
const CAT_COLORS = {
  Necesidad: { bg:"#fdf6ec", accent:"#c07a2f", bar:"#e8a84c", text:"#7a4a10", light:"#f5ddb8" },
  Deseo:     { bg:"#f5f0fb", accent:"#7c4dae", bar:"#a97dd4", text:"#4a2070", light:"#d9c4f0" },
  Ahorro:    { bg:"#edf7f2", accent:"#2e8c5a", bar:"#5ab882", text:"#1a5235", light:"#b8e4cc" },
};
const fmt = (n) => new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(n??0);
const now = new Date();
const AÑO = now.getFullYear();

// Ya no usamos STORAGE_KEY porque usamos la nube

function useSheetJS() {
  const [ready, setReady] = useState(typeof window!=="undefined"&&!!window.XLSX);
  useEffect(()=>{
    if(window.XLSX){setReady(true);return;}
    const s=document.createElement("script");
    s.src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    s.onload=()=>setReady(true);
    document.head.appendChild(s);
  },[]);
  return ready;
}

function exportarExcel(meses) {
  const XLSX=window.XLSX, wb=XLSX.utils.book_new();
  const rows=[[`Presupuesto Personal ${AÑO} — Regla 50/30/20`],[],["Mes","Ingreso","Presup. Nec. (50%)","Presup. Des. (30%)","Presup. Aho. (20%)","Gastado Nec.","Gastado Des.","Gastado Aho.","Total Gastado","Ahorro Real","Notas"]];
  MESES.forEach((nombre,i)=>{
    const m=meses[i]||{},ing=m.ingreso||0,eg=m.egresos||[];
    const g={Necesidad:0,Deseo:0,Ahorro:0};eg.forEach(e=>g[e.categoria]+=e.monto);
    const tg=eg.reduce((s,e)=>s+e.monto,0);
    if(ing===0&&tg===0)return;
    rows.push([nombre,ing,ing*.5,ing*.3,ing*.2,g.Necesidad,g.Deseo,g.Ahorro,tg,ing-tg,m.notas||""]);
  });
  const act=MESES.map((_,i)=>meses[i]).filter(m=>m?.ingreso);
  if(act.length>1){
    const sI=act.reduce((s,m)=>s+(m.ingreso||0),0),sE=act.reduce((s,m)=>s+(m.egresos||[]).reduce((x,e)=>x+e.monto,0),0);
    const gC={Necesidad:0,Deseo:0,Ahorro:0};act.forEach(m=>(m.egresos||[]).forEach(e=>gC[e.categoria]+=e.monto));
    rows.push(["TOTAL ANUAL",sI,sI*.5,sI*.3,sI*.2,gC.Necesidad,gC.Deseo,gC.Ahorro,sE,sI-sE,""]);
  }
  const ws=XLSX.utils.aoa_to_sheet(rows);ws["!cols"]=[12,12,18,18,18,14,14,14,14,12,40].map(w=>({wch:w}));
  XLSX.utils.book_append_sheet(wb,ws,"Resumen Anual");
  MESES.forEach((nombre,i)=>{
    const m=meses[i]||{};if(!m.ingreso&&!(m.egresos||[]).length)return;
    const ing=m.ingreso||0,eg=(m.egresos||[]).slice().sort((a,b)=>b.monto-a.monto);
    const sr=[[`${nombre} ${AÑO}`],["Ingreso:",ing],["Notas:",m.notas||"—"],[],["Categoría","Nombre","Monto","% del ingreso"]];
    eg.forEach(e=>sr.push([e.categoria,e.nombre,e.monto,ing>0?+(e.monto/ing).toFixed(4):0]));
    sr.push([],["RESUMEN","Presupuestado","Gastado","Diferencia"]);
    const g={Necesidad:0,Deseo:0,Ahorro:0};eg.forEach(e=>g[e.categoria]+=e.monto);
    CATEGORIAS.forEach(c=>sr.push([c,ing*REGLA[c],g[c],ing*REGLA[c]-g[c]]));
    sr.push(["Total",ing,eg.reduce((s,e)=>s+e.monto,0),ing-eg.reduce((s,e)=>s+e.monto,0)]);
    const ws2=XLSX.utils.aoa_to_sheet(sr);ws2["!cols"]=[{wch:14},{wch:28},{wch:14},{wch:14}];
    XLSX.utils.book_append_sheet(wb,ws2,nombre.slice(0,10));
  });
  XLSX.writeFile(wb,`Presupuesto_${AÑO}.xlsx`);
}

function MiniBar({value,max,color}){
  const pct=max>0?Math.min((value/max)*100,100):0;
  return(<div style={{height:4,borderRadius:2,background:"#e0e0e0",overflow:"hidden",marginTop:6}}><div style={{height:"100%",width:`${pct}%`,background:value>max?"#e05252":color,borderRadius:2,transition:"width .4s"}}/></div>);
}

function SaveBadge({saved}){
  return(
    <div style={{position:"fixed",bottom:20,right:20,zIndex:100,background:saved?"#1a3a2a":"#2a2010",color:saved?"#5ab882":"#d4a843",padding:"8px 14px",borderRadius:20,fontSize:12,boxShadow:"0 2px 12px #00000040",transition:"all .3s",display:"flex",alignItems:"center",gap:6}}>
      <span>{saved?"☁️":"⏳"}</span>{saved?"Sincronizado":"Sincronizando..."}
    </div>
  );
}

function VistaMes({mesIdx,datos,onChange}){
  const [ingreso,setIngreso]=useState(datos.ingreso?String(datos.ingreso):"");
  const [nombre,setNombre]=useState("");
  const [monto,setMonto]=useState("");
  const [cat,setCat]=useState("Necesidad");
  const [editandoNota,setEditandoNota]=useState(false);
  const [notaTemp,setNotaTemp]=useState(datos.notas||"");

  useEffect(()=>{setIngreso(datos.ingreso?String(datos.ingreso):"");setNotaTemp(datos.notas||"");setEditandoNota(false);},[mesIdx, datos.ingreso, datos.notas]);

  const ingresoNum=datos.ingreso||0;
  const presupuesto={Necesidad:ingresoNum*.5,Deseo:ingresoNum*.3,Ahorro:ingresoNum*.2};
  const gastoPorCat=useMemo(()=>{const g={Necesidad:0,Deseo:0,Ahorro:0};(datos.egresos||[]).forEach(e=>g[e.categoria]+=e.monto);return g;},[datos.egresos]);

  const confirmarIngreso=()=>{const v=parseFloat(ingreso.replace(/\./g,"").replace(",","."));if(!isNaN(v)&&v>0)onChange({...datos,ingreso:v});};
  const guardarNota=()=>{onChange({...datos,notas:notaTemp});setEditandoNota(false);};
  const agregar=()=>{
    const m=parseFloat(monto.replace(/\./g,"").replace(",","."));
    if(!nombre.trim()||isNaN(m)||m<=0)return;
    onChange({...datos,egresos:[...(datos.egresos||[]),{id:Date.now(),nombre:nombre.trim(),monto:m,categoria:cat}]});
    setNombre("");setMonto("");
  };
  const eliminar=(id)=>onChange({...datos,egresos:(datos.egresos||[]).filter(e=>e.id!==id)});
  const totalGastado=(datos.egresos||[]).reduce((s,e)=>s+e.monto,0);
  const egresosPorCat=useMemo(()=>{const g={Necesidad:[],Deseo:[],Ahorro:[]};(datos.egresos||[]).forEach(e=>g[e.categoria].push(e));return g;},[datos.egresos]);
  const card=(s)=>({background:"#fff",borderRadius:14,border:"1px solid #e8e0d4",boxShadow:"0 2px 10px #0000000a",...s});

  return(
    <div>
      <div style={card({padding:22,marginBottom:14})}>
        <div style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:"#a09080",marginBottom:10}}>Ingreso de {MESES[mesIdx]}</div>
        <div style={{display:"flex",gap:10}}>
          <div style={{position:"relative",flex:1}}>
            <span style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",color:"#aaa",fontWeight:"bold"}}>$</span>
            <input type="text" placeholder="0" value={ingreso} onChange={e=>setIngreso(e.target.value)} onKeyDown={e=>e.key==="Enter"&&confirmarIngreso()}
              style={{width:"100%",padding:"12px 12px 12px 28px",fontSize:18,border:"2px solid #e8e0d4",borderRadius:9,outline:"none",fontFamily:"monospace",boxSizing:"border-box",background:datos.ingreso?"#fafaf8":"#fff"}}/>
          </div>
          <button onClick={confirmarIngreso} style={{padding:"12px 18px",background:"#1c1c28",color:"#d4a843",border:"none",borderRadius:9,cursor:"pointer",fontWeight:"bold",fontSize:13}}>{datos.ingreso?"✓":"OK"}</button>
        </div>
      </div>

      <div style={card({padding:20,marginBottom:14})}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:"#a09080"}}>📝 Notas del mes</div>
          {!editandoNota&&<button onClick={()=>setEditandoNota(true)} style={{background:"none",border:"1px solid #e0d8cf",borderRadius:6,padding:"4px 12px",cursor:"pointer",fontSize:12,color:"#888",fontFamily:"inherit"}}>{datos.notas?"Editar":"+ Agregar"}</button>}
        </div>
        {editandoNota?(
          <div>
            <textarea value={notaTemp} onChange={e=>setNotaTemp(e.target.value)} placeholder="Anotá cualquier detalle..." rows={3}
              style={{width:"100%",padding:"10px 13px",fontSize:14,border:"2px solid #d4a843",borderRadius:9,outline:"none",resize:"vertical",boxSizing:"border-box",fontFamily:"Georgia,serif",color:"#333",lineHeight:1.6}}/>
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <button onClick={guardarNota} style={{flex:1,padding:9,background:"#1c1c28",color:"#d4a843",border:"none",borderRadius:8,cursor:"pointer",fontWeight:"bold",fontSize:13}}>Guardar</button>
              <button onClick={()=>{setEditandoNota(false);setNotaTemp(datos.notas||"");}} style={{padding:"9px 16px",background:"#f0ece6",color:"#888",border:"none",borderRadius:8,cursor:"pointer",fontSize:13}}>Cancelar</button>
            </div>
          </div>
        ):datos.notas?(
          <p style={{margin:0,fontSize:14,color:"#555",lineHeight:1.7,background:"#faf7f2",padding:"12px 14px",borderRadius:9,borderLeft:"3px solid #d4a843",fontStyle:"italic"}}>{datos.notas}</p>
        ):(
          <p style={{margin:0,fontSize:13,color:"#ccc",fontStyle:"italic"}}>Sin notas para este mes.</p>
        )}
      </div>

      {ingresoNum>0&&(
        <>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:14}}>
            {CATEGORIAS.map(c=>{
              const col=CAT_COLORS[c],gastado=gastoPorCat[c],lim=presupuesto[c],over=gastado>lim;
              return(
                <div key={c} style={{background:col.bg,border:`1.5px solid ${over?"#e05252":col.light}`,borderRadius:12,padding:"14px 12px"}}>
                  <div style={{fontSize:18}}>{ICONOS[c]}</div>
                  <div style={{fontSize:10,fontWeight:"bold",color:col.text,letterSpacing:1.5,textTransform:"uppercase",marginTop:4}}>{c}</div>
                  <div style={{fontSize:11,color:col.accent,marginBottom:6}}>{Math.round(REGLA[c]*100)}%</div>
                  <div style={{fontSize:15,fontWeight:"bold",color:col.text}}>{fmt(lim)}</div>
                  <MiniBar value={gastado} max={lim} color={col.bar}/>
                  <div style={{fontSize:10,marginTop:5,color:over?"#e05252":"#888"}}>{over?`⚠ +${fmt(gastado-lim)}`:`${fmt(lim-gastado)} libre`}</div>
                </div>
              );
            })}
          </div>

          <div style={card({padding:20,marginBottom:14})}>
            <div style={{fontSize:11,letterSpacing:3,textTransform:"uppercase",color:"#a09080",marginBottom:12}}>Nuevo gasto</div>
            <input type="text" placeholder="Nombre" value={nombre} onChange={e=>setNombre(e.target.value)}
              style={{width:"100%",padding:"10px 13px",fontSize:14,border:"2px solid #e8e0d4",borderRadius:8,outline:"none",boxSizing:"border-box",marginBottom:10,fontFamily:"inherit"}}/>
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              <div style={{position:"relative",flex:1}}>
                <span style={{position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:"#aaa",fontSize:13}}>$</span>
                <input type="text" placeholder="Monto" value={monto} onChange={e=>setMonto(e.target.value)} onKeyDown={e=>e.key==="Enter"&&agregar()}
                  style={{width:"100%",padding:"10px 10px 10px 24px",fontSize:14,border:"2px solid #e8e0d4",borderRadius:8,outline:"none",fontFamily:"monospace",boxSizing:"border-box"}}/>
              </div>
              <select value={cat} onChange={e=>setCat(e.target.value)} style={{padding:"10px",fontSize:13,border:"2px solid #e8e0d4",borderRadius:8,outline:"none",background:"#fff",cursor:"pointer",fontFamily:"inherit"}}>
                {CATEGORIAS.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <button onClick={agregar} style={{width:"100%",padding:12,background:"#1c1c28",color:"#d4a843",border:"none",borderRadius:9,cursor:"pointer",fontWeight:"bold",fontSize:14}}>+ Agregar</button>
          </div>

          {CATEGORIAS.map(c=>{
            const lista=(egresosPorCat[c] || []).slice().sort((a,b)=>b.monto-a.monto);
            if(!lista.length)return null;
            const col=CAT_COLORS[c];
            return(
              <div key={c} style={{background:"#fff",borderRadius:14,marginBottom:12,border:`1.5px solid ${col.light}`,overflow:"hidden"}}>
                <div style={{background:col.bg,padding:"11px 16px",display:"flex",justifyContent:"space-between",borderBottom:`1px solid ${col.light}`}}>
                  <span style={{fontWeight:"bold",color:col.text,fontSize:14}}>{ICONOS[c]} {c}s</span>
                  <span style={{fontSize:13,color:col.accent,fontWeight:"bold"}}>{fmt(lista.reduce((s,e)=>s+e.monto,0))}</span>
                </div>
                {lista.map(e=>(
                  <div key={e.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",borderBottom:"1px solid #f5f0ea"}}>
                    <span style={{fontSize:14,color:"#333"}}>{e.nombre}</span>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <span style={{fontSize:14,fontFamily:"monospace",color:col.text,fontWeight:"bold"}}>{fmt(e.monto)}</span>
                      <button onClick={()=>eliminar(e.id)} style={{background:"none",border:"none",cursor:"pointer",color:"#ccc",fontSize:18,padding:0}}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          {(datos.egresos||[]).length>0&&(
            <div style={{background:"#1c1c28",borderRadius:14,padding:"18px 22px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:10,color:"#d4a843",letterSpacing:2,textTransform:"uppercase"}}>Gastado</div>
                <div style={{fontSize:22,fontWeight:"bold",color:"#f0e6d3",marginTop:3}}>{fmt(totalGastado)}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:10,color:"#d4a843",letterSpacing:2,textTransform:"uppercase"}}>Restante</div>
                <div style={{fontSize:22,fontWeight:"bold",color:totalGastado>ingresoNum?"#e05252":"#d4a843",marginTop:3}}>{fmt(ingresoNum-totalGastado)}</div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function VistaResumen({meses,onExportar,xlsxReady}){
  const datos=useMemo(()=>MESES.map((nombre,i)=>{
    const m=meses[i]||{},ing=m.ingreso||0,eg=m.egresos||[];
    const g={Necesidad:0,Deseo:0,Ahorro:0};eg.forEach(e=>g[e.categoria]+=e.monto);
    const tg=eg.reduce((s,e)=>s+e.monto,0);
    return{nombre,ingreso:ing,gastoPorCat:g,totalGastado:tg,ahorroReal:ing-tg,notas:m.notas||"",activo:ing>0};
  }),[meses]);

  const act=datos.filter(d=>d.activo);
  const tI=act.reduce((s,d)=>s+d.ingreso,0),tG=act.reduce((s,d)=>s+d.totalGastado,0);
  const tAR=act.reduce((s,d)=>s+d.ahorroReal,0),tAA=act.reduce((s,d)=>s+d.gastoPorCat.Ahorro,0);
  const tN=act.reduce((s,d)=>s+d.gastoPorCat.Necesidad,0),tD=act.reduce((s,d)=>s+d.gastoPorCat.Deseo,0);

  if(!act.length)return(<div style={{textAlign:"center",padding:"60px 20px",color:"#a09080"}}><div style={{fontSize:40,marginBottom:12}}>📊</div><div style={{fontSize:15}}>Aún no hay meses cargados en la nube.</div></div>);

  return(
    <div>
      <button onClick={onExportar} disabled={!xlsxReady} style={{width:"100%",padding:13,marginBottom:16,background:xlsxReady?"#217346":"#bbb",color:"#fff",border:"none",borderRadius:11,cursor:xlsxReady?"pointer":"not-allowed",fontWeight:"bold",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontFamily:"inherit",boxShadow:xlsxReady?"0 3px 14px #21734640":"none"}}>
        <span style={{fontSize:18}}>📥</span>{