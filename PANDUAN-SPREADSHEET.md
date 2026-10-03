# Daily Breakdown Unit — versi diperbaiki dari project awal

Versi ini mempertahankan tampilan project awal dan memperbaiki cara membaca Google Sheet.

## Kenapa versi lama tidak mendeteksi unit

Project awal membaca URL CSV. CSV hanya membawa teks/angka, sedangkan dashboard Google Sheet Anda memakai warna cell sebagai indikator status. Karena warna hilang saat diekspor ke CSV, parser lama tidak menemukan RUNNING / STANDBY / BREAKDOWN.

Versi ini membaca halaman `Publish to web` (`pubhtml`) melalui proxy Netlify, lalu membaca:

- nama site seperti `PORT SEJIDUA`, `PORT BATAM`, dll.;
- kode unit seperti `FC 002`, `FCBIN 01`, `FCBK 01`, `FCBE 01`, `FCBN 05`, dll.;
- warna cell di sebelah kode unit;
- merah = Breakdown;
- hijau = Running;
- abu-abu / biru abu-abu = Standby;
- oranye / kuning = Maintenance;
- Breakdown Report untuk melengkapi keterangan unit.

Tidak perlu membuat tab `WEB_DATA` dan tidak perlu memasang Apps Script.

## Deploy ke Netlify

1. Extract ZIP.
2. Pastikan `index.html`, `_redirects`, `netlify.toml`, folder `assets`, dan file ini berada dalam satu folder utama.
3. Drag folder utama tersebut ke Netlify Deploys.
4. Setelah deploy, buka website seperti biasa.

Netlify akan mem-proxy dua alamat:

- `/sheet-html` → halaman Publish to web yang mempertahankan formatting/warna.
- `/sheet-csv` → CSV sebagai fallback.

## Tes koneksi

Setelah deploy, buka:

`https://NAMA-SITE.netlify.app/sheet-html`

Jika berhasil, akan terlihat halaman/tabel Google Sheet.

Lalu buka:

`https://NAMA-SITE.netlify.app/?debug=1`

Di bagian paling bawah akan muncul diagnostic berisi:

- jumlah tabel yang ditemukan;
- nama site yang terdeteksi;
- jumlah kandidat unit;
- berapa status yang berhasil dibaca dari warna;
- warna CSS yang ditemukan;
- unit yang belum memiliki status.

Mode debug ini dibuat khusus agar jika ada satu warna Google yang belum masuk klasifikasi, warna persisnya bisa langsung diketahui dan ditambahkan tanpa mengubah struktur spreadsheet.

## Update harian

Admin site tetap mengubah Google Sheet yang sama. Website melakukan refresh setiap 5 menit dan tombol **Muat ulang** dapat dipakai untuk memaksa pembacaan ulang.

## Foto unit/site

Project ini sengaja belum mengubah bagian foto agar perbaikan fokus ke masalah deteksi data. Setelah unit dan status sudah terbaca benar, foto dapat ditambahkan tanpa mengubah mekanisme status.
