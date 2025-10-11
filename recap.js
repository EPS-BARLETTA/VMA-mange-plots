// recap.js — QR ScanProf avec clés standard + compactage par course (S*/PC*/O*) et fallback sans PC

/* --------------------------
   Données + helpers DOM
--------------------------- */
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
   Outils (QR uniquement)
--------------------------- */
function stripDiacritics(str){
  try { return (str||"").normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
  catch { return str||""; }
}
function clean(str, max){
  const s = stripDiacritics(String(str||"").trim());
  return (max && s.length>max) ? s.slice(0, max) : s;
}
function isoDateOrToday(s){
  if (typeof s==="string" && /^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  try { return new Date().toISOString().slice(0,10); } catch { return ""; }
}

/* --------------------------
   Agrégats (affichage)
--------------------------- */
function computeAgg(rec){
  const spacing = rec.spacing_m || 12.5;
  let totalPlots = 0, totalSec = 0, blocks_total = 0, blocks_ok = 0;

  (rec.courses || []).forEach(c=>{
    (c.parts || []).forEach(p=>{
      totalPlots  += Number(p.actual || 0);
      totalSec    += 90;
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
   BUILDERS QR (clés standard)
--------------------------- */

// Champs de base (noms standards, valeurs nettoyées)
function buildRowBase(rec){
  return {
    "Nom":    clean((rec.runner?.nom||"").toUpperCase(), 24),
    "Prénom": clean(rec.runner?.prenom||"", 24),
    "Classe": clean(rec.runner?.classe||"", 16),
    "Sexe":   clean(rec.runner?.sexe||"", 1),  // M/F
    "VMA":    Number(rec.runner?.vma||0),
    "Séance": isoDateOrToday(rec?.seanceISO)
  };
}

// Compactage PAR COURSE : S*= "a/b|a/b|..." , PC*= %VMA de la course, O*="ok/total"
function buildRowPackedCourses(rec){
  const row = buildRowBase(rec);
  (rec.courses||[]).slice(0,3).forEach((c,idx)=>{
    const i = idx+1;
    const s  = (c.parts||[]).map(p=>`${p.actual}/${p.target}`).join("|");
    const ct = (c.parts||[]).length;
    const ok = (c.parts||[]).reduce((n,p)=> n + (p.ok?1:0), 0);
    row[`S${i}`]  = s;                                      // toutes les tranches de la course i
    row[`PC${i}`] = Math.round(Number(c.pctVMA||0));        // %VMA course i
    row[`O${i}`]  = `${ok}/${ct}`;                          // ok/total
  });
  if ((rec.courses||[]).length > 3) row["S_rest"] = (rec.courses.length - 3);
  return row;
}

// Variante sans %VMA par course (gain de place)
function buildRowPackedCourses_NoPC(rec){
  const row = buildRowBase(rec);
  (rec.courses||[]).slice(0,3).forEach((c,idx)=>{
    const i = idx+1;
    const s  = (c.parts||[]).map(p=>`${p.actual}/${p.target}`).join("|");
    const ct = (c.parts||[]).length;
    const ok = (c.parts||[]).reduce((n,p)=> n + (p.ok?1:0), 0);
    row[`S${i}`] = s;
    row[`O${i}`] = `${ok}/${ct}`;
  });
  if ((rec.courses||[]).length > 3) row["S_rest"] = (rec.courses.length - 3);
  return row;
}

// Strict = seulement les champs de base
function buildRowStrict(rec){
  return buildRowBase(rec);
}

function payloadOneRow(rowObj){
  return JSON.stringify([rowObj]); // ScanProf attend un tableau JSON
}

/* --------------------------
   Mini diagnostic sous le QR
--------------------------- */
function showDiag(txt){
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
   Génération QR + Fallback (sans jamais changer les noms de champs)
--------------------------- */
function showQRFallback(rec){
  ensureQRCodeLib(()=>{
    // 1) PACKED (S*/PC*/O*)
    try{
      const pPacked = payloadOneRow(buildRowPackedCourses(rec));
      qrFull.innerHTML = "";
      new QRCode(qrFull, { text:pPacked, width:640, height:640, colorDark:"#000", colorLight:"#fff", correctLevel: QRCode.CorrectLevel.L });
      if (modal){ modal.classList.add("show"); modal.style.display='block'; }
      showDiag(`packed length=${pPacked.length}`);
      return;
    }catch(e1){ /* continue */ }

    // 2) PACKED_SANS_PC (S*/O*)
    try{
      const pNoPC = payloadOneRow(buildRowPackedCourses_NoPC(rec));
      qrFull.innerHTML = "";
      new QRCode(qrFull, { text:pNoPC, width:640, height:640, colorDark:"#000", colorLight:"#fff", correctLevel: QRCode.CorrectLevel.L });
      if (modal){ modal.classList.add("show"); modal.style.display='block'; }
      showDiag(`packed_noPC length=${pNoPC.length}`);
      return;
    }catch(e2){ /* continue */ }

    // 3) STRICT (champs de base uniquement)
    try{
      const pStrict = payloadOneRow(buildRowStrict(rec));
      qrFull.innerHTML = "";
      new QRCode(qrFull, { text:pStrict, width:640, height:640, colorDark:"#000", colorLight:"#fff", correctLevel: QRCode.CorrectLevel.L });
      if (modal){ modal.classList.add("show"); modal.style.display='block'; }
      showDiag(`strict length=${pStrict.length}`);
      return;
    }catch(e3){
      alert("Erreur QR: le contenu est encore trop volumineux. Vérifie qu’aucun champ de base (Nom/Prénom/Classe) n’est anormalement long.");
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
