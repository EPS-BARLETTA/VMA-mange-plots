
const $=(s)=>document.querySelector(s);
const runners = loadJSON(KEY_RUNNERS,null);
const plan = loadJSON(KEY_PLAN,[]);
let results = loadJSON(KEY_RESULTS,[]);
if(!runners || plan.length===0){ alert("Paramétrage manquant."); location.href="./setup.html"; }

const order = runners.order==="Bfirst" ? ["B","A"] : ["A","B"];
let planIdx = 0;
let runnerIdx = 0; // 0 or 1
let running = false, timer=null, elapsed=0, subElapsed=0, subPlots=0;

function currentRunnerKey(){ return order[runnerIdx]; }
function getRunner(k){ return runners[k]; }
function secondsToMMSS(sec){ const m=Math.floor(sec/60), s=sec%60; return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`; }
function mmssToSeconds(str){ const [m,s]=str.split(":").map(x=>parseInt(x,10)||0); return m*60+s; }
function speedTarget(vma,pct){ return vma*(pct/100); }
function plotsPer90FromSpeed(speed){ return Math.round(2*speed); }

const elFirst=$("#runnerName .firstname"); const elLast=$("#runnerName .lastname");
const elTimer=$("#timer"); const elSubLeft=$("#subLeft"); const elSubFill=$("#subFill");
const elCounter=$("#counter"); const panel=$("#counterPanel");
const btnStart=$("#btnStart"); const btnSwitch=$("#btnSwitch");

function setPanelColor(){
  panel.classList.toggle("alt", Math.floor(subElapsed/90)%2===1);
}
function refreshUI(){
  const bloc = plan[planIdx];
  const runner = getRunner(currentRunnerKey());
  elFirst.textContent = runner.prenom; elLast.textContent = " " + runner.nom;
  const totalSec = mmssToSeconds(bloc.duree);
  const left = Math.max(0, totalSec - elapsed);
  elTimer.textContent = secondsToMMSS(left);
  const subLeft = Math.max(0, 90 - subElapsed);
  elSubLeft.textContent = secondsToMMSS(subLeft);
  elSubFill.style.width = `${Math.min(100, (subElapsed/90)*100)}%`;
  elCounter.textContent = subPlots;
  setPanelColor();
  btnStart.disabled = running;
}

function saveSubResult(){
  const bloc = plan[planIdx];
  const runnerKey = currentRunnerKey();
  const runner = getRunner(runnerKey);
  const vCible = speedTarget(runner.vma, bloc.pctVMA);
  const ciblePlots = plotsPer90FromSpeed(vCible);
  return { bloc:planIdx+1, runnerKey, nom:runner.nom, prenom:runner.prenom, classe:runner.classe,
    duree:bloc.duree, pctVMA:bloc.pctVMA, subPlots, ciblePlots };
}

let partsBuffer=[];

function finalizeBlocForRunner(){
  const bloc = plan[planIdx];
  const rk = currentRunnerKey();
  const r = getRunner(rk);
  const parts = partsBuffer;
  if(parts.length){
    const totalPlots = parts.reduce((s,x)=>s+x.subPlots,0);
    const avgPlots = totalPlots / parts.length;
    const ecartTotal = Math.round(parts.reduce((s,x)=>s+(x.subPlots - x.ciblePlots),0)*10)/10;
    const ecartKmH = Number((ecartTotal*0.5).toFixed(1));
    const durationSec = parts.length*90;
    const distance_m = totalPlots*12.5;
    const vitesse_moy_kmh = Number(((distance_m/durationSec)*3.6).toFixed(1));
    results.push({
      nom:r.nom, prenom:r.prenom, classe:r.classe, vma:r.vma,
      duree:bloc.duree, pctVMA:bloc.pctVMA,
      vitesse_cible: speedTarget(r.vma,bloc.pctVMA).toFixed(1),
      plots_cible_90s: plotsPer90FromSpeed(speedTarget(r.vma,bloc.pctVMA)),
      plots_moy_90s: Math.round(avgPlots*10)/10,
      ecart_plots_total: ecartTotal, ecart_kmh: ecartKmH,
      distance_m: Math.round(distance_m), vitesse_moy_kmh
    });
    saveJSON(KEY_RESULTS, results);
  }
}

function tick(){
  elapsed++; subElapsed++;
  if(subElapsed>=90){
    partsBuffer.push(saveSubResult());
    subElapsed=0; subPlots=0; setPanelColor();
  }
  const bloc = plan[planIdx];
  if(elapsed>=mmssToSeconds(bloc.duree)){
    if(subElapsed>0){ partsBuffer.push(saveSubResult()); }
    finalizeBlocForRunner();
    runnerIdx = (runnerIdx+1)%2;
    if(runnerIdx===0){
      planIdx++;
      if(planIdx>=plan.length){
        running=false; clearInterval(timer); timer=null;
        location.href="./recap.html"; return;
      }
    }
    elapsed=0; subElapsed=0; subPlots=0; partsBuffer=[];
  }
  refreshUI();
}

btnStart.addEventListener("click", ()=>{
  if(running) return; running=true;
  refreshUI();
  timer = setInterval(tick,1000);
});
btnSwitch.addEventListener("click", ()=>{
  if(!running){ runnerIdx = (runnerIdx+1)%2; refreshUI(); return; }
  const bloc = plan[planIdx];
  if(subElapsed>0){ partsBuffer.push(saveSubResult()); }
  finalizeBlocForRunner();
  runnerIdx = (runnerIdx+1)%2;
  elapsed=0; subElapsed=0; subPlots=0; partsBuffer=[];
  refreshUI();
});

$("#btnPlus").addEventListener("click", ()=>{ subPlots+=1; refreshUI(); });
$("#btnMinus").addEventListener("click", ()=>{ if(subPlots>0) subPlots-=1; refreshUI(); });

(function init(){
  runnerIdx = 0;
  refreshUI();
})();
