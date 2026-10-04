# Daily Breakdown Monitoring V6.2

Perbaikan V6.2: `?debug=photos` kini khusus menampilkan diagnostic foto per unit dan tidak lagi tertukar dengan diagnostic data spreadsheet.

# Daily Breakdown Monitoring V5

Versi UI baru berdasarkan project yang sudah berhasil membaca 35 unit dari Google Sheet.

## Perubahan utama
- UI dashboard modern dan responsive.
- Hanya 3 status: Running, Standby, Breakdown.
- Maintenance / Service / Repair / PM otomatis dihitung sebagai Breakdown.
- Kartu unit dikelompokkan per site.
- Breakdown Report khusus.
- Foto per unit dengan preview modal.
- Foto bisa dari folder lokal atau Google Drive.
- Parser Google Sheet lama tetap dipertahankan karena sudah berhasil membaca 35 unit.

Lihat `PANDUAN-SPREADSHEET.md` untuk petunjuk foto dan deployment.

## Perbaikan foto pada V6

V6 memperbaiki pemuatan foto lokal dan Google Drive. Lihat `PANDUAN-FOTO.md`.

Disarankan menggunakan mapping eksplisit di `assets/js/unit-photos.js`, contoh:

```js
window.UNIT_PHOTOS = {
  "FC 002": "assets/photos/FC 002.JPG",
  "FCBN 05": "https://drive.google.com/file/d/FILE_ID/view?usp=sharing"
};
```

Untuk diagnostic foto buka `/?debug=photos`.
