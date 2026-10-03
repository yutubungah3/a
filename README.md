# Daily Breakdown Monitoring v2 — khusus upload/drag-and-drop Netlify

Versi ini **tidak memakai Netlify Functions**. Data Google Sheet diambil melalui Netlify CDN proxy menggunakan file `_redirects`, sehingga lebih cocok untuk deployment manual/drag-and-drop.

## Cara deploy (penting)

1. Extract ZIP ini terlebih dahulu.
2. Pastikan isi folder yang akan di-upload langsung berisi:
   - `index.html`
   - `app.js`
   - `styles.css`
   - `config.js`
   - `_redirects`
   - `netlify.toml`
3. Login ke Netlify.
4. Drag **folder `daily-breakdown-monitoring-v2`**, bukan file ZIP-nya, ke Netlify Drop / manual deploy.
5. Setelah deploy, buka:
   `https://NAMA-SITE.netlify.app/api/sheet`
6. Jika benar, browser akan menampilkan data CSV dari Google Sheet. Setelah itu buka halaman utama site.

Netlify meneruskan query string pada rewrite status 200. Jadi jika Anda mengisi `sheetGid` di `config.js`, nilai `gid` juga akan diteruskan ke Google Sheets.

## Jika tab data bukan tab default

Buka Google Sheet sumber dan lihat URL tab yang benar. Ambil angka setelah `#gid=` lalu isi di `config.js`:

```js
sheetGid: "123456789",
```

Kemudian deploy ulang folder.

## Header data

Format yang paling aman:

`UNIT | SITE | TYPE | STATUS | REMARK | PIC | DATE | FOTO_URL`

Versi v2 juga otomatis mencari baris header dalam 25 baris pertama, jadi judul laporan/tanggal di atas tabel tidak lagi menjadi masalah.

## Tes cepat

- `/api/sheet` menampilkan CSV → koneksi Netlify ↔ Google Sheet OK.
- `/api/sheet` 404 → file `_redirects` tidak ikut ter-deploy. Upload folder yang benar.
- `/api/sheet` error dari Google → periksa `Publish to web` pada Google Sheet.
- CSV muncul tetapi dashboard kosong/salah → isi `sheetGid` dan/atau sesuaikan alias header di `config.js`.
