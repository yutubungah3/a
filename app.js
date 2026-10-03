(() => {
  const cfg = window.DBU_CONFIG || {};
  const $ = id => document.getElementById(id);
  const debugMode = new URLSearchParams(location.search).get("debug") === "1";
  const state = { loading:false, lastData:null };

  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]));
  const norm = value => String(value ?? "").replace(/\u00a0/g," ").replace(/\s+/g," ").trim();

  document.title = cfg.title || "Daily Breakdown Unit";
  $("pageTitle").textContent = cfg.title || "DAILY BREAKDOWN UNIT";
  $("companyName").textContent = cfg.company || "Operational Monitoring";
  $("refreshLabel").textContent = Math.round((cfg.refreshMs || 60000) / 1000);

  function setLive(mode, label){
    $("liveDot").className = `live-dot ${mode || ""}`.trim();
    $("liveText").textContent = label;
  }

  function notice(message, kind="error"){
    const el=$("notice");
    if(!message){el.classList.add("hidden"); el.innerHTML=""; return;}
    el.className = `notice${kind==="info"?" info":""}`;
    el.innerHTML = message;
  }

  function driveImageUrl(input){
    const url=norm(input);
    if(!url) return "";
    const m=url.match(/(?:\/d\/|[?&]id=)([-\w]{20,})/);
    if(m) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(m[1])}&sz=w1200`;
    return url;
  }

  function statusClass(status){
    const s=norm(status).toUpperCase();
    if(s.includes("RUN")) return "running";
    if(s.includes("BREAK") || s==="BD" || s==="DOWN") return "breakdown";
    if(s.includes("MAINT") || s.includes("SERVICE") || s==="PM") return "maintenance";
    if(s.includes("STAND") || s.includes("READY")) return "standby";
    return "unknown";
  }

  function jsonp(url, timeoutMs=20000){
    return new Promise((resolve,reject)=>{
      const callback=`__dbu_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script=document.createElement("script");
      const timer=setTimeout(()=>cleanup(new Error("Timeout saat membaca Google Sheets.")),timeoutMs);
      const cleanup=(err,data)=>{
        clearTimeout(timer);
        try{delete window[callback]}catch(_e){}
        script.remove();
        err?reject(err):resolve(data);
      };
      window[callback]=data=>cleanup(null,data);
      script.onerror=()=>cleanup(new Error("Apps Script tidak dapat diakses. Periksa URL deployment dan akses Web App."));
      const sep=url.includes("?")?"&":"?";
      script.src=`${url}${sep}callback=${encodeURIComponent(callback)}&_=${Date.now()}`;
      document.head.appendChild(script);
    });
  }

  function resolvedPhoto(site){
    const configured=cfg.sitePhotos?.[site.name] || cfg.sitePhotos?.[site.name.toUpperCase()] || "";
    return driveImageUrl(configured || site.photo || "");
  }

  function siteCard(site){
    const photo=resolvedPhoto(site);
    const photoMarkup=photo
      ? `<div class="site-photo"><img src="${esc(photo)}" alt="${esc(site.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none'"><div class="photo-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 5h16v14H4z"/><path d="m4 15 4-4 4 4 3-3 5 5"/><circle cx="15.5" cy="8.5" r="1.5"/></svg><span>Tambahkan foto di config.js</span></div></div>`
      : `<div class="site-photo"><div class="photo-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 5h16v14H4z"/><path d="m4 15 4-4 4 4 3-3 5 5"/><circle cx="15.5" cy="8.5" r="1.5"/></svg><span>Foto site</span></div></div>`;

    const units=(site.units||[]).map(unit=>{
      const cls=statusClass(unit.status);
      return `<div class="unit-row" data-status="${esc(norm(unit.status).toUpperCase())}" title="${esc(unit.status)}"><span class="unit-code">${esc(unit.code)}</span><span class="status-block ${cls}"></span></div>`;
    }).join("") || `<div class="empty-site">Belum ada unit terdeteksi di blok ini.</div>`;

    return `<article class="site-card"><div class="site-header" style="background:${esc(site.headerColor || "#0d426d")}"><span>${esc(site.name)}</span><small>${(site.units||[]).length} UNIT</small></div><div class="site-content">${photoMarkup}<div class="units">${units}</div></div></article>`;
  }

  function renderReport(report, sites){
    let rows=(report||[]).filter(Boolean);
    if(!rows.length){
      rows=(sites||[]).flatMap(site=>(site.units||[]).filter(u=>statusClass(u.status)==="breakdown").map(u=>`${u.code} — ${site.name}`));
    }
    const list=rows.length
      ? rows.map((r,i)=>`<li><span class="report-index">${i+1}.</span><span>${esc(String(r).replace(/^\s*\d+[.)-]?\s*/,""))}</span></li>`).join("")
      : `<li class="report-empty">Tidak ada unit breakdown yang terdeteksi.</li>`;
    $("reportWrap").innerHTML=`<article class="report-card"><div class="report-header">BREAKDOWN REPORT</div><div class="report-sub">UNIT &amp; PEKERJAAN PERBAIKAN</div><ol class="report-list">${list}</ol></article>`;
    $("reportWrap").classList.remove("hidden");
  }

  function render(data){
    if(!data || data.ok===false) throw new Error(data?.error || "Data Apps Script tidak valid.");
    const sites=Array.isArray(data.sites)?data.sites:[];
    const k=data.kpis||{};
    $("kpiTotal").textContent = k.total ?? "—";
    $("kpiRunning").textContent = k.running ?? "—";
    $("kpiStandby").textContent = k.standby ?? "—";
    $("kpiBreakdown").textContent = k.breakdown ?? "—";
    $("kpiAvailability").textContent = k.availability ?? "—";
    $("sheetDate").textContent = data.date || "Live dari Google Sheets";
    $("sheetNameFooter").textContent = data.sheetName ? `SHEET: ${data.sheetName}` : "";
    $("siteGrid").innerHTML = sites.map(siteCard).join("");
    $("siteGrid").classList.toggle("hidden", !sites.length);
    $("loading").classList.add("hidden");
    renderReport(data.report, sites);

    const unitCount=sites.reduce((n,s)=>n+(s.units?.length||0),0);
    if(!unitCount){
      notice(`<strong>Google Sheet terbaca, tetapi unit belum terdeteksi.</strong>Buka halaman dengan <code>?debug=1</code>. V4 membaca nilai dan warna sel langsung dari Spreadsheet, jadi diagnostic akan menunjukkan sheet/tab yang dipilih dan posisi header yang ditemukan.`,"info");
    } else notice("");

    if(debugMode){
      $("diagnostic").classList.remove("hidden");
      $("diagnosticText").textContent=JSON.stringify(data.debug || data,null,2);
      $("diagnostic").open=true;
    }
  }

  async function load(){
    if(state.loading) return;
    state.loading=true;
    $("refreshBtn").disabled=true;
    setLive("loading","SYNCING");
    notice("");
    try{
      const endpoint=norm(cfg.appsScriptUrl);
      if(!endpoint){
        throw new Error("URL Apps Script belum diisi pada config.js.");
      }
      const data=await jsonp(endpoint);
      state.lastData=data;
      render(data);
      setLive("","LIVE");
      $("syncTime").textContent=`Update ${new Date().toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})}`;
    }catch(err){
      console.error(err);
      setLive("error","OFFLINE");
      $("syncTime").textContent="Data belum tersambung";
      $("loading").classList.add("hidden");
      if(state.lastData){
        try{render(state.lastData)}catch(_e){}
      }else{
        $("siteGrid").classList.add("hidden");
        $("reportWrap").classList.add("hidden");
      }
      notice(`<strong>Dashboard belum terhubung ke Google Sheets.</strong>${esc(err.message)} Ikuti README: pasang <code>apps-script/Code.gs</code> pada spreadsheet asli, deploy sebagai Web App, lalu tempel URL <code>/exec</code> ke <code>config.js</code>.`);
    }finally{
      state.loading=false;
      $("refreshBtn").disabled=false;
    }
  }

  $("refreshBtn").addEventListener("click",load);
  load();
  setInterval(load,cfg.refreshMs || 60000);
})();
