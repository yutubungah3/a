# Daily Breakdown Unit v4 — Netlify + Google Sheets

Versi ini sengaja **tidak membaca `pubhtml`**. Google Sheet Anda menggunakan warna sel sebagai status unit, sehingga cara yang paling stabil adalah membaca **nilai dan background cell langsung** dengan Google Apps Script.

## 1. Pasang Apps Script di spreadsheet ASLI

1. Buka Google Spreadsheet asli (bukan halaman `pubhtml`).
2. Pilih **Extensions / Ekstensi → Apps Script**.
3. Hapus isi `Code.gs` bawaan.
4. Copy seluruh isi file `apps-script/Code.gs` dari paket ini.
5. Paste ke Apps Script lalu **Save**.
6. Dari dropdown fungsi di toolbar Apps Script, pilih `buildDashboardData_` lalu klik **Run** satu kali.
7. Google akan meminta izin membaca spreadsheet. Setujui izin untuk spreadsheet ini.

> Script hanya membaca nilai, warna sel, formula IMAGE, dan struktur sheet. Ia tidak mengubah data unit.

## 2. Deploy Apps Script sebagai Web App

1. Klik **Deploy → New deployment**.
2. Klik ikon gear / Select type → **Web app**.
3. Description: `Daily Breakdown API`.
4. **Execute as:** Me / saya (pemilik script).
5. **Who has access:** Anyone / siapa saja yang memiliki akses ke web app. Pada beberapa akun tertulis `Anyone` atau `Anyone, even anonymous`.
6. Klik **Deploy**.
7. Copy **Web app URL** yang berakhir dengan `/exec`.

Contoh:

`https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxx/exec`

Jangan gunakan URL `/dev` karena itu hanya untuk test deployment.

## 3. Tempel URL ke website

Buka `config.js` dan isi:

```js
appsScriptUrl: "https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxx/exec",
```

Simpan file.

## 4. Upload ke Netlify

Upload/drag seluruh isi folder `daily-breakdown-monitoring-v4` ke Netlify. Versi ini **murni static site**, tidak membutuhkan Netlify Function dan tidak membutuhkan `_redirects`.

Jika sebelumnya memakai v3, lakukan deploy baru dari folder v4 hasil extract.

## 5. Status unit

Apps Script membaca warna background di dekat kode unit:

- Hijau → `RUNNING`
- Merah → `BREAKDOWN`
- Abu-abu / blue-gray → `STANDBY`
- Oranye → `MAINTENANCE`

Kode seperti `FC 002`, `CL 001`, `FCBIN 01`, `CLBIN 01`, `FCBK 01`, `FCBE 01`, `FCBN 05`, dll dideteksi otomatis.

Script juga mencari blok yang judulnya dimulai `PORT ` dan bagian `BREAKDOWN REPORT`.

## 6. Jika tab dashboard tidak otomatis ditemukan

Di `apps-script/Code.gs`, ubah:

```js
SHEET_NAME: '',
```

menjadi nama tab persis, contoh:

```js
SHEET_NAME: 'DAILY BREAKDOWN',
```

Setelah mengubah Code.gs, lakukan **Deploy → Manage deployments → Edit → New version → Deploy**. URL `/exec` tetap dapat digunakan.

## 7. Debug

Setelah website live, buka:

`https://nama-site.netlify.app/?debug=1`

Bagian `Diagnostic data` akan memperlihatkan:

- nama spreadsheet dan tab yang dibaca;
- jumlah baris/kolom;
- header PORT yang ditemukan;
- semua unit + status hasil deteksi;
- KPI;
- Breakdown Report.

Ini jauh lebih mudah diperbaiki daripada parser HTML karena kita melihat data Google Sheets yang sebenarnya.

## 8. Menambahkan foto site

Cara paling sederhana:

1. Upload foto ke Google Drive.
2. Share → `Anyone with the link` sebagai Viewer jika foto memang boleh ditampilkan pada website.
3. Copy link Drive.
4. Di `config.js`, tambahkan:

```js
sitePhotos: {
  "PORT SEJIDUA": "https://drive.google.com/file/d/FILE_ID/view?usp=sharing",
  "PORT BCMP SERONGGA": "https://drive.google.com/file/d/FILE_ID/view?usp=sharing",
  "PORT BATAM": "https://drive.google.com/file/d/FILE_ID/view?usp=sharing",
  "PORT BATU ENGAU": "https://drive.google.com/file/d/FILE_ID/view?usp=sharing",
  "PORT BUNATI": "https://drive.google.com/file/d/FILE_ID/view?usp=sharing"
}
```

Website otomatis mengubah link Google Drive tersebut menjadi thumbnail.

Alternatif: jika foto dalam spreadsheet menggunakan formula `=IMAGE("https://...")`, script akan mencoba mengambil URL tersebut otomatis.

## 9. Update otomatis

Admin tetap mengedit Google Sheet seperti biasa. Website meminta data baru setiap 60 detik. Untuk mengubah interval, edit `refreshMs` di `config.js`.

## Kenapa v4 lebih stabil?

`pubhtml` ditujukan untuk menampilkan spreadsheet. Struktur HTML/class CSS Google dapat berubah dan status warna tidak selalu mudah dipetakan. Apps Script menggunakan API Spreadsheet (`getDisplayValues()` dan `getBackgrounds()`), sehingga website menerima nilai dan warna cell langsung dari file aslinya.
