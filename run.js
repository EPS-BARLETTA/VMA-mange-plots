// Helpers & état
const $ = (sel) => document.querySelector(sel);

const runners = loadJSON(KEY_RUNNERS, null);
const plan = loadJSON(KEY_PLAN, []);
const results = loadJSON(KEY_RESULTS, []);

if (!runners || plan.length === 0) {
  alert("Paramétrage manquant. Retour à l'accueil.");
  location.href = "./setup.html";
}

// Index du bloc et du sous-bloc (1:30)
let blocIndex = 0;
let subIndex = 0;

// Timers
let running = false;
let timerInterval = null;
let elapsed = 0;      // secondes écoulées dans le bloc courant
let subElapsed = 0;   // secondes écoulées dans le sous-bloc courant
const subTarget = 90; // 1:30
let subPlots = 0;     // compteur plots du sous-bloc

// Sélecteurs UI
const elBlocTitle = $("#blocTitle");
const elRunnerName = $("#runnerName");
const elTimer = $("#timer");
const elSubLeft = $("#subLeft");
const elKpiVitesse = $("#kpiVitesse");
const elKpiPlots = $("#kpiPlots");
const elKpiTol = $("#kpiTol");
const elCounter = $("#counter");
const elFeedback = $("#feedback");
const elRunnerBadge = $("#runnerBadge");
const elSubLog = $("#subLog");
const elTbodyResults = $("#tbodyResults");

// Log détaillé pour calcul des moyennes par bloc
// Chaque entrée : { blocIndex, runnerKey: "A"|"B", subPlots, plotsCible }
let blocRunLog = [];

// --- Utilitaires ---
function currentBloc() {
  return plan[blocIndex];
}
function mmssToSecondsLocal(mmss) {
  // fallback au cas où app.js ne serait pas chargé (mais normalement il l’est)
  return typeof mmssToSeconds === "function"
    ? mmssToSeconds(mmss)
    : mmss.split(":").map(Number).reduce((m, s) => (m || 0) * 60 + (s || 0));
}
function secondsToMMSSLocal(s) {
  return typeof secondsToMMSS === "function"
    ? secondsToMMSS(s)
    : `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// Qui court ce sous-bloc ?
function currentRunnerForBloc() {
  const b = currentBloc();
  if (b.runner === "A") return "A";
  if (b.runner === "B") return "B";
  // Alternance A/B par sous-bloc
  return (subIndex % 2 === 0) ? "A" : "B";
}

// Rafraîchit tous les éléments UI
function refreshUI() {
  const b = currentBloc();
  const who = currentRunnerForBloc();
  const r = runners[who];

  elBlocTitle.textContent = `Bloc ${blocIndex + 1}/${plan.length} — ${b.duree} @ ${b.pctVMA}%`;
  elRunnerName.textContent = `${r.prenom} ${r.nom} (${who})`;

  const vCible = speedTarget(r.vma, b.pctVMA);
  const plotsCible = plotsPer90FromSpeed(vCible);
  elKpiVitesse.textContent = vCible.toFixed(1);
  elKpiPlots.textContent = String(plotsCible);
  elKpiTol.textContent = String(computeTolerancePlots());

  const timeLeft = Math.max(0, mmssToSecondsLocal(b.duree) - elapsed);
  elTimer.textContent = secondsToMMSSLocal(timeLeft);
  elSubLeft.textContent = secondsToMMSSLocal(Math.max(0, subTarget - subElapsed));

  elCounter.textContent = String(subPlots);

  const diff = subPlots - plotsCible;
  if (Math.abs(diff) <= 1) {
    elFeedback.innerHTML = `<span class="badge badge-ok">OK (${diff >= 0 ? "+" : ""}${diff})</span>`;
  } else if (Math.abs(diff) === 2) {
    elFeedback.innerHTML = `<span class="badge badge-warn">${diff >= 0 ? "+" : ""}${diff} plot(s)</span>`;
  } else {
    elFeedback.innerHTML = `<span class="badge badge-err">${diff >= 0 ? "+" : ""}${diff} plot(s)</span>`;
  }

  elRunnerBadge.textContent = running ? "En cours" : "En pause";
  elRunnerBadge.className = "badge " + (running ? "badge-ok" : "badge-warn");
}

// Ajoute une ligne de log pour le sous-bloc terminé
function pushSubLog() {
  const b = currentBloc();
  const who = currentRunnerForBloc();
  const r = runners[who];
  const vCible = speedTarget(r.vma, b.pctVMA);
  const plotsCible = plotsPer90FromSpeed(vCible);
  const diff = subPlots - plotsCible;

  const li = document.createElement("li");
  li.textContent = `Bloc ${blocIndex + 1}.${subIndex + 1} — ${r.prenom} ${r.nom} : ${subPlots} plots (cible ${plotsCible}, diff ${diff >= 0 ? "+" : ""}${diff})`;
  elSubLog.appendChild(li);
  elSubLog.scrollTop = elSubLog.scrollHeight;
}

// Finalise un bloc (agrège par coureur)
function finalizeBloc() {
  const b = currentBloc();

  ["A", "B"].forEach((k) => {
    const parts = blocRunLog.filter((x) => x.blocIndex === blocIndex && x.runnerKey === k);
    if (!parts.length) return;

    const r = runners[k];
    const plotsAvg = parts.reduce((s, x) => s + x.subPlots, 0) / parts.length;
    const ecartPlotsTotal = Math.round(parts.reduce((s, x) => s + (x.subPlots - x.plotsCible), 0) * 10) / 10;
    const ecartKmH = Number((ecartPlotsTotal * 0.5).toFixed(1)); // 1 plot = 0,5 km/h (sur 1:30)

    const row = {
      nom: r.nom,
      prenom: r.prenom,
      classe: r.classe,
      vma: r.vma,
      duree: b.duree,
      pctVMA: b.pctVMA,
      vitesse_cible: speedTarget(r.vma, b.pctVMA).toFixed(1),
      plots_cible_90s: plotsPer90FromSpeed(speedTarget(r.vma, b.pctVMA)),
      plots_moy_90s: Math.round(plotsAvg * 10) / 10,
      ecart_plots_total: ecartPlotsTotal,
      ecart_kmh: ecartKmH,
    };
    results.push(row);
  });

  saveJSON(KEY_RESULTS, results);
  renderResults();
}

// Tick du chrono (toutes les secondes)
function stepTick() {
  const b = currentBloc();

  elapsed++;
  subElapsed++;

  if (subElapsed >= subTarget) {
    // Clôture du sous-bloc
    const who = currentRunnerForBloc();
    const r = runners[who];
    const vCible = speedTarget(r.vma, b.pctVMA);
    const plotsCible = plotsPer90FromSpeed(vCible);

    blocRunLog.push({ blocIndex, runnerKey: who, subPlots, plotsCible });
    pushSubLog();

    // Passage au sous-bloc suivant
    subIndex++;
    subElapsed = 0;
    subPlots = 0;

    // Fin du bloc ?
    if (subIndex >= b.blocks90) {
      finalizeBloc();

      // Bloc suivant
      blocIndex++;
      if (blocIndex >= plan.length) {
        // Fin de séance
        clearInterval(timerInterval);
        timerInterval = null;
        running = false;
        refreshUI();
        alert("Séance terminée ✅");
        return;
      }
      // Reset pour le nouveau bloc
      elapsed = 0;
      subElapsed = 0;
      subIndex = 0;
      subPlots = 0;
    }
  }

  refreshUI();
}

// Rendu du tableau de résultats
function renderResults() {
  elTbodyResults.innerHTML = "";
  results.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.prenom} ${r.nom}</td>
      <td>${r.duree}</td>
      <td>${r.pctVMA}%</td>
      <td>${r.plots_moy_90s}</td>
      <td>${r.ecart_kmh} km/h</td>
    `;
    elTbodyResults.appendChild(tr);
  });
}

// Init bloc courant
function initBloc() {
  elapsed = 0;
  subElapsed = 0;
  subIndex = 0;
  subPlots = 0;
  refreshUI();
}

// --- Actions UI ---
document.getElementById("btnStart").addEventListener("click", () => {
  if (running) return;
  running = true;
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(stepTick, 1000);
  refreshUI();
});

document.getElementById("btnPause").addEventListener("click", () => {
  running = false;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  refreshUI();
});

document.getElementById("btnNext").addEventListener("click", () => {
  // Force la clôture du sous-bloc en cours (même si < 1:30)
  const b = currentBloc();
  const who = currentRunnerForBloc();
  const r = runners[who];
  const vCible = speedTarget(r.vma, b.pctVMA);
  const plotsCible = plotsPer90FromSpeed(vCible);

  blocRunLog.push({ blocIndex, runnerKey: who, subPlots, plotsCible });
  pushSubLog();

  subIndex++;
  subElapsed = 0;
  subPlots = 0;

  if (subIndex >= b.blocks90) {
    finalizeBloc();
    blocIndex++;
    if (blocIndex >= plan.length) {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      running = false;
      refreshUI();
      alert("Séance terminée ✅");
      return;
    }
    elapsed = 0;
    subElapsed = 0;
    subIndex = 0;
    subPlots = 0;
  }
  refreshUI();
});

document.getElementById("btnPlus").addEventListener("click", () => {
  subPlots += 1;
  refreshUI();
});
document.getElementById("btnMinus").addEventListener("click", () => {
  if (subPlots > 0) subPlots -= 1;
  refreshUI();
});

document.getElementById("btnReset").addEventListener("click", () => {
  if (!confirm("Réinitialiser la séance (plan et résultats conservés) ?")) return;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  running = false;
  blocIndex = 0;
  subIndex = 0;
  elapsed = 0;
  subElapsed = 0;
  subPlots = 0;
  blocRunLog = [];
  refreshUI();
});

// Export CSV des résultats
document.getElementById("btnExportCSV").addEventListener("click", () => {
  const csv = resultsToCSV(results);
  download("resultats_mange_plots.csv", csv, "text/csv");
});

// QR pour A, B, ou les deux
function qrFor(eleveKey) {
  const target = eleveKey === "A" ? runners.A : runners.B;
  const filtered = results.filter(
    (r) => r.nom === target.nom && r.prenom === target.prenom && r.classe === target.classe
  );
  const payload = buildScanProfPayload(filtered);
  const el = document.createElement("div");
  document.getElementById("qrcodes").appendChild(el);
  makeQRCode(el, JSON.stringify(payload));
}

document.getElementById("btnQRA").addEventListener("click", () => {
  document.getElementById("qrcodes").innerHTML = "";
  qrFor("A");
});
document.getElementById("btnQRB").addEventListener("click", () => {
  document.getElementById("qrcodes").innerHTML = "";
  qrFor("B");
});
document.getElementById("btnQRBoth").addEventListener("click", () => {
  document.getElementById("qrcodes").innerHTML = "";
  const payload = buildScanProfPayload(results);
  const el = document.createElement("div");
  document.getElementById("qrcodes").appendChild(el);
  makeQRCode(el, JSON.stringify(payload));
});

// Démarrage
initBloc();
renderResults();
refreshUI();
