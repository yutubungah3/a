# Daily Breakdown Unit

Website statis untuk monitoring harian unit pertambangan. Website ini bisa di-upload langsung ke Netlify dan membaca data dari Google Spreadsheet yang sudah dipublish sebagai CSV.

## Isi paket

- `index.html` — halaman utama website.
- `config.js` — tempat mengatur link Google Spreadsheet, logo, background, dan interval refresh.
- `assets/styles.css` — tampilan website.
- `assets/app.js` — logika ambil data spreadsheet, filter, search, dan render kartu.
- `netlify.toml` — konfigurasi publish untuk Netlify.

## Struktur Google Spreadsheet yang disarankan

Buat 3 tab/sheet:

### 1. Tab Unit

Header baris pertama:

| Site | Unit | Jenis | Model | Status | HM | Operator | Tanggal Update | Keterangan | Foto |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Site A | EXC-001 | Excavator | PC200 | Running | 1234 | Budi | 04/10/2026 | Normal | https://... |

Status yang dihitung otomatis:

- `Running`
- `Standby`
- `Breakdown`

Website juga mengenali variasi seperti `BD`, `Rusak`, `Repair`, `Service`, `Run`, `Operasi`, dan `Ready`.

### 2. Tab Karyawan

Header baris pertama:

| Site | Nama | NIK | Jabatan | No HP | Status | Foto |
| --- | --- | --- | --- | --- | --- | --- |
| Site A | Andi | 12345 | Foreman | 0812... | Aktif | https://... |

### 3. Tab Settings, opsional

Header baris pertama:

| Key | Value |
| --- | --- |
| company_name | Nama Perusahaan Anda |
| dashboard_title | Daily Breakdown Unit |
| logo_left_url | https://... |
| logo_right_url | https://... |
| background_url | https://... |
| footer_text | Daily Breakdown Unit • Nama Perusahaan |

## Cara publish Google Sheet sebagai CSV

1. Buka Google Spreadsheet.
2. Pilih `File` > `Share` > `Publish to web`.
3. Pilih tab yang ingin digunakan, misalnya `Unit`.
4. Pilih format `Comma-separated values (.csv)`.
5. Klik `Publish` dan salin link CSV.
6. Ulangi untuk tab `Karyawan` dan `Settings`.
7. Tempel link tersebut ke `config.js`:

```js
window.APP_CONFIG = {
  unitsCsvUrl: "LINK_CSV_TAB_UNIT",
  employeesCsvUrl: "LINK_CSV_TAB_KARYAWAN",
  settingsCsvUrl: "LINK_CSV_TAB_SETTINGS"
};
```

Jika link yang Anda punya masih seperti ini:

```text
https://docs.google.com/spreadsheets/d/e/PUBLIC_ID/pubhtml
```

Biasanya bisa diubah menjadi CSV seperti ini:

```text
https://docs.google.com/spreadsheets/d/e/PUBLIC_ID/pub?output=csv
```

Untuk tab tertentu, formatnya biasanya:

```text
https://docs.google.com/spreadsheets/d/e/PUBLIC_ID/pub?gid=GID_TAB&single=true&output=csv
```

## Cara menambahkan foto unit, foto karyawan, logo, dan background

### Opsi paling mudah: pakai Google Drive

1. Upload foto ke Google Drive.
2. Klik kanan file foto > `Share`.
3. Ubah akses menjadi `Anyone with the link` / `Siapa saja yang memiliki link`.
4. Copy link file.
5. Paste link ke kolom `Foto`, atau ke tab `Settings` untuk logo/background.

Contoh link Google Drive yang bisa ditempel:

```text
https://drive.google.com/file/d/FILE_ID/view?usp=sharing
```

Website akan otomatis mengubah link itu menjadi link gambar yang bisa ditampilkan.

### Opsi lain

Anda juga bisa memakai URL gambar langsung dari hosting lain, misalnya:

```text
https://domain-anda.com/foto/unit-exc-001.jpg
```

## Cara upload ke Netlify

### Cara cepat tanpa GitHub

1. Buka Netlify Drop: `https://app.netlify.com/drop`.
2. Drag folder `daily-breakdown-unit` atau file ZIP paket ini ke halaman Netlify.
3. Netlify akan memberi URL website.
4. Untuk update kode, drag ulang folder/ZIP terbaru ke deploy area site yang sama.

### Cara lebih rapi dengan GitHub

1. Upload folder ini ke repository GitHub.
2. Di Netlify, pilih `Add new project` > `Import from Git`.
3. Pilih repository.
4. Build command dikosongkan.
5. Publish directory isi dengan `.`.
6. Deploy.

## Catatan penting

- Karena website ini membaca Google Sheet yang dipublish ke web, data yang ada di sheet bersifat publik untuk siapa pun yang punya link publish.
- Jangan masukkan data sensitif seperti nomor KTP, rekening, password, atau dokumen pribadi.
- Admin site cukup mengubah data di Google Sheet. Website akan mengambil data terbaru saat halaman dibuka atau saat tombol `Muat Ulang` ditekan.
- Refresh otomatis default adalah 5 menit. Ubah di `config.js` pada `refreshIntervalSeconds`.
