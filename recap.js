
const results = loadJSON(KEY_RESULTS, []);
const runners = loadJSON(KEY_RUNNERS, {});
const $=(s)=>document.querySelector(s);
const tb=$("#tbodyR");

function row(r){
  const tr=document.createElement("tr");
  tr.innerHTML=`<td>${r.prenom} ${r.nom}</td><td>${r.duree}</td><td>${r.pctVMA}%</td><td>${r.plots_moy_90s}</td><td>${r.ecart_kmh}</td><td>${r.distance_m}</td><td>${r.vitesse_moy_kmh}</td>`;
  return tr;
}
results.forEach(r=> tb.appendChild(row(r)));

// QR per student and combined
function subsetFor(k){
  if(k==="A"||k==="B"){
    const t = runners[k];
    return results.filter(r=> r.nom===t.nom && r.prenom===t.prenom && r.classe===t.classe);
  }
  return results;
}
function makeJSON(subset){ return JSON.stringify(buildScanProfJSON(subset)); }
function makeQR(elId, text){ new QRCode(document.getElementById(elId), {text, width:240, height:240, correctLevel:QRCode.CorrectLevel.M}); }

document.getElementById("labelA").textContent = `${runners.A?.prenom||""} ${runners.A?.nom||""}`;
document.getElementById("labelB").textContent = `${runners.B?.prenom||""} ${runners.B?.nom||""}`;

makeQR("qrA", makeJSON(subsetFor("A")));
makeQR("qrB", makeJSON(subsetFor("B")));
makeQR("qrBoth", makeJSON(subsetFor("ALL")));
