(() => {
  const CONFIG = window.APP_CONFIG || {};
  const state = {
    units: [],
    employees: [],
    settings: {},
    currentPage: "units",
    site: "all",
    query: "",
    loading: false
  };

  const els = {
    logoLeft: document.querySelector("#logoLeft"),
    logoRight: document.querySelector("#logoRight"),
    companyName: document.querySelector("#companyName"),
    dashboardTitle: document.querySelector("#dashboardTitle"),
    footerText: document.querySelector("#footerText"),
    tabs: document.querySelectorAll(".tab"),
    siteFilter: document.querySelector("#siteFilter"),
    searchInput: document.querySelector("#searchInput"),
    refreshButton: document.querySelector("#refreshButton"),
    statusMessage: document.querySelector("#statusMessage"),
    unitsPage: document.querySelector("#unitsPage"),
    employeesPage: document.querySelector("#employeesPage"),
    unitGrid: document.querySelector("#unitGrid"),
    employeeGrid: document.querySelector("#employeeGrid"),
    totalUnits: document.querySelector("#totalUnits"),
    runningUnits: document.querySelector("#runningUnits"),
    standbyUnits: document.querySelector("#standbyUnits"),
    breakdownUnits: document.querySelector("#breakdownUnits"),
    unitCountLabel: document.querySelector("#unitCountLabel"),
    employeeCountLabel: document.querySelector("#employeeCountLabel"),
    lastRefresh: document.querySelector("#lastRefresh"),
    emptyTemplate: document.querySelector("#emptyTemplate")
  };

  const headerAliases = {
    site: ["site", "lokasi", "area", "pit", "project", "jobsite"],
    unit: ["unit", "kode unit", "unit code", "equipment", "alat", "no unit", "nomor unit"],
    type: ["type", "tipe", "jenis", "kategori", "equipment type", "jenis unit"],
    model: ["model", "merk", "brand", "make", "seri"],
    status: ["status", "condition", "kondisi", "posisi", "state"],
    hm: ["hm", "hour meter", "hours meter", "smu", "km", "odometer"],
    operator: ["operator", "driver", "pengawas", "pic", "mekanik"],
    date: ["tanggal", "tgl", "date", "update", "last update", "tanggal update", "updated at"],
    notes: ["keterangan", "remark", "remarks", "catatan", "problem", "description", "deskripsi"],
    photo: ["foto", "photo", "gambar", "image", "url foto", "link foto", "picture"],
    name: ["nama", "name", "employee", "karyawan"],
    nik: ["nik", "nrp", "id", "employee id", "nomor induk"],
    position: ["jabatan", "posisi", "position", "role", "departemen", "dept"],
    phone: ["hp", "no hp", "telepon", "phone", "wa", "whatsapp", "kontak"],
    employeeStatus: ["status karyawan", "status", "employment status", "kontrak"]
  };

  function normalize(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function firstValue(row, aliases, fallback = "") {
    for (const key of aliases) {
      if (row[key] !== undefined && String(row[key]).trim() !== "") return row[key];
    }
    return fallback;
  }

  function read(row, field, fallback = "") {
    return firstValue(row, headerAliases[field] || [field], fallback);
  }

  function parseCsv(text) {
    const rows = [];
    let current = [];
    let value = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          value += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        current.push(value);
        value = "";
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && next === "\n") i += 1;
        current.push(value);
        rows.push(current);
        current = [];
        value = "";
      } else {
        value += char;
      }
    }

    if (value.length || current.length) {
      current.push(value);
      rows.push(current);
    }

    return rows.filter((row) => row.some((cell) => String(cell).trim() !== ""));
  }

  function csvRowsToObjects(rows) {
    if (!rows.length) return [];
    const headers = rows[0].map((header) => normalize(header));
    return rows.slice(1).map((row) => {
      const object = {};
      headers.forEach((header, index) => {
        object[header || `kolom_${index + 1}`] = (row[index] || "").trim();
      });
      return object;
    });
  }

  function cacheBust(url) {
    if (!url) return "";
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}_=${Date.now()}`;
  }

  async function fetchCsv(url) {
    if (!url) return [];
    const response = await fetch(cacheBust(url), { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Gagal mengambil data: ${response.status} ${response.statusText}`);
    }
    const text = await response.text();
    return csvRowsToObjects(parseCsv(text));
  }

  function normalizePhotoUrl(url) {
    const raw = String(url || "").trim();
    if (!raw) return "";

    const driveFileMatch = raw.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
    if (driveFileMatch) return `https://drive.google.com/uc?export=view&id=${driveFileMatch[1]}`;

    const driveOpenMatch = raw.match(/[?&]id=([^&]+)/i);
    if (raw.includes("drive.google.com") && driveOpenMatch) {
      return `https://drive.google.com/uc?export=view&id=${driveOpenMatch[1]}`;
    }

    return raw;
  }

  function getStatusKey(status) {
    const value = normalize(status);
    const aliases = CONFIG.statusAliases || {};
    for (const [key, values] of Object.entries(aliases)) {
      if ((values || []).some((alias) => value === alias || value.includes(alias))) return key;
    }
    return value || "unknown";
  }

  function mapUnit(row, index) {
    return {
      id: `${read(row, "site")}-${read(row, "unit")}-${index}`,
      site: read(row, "site", "Tanpa Site"),
      unit: read(row, "unit", `Unit ${index + 1}`),
      type: read(row, "type", "-"),
      model: read(row, "model", "-"),
      status: read(row, "status", "Unknown"),
      statusKey: getStatusKey(read(row, "status")),
      hm: read(row, "hm", "-"),
      operator: read(row, "operator", "-"),
      date: read(row, "date", "-"),
      notes: read(row, "notes", ""),
      photo: normalizePhotoUrl(read(row, "photo"))
    };
  }

  function mapEmployee(row, index) {
    return {
      id: `${read(row, "site")}-${read(row, "name")}-${index}`,
      site: read(row, "site", "Tanpa Site"),
      name: read(row, "name", `Karyawan ${index + 1}`),
      nik: read(row, "nik", "-"),
      position: read(row, "position", "-"),
      phone: read(row, "phone", "-"),
      status: read(row, "employeeStatus", "-"),
      photo: normalizePhotoUrl(read(row, "photo"))
    };
  }

  function mapSettings(rows) {
    const result = {};
    rows.forEach((row) => {
      const keys = ["key", "setting", "nama", "pengaturan"];
      const values = ["value", "nilai", "isi", "url"];
      const key = firstValue(row, keys, "");
      const value = firstValue(row, values, "");
      if (key) result[normalize(key).replace(/\s+/g, "_")] = value;
    });
    return result;
  }

  function showMessage(message, type = "error") {
    if (!message) {
      els.statusMessage.className = "message hidden";
      els.statusMessage.textContent = "";
      return;
    }
    els.statusMessage.textContent = message;
    els.statusMessage.className = `message ${type}`;
  }

  function applyBranding() {
    const settings = state.settings;
    const companyName = settings.company_name || settings.nama_perusahaan || CONFIG.companyName;
    const title = settings.dashboard_title || settings.judul_dashboard || CONFIG.appName;
    const footer = settings.footer_text || settings.footer || CONFIG.footerText;
    const leftLogo = normalizePhotoUrl(settings.logo_left_url || settings.logo_kiri || CONFIG.logoLeftUrl);
    const rightLogo = normalizePhotoUrl(settings.logo_right_url || settings.logo_kanan || CONFIG.logoRightUrl);
    const background = normalizePhotoUrl(settings.background_url || settings.background || settings.bg || CONFIG.backgroundImageUrl);

    els.companyName.textContent = companyName || "Mining Operation Dashboard";
    els.dashboardTitle.textContent = title || "Daily Breakdown Unit";
    document.title = title || "Daily Breakdown Unit";
    els.footerText.textContent = footer || "Daily Breakdown Unit";

    setImage(els.logoLeft, leftLogo);
    setImage(els.logoRight, rightLogo);

    if (background) {
      document.body.classList.add("has-bg");
      document.body.style.backgroundImage = `url("${background}")`;
    }
  }

  function setImage(element, url) {
    if (!url) {
      element.removeAttribute("src");
      element.classList.remove("visible");
      return;
    }
    element.src = url;
    element.classList.add("visible");
  }

  function getAllSites() {
    return Array.from(new Set([...state.units, ...state.employees].map((item) => item.site).filter(Boolean))).sort();
  }

  function renderSiteOptions() {
    const sites = getAllSites();
    const current = state.site;
    els.siteFilter.innerHTML = '<option value="all">Semua site</option>';
    sites.forEach((site) => {
      const option = document.createElement("option");
      option.value = site;
      option.textContent = site;
      els.siteFilter.appendChild(option);
    });
    els.siteFilter.value = sites.includes(current) ? current : "all";
    state.site = els.siteFilter.value;
  }

  function matchesFilters(item) {
    const siteMatch = state.site === "all" || item.site === state.site;
    const query = normalize(state.query);
    const queryMatch = !query || normalize(Object.values(item).join(" ")).includes(query);
    return siteMatch && queryMatch;
  }

  function filteredUnits() {
    return state.units.filter(matchesFilters);
  }

  function filteredEmployees() {
    return state.employees.filter(matchesFilters);
  }

  function emptyNode() {
    return els.emptyTemplate.content.cloneNode(true);
  }

  function renderStats(units) {
    const counts = units.reduce(
      (acc, unit) => {
        acc.total += 1;
        if (unit.statusKey === "running") acc.running += 1;
        if (unit.statusKey === "standby") acc.standby += 1;
        if (unit.statusKey === "breakdown") acc.breakdown += 1;
        return acc;
      },
      { total: 0, running: 0, standby: 0, breakdown: 0 }
    );

    els.totalUnits.textContent = counts.total;
    els.runningUnits.textContent = counts.running;
    els.standbyUnits.textContent = counts.standby;
    els.breakdownUnits.textContent = counts.breakdown;
  }

  function renderUnits() {
    const units = filteredUnits();
    renderStats(units);
    els.unitCountLabel.textContent = `${units.length} unit ditampilkan`;
    els.unitGrid.innerHTML = "";

    if (!units.length) {
      els.unitGrid.appendChild(emptyNode());
      return;
    }

    units.forEach((unit) => {
      const card = document.createElement("article");
      card.className = "unit-card";
      card.innerHTML = `
        <div class="card-photo-wrap">
          ${unit.photo ? `<img src="${escapeAttr(unit.photo)}" alt="Foto ${escapeAttr(unit.unit)}" loading="lazy" />` : `<div class="photo-placeholder">Tambahkan URL foto di kolom Foto</div>`}
          <span class="status-pill ${escapeAttr(unit.statusKey)}">${escapeHtml(unit.status)}</span>
          <span class="site-pill">${escapeHtml(unit.site)}</span>
        </div>
        <div class="card-body">
          <div>
            <h3 class="card-title">${escapeHtml(unit.unit)}</h3>
            <p class="card-subtitle">${escapeHtml([unit.type, unit.model].filter(Boolean).join(" • "))}</p>
          </div>
          <div class="meta-grid">
            <div class="meta"><span>HM/KM</span><strong>${escapeHtml(unit.hm)}</strong></div>
            <div class="meta"><span>Operator/PIC</span><strong>${escapeHtml(unit.operator)}</strong></div>
            <div class="meta"><span>Update</span><strong>${escapeHtml(unit.date)}</strong></div>
            <div class="meta"><span>Status</span><strong>${escapeHtml(unit.status)}</strong></div>
          </div>
          ${unit.notes ? `<p class="notes">${escapeHtml(unit.notes)}</p>` : ""}
        </div>
      `;
      els.unitGrid.appendChild(card);
    });
  }

  function initials(name) {
    return String(name || "?")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase();
  }

  function renderEmployees() {
    const employees = filteredEmployees();
    els.employeeCountLabel.textContent = `${employees.length} karyawan ditampilkan`;
    els.employeeGrid.innerHTML = "";

    if (!employees.length) {
      els.employeeGrid.appendChild(emptyNode());
      return;
    }

    employees.forEach((employee) => {
      const card = document.createElement("article");
      card.className = "employee-card";
      card.innerHTML = `
        <div class="card-photo-wrap employee-photo">
          <span class="site-pill">${escapeHtml(employee.site)}</span>
        </div>
        <div class="card-body">
          <div class="employee-avatar">
            ${employee.photo ? `<img src="${escapeAttr(employee.photo)}" alt="Foto ${escapeAttr(employee.name)}" loading="lazy" />` : `<span>${escapeHtml(initials(employee.name))}</span>`}
          </div>
          <div>
            <h3 class="card-title">${escapeHtml(employee.name)}</h3>
            <p class="card-subtitle">${escapeHtml(employee.position)}</p>
          </div>
          <div class="meta-grid">
            <div class="meta"><span>NIK/NRP</span><strong>${escapeHtml(employee.nik)}</strong></div>
            <div class="meta"><span>Status</span><strong>${escapeHtml(employee.status)}</strong></div>
            <div class="meta"><span>Kontak</span><strong>${escapeHtml(employee.phone)}</strong></div>
            <div class="meta"><span>Site</span><strong>${escapeHtml(employee.site)}</strong></div>
          </div>
        </div>
      `;
      els.employeeGrid.appendChild(card);
    });
  }

  function renderPage() {
    const isUnits = state.currentPage === "units";
    els.unitsPage.classList.toggle("active-page", isUnits);
    els.employeesPage.classList.toggle("active-page", !isUnits);
    els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.page === state.currentPage));
    renderUnits();
    renderEmployees();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }

  async function loadData() {
    if (state.loading) return;
    state.loading = true;
    els.refreshButton.disabled = true;
    els.refreshButton.textContent = "Memuat...";
    showMessage("Mengambil data terbaru dari Google Spreadsheet...", "info");

    try {
      const [unitRows, employeeRows, settingRows] = await Promise.all([
        fetchCsv(CONFIG.unitsCsvUrl),
        fetchCsv(CONFIG.employeesCsvUrl).catch(() => []),
        fetchCsv(CONFIG.settingsCsvUrl).catch(() => [])
      ]);

      state.units = unitRows.map(mapUnit).filter((unit) => unit.unit || unit.site);
      state.employees = employeeRows.map(mapEmployee).filter((employee) => employee.name || employee.site);
      state.settings = mapSettings(settingRows);

      applyBranding();
      renderSiteOptions();
      renderPage();
      els.lastRefresh.textContent = new Date().toLocaleString("id-ID", {
        dateStyle: "medium",
        timeStyle: "short"
      });

      showMessage("");
      if (!CONFIG.employeesCsvUrl) {
        showMessage("Halaman Data Karyawan sudah siap. Isi employeesCsvUrl di config.js setelah tab Karyawan dipublish sebagai CSV.", "info");
      }
    } catch (error) {
      console.error(error);
      showMessage(`${error.message}. Pastikan Google Sheet sudah Publish to web sebagai CSV dan link bisa diakses publik.`);
      renderPage();
    } finally {
      state.loading = false;
      els.refreshButton.disabled = false;
      els.refreshButton.textContent = "Muat Ulang";
    }
  }

  function bindEvents() {
    els.tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        state.currentPage = tab.dataset.page;
        renderPage();
      });
    });

    els.siteFilter.addEventListener("change", (event) => {
      state.site = event.target.value;
      renderPage();
    });

    els.searchInput.addEventListener("input", (event) => {
      state.query = event.target.value;
      renderPage();
    });

    els.refreshButton.addEventListener("click", loadData);
  }

  function init() {
    applyBranding();
    bindEvents();
    loadData();

    const refreshSeconds = Number(CONFIG.refreshIntervalSeconds || 0);
    if (refreshSeconds > 0) {
      window.setInterval(loadData, refreshSeconds * 1000);
    }
  }

  init();
})();
