// =====================
//  Mange Plots — run.js (pacer simple, ±1 plot vert, fin 1re course manuelle, 2e course → récap)
//  build: mp-2025-10-21-2
// =====================

console.log("run.js build mp-2025-10-21-2");

const $ = (s) => document.querySelector(s);
const pack = loadJSON(KEY_RUNNERS, null);
const plan = loadJSON(KEY_PLAN, []);
if (!pack || plan.length === 0) {
  alert("Paramétrage manquant.");
  location.href = "./setup.html";
}

const mode  = pack.mode || "duo";
const order = (mode === "duo") ? ["A","B"] : (mode === "soloA" ? ["A"] : ["B"]);
let planIdx=0, orderIdx=0;
let running=false, startMs=0, courseDur=0, subStartMs=0;
let elapsedSec=0, subElapsedSec=0, subPlots=0;
let partsBuffer=[];

const elFirst = $("#runnerName .firstname"), elLast = $("#runnerName .lastname");
const elTimer = $("#timer"), elSubLeft = $("#subLeft"), elSubFill = $("#subFill"),
      elCounter = $("#counter"), panel = $("#counterPanel"), elTarget = $("#targetPlots"),
      btnStart = $("#btnStart");

// ===== PACER DOM =====
const elPacerWrap      = $("#pacerWrap");
const elPacerBar       = $("#pacerBar");
const elPacerTrack     = $("#pacerTrack");
const elPacerTotal     = $("#pacerTotal");
const elPacerRabbitNow = $("#pacerRabbitNow");
const elPacerRunnerNow = $("#pacerRunnerNow");
const elPacerDelta     = $("#pacerDelta");
const elPacerDeltaM    = $("#pacerDeltaM");
let   elPacerRabbitIcon = $("#pacerRabbitIcon");
let   elPacerRunnerIcon = $("#pacerRunnerIcon");
const elPacerRabbitDot  = $("#pacerRabbitDot");
const elPacerRunnerDot  = $("#pacerRunnerDot");
const chkPacer          = $("#togglePacer");

// Fin manuelle
const afterCourse = $("#afterCourse");
const nextCourse  = $("#nextCourse");

// Icônes locales (si présentes)
const RABBIT_SRC = "./img/rabbit-right.png";
const RUNNER_SRC = "./img/runner-right.png";

// Images masquées par défaut : on les affiche uniquement si onload réussi
function setupIcons() {
  if (elPacerRabbitIcon) {
    elPacerRabbitIcon.onload  = () => { elPacerRabbitIcon.style.display = 'block'; };
    elPacerRabbitIcon.onerror = () => { elPacerRabbitIcon.remove(); elPacerRabbitIcon = null; };
    elPacerRabbitIcon.src = RABBIT_SRC;
    elPacerRabbitIcon.style.transform = "translateX(-50%)";
  }
  if (elPacerRunnerIcon) {
    elPacerRunnerIcon.onload  = () => { elPacerRunnerIcon.style.display = 'block'; };
    elPacerRunnerIcon.onerror = () => { elPacerRunnerIcon.remove(); elPacerRunnerIcon = null; };
    elPacerRunnerIcon.src = RUNNER_SRC;
    // force regard à droite si l'image native regarde à gauche
    elPacerRunnerIcon.style.transform = "translateX(-50%) scaleX(-1)";
  }
}
setupIcons();

// ========================
// UTILITAIRES
// ========================
function applyCourseTheme() {
  document.body.classList.remove("course0","course1");
  document.body.classList.add(`course${planIdx%2}`);
}
function bodyClassForRunner(rkey) {
  document.body.classList.remove("runnerA","runnerB");
  document.body.classList.add(rkey==="A" ? "runnerA" : "runnerB");
}
function labelForCourse(idx){ const b=plan[idx]; return `${b.duree} @ ${b.pctVMA}%`; }
function currentRunnerKey(){ return order[orderIdx]; }
function currentRunner(){ return pack[currentRunnerKey()]; }
function currentCourse(){ return plan[planIdx]; }

function mmssToSecondsLocal(s){ const [m,sec]=s.split(":").map(x=>parseInt(x,10)||0); return m*60+sec; }
function plotsTargetPer90(speed_kmh, spacing_m){ const kmh_per_plot = (spacing_m===12.5)?0.5:1.0; return Math.round(speed_kmh / kmh_per_plot); }
function targetPlotsPer90(){ const r=currentRunner(), b=currentCourse(); const v=r.vma*(b.pctVMA/100); return plotsTargetPer90(v, pack.spacing_m); }
function setPanelAlt(){ panel.classList.toggle("alt", Math.floor(subElapsedSec/90)%2===1); }

// Dernière occurrence de course ?
// - solo : dernier si planIdx==plan.length-1
// - duo  : dernier uniquement quand c'est B sur le dernier plan
function isLastCourseInstance(){
  if (order.length===2){
    return (orderIdx===1) && (planIdx >= plan.length-1);
  }
  return (planIdx >= plan.length-1);
}

// ========================
// AUDIO
// ========================
let audioCtx=null;
function ensureAudio(){ if(!audioCtx){ try{ audioCtx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } }
function beep(freq=1000, dur=0.08, vol=0.05){
  if(!audioCtx) return;
  const o=audioCtx.createOscillator(), g=audioCtx.createGain();
  o.frequency.value=freq; o.type="sine"; g.gain.value=vol; o.connect(g); g.connect(audioCtx.destination);
  o.start(); setTimeout(()=>o.stop(), Math.floor(dur*1000));
}

// ========================
// PACER (temps → position + couleur tolérance ±1 plot)
// ========================
function targetSpeedKmh(){ const r=currentRunner(), b=currentCourse(); return r.vma*(b.pctVMA/100); }
function targetSpeedMps(){ return targetSpeedKmh()*1000/3600; }
function plotsPerSecond(){ const s=pack.spacing_m||12.5; return targetSpeedMps()/s; }
function totalExpectedPlots(){ const sec=mmssToSecondsLocal(currentCourse().duree); return plotsPerSecond()*sec; }
function runnerPlotsCumul(){ const done=partsBuffer.reduce((sum,p)=> sum+(p.actual||0), 0); return done + subPlots; }

function updatePacerUI(){
  // (option) masquer/afficher
  if (chkPacer && elPacerWrap) elPacerWrap.classList.toggle("hidden", !chkPacer.checked);
  if (!elPacerBar || (chkPacer && !chkPacer.checked)) return;

  const total         = Math.max(1e-6, totalExpectedPlots());
  const rabbitCumul   = plotsPerSecond() * elapsedSec;        // prévu à t secondes
  const runnerCumul   = runnerPlotsCumul();

  // Position du lièvre basée sur le TEMPS (0→100% sur la durée)
  const timeFrac   = Math.min(1, courseDur ? elapsedSec / courseDur : 0);
  const posRabbit  = timeFrac * 100;
  const posRunner  = Math.max(0, Math.min(100, (runnerCumul/total)*100));

  // Mettre à jour icônes + pastilles
  const setLeft = (el, v) => { if(el) el.style.left = v + "%"; };
  setLeft(elPacerRabbitDot, posRabbit);
  setLeft(elPacerRunnerDot, posRunner);
  setLeft(elPacerRabbitIcon, posRabbit);
  setLeft(elPacerRunnerIcon, posRunner);

  // Couleur piste : VERT si |delta| <= 1 plot, sinon ROUGE
  const deltaPlots = runnerCumul - rabbitCumul;
  const ok = Math.abs(deltaPlots) <= 1;
  if (elPacerTrack) elPacerTrack.style.background = ok ? "rgba(34,197,94,.25)" : "rgba(239,68,68,.25)";

  // Légendes cumul (pour contrôle)
  if (elPacerTotal)     elPacerTotal.textContent     = Math.round(total);
  if (elPacerRabbitNow) elPacerRabbitNow.textContent = Math.round(rabbitCumul);
  if (elPacerRunnerNow) elPacerRunnerNow.textContent = Math.round(runnerCumul);
  if (elPacerDelta)     elPacerDelta.textContent     = (deltaPlots>0?'+':'') + Math.round(deltaPlots);
  if (elPacerDeltaM)    elPacerDeltaM.textContent    = Math.round(deltaPlots * (pack.spacing_m||12.5));
}

// ========================
// UI + LOGIQUE
// ========================
function refreshUI(){
  const r=currentRunner();
  elFirst.textContent = r.prenom; elLast.textContent = " " + r.nom;

  const left = Math.max(0, courseDur - elapsedSec);
  elTimer.textContent = secondsToMMSS(left);

  const subLeft = Math.max(0, 90 - subElapsedSec);
  elSubLeft.textContent = secondsToMMSS(subLeft);
  elSubFill.style.width = `${Math.min(100, (subElapsedSec/90)*100)}%`;

  elCounter.textContent = subPlots;
  elTarget.textContent  = targetPlotsPer90();
  setPanelAlt();

  elTimer.classList.toggle("blink", subLeft<=5 && running);
  btnStart.disabled = running;

  updatePacerUI();
}

function saveSub(){
  const target = targetPlotsPer90();
  const diff   = subPlots - target;
  const ok     = (pack.spacing_m===12.5) ? (Math.abs(diff)<=1) : (diff===0);
  const subIndex = partsBuffer.length+1;
  partsBuffer.push({ subIndex, target, actual: subPlots, diff, ok });
}

function advanceAfterCourse(){
  const results = loadJSON(KEY_RESULTS, []);
  const rkey=currentRunnerKey();
  let rec = results.find(x=>x.runnerKey===rkey);
  if(!rec){
    rec = { runnerKey:rkey, runner: currentRunner(), spacing_m: pack.spacing_m, courses: [] };
    results.push(rec);
  }
  rec.courses.push({
    label: labelForCourse(planIdx),
    pctVMA: currentCourse().pctVMA,
    parts: partsBuffer.slice(),
    blocks_total: partsBuffer.length,
    blocks_ok: partsBuffer.filter(p=>p.ok).length
  });
  saveJSON(KEY_RESULTS, results);

  partsBuffer=[]; subPlots=0;

  if(order.length===2){
    orderIdx=(orderIdx+1)%2;
    if(orderIdx===0) planIdx++;
  } else {
    planIdx++;
  }

  if(planIdx>=plan.length){
    location.href="./recap.html"; return;
  }

  const sec = mmssToSecondsLocal(currentCourse().duree);
  courseDur = sec; elapsedSec=0; subElapsedSec=0;
  startMs = performance.now(); subStartMs = startMs;

  applyCourseTheme(); bodyClassForRunner(currentRunnerKey()); refreshUI();
}

function loop(){
  if(!running) return;
  const now = performance.now();
  elapsedSec     = Math.floor((now - startMs)/1000);
  subElapsedSec  = Math.floor((now - subStartMs)/1000);
  const subLeft  = 90 - subElapsedSec;

  if(subLeft<=5 && subLeft>0 && (now%1000)<50) beep(1200,0.06,0.05);

  if(subElapsedSec>=90){
    beep(800,0.12,0.06);
    saveSub();
    subPlots=0;
    subStartMs += 90*1000;
    updatePacerUI();
  }

  if (elapsedSec >= courseDur) {
    if (subElapsedSec > 0 && subElapsedSec < 90) saveSub();
    running=false;

    if (isLastCourseInstance()) {
      // Dernière occurrence → on enchaîne le flux normal (peut envoyer récap)
      advanceAfterCourse();
      return;
    } else {
      // 1ʳᵉ occurrence (ou non dernière) : afficher "Passer à la course suivante" uniquement,
      // et désactiver Démarrer pour empêcher un restart sur la même course.
      if (afterCourse) afterCourse.classList.remove("hidden");
      btnStart.disabled = true;
      refreshUI();
      return;
    }
  }

  refreshUI();
  requestAnimationFrame(loop);
}

// ========================
// ÉVÈNEMENTS
// ========================
$("#btnPlus").addEventListener("click", ()=>{ if(!running) return; subPlots+=1; refreshUI(); });
$("#btnMinus").addEventListener("click", ()=>{ if(!running) return; if(subPlots>0) subPlots-=1; refreshUI(); });

$("#btnStart").addEventListener("click", ()=>{
  if(running) return;
  ensureAudio();
  try{ new (window.NoSleep||function(){})().enable?.(); }catch(e){}
  const sec = mmssToSecondsLocal(currentCourse().duree);
  courseDur = sec; elapsedSec=0; subElapsedSec=0;
  startMs = performance.now(); subStartMs = startMs;
  applyCourseTheme(); bodyClassForRunner(currentRunnerKey());
  if (afterCourse) afterCourse.classList.add("hidden");
  running=true; refreshUI(); requestAnimationFrame(loop);
});

if (chkPacer) chkPacer.addEventListener('change', updatePacerUI);

// 👉 PATCH: réactive proprement le bouton démarrer à la course suivante,
// et reset l’affichage. Pas d’auto-récap ici : c’est géré par advanceAfterCourse().
if (nextCourse) nextCourse.addEventListener('click', ()=>{
  // passe à la course suivante
  advanceAfterCourse();

  // si on n'est pas à la dernière occurrence, on prépare la nouvelle
  if (!isLastCourseInstance()) {
    btnStart.disabled = false;            // prêt à démarrer la nouvelle course
    if (afterCourse) afterCourse.classList.add("hidden");
  }
  // reset compteurs visuels pour partir proprement
  subPlots = 0;
  elapsedSec = 0;
  subElapsedSec = 0;
  refreshUI();
});

// ========================
// INIT
// ========================
(function init(){
  applyCourseTheme(); bodyClassForRunner(currentRunnerKey()); refreshUI();
})();
