const KEY_RUNNERS="vmamp:runners",KEY_PLAN="vmamp:plan",KEY_RESULTS="vmamp:results";
function mmssToSeconds(e){const[t,n]=(e||"").split(":").map((e=>parseInt(e,10)||0));return 60*t+n}
function secondsToMMSS(e){const t=Math.floor(e/60),n=e%60;return`${String(t).padStart(2,"0")}:${String(n).padStart(2,"0")}`}
function blocksOf90(e){return Math.round(e/90)}function speedTarget(e,t){return e*(t/100)}
function plotsPer90FromSpeed(e){return Math.round(2*e)}function computeTolerancePlots(){return 1}
function saveJSON(e,t){localStorage.setItem(e,JSON.stringify(t))}
function loadJSON(e,t){try{return JSON.parse(localStorage.getItem(e))??t}catch(e){return t}}
function download(e,t,n="text/plain"){const o=document.createElement("a");o.href=URL.createObjectURL(new Blob([t],{type:n})),o.download=e,o.click(),URL.revokeObjectURL(o.href)}
function resultsToCSV(e){const t=["Nom","Prénom","Classe","VMA_km_h","Durée","PctVMA","Vitesse_cible","Plots_cible_90s","Plots_moy_90s","Ecart_plots_total","Ecart_km_h","Distance_m","Vitesse_moy_km_h"],n=[t.join(",")];for(const t of e)n.push([t.nom,t.prenom,t.classe,t.vma,t.duree,t.pctVMA,t.vitesse_cible,t.plots_cible_90s,t.plots_moy_90s,t.ecart_plots_total,t.ecart_kmh,t.distance_m,t.vitesse_moy_kmh].join(","));return n.join("\n")}
function buildScanProfPayloadFromResults(e){const t=e.map((e=>({nom:e.nom,prenom:e.prenom,classe:e.classe,vma:e.vma,distance:Math.round(e.distance_m),vitesse:Number(Number(e.vitesse_moy_kmh).toFixed(1))})));return{eleves:t}}
function makeQRCode(e,t){return new QRCode(e,{text:t,width:200,height:200,correctLevel:QRCode.CorrectLevel.M})}
