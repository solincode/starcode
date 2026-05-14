function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  event.target.classList.add('active');
}

const CSV_FILE = "e5084979-4c81-11f1-b4f2-bc97e148b76b-O-result.csv";
const COLORS = ["Roja", "Amarilla", "Blanca", "Azul"];
let REAL_STARS = [], STARS_BY_COLOR = {Roja:[],Amarilla:[],Blanca:[],Azul:[]};
let current = null, guess = null, timer = null, autoTimer = null, dataset = [], lastColorShown = null;
let countOk = 0, countBad = 0;
const $ = s => document.querySelector(s);

function clamp(x,min,max){return Math.max(min,Math.min(max,x));}
function temperatureFromBpRp(bp_rp){if(!Number.isFinite(bp_rp))return null;const bv=0.85*bp_rp;return clamp(4600*(1/(0.92*bv+1.7)+1/(0.92*bv+0.62)),2500,40000);}
function getTeffUsed(T,bp_rp){return Number.isFinite(T)?T:temperatureFromBpRp(bp_rp);}
function classifyStar(T,bp_rp){const Teff=getTeffUsed(T,bp_rp);if(!Number.isFinite(Teff))return"Desconocida";if(Teff>=10000)return"Azul";if(Teff>=7500)return"Blanca";if(Teff>=5200)return"Amarilla";return"Roja";}
function getHRLocationHint(Teff){if(!Number.isFinite(Teff))return"Revisa los datos disponibles.";if(Teff<5200)return"Temperatura menor a 5200 K → Estrella Roja.";if(Teff<7500)return"Entre 5200 y 7500 K → Estrella Amarilla.";if(Teff<10000)return"Entre 7500 y 10000 K → Estrella Blanca.";return"Mayor a 10000 K → Estrella Azul.";}
function parseCSVLine(line){return line.split(",").map(v=>v.trim());}

function updateStats(){
  const total=countOk+countBad;
  $("#countTotal").textContent=total;
  $("#countOk").textContent=countOk;
  $("#countBad").textContent=countBad;
  $("#countPct").textContent=total>0?Math.round(countOk/total*100)+"%":"—";
}

function buildBalancedColorGroups(){STARS_BY_COLOR={Roja:[],Amarilla:[],Blanca:[],Azul:[]};REAL_STARS.forEach(star=>{const teffUsed=getTeffUsed(star.T,star.bp_rp);const realColor=classifyStar(star.T,star.bp_rp);if(Number.isFinite(teffUsed)&&COLORS.includes(realColor))STARS_BY_COLOR[realColor].push({...star,id:star.source_id,teffUsed,realColor});});}

async function loadGaiaCSV(){try{const r=await fetch(CSV_FILE);if(!r.ok)throw new Error();const text=await r.text();const lines=text.trim().split(/\r?\n/);const h=parseCSVLine(lines[0]);const idx={source_id:h.indexOf("source_id"),ra:h.indexOf("ra"),dec:h.indexOf("dec"),teff:h.indexOf("teff_gspphot"),magG:h.indexOf("phot_g_mean_mag"),bp_rp:h.indexOf("bp_rp")};if(!Object.values(idx).every(i=>i!==-1))throw new Error();REAL_STARS=lines.slice(1).map(l=>parseCSVLine(l)).map(c=>({source_id:c[idx.source_id],ra:parseFloat(c[idx.ra]),dec:parseFloat(c[idx.dec]),T:parseFloat(c[idx.teff]),magG:parseFloat(c[idx.magG]),bp_rp:parseFloat(c[idx.bp_rp])})).filter(s=>s.source_id&&Number.isFinite(s.ra)&&Number.isFinite(s.dec)&&Number.isFinite(s.magG)&&Number.isFinite(s.bp_rp)&&Number.isFinite(getTeffUsed(s.T,s.bp_rp)));buildBalancedColorGroups();if(REAL_STARS.length===0)throw new Error();$("#observeBtn").disabled=false;$("#starBox").innerHTML=`<p class="star-placeholder">Presiona <b>Buscar Estrella</b> para comenzar.</p>`;}catch(e){console.error(e);$("#observeBtn").disabled=true;$("#starBox").innerHTML=`<p class="star-placeholder" style="color:var(--bad);">No se pudo cargar el dataset.<br><span style="font-size:13px;color:var(--text-muted);">Revisa que <b>${CSV_FILE}</b> esté en la misma carpeta y usa Live Server.</span></p>`;}}

function getRandomGaiaStar(){const av=COLORS.filter(c=>STARS_BY_COLOR[c].length>0);if(!av.length)return null;let po=av.filter(c=>c!==lastColorShown);if(!po.length)po=av;const color=po[Math.floor(Math.random()*po.length)];lastColorShown=color;const stars=STARS_BY_COLOR[color];return stars[Math.floor(Math.random()*stars.length)];}

function renderChoices(){const el=$("#choices");el.innerHTML="";COLORS.forEach(c=>{const btn=document.createElement("button");btn.className="choice";btn.textContent="Estrella "+c;btn.onclick=()=>{if(!current)return;guess=c;document.querySelectorAll(".choice").forEach(b=>b.classList.remove("active"));btn.classList.add("active");$("#captureBtn").disabled=false;};el.appendChild(btn);});}

function nextAuto(){let count=5;const upd=()=>{$("#starBox").innerHTML=`<div style="text-align:center;padding:24px 0;"><p style="font-style:italic;color:var(--accent);font-size:16px;margin-bottom:16px;">Próxima estrella en ${count}...</p><button class="btn" onclick="triggerNext()" style="padding:12px 28px;">Continuar ahora</button></div>`;};upd();autoTimer=setInterval(()=>{count--;if(count<=0){clearInterval(autoTimer);triggerNext();}else upd();},1000);}
function triggerNext(){clearInterval(autoTimer);$("#observeBtn").click();}

function startTimer(sec=30){const start=Date.now(),dur=sec*1000;function tick(){const el=Date.now()-start;$("#timerBar").style.width=Math.max(0,100-(el/dur*100))+"%";if(el<dur){timer=requestAnimationFrame(tick);}else{$("#starBox").innerHTML=`<p class="star-placeholder">Señal perdida. Busca una nueva estrella.</p>`;$("#hintBtn").disabled=true;$("#captureBtn").disabled=true;$("#skipBtn").disabled=false;}}cancelAnimationFrame(timer);timer=requestAnimationFrame(tick);}

$("#observeBtn").onclick=()=>{clearInterval(autoTimer);current=getRandomGaiaStar();if(!current){alert("Dataset no cargado.");return;}const tO=Number.isFinite(current.T)?`${current.T.toFixed(0)} K`:"No disp.";$("#starBox").innerHTML=`<div class="star-data-grid"><div class="star-data-item"><div class="star-data-label">Gaia ID</div><div class="star-data-value" style="font-size:13px;">${current.source_id}</div></div><div class="star-data-item"><div class="star-data-label">Teff GSPPhot</div><div class="star-data-value">${tO}</div></div><div class="star-data-item"><div class="star-data-label">Teff Usada</div><div class="star-data-value">${current.teffUsed.toFixed(0)} K</div></div><div class="star-data-item"><div class="star-data-label">Magnitud G</div><div class="star-data-value">${current.magG.toFixed(2)}</div></div><div class="star-data-item"><div class="star-data-label">Ascensión Recta</div><div class="star-data-value">${current.ra.toFixed(4)}°</div></div><div class="star-data-item"><div class="star-data-label">BP-RP</div><div class="star-data-value">${current.bp_rp.toFixed(2)}</div></div></div>`;guess=null;$("#captureBtn").disabled=true;$("#skipBtn").disabled=false;$("#hintBtn").disabled=false;document.querySelectorAll(".choice").forEach(b=>b.classList.remove("active"));startTimer(30);};

$("#hintBtn").onclick=()=>{if(!current)return;const d=document.createElement("p");d.style.cssText="margin-top:16px;font-size:13px;font-style:italic;color:rgba(255,210,80,0.9);padding:12px 16px;background:rgba(255,200,80,0.07);border-radius:8px;border-left:2px solid rgba(255,200,80,0.5);";d.textContent="✦ "+getHRLocationHint(current.teffUsed);$("#starBox").appendChild(d);$("#hintBtn").disabled=true;};

$("#captureBtn").onclick=()=>{if(!current||!guess)return;$("#modalBody").textContent=`¿Clasificar la fuente Gaia DR3 ${current.source_id} como estrella ${guess}?`;$("#modal").classList.add("show");};

$("#saveBtn").onclick=()=>{const realColor=current.realColor,correct=(guess===realColor);if(correct)countOk++;else countBad++;updateStats();dataset.push({source_id:current.source_id,ra:current.ra,dec:current.dec,teff_gspphot:current.T,teff_usada_clasificacion:current.teffUsed,phot_g_mean_mag:current.magG,bp_rp:current.bp_rp,clasificacion_usuaria:guess,clasificacion_real:realColor,correct});const row=document.createElement("tr");row.className=correct?"ok":"bad";row.innerHTML=`<td>${current.source_id}</td><td>${current.teffUsed.toFixed(0)} K</td><td>${guess}</td><td class="${correct?'veredicto-ok':'veredicto-bad'}">${correct?'CORRECTO':'NULL'}</td>`;$("#datasetTable tbody").prepend(row);$("#modal").classList.remove("show");cancelAnimationFrame(timer);nextAuto();};

$("#backBtn").onclick=()=>{$("#modal").classList.remove("show");};
$("#skipBtn").onclick=()=>{triggerNext();};
$("#downloadCsv").onclick=()=>{const g=$("#player").value||"sin_nombre";if(!dataset.length){alert("Dataset vacío.");return;}let csv=`NOMBRE DEL GRUPO: ${g}\nORIGEN DE DATOS: Gaia DR3\n\nsource_id,ra,dec,teff_gspphot,teff_usada_clasificacion,phot_g_mean_mag,bp_rp,clasificacion_usuaria,clasificacion_real,veredicto\n`;dataset.forEach(r=>{csv+=`${r.source_id},${r.ra},${r.dec},${Number.isFinite(r.teff_gspphot)?r.teff_gspphot:""},${r.teff_usada_clasificacion},${r.phot_g_mean_mag},${r.bp_rp},${r.clasificacion_usuaria},${r.clasificacion_real},${r.correct?'CORRECTO':'NULL'}\n`;});const a=document.createElement("a");a.setAttribute("href",window.URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"})));a.setAttribute("download",`dataset_gaia_${g.replace(/\s+/g,"_")}.csv`);a.click();};

renderChoices();
loadGaiaCSV();