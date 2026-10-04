/* ===========================================================
   Daily Breakdown Unit
   Membaca Google Sheets yang di-publish sebagai CSV.
   Mendukung dua bentuk spreadsheet:
     1. Layout dashboard (blok per site, unit & status berpasangan)
     2. Tabel berkolom rapi (satu baris = satu unit)
   =========================================================== */

const CONFIG = {
  /*
   * Data utama dibaca dari versi Publish to web HTML, BUKAN CSV.
   * Alasannya: status pada spreadsheet ini ditunjukkan oleh warna cell.
   * CSV hanya membawa nilai teks dan membuang warna.
   *
   * /sheet-html diproxy oleh Netlify melalui netlify.toml sehingga
   * browser tidak terkena masalah CORS.
   */
  SHEET_HTML_URL: '/sheet-html',
  SHEET_PUBLIC_HTML_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSod7Mdzh3NW4a8uyA1cXEF51Clo-8I1KapKosN5-XgOyqXMWYoQ31_vdM53RhGJn_s6m8ETxNeTjqi/pubhtml',

  /* CSV dipertahankan sebagai fallback untuk sheet tabel biasa. */
  SHEET_CSV_URL: '/sheet-csv',

  REFRESH_MINUTES: 5,    // auto refresh; 0 = mati
  STALE_HOURS: 8,

  /* Dipakai hanya oleh fallback parser CSV lama. */
  SPLIT_COL: 'auto',

  DOWNTIME_COL: 'auto',
  HM_COL: 'auto',
};

/* ---------- definisi status (urutan tetap) ---------- */

const STATUSES = [
  { key: 'running',   label: 'Running',   icon: 'check', tone: 'good' },
  { key: 'standby',   label: 'Standby',   icon: 'pause', tone: 'warning' },
  { key: 'breakdown', label: 'Breakdown', icon: 'alert', tone: 'critical' },
];

const TONE_VAR = {
  good: 'var(--st-good)',
  warning: 'var(--st-warning)',
  serious: 'var(--st-serious)',
  critical: 'var(--st-critical)',
};

/* Status persis — dipakai untuk sel pada layout dashboard,
   supaya teks seperti "BREAKDOWN REPORT" tidak ikut terbaca. */
const EXACT_STATUS = {
  RUNNING: 'running', OPERASI: 'running', OPERATION: 'running', NORMAL: 'running',
  JALAN: 'running', BEROPERASI: 'running', OK: 'running',

  STANDBY: 'standby', 'STAND BY': 'standby', IDLE: 'standby', SIAP: 'standby',
  MENUNGGU: 'standby', READY: 'standby',

  // Maintenance diperlakukan sama dengan Breakdown sesuai kebutuhan dashboard.
  MAINTENANCE: 'breakdown', PERAWATAN: 'breakdown', SERVICE: 'breakdown',
  SERVIS: 'breakdown', PERBAIKAN: 'breakdown', REPAIR: 'breakdown', PM: 'breakdown',

  BREAKDOWN: 'breakdown', BD: 'breakdown', RUSAK: 'breakdown', DOWN: 'breakdown',
  MATI: 'breakdown', TROUBLE: 'breakdown', GAGAL: 'breakdown',
};

/* Pencocokan longgar — dipakai untuk sheet berkolom rapi. */
const STATUS_WORDS = [
  [/operas|operation|running|beroperasi|jalan|normal|\bok\b/i, 'running'],
  [/stand\s?by|siap|idle|menunggu|ready/i, 'standby'],
  [/maintenance|perawatan|service|servis|perbaikan|repair|\bpm\b/i, 'breakdown'],
  [/break\s?down|\bbd\b|rusak|down|mati|trouble|gagal/i, 'breakdown'],
];

const ICONS = {
  check: '<path d="M3 8.5 6.2 12 13 4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
  pause: '<path d="M6 4v8M10 4v8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  wrench: '<path d="M9.4 2.6a3.6 3.6 0 0 0-3.2 5.4L2 12v2h2l4.1-4.2a3.6 3.6 0 0 0 5.4-3.2l-1.9-1.9-2.2 2.2-1.7-1.7 2.2-2.2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  alert: '<path d="M8 1.8 14.5 13H1.5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M8 6v3.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="11" r="0.95" fill="currentColor"/>',
};

function icon(name) {
  return `<svg viewBox="0 0 16 16" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

/* ---------- data contoh (cadangan bila gagal memuat) ---------- */

const SAMPLE_ROWS = [
  ['Tanggal', 'Site', 'Kode Unit', 'Tipe', 'Status', 'Penyebab', 'Downtime (jam)', 'HM', 'Operator', 'Keterangan'],
  ['2026-10-03', 'Pit Utara', 'EX-2001', 'Excavator PC2000', 'Running', '', '0', '18420', 'Sugiyanto', 'Front loading OB'],
  ['2026-10-03', 'Pit Utara', 'EX-2002', 'Excavator PC1250', 'Breakdown', 'Hose hidrolik boom pecah', '5.25', '15120', 'Dedi', 'Tunggu part'],
  ['2026-10-03', 'Pit Utara', 'DT-3001', 'Dump Truck HD465', 'Running', '', '0', '24510', 'Rahmat', 'Hauling OB'],
  ['2026-10-03', 'Pit Utara', 'DT-3002', 'Dump Truck HD785', 'Standby', '', '0', '22180', '', 'Tunggu operator'],
  ['2026-10-03', 'Pit Selatan', 'EX-2003', 'Excavator PC2000', 'Breakdown', '', '0', '19240', 'Bambang', 'Service 500 jam'],
  ['2026-10-03', 'Pit Selatan', 'DT-3003', 'Dump Truck HD465', 'Breakdown', 'Turbo', '2.5', '20880', 'Joko', ''],
  ['2026-10-03', 'Pit Selatan', 'DT-3004', 'Dump Truck HD785', 'Running', '', '0', '23760', 'Sari', ''],
  ['2026-10-03', 'Pit Selatan', 'BD-5001', 'Bulldozer D85', 'Standby', '', '0', '14020', '', ''],
];

/* ---------- util ---------- */

const $ = (sel) => document.querySelector(sel);

function norm(v) {
  return String(v == null ? '' : v).trim().toUpperCase().replace(/\s+/g, ' ');
}

function normalizeKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/* Angka Indonesia: 1.500 → 1500 · 5,25 → 5.25 · 1.234,5 → 1234.5 */
function parseNum(v) {
  if (v == null) return null;
  let s = String(v).trim();
  if (!s) return null;
  s = s.replace(/[^\d.,\-]/g, '');
  if (!s || !/[\d]/.test(s)) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    s = lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (lastComma > -1) {
    const frac = s.slice(lastComma + 1);
    s = (frac.length === 3 && s.split(',').length === 2) ? s.replace(',', '') : s.replace(',', '.');
  } else if (lastDot > -1) {
    const frac = s.slice(lastDot + 1);
    s = (s.split('.').length > 2 || frac.length === 3) ? s.replace(/\./g, '') : s;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function mapStatus(raw) {
  const s = String(raw || '').trim();
  if (!s) return 'standby';
  const exact = EXACT_STATUS[norm(s)];
  if (exact) return exact;
  for (const [re, key] of STATUS_WORDS) if (re.test(s)) return key;
  return 'standby';
}

function numFmt(n, digits = 0) {
  if (n == null || !Number.isFinite(n)) return '–';
  return n.toLocaleString('id-ID', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function photoSlug(code) {
  return String(code || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractDriveFileId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  // Jika user menempel ID file langsung.
  if (/^[A-Za-z0-9_-]{20,}$/.test(raw) && !raw.includes('/')) return raw;

  const patterns = [
    /drive\.google\.com\/file\/d\/([^/?#]+)/i,
    /drive\.google\.com\/open\?[^#]*\bid=([^&#]+)/i,
    /drive\.google\.com\/uc\?[^#]*\bid=([^&#]+)/i,
    /drive\.google\.com\/thumbnail\?[^#]*\bid=([^&#]+)/i,
    /[?&]id=([^&#]+)/i,
  ];
  for (const re of patterns) {
    const m = raw.match(re);
    if (m && m[1]) return decodeURIComponent(m[1]);
  }
  return '';
}

function driveImageCandidates(url) {
  const raw = String(url || '').trim();
  if (!raw) return [];
  const id = extractDriveFileId(raw);
  if (!id) return [raw];

  // Beberapa endpoint dicoba karena perilaku hotlink Google Drive bisa berbeda.
  return [
    `https://lh3.googleusercontent.com/d/${encodeURIComponent(id)}=w1200`,
    `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1200`,
    `https://drive.google.com/uc?export=view&id=${encodeURIComponent(id)}`,
  ];
}

function photoMapValue(code) {
  const map = window.UNIT_PHOTOS || {};
  const raw = String(code || '').trim();
  const targetSlug = photoSlug(raw);
  const direct = map[raw] || map[norm(raw)] || map[targetSlug];
  if (direct) return direct;

  // Toleran terhadap key seperti "FC-002", "fc_002", atau "FC002".
  for (const [key, value] of Object.entries(map)) {
    if (photoSlug(key) === targetSlug) return value;
    if (photoSlug(key).replace(/-/g, '') === targetSlug.replace(/-/g, '')) return value;
  }
  return '';
}

function localPhotoCandidates(code) {
  const raw = String(code || '').trim();
  const upper = norm(raw);
  const slug = photoSlug(raw);
  const compact = slug.replace(/-/g, '');
  const underscored = slug.replace(/-/g, '_');
  const fileBases = [
    slug,
    upper.replace(/\s+/g, '-'),
    upper.replace(/\s+/g, '_'),
    raw,
    compact,
    underscored,
  ].filter(Boolean);

  const exts = ['jpg', 'jpeg', 'png', 'webp', 'JPG', 'JPEG', 'PNG', 'WEBP'];
  const out = [];
  for (const base of [...new Set(fileBases)]) {
    for (const ext of exts) {
      // encodeURI menjaga slash tetapi mengubah spasi menjadi %20.
      out.push(encodeURI(`assets/photos/${base}.${ext}`));
    }
  }
  return out;
}

function unitPhotoCandidates(unit) {
  const code = String(unit.code || '').trim();
  const mapped = photoMapValue(code) || unit.photo || '';
  const items = [
    ...driveImageCandidates(mapped),
    ...localPhotoCandidates(code),
  ].filter(Boolean);
  return [...new Set(items)];
}

const PHOTO_DIAGNOSTICS = {};

function recordPhotoDiagnostic(code, patch) {
  const key = String(code || '').trim();
  PHOTO_DIAGNOSTICS[key] = { ...(PHOTO_DIAGNOSTICS[key] || {}), ...patch };
  if (new URLSearchParams(location.search).get('debug') === 'photos') {
    window.clearTimeout(recordPhotoDiagnostic._timer);
    recordPhotoDiagnostic._timer = window.setTimeout(renderPhotoDebugPanel, 100);
  }
}

function renderPhotoDebugPanel() {
  let pre = document.querySelector('#photo-debug-panel');
  if (!pre) {
    pre = document.createElement('pre');
    pre.id = 'photo-debug-panel';
    pre.style.cssText = 'margin:16px auto;max-width:1280px;padding:14px;border:1px solid var(--line);border-radius:12px;background:var(--surface);white-space:pre-wrap;font:12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;overflow:auto;';
    document.querySelector('.app-shell').appendChild(pre);
  }
  pre.textContent = JSON.stringify(PHOTO_DIAGNOSTICS, null, 2);
}

function photoPlaceholderMarkup(code) {
  return `<span class="photo-placeholder" aria-hidden="true">
    <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 5.5h16v13H4z"/><circle cx="9" cy="10" r="2"/><path d="m5.5 17 4.2-4 3 2.7 2.3-2.2 3.5 3.5"/></svg><br>${escapeHtml(code)}</span>
  </span>`;
}

function unitPhotoMarkup(unit) {
  const candidates = unitPhotoCandidates(unit);
  const payload = encodeURIComponent(JSON.stringify(candidates));
  return `<button class="unit-thumb" type="button" data-unit-open="${escapeHtml(unit.code)}" aria-label="Lihat ${escapeHtml(unit.code)}">
    <img data-photo-candidates="${payload}" alt="Foto ${escapeHtml(unit.code)}" hidden>
    ${photoPlaceholderMarkup(unit.code)}
  </button>`;
}

function hydrateUnitPhotos(root = document) {
  root.querySelectorAll('img[data-photo-candidates]').forEach((img) => {
    if (img.dataset.photoReady === '1') return;
    img.dataset.photoReady = '1';
    const button = img.closest('[data-unit-open]');
    const code = button ? button.dataset.unitOpen : (img.alt || '').replace(/^Foto\s+/i, '');
    let list = [];
    try { list = JSON.parse(decodeURIComponent(img.dataset.photoCandidates || '')) || []; } catch (_) {}
    let idx = 0;
    const tried = [];
    recordPhotoDiagnostic(code, { configured: photoMapValue(code) || null, candidates: list, tried: [], loaded: null });

    const next = () => {
      if (idx >= list.length) {
        img.hidden = true;
        recordPhotoDiagnostic(code, { tried: [...tried], loaded: null, status: 'not-found' });
        return;
      }
      const src = list[idx++];
      tried.push(src);
      img.hidden = false;
      img.src = src;
      recordPhotoDiagnostic(code, { tried: [...tried], current: src, status: 'trying' });
    };

    img.addEventListener('load', () => {
      img.hidden = false;
      const ph = img.nextElementSibling;
      if (ph) ph.hidden = true;
      recordPhotoDiagnostic(code, { tried: [...tried], loaded: img.currentSrc || img.src, status: 'loaded' });
    });
    img.addEventListener('error', () => next());
    next();
  });
}


/* ===========================================================
   Parser Publish-to-web HTML
   =========================================================== */

/*
 * Google Sheets "Publish to web" mengirim format warna sebagai CSS class
 * (misalnya .s12 { background-color:#00b050 }). Karena itu kita membaca
 * tabel HTML beserta CSS-nya dan mengubah warna cell status menjadi
 * running / standby / breakdown (maintenance digabung ke breakdown).
 */

function cleanText(v) {
  return String(v == null ? '' : v)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cssClassBackgrounds(doc) {
  const out = new Map();
  for (const tag of doc.querySelectorAll('style')) {
    const css = tag.textContent || '';
    const re = /\.([A-Za-z_][\w-]*)\s*\{([^}]*)\}/g;
    let m;
    while ((m = re.exec(css))) {
      const cls = m[1];
      const body = m[2];
      const bg = body.match(/background-color\s*:\s*([^;!}]+)/i)
        || body.match(/background\s*:\s*([^;!}]+)/i);
      if (bg) out.set(cls, bg[1].trim());
    }
  }
  return out;
}

function parseCssColor(input) {
  const s = cleanText(input).toLowerCase();
  if (!s || s === 'transparent' || s === 'none' || s === 'inherit') return null;

  let m = s.match(/^#([0-9a-f]{3})$/i);
  if (m) {
    const x = m[1];
    return {
      r: parseInt(x[0] + x[0], 16),
      g: parseInt(x[1] + x[1], 16),
      b: parseInt(x[2] + x[2], 16),
    };
  }
  m = s.match(/^#([0-9a-f]{6})/i);
  if (m) {
    const x = m[1];
    return {
      r: parseInt(x.slice(0, 2), 16),
      g: parseInt(x.slice(2, 4), 16),
      b: parseInt(x.slice(4, 6), 16),
    };
  }
  m = s.match(/rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/i);
  if (m) return { r: +m[1], g: +m[2], b: +m[3] };
  return null;
}

function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0, sat = 0;
  if (d !== 0) {
    sat = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * (((b - r) / d) + 2);
    else h = 60 * (((r - g) / d) + 4);
    if (h < 0) h += 360;
  }
  return { h, s: sat, l };
}

function statusFromColor(raw) {
  const rgb = parseCssColor(raw);
  if (!rgb) return null;

  const { r, g, b } = rgb;
  const { h, s, l } = rgbToHsl(rgb);

  /* putih / hampir putih bukan indikator status */
  if (r > 242 && g > 242 && b > 242) return null;

  /* merah */
  if ((h <= 18 || h >= 342) && s >= 0.38 && l < 0.83) return 'breakdown';

  /* oranye / kuning: diperlakukan sebagai Breakdown */
  if (h >= 18 && h <= 68 && s >= 0.35 && l < 0.84) return 'breakdown';

  /* hijau */
  if (h >= 70 && h <= 175 && s >= 0.28 && l < 0.86) return 'running';

  /* abu-abu / biru abu-abu */
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  if ((spread <= 48 && l >= 0.35 && l <= 0.88)
      || (h >= 180 && h <= 245 && s <= 0.30 && l >= 0.40 && l <= 0.86)) {
    return 'standby';
  }

  return null;
}

function elementBackground(el, classBg) {
  if (!el) return '';
  const inline = el.getAttribute && el.getAttribute('style');
  if (inline) {
    const m = inline.match(/background-color\s*:\s*([^;!]+)/i)
      || inline.match(/background\s*:\s*([^;!]+)/i);
    if (m && parseCssColor(m[1])) return m[1].trim();
  }

  if (el.classList) {
    for (const cls of el.classList) {
      const bg = classBg.get(cls);
      if (bg && parseCssColor(bg)) return bg;
    }
  }
  return '';
}

function cellBackground(td, classBg) {
  let bg = elementBackground(td, classBg);
  if (bg) return bg;

  /* kadang style berada pada elemen di dalam cell */
  for (const el of td.querySelectorAll('[style],[class]')) {
    bg = elementBackground(el, classBg);
    if (bg) return bg;
  }
  return '';
}

function buildHtmlGrid(table, classBg) {
  const trs = [...table.querySelectorAll('tr')];
  const grid = Array.from({ length: trs.length }, () => []);
  const unique = [];

  trs.forEach((tr, r) => {
    let c = 0;
    for (const td of tr.querySelectorAll(':scope > td, :scope > th')) {
      while (grid[r][c]) c++;
      const colspan = Math.max(1, parseInt(td.getAttribute('colspan') || '1', 10) || 1);
      const rowspan = Math.max(1, parseInt(td.getAttribute('rowspan') || '1', 10) || 1);
      const img = td.querySelector('img');
      const a = td.querySelector('a');
      const cell = {
        row: r,
        col: c,
        text: cleanText(td.textContent),
        bg: cellBackground(td, classBg),
        img: img ? (img.getAttribute('src') || '') : '',
        href: a ? (a.getAttribute('href') || '') : '',
      };
      unique.push(cell);
      for (let dy = 0; dy < rowspan; dy++) {
        if (!grid[r + dy]) grid[r + dy] = [];
        for (let dx = 0; dx < colspan; dx++) {
          if (!grid[r + dy][c + dx]) grid[r + dy][c + dx] = cell;
        }
      }
      c += colspan;
    }
  });

  return { grid, unique };
}

function canonicalUnitCode(raw) {
  const s = cleanText(raw).toUpperCase();
  if (!s || s.length > 18) return null;

  /*
   * Menerima kode pada sheet seperti:
   * FC 002, CL 001, FCBIN 01, CLBIN 01, FCBK 01,
   * CLBA 01, ICBA02, FCBE 01, FCBN 05, CLBN 04, dst.
   */
  const m = s.match(/^([A-Z]{1,7})\s*[-.]?\s*(\d{1,3})$/);
  if (!m) return null;

  const prefix = m[1];
  const digits = m[2];

  /* cegah label umum ikut dianggap unit */
  if (/^(ISO|TOTAL|PORT|UNIT|DATE|TGL|HM|PIC|NO)$/.test(prefix)) return null;

  return `${prefix} ${digits}`;
}

function isPortSite(raw) {
  const s = cleanText(raw).toUpperCase();
  return /^PORT\s+[A-Z0-9][A-Z0-9 .&()/_-]{1,50}$/.test(s);
}

function nearestStatus(grid, cell) {
  const row = grid[cell.row] || [];

  /* 1. teks/status atau warna pada cell sendiri */
  const ownText = EXACT_STATUS[norm(cell.text)];
  if (ownText) return { status: ownText, color: cell.bg || '', at: cell.col };
  const ownColor = statusFromColor(cell.bg);
  if (ownColor) return { status: ownColor, color: cell.bg || '', at: cell.col };

  /*
   * 2. Pada dashboard pengguna, indikator warna berada tepat di kanan
   *    kode unit. Cari sampai 4 kolom agar tahan terhadap merged cells.
   */
  for (let d = 1; d <= 4; d++) {
    const x = row[cell.col + d];
    if (!x || x === cell) continue;

    if (canonicalUnitCode(x.text)) break;
    if (isPortSite(x.text)) break;

    const stText = EXACT_STATUS[norm(x.text)];
    if (stText) return { status: stText, color: x.bg || '', at: cell.col + d };

    const stColor = statusFromColor(x.bg);
    if (stColor) return { status: stColor, color: x.bg || '', at: cell.col + d };
  }

  /* fallback: kadang indikator ada satu cell di kiri */
  for (let d = 1; d <= 2; d++) {
    const x = row[cell.col - d];
    if (!x || x === cell) continue;
    const stText = EXACT_STATUS[norm(x.text)];
    if (stText) return { status: stText, color: x.bg || '', at: cell.col - d };
    const stColor = statusFromColor(x.bg);
    if (stColor) return { status: stColor, color: x.bg || '', at: cell.col - d };
  }

  return null;
}

function nearestSite(siteGroups, unit) {
  const rows = [...siteGroups.keys()].filter((r) => r <= unit.row).sort((a, b) => b - a);
  if (!rows.length) return 'Tanpa site';

  /* header site terbaru di atas unit */
  const anchors = siteGroups.get(rows[0]) || [];
  if (!anchors.length) return 'Tanpa site';

  let best = anchors[0];
  let bestD = Math.abs(unit.col - best.col);
  for (const a of anchors.slice(1)) {
    const d = Math.abs(unit.col - a.col);
    if (d < bestD) { best = a; bestD = d; }
  }
  return best.name;
}

function readSummaryFromGrid(grid) {
  const summary = {};
  const wanted = {
    'TOTAL UNIT': 'totalunit',
    RUNNING: 'running',
    STANDBY: 'standby',
    MAINTENANCE: 'breakdown',
    BREAKDOWN: 'breakdown',
    AVAILABILITY: 'availability',
  };

  for (let r = 0; r < grid.length; r++) {
    const row = grid[r] || [];
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (!cell || cell.row !== r || cell.col !== c) continue;
      const key = wanted[norm(cell.text)];
      if (!key) continue;

      let val = null;
      for (let dr = 1; dr <= 3 && val == null; dr++) {
        const below = grid[r + dr] && grid[r + dr][c];
        if (!below) continue;
        const n = parseNum(String(below.text).replace('%', ''));
        if (n != null) val = n;
      }
      if (val != null) {
        if (key === 'breakdown' && summary[key] != null) summary[key] += val;
        else summary[key] = val;
      }
    }
  }
  return summary;
}

function readMetaFromGrid(grid, unique) {
  const meta = { title: '', date: '', summary: readSummaryFromGrid(grid) };

  for (const cell of unique) {
    const t = cleanText(cell.text);
    if (!meta.title && /DAILY\s+BREAKDOWN\s+UNIT/i.test(t)) meta.title = 'DAILY BREAKDOWN UNIT';
    if (!meta.date) {
      const m = t.match(new RegExp('(\\d{1,2}\\s+(?:' + MONTHS + ')\\s+\\d{4})', 'i'))
        || t.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{4})/);
      if (m) meta.date = m[1];
    }
  }
  return meta;
}

function readReportLines(unique) {
  const lines = [];
  for (const c of unique) {
    const t = cleanText(c.text);
    if (!t) continue;
    if (/^\d+\s*[.)]\s*[A-Z]{1,7}\s*\d{1,3}\b/i.test(t)) lines.push(t);
  }
  return lines;
}

function scorePublishedTable(table, classBg) {
  const { unique } = buildHtmlGrid(table, classBg);
  let units = 0, sites = 0, labels = 0;
  for (const c of unique) {
    if (canonicalUnitCode(c.text)) units++;
    if (isPortSite(c.text)) sites++;
    if (/^(TOTAL UNIT|RUNNING|STANDBY|BREAKDOWN|AVAILABILITY)$/i.test(cleanText(c.text))) labels++;
  }
  return units * 10 + sites * 20 + labels * 2;
}

function parsePublishedHtml(html) {
  const doc = new DOMParser().parseFromString(String(html), 'text/html');
  const classBg = cssClassBackgrounds(doc);
  const tables = [...doc.querySelectorAll('table')];

  if (!tables.length) throw new Error('Tidak menemukan tabel Google Sheets pada /sheet-html.');

  let table = tables[0];
  let bestScore = -1;
  for (const t of tables) {
    const score = scorePublishedTable(t, classBg);
    if (score > bestScore) { bestScore = score; table = t; }
  }

  const { grid, unique } = buildHtmlGrid(table, classBg);
  const siteGroups = new Map();

  for (const c of unique) {
    if (!isPortSite(c.text)) continue;
    if (!siteGroups.has(c.row)) siteGroups.set(c.row, []);
    siteGroups.get(c.row).push({ row: c.row, col: c.col, name: cleanText(c.text) });
  }

  const reportLines = readReportLines(unique);
  const meta = readMetaFromGrid(grid, unique);
  const units = [];
  const seen = new Set();
  const diagnostics = {
    tables: tables.length,
    chosenScore: bestScore,
    sites: [...siteGroups.values()].flat().map((x) => x.name),
    unitCandidates: 0,
    statusesByColor: 0,
    missingStatus: [],
    colorsSeen: [],
  };
  const colorsSeen = new Set();

  for (const c of unique) {
    const code = canonicalUnitCode(c.text);
    if (!code) continue;
    diagnostics.unitCandidates++;

    const key = norm(code);
    if (seen.has(key)) continue;

    const hit = nearestStatus(grid, c);
    if (!hit) {
      diagnostics.missingStatus.push({ code, row: c.row + 1, col: c.col + 1 });
    }

    if (hit && hit.color) {
      diagnostics.statusesByColor++;
      colorsSeen.add(`${hit.color}=${hit.status}`);
    }

    seen.add(key);
    units.push({
      code,
      site: nearestSite(siteGroups, c),
      type: '',
      status: hit ? hit.status : 'unknown',
      statusRaw: hit ? hit.status : 'unknown',
      cause: matchRemark(code, reportLines),
      downtime: null,
      hm: null,
      operator: '',
      note: '',
      date: meta.date,
    });
  }

  diagnostics.colorsSeen = [...colorsSeen];

  /*
   * Jika warna tertentu belum dapat dipetakan, jangan diam-diam tampilkan
   * data salah. Error memuat detail diagnostic agar gampang diperbaiki.
   */
  if (!units.length) {
    const e = new Error(
      `HTML terbaca, tetapi tidak ditemukan kode unit. Kandidat unit: ${diagnostics.unitCandidates}.`
    );
    e.diagnostics = diagnostics;
    throw e;
  }

  return { units, meta, mode: 'published-html', dropped: [], diagnostics };
}

function debugPanel(info) {
  if (!new URLSearchParams(location.search).has('debug')) return;
  let pre = document.querySelector('#debug-panel');
  if (!pre) {
    pre = document.createElement('pre');
    pre.id = 'debug-panel';
    pre.style.cssText = 'margin-top:16px;padding:14px;border:1px solid var(--border);border-radius:10px;background:var(--surface-1);white-space:pre-wrap;font:12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;overflow:auto;';
    document.querySelector('.app-shell').appendChild(pre);
  }
  pre.textContent = JSON.stringify(info || {}, null, 2);
}


/* ---------- parser CSV ---------- */

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const src = String(text).replace(/^﻿/, '');

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') { inQuotes = true; continue; }
    if (c === ',') { row.push(field); field = ''; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    if (c === '\r') continue;
    field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
}

function toGrid(rows) {
  const w = Math.max(1, ...rows.map((r) => r.length));
  return rows.map((r) => {
    const a = r.slice();
    while (a.length < w) a.push('');
    return a.map((c) => String(c == null ? '' : c).trim());
  });
}

/* ---------- deteksi nama site ---------- */

const NOT_SITE = /report|pekerjaan|perbaikan|^total|status|keterangan|catatan|^\d+\.|^unit\s*&|^daily|^laporan|^safety|availability|^fixed plant|senin|selasa|rabu|kamis|jumat|sabtu|minggu|\d{4}/i;

function isSiteName(cell) {
  const s = String(cell || '').trim();
  if (!s || s.length > 40) return false;
  if (s.split(/\s+/).length > 6) return false;
  if (EXACT_STATUS[norm(s)]) return false;
  if (NOT_SITE.test(s)) return false;
  return true;
}

/* ---------- Parser 1: layout dashboard ---------- */

const MONTHS = 'januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember';

function parseLayout(grid) {
  const sections = [];
  let cur = null;
  const meta = { title: '', date: '', summary: {} };

  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    const filled = row.map((c, i) => ({ c, i })).filter((o) => o.c !== '');

    /* judul + tanggal: sel berbentuk "NAMA | Sabtu, 03 Oktober 2026" */
    if (!meta.date) {
      for (const o of filled) {
        const m = o.c.match(new RegExp('(\\d{1,2}\\s+(?:' + MONTHS + ')\\s+\\d{4})', 'i'))
               || o.c.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{4})/);
        if (m) {
          meta.date = m[1];
          if (o.c.includes('|')) meta.title = o.c.split('|')[0].trim();
          break;
        }
      }
    }

    /* baris ringkasan: label di satu baris, angkanya di baris bawahnya */
    if (!Object.keys(meta.summary).length && filled.length) {
      const labels = filled.filter((o) => /^total\s*unit$|^running$|^standby$|^maintenance$|^breakdown$|^availability$/i.test(o.c.trim()));
      if (labels.some((o) => /total\s*unit/i.test(o.c)) && grid[r + 1]) {
        const below = grid[r + 1];
        for (const l of labels) {
          const v = below[l.i] || '';
          if (!v) continue;
          const key = normalizeKey(l.c).replace(/\s+/g, '');
          meta.summary[key] = /%/.test(v) ? parseNum(v.replace('%', '')) : parseNum(v);
        }
      }
    }

    /* Baris header site. Syarat: sedikit sel terisi, TANPA sel status —
       kalau ada status di baris itu, berarti baris data (mis. "FC 005 … STANDBY"),
       bukan nama site. */
    if (filled.length <= 3 && !row.some((c) => EXACT_STATUS[norm(c)])) {
      const names = filled.filter((o) => isSiteName(o.c));
      if (names.length) {
        cur = { sites: names.map((o) => o.c), hits: [], split: null };
        sections.push(cur);
        continue;
      }
    }

    if (!cur) continue;

    /* pasangan (unit → status): status ada di sel, unit di sel terdekat ke kiri */
    for (let c = 0; c < row.length; c++) {
      const st = EXACT_STATUS[norm(row[c])];
      if (!st) continue;
      for (let k = c - 1; k >= Math.max(0, c - 6); k--) {
        const cell = row[k];
        if (!cell) continue;
        if (EXACT_STATUS[norm(cell)]) break;              // jangan lompati status lain
        if (cur.hits.some((h) => h.row === r && h.unitCol === k)) break;
        cur.hits.push({ row: r, unitCol: k, statusCol: c, code: cell, status: st });
        break;
      }
    }
  }

  /* tentukan kolom pemisah panel kiri/kanan per bagian */
  for (const sec of sections) {
    const cols = [...new Set(sec.hits.map((h) => h.unitCol))].sort((a, b) => a - b);
    if (CONFIG.SPLIT_COL !== 'auto') {
      sec.split = Number(CONFIG.SPLIT_COL);
    } else if (sec.sites.length >= 2 && cols.length >= 2) {
      let gap = -1;
      for (let i = 1; i < cols.length; i++) {
        const g = cols[i] - cols[i - 1];
        if (g > gap) { gap = g; sec.split = cols[i - 1] + g / 2; }
      }
    }
  }

  /* kumpulkan baris laporan breakdown ("1. FCBN 05 — Replace Bearing ...") */
  const reportLines = [];
  for (const row of grid) {
    for (const cell of row) {
      if (!cell) continue;
      if (EXACT_STATUS[norm(cell)]) continue;
      if (/^\d+\s*[.)]\s+\S/.test(cell) || /—|–/.test(cell)) reportLines.push(cell);
    }
  }

  if (meta.summary.maintenance != null) {
    meta.summary.breakdown = (meta.summary.breakdown || 0) + meta.summary.maintenance;
    delete meta.summary.maintenance;
  }

  const units = [];
  const seen = new Set();
  for (const sec of sections) {
    for (const h of sec.hits) {
      const key = norm(h.code);
      if (seen.has(key)) continue;
      seen.add(key);
      let site = sec.sites[0];
      if (sec.split != null && sec.sites.length >= 2) {
        site = h.unitCol < sec.split ? sec.sites[0] : sec.sites[1];
      }
      units.push({
        code: h.code,
        site,
        type: '',
        status: h.status,
        statusRaw: h.status,
        cause: matchRemark(h.code, reportLines),
        downtime: null,
        hm: null,
        operator: '',
        note: '',
        date: meta.date,
      });
    }
  }

  /* buang site yang ternyata tidak punya unit */
  const used = new Set(units.map((u) => u.site));
  return { units, meta, dropped: sections.map((s) => s.sites).flat().filter((s) => !used.has(s)) };
}

function matchRemark(code, lines) {
  const esc = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(^|[^\\w])' + esc + '(?![\\w])');
  for (const raw of lines) {
    const t = raw.replace(/^\s*\d+\s*[.)]\s*/, '').trim();
    if (!re.test(t)) continue;
    const out = t.replace(re, '').replace(/^[\s—–\-:|]+/, '').trim();
    if (out && out.length > 2) return out;
  }
  return '';
}

/* ---------- Parser 2: tabel berkolom rapi ---------- */

const COLUMN_RULES = {
  code:   [/^kode\s*unit$|^unit\s*code$|^no\s*unit$|^nomor\s*unit$|^unit$/i],
  site:   [/^site$|^lokasi$|^pit$|^location$|^area$|^daerah$/i],
  date:   [/^tanggal$|^tgl$|^date$/i],
  type:   [/^tipe$|^type$|^jenis$|^model$|^kategori$/i],
  status: [/^status$|^kondisi$|^state$|^keadaan$/i],
  cause:  [/^penyebab$|^sebab$|^cause$|^problem$/i],
  dt:     [/^down\s*time$|^downtime$|^dt$|^durasi$/i],
  hm:     [/^hm$|^hour\s*meter$|^jam\s*meter$/i],
  op:     [/^operator$|^driver$|^pengemudi$|^crew$/i],
  note:   [/^keterangan$|^catatan$|^note$|^remark$/i],
  photo:  [/^foto$|^foto unit$|^photo$|^image$|^image url$|^foto url$|^photo url$/i],
};

function buildColumnMap(header) {
  const map = {};
  const used = new Set();
  header.forEach((raw, idx) => {
    const h = normalizeKey(raw);
    if (!h) return;
    for (const [key, rules] of Object.entries(COLUMN_RULES)) {
      if (key in map || used.has(idx)) continue;
      if (rules.some((re) => re.test(h))) { map[key] = idx; used.add(idx); return; }
    }
  });
  if (!('code' in map)) map.code = 0;
  if (!('status' in map)) {
    for (let i = 0; i < header.length; i++) if (!used.has(i)) { map.status = i; break; }
  }
  return map;
}

function findTidyHeader(grid) {
  const limit = Math.min(grid.length, 15);
  for (let i = 0; i < limit; i++) {
    const cells = grid[i].map(normalizeKey);
    const hasCode = cells.some((c) => /^kode unit$|^unit code$|^kode$|^no unit$|^nomor unit$|^unit$/.test(c));
    const hasStatus = cells.some((c) => /^status$|^kondisi$|^state$/.test(c));
    if (hasCode && hasStatus) return i;
  }
  return -1;
}

function parseTidy(grid, headerIdx) {
  const map = buildColumnMap(grid[headerIdx]);
  const units = [];
  const meta = { title: '', date: '', summary: {} };
  let latest = '';

  for (let i = headerIdx + 1; i < grid.length; i++) {
    const r = grid[i];
    const code = String(r[map.code] ?? '').trim();
    if (!code) continue;
    if (/^(total|jumlah|subtotal)/i.test(code)) continue;

    const d = String(r[map.date] ?? '').trim();
    if (d && d > latest) latest = d;

    units.push({
      code,
      site: String(r[map.site] ?? '').trim() || 'Tanpa site',
      type: String(r[map.type] ?? '').trim(),
      status: mapStatus(r[map.status]),
      statusRaw: String(r[map.status] ?? '').trim(),
      cause: String(r[map.cause] ?? '').trim() || String(r[map.note] ?? '').trim(),
      downtime: map.dt != null ? parseNum(r[map.dt]) : null,
      hm: map.hm != null ? parseNum(r[map.hm]) : null,
      operator: String(r[map.op] ?? '').trim(),
      note: String(r[map.note] ?? '').trim(),
      photo: String(r[map.photo] ?? '').trim(),
      date: d,
    });
  }
  meta.date = latest;
  return { units, meta, dropped: [] };
}

/* ---------- pilih parser ---------- */

function rowsToUnits(rows) {
  const grid = toGrid(rows);
  const tidyIdx = findTidyHeader(grid);
  if (tidyIdx >= 0) return { ...parseTidy(grid, tidyIdx), mode: 'tidy' };
  return { ...parseLayout(grid), mode: 'layout' };
}

/* ---------- keadaan aplikasi ---------- */

const state = {
  units: [],
  meta: {},
  mode: 'layout',
  source: 'none',
  updatedAt: null,
  filter: { site: '__all__', status: '__all__', q: '' },
  sort: { key: 'status', dir: 'asc' },
};

const STATUS_RANK = { breakdown: 0, standby: 1, running: 2, unknown: 3 };

function visibleUnits() {
  const { site, status, q } = state.filter;
  const query = q.trim().toLowerCase();

  const list = state.units.filter((u) => {
    if (site !== '__all__' && u.site !== site) return false;
    if (status !== '__all__' && u.status !== status) return false;
    if (query) {
      const hay = `${u.code} ${u.type} ${u.cause} ${u.operator} ${u.note} ${u.site}`.toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  const { key, dir } = state.sort;
  const mul = dir === 'asc' ? 1 : -1;
  list.sort((a, b) => {
    let r = 0;
    if (key === 'status') r = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    else if (key === 'code') r = a.code.localeCompare(b.code, 'id', { numeric: true });
    else if (key === 'site') r = a.site.localeCompare(b.site, 'id');
    else if (key === 'downtime') r = (a.downtime ?? -1) - (b.downtime ?? -1);
    else if (key === 'hm') r = (a.hm ?? -1) - (b.hm ?? -1);
    else if (key === 'cause') r = (a.cause || '').localeCompare(b.cause || '', 'id');
    if (r === 0) r = a.code.localeCompare(b.code, 'id', { numeric: true });
    return r * mul;
  });
  return list;
}

function countBy(list) {
  const c = { unknown: 0 };
  STATUSES.forEach((s) => { c[s.key] = 0; });
  list.forEach((u) => {
    if (!(u.status in c)) c[u.status] = 0;
    c[u.status]++;
  });
  return c;
}

/* ---------- render ---------- */

function statusInfo(key) {
  return STATUSES.find((s) => s.key === key)
    || { key: 'unknown', label: 'Belum terbaca', icon: 'alert', tone: 'warning' };
}

function render() {
  renderStatusbar();
  renderFilters();
  renderKpis();
  renderSiteCards();
  renderBreakdownReport();
  hydrateUnitPhotos();
}

function renderStatusbar() {
  const el = $('#statusbar');
  const sample = state.source === 'sample';
  const failed = state.source === 'error';
  const cached = state.source === 'cache';
  const parts = [];

  const sourceLabel = sample ? 'Data contoh' : failed ? 'Koneksi gagal' : cached ? 'Data terakhir tersimpan' : 'Google Sheets live';
  const sourceTone = (sample || failed || cached) ? 'warning' : 'good';
  parts.push(`<span class="pill"><span class="dotmark ${sourceTone}"></span>${sourceLabel}</span>`);

  if (state.meta.date) parts.push(`<span class="pill">${escapeHtml(state.meta.date)}</span>`);
  if (state.updatedAt) {
    const ageH = (Date.now() - state.updatedAt.getTime()) / 36e5;
    parts.push(`<span>Update ${escapeHtml(state.updatedAt.toLocaleString('id-ID', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    }))}</span>`);
    if (!sample && ageH > CONFIG.STALE_HOURS) {
      parts.push(`<span class="pill"><span class="dotmark warning"></span>Data usang &gt; ${CONFIG.STALE_HOURS} jam</span>`);
    }
  }
  parts.push(`<span>${state.units.length} unit terbaca</span>`);
  el.innerHTML = parts.join('');
}

function renderFilters() {
  const sites = [...new Set(state.units.map((u) => u.site))].sort((a, b) => a.localeCompare(b, 'id'));
  const sel = $('#f-site');
  sel.innerHTML = ['<option value="__all__">Semua site</option>',
    ...sites.map((site) => `<option value="${escapeHtml(site)}">${escapeHtml(site)}</option>`)].join('');
  sel.value = sites.includes(state.filter.site) ? state.filter.site : '__all__';
  state.filter.site = sel.value;

  const st = $('#f-status');
  const statusOptions = STATUSES.map((status) => `<option value="${status.key}">${status.label}</option>`);
  if (state.units.some((u) => u.status === 'unknown')) statusOptions.push('<option value="unknown">Belum terbaca</option>');
  st.innerHTML = ['<option value="__all__">Semua status</option>', ...statusOptions].join('');
  st.value = [...STATUSES.map((x) => x.key), 'unknown', '__all__'].includes(state.filter.status)
    ? state.filter.status : '__all__';

  const shown = visibleUnits().length;
  $('#filter-summary').textContent = shown === state.units.length ? `${shown} unit` : `${shown} dari ${state.units.length} unit`;
}

function renderKpis() {
  const list = visibleUnits();
  const total = list.length;
  const base = total || 1;
  const c = countBy(list);
  const avail = ((c.running + c.standby) / base) * 100;

  const cards = [
    { label: 'Total Unit', value: total, unit: '', foot: state.filter.site === '__all__' ? 'seluruh site' : state.filter.site, color: 'var(--blue)', soft: 'rgba(29,127,215,.10)', icon: 'check' },
    { label: 'Running', value: c.running, unit: 'unit', foot: `${numFmt((c.running / base) * 100, 0)}% dari unit terfilter`, color: 'var(--green)', soft: 'var(--green-soft)', icon: 'check' },
    { label: 'Standby', value: c.standby, unit: 'unit', foot: `${numFmt((c.standby / base) * 100, 0)}% dari unit terfilter`, color: 'var(--amber)', soft: 'var(--amber-soft)', icon: 'pause' },
    { label: 'Breakdown', value: c.breakdown, unit: 'unit', foot: `${numFmt((c.breakdown / base) * 100, 0)}% dari unit terfilter`, color: 'var(--red)', soft: 'var(--red-soft)', icon: 'alert' },
    { label: 'Availability', value: numFmt(avail, 1), unit: '%', foot: 'running + standby', color: 'var(--blue)', soft: 'rgba(29,127,215,.10)', icon: 'check' },
  ];

  $('#kpis').innerHTML = cards.map((card) => `<article class="kpi" style="--kpi-color:${card.color};--kpi-soft:${card.soft}">
    <div class="label"><span>${card.label}</span><span class="kpi-icon">${icon(card.icon)}</span></div>
    <div class="value">${card.value}${card.unit ? `<span class="unit">${card.unit}</span>` : ''}</div>
    <div class="foot">${escapeHtml(card.foot)}</div>
  </article>`).join('');
}

function renderSiteCards() {
  const list = visibleUnits();
  const grid = $('#site-grid');
  const sites = [...new Set(list.map((u) => u.site))].sort((a, b) => a.localeCompare(b, 'id'));
  $('#site-section-note').textContent = `${sites.length} site · ${list.length} unit`;

  if (!list.length) {
    grid.innerHTML = '<div class="empty-state">Tidak ada unit yang cocok dengan filter.</div>';
    return;
  }

  grid.innerHTML = sites.map((site) => {
    const units = list.filter((u) => u.site === site).sort((a, b) => a.code.localeCompare(b.code, 'id', { numeric: true }));
    const c = countBy(units);
    const avail = ((c.running + c.standby) / (units.length || 1)) * 100;
    const unitRows = units.map((u) => {
      const info = statusInfo(u.status);
      const detail = u.cause || u.note || u.type || 'Tidak ada catatan';
      return `<article class="unit-row ${u.status === 'breakdown' ? 'is-breakdown' : ''}" data-unit-code="${escapeHtml(u.code)}">
        ${unitPhotoMarkup(u)}
        <div class="unit-info">
          <div class="unit-code">${escapeHtml(u.code)}</div>
          <div class="unit-meta" title="${escapeHtml(detail)}">${escapeHtml(detail)}</div>
        </div>
        <span class="status-badge ${info.key}">${info.label}</span>
      </article>`;
    }).join('');

    return `<section class="site-card">
      <header class="site-card-head">
        <div class="site-title">
          <h3>${escapeHtml(site)}</h3>
          <span>${units.length} unit · Availability ${numFmt(avail, 1)}%</span>
        </div>
        <div class="site-mini-kpis" aria-label="Ringkasan ${escapeHtml(site)}">
          <span class="mini-pill running" title="Running">R ${c.running}</span>
          <span class="mini-pill standby" title="Standby">S ${c.standby}</span>
          <span class="mini-pill breakdown" title="Breakdown">B ${c.breakdown}</span>
        </div>
      </header>
      <div class="unit-list">${unitRows}</div>
    </section>`;
  }).join('');
}

function renderBreakdownReport() {
  const list = visibleUnits().filter((u) => u.status === 'breakdown');
  const panel = $('#breakdown-panel');
  const target = $('#breakdown-list');
  $('#breakdown-count').textContent = `${list.length} unit`;

  if (!list.length) {
    target.innerHTML = '<div class="breakdown-empty">Tidak ada unit breakdown pada filter saat ini.</div>';
    panel.classList.add('is-clear');
    return;
  }
  panel.classList.remove('is-clear');
  target.innerHTML = list.map((u) => `<div class="breakdown-item">
    <div class="breakdown-site">${escapeHtml(u.site)}</div>
    <div class="breakdown-code">${escapeHtml(u.code)}</div>
    <div class="breakdown-cause">${escapeHtml(u.cause || u.note || 'Belum ada keterangan pekerjaan/perbaikan.')}</div>
  </div>`).join('');
}

function findUnitByCode(code) {
  return state.units.find((u) => norm(u.code) === norm(code));
}

function openUnitDialog(code, trigger) {
  const u = findUnitByCode(code);
  if (!u) return;
  const dialog = $('#unit-dialog');
  const info = statusInfo(u.status);
  $('#dialog-site').textContent = u.site || '';
  $('#dialog-code').textContent = u.code || '';
  $('#dialog-status').innerHTML = `<span class="status-badge ${info.key}">${info.label}</span>`;
  $('#dialog-cause').textContent = u.cause || u.note || 'Belum ada keterangan untuk unit ini.';

  const srcImg = trigger && trigger.querySelector('img');
  const img = $('#dialog-photo');
  const ph = $('#dialog-photo-placeholder');
  if (srcImg && !srcImg.hidden && srcImg.currentSrc) {
    img.src = srcImg.currentSrc;
    img.hidden = false;
    ph.hidden = true;
  } else {
    img.removeAttribute('src');
    img.hidden = true;
    ph.hidden = false;
  }
  if (typeof dialog.showModal === 'function') dialog.showModal();
}

/* ---------- rekonsiliasi dengan ringkasan di sheet ---------- */

function reconcile() {
  const s = state.meta.summary || {};
  if (!s.totalunit) return null;
  const c = countBy(state.units);
  const diffs = [];
  const pairs = [['totalunit', state.units.length], ['running', c.running],
                 ['standby', c.standby], ['breakdown', c.breakdown]];
  for (const [key, got] of pairs) {
    const want = s[key];
    if (want == null) continue;
    if (want !== got) diffs.push(`${key} ${got} ≠ ${want}`);
  }
  return diffs.length ? diffs : null;
}

/* ---------- ambil data ---------- */

function applyParsed(parsed, source) {
  if (!parsed || !parsed.units || !parsed.units.length) {
    throw new Error('Tidak ada unit yang terbaca dari spreadsheet.');
  }
  state.units = parsed.units.map((u) => ({
    ...u,
    status: u.status === 'maintenance' ? 'breakdown' : u.status,
  }));
  state.meta = parsed.meta || {};
  state.mode = parsed.mode || 'unknown';
  state.source = source;
  state.updatedAt = new Date();
  state.diagnostics = parsed.diagnostics || null;

  try {
    localStorage.setItem('dbu-last-good', JSON.stringify({
      savedAt: Date.now(),
      units: state.units,
      meta: state.meta,
      mode: state.mode,
    }));
  } catch (_) {}
}

function applyRows(rows, source) {
  const parsed = rowsToUnits(rows);
  applyParsed(parsed, source);
}

function restoreLastGood() {
  try {
    const raw = localStorage.getItem('dbu-last-good');
    if (!raw) return false;
    const snap = JSON.parse(raw);
    if (!snap || !Array.isArray(snap.units) || !snap.units.length) return false;
    state.units = snap.units.map((u) => ({
      ...u,
      status: u.status === 'maintenance' ? 'breakdown' : u.status,
    }));
    state.meta = snap.meta || {};
    state.mode = snap.mode || 'cache';
    state.source = 'cache';
    state.updatedAt = snap.savedAt ? new Date(snap.savedAt) : new Date();
    return true;
  } catch (_) {
    return false;
  }
}

function showBanner(kind, title, detail) {
  $('#banner').innerHTML = `<div class="banner ${kind === 'error' ? 'error' : ''}">
      <div><strong>${title}</strong><br>${detail}</div></div>`;
}

function load(isRefetch) {
  if (isRefetch) $('#content').classList.add('stale');

  const finish = () => {
    $('#content').classList.remove('stale');
    render();
    debugPanel({
      source: state.source,
      mode: state.mode,
      unitCount: state.units.length,
      summary: state.meta.summary || {},
      diagnostics: state.diagnostics || null,
    });

    const diff = reconcile();
    if (diff && state.source !== 'cache') {
      showBanner('info', 'Data terbaca, tetapi jumlahnya berbeda dengan KPI Google Sheet.',
        `${escapeHtml(diff.join(' · '))}. Buka URL dengan <code>?debug=1</code> untuk melihat diagnostic.`);
    }
  };

  const fetchText = (url) => fetch(url, { cache: 'no-store' })
    .then((r) => {
      if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
      return r.text();
    });

  /*
   * Prioritas 1: Published HTML, karena membawa warna cell.
   * Prioritas 2: CSV sebagai fallback apabila sheet suatu saat diubah
   * menjadi tabel dengan kolom Status berupa teks.
   */
  return fetchText(CONFIG.SHEET_HTML_URL)
    .then((html) => {
      if (!/<table[\s>]/i.test(html)) {
        throw new Error('/sheet-html tidak mengembalikan tabel Google Sheets.');
      }
      const parsed = parsePublishedHtml(html);
      applyParsed(parsed, 'sheet-html');
      $('#banner').innerHTML = '';
    })
    .catch((htmlErr) => {
      console.warn('Published HTML gagal:', htmlErr);

      return fetchText(CONFIG.SHEET_CSV_URL)
        .then((csv) => {
          if (/^\s*</.test(csv) || /<html/i.test(csv.slice(0, 400))) {
            throw new Error('/sheet-csv mengembalikan HTML, bukan CSV.');
          }
          const parsed = rowsToUnits(parseCsv(csv));
          applyParsed(parsed, 'sheet-csv');
          $('#banner').innerHTML = '';
        })
        .catch((csvErr) => {
          console.error('CSV fallback gagal:', csvErr);

          const restored = restoreLastGood();
          state.source = restored ? 'cache' : 'error';
          state.diagnostics = {
            htmlError: htmlErr.message,
            htmlDiagnostics: htmlErr.diagnostics || null,
            csvError: csvErr.message,
          };

          if (restored) {
            showBanner('error', 'Google Sheets belum bisa dibaca — menampilkan data terakhir yang pernah berhasil.',
              `${escapeHtml(htmlErr.message)} · fallback CSV: ${escapeHtml(csvErr.message)}. ` +
              `Tambahkan <code>?debug=1</code> pada URL untuk diagnostic.`);
          } else {
            showBanner('error', 'Google Sheets belum bisa dibaca.',
              `${escapeHtml(htmlErr.message)} · fallback CSV: ${escapeHtml(csvErr.message)}. ` +
              `Tambahkan <code>?debug=1</code> pada URL untuk diagnostic.`);
          }
        });
    })
    .then(finish);
}

/* ---------- ikat events ---------- */

function bind() {
  $('#f-site').addEventListener('change', (e) => { state.filter.site = e.target.value; render(); });
  $('#f-status').addEventListener('change', (e) => { state.filter.status = e.target.value; render(); });

  let t = null;
  $('#f-q').addEventListener('input', (e) => {
    clearTimeout(t);
    const value = e.target.value;
    t = setTimeout(() => { state.filter.q = value; render(); }, 160);
  });

  $('#site-grid').addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-unit-open]');
    if (!trigger) return;
    openUnitDialog(trigger.dataset.unitOpen, trigger);
  });

  $('#btn-reload').addEventListener('click', () => load(true));
  $('#btn-theme').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme || 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('dbu-theme', next); } catch (_) {}
  });

  $('#dialog-close').addEventListener('click', () => $('#unit-dialog').close());
  $('#unit-dialog').addEventListener('click', (e) => {
    if (e.target === $('#unit-dialog')) $('#unit-dialog').close();
  });

  try {
    const saved = localStorage.getItem('dbu-theme');
    if (saved === 'dark' || saved === 'light') document.documentElement.dataset.theme = saved;
  } catch (_) {}

  if (CONFIG.REFRESH_MINUTES > 0) setInterval(() => load(true), CONFIG.REFRESH_MINUTES * 60000);
}

load().then(bind);
