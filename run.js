
const $=(s)=>document.querySelector(s);
const pack = loadJSON(KEY_RUNNERS,null);
const plan = loadJSON(KEY_PLAN,[]);
if(!pack || plan.length===0){ alert("Paramétrage manquant."); location.href="./setup.html"; }

const mode=pack.mode||'duo';
const order = mode==='duo' ? ['A','B'] : (mode==='soloA' ? ['A'] : ['B']);
let planIdx=0, orderIdx=0;
let running=false, timer=null, elapsed=0, subElapsed=0, subPlots=0;
let partsBuffer=[];

const elFirst=$("#runnerName .firstname"), elLast=$("#runnerName .lastname");
const elTimer=$("#timer"), elSubLeft=$("#subLeft"), elSubFill=$("#subFill"),
      elCounter=$("#counter"), panel=$("#counterPanel"), elTarget=$("#targetPlots"),
      btnStart=$("#btnStart");

function applyCourseTheme(){
  document.body.classList.remove('courseParity0','courseParity1');
  const parity = (planIdx % 2);
  document.body.classList.add(parity===0 ? 'courseParity0' : 'courseParity1');
}
function bodyClassForRunner(rkey){
  document.body.classList.remove('runnerA','runnerB');
  document.body.classList.add(rkey==='A'?'runnerA':'runnerB');
}

function labelForCourse(idx){ const b=plan[idx]; return `${b.duree} @ ${b.pctVMA}%`; }
function subLabelFor(k){ const t = k*90; const m=Math.floor(t/60), s=t%60; return `${m}:${String(s).padStart(2,'0')}`; }
function currentRunnerKey(){ return order[orderIdx]; }
function currentRunner(){ return pack[currentRunnerKey()]; }
function currentCourse(){ return plan[planIdx]; }
function targetPlotsPer90(){ const r=currentRunner(), b=currentCourse(); const v = r.vma * (b.pctVMA/100); return plotsTargetPer90(v, pack.spacing_m); }
function setPanelAlt(){ panel.classList.toggle('alt', Math.floor(subElapsed/90)%2===1); }

let audioCtx=null;
function ensureAudio(){ if(!audioCtx){ try{ audioCtx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } }
function beep(freq=880, dur=0.12, vol=0.05){ if(!audioCtx) return; const o=audioCtx.createOscillator(), g=audioCtx.createGain(); o.frequency.value=freq; o.type='sine'; g.gain.value=vol; o.connect(g); g.connect(audioCtx.destination); o.start(); setTimeout(()=>{ o.stop(); }, Math.floor(dur*1000)); }

function refreshUI(){
  const r=currentRunner(); const b=currentCourse();
  elFirst.textContent = r.prenom; elLast.textContent = " " + r.nom;
  const totalSec=mmssToSeconds(b.duree), left=Math.max(0,totalSec - elapsed);
  elTimer.textContent = secondsToMMSS(left);
  const subLeft = Math.max(0, 90 - subElapsed);
  elSubLeft.textContent = secondsToMMSS(subLeft);
  elSubFill.style.width = `${Math.min(100, (subElapsed/90)*100)}%`;
  elCounter.textContent = subPlots;
  elTarget.textContent = targetPlotsPer90();
  setPanelAlt();
  elTimer.classList.toggle('blink', subLeft<=5 && running); // blink only last 5s
  btnStart.disabled = running;
}

function saveSub(){
  const subIdx = partsBuffer.length+1;
  const subLabel = subLabelFor(subIdx);
  const target = targetPlotsPer90();
  const diff = subPlots - target;
  const ok = pack.spacing_m===12.5 ? (Math.abs(diff)<=1) : (diff===0);
  partsBuffer.push({ courseIndex: planIdx, runnerKey: currentRunnerKey(), label: labelForCourse(planIdx), pctVMA: currentCourse().pctVMA, subLabel, target, actual: subPlots, diff, ok });
}

function advanceAfterCourse(){
  const results = loadJSON(KEY_RESULTS, []);
  const rkey=currentRunnerKey();
  let rec = results.find(x=>x.runnerKey===rkey);
  if(!rec){ rec={runnerKey:rkey, runner: currentRunner(), spacing_m: pack.spacing_m, courses: []}; results.push(rec); }
  const blocks_total = partsBuffer.length;
  const blocks_ok = partsBuffer.filter(p=>p.ok).length;
  rec.courses.push({ label: labelForCourse(planIdx), pctVMA: currentCourse().pctVMA, parts: partsBuffer.slice(), blocks_total, blocks_ok });
  saveJSON(KEY_RESULTS, results);

  partsBuffer=[];
  if(order.length===2){ orderIdx = (orderIdx+1)%2; if(orderIdx===0){ planIdx++; } }
  else { planIdx++; }
  if(planIdx>=plan.length){ location.href="./recap.html"; return; }
  applyCourseTheme();
  bodyClassForRunner(currentRunnerKey()); running=false; elapsed=0; subElapsed=0; subPlots=0; refreshUI();
}

function tick(){
  elapsed++; subElapsed++;
  const subLeft = 90 - subElapsed;
  if(subLeft<=5 && subLeft>0){ beep(1000,0.06,0.04); } // only last 5 seconds
  if(subElapsed>=90){ beep(800,0.12,0.06); saveSub(); subElapsed=0; subPlots=0; setPanelAlt(); }
  const totalSec=mmssToSeconds(currentCourse().duree);
  if(elapsed>=totalSec){ if(subElapsed>0){ saveSub(); } clearInterval(timer); timer=null; running=false; advanceAfterCourse(); return; }
  refreshUI();
}

$("#btnPlus").addEventListener("click", ()=>{ if(!running) return; subPlots+=1; refreshUI(); });
$("#btnMinus").addEventListener("click", ()=>{ if(!running) return; if(subPlots>0) subPlots-=1; refreshUI(); });
$("#btnStart").addEventListener("click", ()=>{ if(running) return; ensureAudio(); applyCourseTheme(); bodyClassForRunner(currentRunnerKey()); running=true; refreshUI(); timer=setInterval(tick,1000); });

(function init(){ applyCourseTheme(); bodyClassForRunner(currentRunnerKey()); refreshUI(); })();
