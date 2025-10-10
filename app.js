
const KEY_RUNNERS="vmamp:runners";
const KEY_PLAN="vmamp:plan";
const KEY_RESULTS="vmamp:results";

function mmssToSeconds(str){ const [m,s]=(str||'').split(':').map(x=>parseInt(x,10)||0); return (m*60+s)|0; }
function secondsToMMSS(sec){ sec=Math.max(0,sec|0); const m=(sec/60)|0, s=sec%60; return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
function saveJSON(k,o){ localStorage.setItem(k, JSON.stringify(o)); }
function loadJSON(k,f){ try{ return JSON.parse(localStorage.getItem(k)) ?? f; }catch(e){ return f; } }
function download(fn,content,mime='text/plain'){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([content],{type:mime})); a.download=fn; a.click(); URL.revokeObjectURL(a.href); }
function plotsTargetPer90(speed_kmh, spacing_m){ const kmh_per_plot = spacing_m===12.5 ? 0.5 : 1.0; return Math.round(speed_kmh / kmh_per_plot); }
