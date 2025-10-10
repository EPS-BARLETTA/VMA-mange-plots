
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
  const header=["Nom","Prénom","Classe","VMA_km_h","Durée","PctVMA","Vitesse_cible","Plots_cible_90s","Plots_moy_90s","Ecart_plots_total","Ecart_km_h"];
  const rows=[header.join(",")];
  for(const r of results){
    rows.push([r.nom,r.prenom,r.classe,r.vma,r.duree,r.pctVMA,r.vitesse_cible,r.plots_cible_90s,r.plots_moy_90s,r.ecart_plots_total,r.ecart_kmh].join(","));
  }
  return rows.join("\n");
}

function buildScanProfPayload(results){
  return {
    app: "Mange Plots",
    version: "1.0",
    date_iso: new Date().toISOString(),
    eleves: results.reduce((acc,r)=>{
      const key=`${r.nom}|${r.prenom}|${r.classe}|${r.vma}`;
      if(!acc[key]) acc[key]={Nom:r.nom,Prenom:r.prenom,Classe:r.classe,VMA:r.vma,Seances:[]};
      acc[key].Seances.push({
        Duree:r.duree,PctVMA:r.pctVMA,VitesseCible:r.vitesse_cible,
        PlotsCiblePar90s:r.plots_cible_90s, PlotsMoyPar90s:r.plots_moy_90s,
        EcartPlotsTotal:r.ecart_plots_total, EcartKmH:r.ecart_kmh
      });
      return acc;
    },{})
  };
}

function makeQRCode(el, text){
  return new QRCode(el,{text, width:200, height:200, correctLevel: QRCode.CorrectLevel.M});
}
