
const $=(s)=>document.querySelector(s);
const plan = loadJSON(KEY_PLAN, []);

(function fillDurations(){
  const sel=$("#duree"); sel.innerHTML="";
  for(let t=90;t<=1800;t+=90){
    const m=Math.floor(t/60), s=t%60;
    const label=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    const opt=document.createElement('option'); opt.value=label; opt.textContent=label; sel.appendChild(opt);
  }
})();
function mmssToSec(str){ const [m,s]=str.split(':').map(x=>parseInt(x,10)||0); return m*60+s; }

function renderPlan(){
  const tb=$("#tbodyPlan"); tb.innerHTML="";
  plan.forEach((b,i)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${i+1}</td><td>${b.duree}</td><td>${b.pctVMA}%</td><td>${b.blocks90}</td>
      <td><button data-i="${i}" class="btn btn-amber text-xs px-2 py-1">Supprimer</button></td>`;
    tb.appendChild(tr);
  });
  updateButtons();
}
function updateButtons(){
  const mode=$("#mode").value;
  let okA = $("#a_nom").value.trim() && $("#a_prenom").value.trim() && $("#a_classe").value.trim() && $("#a_vma").value.trim();
  let okB = $("#b_nom").value.trim() && $("#b_prenom").value.trim() && $("#b_classe").value.trim() && $("#b_vma").value.trim();
  if(mode==="soloA"){ okB=true; }
  if(mode==="soloB"){ okA=true; }
  $("#btnStart").disabled = !(okA && okB && plan.length>0);
  $("#btnAdd").disabled = !($("#pct").value && $("#duree").value);
}
document.addEventListener("input", e=>{ if(e.target.matches(".input,.select")) updateButtons(); });
document.addEventListener("change", e=>{ if(e.target.matches(".input,.select")) updateButtons(); });
$("#tbodyPlan").addEventListener("click",(e)=>{
  const i=e.target?.dataset?.i; if(i===undefined) return;
  plan.splice(parseInt(i,10),1); saveJSON(KEY_PLAN, plan); renderPlan();
});
$("#btnPreset1").addEventListener("click", ()=>{
  const presets=[{duree:"04:30", pctVMA:80},{duree:"06:00", pctVMA:90},{duree:"03:00", pctVMA:100}];
  presets.forEach(p=> plan.push({...p, blocks90: Math.round(mmssToSec(p.duree)/90)}));
  saveJSON(KEY_PLAN, plan); renderPlan();
});
$("#btnAdd").addEventListener("click", ()=>{
  const duree=$("#duree").value;
  const pct=parseInt($("#pct").value,10);
  const blocks=Math.round(mmssToSec(duree)/90);
  plan.push({duree, pctVMA:pct, blocks90:blocks});
  saveJSON(KEY_PLAN, plan); renderPlan();
});
$("#btnStart").addEventListener("click", ()=>{
  const mode=$("#mode").value;
  const spacing=parseFloat($("#spacing").value);
  const pack={
    mode, spacing_m: spacing,
    A:{ nom:$("#a_nom").value.trim(), prenom:$("#a_prenom").value.trim(), classe:$("#a_classe").value.trim(), sexe:$("#a_sexe").value, vma: parseFloat($("#a_vma").value||"0") },
    B:{ nom:$("#b_nom").value.trim(), prenom:$("#b_prenom").value.trim(), classe:$("#b_classe").value.trim(), sexe:$("#b_sexe").value, vma: parseFloat($("#b_vma").value||"0") }
  };
  saveJSON(KEY_RUNNERS, pack);
  saveJSON(KEY_PLAN, plan);
  saveJSON(KEY_RESULTS, []);
  location.href="./run.html";
});
renderPlan(); updateButtons();
