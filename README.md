# Daily Breakdown Monitoring — Netlify + Google Sheets

Starter dashboard untuk monitoring daily breakdown unit pertambangan. Admin tetap mengedit Google Sheets; website membaca versi Published-to-web dan refresh otomatis.

## 1. Struktur kolom yang disarankan

Dashboard bisa mencoba mengenali beberapa variasi nama header, tetapi format paling aman adalah:

| UNIT | SITE | TYPE | STATUS | REMARK | PIC | DATE | FOTO_URL |
|---|---|---|---|---|---|---|---|
| DT-001 | Site A | Dump Truck | BREAKDOWN | Engine overheat | Budi | 03/10/2026 14:00 | link foto |

Kolom minimal yang sangat disarankan: `UNIT`, `SITE`, `STATUS`, `REMARK`. Kolom lain opsional.

Jika header Sheet Anda berbeda, edit alias di `config.js` pada bagian `fields`.

## 2. Google Sheet

Spreadsheet published yang sudah dipasang sebagai default:

`2PACX-1vSod7Mdzh3NW4a8uyA1cXEF51Clo-8I1KapKosN5-XgOyqXMWYoQ31_vdM53RhGJn_s6m8ETxNeTjqi`

Pastikan:

1. Buka Google Sheet sumber.
2. File → Share/Bagikan → Publish to web/Publikasikan ke web.
3. Pastikan **Automatically republish when changes are made** aktif.
4. Jika hanya satu tab yang dipakai, publikasikan tab tersebut atau isi `sheetGid` di `config.js`.

Catatan: Published-to-web dapat memiliki jeda beberapa menit setelah admin mengedit sheet.

## 3. Menentukan GID tab Sheet

Buka tab yang ingin dipakai di Google Sheets. Di URL edit biasanya ada bagian:

`#gid=123456789`

Isi angka itu ke:

```js
sheetGid: "123456789",
```

di `config.js`.

Jika `sheetGid` dikosongkan, endpoint published default yang akan dibaca.

## 4. Foto per unit — cara termudah dengan Google Drive

1. Buat folder Drive, misalnya `FOTO UNIT`.
2. Upload foto dengan nama yang jelas, misalnya `DT-001.jpg`.
3. Klik kanan foto → **Share/Bagikan**.
4. Pada **General access/Akses umum**, pilih **Anyone with the link/Siapa saja yang memiliki link** dan role **Viewer/Pelihat**.
5. Copy link biasa, misalnya:
   `https://drive.google.com/file/d/1AbCdEf.../view?usp=sharing`
6. Paste link tersebut ke kolom `FOTO_URL` pada baris unit yang sesuai.

Website otomatis mengubah link share Google Drive menjadi link thumbnail untuk ditampilkan di card.

Jika kebijakan Google Workspace perusahaan melarang `Anyone with the link`, foto tidak akan tampil di dashboard publik. Gunakan penyimpanan gambar yang memang dapat diakses publik atau buat arsitektur dashboard privat/authenticated.

## 5. Cara deploy yang disarankan — GitHub + Netlify

Metode ini paling mudah untuk update kode website di masa depan.

1. Extract ZIP project.
2. Buat repository GitHub baru.
3. Upload seluruh isi folder project ke repository.
4. Masuk Netlify → **Add new project** → import repository GitHub.
5. Netlify membaca `netlify.toml`; publish directory = `.` dan functions = `netlify/functions`.
6. Deploy.

Tidak perlu menyimpan password atau Google API key karena dashboard membaca feed Published-to-web.

## 6. Deploy manual dengan Netlify CLI

Jika tidak ingin GitHub:

```bash
npm install -g netlify-cli
netlify login
cd daily-breakdown-monitoring
netlify init
netlify deploy --prod
```

Project ini memakai Netlify Function `netlify/functions/sheet.mjs` untuk mengambil CSV dari Google sehingga browser tidak perlu akses langsung ke Google Sheets.

## 7. Update admin otomatis

Alur kerja harian:

`Admin Site → Edit Google Sheet → Google memublikasikan perubahan → Website auto-refresh → Data baru tampil`

Frontend refresh setiap 60 detik. Ubah nilai `refreshMs` di `config.js` jika diperlukan.

## 8. Status KPI

Status diringkas ke 3 kelompok: Breakdown, Ready/Available, dan Maintenance. Edit kata kuncinya di `config.js`:

```js
statusGroups: {
  breakdown: ["breakdown", "bd", "down", "repair"],
  ready: ["ready", "rfu", "available", "running"],
  maintenance: ["maintenance", "mtc", "pm", "service"]
}
```

Sesuaikan dengan istilah yang digunakan perusahaan Anda agar angka KPI tepat.

## 9. Catatan keamanan penting

`Publish to web` berarti data yang dipublikasikan bisa menjadi dapat diakses publik. Jangan masukkan data internal sensitif, data pribadi, password, token, atau informasi yang tidak boleh dilihat publik.

Untuk dashboard internal/rahasia, gunakan versi lanjutan dengan Google Sheets API/Apps Script yang diautentikasi dan proteksi akses di website.
