
const $=(s)=>document.querySelector(s);
const pack=loadJSON('vmamp:runners',null);
const plan=loadJSON('vmamp:plan',[]);
if(!pack||plan.length===0){alert('Paramétrage manquant');location.href='./setup.html';}

const mode=pack.mode||'duo';
const order=mode==='duo'?['A','B']:(mode==='soloA'?['A']:['B']);
let planIdx=0,orderIdx=0;
let running=false,startMs=0,courseDur=0,subStartMs=0;
let elapsedSec=0,subElapsedSec=0,subPlots=0;
let partsBuffer=[];

function labelForCourse(i){const b=plan[i];return `${b.duree} @ ${b.pctVMA}%`;}
function currentRunnerKey(){return order[orderIdx];}
function currentRunner(){return pack[currentRunnerKey()];}
function currentCourse(){return plan[planIdx];}
function mmssToSec(s){const[a,b]=s.split(':').map(x=>parseInt(x,10)||0);return a*60+b;}
function targetPlots(){const r=currentRunner(),b=currentCourse();const v=r.vma*(b.pctVMA/100);return plotsTargetPer90(v,pack.spacing_m);}

function refresh(){
  const r=currentRunner(), b=currentCourse();
  document.querySelector('#runnerName .firstname').textContent = r.prenom;
  document.querySelector('#runnerName .lastname').textContent = ' ' + r.nom;
  document.querySelector('#targetPlots').textContent = targetPlots();
  const left=Math.max(0,courseDur-elapsedSec);
  document.querySelector('#timer').textContent = secondsToMMSS(left);
  const subLeft=Math.max(0,90-subElapsedSec);
  document.querySelector('#subLeft').textContent = secondsToMMSS(subLeft);
  document.body.classList.toggle('runnerA', currentRunnerKey()==='A');
  document.body.classList.toggle('runnerB', currentRunnerKey()==='B');
}

function saveSub(){
  const t=targetPlots();
  const d=subPlots - t;
  const ok= pack.spacing_m===12.5 ? Math.abs(d)<=1 : d===0;
  partsBuffer.push({target:t, actual:subPlots, diff:d, ok});
}

function advance(){
  const results=loadJSON('vmamp:results',[]);
  const rkey=currentRunnerKey();
  let rec=results.find(x=>x.runnerKey===rkey);
  if(!rec){rec={runnerKey:rkey, runner:currentRunner(), spacing_m:pack.spacing_m, courses:[]}; results.push(rec);}
  rec.courses.push({ label:labelForCourse(planIdx), pctVMA: currentCourse().pctVMA, parts: partsBuffer.slice(), blocks_total: partsBuffer.length, blocks_ok: partsBuffer.filter(p=>p.ok).length });
  saveJSON('vmamp:results', results);

  partsBuffer=[]; subPlots=0;
  if(order.length===2){ orderIdx=(orderIdx+1)%2; if(orderIdx===0) planIdx++; } else { planIdx++; }
  if(planIdx>=plan.length){ location.href='./recap.html'; return; }

  courseDur=mmssToSec(currentCourse().duree);
  elapsedSec=0; subElapsedSec=0;
  startMs=performance.now(); subStartMs=startMs;
  refresh();
}

function loop(){
  if(!running) return;
  const now=performance.now();
  elapsedSec = Math.floor((now-startMs)/1000);
  subElapsedSec = Math.floor((now-subStartMs)/1000);

  if(subElapsedSec>=90){
    saveSub(); subPlots=0; subStartMs += 90*1000;
  }
  if(elapsedSec>=courseDur){
    if(subElapsedSec>0) saveSub();
    running=false; advance(); return;
  }
  refresh();
  requestAnimationFrame(loop);
}

document.querySelector('#btnPlus').addEventListener('click',()=>{ if(!running) return; subPlots++; refresh(); });
document.querySelector('#btnMinus').addEventListener('click',()=>{ if(!running) return; if(subPlots>0) subPlots--; refresh(); });
document.querySelector('#btnStart').addEventListener('click',()=>{
  if(running) return;
  courseDur = mmssToSec(currentCourse().duree);
  elapsedSec=0; subElapsedSec=0;
  startMs=performance.now(); subStartMs=startMs;
  running=true; refresh(); requestAnimationFrame(loop);
});

refresh();
