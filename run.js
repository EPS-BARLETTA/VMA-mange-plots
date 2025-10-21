// =====================
//  Mange Plots — run.js
//  Lièvre (🐇) et Coureur (🏃) – icônes inline, Safari OK
// =====================

const $ = (s) => document.querySelector(s);
const pack = loadJSON(KEY_RUNNERS, null);
const plan = loadJSON(KEY_PLAN, []);
if (!pack || plan.length === 0) {
  alert("Paramétrage manquant.");
  location.href = "./setup.html";
}

const mode = pack.mode || "duo";
const order = mode === "duo" ? ["A", "B"] : mode === "soloA" ? ["A"] : ["B"];
let planIdx = 0, orderIdx = 0;
let running = false, startMs = 0, courseDur = 0, subStartMs = 0;
let elapsedSec = 0, subElapsedSec = 0, subPlots = 0;
let partsBuffer = [];

const elFirst = $("#runnerName .firstname"), elLast = $("#runnerName .lastname");
const elTimer = $("#timer"), elSubLeft = $("#subLeft"), elSubFill = $("#subFill"),
      elCounter = $("#counter"), panel = $("#counterPanel"), elTarget = $("#targetPlots"),
      btnStart = $("#btnStart");

// ===== PACER DOM =====
const elPacerBar = $("#pacerBar");
const elPacerTrack = $("#pacerTrack");
const elPacerBadge = $("#pacerBadge");
const elPacerTotal = $("#pacerTotal");
const elPacerRabbitNow = $("#pacerRabbitNow");
const elPacerRunnerNow = $("#pacerRunnerNow");
const elPacerDelta = $("#pacerDelta");
const elPacerDeltaM = $("#pacerDeltaM");
const elPacerRabbitIcon = $("#pacerRabbitIcon");
const elPacerRunnerIcon = $("#pacerRunnerIcon");

// Icônes inline (OK Safari/iPad) – pas d’assets externes
const PACER_RABBIT_SRC = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><text x="32" y="40" font-size="28" text-anchor="middle">🐇</text></svg>';
const PACER_RUNNER_SRC = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><text x="32" y="40" font-size="28" text-anchor="middle">🏃</text></svg>';

if (elPacerRabbitIcon) {
  elPacerRabbitIcon.src = PACER_RABBIT_SRC;
  // Miroir horizontal : le lièvre regarde vers la droite
  elPacerRabbitIcon.style.transform = 'translateX(-50%) scaleX(-1)';
}
if (elPacerRunnerIcon) {
  elPacerRunnerIcon.src = PACER_RUNNER_SRC;
  // En général déjà à droite ; décommente si besoin :
  // elPacerRunnerIcon.style.transform = 'translateX(-50%) scaleX(-1)';
}

// ========================
// UTILITAIRES
// ========================
function applyCourseTheme() {
  document.body.classList.remove("course0", "course1");
  document.body.classList.add(`course${planIdx % 2}`);
}
function bodyClassForRunner(rkey) {
  document.body.classList.remove("runnerA", "runnerB");
  document.body.classList.add(rkey === "A" ? "runnerA" : "runnerB");
}
function labelForCourse(idx) {
  const b = plan[idx];
  return `${b.duree} @ ${b.pctVMA}%`;
}
function currentRunnerKey() { return order[orderIdx]; }
function currentRunner()    { return pack[currentRunnerKey()]; }
function currentCourse()    { return plan[planIdx]; }

function mmssToSecondsLocal(s) {
  const [m, sec] = s.split(":").map((x) => parseInt(x, 10) || 0);
  return m * 60 + sec;
}
function plotsTargetPer90(speed_kmh, spacing_m) {
  const kmh_per_plot = spacing_m === 12.5 ? 0.5 : 1.0;
  return Math.round(speed_kmh / kmh_per_plot);
}
function targetPlotsPer90() {
  const r = currentRunner(), b = currentCourse();
  const v = r.vma * (b.pctVMA / 100);
  return plotsTargetPer90(v, pack.spacing_m);
}
function setPanelAlt() {
  panel.classList.toggle("alt", Math.floor(subElapsedSec / 90) % 2 === 1);
}

// ========================
// AUDIO
// ========================
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
  }
}
function beep(freq = 1000, dur = 0.08, vol = 0.05) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.frequency.value = freq; o.type = "sine"; g.gain.value = vol;
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); setTimeout(() => o.stop(), Math.floor(dur * 1000));
}

// ========================
// PACER
// ========================
function targetSpeedKmh() { const r = currentRunner(), b = currentCourse(); return r.vma * (b.pctVMA / 100); }
function targetSpeedMps() { return (targetSpeedKmh() * 1000) / 3600; }
function plotsPerSecond() { const s = pack.spacing_m || 12.5; return targetSpeedMps() / s; }
function totalExpectedPlots() {
  const sec = mmssToSecondsLocal(currentCourse().duree);
  return plotsPerSecond() * sec;
}
function runnerPlotsCumul() {
  const done = partsBuffer.reduce((sum, p) => sum + (p.actual || 0), 0);
  return done + subPlots;
}
function rabbitPlotsCumul() { return plotsPerSecond() * elapsedSec; }

function updatePacerUI() {
  if (!elPacerBar) return;

  const total = Math.max(1e-6, totalExpectedPlots()); // évite /0
  const rabbit = rabbitPlotsCumul();
  const runner = runnerPlotsCumul();

  // positions (gauche → droite)
  const posRabbit = Math.max(0, Math.min(100, (rabbit / total) * 100));
  const posRunner = Math.max(0, Math.min(100, (runner / total) * 100));
  if (elPacerRabbitIcon) elPacerRabbitIcon.style.left = posRabbit + "%";
  if (elPacerRunnerIcon) elPacerRunnerIcon.style.left = posRunner + "%";
  if (elPacerBadge)       elPacerBadge.style.left = posRabbit + "%";

  // Badge : plots à "manger" pour finir le bloc courant
  const targetBlock = targetPlotsPer90();
  const remainBlock = Math.max(0, targetBlock - subPlots);
  if (elPacerBadge) elPacerBadge.textContent = (remainBlock>0?'+':'') + remainBlock + ' plots';

  // Couleur piste selon écart cumul
  const delta = runner - rabbit;
  const tol = total * 0.01;
  let color = "rgba(245,245,245,1)"; // neutre
  if (delta >  tol) color = "rgba(34,197,94,.25)";   // avance
  if (delta < -tol) color = "rgba(239,68,68,.25)";   // retard
  if (elPacerTrack) elPacerTrack.style.background = color;

  // Légendes
  if (elPacerTotal)     elPacerTotal.textContent = Math.round(total);
  if (elPacerRabbitNow) elPacerRabbitNow.textContent = Math.round(rabbit);
  if (elPacerRunnerNow) elPacerRunnerNow.textContent = Math.round(runner);
  if (elPacerDelta)     elPacerDelta.textContent = (delta>0?'+':'') + Math.round(delta);
  if (elPacerDeltaM)    elPacerDeltaM.textContent = Math.round(delta * (pack.spacing_m || 12.5));
}

// ========================
// UI + LOGIQUE
// ========================
function refreshUI() {
  const r = currentRunner();
  elFirst.textContent = r.prenom; elLast.textContent = " " + r.nom;

  const left = Math.max(0, courseDur - elapsedSec);
  elTimer.textContent = secondsToMMSS(left);

  const subLeft = Math.max(0, 90 - subElapsedSec);
  elSubLeft.textContent = secondsToMMSS(subLeft);
  elSubFill.style.width = `${Math.min(100, (subElapsedSec / 90) * 100)}%`;

  elCounter.textContent = subPlots;
  elTarget.textContent = targetPlotsPer90();
  setPanelAlt();

  elTimer.classList.toggle("blink", subLeft <= 5 && running);
  btnStart.disabled = running;

  updatePacerUI();
}

function saveSub() {
  const target = targetPlotsPer90();
  const diff = subPlots - target;
  const ok = pack.spacing_m === 12.5 ? Math.abs(diff) <= 1 : diff === 0;
  const subIndex = partsBuffer.length + 1;
  partsBuffer.push({ subIndex, target, actual: subPlots, diff, ok });
}

function advanceAfterCourse() {
  const results = loadJSON(KEY_RESULTS, []);
  const rkey = currentRunnerKey();
  let rec = results.find((x) => x.runnerKey === rkey);
  if (!rec) {
    rec = { runnerKey: rkey, runner: currentRunner(), spacing_m: pack.spacing_m, courses: [] };
    results.push(rec);
  }
  rec.courses.push({
    label: labelForCourse(planIdx),
    pctVMA: currentCourse().pctVMA,
    parts: partsBuffer.slice(),
    blocks_total: partsBuffer.length,
    blocks_ok: partsBuffer.filter((p) => p.ok).length
  });
  saveJSON(KEY_RESULTS, results);

  partsBuffer = []; subPlots = 0;

  if (order.length === 2) { orderIdx = (orderIdx + 1) % 2; if (orderIdx === 0) planIdx++; }
  else { planIdx++; }

  if (planIdx >= plan.length) { location.href = "./recap.html"; return; }

  const sec = mmssToSecondsLocal(currentCourse().duree);
  courseDur = sec; elapsedSec = 0; subElapsedSec = 0;
  startMs = performance.now(); subStartMs = startMs;

  applyCourseTheme(); bodyClassForRunner(currentRunnerKey()); refreshUI();
}

function loop() {
  if (!running) return;
  const now = performance.now();
  elapsedSec = Math.floor((now - startMs) / 1000);
  subElapsedSec = Math.floor((now - subStartMs) / 1000);

  const subLeft = 90 - subElapsedSec;

  if (subLeft <= 5 && subLeft > 0 && (now % 1000) < 50) beep(1200, 0.06, 0.05);

  if (subElapsedSec >= 90) {
    beep(800, 0.12, 0.06);
    saveSub();
    subPlots = 0;
    subStartMs += 90 * 1000;
    updatePacerUI();
  }

  if (elapsedSec >= courseDur) {
    if (subElapsedSec > 0 && subElapsedSec < 90) saveSub();
    running = false;
    advanceAfterCourse();
    return;
  }

  refreshUI();
  requestAnimationFrame(loop);
}

// ========================
// ÉVÉNEMENTS
// ========================
$("#btnPlus").addEventListener("click", () => {
  if (!running) return;
  subPlots += 1; refreshUI();
});
$("#btnMinus").addEventListener("click", () => {
  if (!running) return;
  if (subPlots > 0) subPlots -= 1; refreshUI();
});
$("#btnStart").addEventListener("click", () => {
  if (running) return;
  ensureAudio();
  try { new (window.NoSleep || function () {})().enable?.(); } catch (e) {}
  const sec = mmssToSecondsLocal(currentCourse().duree);
  courseDur = sec; elapsedSec = 0; subElapsedSec = 0;
  startMs = performance.now(); subStartMs = startMs;
  applyCourseTheme(); bodyClassForRunner(currentRunnerKey());
  running = true; refreshUI(); requestAnimationFrame(loop);
});

// ========================
// INIT
// ========================
(function init() {
  applyCourseTheme(); bodyClassForRunner(currentRunnerKey()); refreshUI();
})();
