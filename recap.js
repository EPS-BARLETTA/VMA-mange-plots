// recap.js — QR OK + bilan "réalisé/attendu" + agrégats sur le réalisé
const results = loadJSON("vmamp:results",[]);
const $=(s)=>document.querySelector(s);

const recapTables = $("#recapTables");
const qrButtons   = $("#qrButtons");
const modal       = $("#qrModal");
const closeBtn    = $("#closeModal");
const qrFull      = $("#qrFull");

// ---- agrégats calculés sur le RÉALISÉ ----
function computeAgg(rec){
  const spacing = rec.spacing_m || 12.5;
  let totalPlots = 0;   // plots réalisés cumulés
  let totalSec   = 0;   // 90 s par tranche
  let blocks_total = 0;
  let blocks_ok    = 0;

  rec.courses.forEach(c=>{
    c.parts.forEach(p=>{
      totalPlots += p.actual;   // <-- réalisé
      totalSec   += 90;
      blocks_total += 1;
      if(p.ok) blocks_ok += 1;
    });
  });

  const distance = Math.round(totalPlots * spacing);                            // m
  const vitesse  = totalSec>0 ? Math.round((distance/totalSec)*3.6*10)/10 : 0; // km/h
  return { spacing, distance, vitesse, blocks_total, blocks_ok };
}

// ---- tableau récap : une seule valeur "réalisé/attendu" par tranche ----
function makeRecapTable(rec, agg, label){
  const wrap = document.createElement("div");
  wrap.innerHTML = `<h3 class="text-lg font-bold mb-2">${label} — ${rec.runner.prenom} ${rec.runner.nom} (${rec.runner.classe})</h3>`;

  const table = document.createElement("table");
  table.className = "results w-full";
  table.innerHTML = `<thead><tr>
    <th>Course</th>
    <th>%VMA</th>
    <th>Tranches 1:30 (réalisé/attendu)</th>
    <th>OK</th>
  </tr></thead>`;

  const tbody = document.createElement("tbody");

  rec.courses.forEach(c=>{
    const series = c.parts.map(p => `${p.actual}/${p.target}`).join(" • ");
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${c.label}</td><td>${c.pctVMA}%</td><td>${series}</td><td>${c.blocks_ok}/${c.blocks_total}</td>`;
    tbody.appendChild(tr);
  });

  const trSum = document.createElement("tr");
  trSum.innerHTML = `<td><b>Total</b></td><td></td>
    <td><b>Distance:</b> ${agg.distance} m • <b>Vitesse:</b> ${agg.vitesse} km/h • <b>VMA:</b> ${rec.runner.vma} km/h</td>
    <td><b>${agg.blocks_ok}/${agg.blocks_total}</b></td>`;
  tbody.appendChild(trSum);

  table.appendChild(tbody);
  wrap.appendChild(table);
  recapTables.appendChild(wrap);
}

// ---- QR détaillé (compatible ScanProf + détails lisibles) ----
function buildQRObject(rec, agg){
  const obj = {
    nom: rec.runner.nom,
    prenom: rec.runner.prenom,
    classe: rec.runner.classe,
    sexe: rec.runner.sexe || "M",
    distance: agg.distance,
    vitesse: agg.vitesse,
    vma: rec.runner.vma,
    espacement_m: agg.spacing,
    tol_kmh: (agg.spacing===12.5)? 0.5 : 0
  };
  rec.courses.forEach((c,ci)=>{
    const i = ci+1;
    obj[`%VMA C${i}`] = c.pctVMA;
    const dur = (c.label.split("@")[0]||"").trim();
    obj[`Durée C${i}`] = dur;
    c.parts.forEach((p,pi)=>{
      const j = pi+1;
      const delta = p.diff;
      const unit  = Math.abs(delta)===1 ? "plot" : "plots";
      const txt   = `${p.actual}/${p.target} (${delta===0?"0": (delta>0? "+"+delta: ""+delta)} ${unit})`;
      obj[`C${i}-1:30 #${j}`] = txt;
    });
    obj[`C${i} OK`]    = c.blocks_ok;
    obj[`C${i} Total`] = c.blocks_total;
  });
  obj["OK total"]    = agg.blocks_ok;
  obj["Blocs total"] = agg.blocks_total;
  return obj;
}

// ---- Génération QR en plein écran (fond blanc) ----
function showQR(arr){
  if(!window.QRCode){
    alert("Librairie QRCode non chargée. Vérifie la balise <script qrcodejs> dans recap.html.");
    return;
  }
  qrFull.innerHTML = ""; // reset
  new QRCode(qrFull, {
    text: JSON.stringify(arr),
    width: 640,
    height: 640,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });
  modal.classList.add("show");
}
closeBtn?.addEventListener("click", ()=> modal.classList.remove("show"));

// ---- Init : construit le tableau et les boutons QR ----
(function init(){
  if(!Array.isArray(results) || results.length===0){
    recapTables.innerHTML = "<div class='text-red-600'>Aucun résultat.</div>";
    return;
  }

  results.forEach((rec,idx)=>{
    const label = rec.runnerKey==="A" ? "Élève A" : "Élève B";
    const agg   = computeAgg(rec);

    // Tableau
    makeRecapTable(rec, agg, label);

    // Carte + bouton QR (un par élève)
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3 class="text-lg font-bold mb-2">${label} — ${rec.runner.prenom} ${rec.runner.nom}</h3>
      <div class="grid grid-cols-1 gap-2">
        <button class="btn btn-blue w-full" data-full="${idx}">QR plein écran (ScanProf + détails)</button>
      </div>
    `;
    qrButtons.appendChild(card);

    // Listener génération QR au clic
    const btnFull = card.querySelector(`[data-full="${idx}"]`);
    btnFull.addEventListener("click", ()=>{
      const obj = buildQRObject(rec, agg);
      showQR([obj]);  // tableau JSON d'un seul élève
    });
  });
})();
