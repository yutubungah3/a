# Daily Breakdown Unit – Netlify v3

Versi ini dibuat khusus untuk Google Sheet yang berbentuk **dashboard visual**, bukan tabel database.

## Perubahan penting v3

- Membaca `pubhtml` Google Sheets secara langsung melalui Netlify proxy.
- Mendeteksi blok `PORT ...` sebagai site.
- Mendeteksi kode unit seperti `FC 002`, `FCBIN 01`, `CLBA 01`, `FCBN 05`, dll.
- Membaca warna sel di samping unit sebagai status:
  - Hijau = RUNNING
  - Merah = BREAKDOWN
  - Oranye = MAINTENANCE
  - Abu-abu = STANDBY
- Mengambil foto yang sudah ada di dashboard Google Sheet bila URL gambarnya tersedia pada HTML published.
- Mencoba membaca KPI dan Breakdown Report langsung dari layout Sheet.
- Auto refresh setiap 60 detik.
- Jika tab default tidak berisi unit, parser mencoba mendeteksi tab/gid lain dari published workbook.

## Cara deploy manual di Netlify

1. Extract `daily-breakdown-monitoring-v3.zip`.
2. Drag **isi folder hasil extract** ke Netlify Drop / Deploy manually.
3. Pastikan file `_redirects` berada sejajar dengan `index.html`.
4. Setelah deploy, buka:

   `https://NAMA-SITE.netlify.app/sheet-html`

   Jika terlihat halaman/table Google Sheet, proxy sudah bekerja.
5. Buka halaman utama website.

## Debug bila unit belum muncul

Tambahkan `?debug=1` di belakang URL:

`https://NAMA-SITE.netlify.app/?debug=1`

Di bawah dashboard akan muncul `Parser diagnostic` yang berisi site, unit, cell yang terbaca, dan tab/gid yang dicoba. Kirim bagian ini jika masih ada kode unit tertentu yang belum terdeteksi.

## Memaksa GID tab tertentu

Jika Anda tahu GID tab yang berisi dashboard, buka `config.js`:

```js
sheetGid: "123456789",
```

Jika kosong, parser mencoba tab default dan mencari tab lain secara otomatis bila unit belum ditemukan.

## Logo perusahaan dan sertifikasi

Simpan logo ke folder `assets`, misalnya:

- `assets/logo-company.png`
- `assets/logo-cert.png`

Kemudian ubah `config.js`:

```js
companyLogo: "assets/logo-company.png",
certificationLogo: "assets/logo-cert.png"
```

## Foto site / unit

Versi v3 akan mencoba menggunakan foto yang sudah ditampilkan di Google Sheet published. Bila Google tidak mengekspor URL foto pada HTML published, website menampilkan placeholder. Dalam kondisi itu foto bisa dibuat lebih stabil dengan kolom/link gambar khusus, tetapi tidak diperlukan untuk deteksi unit/status.
