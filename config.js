/*
  DAILY BREAKDOWN UNIT - KONFIGURASI

  1) URL utama di bawah ini sudah memakai link publish Google Sheet yang Anda kirim.
  2) Untuk beberapa tab/sheet, buka Google Sheets > File > Share > Publish to web,
     pilih tab yang ingin dipublish, pilih CSV, lalu salin link CSV-nya.
  3) Tempel link CSV masing-masing tab di unitsCsvUrl, employeesCsvUrl, dan settingsCsvUrl.
*/

window.APP_CONFIG = {
  appName: "Daily Breakdown Unit",
  companyName: "Mining Operation Dashboard",

  // Data unit utama. Link ini mengambil sheet/tab pertama dari publish link Anda.
  unitsCsvUrl:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSod7Mdzh3NW4a8uyA1cXEF51Clo-8I1KapKosN5-XgOyqXMWYoQ31_vdM53RhGJn_s6m8ETxNeTjqi/pub?output=csv",

  // Isi setelah Anda membuat tab Karyawan dan publish sebagai CSV.
  employeesCsvUrl: "",

  // Opsional: tab Settings untuk logo, background, nama perusahaan, judul dashboard.
  // Format sheet Settings: Key | Value
  settingsCsvUrl: "",

  // Bisa diisi manual kalau belum memakai tab Settings.
  logoLeftUrl: "",
  logoRightUrl: "",
  backgroundImageUrl: "",
  footerText: "Daily Breakdown Unit • Google Spreadsheet + Netlify",

  // Refresh otomatis data dari spreadsheet. 300 detik = 5 menit.
  refreshIntervalSeconds: 300,

  // Status yang dihitung di kartu ringkasan.
  statusAliases: {
    running: ["running", "run", "operasi", "operation", "working"],
    standby: ["standby", "stand by", "ready", "idle", "waiting", "parkir"],
    breakdown: ["breakdown", "bd", "rusak", "repair", "service", "maintenance"]
  }
};
