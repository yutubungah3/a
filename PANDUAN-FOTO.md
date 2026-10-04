# Panduan Foto Unit

## Cara yang paling stabil: mapping filename secara eksplisit

1. Masukkan foto ke folder `assets/photos/`.
2. Buka `assets/js/unit-photos.js`.
3. Isi nama unit dan nama file persis seperti file yang Anda upload.

Contoh:

```js
window.UNIT_PHOTOS = {
  "FC 002": "assets/photos/FC 002.JPG",
  "FC 003": "assets/photos/fc-003.jpg",
  "FCBN 05": "assets/photos/FCBN_05.jpeg"
};
```

Dengan cara ini ekstensi `.jpg`, `.jpeg`, `.png`, `.webp` dan huruf besar/kecil tidak menjadi masalah karena filename ditulis persis.

## Tanpa mapping

Jika `unit-photos.js` dikosongkan, website tetap mencoba otomatis beberapa nama umum, misalnya untuk `FC 002`:

- `assets/photos/fc-002.jpg`
- `assets/photos/FC-002.JPG`
- `assets/photos/FC_002.jpeg`
- `assets/photos/FC 002.png`
- dan variasi umum lainnya.

Namun mapping eksplisit tetap lebih aman.

## Google Drive

1. Upload foto ke Google Drive.
2. Klik **Share / Bagikan**.
3. Ubah **General access** menjadi **Anyone with the link / Siapa saja yang memiliki link** dan role **Viewer**.
4. Copy link file, bukan link folder.
5. Masukkan ke `unit-photos.js`:

```js
window.UNIT_PHOTOS = {
  "FC 002": "https://drive.google.com/file/d/FILE_ID/view?usp=sharing"
};
```

Website akan mencoba beberapa endpoint gambar Google Drive secara otomatis.

## Sangat penting untuk Netlify

Netlify bersifat case-sensitive. `FC-002.JPG` berbeda dengan `fc-002.jpg`.

Setelah menambahkan foto atau mengubah `unit-photos.js`, deploy ulang **seluruh folder project** ke Netlify. Jangan hanya mengubah folder lokal tanpa redeploy.

## Diagnostic foto

Buka:

`https://NAMA-SITE.netlify.app/?debug=photos`

Di bagian bawah akan muncul diagnostic per unit. Contoh:

```json
"FC 002": {
  "configured": "assets/photos/FC 002.JPG",
  "status": "loaded",
  "loaded": "https://.../assets/photos/FC%20002.JPG"
}
```

Jika `status` adalah `not-found`, lihat daftar `tried` untuk mengetahui nama/path yang dicoba website.


## Debug foto V6.2
Buka `https://NAMA-SITE.netlify.app/?debug=photos`.
Panel JSON khusus foto akan muncul dekat bagian atas. Untuk setiap unit:
- `status: loaded` berarti foto berhasil.
- `status: not-found` berarti seluruh URL/nama file pada `tried` gagal.
- `configured` menunjukkan nilai dari `assets/js/unit-photos.js`.
- `loaded` menunjukkan URL final yang benar-benar berhasil dipakai browser.

`?debug=1` tetap digunakan untuk diagnostic data Google Sheet, dan tidak lagi bercampur dengan diagnostic foto.
