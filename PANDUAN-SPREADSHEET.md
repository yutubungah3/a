# Daily Breakdown Unit — V5

Versi ini mempertahankan pembacaan Google Sheet yang sudah berhasil mendeteksi 35 unit, tetapi UI diubah menjadi dashboard kartu per site.

## Status
Website hanya menampilkan 3 status unit:

- **Running**
- **Standby**
- **Breakdown**

Jika spreadsheet berisi `Maintenance`, `Service`, `Perawatan`, `Repair`, `PM`, atau warna indikator oranye/kuning, website otomatis memasukkannya sebagai **Breakdown**.

Availability dihitung sebagai:

`(Running + Standby) / Total Unit × 100%`

## Menambahkan foto unit — cara termudah

1. Buka folder `assets/photos/`.
2. Masukkan foto unit dalam JPG.
3. Ubah nama file mengikuti kode unit: huruf kecil dan spasi menjadi tanda minus.

Contoh:

- `FC 002` → `assets/photos/fc-002.jpg`
- `FC 005` → `assets/photos/fc-005.jpg`
- `FCBIN 01` → `assets/photos/fcbin-01.jpg`
- `CLBA 01` → `assets/photos/clba-01.jpg`
- `FCBN 05` → `assets/photos/fcbn-05.jpg`

Website juga mencoba file `.png` dan `.webp` dengan pola nama yang sama.

Setelah foto ditambahkan, deploy ulang folder ke Netlify. Tidak perlu mengubah `app.js`.

## Menambahkan foto dari Google Drive

Jika ingin memakai foto dari Google Drive, buka:

`assets/js/unit-photos.js`

Isi seperti berikut:

```js
window.UNIT_PHOTOS = {
  "FC 002": "https://drive.google.com/file/d/FILE_ID/view?usp=sharing",
  "FCBN 05": "https://drive.google.com/file/d/FILE_ID/view?usp=sharing"
};
```

Untuk setiap foto Drive:

1. Upload foto ke Google Drive.
2. Klik **Share / Bagikan**.
3. Pada **General access**, pilih **Anyone with the link / Siapa saja yang memiliki link**.
4. Copy link dan paste ke `unit-photos.js` sesuai kode unit.
5. Deploy ulang ke Netlify.

Link Drive akan diubah otomatis menjadi URL thumbnail oleh website.

## Jika nanti spreadsheet dibuat tabel

Parser tabel juga sudah mengenali kolom foto bernama salah satu dari:

- `FOTO`
- `FOTO UNIT`
- `PHOTO`
- `IMAGE`
- `IMAGE URL`
- `FOTO URL`
- `PHOTO URL`

Jadi bila suatu saat data unit dipindahkan ke format tabel, foto juga dapat dibaca dari kolom tersebut.

## Deploy ke Netlify

Extract ZIP, lalu deploy folder yang berisi langsung:

- `index.html`
- `_redirects`
- `netlify.toml`
- folder `assets`

Google Sheet tetap menjadi sumber status unit. Foto lokal berubah hanya saat project dideploy ulang.

## Diagnostic

Buka website dengan `?debug=1` bila ingin melihat parser diagnostic, misalnya:

`https://nama-site.netlify.app/?debug=1`
