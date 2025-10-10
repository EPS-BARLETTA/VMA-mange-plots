
const pack = loadJSON(KEY_RUNNERS,{});
const plan = loadJSON(KEY_PLAN,[]);
const results = loadJSON(KEY_RESULTS,[]);
const $=(s)=>document.querySelector(s);
const cards=$("#cards");

function aggregateRunner(rec){
  const spacing = rec.spacing_m || 12.5;
  let totalPlots=0, totalSec=0, blocks_total=0, blocks_ok=0;
  let flat = {};
  rec.courses.forEach((c,ci)=>{
    const ci1=ci+1;
    flat[`C${ci1}_label`]=c.label;
    c.parts.forEach((p)=>{
      totalPlots += p.actual; totalSec += 90; blocks_total += 1; if(p.ok) blocks_ok += 1;
      flat[`C${ci1}_${p.subLabel}`] = `${p.actual}/${p.target}`;
      flat[`C${ci1}_${p.subLabel}_diff_plots`] = p.diff;
    });
    flat[`C${ci1}_blocks_total`]=c.blocks_total;
    flat[`C${ci1}_blocks_ok`]=c.blocks_ok;
  });
  const distance_m = Math.round(totalPlots * spacing);
  const vitesse_kmh = totalSec>0 ? Math.round((distance_m/totalSec)*3.6*10)/10 : 0;
  const strict = { nom: rec.runner.nom, prenom: rec.runner.prenom, classe: rec.runner.classe, sexe: rec.runner.sexe||"M", distance: distance_m, vitesse: vitesse_kmh, vma: rec.runner.vma };
  const detailed = { ...strict, espacement_m: spacing, tolerance_kmh: 0.5, blocks_total, blocks_ok, project_validated: (blocks_total>0 && blocks_ok===blocks_total), ...flat };
  return { strict, detailed };
}

function makeCard(rec){
  const agg = aggregateRunner(rec);
  const isA = rec.runnerKey==="A";
  const card = document.createElement('div');
  card.className = isA ? 'qrCardA' : 'qrCardB';
  const title = `${rec.runner.prenom} ${rec.runner.nom} (${rec.runner.classe})`;
  card.innerHTML = `
    <h2 class="text-xl font-bold mb-2">${isA?'ÉLÈVE A':'ÉLÈVE B'} — ${title}</h2>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
      <div>
        <div id="qr_${rec.runnerKey}" style="width:360px;height:360px;margin:auto;"></div>
        <div class="small text-center mt-2">Espacement: ${agg.detailed.espacement_m} m • Tolérance: ±0,5 km/h</div>
        <div class="flex justify-center gap-2 mt-2">
          <button class="btn btn-ghost" data-dl="${rec.runnerKey}">Télécharger PNG</button>
          <button class="btn btn-ghost" data-copy="${rec.runnerKey}">Copier JSON</button>
        </div>
      </div>
      <div class="space-y-2">
        <div class="card">
          <div><b>Distance</b> : ${agg.strict.distance} m</div>
          <div><b>Vitesse moy.</b> : ${agg.strict.vitesse} km/h</div>
          <div><b>VMA</b> : ${agg.strict.vma} km/h</div>
        </div>
        <div class="card">
          <div><b>Validation projet</b> : ${agg.detailed.blocks_ok}/${agg.detailed.blocks_total} sous-blocs OK</div>
        </div>
      </div>
    </div>
  `;
  cards.appendChild(card);

  const data = [agg.detailed];
  const el = card.querySelector(`#qr_${rec.runnerKey}`);
  const qr = new QRCode(el, { text: JSON.stringify(data), width: 360, height: 360, correctLevel: QRCode.CorrectLevel.Q });

  card.querySelector(`[data-dl="${rec.runnerKey}"]`).addEventListener('click', ()=>{
    const canvas = el.querySelector('canvas');
    if(canvas){ const a=document.createElement('a'); a.href=canvas.toDataURL('image/png'); a.download=`QR_${rec.runner.prenom}_${rec.runner.nom}.png`; a.click(); }
  });
  card.querySelector(`[data-copy="${rec.runnerKey}"]`).addEventListener('click', async ()=>{
    await navigator.clipboard.writeText(JSON.stringify(data));
    alert('JSON copié.');
  });
}

(function init(){ results.forEach(rec=> makeCard(rec)); })();
