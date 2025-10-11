// recap.js — Tableau récap + QR compact borné (1 élève / QR) compatible ScanProf
// Schéma QR: [{ nom, prenom, classe, sexe, vma, s1, o1, (pc1?), s2, o2, (pc2?), s3, o3, (pc3?) }]

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
// Tableau récapitulatif (affichage)
// ===============================
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

// ========================================
// QR compact par course + bornes strictes
// ========================================

// 1 élève / QR (bornage taille)
const USE_TWO_STUDENTS = false;

// Caps durs sur les textes & longueurs des chaînes s1/s2/s3
const CAPS = {
  NOM: 18,          // ex. "DUPONT"
  PRENOM: 18,       // ex. "LUCAS"
  CLASSE: 8,        // ex. "2A", "4B"
  MAX_S_LEN: 180,   // longueur max d'une chaîne sN = "a/b|a/b|..."
  OVERFLOW_SEUIL: 1000 // si payload > seuil, on retire pc1..3
};

// Nettoyage + cap
function cleanCap(s, max){
  const t = String(s||"").normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  return (max && t.length > max) ? t.slice(0, max) : t;
}

// Construit 1 élève compacté par course : s1/s2/s3 (tronqués), o1/o2/o3, pc1..pc3 optionnels
function buildRowMP(rec){
  const row = {
    nom:    cleanCap((rec?.runner?.nom||"").toUpperCase(), CAPS.NOM),
    prenom: cleanCap(rec?.runner?.prenom||"", CAPS.PRENOM),
    classe: cleanCap(rec?.runner?.classe||"", CAPS.CLASSE),
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

    row[`s${i}`]  = s;
    row[`o${i}`]  = `${ok}/${ct}`;
    row[`pc${i}`] = Math.round(Number(c?.pctVMA||0)); // on enlèvera plus tard si trop gros
  });

  return row;
}

// Emballe 1 élève dans un tableau JSON
function buildPayloadOne(row){ return JSON.stringify([row]); }

// Mini diagnostic sous le QR (longueur totale + tailles s1/s2/s3)
function showDiag(text){
  const id="qrDiag"; let box=document.getElementById(id);
  if(!box){
    box=document.createElement("div");
    box.id=id; box.style.fontFamily="monospace"; box.style.fontSize="12px"; box.style.marginTop="8px";
    box.style.whiteSpace="pre-wrap";
    qrFull.parentNode.insertBefore(box, qrFull.nextSibling);
  }
  box.textContent = text;
}

// Générateur QR (capacité max via niveau L)
function renderQR(text){
  qrFull.innerHTML = "";
  new QRCode(qrFull, {
    text, width: 640, height: 640,
    colorDark: "#000", colorLight: "#fff",
    correctLevel: QRCode.CorrectLevel.L
  });
}

// ======================
// Génération + fallback
// ======================
function showQRFallback(rec){
  ensureQRCodeLib(()=>{
    try{
      // 1) construit la ligne compactée avec caps
      const row = buildRowMP(rec);

      // 2) si le JSON est trop long, supprimer pc1..3 (gros gain)
      let payload = buildPayloadOne(row);
      if (payload.length > CAPS.OVERFLOW_SEUIL) {
        delete row.pc1; delete row.pc2; delete row.pc3;
        payload = buildPayloadOne(row);
      }

      // 3) rendu QR
      renderQR(payload);

      // 4) diagnostic : len total + tailles s1/s2/s3 + présence pc*
      const s1 = (row.s1||"").length, s2 = (row.s2||"").length, s3 = (row.s3||"").length;
      const pc1 = (row.pc1==null)?"-":row.pc1, pc2 = (row.pc2==null)?"-":row.pc2, pc3 = (row.pc3==null)?"-":row.pc3;
      showDiag(`len=${payload.length} | s1=${s1} s2=${s2} s3=${s3} | pc1=${pc1} pc2=${pc2} pc3=${pc3}`);

      if (modal){ modal.classList.add("show"); modal.style.display='block'; }
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

  // Délégation clic : un bouton → un QR (1 élève par QR)
  qrButtons.addEventListener("click",(e)=>{
    const btn = e.target.closest("[data-full]");
    if(!btn) return;
    const idx = parseInt(btn.getAttribute("data-full"),10);
    const rec = results[idx];
    showQRFallback(rec);
  });
})();
