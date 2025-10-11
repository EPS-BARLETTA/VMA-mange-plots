// recap.js — Tableau récap + QR ScanProf (noPct → strict → ultraStrict) + diag taille

/* --------------------------
   Données + helpers DOM
--------------------------- */
const results = loadJSON("vmamp:results", []); // fourni ailleurs dans l'app
const $ = (s) => document.querySelector(s);

const recapTables = $("#recapTables");
const qrButtons   = $("#qrButtons");
const modal       = $("#qrModal");
const closeBtn    = $("#closeModal");
const qrFull      = $("#qrFull");

/* --------------------------
   Librairie QRCode (qrcodejs)
--------------------------- */
function ensureQRCodeLib(callback){
  if (window.QRCode) { callback(); return; }
  const s = document.createElement('script');
  s.src = "https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js";
  s.onload = callback;
  s.onerror = () => alert("Impossible de charger la librairie QRCode (qrcodejs). Vérifie la connexion.");
  document.head.appendChild(s);
}

/* --------------------------
   Outils (pour le QR uniquement)
   → n'affecte pas l'affichage
--------------------------- */
function _stripDiacritics(str){
  try { return (str||"").normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
  catch { return str||""; }
}
function _clean(str, max){
  const s = _stripDiacritics(String(str||"").trim());
  return (max && s.length>max) ? s.slice(0, max) : s;
}
function _isoDateOrToday(s){
  if (typeof s==="string" && /^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  try { return new Date().toISOString().slice(0,10); } catch { return ""; }
}

/* --------------------------
   Agrégats (affichage)
--------------------------- */
function computeAgg(rec){
  const spacing = rec.spacing_m || 12.5; // mètres entre plots
  let totalPlots = 0, totalSec = 0, blocks_total = 0, blocks_ok = 0;

  (rec.courses || []).forEach(c=>{
    (c.parts || []).forEach(p=>{
      totalPlots  += Number(p.actual || 0);   // réalisé
      totalSec    += 90;                      // 1'30 par tranche
      blocks_total += 1;
      if (p.ok) blocks_ok += 1;
    });
  });

  const distance = Math.round(totalPlots * spacing);                            // m
  const vitesse  = totalSec>0 ? Math.round((distance/totalSec)*3.6*10)/10 : 0; // km/h
  return { spacing, distance, vitesse, blocks_total, blocks_ok };
}

/* --------------------------
   Tableau récap (affichage)
--------------------------- */
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

  (rec.courses || []).forEach(c=>{
    const series = (c.parts || []).map(p => `${p.actual}/${p.target}`).join(" • ");
    const ct = (c.parts || []).length;
    const ok = (c.parts || []).reduce((n,p)=> n + (p.ok?1:0), 0);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.label || ""}</td>
      <td>${c.pctVMA != null ? c.pctVMA : ""}%</td>
      <td>${series}</td>
      <td>${(c.blocks_ok ?? ok)}/${(c.blocks_total ?? ct)}</td>`;
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

/* --------------------------
   BUILDERS QR 100% ScanProf
   → 1 élève par QR : payload = [ { ... } ]
--------------------------- */

// Base "strict" (clés standard, valeurs nettoyées + tronquées)
function buildScanProfRow_Strict(rec){
  return {
    "Nom": _clean((rec.runner?.nom||"").toUpperCase(), 24),
    "Prénom": _clean(rec.runner?.prenom||"", 24),
    "Classe": _clean(rec.runner?.classe||"", 16),
    "Sexe": _clean(rec.runner?.sexe||"", 1), // M/F
    "VMA": Number(rec.runner?.vma||0),
    "Séance": _isoDateOrToday(rec?.seanceISO)
  };
}

// Compact par tranches : Bk = "réalisé/attendu" (sans %V*), avec bornage
function buildScanProfRow_NoPct(rec){
  const row = buildScanProfRow_Strict(rec);
  let k=0, MAX_TRANCHES=24; // ajuste si besoin
  (rec.courses||[]).forEach(c=>{
    (c.parts||[]).forEach(p=>{
      k++;
      if (k<=MAX_TRANCHES) row["B"+k] = `${p.actual}/${p.target}`;
    });
  });
  if (k>MAX_TRANCHES) row["B_rest"] = k - MAX_TRANCHES; // info: tranches non encodées
  return row;
}

// Ultra strict (clés ultra-courtes) pour forcer le passage si nécessaire
// mêmes infos que "strict", mais en N,P,C,S,V,Se
function buildScanProfRow_UltraStrict(rec){
  return {
    "N": _clean((rec.runner?.nom||"").toUpperCase(), 16),
    "P": _clean(rec.runner?.prenom||"", 16),
    "C": _clean(rec.runner?.classe||"", 8),
    "S": _clean(rec.runner?.sexe||"", 1),
    "V": Number(rec.runner?.vma||0),
    "Se": _isoDateOrToday(rec?.seanceISO)
  };
}

// Encapsuler 1 élève dans un tableau JSON (format attendu par ScanProf)
function payloadOneRow(rowObj){
  return JSON.stringify([rowObj]); // compact, sans espaces
}

/* --------------------------
   MINI DIAGNOSTIC à l'écran
--------------------------- */
function showDiagUnderQR(txt){
  const id="qrDiag";
  let box=document.getElementById(id);
  if(!box){
    box=document.createElement("div");
    box.id=id;
    box.style.fontFamily="monospace";
    box.style.fontSize="12px";
    box.style.marginTop="8px";
    qrFull.parentNode.insertBefore(box, qrFull.nextSibling);
  }
  box.textContent = txt;
}

/* --------------------------
   Génération QR + Fallback
--------------------------- */
function showQRFallback(rec){
  ensureQRCodeLib(()=>{
    // 1) noPct : Bk sans %V* (capacité ++)
    try{
      const pNo = payloadOneRow(buildScanProfRow_NoPct(rec));
      qrFull.innerHTML = "";
      new QRCode(qrFull, { text:pNo, width:640, height:640, colorDark:"#000", colorLight:"#fff", correctLevel: QRCode.CorrectLevel.L });
      if (modal){ modal.classList.add("show"); modal.style.display='block'; }
      showDiagUnderQR(`noPct length=${pNo.length}`);
      return;
    }catch(eNo){
      // on tente l'étape suivante
    }

    // 2) strict : 6 champs de base (Nom, Prénom, Classe, Sexe, VMA, Séance)
    try{
      const pStrict = payloadOneRow(buildScanProfRow_Strict(rec));
      qrFull.innerHTML = "";
      new QRCode(qrFull, { text:pStrict, width:640, height:640, colorDark:"#000", colorLight:"#fff", correctLevel: QRCode.CorrectLevel.L });
      if (modal){ modal.classList.add("show"); modal.style.display='block'; }
      showDiagUnderQR(`strict length=${pStrict.length}`);
      return;
    }catch(eS){
      // étape suivante si nécessaire
    }

    // 3) ultraStrict : mêmes infos que strict, mais clés ultra courtes
    try{
      const pUltra = payloadOneRow(buildScanProfRow_UltraStrict(rec));
      qrFull.innerHTML = "";
      new QRCode(qrFull, { text:pUltra, width:640, height:640, colorDark:"#000", colorLight:"#fff", correctLevel: QRCode.CorrectLevel.L });
      if (modal){ modal.classList.add("show"); modal.style.display='block'; }
      showDiagUnderQR(`ultraStrict length=${pUltra.length}`);
      alert("QR ultra-compact généré (clés courtes).");
      return;
    }catch(eU){
      alert("Toujours trop gros (même ultra-compact). Il existe probablement un champ de base anormalement long (Nom/Prénom/Classe).");
    }
  });
}

/* --------------------------
   Modale : fermer
--------------------------- */
closeBtn?.addEventListener("click", ()=>{
  modal?.classList?.remove("show");
  if (modal) modal.style.display = 'none';
});

/* --------------------------
   Init : tableau + boutons QR
--------------------------- */
(function init(){
  if(!Array.isArray(results) || results.length===0){
    if (recapTables) recapTables.innerHTML = "<div class='text-red-600'>Aucun résultat.</div>";
    return;
  }

  results.forEach((rec,idx)=>{
    const label = rec.runnerKey==="A" ? "Élève A"
                : rec.runnerKey==="B" ? "Élève B"
                : `Élève ${idx+1}`;

    const agg = computeAgg(rec);

    // Tableau élève
    makeRecapTable(rec, agg, label);

    // Carte + bouton QR
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3 class="text-lg font-bold mb-2">${label} — ${rec.runner.prenom} ${rec.runner.nom}</h3>
      <div class="grid grid-cols-1 gap-2">
        <button class="btn btn-blue w-full" data-full="${idx}">QR plein écran (ScanProf)</button>
      </div>
    `;
    qrButtons.appendChild(card);
  });

  // Délégation de clic (un QR = un élève)
  qrButtons.addEventListener("click",(e)=>{
    const btn = e.target.closest("[data-full]");
    if(!btn) return;
    const idx = parseInt(btn.getAttribute("data-full"),10);
    const rec = results[idx];
    showQRFallback(rec);
  });
})();
