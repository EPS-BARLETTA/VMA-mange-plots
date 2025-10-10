
const $ = (sel)=>document.querySelector(sel);
const plan = loadJSON(KEY_PLAN, []);

function renderPlan(){
  const tbody = document.getElementById("tbodyPlan");
  tbody.innerHTML = "";
  plan.forEach((b,i)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${b.duree}</td>
      <td>${b.pctVMA}%</td>
      <td>${b.runner}</td>
      <td>${b.blocks90}</td>
      <td><button data-i="${i}" class="btn btn-red text-xs px-2 py-1">Supprimer</button></td>
    `;
    tbody.appendChild(tr);
  });
}
renderPlan();

document.getElementById("tbodyPlan").addEventListener("click",(e)=>{
  const i = e.target?.dataset?.i;
  if(i!==undefined){
    plan.splice(parseInt(i,10),1);
    saveJSON(KEY_PLAN, plan);
    renderPlan();
  }
});

document.getElementById("btnPreset1").addEventListener("click", ()=>{
  const presets=[
    {duree:"04:30", pctVMA:80, runner:"alternate"},
    {duree:"06:00", pctVMA:90, runner:"alternate"},
    {duree:"03:00", pctVMA:100, runner:"alternate"}
  ];
  presets.forEach(p=> plan.push({...p, blocks90: blocksOf90(mmssToSeconds(p.duree))}));
  saveJSON(KEY_PLAN, plan); renderPlan();
});

document.getElementById("btnClear").addEventListener("click", ()=>{
  plan.length=0; saveJSON(KEY_PLAN, plan); renderPlan();
});

document.getElementById("btnAdd").addEventListener("click", ()=>{
  const duree = document.getElementById("duree").value.trim() || "01:30";
  const pct = parseFloat(document.getElementById("pct").value);
  const runner = document.getElementById("runner").value;
  if(isNaN(pct)){ alert("Renseigner %VMA"); return; }
  const sec = mmssToSeconds(duree);
  const blocks = blocksOf90(sec);
  plan.push({duree, pctVMA:pct, runner, blocks90:blocks});
  saveJSON(KEY_PLAN, plan); renderPlan();
});

document.getElementById("btnExport").addEventListener("click", ()=>{
  const header="duree,pctVMA,runner,blocks90\n";
  const rows=plan.map(p=>[p.duree,p.pctVMA,p.runner,p.blocks90].join(",")).join("\n");
  download("seance_mange_plots.csv", header+rows, "text/csv");
});

document.getElementById("importCSV").addEventListener("change",(e)=>{
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ()=>{
    const lines = reader.result.split(/\\r?\\n/).filter(Boolean);
    const out=[];
    for(let i=1;i<lines.length;i++){
      const [duree,pctVMA,runner,blocks90]=lines[i].split(",");
      out.push({duree, pctVMA:Number(pctVMA), runner, blocks90:Number(blocks90)});
    }
    plan.length=0; plan.push(...out); saveJSON(KEY_PLAN, plan); renderPlan();
  };
  reader.readAsText(file);
});

document.getElementById("btnStart").addEventListener("click", ()=>{
  const A={ nom:document.getElementById("a_nom").value.trim(), prenom:document.getElementById("a_prenom").value.trim(), classe:document.getElementById("a_classe").value.trim(), vma: parseFloat(document.getElementById("a_vma").value) };
  const B={ nom:document.getElementById("b_nom").value.trim(), prenom:document.getElementById("b_prenom").value.trim(), classe:document.getElementById("b_classe").value.trim(), vma: parseFloat(document.getElementById("b_vma").value) };
  if(!A.nom || !A.prenom || isNaN(A.vma) || !B.nom || !B.prenom || isNaN(B.vma)){ alert("Renseigner nom, prénom et VMA pour A et B."); return; }
  if(plan.length===0){ alert("Ajouter au moins un bloc dans la séance."); return; }
  saveJSON(KEY_RUNNERS, {A,B}); saveJSON(KEY_RESULTS, []);
  location.href="./run.html";
});
