// recap.js — QR compact FR (Pourcentage/S*/Projet P*) + QR centré + normalisation "Classe" + bornes anti-overflow
// Schéma QR: [{ nom, prenom, classe, sexe, vma, "Pourcentage 1", "S1", "Projet P1", ... (jusqu'à 3 courses) }]

// =====================
// Données + helpers DOM
// =====================
const results = loadJSON("vmamp:results", []); // fourni ailleurs dans l'app
const $ = (s) => document.querySelector(s);

const recapTables = $("#recapTables");
const qrButtons   = $("#qrButtons");
const modal       = $("#qrModal");
const closeBtn    = $("#closeModal");
const qrFull      = $("#qrFull");

// ========================
// Librairie QRCode (CDN)
// ========================
function ensureQRCodeLib(callback){
  if (window.QRCode) { callback(); return; }
  const s = document.createElement('script');
  s.src = "https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js";
  s.onload = callback;
  s.onerror = () => alert("Impossible de charger la librairie QRCode (qrcodejs). Vérifie la connexion.");
  document.head.appendChild(s);
}

// ================================
// Agrégats (distance, vitesse...)
// ================================
function computeAgg(rec){
  const spacing = rec.spacing_m || 12.5; // m entre plots
  let totalPlots = 0, totalSec = 0, blocks_total = 0, blocks_ok = 0;

  (rec.courses || []).forEach(c=>{
    (c.parts || []).forEach(p=>{
      totalPlots  += Number(p.actual || 0); // réalisé
      totalSec    += 90;                    // 1'30
      blocks_total += 1;
      if (p.ok) blocks_ok += 1;
    });
  });

  const distance = Math.round(totalPlots * spacing);                            // m
  const vitesse  = totalSec>0 ? Math.round((distance/totalSec)*3.6*10)/10 : 0; // km/h
  return { spacing, distance, vitesse, blocks_total, blocks_ok };
}

// ===============================
// Normalisation + nettoyage
// ===============================

// Normalise "5ème A" / "5 eme a" / "5 a" / "5A" => "5A"
function normalizeClasse(raw){
  const s = String(raw || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // retire les accents
    .replace(/\s+/g, " ").trim();
  // nombre + (optionnel) e/eme/ème + (optionnel) lettre
  const m = s.match(/(\d{1,2})\s*(?:e|eme|eme|eme|ème)?\s*([a-zA-Z])?/i);
  if (!m) return s.toUpperCase();
  const num    = m[1];
  const letter = (m[2] || "").toUpperCase();
  return (num + letter).toUpperCase(); // "5A" ou "5"
}

// Caps durs sur les textes & longueurs
const CAPS = {
  NOM: 18,          // ex. "DUPONT"
  PRENOM: 18,       // ex. "LUCAS"
  CLASSE: 3,        // "5A", "4C", "2"
  MAX_S_LEN: 180,   // longueur max pour S* = "a/b|a/b|..."
  OVERFLOW_SEUIL: 1000 // si payload > seuil, on retire les "Pourcentage *"
};

// Nettoyage + cap
function cleanCap(s, max){
  const t = String(s||"").normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  return (max && t.length > max) ? t.slice(0, max) : t;
}

// ===============================
// Tableau récapitulatif (affichage)
// ===============================
function makeRecapTable(rec, agg, label){
  const classeNorm = normalizeClasse(rec.runner.classe);
  const wrap = document.createElement("div");
  wrap.innerHTML = `<h3 class="text-lg font-bold mb-2">${label} — ${rec.runner.prenom} ${rec.runner.nom} (${classeNorm})</h3>`;

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

// ========================================
// QR compact FR par course + bornes strictes
// ========================================

// 1 élève / QR (robuste)
const USE_TWO_STUDENTS = false;

// Construit 1 élève compacté en FR : "Pourcentage 1", "S1", "Projet P1", etc.
function buildRowFR(rec){
  const row = {
    nom:    cleanCap((rec?.runner?.nom||"").toUpperCase(), CAPS.NOM),
    prenom: cleanCap(rec?.runner?.prenom||"", CAPS.PRENOM),
    classe: cleanCap(normalizeClasse(rec?.runner?.classe||""), CAPS.CLASSE),
    sexe:   cleanCap(rec?.runner?.sexe||"", 1),
    vma:    Number(rec?.runner?.vma||0)
  };

  (rec?.courses||[]).slice(0,3).forEach((c, idx)=>{
    const i = idx+1;
    const parts = (c?.parts||[]);
    let s = parts.map(p=>`${p.actual}/${p.target}`).join("|"); // "a/b|a/b|..."
    if (s.length > CAPS.MAX_S_LEN) s = s.slice(0, CAPS.MAX_S_LEN) + "+"; // marque une coupe
    const ct = parts.length;
    const ok = parts.reduce((n,p)=> n + (p.ok?1:0), 0);

    row[`Pourcentage ${i}`] = Math.round(Number(c?.pctVMA||0));
    row[`S${i}`]            = s;
    row[`Projet P${i}`]     = `${ok}/${ct}`;
  });

  return row;
}

// Emballe 1 élève dans un tableau JSON
function buildPayloadOne(row){ return JSON.stringify([row]); }

// Mini diagnostic sous le QR (longueur + tailles S1/S2/S3)
function showDiag(text){
  const id="qrDiag"; let box=document.getElementById(id);
  if(!box){
    box=document.createElement("div");
    box.id=id; box.style.fontFamily="monospace"; box.style.fontSize="12px"; box.style.marginTop="8px";
    box.style.whiteSpace="pre-wrap"; box.style.textAlign="center";
    qrFull.parentNode.insertBefore(box, qrFull.nextSibling);
  }
  box.textContent = text;
}

// Générateur QR (capacité max via niveau L) + centrage de la modale
function renderQR(text){
  // centre le conteneur de QR dans la modale
  if (modal){
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
  }
  if (qrFull){
    qrFull.style.margin = '0 auto';
    qrFull.style.display = 'block';
  }

  qrFull.innerHTML = "";
  new QRCode(qrFull, {
    text, width: 640, height: 640,
    colorDark: "#000", colorLight: "#fff",
    correctLevel: QRCode.CorrectLevel.L
  });

  // centre également la ligne de diag
  const diag = document.getElementById('qrDiag');
  if (diag) diag.style.textAlign = 'center';
}

// ======================
// Génération + fallback
// ======================
function showQRFallback(rec){
  ensureQRCodeLib(()=>{
    try{
      // 1) construit la ligne FR compactée avec caps + classe normalisée
      const row = buildRowFR(rec);

      // 2) si le JSON est trop long, supprimer "Pourcentage *" (gros gain)
      let payload = buildPayloadOne(row);
      if (payload.length > CAPS.OVERFLOW_SEUIL) {
        delete row["Pourcentage 1"];
        delete row["Pourcentage 2"];
        delete row["Pourcentage 3"];
        payload = buildPayloadOne(row);
      }

      // 3) rendu QR (centré)
      renderQR(payload);

      // 4) diagnostic : len total + tailles S1/S2/S3 + présence Pourcentage *
      const s1 = (row["S1"]||"").length, s2 = (row["S2"]||"").length, s3 = (row["S3"]||"").length;
      const p1 = (row["Pourcentage 1"]==null)?"-":row["Pourcentage 1"];
      const p2 = (row["Pourcentage 2"]==null)?"-":row["Pourcentage 2"];
      const p3 = (row["Pourcentage 3"]==null)?"-":row["Pourcentage 3"];
      showDiag(`len=${payload.length} | S1=${s1} S2=${s2} S3=${s3} | %1=${p1} %2=${p2} %3=${p3}`);

      if (modal){ modal.classList.add("show"); }
    }catch(e){
      alert("Erreur QR: " + (e?.message || e));
    }
  });
}

// =====================
// Modale : fermeture
// =====================
closeBtn?.addEventListener("click", ()=>{
  modal?.classList?.remove("show");
  if (modal) modal.style.display = 'none';
});

// =====================
// Init : tables + boutons
// =====================
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

    // Tableau élève (classe affichée normalisée)
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

  // Délégation clic : un bouton → un QR (1 élève par QR)
  qrButtons.addEventListener("click",(e)=>{
    const btn = e.target.closest("[data-full]");
    if(!btn) return;
    const idx = parseInt(btn.getAttribute("data-full"),10);
    const rec = results[idx];
    showQRFallback(rec);
  });
})();
