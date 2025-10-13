// Non-destructive UI tweaks for VMA-mange-plots
// Works by querying existing DOM and adding classes/elements; no logic/IDs changed.

(function(){
  const page = location.pathname.split('/').pop();

  // helper: try to select by text content
  const findByText = (selector, text) => {
    const els = Array.from(document.querySelectorAll(selector));
    return els.find(el => el.textContent.trim().toLowerCase().includes(text.toLowerCase()));
  };

  // LANDING (index.html)
  if (/index\.html$|\/$/.test(page)) {
    document.addEventListener('DOMContentLoaded', () => {
      const hero = document.querySelector('main, .hero, .container') || document.body;
      hero.classList?.add('hero');

      // Ensure title exists
      const h1 = document.querySelector('h1') || (()=>{ const x=document.createElement('h1'); x.className='h1'; x.textContent=document.title||'VMA Mange-Plots'; document.body.prepend(x); return x; })();

      // Buttons (guess by links already present)
      const startBtn = document.querySelector('a[href*="setup.html"], a[href*="run.html"]');
      const helpBtn  = document.querySelector('a[href*="help.html"]');
      const safetyBtn= document.querySelector('a[href*="safety.html"]');

      // Wrap in action grid
      const actions = document.createElement('div'); actions.className = 'actions mt-3';
      if (startBtn) { startBtn.classList.add('btn','btn-primary','btn-block'); actions.appendChild(startBtn); }
      if (helpBtn)  { helpBtn.classList.add('btn','btn-help'); actions.appendChild(helpBtn); }
      if (safetyBtn){ safetyBtn.classList.add('btn','btn-safety'); actions.appendChild(safetyBtn); }

      const container = document.createElement('div'); container.className='container card card-lg';
      const header = document.createElement('div'); header.className='stack';
      header.appendChild(h1);
      container.appendChild(header);
      container.appendChild(actions);

      // Center the page
      const wrapper = document.createElement('div'); wrapper.className='centered-page';
      wrapper.appendChild(container);
      document.body.innerHTML='';
      document.body.appendChild(wrapper);
    });
  }

  // SETUP (setup.html) — rename Eleve to Coureur + colored input blocks
  if (/setup\.html$/.test(page)) {
    document.addEventListener('DOMContentLoaded', () => {
      // rename labels "Élève A/B" -> "Coureur A/B"
      const labA = findByText('label, .label, .field label, span', 'élève a');
      const labB = findByText('label, .label, .field label, span', 'élève b');
      if (labA) labA.innerHTML = labA.innerHTML.replace(/Élève\s*A/i, 'Coureur A');
      if (labB) labB.innerHTML = labB.innerHTML.replace(/Élève\s*B/i, 'Coureur B');

      // guess input blocks near those labels and tint them
      const tint = (label, cls) => {
        if (!label) return;
        let block = label.closest('.card, .field, .form-group, .row, .input-block') || label.parentElement;
        if (block) block.classList.add(cls);
        // also try to tint the actual inputs beneath
        const inputs = block ? block.querySelectorAll('input, select, textarea') : [];
        inputs.forEach(i => i.style.background = getComputedStyle(document.querySelector('.'+cls)).backgroundColor);
      };
      tint(labA, 'runnerA-bg'); // blue-ish
      tint(labB, 'runnerB-bg'); // green-ish
    });
  }

  // RUN (run.html) — header cleanup, big first name only, metrics strip, pills for remaining time, plus/minus pads
  if (/run\.html$/.test(page)) {
    document.addEventListener('DOMContentLoaded', () => {
      // 1) Hide top-left "Blocs 1:30 • Couleurs alternées" if present
      const maybeHeader = document.querySelector('header');
      if (maybeHeader && maybeHeader.textContent.trim().toLowerCase().includes('couleurs')) {
        maybeHeader.classList.add('useless-tip');
      }

      // 2) Keep only first name (look for name near the chrono/h1/h2)
      const nameEl = document.querySelector('.runner-name, h1, .h1, .chrono-title');
      if (nameEl) {
        const first = nameEl.textContent.trim().split(/\s+/)[0];
        if (first) nameEl.textContent = first;
        nameEl.classList.add('h1');
      }

      // 3) Metrics strip under chrono if data available in localStorage
      // We try a few likely keys that your app already uses; if none, we just skip.
      const keys = ['vmaA','vma','vitesseA','targetPercent','pourcentage','pct','blockSec','blocSec','bloc','block','blockDuration'];
      const store = {};
      Object.keys(localStorage).forEach(k => {
        try{ store[k]=JSON.parse(localStorage.getItem(k)); }catch{ store[k]=localStorage.getItem(k); }
      });

      function getLikelyNumber(keyList){
        for (const k of keyList){
          const v = store[k];
          const n = (typeof v==='number')?v:parseFloat(v);
          if (!isNaN(n) && isFinite(n)) return n;
        }
        return null;
      }
      const vma = getLikelyNumber(['vmaA','vma']);
      const pct = getLikelyNumber(['targetPercent','pourcentage','pct']);
      // block seconds fallback: try to read the text that contains something like "1:30"
      let blockSec = getLikelyNumber(['blockSec','blocSec','block','blockDuration']);
      if (!blockSec){
        const txt = document.body.textContent.match(/\b(\d{1,2}):([0-5]\d)\b/);
        if (txt){
          blockSec = parseInt(txt[1],10)*60 + parseInt(txt[2],10);
        }
      }

      const chrono = document.querySelector('.chrono, #chrono, [data-role="chrono"]') || document.querySelector('main');
      if (chrono && (vma || pct || blockSec)) {
        const bar = document.createElement('div');
        bar.className = 'card stack-sm mt-3';
        const lines = [];

        if (vma && pct){
          lines.push(`<div class="h2"><span class="subtle">VMA</span> ${vma} &nbsp;&nbsp; <span class="subtle">•</span> &nbsp;${pct}% <span class="subtle">—</span> ${Math.round(vma*pct/100*10)/10} km/h</div>`);
        } else if (vma){
          lines.push(`<div class="h2"><span class="subtle">VMA</span> ${vma}</div>`);
        }

        if (blockSec){
          const mm = Math.floor(blockSec/60).toString().padStart(1,'0');
          const ss = (blockSec%60).toString().padStart(2,'0');
          lines.push(`<div class="subtle">Bloc: ${mm}:${ss}</div>`);
        }

        bar.innerHTML = lines.join('');
        chrono.parentElement.insertBefore(bar, chrono.nextSibling);
      }

      // 4) Emphasize time-remaining per block as a pill (we search for text "restant")
      const rem = Array.from(document.querySelectorAll('*')).find(el => /restant/i.test(el.textContent) && el !== document.body);
      if (rem){
        rem.classList.add('pill','pill-green'); // default green; runner B will switch it to blue later if needed
        rem.style.display='inline-block';
      }

      // 5) +/- pads tint (try to detect runner zones)
      const zones = document.querySelectorAll('.runnerA, .runnerB, [data-runner="A"], [data-runner="B"]');
      zones.forEach(z => {
        const isA = /runnerA|data-runner="A"/i.test(z.outerHTML);
        const plus = Array.from(z.querySelectorAll('button, .btn')).filter(b => b.textContent.trim()==='+')[0];
        const minus= Array.from(z.querySelectorAll('button, .btn')).filter(b => b.textContent.trim()==='-')[0];
        if (plus){ plus.classList.add('pad', isA?'plusA':'plusB'); }
        if (minus){ minus.classList.add('pad','minus'); }
      });
    });
  }

  // RECAP (recap.html) — tone backgrounds per runner blocks if present
  if (/recap\.html$/.test(page)) {
    document.addEventListener('DOMContentLoaded', () => {
      const a = Array.from(document.querySelectorAll('.runnerA, .recapA, [data-runner="A"]'));
      const b = Array.from(document.querySelectorAll('.runnerB, .recapB, [data-runner="B"]'));
      a.forEach(el => el.classList.add('runnerA-bg'));
      b.forEach(el => el.classList.add('runnerB-bg'));
    });
  }
})();