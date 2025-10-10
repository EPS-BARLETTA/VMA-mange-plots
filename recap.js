const results=loadJSON("vmamp:results",[]);const $=(s)=>document.querySelector(s);
const recapTables=$("#recapTables");const qrButtons=$("#qrButtons");const modal=$("#qrModal"),closeBtn=$("#closeModal"),qrFull=$("#qrFull");
function computeStrict(rec){const spacing=rec.spacing_m||12.5;let totalPlots=0,totalSec=0,blocks_total=0,blocks_ok=0;
  rec.courses.forEach(c=>{c.parts.forEach(p=>{totalPlots+=p.actual;totalSec+=90;blocks_total+=1;if(p.ok)blocks_ok+=1;});});
  const distance=Math.round(totalPlots*spacing);const vitesse=totalSec>0?Math.round((distance/totalSec)*3.6*10)/10:0;
  return{strict:{nom:rec.runner.nom,prenom:rec.runner.prenom,classe:rec.runner.classe,sexe:rec.runner.sexe||"M",distance:distance,vitesse:vitesse,vma:rec.runner.vma},spacing,blocks_total,blocks_ok,courses:rec.courses};}
function makeRecapTable(agg,label){const wrap=document.createElement("div");wrap.innerHTML=`<h3 class="text-lg font-bold mb-2">${label} — ${agg.strict.prenom} ${agg.strict.nom} (${agg.strict.classe})</h3>`;
  const table=document.createElement("table");table.className="results w-full";const thead=document.createElement("thead");
  thead.innerHTML=`<tr><th>Course</th><th>%VMA</th><th>Tranches 1:30 (réalisé/attendu)</th><th>OK</th></tr>`;table.appendChild(thead);const tbody=document.createElement("tbody");
  agg.courses.forEach(c=>{const series=c.parts.map(p=>`${p.actual}/${p.target}`).join(" • ");const tr=document.createElement("tr");
    tr.innerHTML=`<td>${c.label}</td><td>${c.pctVMA}%</td><td>${series}</td><td>${c.blocks_ok}/${c.blocks_total}</td>`;tbody.appendChild(tr);});
  const trSum=document.createElement("tr");trSum.innerHTML=`<td><b>Total</b></td><td></td><td><b>Distance:</b> ${agg.strict.distance} m • <b>Vitesse:</b> ${agg.strict.vitesse} km/h • <b>VMA:</b> ${agg.strict.vma} km/h</td><td><b>${agg.blocks_ok}/${agg.blocks_total}</b></td>`;tbody.appendChild(trSum);
  table.appendChild(tbody);wrap.appendChild(table);recapTables.appendChild(wrap);}
function showStrictQR(strictObj){qrFull.innerHTML="";new QRCode(qrFull,{text:JSON.stringify([strictObj]),width:640,height:640,colorDark:"#000000",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.M});modal.classList.add("show");}
closeBtn.addEventListener("click",()=>modal.classList.remove("show"));
(function init(){if(!Array.isArray(results)||results.length===0){recapTables.innerHTML="<div class='text-red-600'>Aucun résultat.</div>";return;}
  results.forEach((rec,idx)=>{const label=rec.runnerKey==="A"?"Élève A":"Élève B";const agg=computeStrict(rec);makeRecapTable(agg,label);
    const card=document.createElement("div");card.className="card";card.innerHTML=`<h3 class="text-lg font-bold mb-2">${label} — ${agg.strict.prenom} ${agg.strict.nom}</h3><button class="btn btn-blue w-full" data-r="${idx}">QR plein écran (ScanProf)</button>`;qrButtons.appendChild(card);
    card.querySelector(`[data-r="${idx}"]`).addEventListener("click",()=>showStrictQR(agg.strict));});
  const params=new URLSearchParams(location.search);if(params.get("auto")==="1"){const rk=params.get("rk")||"A";const rec=results.find(r=>r.runnerKey===rk)||results[0];const agg=computeStrict(rec);showStrictQR(agg.strict);} })();