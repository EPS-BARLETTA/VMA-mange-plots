
const results=loadJSON('vmamp:results',[]);
const $=(s)=>document.querySelector(s);
const recapTables=$('#recapTables');
const qrButtons=$('#qrButtons');
const modal=$('#qrModal'), closeBtn=$('#closeModal'), qrFull=$('#qrFull');

function computeAgg(rec){
  const spacing=rec.spacing_m||12.5;
  let totalPlots=0, totalSec=0, blocks_total=0, blocks_ok=0;
  rec.courses.forEach(c=>{
    c.parts.forEach(p=>{
      totalPlots += p.actual;     // <-- réalisé pris en compte
      totalSec   += 90;
      blocks_total++;
      if(p.ok) blocks_ok++;
    });
  });
  const distance=Math.round(totalPlots*spacing);
  const vitesse = totalSec? Math.round((distance/totalSec)*3.6*10)/10 : 0;
  return {spacing, distance, vitesse, blocks_total, blocks_ok};
}

function makeRecap(rec, agg, label){
  const wrap=document.createElement('div');
  wrap.innerHTML = `<h3 class="text-lg font-bold mb-2">${label} — ${rec.runner.prenom} ${rec.runner.nom} (${rec.runner.classe})</h3>`;
  const table=document.createElement('table');
  table.className='results';
  table.innerHTML = `<thead><tr><th>Course</th><th>%VMA</th><th>Tranches 1:30</th><th>OK</th></tr></thead>`;
  const tb=document.createElement('tbody');

  rec.courses.forEach(c=>{
    // Une seule entrée par 1:30: "réalisé/attendu"
    const series=c.parts.map(p=>`${p.actual}/${p.target}`).join(' • ');
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${c.label}</td><td>${c.pctVMA}%</td><td>${series}</td><td>${c.blocks_ok}/${c.blocks_total}</td>`;
    tb.appendChild(tr);
  });

  const tr=document.createElement('tr');
  tr.innerHTML=`<td><b>Total</b></td><td></td><td><b>Distance:</b> ${agg.distance} m • <b>Vitesse:</b> ${agg.vitesse} km/h • <b>VMA:</b> ${rec.runner.vma} km/h</td><td><b>${agg.blocks_ok}/${agg.blocks_total}</b></td>`;
  tb.appendChild(tr);

  table.appendChild(tb); wrap.appendChild(table); recapTables.appendChild(wrap);
}

function buildQR(rec, agg, strict=false){
  if(strict){
    return [{
      nom:rec.runner.nom, prenom:rec.runner.prenom, classe:rec.runner.classe, sexe:rec.runner.sexe||'M',
      distance:agg.distance, vitesse:agg.vitesse, vma:rec.runner.vma
    }];
  }
  const obj={
    nom:rec.runner.nom, prenom:rec.runner.prenom, classe:rec.runner.classe, sexe:rec.runner.sexe||'M',
    distance:agg.distance, vitesse:agg.vitesse, vma:rec.runner.vma,
    espacement_m:agg.spacing, tol_kmh:(agg.spacing===12.5)?0.5:0
  };
  rec.courses.forEach((c,ci)=>{
    const i=ci+1;
    obj[`%VMA C${i}`]=c.pctVMA;
    obj[`Durée C${i}`]=(c.label.split('@')[0]||'').trim();
    c.parts.forEach((p,pi)=>{
      const j=pi+1;
      // Toujours une seule info claire: réalisé/attendu (+diff indiqué)
      const d=p.diff;
      const diffTxt = d===0?'0': (d>0? '+'+d : ''+d);
      obj[`C${i}-1:30 #${j}`]=`${p.actual}/${p.target} (${diffTxt} plots)`;
    });
    obj[`C${i} OK`]=c.blocks_ok;
    obj[`C${i} Total`]=c.blocks_total;
  });
  obj['OK total']=agg.blocks_ok;
  obj['Blocs total']=agg.blocks_total;
  return [obj];
}

function showQR(arr){
  qrFull.innerHTML='';
  new QRCode(qrFull, {text: JSON.stringify(arr), width:640, height:640, colorDark:'#000', colorLight:'#fff', correctLevel:QRCode.CorrectLevel.M});
  modal.classList.add('show');
}
closeBtn.addEventListener('click',()=>modal.classList.remove('show'));

(function init(){
  if(!results||!results.length){
    recapTables.innerHTML = '<div class="text-red-600">Aucun résultat.</div>'; return;
  }
  results.forEach((rec,idx)=>{
    const label = rec.runnerKey==='A' ? 'Élève A' : 'Élève B';
    const agg = computeAgg(rec);
    makeRecap(rec, agg, label);
    const card=document.createElement('div'); card.className='card';
    card.innerHTML=`<h3 class="text-lg font-bold mb-2">${label} — ${rec.runner.prenom} ${rec.runner.nom}</h3>
    <div class="grid grid-cols-2 gap-2">
      <button class="btn" style="background:#0284c7;color:#fff" data-full="${idx}">QR plein écran (détails)</button>
      <button class="btn" data-strict="${idx}">QR strict</button>
    </div>`;
    qrButtons.appendChild(card);
    card.querySelector(`[data-full="${idx}"]`).addEventListener('click',()=>showQR(buildQR(rec,agg,false)));
    card.querySelector(`[data-strict="${idx}"]`).addEventListener('click',()=>showQR(buildQR(rec,agg,true)));
  });
})();
