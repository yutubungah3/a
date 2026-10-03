/*
 * FOTO UNIT
 * =========
 * Isi link foto berdasarkan kode unit. Bisa memakai URL gambar biasa atau
 * link Google Drive yang sudah dibagikan sebagai "Anyone with the link".
 *
 * Contoh:
 * window.UNIT_PHOTOS = {
 *   "FC 002": "https://drive.google.com/file/d/FILE_ID/view?usp=sharing",
 *   "FCBN 05": "https://example.com/foto-fcbn-05.jpg"
 * };
 *
 * Alternatif tanpa mengedit file ini:
 * taruh foto di assets/photos/ dengan nama kode unit menjadi huruf kecil
 * dan spasi diganti tanda minus, misalnya:
 *   FC 002   -> assets/photos/fc-002.jpg
 *   FCBN 05  -> assets/photos/fcbn-05.jpg
 *   CLBA 01  -> assets/photos/clba-01.jpg
 */
window.UNIT_PHOTOS = window.UNIT_PHOTOS || {};
