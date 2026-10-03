/**
 * DAILY BREAKDOWN UNIT — Google Apps Script data bridge
 * -----------------------------------------------------
 * Pasang script ini dari spreadsheet ASLI:
 * Extensions > Apps Script > Code.gs
 *
 * Script membaca nilai + warna sel secara langsung sehingga status yang
 * ditandai hijau / merah / abu-abu / oranye tetap terbaca oleh website.
 */

const DBU = {
  // Kosongkan agar script mencari tab dashboard secara otomatis.
  // Jika perlu, isi persis nama tab, contoh: 'DAILY BREAKDOWN'.
  SHEET_NAME: '',

  // Jika dashboard sangat lebar/panjang, batas ini mencegah payload berlebihan.
  MAX_ROWS: 200,
  MAX_COLS: 80,

  EXCLUDED_PREFIXES: ['UNIT','ISO','EST','SHF','SHIFT','PORT','TOTAL','BY','DAY','NO','TGL'],

  // Opsional: foto site (URL publik). Bisa juga dibiarkan kosong dan diatur di config.js Netlify.
  SITE_PHOTOS: {
    // 'PORT SEJIDUA': 'https://drive.google.com/file/d/FILE_ID/view?usp=sharing',
  }
};

function doGet(e) {
  try {
    const data = buildDashboardData_();
    return output_(data, e);
  } catch (err) {
    return output_({
      ok: false,
      error: String(err && err.message ? err.message : err),
      stack: String(err && err.stack ? err.stack : '')
    }, e);
  }
}

function output_(payload, e) {
  const json = JSON.stringify(payload);
  const callback = e && e.parameter ? String(e.parameter.callback || '') : '';
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback)) {
    return ContentService
      .createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function buildDashboardData_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Spreadsheet aktif tidak ditemukan. Pasang script ini dari Extensions > Apps Script pada file Google Sheet asli.');

  const sheet = findDashboardSheet_(ss);
  if (!sheet) throw new Error('Tab DAILY BREAKDOWN tidak ditemukan. Isi DBU.SHEET_NAME dengan nama tab dashboard yang benar.');

  const lastRow = Math.min(Math.max(sheet.getLastRow(), 1), DBU.MAX_ROWS);
  const lastCol = Math.min(Math.max(sheet.getLastColumn(), 1), DBU.MAX_COLS);
  const range = sheet.getRange(1, 1, lastRow, lastCol);
  const values = range.getDisplayValues();
  const colors = range.getBackgrounds();
  const formulas = range.getFormulas();
  const merges = range.getMergedRanges().map(r => ({
    row: r.getRow(), col: r.getColumn(),
    rowEnd: r.getLastRow(), colEnd: r.getLastColumn()
  }));

  const headers = findSiteHeaders_(values, merges);
  const reportHeader = findCell_(values, /BREAKDOWN\s+REPORT/i, merges);
  const sites = headers.map((h, i) => extractSite_(sheet, values, colors, formulas, merges, headers, reportHeader, h, i));
  const units = sites.reduce((arr, s) => arr.concat(s.units), []);
  const kpis = extractKpis_(values, merges, units);
  const report = extractReport_(values, merges, reportHeader, headers);
  const date = findDate_(values);

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    spreadsheetName: ss.getName(),
    sheetName: sheet.getName(),
    date: date || 'Live dari Google Sheets',
    kpis: kpis,
    sites: sites,
    report: report,
    debug: {
      spreadsheetName: ss.getName(),
      sheetName: sheet.getName(),
      dimensions: { rows:lastRow, cols:lastCol },
      siteHeaders: headers,
      reportHeader: reportHeader,
      unitCount: units.length,
      detectedUnits: sites.map(s => ({ site:s.name, units:s.units })),
      kpis: kpis,
      report: report
    }
  };
}

function findDashboardSheet_(ss) {
  if (DBU.SHEET_NAME) {
    const exact = ss.getSheetByName(DBU.SHEET_NAME);
    if (exact) return exact;
  }

  const sheets = ss.getSheets();
  let best = null;
  let bestScore = -1;
  sheets.forEach(sheet => {
    const rows = Math.min(Math.max(sheet.getLastRow(), 1), 80);
    const cols = Math.min(Math.max(sheet.getLastColumn(), 1), 40);
    const v = sheet.getRange(1,1,rows,cols).getDisplayValues();
    let score = 0;
    for (let r=0;r<v.length;r++) {
      for (let c=0;c<v[r].length;c++) {
        const t = norm_(v[r][c]).toUpperCase();
        if (!t) continue;
        if (t.indexOf('DAILY BREAKDOWN UNIT') >= 0) score += 100;
        if (t === 'TOTAL UNIT') score += 20;
        if (/^PORT\s+/.test(t)) score += 8;
        if (t.indexOf('BREAKDOWN REPORT') >= 0) score += 20;
      }
    }
    if (score > bestScore) { bestScore=score; best=sheet; }
  });
  return bestScore > 0 ? best : sheets[0];
}

function findSiteHeaders_(values, merges) {
  const out=[];
  for(let r=0;r<values.length;r++){
    for(let c=0;c<values[r].length;c++){
      const t=norm_(values[r][c]);
      if(/^PORT\s+/i.test(t) && t.length<80){
        const span=spanFor_(r+1,c+1,merges);
        out.push({ name:t, row:r+1, col:c+1, rowEnd:span.rowEnd, colEnd:span.colEnd });
      }
    }
  }
  return out.sort((a,b)=>a.row-b.row || a.col-b.col);
}

function extractSite_(sheet, values, colors, formulas, merges, headers, reportHeader, header, index) {
  let endRow = values.length;
  const blockers = headers.concat(reportHeader ? [reportHeader] : []);
  blockers.forEach(b => {
    if (b.row > header.row && overlaps_(header.col, header.colEnd, b.col, b.colEnd)) endRow = Math.min(endRow, b.row-1);
  });

  const units=[];
  const seen={};
  for(let r=header.row;r<=endRow;r++){
    for(let c=header.col;c<=Math.min(header.colEnd, values[0].length);c++){
      const codes=unitCodes_(values[r-1][c-1]);
      codes.forEach(code=>{
        if(seen[code]) return;
        const status = findStatusNear_(colors, r, c, header.col, header.colEnd, header.row+1, endRow);
        units.push({ code:code, status:status.status, color:status.color, row:r, col:c });
        seen[code]=true;
      });
    }
  }
  units.sort((a,b)=>a.row-b.row || a.col-b.col);

  let photo='';
  outer:
  for(let r=header.row;r<=endRow;r++){
    for(let c=header.col;c<=Math.min(header.colEnd, formulas[0].length);c++){
      const f=formulas[r-1][c-1] || '';
      const m=f.match(/=IMAGE\(\s*["']([^"']+)["']/i);
      if(m){ photo=m[1]; break outer; }
    }
  }
  if (!photo && DBU.SITE_PHOTOS[header.name]) photo=DBU.SITE_PHOTOS[header.name];

  return {
    name:header.name,
    headerColor:colorAt_(colors, header.row, header.col) || siteFallbackColor_(index),
    photo:photo,
    units:units
  };
}

function findStatusNear_(colors, row, col, regionCol1, regionCol2, regionRow1, regionRow2) {
  const candidates=[];
  for(let dr=-1;dr<=1;dr++){
    const rr=row+dr;
    if(rr<regionRow1 || rr>regionRow2) continue;
    for(let dc=-3;dc<=3;dc++){
      if(dc===0 && dr===0) continue;
      const cc=col+dc;
      if(cc<regionCol1 || cc>regionCol2) continue;
      const color=colorAt_(colors,rr,cc);
      const status=statusFromColor_(color);
      if(status){
        const score=Math.abs(dc)*10 + Math.abs(dr)*25 + (dc<0?4:0);
        candidates.push({status:status,color:color,score:score});
      }
    }
  }
  candidates.sort((a,b)=>a.score-b.score);
  return candidates[0] || {status:'UNKNOWN',color:''};
}

function statusFromColor_(hex) {
  const rgb=hexToRgb_(hex);
  if(!rgb) return '';
  const r=rgb.r,g=rgb.g,b=rgb.b;
  const max=Math.max(r,g,b), min=Math.min(r,g,b), spread=max-min, avg=(r+g+b)/3;
  if(r>238 && g>238 && b>238) return '';
  if(g>=135 && g>r*1.22 && g>b*1.08) return 'RUNNING';
  if(r>=185 && r>g*1.35 && r>b*1.28) return 'BREAKDOWN';
  if(r>=185 && g>=70 && g<=190 && b<=130 && r>g) return 'MAINTENANCE';
  if(avg>=95 && avg<=215 && (spread<=48 || (b>=g && g>=r && b-r<=70))) return 'STANDBY';
  return '';
}

function extractKpis_(values, merges, units) {
  const counts={RUNNING:0,STANDBY:0,BREAKDOWN:0,MAINTENANCE:0,UNKNOWN:0};
  units.forEach(u=>counts[u.status in counts ? u.status : 'UNKNOWN']++);

  const totalText=findMetric_(values, merges, /^TOTAL\s+UNIT$/i);
  const runningText=findMetric_(values, merges, /^RUNNING$/i);
  const standbyText=findMetric_(values, merges, /^STANDBY$/i);
  const breakdownText=findMetric_(values, merges, /^BREAKDOWN$/i);
  let availability=findMetric_(values, merges, /^AVAILABILITY$/i);

  const total=metricNumber_(totalText) || units.length;
  const running=metricNumber_(runningText);
  const standby=metricNumber_(standbyText);
  const breakdown=metricNumber_(breakdownText);
  if(!availability && total){ availability=((counts.RUNNING+counts.STANDBY)/total*100).toFixed(1)+'%'; }

  return {
    total: total || units.length,
    running: runningText !== '' ? running : counts.RUNNING,
    standby: standbyText !== '' ? standby : counts.STANDBY,
    breakdown: breakdownText !== '' ? breakdown : counts.BREAKDOWN,
    availability: availability ? normalizePercent_(availability) : '—',
    calculated: counts
  };
}

function findMetric_(values, merges, regex) {
  for(let r=0;r<values.length;r++){
    for(let c=0;c<values[r].length;c++){
      if(regex.test(norm_(values[r][c]))){
        const span=spanFor_(r+1,c+1,merges);
        for(let rr=r+1;rr<Math.min(values.length,r+6);rr++){
          for(let cc=c;cc<Math.min(values[rr].length,span.colEnd);cc++){
            const t=norm_(values[rr][cc]);
            if(/^\d+(?:[.,]\d+)?\s*%?$/.test(t)) return t;
          }
        }
      }
    }
  }
  return '';
}

function extractReport_(values, merges, reportHeader, headers) {
  if(!reportHeader) return [];
  let endRow=values.length;
  headers.forEach(h=>{
    if(h.row>reportHeader.row && overlaps_(reportHeader.col,reportHeader.colEnd,h.col,h.colEnd)) endRow=Math.min(endRow,h.row-1);
  });
  const lines=[];
  const seen={};
  for(let r=reportHeader.row;r<=endRow;r++){
    const parts=[];
    for(let c=reportHeader.col;c<=Math.min(reportHeader.colEnd,values[r-1].length);c++){
      const t=norm_(values[r-1][c-1]);
      if(t && !/BREAKDOWN\s+REPORT|UNIT\s*&?\s*PEKERJAAN|PEKERJAAN\s+PERBAIKAN/i.test(t)) parts.push(t);
    }
    const line=parts.join(' — ');
    if(line && line.length>4 && !seen[line]){ seen[line]=true; lines.push(line); }
  }
  return lines.slice(0,30);
}

function findDate_(values) {
  const month=/(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|january|february|march|may|june|july|august|october|december)/i;
  for(let r=0;r<values.length;r++) for(let c=0;c<values[r].length;c++){
    const t=norm_(values[r][c]);
    if(month.test(t) && /\b20\d{2}\b/.test(t)) return t;
  }
  return '';
}

function findCell_(values, regex, merges) {
  for(let r=0;r<values.length;r++) for(let c=0;c<values[r].length;c++){
    const t=norm_(values[r][c]);
    if(regex.test(t)){
      const s=spanFor_(r+1,c+1,merges);
      return {name:t,row:r+1,col:c+1,rowEnd:s.rowEnd,colEnd:s.colEnd};
    }
  }
  return null;
}

function unitCodes_(text) {
  const upper=norm_(text).toUpperCase();
  const re=/\b([A-Z]{2,7})\s*-?\s*(\d{1,3})\b/g;
  const out=[]; let m;
  while((m=re.exec(upper))){
    if(DBU.EXCLUDED_PREFIXES.indexOf(m[1])>=0) continue;
    const code=(m[1]+' '+m[2]).replace(/\s+/g,' ').trim();
    if(out.indexOf(code)<0) out.push(code);
  }
  return out;
}

function spanFor_(row,col,merges) {
  for(let i=0;i<merges.length;i++){
    const m=merges[i];
    if(row>=m.row && row<=m.rowEnd && col>=m.col && col<=m.colEnd) return m;
  }
  return {row:row,col:col,rowEnd:row,colEnd:col};
}

function overlaps_(a1,a2,b1,b2){ return Math.max(a1,b1) <= Math.min(a2,b2); }
function norm_(v){ return String(v==null?'':v).replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim(); }
function colorAt_(colors,row,col){ return (colors[row-1] && colors[row-1][col-1]) ? String(colors[row-1][col-1]).toLowerCase() : ''; }
function hexToRgb_(hex){ const m=String(hex||'').match(/^#([0-9a-f]{6})$/i); if(!m)return null; const h=m[1]; return {r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16)}; }
function metricNumber_(v){ const n=parseFloat(String(v||'').replace(',','.').replace(/[^0-9.]/g,'')); return isNaN(n)?0:n; }
function normalizePercent_(v){ const s=norm_(v).replace('.',','); return /%$/.test(s)?s:s+'%'; }
function siteFallbackColor_(i){ return ['#123e62','#1984d6','#12a99c','#4b43df','#dc7700','#0f6f7e'][i%6]; }
