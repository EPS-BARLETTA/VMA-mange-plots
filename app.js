
// Storage keys
const KEY_RUNNERS = "vmamp:runners";
const KEY_PLAN = "vmamp:plan";
const KEY_RESULTS = "vmamp:results";

function mmssToSeconds(str){ const [m,s]=(str||"").split(":").map(x=>parseInt(x,10)||0); return m*60+s; }
function secondsToMMSS(sec){ const m=Math.floor(sec/60), s=sec%60; return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`; }
function blocksOf90(sec){ return Math.round(sec/90); }
function speedTarget(vma,pct){ return vma*(pct/100); }
function plotsPer90FromSpeed(speed){ return Math.round(2*speed); } // 1 plot = 0.5 km/h (en 1:30)
function computeTolerancePlots(){ return 1; }

function saveJSON(k,o){ localStorage.setItem(k, JSON.stringify(o)); }
function loadJSON(k,f){ try{ return JSON.parse(localStorage.getItem(k)) ?? f; }catch(e){ return f; } }

function download(filename, content, mime="text/plain"){
  const a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([content],{type:mime}));
  a.download=filename; a.click(); URL.revokeObjectURL(a.href);
}

function resultsToCSV(results){
  const header=["Nom","Prénom","Classe","VMA_km_h","Durée","PctVMA","Vitesse_cible","Plots_cible_90s","Plots_moy_90s","Ecart_plots_total","Ecart_km_h","Distance_m","Vitesse_moy_km_h"];
  const rows=[header.join(",")];
  for(const r of results){
    rows.push([r.nom,r.prenom,r.classe,r.vma,r.duree,r.pctVMA,r.vitesse_cible,r.plots_cible_90s,r.plots_moy_90s,r.ecart_plots_total,r.ecart_kmh,r.distance_m,r.vitesse_moy_kmh].join(","));
  }
  return rows.join("\n");
}

// JSON format for ScanProf
function buildScanProfJSON(results){
  const eleves = results.map(r => ({
    nom: r.nom, prenom: r.prenom, classe: r.classe, vma: r.vma,
    distance: Math.round(r.distance_m), // meters
    vitesse: Number(Number(r.vitesse_moy_kmh).toFixed(1)) // km/h
  }));
  return { eleves };
}

// CSV (semicolon) format for ScanProf (alternative)
function buildScanProfCSV(results){
  const lines = ["nom;prenom;classe;vma;distance;vitesse"];
  results.forEach(r => {
    lines.push([r.nom, r.prenom, r.classe, r.vma, Math.round(r.distance_m), Number(Number(r.vitesse_moy_kmh).toFixed(1))].join(";"));
  });
  return lines.join("\\n");
}

function makeQRCode(el, text){
  return new QRCode(el,{text, width:240, height:240, correctLevel: QRCode.CorrectLevel.M});
}
