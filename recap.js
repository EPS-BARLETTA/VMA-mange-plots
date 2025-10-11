// recap.js — Tableau récap + QR compact (par course) compatible ScanProf
// Schéma QR: [{ nom, prenom, classe, sexe, vma, s1, pc1, o1, s2, pc2, o2, s3, pc3, o3 }, (2e élève optionnel)]

// =====================
// Données + helpers DOM
// =====================
const results = loadJSON("vmamp:results", []); // déjà fourni ailleurs dans l'app
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
  s.onerror = () => alert("Impossible de charger la librairie QRCode.");
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
// QR compact façon "LaserRun", par course
// ========================================

// Nettoyage léger (accents → ASCII, trim, limite longueur pour éviter surprises)
function _clean(s, max){
  const t = String(s||"").normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  return max && t.length>max ? t.slice(0,max) : t;
}

// Construit 1 élève compacté par course : s1/s2/s3, pc1.., o1..
function buildRowMP(rec){
  const row = {
    nom:    _clean((rec?.runner?.nom||"").toUpperCase(), 24),
    prenom: _clean(rec?.runner?.prenom||"", 24),
    classe: _clean(rec?.runner?.classe||"", 16),
    sexe:   _clean(rec?.runner?.sexe||"", 1),
    vma:    Number(rec?.runner?.vma||0)
  };

  (rec?.courses||[]).slice(0,3).forEach((c, idx)=>{
    const i = idx+1;
    const parts = (c?.parts||[]);
    const s  = parts.map(p=>`${p.actual}/${p.target}`).join("|");  // "a/b|a/b|..."
    const ct = parts.length;
    const ok = parts.reduce((n,p)=> n + (p.ok?1:0), 0);
    row[`s${i}`]  = s;
    row[`pc${i}`] = Math.round(Number(c?.pctVMA||0));
    row[`o${i}`]  = `${ok}/${ct}`;
  });

  return row;
}

// Emballe 1 ou 2 élèves dans un tableau JSON (format attendu par ScanProf)
function buildPayload(rows){ return JSON.stringify(rows); }

// Mini diagnostic sous le QR
function _qrDiag(txt){
  const id="qrDiag"; let box=document.getElementById(id);
  if(!box){
    box=document.createElement("div");
    box.id=id; box.style.fontFamily="monospace"; box.style.fontSize="12px"; box.style.marginTop="8px";
    qrFull.parentNode.insertBefore(box, qrFull.nextSibling);
  }
  box.textContent = txt;
}

// Générateur QR (capacité max via niveau L)
function _renderQR(text){
  qrFull.innerHTML = "";
  new QRCode(qrFull, {
    text, width: 640, height: 640,
    colorDark: "#000", colorLight: "#fff",
    correctLevel: QRCode.CorrectLevel.L
  });
}

// OPTION: générer 2 élèves par QR (comme tes autres apps)
// true  = 2 élèves si dispo ; false = 1 élève/QR
const USE_TWO_STUDENTS = true;

// ======================
// Génération + Fallback
// ======================
function showQRFallback(rec){
  ensureQRCodeLib(()=>{
    try{
      const rows = [];
      rows.push(buildRowMP(rec));

      if (USE_TWO_STUDENTS) {
        const idx = results.indexOf(rec);
        if (idx>=0 && idx+1<results.length) rows.push(buildRowMP(results[idx+1]));
      }

      const payload = buildPayload(rows);
      _renderQR(payload);
      _qrDiag(`payload length=${payload.length} | eleves=${rows.length}`);
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

  // Délégation clic : un bouton → un QR (1 ou 2 élèves selon USE_TWO_STUDENTS)
  qrButtons.addEventListener("click",(e)=>{
    const btn = e.target.closest("[data-full]");
    if(!btn) return;
    const idx = parseInt(btn.getAttribute("data-full"),10);
    const rec = results[idx];
    showQRFallback(rec);
  });
})();
