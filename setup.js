
const $=(s)=>document.querySelector(s);
const plan = loadJSON(KEY_PLAN, []);

function mmss(min,sec){
  const m = Math.max(0, parseInt(min,10)||0);
  const s = Math.max(0, Math.min(59, parseInt(sec,10)||0));
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}
function mmssStrToSec(str){ const [m,s]=str.split(":").map(x=>parseInt(x,10)||0); return m*60+s; }

function renderPlan(){
  const tb=$("#tbodyPlan"); tb.innerHTML="";
  plan.forEach((b,i)=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${i+1}</td><td>${b.duree}</td><td>${b.pctVMA}%</td><td>${b.blocks90}</td>
      <td><button data-i="${i}" class="btn btn-amber text-xs px-2 py-1">Supprimer</button></td>`;
    tb.appendChild(tr);
  });
  updateButtons();
}
function updateButtons(){
  const Aok = $("#a_nom").value.trim() && $("#a_prenom").value.trim() && $("#a_classe").value.trim() && !isNaN(parseFloat($("#a_vma").value));
  const Bok = $("#b_nom").value.trim() && $("#b_prenom").value.trim() && $("#b_classe").value.trim() && !isNaN(parseFloat($("#b_vma").value));
  $("#btnStart").disabled = !(Aok && Bok && plan.length>0);
  const ok = $("#min").value!=="" && $("#sec").value!=="" && $("#pct").value!=="";
  $("#btnAdd").disabled = !ok;
}
document.addEventListener("input", e=>{ if(e.target.matches(".input,.select")) updateButtons(); });
document.addEventListener("change", e=>{ if(e.target.matches(".input,.select")) updateButtons(); });

$("#tbodyPlan").addEventListener("click", (e)=>{
  const i=e.target?.dataset?.i; if(i===undefined) return;
  plan.splice(parseInt(i,10),1); saveJSON(KEY_PLAN,plan); renderPlan();
});

$("#btnPreset1").addEventListener("click", ()=>{
  const presets=[{duree:"04:30",pctVMA:80},{duree:"06:00",pctVMA:90},{duree:"03:00",pctVMA:100}];
  presets.forEach(p=> plan.push({...p, blocks90: Math.round(mmssStrToSec(p.duree)/90)}));
  saveJSON(KEY_PLAN,plan); renderPlan();
});

$("#btnClear").addEventListener("click", ()=>{ plan.length=0; saveJSON(KEY_PLAN,plan); renderPlan(); });

$("#btnAdd").addEventListener("click", ()=>{
  const duree = mmss($("#min").value,$("#sec").value);
  const pct = parseInt($("#pct").value,10);
  const blocks = Math.round(mmssStrToSec(duree)/90);
  plan.push({duree, pctVMA:pct, blocks90:blocks});
  saveJSON(KEY_PLAN,plan); renderPlan();
});

$("#btnExport").addEventListener("click", ()=>{
  const header="duree,pctVMA,blocks90\n";
  const rows=plan.map(p=>[p.duree,p.pctVMA,p.blocks90].join(",")).join("\n");
  download("seance.csv", header+rows, "text/csv");
});

$("#importCSV").addEventListener("change",(e)=>{
  const f=e.target.files[0]; if(!f) return;
  const reader=new FileReader();
  reader.onload=()=>{
    const lines=reader.result.split(/\r?\n/).filter(Boolean);
    const out=[]; for(let i=1;i<lines.length;i++){ const [d,p,b]=lines[i].split(","); out.push({duree:d,pctVMA:Number(p),blocks90:Number(b)}); }
    plan.length=0; plan.push(...out); saveJSON(KEY_PLAN,plan); renderPlan();
  };
  reader.readAsText(f);
});

$("#btnStart").addEventListener("click", ()=>{
  const runners={
    A:{nom:$("#a_nom").value.trim(), prenom:$("#a_prenom").value.trim(), classe:$("#a_classe").value.trim(), vma: parseFloat($("#a_vma").value)},
    B:{nom:$("#b_nom").value.trim(), prenom:$("#b_prenom").value.trim(), classe:$("#b_classe").value.trim(), vma: parseFloat($("#b_vma").value)}
  };
  const order=$("#order").value; // Afirst or Bfirst
  saveJSON(KEY_RUNNERS,{...runners, order});
  saveJSON(KEY_PLAN,plan);
  saveJSON(KEY_RESULTS,[]);
  location.href="./run.html";
});

renderPlan(); updateButtons();
