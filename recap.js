
const results = loadJSON(KEY_RESULTS,[]);
const $=(s)=>document.querySelector(s);
const cards=$("#cards");
const modal=$("#qrModal"), closeBtn=$("#closeModal"), qrFull=$("#qrFull");

function aggregateRunner(rec){
  const spacing = rec.spacing_m || 12.5;
  let totalPlots=0, totalSec=0, blocks_total=0, blocks_ok=0;
  const detail = { espacement_m: spacing, tolerance_kmh: 0.5 };

  rec.courses.forEach((c,ci)=>{
    const ci1=ci+1;
    const arrVals=[], arrDiff=[];
    c.parts.forEach((p)=>{
      totalPlots += p.actual; totalSec += 90; blocks_total += 1; if(p.ok) blocks_ok += 1;
      arrVals.push(`${p.actual}/${p.target}`);
      arrDiff.push(p.diff);
    });
    detail[`C${ci1}`]   = arrVals;
    detail[`C${ci1}D`]  = arrDiff;
    detail[`C${ci1}pct`] = c.pctVMA;
    detail[`C${ci1}lbl`] = c.label;
    detail[`C${ci1}ok`]  = c.blocks_ok;
    detail[`C${ci1}tot`] = c.blocks_total;
  });

  const distance_m  = Math.round(totalPlots * spacing);
  const vitesse_kmh = totalSec>0 ? Math.round((distance_m/totalSec)*3.6*10)/10 : 0;

  return {
    nom: rec.runner.nom, prenom: rec.runner.prenom, classe: rec.runner.classe, sexe: rec.runner.sexe||"M",
    distance: distance_m, vitesse: vitesse_kmh, vma: rec.runner.vma,
    blocks_ok, blocks_total, project_validated: (blocks_total>0 && blocks_ok===blocks_total),
    ...detail
  };
}

function makeCard(rec){
  const dataObj = aggregateRunner(rec);
  const card = document.createElement('div');
  card.className = 'qrCard';
  const title = `${rec.runner.prenom} ${rec.runner.nom} (${rec.runner.classe})`;
  card.innerHTML = `
    <h2 class="text-xl font-bold mb-2">${title}</h2>
    <div class="space-y-3">
      <div class="flex gap-2">
        <button class="btn btn-primary" data-full="${rec.runnerKey}">QR plein écran</button>
        <button class="btn btn-ghost" data-copy="${rec.runnerKey}">Copier JSON</button>
      </div>
      <div class="card">
        <div><b>Distance</b> : ${dataObj.distance} m</div>
        <div><b>Vitesse moy.</b> : ${dataObj.vitesse} km/h</div>
        <div><b>VMA</b> : ${dataObj.vma} km/h</div>
      </div>
      <div class="card"><b>Validation projet</b> : ${dataObj.blocks_ok}/${dataObj.blocks_total} sous-blocs OK</div>
    </div>
  `;
  cards.appendChild(card);

  card.querySelector(`[data-copy="${rec.runnerKey}"]`).addEventListener('click', async ()=>{
    await navigator.clipboard.writeText(JSON.stringify([dataObj]));
    alert('JSON copié.');
  });

  // Fullscreen QR on demand (white background)
  card.querySelector(`[data-full="${rec.runnerKey}"]`).addEventListener('click', ()=>{
    qrFull.innerHTML='';
    const qr = new QRCode(qrFull, { text: JSON.stringify([dataObj]), width: 560, height: 560, colorDark:"#000000", colorLight:"#ffffff", correctLevel: QRCode.CorrectLevel.M });
    modal.classList.add('show');
  });
}

closeBtn.addEventListener('click', ()=> modal.classList.remove('show'));

(function init(){ results.forEach(rec=> makeCard(rec)); })();
