
// Keys
const KEY_RUNNERS="vmamp:runners";
const KEY_PLAN="vmamp:plan";
const KEY_RESULTS="vmamp:results";

// Utils
function mmssToSeconds(str){ const [m,s]=(str||"").split(":").map(x=>parseInt(x,10)||0); return m*60+s; }
function secondsToMMSS(sec){ const m=Math.floor(sec/60), s=sec%60; return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`; }
function blocksOf90(sec){ return Math.round(sec/90); }
function speedTarget(vma,pct){ return vma*(pct/100); }
function plotsPer90FromSpeed(speed){ return Math.round(2*speed); } // 1 plot = 0.5 km/h in 1:30
function saveJSON(k,o){ localStorage.setItem(k, JSON.stringify(o)); }
function loadJSON(k,f){ try{ return JSON.parse(localStorage.getItem(k)) ?? f; }catch(e){ return f; } }
function download(fn,content,mime="text/plain"){ const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([content],{type:mime})); a.download=fn; a.click(); URL.revokeObjectURL(a.href); }

// ScanProf JSON
function buildScanProfJSON(results){
  const eleves = results.map(r => ({
    nom:r.nom, prenom:r.prenom, classe:r.classe, vma:r.vma,
    distance: Math.round(r.distance_m), vitesse: Number(Number(r.vitesse_moy_kmh).toFixed(1))
  }));
  return { eleves };
}
