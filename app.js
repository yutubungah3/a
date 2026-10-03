(() => {
  const cfg = window.DBU_CONFIG || {};
  const $ = (id) => document.getElementById(id);
  const debugMode = new URLSearchParams(location.search).get("debug") === "1";
  const sourceHost = "https://docs.google.com";
  const state = { loading: false, lastGood: null, diagnostics: {} };

  const norm = (v) => String(v ?? "").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
  const esc = (v) => norm(v).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;",'"':"&quot;"}[c]));
  const unique = (arr) => [...new Set(arr.filter(Boolean))];
  const overlap = (a1,a2,b1,b2) => Math.max(0, Math.min(a2,b2) - Math.max(a1,b1) + 1);

  document.title = cfg.title || "Daily Breakdown Unit";
  $("pageTitle").textContent = cfg.title || "DAILY BREAKDOWN UNIT";
  $("pageSubtitle").textContent = cfg.subtitle || "FIXED PLANT";
  $("companyName").textContent = cfg.company || "Operational Monitoring";
  $("refreshSeconds").textContent = Math.round((cfg.refreshMs || 60000) / 1000);
  setupLogos();

  function setupLogos(){
    if(cfg.companyLogo){
      $("companyLogo").src = cfg.companyLogo;
      $("companyLogo").classList.remove("hidden");
      $("companyLogoWrap").classList.add("hidden");
    }
    if(cfg.certificationLogo){
      $("certificationLogo").src = cfg.certificationLogo;
      $("certificationLogo").classList.remove("hidden");
    }
  }

  function setSync(mode, title, sub){
    $("syncDot").className = "live-dot" + (mode ? ` ${mode}` : "");
    $("syncStatus").textContent = title;
    $("lastSync").textContent = sub;
  }

  function setNotice(html, kind="error"){
    const el=$("notice");
    if(!html){el.classList.add("hidden");el.innerHTML="";return;}
    el.className = `notice ${kind === "info" ? "info" : ""}`;
    el.innerHTML=html;
  }

  function cellText(el){
    const clone = el.cloneNode(true);
    clone.querySelectorAll("br").forEach(br => br.replaceWith(document.createTextNode("\n")));
    clone.querySelectorAll("script,style").forEach(x=>x.remove());
    return String(clone.textContent || "").replace(/\u00a0/g," ").replace(/[ \t]+/g," ").replace(/ *\n */g,"\n").trim();
  }

  function parseCssBackgrounds(doc){
    const map = new Map();
    const css = [...doc.querySelectorAll("style")].map(s=>s.textContent || "").join("\n");
    const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while((m=ruleRe.exec(css))){
      const selectors=m[1], body=m[2];
      const bg=(body.match(/background(?:-color)?\s*:\s*([^;!}]+)/i)||[])[1];
      if(!bg) continue;
      const classes=[...selectors.matchAll(/\.([A-Za-z0-9_-]+)/g)].map(x=>x[1]);
      classes.forEach(c=>map.set(c,norm(bg)));
    }
    return map;
  }

  function parseColor(raw){
    const s=norm(raw).toLowerCase();
    if(!s || s==="transparent" || s==="none") return null;
    let m=s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if(m){
      let h=m[1]; if(h.length===3) h=h.split("").map(x=>x+x).join("");
      return {r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16),css:`#${h}`};
    }
    m=s.match(/rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)/i);
    if(m) return {r:+m[1],g:+m[2],b:+m[3],css:`rgb(${m[1]},${m[2]},${m[3]})`};
    return null;
  }

  function statusFromColor(raw){
    const c=parseColor(raw); if(!c) return null;
    const {r,g,b}=c, avg=(r+g+b)/3, spread=Math.max(r,g,b)-Math.min(r,g,b);
    if(g>=135 && g>r*1.28 && g>b*1.12) return "RUNNING";
    if(r>=190 && r>g*1.45 && r>b*1.35) return "BREAKDOWN";
    if(r>=190 && g>=85 && g<=190 && b<=105 && r>g) return "MAINTENANCE";
    if(avg>=105 && avg<=205 && (spread<=42 || (b>=g && g>=r && b-r<=58))) return "STANDBY";
    return null;
  }

  function classify(status){
    const s=norm(status).toUpperCase();
    if(s.includes("RUN")) return "running";
    if(s.includes("BREAK") || s==="BD" || s==="DOWN") return "breakdown";
    if(s.includes("MAINT") || s.includes("SERVICE") || s==="PM") return "maintenance";
    if(s.includes("STAND") || s.includes("READY")) return "standby";
    return "unknown";
  }

  function buildCells(doc){
    const tables=[...doc.querySelectorAll("table")];
    if(!tables.length) throw new Error("Tabel Google Sheets tidak ditemukan pada halaman published.");
    const table=tables.map(t=>{
      const txt=norm(t.textContent).toUpperCase();
      let score=t.querySelectorAll("td,th").length;
      if(txt.includes("DAILY BREAKDOWN")) score+=10000;
      if(txt.includes("PORT ")) score+=4000;
      if(txt.includes("BREAKDOWN REPORT")) score+=2000;
      return {t,score};
    }).sort((a,b)=>b.score-a.score)[0].t;

    const classBg=parseCssBackgrounds(doc);
    const occupied=[];
    const cells=[];
    [...table.querySelectorAll("tr")].forEach((tr,row)=>{
      occupied[row] ||= [];
      let col=0;
      [...tr.children].filter(x=>/^(TD|TH)$/.test(x.tagName)).forEach(td=>{
        while(occupied[row][col]) col++;
        const rowspan=Math.max(1,parseInt(td.getAttribute("rowspan")||"1",10));
        const colspan=Math.max(1,parseInt(td.getAttribute("colspan")||"1",10));
        let bg="";
        const inline=(td.getAttribute("style")||"").match(/background(?:-color)?\s*:\s*([^;]+)/i);
        if(inline) bg=norm(inline[1]);
        if(!bg){
          for(const cls of td.classList){if(classBg.has(cls)){bg=classBg.get(cls);break;}}
        }
        const img=td.querySelector("img");
        let imgSrc=img ? (img.getAttribute("src")||"") : "";
        if(imgSrc.startsWith("//")) imgSrc="https:"+imgSrc;
        else if(imgSrc.startsWith("/")) imgSrc=sourceHost+imgSrc;
        const obj={el:td,row,col,rowEnd:row+rowspan-1,endCol:col+colspan-1,rowspan,colspan,text:cellText(td),bg,imgSrc};
        cells.push(obj);
        for(let rr=row;rr<row+rowspan;rr++){
          occupied[rr] ||= [];
          for(let cc=col;cc<col+colspan;cc++) occupied[rr][cc]=obj;
        }
        col+=colspan;
      });
    });
    return {table,cells};
  }

  function extractSheetDate(cells){
    const candidates=cells.map(c=>c.text).filter(Boolean);
    const month=/(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|january|february|march|may|june|july|august|october|december)/i;
    return candidates.find(t=>month.test(t) && /\b20\d{2}\b/.test(t)) || "Live dari Google Sheets";
  }

  function siteHeaders(cells){
    return cells.filter(c=>/^PORT\s+/i.test(norm(c.text)) && c.text.length<70).sort((a,b)=>a.row-b.row||a.col-b.col);
  }

  function unitCodesFromText(text){
    const out=[];
    const upper=norm(text).toUpperCase();
    const re=/\b([A-Z]{2,6})\s*-?\s*(\d{1,3})\b/g;
    const excluded=new Set((cfg.excludedUnitPrefixes||[]).map(x=>String(x).toUpperCase()));
    let m;
    while((m=re.exec(upper))){
      if(excluded.has(m[1])) continue;
      // Avoid common prose tokens that can appear in dates/reports.
      if(["BY","DAY","NO","EST","SHF","TGL"].includes(m[1])) continue;
      const raw=m[0].replace(/\s+/g," ").trim();
      out.push(raw);
    }
    return unique(out);
  }

  function horizontalOverlap(a,b){return overlap(a.col,a.endCol,b.col,b.endCol);}

  function buildSiteRegions(cells, headers){
    const reportHeaders=cells.filter(c=>/BREAKDOWN\s+REPORT/i.test(c.text));
    const blockers=[...headers,...reportHeaders];
    return headers.map(h=>{
      const below=blockers.filter(b=>b!==h && b.row>h.row && horizontalOverlap(h,b)>0).sort((a,b)=>a.row-b.row)[0];
      return {header:h,startRow:h.row+1,endRow:below?below.row-1:Math.max(...cells.map(c=>c.rowEnd)),startCol:h.col,endCol:h.endCol};
    });
  }

  function regionContains(region,cell){
    return cell.row>=region.startRow && cell.row<=region.endRow && overlap(region.startCol,region.endCol,cell.col,cell.endCol)>0;
  }

  function nearestStatus(cells,unitCell,region){
    const candidates=cells.filter(c=>{
      if(c===unitCell || !regionContains(region,c)) return false;
      if(!(c.row<=unitCell.row && c.rowEnd>=unitCell.row)) return false;
      const st=statusFromColor(c.bg); if(!st) return false;
      let gap=0;
      if(c.col>unitCell.endCol) gap=c.col-unitCell.endCol-1;
      else if(c.endCol<unitCell.col) gap=unitCell.col-c.endCol-1;
      else gap=0;
      return gap<=2;
    }).map(c=>{
      let gap=0;
      if(c.col>unitCell.endCol) gap=c.col-unitCell.endCol-1;
      else if(c.endCol<unitCell.col) gap=unitCell.col-c.endCol-1;
      return {cell:c,status:statusFromColor(c.bg),gap};
    }).sort((a,b)=>a.gap-b.gap || a.cell.col-b.cell.col);
    return candidates[0] || null;
  }

  function headerColor(header,index){
    const c=parseColor(header.bg);
    if(c && (c.r+c.g+c.b)<680) return c.css;
    const fallback=["#0d3658","#1e88e5","#10b5a6","#4f46e5","#e67e00","#0f6b78"];
    return fallback[index%fallback.length];
  }

  function extractSites(cells){
    const headers=siteHeaders(cells);
    const regions=buildSiteRegions(cells,headers);
    const sites=regions.map((region,index)=>{
      const unitCells=cells.filter(c=>regionContains(region,c) && unitCodesFromText(c.text).length);
      const units=[];
      unitCells.forEach(c=>{
        unitCodesFromText(c.text).forEach(code=>{
          const s=nearestStatus(cells,c,region);
          units.push({code,status:s?.status || "UNKNOWN",row:c.row,col:c.col,bg:s?.cell?.bg||""});
        });
      });
      const dedup=[]; const seen=new Set();
      units.sort((a,b)=>a.row-b.row||a.col-b.col).forEach(u=>{if(!seen.has(u.code)){seen.add(u.code);dedup.push(u);}});
      const imageCells=cells.filter(c=>regionContains(region,c) && c.imgSrc);
      const photo=imageCells.sort((a,b)=>(b.rowspan*b.colspan)-(a.rowspan*a.colspan))[0]?.imgSrc || "";
      return {name:norm(region.header.text),color:headerColor(region.header,index),photo,units,region};
    });
    return sites;
  }

  function numericNearLabel(cells,re){
    const label=cells.find(c=>re.test(norm(c.text).toUpperCase()));
    if(!label) return "";
    const cand=cells.filter(c=>c.row>=label.row && c.row<=label.row+4 && horizontalOverlap(label,c)>0 && c!==label)
      .map(c=>({c,m:norm(c.text).match(/\b\d+(?:[.,]\d+)?\s*%?\b/)})).filter(x=>x.m)
      .sort((a,b)=>a.c.row-b.c.row||a.c.col-b.c.col)[0];
    return cand ? cand.m[0].replace(/\s/g,"") : "";
  }

  function extractKpis(cells,sites){
    const units=sites.flatMap(s=>s.units);
    const counts={running:0,standby:0,breakdown:0,maintenance:0,unknown:0};
    units.forEach(u=>counts[classify(u.status)]++);
    const sheet={
      total:numericNearLabel(cells,/^TOTAL\s+UNIT$/),
      running:numericNearLabel(cells,/^RUNNING$/),
      standby:numericNearLabel(cells,/^STANDBY$/),
      breakdown:numericNearLabel(cells,/^BREAKDOWN$/),
      availability:numericNearLabel(cells,/^AVAILABILITY$/)
    };
    const total=units.length;
    const calculatedAvailability=total ? ((counts.running+counts.standby)/total*100).toFixed(1)+"%" : "–";
    return {
      total:sheet.total || String(total || "–"),
      running:sheet.running || String(counts.running),
      standby:sheet.standby || String(counts.standby),
      breakdown:sheet.breakdown || String(counts.breakdown),
      availability:sheet.availability ? sheet.availability.replace(".",",") : calculatedAvailability,
      counts,
      raw:sheet
    };
  }

  function extractReport(cells){
    const h=cells.find(c=>/BREAKDOWN\s+REPORT/i.test(c.text));
    if(!h) return [];
    const nextBlock=cells.filter(c=>c.row>h.row && c.col<=h.endCol && c.endCol>=h.col && (/^PORT\s+/i.test(c.text)||/BREAKDOWN\s+REPORT/i.test(c.text))).sort((a,b)=>a.row-b.row)[0];
    const maxRow=nextBlock?nextBlock.row-1:Math.max(...cells.map(c=>c.rowEnd));
    const texts=cells.filter(c=>c.row>h.row && c.row<=maxRow && overlap(h.col,h.endCol,c.col,c.endCol)>0)
      .sort((a,b)=>a.row-b.row||a.col-b.col)
      .map(c=>norm(c.text)).filter(t=>t && !/UNIT\s*&?\s*PEKERJAAN|PEKERJAAN\s+PERBAIKAN/i.test(t));
    const useful=unique(texts).filter(t=>t.length>4);
    // Prefer long report rows. If a report row also contains a unit code, retain it as-is.
    const long=useful.filter(t=>t.length>=12 || unitCodesFromText(t).length);
    return long.slice(0,20);
  }

  function parsePublishedHtml(html,urlLabel="default"){
    const doc=new DOMParser().parseFromString(html,"text/html");
    const {cells}=buildCells(doc);
    const sites=extractSites(cells).filter(s=>s.units.length || s.photo);
    const kpis=extractKpis(cells,sites);
    const report=extractReport(cells);
    return {sites,kpis,report,date:extractSheetDate(cells),cells,urlLabel,htmlLength:html.length};
  }

  function extractGids(html){
    const doc=new DOMParser().parseFromString(html,"text/html");
    const gids=[];
    [...doc.querySelectorAll("a[href]")].forEach(a=>{
      const href=a.getAttribute("href")||"";
      const m=href.match(/[?&#]gid=(\d+)/);
      if(m) gids.push({gid:m[1],name:norm(a.textContent)||`gid ${m[1]}`});
    });
    // Some published sheets keep gid links inside scripts.
    for(const m of html.matchAll(/gid[=:](?:%22|["']?)(\d{1,20})/g)) gids.push({gid:m[1],name:`gid ${m[1]}`});
    const seen=new Set(); return gids.filter(x=>!seen.has(x.gid)&&seen.add(x.gid)).slice(0,20);
  }

  async function fetchProxy(gid=""){
    const params=new URLSearchParams();
    if(gid){params.set("gid",gid);params.set("single","true");}
    params.set("_",Date.now().toString());
    const res=await fetch(`/sheet-html?${params}`,{cache:"no-store"});
    if(!res.ok) throw new Error(`Proxy Google Sheet merespons HTTP ${res.status}.`);
    const html=await res.text();
    if(!/<table[\s>]/i.test(html)) throw new Error("Respons Google tidak berisi tabel spreadsheet.");
    return html;
  }

  async function loadBestSheet(){
    const forced=norm(cfg.sheetGid);
    if(forced){
      const html=await fetchProxy(forced);
      return parsePublishedHtml(html,`gid ${forced}`);
    }
    const mainHtml=await fetchProxy();
    let best=parsePublishedHtml(mainHtml,"default");
    if(best.sites.reduce((n,s)=>n+s.units.length,0)>0) return best;

    const gids=extractGids(mainHtml);
    state.diagnostics.gids=gids;
    for(const entry of gids){
      try{
        const html=await fetchProxy(entry.gid);
        const parsed=parsePublishedHtml(html,`${entry.name} (${entry.gid})`);
        const units=parsed.sites.reduce((n,s)=>n+s.units.length,0);
        const bestUnits=best.sites.reduce((n,s)=>n+s.units.length,0);
        if(units>bestUnits) best=parsed;
        if(units>=5) break;
      }catch(e){/* try next tab */}
    }
    return best;
  }

  function renderKpis(k){
    $("kpiTotal").textContent=k.total;
    $("kpiRunning").textContent=k.running;
    $("kpiStandby").textContent=k.standby;
    $("kpiBreakdown").textContent=k.breakdown;
    let a=norm(k.availability); if(a && a!=="–" && !a.includes("%")) a+="%";
    $("kpiAvailability").textContent=a||"–";
  }

  function siteCard(site){
    const unitMarkup=site.units.length ? site.units.map(u=>{
      const cls=classify(u.status);
      return `<div class="unit-row" title="${esc(u.status)}"><span class="unit-code">${esc(u.code)}</span><span class="status-strip ${cls}" aria-label="${esc(u.status)}"></span></div>`;
    }).join("") : `<div class="empty-units">Unit belum terdeteksi pada blok ini.</div>`;
    const photo=site.photo
      ? `<div class="site-photo" data-photo="${esc(site.photo)}" data-caption="${esc(site.name)}"><img src="${esc(site.photo)}" alt="${esc(site.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentElement.classList.add('no-photo');this.remove();this.parentElement.innerHTML='<div class=&quot;photo-placeholder&quot;><span>▧</span>Foto tidak dapat dimuat</div>'"></div>`
      : `<div class="site-photo no-photo"><div class="photo-placeholder"><span>▧</span>Foto site dari Sheet</div></div>`;
    return `<article class="site-card"><header class="site-header" style="background:${esc(site.color)}"><span>${esc(site.name)}</span><small>${site.units.length} unit</small></header><div class="site-body">${photo}<div class="units-wrap">${unitMarkup}</div></div></article>`;
  }

  function reportCard(report,sites){
    let lines=report;
    if(!lines.length){
      lines=sites.flatMap(s=>s.units.filter(u=>classify(u.status)==="breakdown").map(u=>`${u.code} — ${s.name}`));
    }
    const body=lines.length ? lines.map((line,i)=>`<li class="report-item"><span class="report-index">${i+1}.</span><span>${esc(line.replace(/^\d+[.)]\s*/,""))}</span></li>`).join("") : `<li class="report-empty">Tidak ada breakdown yang terdeteksi.</li>`;
    return `<article class="report-card"><header class="report-header">BREAKDOWN REPORT</header><div class="report-subtitle">UNIT &amp; PEKERJAAN PERBAIKAN</div><ol class="report-list">${body}</ol></article>`;
  }

  function render(parsed){
    renderKpis(parsed.kpis);
    $("sheetDate").textContent=parsed.date;
    const cards=parsed.sites.map(siteCard);
    cards.push(reportCard(parsed.report,parsed.sites));
    $("dashboardGrid").innerHTML=cards.join("");
    $("loading").classList.add("hidden");
    $("dashboardGrid").classList.remove("hidden");
    document.querySelectorAll(".site-photo[data-photo]").forEach(el=>el.addEventListener("click",()=>openPhoto(el.dataset.photo,el.dataset.caption)));

    const unitCount=parsed.sites.reduce((n,s)=>n+s.units.length,0);
    if(!unitCount){
      setNotice(`<strong>Koneksi Google Sheet berhasil, tetapi kode unit belum berhasil dibaca.</strong>Buka URL website dengan tambahan <code>?debug=1</code> lalu kirim bagian diagnostic kepada saya. Parser v3 sudah membaca <em>pubhtml</em>, bukan memaksa Sheet menjadi tabel database.`,"info");
    } else {
      setNotice("");
    }

    state.diagnostics={
      ...state.diagnostics,
      selected:parsed.urlLabel,
      htmlLength:parsed.htmlLength,
      cellCount:parsed.cells.length,
      sites:parsed.sites.map(s=>({site:s.name,units:s.units.map(u=>`${u.code}:${u.status}`),photo:!!s.photo,region:s.region})),
      kpis:parsed.kpis,
      report:parsed.report,
      sampleTexts:parsed.cells.map(c=>c.text).filter(Boolean).slice(0,120)
    };
    renderDebug();
  }

  function renderDebug(){
    if(!debugMode) return;
    $("debugPanel").classList.remove("hidden");
    $("debugText").textContent=JSON.stringify(state.diagnostics,null,2);
  }

  function openPhoto(src,caption){
    if(!src) return;
    $("photoLarge").src=src; $("photoCaption").textContent=caption||"Foto site";
    $("photoDialog").showModal();
  }

  async function load(){
    if(state.loading) return;
    state.loading=true; $("refreshBtn").disabled=true; setNotice("");
    setSync("loading","Mengambil data","Google Sheets");
    try{
      const parsed=await loadBestSheet();
      state.lastGood=parsed; render(parsed);
      const now=new Date();
      setSync("","Terhubung",`Update ${now.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})}`);
    }catch(err){
      console.error(err);
      setSync("error","Gagal terhubung","Periksa proxy Netlify");
      $("loading").classList.add("hidden");
      if(state.lastGood){render(state.lastGood);}
      else $("dashboardGrid").classList.add("hidden");
      setNotice(`<strong>Data Google Sheet belum dapat dimuat.</strong>${esc(err.message)} Pastikan file <code>_redirects</code> ikut ter-upload. Coba buka <code>/sheet-html</code> pada domain Netlify Anda untuk mengetes koneksi.`);
      state.diagnostics.error=String(err.stack||err); renderDebug();
    }finally{
      state.loading=false; $("refreshBtn").disabled=false;
    }
  }

  $("refreshBtn").addEventListener("click",load);
  $("photoClose").addEventListener("click",()=>$("photoDialog").close());
  $("photoDialog").addEventListener("click",e=>{if(e.target===$("photoDialog")) $("photoDialog").close();});
  load();
  setInterval(load,cfg.refreshMs||60000);
})();
