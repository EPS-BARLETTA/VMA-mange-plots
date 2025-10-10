
const $=(s)=>document.querySelector(s);
const plan=[];

// durations: only multiples of 1:30
const sel=$("#duree");
for(let t=90;t<=1800;t+=90){
  const m=(t/60)|0, s=t%60;
  const l=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  const o=document.createElement('option'); o.value=l; o.textContent=l; sel.appendChild(o);
}
function mmssToSec(x){const[a,b]=x.split(':').map(v=>parseInt(v,10)||0);return a*60+b;}

function render(){
  const tb=$("#tbodyPlan"); tb.innerHTML='';
  plan.forEach((p,i)=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${i+1}</td><td>${p.duree}</td><td>${p.pct}%</td><td>${p.blocks}</td>
      <td><button data-i='${i}' class='btn'>Supprimer</button></td>`;
    tb.appendChild(tr);
  });
}
document.addEventListener('click',e=>{
  if(e.target.matches('[data-i]')){
    plan.splice(parseInt(e.target.dataset.i,10),1); render();
  }
});
$("#btnPreset").addEventListener('click',()=>{
  const presets=[["04:30",80],["06:00",90],["03:00",100]];
  presets.forEach(([d,p])=>plan.push({duree:d,pct:p,blocks:Math.round(mmssToSec(d)/90)}));
  render();
});
$("#btnAdd").addEventListener('click',()=>{
  const duree=$("#duree").value;
  const pct=parseInt($("#pct").value,10)||0;
  plan.push({duree, pct, blocks:Math.round(mmssToSec(duree)/90)});
  render();
});
$("#btnStart").addEventListener('click',()=>{
  const pack={
    mode:$("#mode").value,
    spacing_m: parseFloat($("#spacing").value),
    A:{nom:$("#a_nom").value.trim(), prenom:$("#a_prenom").value.trim(), classe:$("#a_classe").value.trim(), sexe:$("#a_sexe").value, vma:parseFloat($("#a_vma").value||'0')},
    B:{nom:$("#b_nom").value.trim(), prenom:$("#b_prenom").value.trim(), classe:$("#b_classe").value.trim(), sexe:$("#b_sexe").value, vma:parseFloat($("#b_vma").value||'0')},
  };
  saveJSON(KEY_RUNNERS, pack);
  saveJSON(KEY_PLAN, plan.map(p=>({duree:p.duree, pctVMA:p.pct, blocks90:p.blocks})));
  saveJSON(KEY_RESULTS, []);
  location.href='./run.html';
});
render();
