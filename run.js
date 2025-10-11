const $=(s)=>document.querySelector(s);
const pack = loadJSON(KEY_RUNNERS,null);
const plan = loadJSON(KEY_PLAN,[]);
if(!pack || plan.length===0){ alert("Paramétrage manquant."); location.href="./setup.html"; }

const mode=pack.mode||'duo';
const order = mode==='duo' ? ['A','B'] : (mode==='soloA' ? ['A'] : ['B']);
let planIdx=0, orderIdx=0;
let running=false, startMs=0, courseDur=0, subStartMs=0;
let elapsedSec=0, subElapsedSec=0, subPlots=0;
let partsBuffer=[];

const elFirst=$("#runnerName .firstname"), elLast=$("#runnerName .lastname");
const elTimer=$("#timer"), elSubLeft=$("#subLeft"), elSubFill=$("#subFill"),
      elCounter=$("#counter"), panel=$("#counterPanel"), elTarget=$("#targetPlots"),
      btnStart=$("#btnStart");

function applyCourseTheme(){
  document.body.classList.remove('course0','course1');
  document.body.classList.add(`course${planIdx%2}`);
}
function bodyClassForRunner(rkey){
  document.body.classList.remove('runnerA','runnerB');
  document.body.classList.add(rkey==='A'?'runnerA':'runnerB');
}

function labelForCourse(idx){ const b=plan[idx]; return `${b.duree} @ ${b.pctVMA}%`; }
function currentRunnerKey(){ return order[orderIdx]; }
function currentRunner(){ return pack[currentRunnerKey()]; }
function currentCourse(){ return plan[planIdx]; }

function mmssToSecondsLocal(s){
  const [m,sec]=s.split(':').map(x=>parseInt(x,10)||0);
  return m*60+sec;
}
function plotsTargetPer90(speed_kmh, spacing_m){
  const kmh_per_plot = spacing_m===12.5 ? 0.5 : 1.0;
  return Math.round(speed_kmh / kmh_per_plot);
}
function targetPlotsPer90(){
  const r=currentRunner(), b=currentCourse();
  const v = r.vma * (b.pctVMA/100);
  return plotsTargetPer90(v, pack.spacing_m);
}
function setPanelAlt(){
  panel.classList.toggle('alt', Math.floor(subElapsedSec/90)%2===1);
}

// Audio (bip 5s fin de tranche + bip passage de tranche)
let audioCtx=null;
function ensureAudio(){
  if(!audioCtx){
    try{ audioCtx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){}
  }
}
function beep(freq=1000, dur=0.08, vol=0.05){
  if(!audioCtx) return;
  const o=audioCtx.createOscillator(), g=audioCtx.createGain();
  o.frequency.value=freq; o.type='sine'; g.gain.value=vol;
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); setTimeout(()=>o.stop(), Math.floor(dur*1000));
}

function refreshUI(){
  const r=currentRunner(); const b=currentCourse();
  elFirst.textContent = r.prenom; elLast.textContent = " " + r.nom;

  const left = Math.max(0, courseDur - elapsedSec);
  elTimer.textContent = secondsToMMSS(left);

  const subLeft = Math.max(0, 90 - subElapsedSec);
  elSubLeft.textContent = secondsToMMSS(subLeft);
  elSubFill.style.width = `${Math.min(100, (subElapsedSec/90)*100)}%`;

  elCounter.textContent = subPlots;
  elTarget.textContent = targetPlotsPer90();
  setPanelAlt();

  elTimer.classList.toggle('blink', subLeft<=5 && running);
  btnStart.disabled = running;

  // (NOUVEAU) met à jour la ligne d’info sous le chrono
  if (typeof updateMetaLine === 'function') updateMetaLine();
}

function saveSub(){
  const target = targetPlotsPer90();
  const diff = subPlots - target;
  const ok = pack.spacing_m===12.5 ? (Math.abs(diff)<=1) : (diff===0);
  const subIndex = partsBuffer.length+1;
  partsBuffer.push({ subIndex, target, actual: subPlots, diff, ok });
}

function advanceAfterCourse(){
  const results = loadJSON(KEY_RESULTS, []);
  const rkey=currentRunnerKey();
  let rec = results.find(x=>x.runnerKey===rkey);
  if(!rec){
    rec={runnerKey:rkey, runner: currentRunner(), spacing_m: pack.spacing_m, courses: []};
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

  // Reset pour la suite
  partsBuffer=[]; subPlots=0;

  // Alternance A/B et passage à la course suivante
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
  elapsedSec = Math.floor((now - startMs)/1000);
  subElapsedSec = Math.floor((now - subStartMs)/1000);

  const subLeft = 90 - subElapsedSec;

  // bip 5 dernières secondes de la tranche
  if(subLeft<=5 && subLeft>0 && (now%1000)<50){
    beep(1200,0.06,0.05);
  }

  // Passage de tranche (1:30)
  if(subElapsedSec>=90){
    beep(800,0.12,0.06);
    saveSub();
    subPlots=0;
    subStartMs += 90*1000;
  }

  // ✅ FIN DE COURSE — ne sauvegarder la tranche qu'elle est PARTIELLE (<90s)
  if (elapsedSec >= courseDur) {
    if (subElapsedSec > 0 && subElapsedSec < 90) {
      saveSub();
    }
    running=false;
    advanceAfterCourse();
    return;
  }

  refreshUI();
  requestAnimationFrame(loop);
}

$("#btnPlus").addEventListener("click", ()=>{
  if(!running) return;
  subPlots+=1; refreshUI();
});
$("#btnMinus").addEventListener("click", ()=>{
  if(!running) return;
  if(subPlots>0) subPlots-=1; refreshUI();
});
$("#btnStart").addEventListener("click", ()=>{
  if(running) return;
  ensureAudio();
  try{ new (window.NoSleep||function(){})().enable?.(); }catch(e){}
  const sec = mmssToSecondsLocal(currentCourse().duree);
  courseDur = sec; elapsedSec=0; subElapsedSec=0;
  startMs = performance.now(); subStartMs = startMs;
  applyCourseTheme(); bodyClassForRunner(currentRunnerKey());
  running=true; refreshUI(); requestAnimationFrame(loop);
});

(function init(){
  applyCourseTheme(); bodyClassForRunner(currentRunnerKey()); refreshUI();
})();

/* ========= Patch UI course (non-intrusif) ========= */
(function(){
  // 1) Cacher la note en haut à droite et le nom au-dessus du chrono
  const headerNote = document.querySelector('header .text-sm');
  if (headerNote) headerNote.style.display = 'none';
  const runnerName = document.getElementById('runnerName');
  if (runnerName) runnerName.style.display = 'none';

  // 2) Créer une ligne d’info en gros sous le chrono
  const timerEl = document.getElementById('timer');
  function ensureMetaLine(){
    if (!timerEl) return null;
    let band = document.getElementById('courseMetaBand');
    if (!band){
      band = document.createElement('div');
      band.id = 'courseMetaBand';
      band.style.textAlign   = 'center';
      band.style.fontWeight  = '800';
      band.style.fontSize    = '20px';
      band.style.lineHeight  = '1.3';
      band.style.marginTop   = '10px';
      band.style.marginBottom= '0';
      timerEl.parentNode.insertBefore(band, timerEl.nextSibling);
    }
    return band;
  }

  // 3) Utilitaires
  function minutesFromDureeString(duree){
    const m = parseInt(String(duree||'').split(':')[0], 10);
    return Number.isFinite(m) && m>0 ? m : (typeof courseDur==='number' && courseDur>0 ? Math.round(courseDur/60) : null);
  }
  function getFullName(){
    const fn = document.querySelector('#runnerName .firstname');
    const ln = document.querySelector('#runnerName .lastname');
    const a = (fn?.textContent||'').trim(), b = (ln?.textContent||'').trim();
    return [a,b].filter(Boolean).join(' ');
  }

  // 4) Alimente la ligne : "Nom Prénom • Course de X min • Y% VMA • Z plots / 1:30"
  function updateMetaLine(){
    const band = ensureMetaLine(); if (!band) return;
    const r = (typeof currentRunner === 'function') ? currentRunner() : null;
    const b = (typeof currentCourse === 'function') ? currentCourse() : null;

    const fullName = getFullName() || [r?.prenom||'', r?.nom||''].filter(Boolean).join(' ').trim();
    const minutes  = b ? minutesFromDureeString(b.duree) : null;
    const pctVMA   = b ? Number(b.pctVMA||0) : null;
    const plots    = (typeof targetPlotsPer90 === 'function') ? targetPlotsPer90() : null;

    const bits = [];
    if (fullName) bits.push(fullName);
    if (Number.isFinite(minutes) && minutes>0) bits.push(`Course de ${minutes} min`);
    if (Number.isFinite(pctVMA) && pctVMA>0)   bits.push(`${pctVMA}% VMA`);
    if (Number.isFinite(plots) && plots>0)     bits.push(`${plots} plots / 1:30`);
    band.textContent = bits.join(' • ');
  }
  // exposer pour refreshUI
  window.updateMetaLine = updateMetaLine;

  // 5) première peinture + suivi auto
  updateMetaLine();

  const targetSpan = document.getElementById('targetPlots');
  const mo = new MutationObserver(()=> updateMetaLine());
  [document.body, timerEl, targetSpan, runnerName]
    .filter(Boolean)
    .forEach(el => mo.observe(el, {subtree:true, childList:true, characterData:true}));
})();
