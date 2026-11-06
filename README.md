# HabitWrite — Latihan Menulis Berbasis Kata Kunci

Aplikasi web PWA (bisa dipasang di ponsel/desktop) untuk melatih menulis secara terstruktur.
AI (Claude) menyiapkan kerangka dan kata kunci dari bahan referensi, pengguna menulis paragrafnya sendiri,
lalu AI menilai. AI tidak pernah menuliskan paragraf untuk pengguna.

## Fitur

- **Bahan referensi**: tempel teks, unggah PDF / Word (.docx) / TXT, atau beberapa bahan sekaligus. Teks diekstrak di browser.
- **Pengaturan latihan**: jenis tulisan (artikel, laporan, esai, dokumen teknis), bahasa (Indonesia/Inggris), jumlah paragraf (1–10), tingkat kesulitan (4/5/6 kata kunci).
- **Kerangka dari AI**: judul, tujuan, dan per paragraf: peran, ide pokok, kata kunci, petunjuk. Rantai hubungan kata kunci disimpan internal sebagai acuan penilaian dan tidak ditampilkan. Kerangka bisa dibuat ulang sebelum mulai.
- **Menulis**: kata kunci tampil di samping kotak tulis dan dicentang otomatis saat terdeteksi (termasuk bentuk berimbuhan: *kelola / pengelolaan / dikelola / mengelola*). Draf tersimpan otomatis.
- **Penilaian per paragraf** (dihitung oleh kode aplikasi dari nilai per kriteria yang diberikan AI dalam JSON terstruktur):
  - Kata kunci (bawaan maks. 50): tiap kata kunci 2 / 1 / 0 poin (tersambung baik / sekadar disebut / tidak dipakai) → `(poin ÷ poin maks) × 40` + bonus sambungan sampai 10 bila ≥3 kata kunci membentuk satu rantai gagasan.
  - Kualitas (bawaan maks. 50): kesesuaian ide pokok, kepaduan, kejelasan, kaidah bahasa (EYD V), ketepatan isi — masing-masing 0–10.
  - Umpan balik: status tiap kata kunci + alasan, satu hal yang bagus, maks. dua hal yang perlu diperbaiki (merujuk kalimat), pertanyaan pemandu — tanpa kalimat pengganti.
- **Revisi**: maks. 2 kali per paragraf, potongan 5% per revisi; skor sebelum/sesudah ditampilkan.
- **Pencegahan kecurangan**: kalimat yang terlalu mirip referensi ditandai dan dibuang sebelum dinilai; kata kunci yang dijejalkan dinilai "sekadar disebut"; mode ujian menonaktifkan tempel (paste).
- **Penilaian akhir**: rata-rata skor paragraf disesuaikan ±10% oleh kepaduan antarparagraf, dengan predikat (<60 Perlu latihan, 60–74 Cukup, 75–89 Baik, ≥90 Sangat baik), kekuatan, dan kelemahan.
- **Riwayat & progres**: daftar sesi, grafik skor kata kunci dan kualitas per sesi, kriteria yang paling sering lemah, unduh tulisan + penilaian (Markdown).
- **Bisa diatur** di Pengaturan: bobot kata kunci : kualitas, potongan per revisi, batas revisi, mode ujian bawaan, model Claude, dan ketelitian penilaian.

## Menjalankan

Butuh Node.js 20+.

```bash
npm install
npm run dev        # mode pengembangan
npm run build      # build produksi ke dist/
npm run preview    # menjalankan hasil build
npm test           # unit test (skor, deteksi kata kunci, deteksi salinan)
```

Hasil `dist/` adalah file statis dan bisa di-hosting di mana saja (GitHub Pages, Netlify, server internal).
Agar bisa dipasang sebagai PWA, situs harus diakses lewat HTTPS (atau `localhost`).

## API key dan keamanan

Aplikasi memanggil Claude API langsung dari browser memakai API key yang diisi pengguna di **Pengaturan**.
Key hanya disimpan di penyimpanan browser perangkat itu. Ini cocok untuk pemakaian pribadi atau prototipe.
Untuk dipakai banyak orang, pasang proxy di server yang menyimpan key, lalu isi **Alamat proxy** di Pengaturan
(proxy meneruskan permintaan `/v1/messages` ke `api.anthropic.com` dan menambahkan key-nya).

Model bawaan: Claude Opus 5.5 (bisa diganti ke Sonnet 5.5 atau Haiku 5.5 di Pengaturan). Untuk Opus 5.5 dan Sonnet 5.5,
aplikasi mengaktifkan *server-side fallback* (`fallbacks: "default"`) agar permintaan yang ditolak pengaman model dicoba ulang otomatis
dengan model cadangan.

## Struktur

```
src/lib/ai.ts        panggilan Claude (kerangka, nilai paragraf, nilai akhir) + skema JSON
src/lib/scoring.ts   rumus skor (bisa diubah tanpa mengubah prompt)
src/lib/text.ts      deteksi kata kunci berimbuhan & deteksi kalimat salinan
src/lib/extract.ts   ekstraksi teks PDF/DOCX/TXT
src/lib/storage.ts   penyimpanan sesi (IndexedDB) & pengaturan
src/screens/         halaman: beranda, latihan baru, sesi, pengaturan
```

## Di luar cakupan versi 1

Akun multi-pengguna (pelatih/peserta), papan peringkat, latihan yang ditugaskan ke tim, dan integrasi sistem internal.
