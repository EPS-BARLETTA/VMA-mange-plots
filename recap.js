// recap.js — Version complète : tableau récap + QR 100% ScanProf avec fallback taille

// Données + helpers DOM (loadJSON est supposé défini ailleurs dans l'app)
const results = loadJSON("vmamp:results", []);
const $ = (s) => document.querySelector(s);

const recapTables = $("#recapTables");
const qrButtons   = $("#qrButtons");
const modal       = $("#qrModal");
const closeBtn    = $("#closeModal");
const qrFull      = $("#qrFull");

// --- charge qrcodejs si manquant ---
function ensureQRCodeLib(callback){
  if (window.QRCode) { callback(); return; }
  const s = document.createElement('script');
  s.src = "https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js";
  s.onload = callback;
  s.onerror = () => alert("Impossible de charger la librairie QRCode. Vérifie ta connexion.");
  document.head.appendChild(s);
}

// ---- agrégats calculés sur le RÉALISÉ ----
function computeAgg(rec){
  const spacing = rec.spacing_m || 12.5; // espacement entre plots en mètres
  let totalPlots = 0;
  let totalSec   = 0;
  let blocks_total = 0;
  let blocks_ok    = 0;

  (rec.courses || []).forEach(c=>{
    (c.parts || []).forEach(p=>{
      const actual = Number(p.actual || 0);
      totalPlots  += actual; // réalisé
      totalSec    += 90;     // chaque tranche = 1'30
      blocks_total += 1;
      if (p.ok) blocks_ok += 1;
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

  (rec.courses || []).forEach(c=>{
    const series = (c.parts || []).map(p => `${p.actual}/${p.target}`).join(" • ");
    // calcule ok/total si non fourni
    const ct = (c.parts || []).length;
    const ok = (c.parts || []).reduce((n,p)=> n + (p.ok?1:0), 0);
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${c.label || ""}</td>
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

/* =========================
   BUILDERS 100% ScanProf
   ========================= */

// Construit UNE ligne (un élève) au format attendu par ScanProf
function buildScanProfRow(rec) {
  // Séance ISO (YYYY-MM-DD) si dispo, sinon aujourd'hui
  const seanceISO = rec?.seanceISO || (new Date()).toISOString().slice(0,10);

  const row = {
    "Nom": (rec.runner.nom || "").toUpperCase(),
    "Prénom": rec.runner.prenom || "",
    "Classe": rec.runner.classe || "",
    "Sexe": rec.runner.sexe || "",
    "VMA": Number(rec.runner.vma || 0),
    "Séance": seanceISO
  };

  // Aplatir les tranches 1'30 : B1, B2... et %V1, %V2...
  // Numérotation sur l'ensemble des courses
  let k = 0;
  (rec.courses || []).forEach(c => {
    const pct = Math.round(Number(c.pctVMA || 0)); // % pour la course (appliqué à ses tranches)
    (c.parts || []).forEach(p => {
      k += 1;
      const actual = (p.actual != null) ? p.actual : "";
      const target = (p.target != null) ? p.target : "";
      row["B"+k]  = `${actual}/${target}`; // "réalisé/attendu"
      row["%V"+k] = pct;                   // entier, ex. 83
    });
  });

  return row;
}

// Version "moins bavarde": on retire les %V* (gagne beaucoup d'octets)
function buildScanProfRow_NoPct(rec) {
  const base = buildScanProfRow(rec);
  Object.keys(base).forEach(k => {
    if (k.startsWith("%V")) delete base[k];
  });
  return base;
}

// Version "strict": seulement les champs de base
function buildScanProfRow_Strict(rec) {
  return {
    "Nom": (rec.runner.nom || "").toUpperCase(),
    "Prénom": rec.runner.prenom || "",
    "Classe": rec.runner.classe || "",
    "Sexe": rec.runner.sexe || "",
    "VMA": Number(rec.runner.vma || 0),
    "Séance": rec?.seanceISO || (new Date()).toISOString().slice(0,10)
  };
}

// Payload = tableau JSON (ScanProf accepte 1 ou 2 objets ; ici 1/QR)
function buildScanProfPayload(rowObj) {
  return JSON.stringify([rowObj]); // compact (pas d'espaces)
}

/* =========================
   Génération du QR + Fallback
   ========================= */

function makeQR(text, correctLevel){
  qrFull.innerHTML = "";
  new QRCode(qrFull, {
    text,
    width: 640,
    height: 640,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel // QRCode.CorrectLevel.L/M/Q/H
  });
}

function showQRFallback(rec){
  ensureQRCodeLib(()=>{
    // 1) FULL: Bk + %Vk (Correction M)
    try {
      const payloadFull = buildScanProfPayload(buildScanProfRow(rec));
      makeQR(payloadFull, QRCode.CorrectLevel.M);
      if (modal){ modal.classList.add("show"); modal.style.display = 'block'; }
      return;
    } catch(e1){
      // si le générateur remonte une erreur de taille
      const msg1 = (e1 && e1.message) ? e1.message : String(e1 || "");
      if (!/code length overflow/i.test(msg1)) { alert("Erreur QR: " + msg1); return; }
      // 2) NOPCT: Bk uniquement (Correction L)
      try{
        const payloadNoPct = buildScanProfPayload(buildScanProfRow_NoPct(rec));
        makeQR(payloadNoPct, QRCode.CorrectLevel.L);
        if (modal){ modal.classList.add("show"); modal.style.display = 'block'; }
        alert("QR compact sans %VMA (payload allégé).");
        return;
      }catch(e2){
        const msg2 = (e2 && e2.message) ? e2.message : String(e2 || "");
        if (!/code length overflow/i.test(msg2)) { alert("Erreur QR: " + msg2); return; }
        // 3) STRICT: champs de base (Correction L)
        try{
          const payloadStrict = buildScanProfPayload(buildScanProfRow_Strict(rec));
          makeQR(payloadStrict, QRCode.CorrectLevel.L);
          if (modal){ modal.classList.add("show"); modal.style.display = 'block'; }
          alert("QR strict (champs de base) — le payload détaillé dépassait la taille.");
          return;
        }catch(e3){
          alert("Erreur QR (strict): " + (e3?.message || e3));
        }
      }
    }
  });
}

// Fermer la modale
closeBtn?.addEventListener("click", ()=>{
  modal?.classList?.remove("show");
  if (modal) modal.style.display = 'none';
});

// ---- Init : construit le tableau et les boutons QR ----
(function init(){
  if(!Array.isArray(results) || results.length===0){
    if (recapTables) recapTables.innerHTML = "<div class='text-red-600'>Aucun résultat.</div>";
    return;
  }

  results.forEach((rec,idx)=>{
    const label = rec.runnerKey==="A" ? "Élève A" : (rec.runnerKey==="B" ? "Élève B" : `Élève ${idx+1}`);
    const agg   = computeAgg(rec);

    // Tableau
    makeRecapTable(rec, agg, label);

    // Carte + bouton QR (un par élève)
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

  // Délégation de clic (génère un QR pour l'élève ciblé)
  qrButtons.addEventListener("click",(e)=>{
    const btn = e.target.closest("[data-full]");
    if(!btn) return;
    const idx = parseInt(btn.getAttribute("data-full"),10);
    const rec = results[idx];
    showQRFallback(rec);
  });
})();
