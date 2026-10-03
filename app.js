(() => {
  const cfg = window.DASHBOARD_CONFIG || {};
  const state = { rows: [], filtered: [], headers: [], view: "cards", lastSync: null };
  const $ = (id) => document.getElementById(id);
  const norm = (v) => String(v ?? "").trim();
  const keyNorm = (v) => norm(v).toLowerCase().replace(/[._-]+/g," ").replace(/\s+/g," ");
  const esc = (v) => norm(v).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;",'"':"&quot;"}[c]));

  document.title = cfg.title || document.title;
  $("dashboardTitle").textContent = cfg.title || "Daily Breakdown Monitoring";
  $("dashboardSubtitle").textContent = cfg.subtitle || "Mining Equipment • Live Unit Status";
  $("companyLabel").textContent = cfg.company || "Operational Dashboard";
  $("refreshIntervalLabel").textContent = Math.round((cfg.refreshMs || 60000)/1000);

  function parseCSV(text) {
    const rows = []; let row = []; let cell = ""; let quote = false;
    for (let i=0;i<text.length;i++) {
      const c=text[i], n=text[i+1];
      if (c==='"' && quote && n==='"') { cell+='"'; i++; }
      else if (c==='"') quote=!quote;
      else if (c===',' && !quote) { row.push(cell); cell=""; }
      else if ((c==='\n' || c==='\r') && !quote) {
        if (c==='\r' && n==='\n') i++;
        row.push(cell); cell="";
        if (row.some(x=>norm(x)!=="")) rows.push(row);
        row=[];
      } else cell+=c;
    }
    if (cell || row.length) { row.push(cell); if(row.some(x=>norm(x)!=="")) rows.push(row); }
    if (!rows.length) return [];
    const headers = rows[0].map((h,i)=>norm(h)||`Column ${i+1}`);
    state.headers = headers;
    return rows.slice(1).map(cols => Object.fromEntries(headers.map((h,i)=>[h,norm(cols[i])]))).filter(o=>Object.values(o).some(Boolean));
  }

  function resolveHeader(field) {
    const aliases = (cfg.fields && cfg.fields[field]) || [];
    const map = new Map(state.headers.map(h=>[keyNorm(h),h]));
    for (const a of aliases) if (map.has(keyNorm(a))) return map.get(keyNorm(a));
    for (const h of state.headers) {
      const hk=keyNorm(h);
      if (aliases.some(a => hk.includes(keyNorm(a)) || keyNorm(a).includes(hk))) return h;
    }
    return null;
  }

  function shapeRows(raw) {
    const h = Object.fromEntries(Object.keys(cfg.fields||{}).map(f=>[f,resolveHeader(f)]));
    return raw.map((r,i)=>({
      _raw:r, _index:i,
      unit: h.unit ? r[h.unit] : `Unit ${i+1}`,
      site: h.site ? r[h.site] : "-",
      status: h.status ? r[h.status] : "-",
      remark: h.remark ? r[h.remark] : "",
      date: h.date ? r[h.date] : "",
      type: h.type ? r[h.type] : "",
      pic: h.pic ? r[h.pic] : "",
      photo: h.photo ? r[h.photo] : ""
    })).filter(r=>norm(r.unit));
  }

  function groupFor(status) {
    const s = keyNorm(status);
    for (const [group,words] of Object.entries(cfg.statusGroups||{})) {
      if ((words||[]).some(w => s===keyNorm(w) || s.includes(keyNorm(w)))) return group;
    }
    return "other";
  }

  function photoUrl(url) {
    const u=norm(url); if(!u) return "";
    if (/drive\.google\.com/i.test(u)) {
      const m = u.match(/\/d\/([a-zA-Z0-9_-]+)/) || u.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1200`;
    }
    return u;
  }

  function uniq(arr) { return [...new Set(arr.map(norm).filter(v=>v&&v!=="-"))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})); }
  function fillSelect(id, values, firstLabel) {
    const el=$(id), current=el.value;
    el.innerHTML=`<option value="">${firstLabel}</option>` + values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");
    if(values.includes(current)) el.value=current;
  }

  function refreshFilters() {
    fillSelect("siteFilter",uniq(state.rows.map(r=>r.site)),"Semua Site");
    fillSelect("statusFilter",uniq(state.rows.map(r=>r.status)),"Semua Status");
    fillSelect("typeFilter",uniq(state.rows.map(r=>r.type)),"Semua Tipe");
  }

  function applyFilters() {
    const q=keyNorm($("searchInput").value), site=$("siteFilter").value, status=$("statusFilter").value, type=$("typeFilter").value;
    state.filtered=state.rows.filter(r=>{
      const hay=keyNorm([r.unit,r.site,r.status,r.remark,r.type,r.pic,r.date].join(" "));
      return (!q||hay.includes(q)) && (!site||r.site===site) && (!status||r.status===status) && (!type||r.type===type);
    });
    render();
  }

  function updateKpis() {
    $("kpiTotal").textContent=state.rows.length;
    const groups=state.rows.reduce((a,r)=>{a[groupFor(r.status)]++;return a;},{breakdown:0,ready:0,maintenance:0,other:0});
    $("kpiBreakdown").textContent=groups.breakdown;
    $("kpiReady").textContent=groups.ready;
    $("kpiMaintenance").textContent=groups.maintenance;
  }

  function imageMarkup(r,dialog=false) {
    const src=photoUrl(r.photo);
    if (!src) return dialog ? `<div class="dialog-placeholder">▰</div>` : `<div class="photo-placeholder">▰</div>`;
    return `<img ${dialog?'class="dialog-photo"':''} src="${esc(src)}" alt="Foto ${esc(r.unit)}" loading="lazy" onerror="this.outerHTML='<div class=&quot;${dialog?'dialog-placeholder':'photo-placeholder'}&quot;>▰</div>'">`;
  }

  function cardMarkup(r) {
    const g=groupFor(r.status);
    return `<article class="unit-card" data-row="${r._index}" tabindex="0" role="button" aria-label="Detail ${esc(r.unit)}">
      <div class="unit-photo">${imageMarkup(r)}<span class="site-pill">${esc(r.site||'-')}</span></div>
      <div class="card-body">
        <div class="unit-head"><div><div class="unit-name">${esc(r.unit)}</div><div class="unit-type">${esc(r.type||'Tipe belum diisi')}</div></div><span class="status-badge ${g}">${esc(r.status||'-')}</span></div>
        <div class="remark">${esc(r.remark||'Tidak ada remark / problem.')}</div>
        <div class="meta-row"><span>${r.pic?`PIC: ${esc(r.pic)}`:'PIC: -'}</span><span>${esc(r.date||'Update: -')}</span></div>
      </div></article>`;
  }

  function rowMarkup(r) {
    const g=groupFor(r.status);
    return `<tr><td><strong>${esc(r.unit)}</strong></td><td>${esc(r.site)}</td><td>${esc(r.type||'-')}</td><td><span class="status-badge ${g}">${esc(r.status)}</span></td><td>${esc(r.remark||'-')}</td><td>${esc(r.pic||'-')}</td><td>${esc(r.date||'-')}</td></tr>`;
  }

  function render() {
    updateKpis(); $("resultCount").textContent=state.filtered.length;
    const empty=!state.filtered.length;
    $("emptyState").classList.toggle("hidden",!empty);
    $("cardsView").classList.toggle("hidden",state.view!=="cards"||empty);
    $("tableView").classList.toggle("hidden",state.view!=="table"||empty);
    $("cardsView").innerHTML=state.filtered.map(cardMarkup).join("");
    $("tableBody").innerHTML=state.filtered.map(rowMarkup).join("");
    document.querySelectorAll(".unit-card").forEach(el=>{
      const open=()=>openDetail(Number(el.dataset.row));
      el.addEventListener("click",open); el.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}});
    });
  }

  function openDetail(index) {
    const r=state.rows.find(x=>x._index===index); if(!r)return;
    const g=groupFor(r.status);
    $("dialogContent").innerHTML=`${imageMarkup(r,true)}<div class="dialog-body">
      <div class="dialog-title-row"><div><h2>${esc(r.unit)}</h2><div class="unit-type">${esc(r.type||'Tipe belum diisi')}</div></div><span class="status-badge ${g}">${esc(r.status)}</span></div>
      <div class="detail-grid">
        <div class="detail-item"><div class="detail-label">Site</div><div class="detail-value">${esc(r.site||'-')}</div></div>
        <div class="detail-item"><div class="detail-label">PIC</div><div class="detail-value">${esc(r.pic||'-')}</div></div>
        <div class="detail-item"><div class="detail-label">Last Update</div><div class="detail-value">${esc(r.date||'-')}</div></div>
        <div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">${esc(r.status||'-')}</div></div>
        <div class="detail-item full"><div class="detail-label">Remark / Problem</div><div class="detail-value">${esc(r.remark||'Tidak ada remark / problem.')}</div></div>
      </div></div>`;
    $("detailDialog").showModal();
  }

  async function loadData(manual=false) {
    if(manual) $("refreshBtn").disabled=true;
    $("errorBox").classList.add("hidden");
    if(!state.rows.length) $("loadingState").classList.remove("hidden");
    try {
      const params = cfg.sheetGid ? `?gid=${encodeURIComponent(cfg.sheetGid)}` : "";
      const res=await fetch(`/.netlify/functions/sheet${params}`,{cache:"no-store"});
      if(!res.ok) throw new Error((await res.text())||`HTTP ${res.status}`);
      const text=await res.text();
      const raw=parseCSV(text);
      if(!raw.length) throw new Error("CSV berhasil diambil tetapi tidak berisi baris data.");
      state.rows=shapeRows(raw); state.lastSync=new Date();
      refreshFilters(); applyFilters();
      $("syncText").textContent=`Sync ${state.lastSync.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}`;
    } catch(err) {
      $("errorBox").innerHTML=`<strong>Data belum dapat dimuat.</strong><br>${esc(err.message)}<br><small>Periksa Publish to web, SHEET_PUB_ID, dan bila perlu sheetGid di config.js.</small>`;
      $("errorBox").classList.remove("hidden"); $("syncText").textContent="Sync gagal";
    } finally { $("loadingState").classList.add("hidden"); $("refreshBtn").disabled=false; }
  }

  $("searchInput").addEventListener("input",applyFilters);
  ["siteFilter","statusFilter","typeFilter"].forEach(id=>$(id).addEventListener("change",applyFilters));
  $("resetFilterBtn").addEventListener("click",()=>{ $("searchInput").value=""; $("siteFilter").value=""; $("statusFilter").value=""; $("typeFilter").value=""; applyFilters(); });
  $("refreshBtn").addEventListener("click",()=>loadData(true));
  document.querySelectorAll(".view-btn").forEach(btn=>btn.addEventListener("click",()=>{state.view=btn.dataset.view;document.querySelectorAll('.view-btn').forEach(b=>b.classList.toggle('active',b===btn));render();}));
  $("dialogClose").addEventListener("click",()=>$("detailDialog").close());
  $("detailDialog").addEventListener("click",e=>{if(e.target===$("detailDialog"))$("detailDialog").close();});

  loadData(); setInterval(()=>loadData(false),cfg.refreshMs||60000);
})();
