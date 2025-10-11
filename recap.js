// recap.js — Tableau récap + QR ScanProf (fallback anti-overflow + diagnostic)

/* --------------------------
   Données + helpers DOM
--------------------------- */
// loadJSON est supposé défini ailleurs dans l'app
const results = loadJSON("vmamp:results", []);
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
   Outils utilitaires (QR uniquement)
   - on NE change PAS l'affichage, seulement le contenu du QR
--------------------------- */
function stripDiacritics(str){
  try { return (str || "").normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
  catch { return str || ""; }
}
function sanitizeText(str, maxLen){
  const s = stripDiacritics(String(str || ""));
  return (maxLen && s.length > maxLen) ? s.slice(0, maxLen) : s;
}
function isoDateOrToday(s){
  if (typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  try { return new Date().toISOString().slice(0,10); } catch { return ""; }
}

/* --------------------------
   Agrégats calculés sur le RÉALISÉ (affichage)
--------------------------- */
function computeAgg(rec){
  const spacing = rec.spacing_m || 12.5; // m entre plots
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
   Tableau récapitulatif (affichage)
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
   - 1 élève par QR : payload = [ { ... } ]
   - Clés plates : Nom, Prénom, Classe, Sexe, VMA, Séance, B1..Bn, %V1..%Vn
--------------------------- */
function buildRowBaseForQR(rec){
  // Nettoyage léger pour le QR (accents/longueurs) — l'affichage à l'écran n'est PAS modifié
  const nom    = sanitizeText((rec.runner?.nom || "").toUpperCase(), 32);
  const prenom = sanitizeText(rec.runner?.prenom || "", 32);
  const classe = sanitizeText(rec.runner?.classe || "", 24);
  const sexe   = sanitizeText(rec.runner?.sexe || "", 1); // "M" ou "F" en général
  const vma    = Number(rec.runner?.vma || 0);
  const seance = isoDateOrToday(rec?.seanceISO);

  return {
    "Nom": nom,
    "Prénom": prenom,
    "Classe": classe,
    "Sexe": sexe,
    "VMA": vma,
    "Séance": seance
  };
}

function buildScanProfRow_Full(rec){
  const row = buildRowBaseForQR(rec);
  let k = 0;
  (rec.courses || []).forEach(c=>{
    const pct = Math.round(Number(c.pctVMA || 0));
    (c.parts || []).forEach(p=>{
      k += 1;
      row["B"+k]  = `${p.actual}/${p.target}`; // réalisé/attendu
      row["%V"+k] = pct;                       // entier
    });
  });
  return row;
}

function buildScanProfRow_NoPct(rec){
  const row = buildRowBaseForQR(rec);
  let k = 0;
  (rec.courses || []).forEach(c=>{
    (c.parts || []).forEach(p=>{
      k += 1;
      row["B"+k] = `${p.actual}/${p.target}`;
    });
  });
  return row;
}

function buildScanProfRow_Strict(rec){
  // Strict = seulement les 6 champs de base (+ Séance)
  return buildRowBaseForQR(rec);
}

function payloadOneRow(rowObj){
  // ScanProf attend un tableau JSON : 1 (ou 2) objets
  // Ici : 1 élève par QR pour limiter la taille
  return JSON.stringify([rowObj]);
}

/* --------------------------
   DIAGNOSTIC (console)
--------------------------- */
function _diagQR(rec){
  try{
    const base = buildRowBaseForQR(rec);
    const strict = payloadOneRow(base);
    console.log("[QR] strict length:", strict.length, strict);

    const full = payloadOneRow(buildScanProfRow_Full(rec));
    console.log("[QR] full length:", full.length);

    const nopct = payloadOneRow(buildScanProfRow_NoPct(rec));
    console.log("[QR] noPct length:", nopct.length);

    // Compter les tranches
    let k = 0;
    (rec.courses||[]).forEach(c=> (c.parts||[]).forEach(()=> k++));
    console.log("[QR] tranches (k):", k);
  }catch(err){
    console.log("[QR] diag error:", err);
  }
}

/* --------------------------
   Génération QR + Fallback
--------------------------- */
function makeQR(text){
  qrFull.innerHTML = "";
  new QRCode(qrFull, {
    text,
    width: 640,
    height: 640,
    colorDark: "#000000",
    colorLight: "#ffffff",
    // Pour maximiser la capacité, on force le niveau L
    correctLevel: QRCode.CorrectLevel.L
  });
}

function showQRFallback(rec){
  ensureQRCodeLib(()=>{
    // Diagnostic console (ne change rien au QR)
    _diagQR(rec);

    // 1) FULL (Bk + %Vk)
    try{
      const pFull = payloadOneRow(buildScanProfRow_Full(rec));
      makeQR(pFull);
      if (modal){ modal.classList.add("show"); modal.style.display = 'block'; }
      return;
    }catch(e1){
      const m1 = e1?.message || String(e1||"");
      // Si ce n'est pas un overflow, on remonte l'erreur
      if (!/code length overflow/i.test(m1)) { alert("Erreur QR (full): " + m1); return; }
    }

    // 2) NoPct (Bk uniquement)
    try{
      const pNo = payloadOneRow(buildScanProfRow_NoPct(rec));
      makeQR(pNo);
      if (modal){ modal.classList.add("show"); modal.style.display = 'block'; }
      alert("QR compact (sans %VMA) pour réduire la taille.");
      return;
    }catch(e2){
      const m2 = e2?.message || String(e2||"");
      if (!/code length overflow/i.test(m2)) { alert("Erreur QR (noPct): " + m2); return; }
    }

    // 3) Strict (6 champs de base + Séance)
    try{
      const pStrict = payloadOneRow(buildScanProfRow_Strict(rec));
      makeQR(pStrict);
      if (modal){ modal.classList.add("show"); modal.style.display = 'block'; }
      alert("QR strict (champs essentiels) — le payload détaillé dépassait la taille.");
      return;
    }catch(e3){
      alert("Erreur QR (strict): " + (e3?.message || e3));
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
